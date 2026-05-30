'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/services/user-actions';
import { recordAuditLog } from '@/services/audit-actions';
import { getLocalDateString } from '@/lib/utils';
import { calcProRataBaseSalary } from './base-salary-actions';
import { getMonthStart } from '@/lib/utils';
import { TenantSalaryConfig } from '@/types/domain';
import { Database } from '@/types/database.types';

// Interfaces for Database Records
interface KtvUserDataAdmin {
  id: string;
  full_name: string | null;
  base_salary: number | null;
  resignation_date: string | null;
  tenant_id?: string | null;
}

interface AttendanceLogAdmin {
  id: string;
  ktv_id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'half_day';
}

interface SessionLogAdmin {
  id: string;
  rating: number | null;
  bookings: { ktv_commission: number | null } | null;
  session_reviews: { rating: number | null; status: string | null }[];
}

interface SalaryRecordDbAdmin {
  id: string;
  ktv_id: string;
  month_year: string;
  base_salary: number | null;
  session_bonus: number | null;
  rating_bonus: number | null;
  kpi_bonus: number | null;
  violations_deduction: number | null;
  service_percentage_bonus: number | null;
  total_sessions: number | null;
  total_salary: number | null;
  status: string | null;
  published_at?: string | null;
  notes?: string | null;
  tenant_id: string;
  users?: { full_name: string | null } | null;
}

/**
 * Helper to recalculate and save a KTV salary record.
 * Handles pro-rata base salary, actual sessions count, session bonus commission,
 * rating-based quality bonus, KPI bonus from kpi_records, and attendance deductions.
 * Respects overrides from manual admin adjustments.
 */
async function recalculateAndSaveSalaryRecord(
  supabase: any,
  ktvId: string,
  monthYear: string,
  tenantId: string,
  overrides?: {
    base_salary?: number;
    kpi_bonus?: number;
    violations_deduction?: number;
    service_percentage_bonus?: number;
    status?: string;
    total_sessions?: number;
  }
) {
  // 1. Get KTV info (base_salary, resignation_date)
  const { data: ktvData, error: ktvError } = await supabase
    .from('users')
    .select('id, full_name, base_salary, resignation_date')
    .eq('id', ktvId)
    .single();

  if (ktvError) throw ktvError;
  const ktv = ktvData as KtvUserDataAdmin | null;

  // 2. Get salary config of tenant
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('salary_config')
    .eq('id', tenantId)
    .single();

  if (tenantError) throw tenantError;
  const stored = (tenantData?.salary_config as unknown as Partial<TenantSalaryConfig>) || {};
  const salaryConfig: TenantSalaryConfig = {
    bonus_5_star:          stored.bonus_5_star          ?? 50000,
    bonus_4_5_star:        stored.bonus_4_5_star        ?? 30000,
    bonus_4_star:          stored.bonus_4_star          ?? 10000,
    kpi_target_sessions:   stored.kpi_target_sessions   ?? 30,
    kpi_bonus_amount:      stored.kpi_bonus_amount      ?? 1000000,
    penalty_late_per_day:  stored.penalty_late_per_day  ?? 50000,
    penalty_absent_per_day: stored.penalty_absent_per_day ?? 200000,
  };
  const penaltyLate   = salaryConfig.penalty_late_per_day   ?? 50000;
  const penaltyAbsent = salaryConfig.penalty_absent_per_day ?? 200000;

  // 3. Fetch attendance list for pro-rata base salary and auto deductions
  const startOfMonthStr = monthYear;
  const endOfMonthStr = getLocalDateString(new Date(new Date(monthYear).getFullYear(), new Date(monthYear).getMonth() + 1, 1));

  const { data: attendanceList, error: attError } = await supabase
    .from('attendance')
    .select('status, date')
    .eq('ktv_id', ktvId)
    .gte('date', startOfMonthStr)
    .lt('date', endOfMonthStr);

  if (attError) throw attError;
  const attendanceListTyped = (attendanceList || []) as unknown as AttendanceLogAdmin[];

  let actualDays = 0;
  if (attendanceListTyped.length > 0) {
    attendanceListTyped.forEach((att) => {
      if (att.status === 'present' || att.status === 'late') {
        actualDays += 1.0;
      } else if (att.status === 'half_day') {
        actualDays += 0.5;
      }
    });
  }

  // 4. Fetch completed sessions this month
  const { data: sessions, error: sessionsError } = await supabase
    .from('session_logs')
    .select('id, rating, bookings(ktv_commission), session_reviews(rating, status)')
    .eq('completed_by_ktv_id', ktvId)
    .eq('status', 'completed')
    .gte('completed_date', startOfMonthStr)
    .lt('completed_date', endOfMonthStr);

  if (sessionsError) throw sessionsError;
  const sessionsTyped = (sessions || []) as unknown as SessionLogAdmin[];

  const sessionsCount = overrides?.total_sessions !== undefined
    ? overrides.total_sessions
    : sessionsTyped.length;

  const sessionBonus = sessionsTyped.reduce((acc: number, s) =>
    acc + (s.bookings?.ktv_commission || 150000), 0);

  // 5. Fetch blended composite rating from get_ktv_leaderboard RPC
  const { data: leaderboardData, error: leaderboardError } = await supabase.rpc(
    'get_ktv_leaderboard',
    { p_tenant_id: tenantId, p_month: monthYear }
  );
  if (leaderboardError) throw leaderboardError;

  const leaderboard = (leaderboardData || []) as unknown as {
    ktv_id: string;
    average_rating: number | null;
    late_days: number | null;
    absent_days: number | null;
  }[];
  const ktvRow = leaderboard.find((row) => row.ktv_id === ktvId);
  const avgRating: number | null = ktvRow?.average_rating ?? null;
  const lateDays   = ktvRow?.late_days   ?? 0;
  const absentDays = ktvRow?.absent_days ?? 0;
  const autoAttendancePenalty = (lateDays * penaltyLate) + (absentDays * penaltyAbsent);

  let bonusPerSession = 0;
  if (avgRating !== null) {
    if (avgRating === 5.0) bonusPerSession = salaryConfig.bonus_5_star;
    else if (avgRating >= 4.5) bonusPerSession = salaryConfig.bonus_4_5_star;
    else if (avgRating >= 4.0) bonusPerSession = salaryConfig.bonus_4_star;
  }
  const ratingBonus = sessionsCount * bonusPerSession;

  // 6. Fetch KPI bonus from kpi_records
  const { data: kpiRecords, error: kpiError } = await supabase
    .from('kpi_records')
    .select('bonus_amount')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear);
  
  if (kpiError) throw kpiError;
  const dbKpiBonus = kpiRecords?.reduce((acc: number, k: any) => acc + Number(k.bonus_amount || 0), 0) ?? 0;

  // 7. Get existing salary record
  const { data: existingData, error: existingError } = await supabase
    .from('salary_records')
    .select('*')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .maybeSingle();

  if (existingError) throw existingError;
  const existing = existingData as SalaryRecordDbAdmin | null;

  // Determine raw base salary from user profile (source of truth)
  const rawBaseSalary = ktv?.base_salary ?? 6000000;
  let proRataNote = '';

  const isDraft = !existing || existing.status === 'draft';

  // Base salary calculation: Recalculate if it's draft or new record,
  // but preserve if it has manual/approved/published values.
  let finalBaseSalary: number;
  if (overrides?.base_salary !== undefined) {
    finalBaseSalary = overrides.base_salary;
  } else if (existing && !isDraft && existing.base_salary !== null && existing.base_salary !== undefined) {
    finalBaseSalary = Number(existing.base_salary);
    if (existing.notes) proRataNote = existing.notes;
  } else if (attendanceListTyped.length > 0) {
    // Pro-rata: (rawBaseSalary / 26) × actual work days
    finalBaseSalary = Math.round((rawBaseSalary / 26) * actualDays);
    proRataNote = `📊 Công thực tế: ${actualDays}/26 ngày. `;
  } else {
    // No attendance data yet → use full base salary as default
    finalBaseSalary = rawBaseSalary;
    proRataNote = `ℹ️ Áp dụng lương cứng mặc định (Chưa có dữ liệu chấm công). `;
  }

  // Deductions calculation: Recalculate if it's draft or new record,
  // but preserve if it has manual/approved/published values.
  let deductions: number;
  if (overrides?.violations_deduction !== undefined) {
    deductions = overrides.violations_deduction;
  } else if (existing && !isDraft && existing.violations_deduction !== null && existing.violations_deduction !== undefined) {
    deductions = Number(existing.violations_deduction);
    if (existing.notes && !proRataNote) proRataNote = existing.notes;
  } else {
    deductions = autoAttendancePenalty;
  }

  if (overrides?.violations_deduction === undefined && isDraft && (lateDays > 0 || absentDays > 0)) {
    proRataNote += `⚠️ Tự động trừ ${autoAttendancePenalty.toLocaleString('vi-VN')}đ (trễ ${lateDays} ngày × ${penaltyLate.toLocaleString('vi-VN')}đ + vắng ${absentDays} ngày × ${penaltyAbsent.toLocaleString('vi-VN')}đ). `;
  }

  // Advances (Tạm ứng) — preserve existing value since this is always manually entered
  const advances = overrides?.service_percentage_bonus !== undefined
    ? overrides.service_percentage_bonus
    : (existing?.service_percentage_bonus ?? 0);

  // KPI Bonus — ALWAYS sync from kpi_records (source of truth),
  // UNLESS admin explicitly provides an override or it's preserved for non-drafts.
  const finalKpiBonus = overrides?.kpi_bonus !== undefined
    ? overrides.kpi_bonus
    : (existing && !isDraft && existing.kpi_bonus !== null && existing.kpi_bonus !== undefined ? Number(existing.kpi_bonus) : dbKpiBonus);

  // Pro-rata if resigned
  if (ktv?.resignation_date) {
    const resignDate = new Date(ktv.resignation_date);
    const monthDate = new Date(monthYear);
    const now = new Date();
    if (resignDate.getFullYear() === now.getFullYear() && resignDate.getMonth() === now.getMonth()) {
      const resignCap = await calcProRataBaseSalary(rawBaseSalary, resignDate, monthDate);
      if (finalBaseSalary > resignCap) {
        finalBaseSalary = resignCap;
      }
      proRataNote += `⚠️ KTV nghỉ việc từ ngày ${resignDate.toLocaleDateString('vi-VN')}`;
    }
  }

  const totalSalary = Math.max(0, finalBaseSalary + sessionBonus + ratingBonus + finalKpiBonus - deductions - advances);
  const status = overrides?.status || existing?.status || 'draft';

  const payload: Database['public']['Tables']['salary_records']['Insert'] = {
    ktv_id: ktvId,
    month_year: monthYear,
    base_salary: finalBaseSalary,
    session_bonus: sessionBonus,
    rating_bonus: ratingBonus,
    kpi_bonus: finalKpiBonus,
    violations_deduction: deductions,
    service_percentage_bonus: advances,
    total_sessions: sessionsCount,
    total_salary: totalSalary,
    status,
    published_at: overrides?.status === 'published' ? new Date().toISOString() : (existing?.published_at || null),
    notes: proRataNote || null,
    tenant_id: tenantId,
  };

  let result;
  if (existing) {
    result = await supabase
      .from('salary_records')
      .update(payload as Database['public']['Tables']['salary_records']['Update'])
      .eq('id', existing.id);
  } else {
    result = await supabase
      .from('salary_records')
      .insert(payload);
  }

  if (result.error) throw result.error;

  return { success: true, totalSalary };
}

/**
 * ADMIN: Publish salary record to KTV for confirmation.
 * Calculates final salary breakdown and sets status to 'published'.
 */
export async function publishSalaryRecord(ktvId: string) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  const now = new Date();
  const monthYear = getMonthStart(now);

  const { checkMonthLock } = await import('@/services/audit-actions');
  const { isLocked } = await checkMonthLock(monthYear);
  if (isLocked) {
    return { success: false, error: 'Tháng lương đã bị khóa, không thể phát hành bảng lương.' };
  }

  try {
    const res = await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId, {
      status: 'published'
    });

    await recordAuditLog({ 
      action: 'UPDATE', 
      table_name: 'salary_records', 
      record_id: ktvId, 
      new_data: { status: 'published', totalSalary: res.totalSalary } 
    });
    revalidatePath('/dashboard/salary');
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Error in publishSalaryRecord:', err);
    return { success: false, error: err.message || 'Lỗi không xác định' };
  }
}

/** ADMIN: Publish ALL draft salary records in current period */
export async function publishAllSalaryRecords() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  const { data: ktvs } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'ktv')
    .eq('tenant_id', tenantId);

  let count = 0;
  for (const ktv of (ktvs || [])) {
    const res = await publishSalaryRecord(ktv.id);
    if (res.success) count++;
  }
  return { success: true, count };
}

/** ADMIN: Confirm salary on behalf of KTV (no-smartphone case) */
export async function adminConfirmOnBehalf(ktvId: string) {
  const supabase = await createClient();
  const monthYear = getMonthStart();

  const { checkMonthLock } = await import('@/services/audit-actions');
  const { isLocked } = await checkMonthLock(monthYear);
  if (isLocked) {
    return { success: false, error: 'Tháng lương đã bị khóa, không thể xác nhận hộ.' };
  }

  const { error } = await supabase
    .from('salary_records')
    .update({ status: 'confirmed', ktv_confirmed_at: new Date().toISOString(), confirmed_by_admin: true })
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .in('status', ['published', 'disputed']);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard/salary');
  return { success: true };
}

/** ADMIN: Finalize salary record — locks and creates expense entry */
export async function finalizeSalaryRecord(ktvId: string) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  const now = new Date();
  const monthYear = getMonthStart(now);
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const { checkMonthLock } = await import('@/services/audit-actions');
  const { isLocked } = await checkMonthLock(monthYear);
  if (isLocked) {
    return { success: false, error: 'Tháng lương đã bị khóa, không thể hoàn tất.' };
  }

  const { data: recordData, error: fetchError } = await supabase
    .from('salary_records')
    .select('*, users(full_name)')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .eq('status', 'confirmed')
    .single();

  if (fetchError) throw fetchError;

  const record = recordData as unknown as SalaryRecordDbAdmin | null;

  if (!record) return { success: false, error: 'Không tìm thấy bản ghi đã được xác nhận' };

  // Lock record
  const { error: lockError } = await supabase.from('salary_records')
    .update({ status: 'finalized', finalized_at: new Date().toISOString() })
    .eq('id', record.id);

  if (lockError) throw lockError;

  // Lock session_logs
  const { error: sessionError } = await supabase.from('session_logs')
    .update({ is_confirmed: true })
    .eq('completed_by_ktv_id', ktvId)
    .eq('status', 'completed');

  if (sessionError) throw sessionError;

  // Create expense for Finance
  const { error: expenseError } = await supabase.from('expenses').insert({
    amount: record.total_salary || 0,
    category: 'salary',
    description: `Lương T${monthLabel} - ${record.users?.full_name || 'KTV'} [salary_record_id:${record.id}] [ktv_id:${ktvId}]`,
    status: 'submitted',
    expense_date: new Date().toISOString(),
    tenant_id: tenantId,
  });

  if (expenseError) throw expenseError;

  await recordAuditLog({ action: 'UPDATE', table_name: 'salary_records', record_id: ktvId, new_data: { status: 'finalized', amount: record.total_salary } });
  revalidatePath('/dashboard/salary');
  revalidatePath('/dashboard/finance');
  return { success: true };
}

/** ADMIN: Finalize ALL confirmed records */
export async function finalizeAllSalaryRecords() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  const monthYear = getMonthStart();
  const { data: confirmed } = await supabase
    .from('salary_records')
    .select('ktv_id')
    .eq('month_year', monthYear)
    .eq('status', 'confirmed')
    .eq('tenant_id', tenantId);

  let count = 0;
  for (const r of (confirmed || [])) {
    const res = await finalizeSalaryRecord(r.ktv_id);
    if (res.success) count++;
  }
  return { success: true, count };
}

/** ADMIN: Trigger auto-confirm for records published > 48h ago */
export async function checkAndAutoConfirm() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant_id) return { count: 0 };

  const { data } = await supabase.rpc('auto_confirm_stale_salary_records', {
    p_tenant_id: currentUser.tenant_id,
  });

  const count = data as number | null;

  if (count && count > 0) revalidatePath('/dashboard/salary');
  return { count: count ?? 0 };
}

export async function approveSalary(ktvId: string) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const supabase = await createClient();

  const { checkMonthLock } = await import('@/services/audit-actions');
  const { isLocked } = await checkMonthLock(monthYear);
  if (isLocked) {
    return { success: false, error: 'Tháng lương đã bị khóa, không thể phê duyệt.' };
  }

  try {
    // 1. Get KTV info for description
    const { data: ktvData, error: ktvError } = await supabase
      .from('users')
      .select('full_name, tenant_id')
      .eq('id', ktvId)
      .single();

    if (ktvError) throw ktvError;
    const ktv = ktvData;

    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id || ktv?.tenant_id;
    if (!tenantId) {
      return { success: false, error: 'Không xác định được chi nhánh của người dùng' };
    }

    // 2. Recalculate and update status to 'approved'
    const res = await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId, {
      status: 'approved'
    });

    // 3. Fetch the updated record to get its ID for expense description
    const { data: recordData, error: fetchError } = await supabase
      .from('salary_records')
      .select('id')
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear)
      .single();
    if (fetchError) throw fetchError;

    // 4. Create expense record in Finance dashboard
    const { error: expenseError } = await supabase
      .from('expenses')
      .insert({
        amount: res.totalSalary,
        category: 'salary',
        description: `Thanh toán lương T${monthLabel} - KTV ${ktv?.full_name || 'Nhân viên'} [salary_record_id:${recordData.id}] [ktv_id:${ktvId}]`,
        status: 'submitted', // Will appear as "Chờ duyệt" in Finance
        expense_date: new Date().toISOString(),
        tenant_id: tenantId
      });

    if (expenseError) throw expenseError;

    // Record Audit Log
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'salary_records',
      record_id: ktvId,
      new_data: { 
        status: 'approved', 
        amount: res.totalSalary, 
        ktv_name: ktv?.full_name 
      }
    });

    // Force revalidation of related pages
    revalidatePath('/dashboard/finance', 'page');
    revalidatePath('/dashboard/salary', 'page');
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error in approveSalary:', err);
    return { success: false, error: err.message || 'Lỗi không xác định' };
  }
}

export async function updateSalaryConfig(ktvId: string, payload: { baseSalary: number, kpiBonus: number, deductions: number, advances: number }) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const supabase = await createClient();

  const { checkMonthLock } = await import('@/services/audit-actions');
  const { isLocked } = await checkMonthLock(monthYear);
  if (isLocked) {
    return { success: false, error: 'Tháng lương đã bị khóa, không thể chỉnh sửa cấu hình lương.' };
  }

  try {
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

    await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId, {
      base_salary: payload.baseSalary,
      kpi_bonus: payload.kpiBonus,
      violations_deduction: payload.deductions,
      service_percentage_bonus: payload.advances,
      status: 'pending_approval'
    });

    // Record Audit Log
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'salary_records',
      record_id: ktvId,
      new_data: payload
    });

    revalidatePath('/dashboard/salary');
    return { success: true };
  } catch (err: unknown) {
    const errorObj = err as Error;
    console.error('updateSalaryConfig error:', errorObj);
    return { success: false, error: errorObj.message || 'Lỗi không xác định' };
  }
}

export async function confirmKtvSessions(ktvId: string, totalSessions: number) {
  const supabase = await createClient();
  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  const { checkMonthLock } = await import('@/services/audit-actions');
  const { isLocked } = await checkMonthLock(currentMonthYear);
  if (isLocked) {
    return { success: false, error: 'Tháng lương đã bị khóa, không thể xác nhận số buổi.' };
  }
  
  console.log(`Confirming sessions for KTV: ${ktvId}, Total: ${totalSessions}`);
  
  try {
    // 1. Mark sessions as confirmed in session_logs
    const { error: sessionError } = await supabase
      .from('session_logs')
      .update({ is_confirmed: true })
      .eq('completed_by_ktv_id', ktvId)
      .eq('status', 'completed');

    if (sessionError) {
      console.error('Error updating session_logs:', sessionError);
      throw sessionError;
    }

    // 2. Recalculate and update the salary record
    await recalculateAndSaveSalaryRecord(supabase, ktvId, currentMonthYear, tenantId, {
      total_sessions: totalSessions,
      status: 'pending_approval'
    });

    console.log('Session confirmation successful');
    revalidatePath('/dashboard/salary');
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Failed to confirm sessions (exception):', err);
    return { success: false, error: err.message || 'Lỗi không xác định' };
  }
}
