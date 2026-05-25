'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/services/user-actions';
import { recordAuditLog } from '@/services/audit-actions';
import { getLocalDateString } from '@/lib/utils';
import { calcProRataBaseSalary } from './base-salary-actions';
import { getMonthStart } from '@/lib/utils';
import { TenantSalaryConfig } from '@/types/domain';

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

  try {
    // 1. Get KTV info (base_salary, resignation_date)
    const { data: ktvData } = await supabase
      .from('users')
      .select('id, full_name, base_salary, resignation_date')
      .eq('id', ktvId)
      .single();

    const ktv = ktvData as KtvUserDataAdmin | null;

    const { data: tenantData } = await supabase.from('tenants').select('salary_config').eq('id', tenantId).single();
    const salaryConfig = (tenantData?.salary_config as unknown as TenantSalaryConfig) || {
      bonus_5_star: 50000,
      bonus_4_5_star: 30000,
      bonus_4_star: 10000,
      kpi_target_sessions: 30,
      kpi_bonus_amount: 1000000
    };

    // 1.1 Fetch actual attendance records this month for pro-rata calculation
    const startOfMonthStr = monthYear;
    const endOfMonthStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    const { data: attendanceList } = await supabase
      .from('attendance')
      .select('status, date')
      .eq('ktv_id', ktvId)
      .gte('date', startOfMonthStr)
      .lt('date', endOfMonthStr);

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

    // 2. Fetch completed sessions this month with nested reviews joined by session_log_id
    const startOfMonth = monthYear;
    const endOfMonth = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    const { data: sessions } = await supabase
      .from('session_logs')
      .select('id, rating, bookings(ktv_commission), session_reviews(rating, status)')
      .eq('completed_by_ktv_id', ktvId)
      .eq('status', 'completed')
      .gte('completed_date', startOfMonth)
      .lt('completed_date', endOfMonth);

    const sessionsTyped = (sessions || []) as unknown as SessionLogAdmin[];

    const sessionsCount = sessionsTyped.length;
    const sessionBonus = sessionsTyped.reduce((acc: number, s) =>
      acc + (s.bookings?.ktv_commission || 150000), 0);

    // 3. Calculate rating — aligned with leaderboard: COALESCE(approved_review, session.rating, 5.0)
    const ratingValues: number[] = sessionsTyped.map((s) => {
      const approvedReview = s.session_reviews?.find((sr) => sr.status === 'approved');
      if (approvedReview?.rating) return approvedReview.rating;
      if (s.rating) return s.rating;
      return null;
    }).filter((v: number | null): v is number => v !== null);
    
    const avgRating = ratingValues.length > 0
      ? ratingValues.reduce((acc, v) => acc + v, 0) / ratingValues.length
      : 5.0;
    
    const bonusPerSession = avgRating === 5.0 ? salaryConfig.bonus_5_star : avgRating >= 4.5 ? salaryConfig.bonus_4_5_star : avgRating >= 4.0 ? salaryConfig.bonus_4_star : 0;
    const ratingBonus = sessionsCount * bonusPerSession;

    // 4. Get or init salary record for adjustments
    const { data: existingData } = await supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear)
      .maybeSingle();

    const existing = existingData as SalaryRecordDbAdmin | null;

    const rawBaseSalary = existing?.base_salary ?? ktv?.base_salary ?? 6000000;
    const kpiBonus = existing?.kpi_bonus ?? (sessionsCount > salaryConfig.kpi_target_sessions ? salaryConfig.kpi_bonus_amount : 0);
    const deductions = existing?.violations_deduction ?? 0;
    const advances = existing?.service_percentage_bonus ?? 0;

    // 5. Pro-rata if resigned
    let finalBaseSalary = rawBaseSalary;
    let finalKpiBonus = kpiBonus;
    let finalRatingBonus = ratingBonus;
    let proRataNote = '';

    if (attendanceListTyped.length > 0) {
      // Pro-rata based on actual working days (Target = 26 days)
      finalBaseSalary = Math.round((rawBaseSalary / 26) * actualDays);
      proRataNote = `📊 Công thực tế: ${actualDays}/26 ngày. `;
    } else {
      // Fallback safeguard: if exactly 0 attendance records, pay full base salary
      finalBaseSalary = rawBaseSalary;
      proRataNote = `ℹ️ Áp dụng lương cứng mặc định (Chưa có dữ liệu chấm công). `;
    }

    if (ktv?.resignation_date) {
      const resignDate = new Date(ktv.resignation_date);
      const monthDate = new Date(monthYear);
      if (resignDate.getFullYear() === now.getFullYear() && resignDate.getMonth() === now.getMonth()) {
        const resignCap = await calcProRataBaseSalary(rawBaseSalary, resignDate, monthDate);
        if (finalBaseSalary > resignCap) {
          finalBaseSalary = resignCap;
        }
        finalKpiBonus = 0;
        finalRatingBonus = 0;
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysWorked = resignDate.getDate();
        proRataNote += `⚠️ KTV nghỉ việc từ ngày ${resignDate.toLocaleDateString('vi-VN')} (Giới hạn tối đa ${daysWorked}/${daysInMonth} ngày)`;
      }
    }

    const totalSalary = finalBaseSalary + sessionBonus + finalRatingBonus + finalKpiBonus - deductions - advances;

    // 6. Upsert salary record
    const payload = {
      ktv_id: ktvId,
      month_year: monthYear,
      base_salary: finalBaseSalary,
      session_bonus: sessionBonus,
      rating_bonus: finalRatingBonus,
      kpi_bonus: finalKpiBonus,
      violations_deduction: deductions,
      service_percentage_bonus: advances,
      total_sessions: sessionsCount,
      total_salary: totalSalary,
      status: 'published',
      published_at: new Date().toISOString(),
      notes: proRataNote || null,
      tenant_id: tenantId,
    };

    if (existing) {
      await supabase.from('salary_records').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('salary_records').insert(payload);
    }

    await recordAuditLog({ action: 'UPDATE', table_name: 'salary_records', record_id: ktvId, new_data: { status: 'published', totalSalary } });
    revalidatePath('/dashboard/salary');
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
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

  try {
    // 1. Get KTV info for description
    const { data: ktvData, error: ktvError } = await supabase
      .from('users')
      .select('full_name, tenant_id')
      .eq('id', ktvId)
      .single();

    if (ktvError) throw ktvError;

    const ktv = ktvData as KtvUserDataAdmin | null;

    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id || ktv?.tenant_id;
    if (!tenantId) {
      return { success: false, error: 'Không xác định được chi nhánh của người dùng' };
    }

    const { data: tenantData, error: tenantError } = await supabase.from('tenants').select('salary_config').eq('id', tenantId).single();
    if (tenantError) throw tenantError;

    const salaryConfig = (tenantData?.salary_config as unknown as TenantSalaryConfig) || {
      bonus_5_star: 50000,
      bonus_4_5_star: 30000,
      bonus_4_star: 10000,
      kpi_target_sessions: 30,
      kpi_bonus_amount: 1000000
    };

    const endOfMonth = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    // 2. Fetch completed sessions with booking details to get the locked commission rate
    const { data: sessions, error: sessionsError } = await supabase
      .from('session_logs')
      .select('id, bookings(ktv_commission)')
      .eq('completed_by_ktv_id', ktvId)
      .eq('status', 'completed')
      .gte('completed_date', monthYear)
      .lt('completed_date', endOfMonth);
    
    if (sessionsError) throw sessionsError;

    const sessionsTyped = (sessions || []) as unknown as SessionLogAdmin[];
    
    const ktvSessionsCount = sessionsTyped.length;
    
    const sessionBonus = sessionsTyped.reduce((acc: number, s) => {
      return acc + (s.bookings?.ktv_commission || 150000);
    }, 0);

    // 3. Get/Calculate salary details
    const { data: existingData, error: existingError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear)
      .maybeSingle();

    if (existingError) throw existingError;

    const existing = existingData as SalaryRecordDbAdmin | null;

    const baseSalary = existing?.base_salary || 6000000;
    const kpiBonus = existing?.kpi_bonus ?? (ktvSessionsCount > salaryConfig.kpi_target_sessions ? salaryConfig.kpi_bonus_amount : 0);
    const ratingBonus = existing?.rating_bonus || 0;
    const deductions = existing?.violations_deduction || 0;
    const advances = existing?.service_percentage_bonus || 0;
    const totalSalary = baseSalary + sessionBonus + kpiBonus + ratingBonus - deductions - advances;

    let salaryRecordId = existing?.id;

    // 4. Update or Insert salary record
    if (existing) {
      const { error: updateError } = await supabase
        .from('salary_records')
        .update({ status: 'approved' })
        .eq('id', existing.id);
      
      if (updateError) throw updateError;
    } else {
      const { data: insertedRecord, error: insertError } = await supabase
        .from('salary_records')
        .insert([{
          ktv_id: ktvId,
          month_year: monthYear,
          base_salary: baseSalary,
          kpi_bonus: kpiBonus,
          violations_deduction: deductions,
          service_percentage_bonus: advances,
          status: 'approved',
          tenant_id: tenantId
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      salaryRecordId = insertedRecord?.id;
    }

    // 5. Create expense record in Finance dashboard
    const { error: expenseError } = await supabase
      .from('expenses')
      .insert({
        amount: totalSalary,
        category: 'salary',
        description: `Thanh toán lương T${monthLabel} - KTV ${ktv?.full_name || 'Nhân viên'} [salary_record_id:${salaryRecordId || ''}] [ktv_id:${ktvId}]`,
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
        amount: totalSalary, 
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

  try {
    // Check if record exists
    const { data: existing } = await supabase
      .from('salary_records')
      .select('id')
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear)
      .single();

    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

    if (existing) {
      const { error } = await supabase
        .from('salary_records')
        .update({
          base_salary: payload.baseSalary,
          kpi_bonus: payload.kpiBonus,
          violations_deduction: payload.deductions,
          service_percentage_bonus: payload.advances,
          status: 'pending_approval' // Change status to "Chờ duyệt"
        })
        .eq('id', existing.id);

      if (error) return { success: false, error: error.message };
    } else {
      // Insert new
      const { error } = await supabase
        .from('salary_records')
        .insert([{
          ktv_id: ktvId,
          month_year: monthYear,
          base_salary: payload.baseSalary,
          kpi_bonus: payload.kpiBonus,
          violations_deduction: payload.deductions,
          service_percentage_bonus: payload.advances,
          status: 'pending_approval', // Set as "Chờ duyệt"
          tenant_id: tenantId
        }]);

      if (error) return { success: false, error: error.message };
    }

    // Record Audit Log
    await recordAuditLog({
      action: existing ? 'UPDATE' : 'INSERT',
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
    }

    // 2. Check for existing salary record
    const { data: existing, error: fetchError } = await supabase
      .from('salary_records')
      .select('id')
      .eq('ktv_id', ktvId)
      .eq('month_year', currentMonthYear)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing salary record:', fetchError);
      return { success: false, error: fetchError.message };
    }

    let result;
    if (existing) {
      console.log(`Updating existing salary record: ${existing.id}`);
      result = await supabase
        .from('salary_records')
        .update({ 
          total_sessions: totalSessions,
          status: 'pending_approval'
        })
        .eq('id', existing.id);
    } else {
      console.log(`Inserting new salary record for KTV: ${ktvId}`);
      result = await supabase
        .from('salary_records')
        .insert({
          ktv_id: ktvId,
          month_year: currentMonthYear,
          total_sessions: totalSessions,
          status: 'pending_approval',
          tenant_id: tenantId // Crucial: add tenant_id for consistency
        });
    }

    if (result.error) {
      console.error('Error updating/inserting salary record:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log('Session confirmation successful');
    revalidatePath('/dashboard/salary');
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Failed to confirm sessions (exception):', err);
    return { success: false, error: err.message || 'Lỗi không xác định' };
  }
}
