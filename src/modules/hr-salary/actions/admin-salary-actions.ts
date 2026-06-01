'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { recordAuditLog } from '@/services/audit-actions';
import { getMonthStart } from '@/lib/utils';
import { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  recalculateAndSaveSalaryRecordEngine,
  type SalaryRecalculationOverrides,
  type SalaryRecordDbAdmin,
} from './salary-recalculation-engine';
import {
  createSalaryExpense,
  getSalaryMonthLockFailure,
  recordSalaryStatusAudit,
  revalidateApprovedSalaryViews,
  revalidateSalaryAndFinancePages,
  revalidateSalaryPage,
} from './admin-salary-workflow-helpers';

type SalaryRecordRow = Database['public']['Tables']['salary_records']['Row'];
type SalaryRecordInsert = Database['public']['Tables']['salary_records']['Insert'];
type SalaryRecordUpdate = Database['public']['Tables']['salary_records']['Update'];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
type SessionLogUpdate = Database['public']['Tables']['session_logs']['Update'];
type SessionConfirmationSnapshot = Pick<SessionLogRow, 'id' | 'is_confirmed'>;

/**
 * Helper to recalculate and save a KTV salary record.
 * Handles pro-rata base salary, actual sessions count, session bonus commission,
 * rating-based quality bonus, KPI bonus from kpi_records, and attendance deductions.
 * Respects overrides from manual admin adjustments.
 */
export async function recalculateAndSaveSalaryRecord(
  supabase: SupabaseClient<Database>,
  ktvId: string,
  monthYear: string,
  tenantId: string,
  overrides?: SalaryRecalculationOverrides
) {
  return recalculateAndSaveSalaryRecordEngine(supabase, ktvId, monthYear, tenantId, overrides);
}

function toSalaryRecordSnapshotPayload(record: SalaryRecordRow): SalaryRecordInsert {
  return {
    accounting_metadata: record.accounting_metadata,
    accounting_review_status: record.accounting_review_status,
    accounting_template_id: record.accounting_template_id,
    base_salary: record.base_salary,
    business_event_type: record.business_event_type,
    confirmed_by_admin: record.confirmed_by_admin,
    dispute_reason: record.dispute_reason,
    dispute_resolved_at: record.dispute_resolved_at,
    finalized_at: record.finalized_at,
    id: record.id,
    is_locked: record.is_locked,
    kpi_bonus: record.kpi_bonus,
    ktv_confirmed_at: record.ktv_confirmed_at,
    ktv_id: record.ktv_id,
    month_year: record.month_year,
    notes: record.notes,
    paid_date: record.paid_date,
    paid_method: record.paid_method,
    published_at: record.published_at,
    rating_bonus: record.rating_bonus,
    service_percentage_bonus: record.service_percentage_bonus,
    session_bonus: record.session_bonus,
    status: record.status,
    tenant_id: record.tenant_id,
    total_salary: record.total_salary,
    total_sessions: record.total_sessions,
    violations_deduction: record.violations_deduction,
  };
}

async function snapshotSalaryRecord(
  supabase: SupabaseClient<Database>,
  ktvId: string,
  monthYear: string,
  tenantId: string
) {
  const { data, error } = await supabase
    .from('salary_records')
    .select('*')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function restoreSalaryConfigSnapshot(
  supabase: SupabaseClient<Database>,
  snapshot: SalaryRecordRow | null,
  ktvId: string,
  monthYear: string,
  tenantId: string
) {
  if (snapshot) {
    const restorePayload: SalaryRecordUpdate = toSalaryRecordSnapshotPayload(snapshot);
    const { error } = await supabase
      .from('salary_records')
      .update(restorePayload)
      .eq('id', snapshot.id);

    return error?.message;
  }

  const { error } = await supabase
    .from('salary_records')
    .delete()
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .eq('tenant_id', tenantId);

  return error?.message;
}

async function snapshotCompletedSessionConfirmations(
  supabase: SupabaseClient<Database>,
  ktvId: string
): Promise<SessionConfirmationSnapshot[]> {
  const { data, error } = await supabase
    .from('session_logs')
    .select('id, is_confirmed')
    .eq('completed_by_ktv_id', ktvId)
    .eq('status', 'completed');

  if (error) throw error;

  return (data ?? []) as SessionConfirmationSnapshot[];
}

async function restoreSessionConfirmations(
  supabase: SupabaseClient<Database>,
  snapshots: SessionConfirmationSnapshot[]
) {
  const rollbackErrors: string[] = [];

  for (const snapshot of snapshots) {
    const restorePayload: SessionLogUpdate = {
      is_confirmed: snapshot.is_confirmed,
    };
    const { error } = await supabase
      .from('session_logs')
      .update(restorePayload)
      .eq('id', snapshot.id);

    if (error) {
      rollbackErrors.push(`${snapshot.id}: ${error.message}`);
    }
  }

  return rollbackErrors;
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

  const lockFailure = await getSalaryMonthLockFailure(
    monthYear,
    'Tháng lương đã bị khóa, không thể phát hành bảng lương.'
  );
  if (lockFailure) {
    return lockFailure;
  }

  try {
    const res = await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId, {
      status: 'published'
    });

    await recordSalaryStatusAudit({
      recordId: ktvId,
      status: 'published',
      extraData: { totalSalary: res.totalSalary }
    });
    revalidateSalaryPage();
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

  const lockFailure = await getSalaryMonthLockFailure(
    monthYear,
    'Tháng lương đã bị khóa, không thể xác nhận hộ.'
  );
  if (lockFailure) return lockFailure;

  const { error } = await supabase
    .from('salary_records')
    .update({ status: 'confirmed', ktv_confirmed_at: new Date().toISOString(), confirmed_by_admin: true })
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .in('status', ['published', 'disputed']);

  if (error) return { success: false, error: error.message };

  revalidateSalaryPage();
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

  const lockFailure = await getSalaryMonthLockFailure(
    monthYear,
    'Tháng lương đã bị khóa, không thể hoàn tất.'
  );
  if (lockFailure) return lockFailure;

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

  const expenseAmount = record.total_salary || 0;
  const expenseDate = new Date().toISOString();
  const expenseDescription = `Lương T${monthLabel} - ${record.users?.full_name || 'KTV'} [salary_record_id:${record.id}] [ktv_id:${ktvId}]`;
  await createSalaryExpense({
    supabase,
    tenantId,
    amount: expenseAmount,
    description: expenseDescription,
    context: 'Finalize salary expense',
    expenseDate,
  });
  await recordSalaryStatusAudit({ recordId: ktvId, status: 'finalized', amount: record.total_salary });
  revalidateSalaryAndFinancePages();
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

  if (count && count > 0) revalidateSalaryPage();
  return { count: count ?? 0 };
}

export async function approveSalary(ktvId: string) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const supabase = await createClient();

  const lockFailure = await getSalaryMonthLockFailure(
    monthYear,
    'Tháng lương đã bị khóa, không thể phê duyệt.'
  );
  if (lockFailure) return lockFailure;

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

    const expenseAmount = res.totalSalary;
    const expenseDate = new Date().toISOString();
    const expenseDescription = `Thanh toán lương T${monthLabel} - KTV ${ktv?.full_name || 'Nhân viên'} [salary_record_id:${recordData.id}] [ktv_id:${ktvId}]`;
    await createSalaryExpense({
      supabase,
      tenantId,
      amount: expenseAmount,
      description: expenseDescription,
      context: 'Approve salary expense',
      expenseDate,
    });
    await recordSalaryStatusAudit({
      recordId: ktvId,
      status: 'approved',
      amount: res.totalSalary,
      ktvName: ktv?.full_name,
    });
    revalidateApprovedSalaryViews();

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

  const lockFailure = await getSalaryMonthLockFailure(
    monthYear,
    'Tháng lương đã bị khóa, không thể chỉnh sửa cấu hình lương.'
  );
  if (lockFailure) return lockFailure;

  try {
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

    const previousSalaryRecord = await snapshotSalaryRecord(supabase, ktvId, monthYear, tenantId);

    await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId, {
      base_salary: payload.baseSalary,
      kpi_bonus: payload.kpiBonus,
      violations_deduction: payload.deductions,
      service_percentage_bonus: payload.advances,
      status: 'pending_approval'
    });

    try {
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'salary_records',
        record_id: ktvId,
        old_data: previousSalaryRecord ? toSalaryRecordSnapshotPayload(previousSalaryRecord) : null,
        new_data: payload
      });
    } catch (auditError: unknown) {
      const auditErrorObj = auditError as Error;
      const rollbackError = await restoreSalaryConfigSnapshot(
        supabase,
        previousSalaryRecord,
        ktvId,
        monthYear,
        tenantId
      );
      const rollbackMessage = rollbackError ? ` Rollback salary_records failed: ${rollbackError}` : '';
      return {
        success: false,
        error: `Failed to record salary config audit log: ${auditErrorObj.message || 'Unknown audit error'}.${rollbackMessage}`,
      };
    }

    revalidateSalaryPage();
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

  const lockFailure = await getSalaryMonthLockFailure(
    currentMonthYear,
    'Tháng lương đã bị khóa, không thể xác nhận số buổi.'
  );
  if (lockFailure) return lockFailure;
  
  console.log(`Confirming sessions for KTV: ${ktvId}, Total: ${totalSessions}`);
  
  try {
    const sessionSnapshots = await snapshotCompletedSessionConfirmations(supabase, ktvId);

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
    try {
      await recalculateAndSaveSalaryRecord(supabase, ktvId, currentMonthYear, tenantId, {
        total_sessions: totalSessions,
        status: 'pending_approval'
      });
    } catch (salaryError: unknown) {
      const salaryErrorObj = salaryError as Error;
      const rollbackErrors = await restoreSessionConfirmations(supabase, sessionSnapshots);
      const rollbackMessage = rollbackErrors.length > 0
        ? ` Rollback session_logs failed: ${rollbackErrors.join('; ')}`
        : '';
      return {
        success: false,
        error: `Failed to recalculate salary after confirming sessions: ${salaryErrorObj.message || 'Unknown salary error'}.${rollbackMessage}`,
      };
    }

    console.log('Session confirmation successful');
    revalidateSalaryPage();
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Failed to confirm sessions (exception):', err);
    return { success: false, error: err.message || 'Lỗi không xác định' };
  }
}
