'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/services/user-actions';
import { recordAuditLog } from '@/services/audit-actions';
import { getLocalDateString } from '@/lib/utils';
import { calcProRataBaseSalary } from './base-salary-actions';
import { getMonthStart } from '@/lib/utils';

/**
 * ADMIN: Publish salary record to KTV for confirmation.
 * Calculates final salary breakdown and sets status to 'published'.
 */
export async function publishSalaryRecord(ktvId: string) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  const now = new Date();
  const monthYear = getMonthStart(now);

  try {
    // 1. Get KTV info (base_salary, resignation_date)
    const { data: ktv } = await supabase
      .from('users')
      .select('id, full_name, base_salary, resignation_date')
      .eq('id', ktvId)
      .single();

    const { data: tenantData } = await supabase.from('tenants').select('salary_config').eq('id', tenantId).single();
    const salaryConfig = tenantData?.salary_config || {
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

    let actualDays = 0;
    if (attendanceList && attendanceList.length > 0) {
      attendanceList.forEach((att: any) => {
        if (att.status === 'present' || att.status === 'late') {
          actualDays += 1.0;
        } else if (att.status === 'half_day') {
          actualDays += 0.5;
        }
        // 'absent' adds 0
      });
    }

    // 2. Fetch completed sessions this month with nested reviews joined by session_log_id
    // IMPORTANT: mirrors get_ktv_leaderboard RPC — reviews joined on sl.id, not created_at
    const startOfMonth = monthYear;
    const endOfMonth = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    const { data: sessions } = await supabase
      .from('session_logs')
      .select('id, rating, bookings(ktv_commission), session_reviews(rating, status)')
      .eq('completed_by_ktv_id', ktvId)
      .eq('status', 'completed')
      .gte('completed_date', startOfMonth)
      .lt('completed_date', endOfMonth);

    const sessionsCount = sessions?.length || 0;
    const sessionBonus = (sessions || []).reduce((acc: number, s: any) =>
      acc + (s.bookings?.ktv_commission || 150000), 0);

    // 3. Calculate rating — aligned with leaderboard: COALESCE(approved_review, session.rating, 5.0)
    const ratingValues: number[] = (sessions || []).map((s: any) => {
      const approvedReview = (s.session_reviews as any[])?.find((sr: any) => sr.status === 'approved');
      if (approvedReview?.rating) return approvedReview.rating as number;
      if (s.rating) return s.rating as number;
      return null;
    }).filter((v: number | null): v is number => v !== null);
    const avgRating = ratingValues.length > 0
      ? ratingValues.reduce((acc, v) => acc + v, 0) / ratingValues.length
      : 5.0;
    const bonusPerSession = avgRating === 5.0 ? salaryConfig.bonus_5_star : avgRating >= 4.5 ? salaryConfig.bonus_4_5_star : avgRating >= 4.0 ? salaryConfig.bonus_4_star : 0;
    const ratingBonus = sessionsCount * bonusPerSession;

    // 4. Get or init salary record for adjustments
    const { data: existing } = await supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear)
      .maybeSingle();

    const rawBaseSalary = existing?.base_salary ?? ktv?.base_salary ?? 6000000;
    const kpiBonus = existing?.kpi_bonus ?? (sessionsCount > salaryConfig.kpi_target_sessions ? salaryConfig.kpi_bonus_amount : 0);
    const deductions = existing?.violations_deduction ?? 0;
    const advances = existing?.service_percentage_bonus ?? 0;

    // 5. Pro-rata if resigned
    let finalBaseSalary = rawBaseSalary;
    let finalKpiBonus = kpiBonus;
    let finalRatingBonus = ratingBonus;
    let proRataNote = '';

    if (attendanceList && attendanceList.length > 0) {
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
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** ADMIN: Publish ALL draft salary records in current period */
export async function publishAllSalaryRecords() {
  const supabase = (await createClient()) as any;
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
  const supabase = (await createClient()) as any;
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
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  const now = new Date();
  const monthYear = getMonthStart(now);
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const { data: record } = await supabase
    .from('salary_records')
    .select('*, users(full_name)')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .eq('status', 'confirmed')
    .single();

  if (!record) return { success: false, error: 'Không tìm thấy bản ghi đã được xác nhận' };

  // Lock record
  await supabase.from('salary_records')
    .update({ status: 'finalized', finalized_at: new Date().toISOString() })
    .eq('id', record.id);

  // Lock session_logs
  await supabase.from('session_logs')
    .update({ is_confirmed: true })
    .eq('completed_by_ktv_id', ktvId)
    .eq('status', 'completed');

  // Create expense for Finance
  await supabase.from('expenses').insert({
    amount: record.total_salary,
    category: 'salary',
    description: `Lương T${monthLabel} - ${record.users?.full_name || 'KTV'}`,
    status: 'submitted',
    expense_date: new Date().toISOString(),
    tenant_id: tenantId,
  });

  await recordAuditLog({ action: 'UPDATE', table_name: 'salary_records', record_id: ktvId, new_data: { status: 'finalized', amount: record.total_salary } });
  revalidatePath('/dashboard/salary');
  revalidatePath('/dashboard/finance');
  return { success: true };
}

/** ADMIN: Finalize ALL confirmed records */
export async function finalizeAllSalaryRecords() {
  const supabase = (await createClient()) as any;
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
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant_id) return { count: 0 };

  const { data } = await supabase.rpc('auto_confirm_stale_salary_records', {
    p_tenant_id: currentUser.tenant_id,
  });

  if (data > 0) revalidatePath('/dashboard/salary');
  return { count: data ?? 0 };
}

export async function approveSalary(ktvId: string) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const supabase = (await createClient()) as any;

  try {
    // 1. Get KTV info for description
    const { data: ktv } = await supabase
      .from('users')
      .select('full_name, tenant_id')
      .eq('id', ktvId)
      .single() as any;

    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id || ktv?.tenant_id;
    if (!tenantId) {
      return { success: false, error: 'Không xác định được chi nhánh của người dùng' };
    }

    const { data: tenantData } = await supabase.from('tenants').select('salary_config').eq('id', tenantId).single();
    const salaryConfig = tenantData?.salary_config || {
      kpi_target_sessions: 30,
      kpi_bonus_amount: 1000000
    };

    const endOfMonth = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    // 2. Fetch completed sessions with booking details to get the locked commission rate
    const { data: sessions } = await supabase
      .from('session_logs')
      .select('id, bookings(ktv_commission)')
      .eq('completed_by_ktv_id', ktvId)
      .eq('status', 'completed')
      .gte('completed_date', monthYear)
      .lt('completed_date', endOfMonth);
    
    const ktvSessionsCount = sessions?.length || 0;
    
    const sessionBonus = (sessions || []).reduce((acc: number, s: any) => {
      return acc + (s.bookings?.ktv_commission || 150000);
    }, 0);

    // 3. Get/Calculate salary details
    const { data: existing } = await (supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear)
      .single() as any);

    const baseSalary = existing?.base_salary || 6000000;
    const kpiBonus = existing?.kpi_bonus ?? (ktvSessionsCount > salaryConfig.kpi_target_sessions ? salaryConfig.kpi_bonus_amount : 0);
    const ratingBonus = existing?.rating_bonus || 0;
    const deductions = existing?.violations_deduction || 0;
    const advances = existing?.service_percentage_bonus || 0;
    const totalSalary = baseSalary + sessionBonus + kpiBonus + ratingBonus - deductions - advances;

    // 4. Update or Insert salary record
    if (existing) {
      const { error: updateError } = await (supabase
        .from('salary_records') as any)
        .update({ status: 'approved' })
        .eq('id', existing.id);
      
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await (supabase
        .from('salary_records') as any)
        .insert([{
          ktv_id: ktvId,
          month_year: monthYear,
          base_salary: baseSalary,
          kpi_bonus: kpiBonus,
          violations_deduction: deductions,
          service_percentage_bonus: advances,
          status: 'approved',
          tenant_id: tenantId
        }]);
      
      if (insertError) throw insertError;
    }

    // 5. Create expense record in Finance dashboard
    const { error: expenseError } = await (supabase
      .from('expenses') as any)
      .insert({
        amount: totalSalary,
        category: 'salary',
        description: `Thanh toán lương T${monthLabel} - KTV ${ktv?.full_name || 'Nhân viên'}`,
        status: 'submitted', // Will appear as "Chờ duyệt" in Finance
        expense_date: new Date().toISOString(),
        tenant_id: tenantId
      });

    if (expenseError) {
      console.error('Error creating expense record:', expenseError);
    }

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
  } catch (error: any) {
    console.error('Error in approveSalary:', error);
    return { success: false, error: error.message || error };
  }
}

export async function updateSalaryConfig(ktvId: string, payload: { baseSalary: number, kpiBonus: number, deductions: number, advances: number }) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const supabase = (await createClient()) as any;

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
  } catch (err: any) {
    console.error('updateSalaryConfig error:', err);
    return { success: false, error: err.message || err };
  }
}

export async function confirmKtvSessions(ktvId: string, totalSessions: number) {
  const supabase = (await createClient()) as any;
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
  } catch (error) {
    console.error('Failed to confirm sessions (exception):', error);
    return { success: false, error: (error as any).message };
  }
}
