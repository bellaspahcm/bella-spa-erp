'use server';

import { resolvePackageName } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { recordAuditLog } from './audit-actions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthStart(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Calculate pro-rata base salary for resigned KTVs */
function calcProRataBaseSalary(baseSalary: number, resignationDate: Date, monthYear: Date): number {
  const monthStart = new Date(monthYear.getFullYear(), monthYear.getMonth(), 1);
  const daysInMonth = new Date(monthYear.getFullYear(), monthYear.getMonth() + 1, 0).getDate();
  const daysWorked = Math.max(0, Math.floor((resignationDate.getTime() - monthStart.getTime()) / 86400000) + 1);
  return Math.round(baseSalary * (daysWorked / daysInMonth));
}

// ─── V2 WORKFLOW ACTIONS ──────────────────────────────────────────────────────

/**
 * ADMIN: Publish salary record to KTV for confirmation.
 * Calculates final salary breakdown and sets status to 'published'.
 */
export async function publishSalaryRecord(ktvId: string) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) return { success: false, error: 'Không tìm thấy tenant' };

  const now = new Date();
  const monthYear = getMonthStart(now);

  try {
    // 1. Get KTV info (base_salary, resignation_date)
    const { data: ktv } = await supabase
      .from('users')
      .select('id, full_name, base_salary, resignation_date')
      .eq('id', ktvId)
      .single();

    // 2. Fetch completed sessions this month
    const startOfMonth = monthYear;
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
    const { data: sessions } = await supabase
      .from('session_logs')
      .select('id, bookings(ktv_commission)')
      .eq('completed_by_ktv_id', ktvId)
      .eq('status', 'completed')
      .gte('completed_date', startOfMonth)
      .lt('completed_date', endOfMonth);

    // 3. Fetch reviews for rating bonus
    const { data: reviews } = await supabase
      .from('session_reviews')
      .select('rating')
      .eq('ktv_id', ktvId)
      .eq('status', 'approved');

    const sessionsCount = sessions?.length || 0;
    const sessionBonus = (sessions || []).reduce((acc: number, s: any) =>
      acc + (s.bookings?.ktv_commission || 150000), 0);

    const avgRating = reviews?.length > 0
      ? reviews.reduce((a: number, r: any) => a + (r.rating || 0), 0) / reviews.length
      : 5.0;
    const bonusPerSession = avgRating === 5.0 ? 50000 : avgRating >= 4.5 ? 30000 : avgRating >= 4.0 ? 10000 : 0;
    const ratingBonus = sessionsCount * bonusPerSession;

    // 4. Get or init salary record for adjustments
    const { data: existing } = await supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear)
      .maybeSingle();

    const rawBaseSalary = existing?.base_salary ?? ktv?.base_salary ?? 6000000;
    const kpiBonus = existing?.kpi_bonus ?? (sessionsCount > 30 ? 1000000 : 0);
    const deductions = existing?.violations_deduction ?? 0;
    const advances = existing?.service_percentage_bonus ?? 0;

    // 5. Pro-rata if resigned
    let finalBaseSalary = rawBaseSalary;
    let finalKpiBonus = kpiBonus;
    let finalRatingBonus = ratingBonus;
    let proRataNote = '';

    if (ktv?.resignation_date) {
      const resignDate = new Date(ktv.resignation_date);
      const monthDate = new Date(monthYear);
      if (resignDate.getFullYear() === now.getFullYear() && resignDate.getMonth() === now.getMonth()) {
        finalBaseSalary = calcProRataBaseSalary(rawBaseSalary, resignDate, monthDate);
        finalKpiBonus = 0;
        finalRatingBonus = 0;
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysWorked = resignDate.getDate();
        proRataNote = `⚠️ KTV nghỉ ngày ${resignDate.toLocaleDateString('vi-VN')} — Lương cứng tính ${daysWorked}/${daysInMonth} ngày`;
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
  if (!tenantId) return { success: false, error: 'Không tìm thấy tenant' };

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

/** KTV: Confirm their own salary record */
export async function ktvConfirmSalary(salaryRecordId: string) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };

  const { error } = await supabase
    .from('salary_records')
    .update({ status: 'confirmed', ktv_confirmed_at: new Date().toISOString() })
    .eq('id', salaryRecordId)
    .eq('ktv_id', currentUser.id)
    .in('status', ['published', 'disputed']);

  if (error) return { success: false, error: error.message };

  await recordAuditLog({ action: 'UPDATE', table_name: 'salary_records', record_id: salaryRecordId, new_data: { status: 'confirmed' } });
  revalidatePath('/ktv/earnings');
  revalidatePath('/dashboard/salary');
  return { success: true };
}

/** KTV: Dispute their salary with a reason */
export async function ktvDisputeSalary(salaryRecordId: string, reason: string) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: 'Chưa đăng nhập' };

  const tenantId = currentUser.tenant_id;

  const { error: updateError } = await supabase
    .from('salary_records')
    .update({ status: 'disputed', dispute_reason: reason })
    .eq('id', salaryRecordId)
    .eq('ktv_id', currentUser.id)
    .eq('status', 'published');

  if (updateError) return { success: false, error: updateError.message };

  await supabase.from('salary_disputes').insert({
    salary_record_id: salaryRecordId,
    ktv_id: currentUser.id,
    dispute_reason: reason,
    status: 'open',
    tenant_id: tenantId,
  });

  revalidatePath('/ktv/earnings');
  revalidatePath('/dashboard/salary');
  return { success: true };
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
  if (!tenantId) return { success: false, error: 'Không tìm thấy tenant' };

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
  if (!tenantId) return { success: false, error: 'Không tìm thấy tenant' };

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

/** KTV: Get their own salary record for the confirmation screen */
export async function getKtvSalaryForConfirmation(month?: string) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const now = new Date();
  const monthStr = month || getMonthStart(now);
  const startOfMonth = monthStr;
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];

  // Get salary record
  const { data: record } = await supabase
    .from('salary_records')
    .select('*')
    .eq('ktv_id', currentUser.id)
    .eq('month_year', monthStr)
    .maybeSingle();

  // Get session details for KTV to cross-check
  const { data: sessions } = await supabase
    .from('session_logs')
    .select(`id, completed_date, session_number, bookings(package_name, ktv_commission, customers(name_mother))`)
    .eq('completed_by_ktv_id', currentUser.id)
    .eq('status', 'completed')
    .gte('completed_date', startOfMonth)
    .lt('completed_date', endOfMonth)
    .order('completed_date', { ascending: false });

  return { record, sessions: sessions || [] };
}




export async function getSalaryData() {
  try {
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const supabase = (await createClient()) as any;
    const currentUser = await getCurrentUser();

    // Fetch KTVs
    const ktvQuery = supabase
      .from('users')
      .select('id, full_name, role')
      .eq('role', 'ktv');

    // If current user is KTV, they can only see their own data
    if (currentUser?.role === 'ktv') {
      ktvQuery.eq('id', currentUser.id);
    }

    const { data: ktvs, error: ktvError } = await ktvQuery;

    const realKtvs = ktvs || [];

    const { data: salaryRecords, error: salaryError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('month_year', currentMonthYear);

    // Fetch completed sessions with booking details to get the locked commission rate
    const { data: sessions, error: sessionsError } = await supabase
      .from('session_logs')
      .select('id, completed_by_ktv_id, status, is_confirmed, bookings(ktv_commission)')
      .eq('status', 'completed');

    // Fetch session reviews for rating bonus calculation
    const { data: reviews } = await supabase
      .from('session_reviews')
      .select('ktv_id, rating')
      .eq('status', 'approved');

    const ktvSalaries = realKtvs.map((ktv: any) => {
        const record = salaryRecords?.find((r: any) => r.ktv_id === ktv.id);
        
        const ktvCompletedSessions = sessions?.filter((s: any) => s.completed_by_ktv_id === ktv.id) || [];
        // Use confirmed count from record if available, otherwise use live count
        const ktvSessionsCount = record?.total_sessions || ktvCompletedSessions.length;
        
        // Calculate Average Rating
        const ktvReviews = reviews?.filter((r: any) => r.ktv_id === ktv.id) || [];
        const avgRating = ktvReviews.length > 0 
          ? ktvReviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0) / ktvReviews.length 
          : 5.0; 

        let bonusPerSession = 0;
        if (avgRating === 5.0) bonusPerSession = 50000;
        else if (avgRating >= 4.5) bonusPerSession = 30000;
        else if (avgRating >= 4.0) bonusPerSession = 10000;

        const ratingBonus = ktvSessionsCount * bonusPerSession;

        let status = record?.status || 'draft';

        const sessionBonus = ktvCompletedSessions.reduce((acc: number, s: any) => {
          return acc + (s.bookings?.ktv_commission || 150000);
        }, 0);

        const baseSalary = record?.base_salary || 6000000;
        const kpiBonus = record?.kpi_bonus || (ktvSessionsCount > 30 ? 1000000 : 0);
        const deductions = record?.violations_deduction || 0;
        const advances = record?.service_percentage_bonus || 0; 
        const totalSalary = baseSalary + sessionBonus + kpiBonus + ratingBonus - deductions - advances;

        return {
          id: ktv.id,
          name: ktv.full_name,
          sessions: ktvSessionsCount,
          avgRating,
          baseSalary,
          sessionBonus,
          ratingBonus,
          kpiBonus,
          deductions,
          advances,
          totalSalary,
          status
        };
    });

    return ktvSalaries;
  } catch (error) {
    console.error('Error in getSalaryData:', error);
    return [];
  }
}

export async function approveSalary(ktvId: string) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const supabase = await createClient();

  try {
    // 1. Get KTV info for description
    const { data: ktv } = await supabase
      .from('users')
      .select('full_name, tenant_id')
      .eq('id', ktvId)
      .single() as any;

    // 2. Fetch completed sessions with booking details to get the locked commission rate
    const { data: sessions } = await supabase
      .from('session_logs')
      .select('id, bookings(ktv_commission)')
      .eq('completed_by_ktv_id', ktvId)
      .eq('status', 'completed');
    
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
    const kpiBonus = existing?.kpi_bonus || (ktvSessionsCount > 30 ? 1000000 : 0);
    const deductions = existing?.violations_deduction || 0;
    const advances = existing?.service_percentage_bonus || 0;
    const totalSalary = baseSalary + sessionBonus + kpiBonus - deductions - advances;

    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) throw new Error('Tenant ID not found for current user session');

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
    if (!tenantId) throw new Error('Tenant ID not found for current user session');

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



export async function getKtvSessionMatrix() {
  const { unstable_noStore: noStore } = await import('next/cache');
  noStore();
  
  const supabase = (await createClient()) as any;
  
  try {
    // 1. Fetch all KTVs
    const { data: ktvs } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'ktv');

    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // 2. Fetch salary records for confirmation status
    const { data: salaryRecords } = await supabase
      .from('salary_records')
      .select('ktv_id, total_sessions, status')
      .eq('month_year', currentMonthYear);

    // 3. Fetch completed sessions with booking details
    const { data: sessions, error: sessionsError } = await supabase
      .from('session_logs')
      .select(`
        id, 
        completed_by_ktv_id, 
        status, 
        is_confirmed,
        bookings (
          id,
          package_name,
          full_price,
          packages (
            name
          )
        )
      `)
      .eq('status', 'completed');

    if (sessionsError) console.error('Error fetching sessions:', sessionsError);

    // 4. Group sessions by KTV and package
    const matrix: Record<string, Record<string, number>> = {};
    
    // Fetch all available packages from the database to ensure all columns are shown
    const { data: allPackages, error: allPackagesError } = await supabase.from('packages').select('name');
    
    // Build list of package names from sessions AND available packages
    const dynamicPackageNames = new Set<string>();
    
    // Add all existing packages to the columns list
    if (allPackages) {
      allPackages.forEach((pkg: any) => {
        if (pkg.name) dynamicPackageNames.add(pkg.name);
      });
    }

    if (sessions) {
      sessions.forEach((s: any) => {
        const pkgName = s.bookings ? resolvePackageName(s.bookings) : 'Dịch vụ lẻ';
        dynamicPackageNames.add(pkgName);
      });
    }
    const packageNames = Array.from(dynamicPackageNames);
    if (!packageNames.includes('Dịch vụ lẻ')) packageNames.push('Dịch vụ lẻ');
    
    if (sessions && sessions.length > 0) {
      sessions.forEach((s: any) => {
        const ktvId = s.completed_by_ktv_id;
        if (!ktvId) return;

        const pkgName = s.bookings ? resolvePackageName(s.bookings) : 'Dịch vụ lẻ';
        
        if (!matrix[ktvId]) matrix[ktvId] = {};
        matrix[ktvId][pkgName] = (matrix[ktvId][pkgName] || 0) + 1;
      });
    }

    const hasAnyRealData = sessions && sessions.length > 0;
    
    const rows = (ktvs || []).map((ktv: any) => {
      const row: any = { id: ktv.id, name: ktv.full_name, isConfirmed: false };
      
      // Determine if this KTV's sessions are confirmed
      const salaryRecord = salaryRecords?.find((r: any) => r.ktv_id === ktv.id);
      
      // Confirmed ONLY if status is explicitly pending_approval or approved
      row.isConfirmed = !!(salaryRecord && 
                        (salaryRecord.status === 'pending_approval' || salaryRecord.status === 'approved'));
      
      packageNames.forEach((pkg: string) => {
        if (hasAnyRealData && matrix[ktv.id]) {
          row[pkg] = matrix[ktv.id][pkg] || 0;
        } else {
          row[pkg] = 0;
        }
      });
      return row;
    });

    return { 
      packageNames, 
      ktvs: rows
    };
  } catch (error) {
    console.error('Critical error in getKtvSessionMatrix:', error);
    return { ktvs: [], packageNames: [] };
  }
}

export async function confirmKtvSessions(ktvId: string, totalSessions: number) {
  const supabase = (await createClient()) as any;
  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) throw new Error('Tenant ID not found for current user session');
  
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
