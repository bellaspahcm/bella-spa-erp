'use server';

import { createClient } from '@/lib/supabase-server';
import { getAuthorizedTenantUser } from '@/core/services/auth';
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
type AdminConfirmSalarySnapshot = Pick<SalaryRecordRow, 'id' | 'status' | 'ktv_confirmed_at' | 'confirmed_by_admin'>;
type FinalizeSalarySnapshot = Pick<SalaryRecordRow, 'id' | 'status' | 'finalized_at'>;
type BulkSalaryActionFailure = { ktvId: string; error: string };
type BulkSalaryActionResult = {
  success: boolean;
  count: number;
  total: number;
  failedCount: number;
  failures: BulkSalaryActionFailure[];
  error?: string;
};

const SALARY_ADMIN_ROLES = ['admin', 'super_admin', 'accountant', 'hr'] as const;
const SALARY_AUTH_ERROR = 'Không xác định được chi nhánh của người dùng';

async function getSalaryAdminAuth() {
  return getAuthorizedTenantUser({
    allowedRoles: SALARY_ADMIN_ROLES,
    errorMessage: SALARY_AUTH_ERROR,
  });
}

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

async function snapshotAdminConfirmSalaryRecord(
  supabase: SupabaseClient<Database>,
  ktvId: string,
  monthYear: string,
  tenantId: string
): Promise<AdminConfirmSalarySnapshot | null> {
  const { data, error } = await supabase
    .from('salary_records')
    .select('id, status, ktv_confirmed_at, confirmed_by_admin')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .eq('tenant_id', tenantId)
    .in('status', ['published', 'disputed'])
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function restoreAdminConfirmSalaryRecord(
  supabase: SupabaseClient<Database>,
  snapshot: AdminConfirmSalarySnapshot
) {
  const restorePayload: SalaryRecordUpdate = {
    status: snapshot.status,
    ktv_confirmed_at: snapshot.ktv_confirmed_at,
    confirmed_by_admin: snapshot.confirmed_by_admin,
  };

  const { error } = await supabase
    .from('salary_records')
    .update(restorePayload)
    .eq('id', snapshot.id);

  return error?.message;
}

async function restoreFinalizedSalaryRecord(
  supabase: SupabaseClient<Database>,
  snapshot: FinalizeSalarySnapshot
) {
  const restorePayload: SalaryRecordUpdate = {
    status: snapshot.status,
    finalized_at: snapshot.finalized_at,
  };

  const { error } = await supabase
    .from('salary_records')
    .update(restorePayload)
    .eq('id', snapshot.id);

  return error?.message;
}

async function deleteSalaryExpenseByDescription(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  description: string
) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('category', 'salary')
    .eq('description', description);

  return error?.message;
}

async function rollbackFinalizeSalarySideEffects({
  supabase,
  salarySnapshot,
  sessionSnapshots,
  tenantId,
  expenseDescription,
}: {
  supabase: SupabaseClient<Database>;
  salarySnapshot: FinalizeSalarySnapshot;
  sessionSnapshots: SessionConfirmationSnapshot[];
  tenantId?: string;
  expenseDescription?: string;
}) {
  const rollbackErrors: string[] = [];

  if (tenantId && expenseDescription) {
    const expenseRollbackError = await deleteSalaryExpenseByDescription(supabase, tenantId, expenseDescription);
    if (expenseRollbackError) {
      rollbackErrors.push(`expenses delete failed: ${expenseRollbackError}`);
    }
  }

  const sessionRollbackErrors = await restoreSessionConfirmations(supabase, sessionSnapshots);
  if (sessionRollbackErrors.length > 0) {
    rollbackErrors.push(`session_logs restore failed: ${sessionRollbackErrors.join('; ')}`);
  }

  const salaryRollbackError = await restoreFinalizedSalaryRecord(supabase, salarySnapshot);
  if (salaryRollbackError) {
    rollbackErrors.push(`salary_records restore failed: ${salaryRollbackError}`);
  }

  return rollbackErrors;
}

function formatRollbackErrors(rollbackErrors: string[]) {
  return rollbackErrors.length > 0 ? ` Rollback failed: ${rollbackErrors.join('; ')}` : '';
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

function buildBulkSalaryActionResult(
  actionLabel: string,
  count: number,
  total: number,
  failures: BulkSalaryActionFailure[]
): BulkSalaryActionResult {
  const failedCount = failures.length;
  if (failedCount === 0) {
    return { success: true, count, total, failedCount, failures };
  }

  const failureSummary = failures.map((failure) => `${failure.ktvId}: ${failure.error}`).join('; ');
  return {
    success: false,
    count,
    total,
    failedCount,
    failures,
    error: `${actionLabel} thất bại ${failedCount}/${total} bản ghi. Thành công: ${count}. ${failureSummary}`,
  };
}

/**
 * ADMIN: Publish salary record to KTV for confirmation.
 * Calculates final salary breakdown and sets status to 'published'.
 */
export async function publishSalaryRecord(ktvId: string) {
  const auth = await getSalaryAdminAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const tenantId = auth.tenantId;

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
    const previousSalaryRecord = await snapshotSalaryRecord(supabase, ktvId, monthYear, tenantId);

    const res = await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId, {
      status: 'published'
    });

    try {
      await recordSalaryStatusAudit({
        recordId: ktvId,
        status: 'published',
        extraData: { totalSalary: res.totalSalary }
      });
    } catch (auditError: unknown) {
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
        error: `Failed to record publish salary audit log: ${getErrorMessage(auditError, 'Unknown audit error')}.${rollbackMessage}`,
      };
    }

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
  const auth = await getSalaryAdminAuth();
  if (!auth.ok) {
    return buildBulkSalaryActionResult('Gửi đối soát tất cả', 0, 0, [{
      ktvId: 'UNKNOWN',
      error: auth.error,
    }]);
  }

  const supabase = await createClient();
  const tenantId = auth.tenantId;

  const { data: ktvs, error: ktvError } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'ktv')
    .eq('tenant_id', tenantId);

  if (ktvError) {
    return buildBulkSalaryActionResult('Gửi đối soát tất cả', 0, 0, [{
      ktvId: 'FETCH_TARGETS',
      error: `Không thể tải danh sách KTV: ${ktvError.message}`,
    }]);
  }

  const targets = ktvs ?? [];
  let count = 0;
  const failures: BulkSalaryActionFailure[] = [];
  for (const ktv of targets) {
    try {
      const res = await publishSalaryRecord(ktv.id);
      if (res.success) {
        count++;
      } else {
        failures.push({ ktvId: ktv.id, error: res.error || 'Không thể gửi đối soát' });
      }
    } catch (error: unknown) {
      failures.push({ ktvId: ktv.id, error: getErrorMessage(error, 'Không thể gửi đối soát') });
    }
  }
  return buildBulkSalaryActionResult('Gửi đối soát tất cả', count, targets.length, failures);
}

/** ADMIN: Confirm salary on behalf of KTV (no-smartphone case) */
export async function adminConfirmOnBehalf(ktvId: string) {
  const auth = await getSalaryAdminAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const tenantId = auth.tenantId;

  const monthYear = getMonthStart();

  const lockFailure = await getSalaryMonthLockFailure(
    monthYear,
    'Tháng lương đã bị khóa, không thể xác nhận hộ.'
  );
  if (lockFailure) return lockFailure;

  try {
    const previousRecord = await snapshotAdminConfirmSalaryRecord(supabase, ktvId, monthYear, tenantId);
    if (!previousRecord) {
      return {
        success: false,
        error: 'Không tìm thấy bảng lương đang chờ KTV xác nhận để xác nhận hộ.',
      };
    }

    const confirmedAt = new Date().toISOString();
    const confirmPayload: SalaryRecordUpdate = {
      status: 'confirmed',
      ktv_confirmed_at: confirmedAt,
      confirmed_by_admin: true,
    };
    const { error } = await supabase
      .from('salary_records')
      .update(confirmPayload)
      .eq('id', previousRecord.id);

    if (error) return { success: false, error: error.message };

    try {
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'salary_records',
        record_id: previousRecord.id,
        old_data: {
          id: previousRecord.id,
          status: previousRecord.status,
          ktv_confirmed_at: previousRecord.ktv_confirmed_at,
          confirmed_by_admin: previousRecord.confirmed_by_admin,
        },
        new_data: {
          id: previousRecord.id,
          status: 'confirmed',
          ktv_confirmed_at: confirmedAt,
          confirmed_by_admin: true,
          confirmed_on_behalf_of_ktv_id: ktvId,
        },
      });
    } catch (auditError: unknown) {
      const rollbackError = await restoreAdminConfirmSalaryRecord(supabase, previousRecord);
      const rollbackMessage = rollbackError ? ` Rollback salary_records failed: ${rollbackError}` : '';
      return {
        success: false,
        error: `Failed to record admin confirm audit log: ${getErrorMessage(auditError, 'Unknown audit error')}.${rollbackMessage}`,
      };
    }

    revalidateSalaryPage();
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, 'Lỗi không xác định') };
  }
}

/** ADMIN: Finalize salary record — locks and creates expense entry */
export async function finalizeSalaryRecord(ktvId: string) {
  const auth = await getSalaryAdminAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const tenantId = auth.tenantId;

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
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed')
    .single();

  if (fetchError) return { success: false, error: fetchError.message };

  const record = recordData as unknown as (SalaryRecordDbAdmin & Pick<SalaryRecordRow, 'finalized_at'>) | null;

  if (!record) return { success: false, error: 'Không tìm thấy bản ghi đã được xác nhận' };

  let sessionSnapshots: SessionConfirmationSnapshot[];
  try {
    sessionSnapshots = await snapshotCompletedSessionConfirmations(supabase, ktvId);
  } catch (error: unknown) {
    return {
      success: false,
      error: `Failed to snapshot completed sessions for salary finalization: ${getErrorMessage(error, 'Unknown session snapshot error')}`,
    };
  }

  const salarySnapshot: FinalizeSalarySnapshot = {
    id: record.id,
    status: record.status,
    finalized_at: record.finalized_at,
  };

  // Lock record
  const finalizePayload: SalaryRecordUpdate = {
    status: 'finalized',
    finalized_at: new Date().toISOString(),
  };
  const { error: lockError } = await supabase.from('salary_records')
    .update(finalizePayload)
    .eq('id', record.id);

  if (lockError) return { success: false, error: lockError.message };

  // Lock session_logs
  const { error: sessionError } = await supabase.from('session_logs')
    .update({ is_confirmed: true })
    .eq('completed_by_ktv_id', ktvId)
    .eq('status', 'completed');

  if (sessionError) {
    const rollbackErrors = await rollbackFinalizeSalarySideEffects({
      supabase,
      salarySnapshot,
      sessionSnapshots,
    });
    return {
      success: false,
      error: `Failed to confirm sessions during salary finalization: ${sessionError.message}.${formatRollbackErrors(rollbackErrors)}`,
    };
  }

  const expenseAmount = record.total_salary || 0;
  const expenseDate = new Date().toISOString();
  const expenseDescription = `Lương T${monthLabel} - ${record.users?.full_name || 'KTV'} [salary_record_id:${record.id}] [ktv_id:${ktvId}]`;
  let createdSalaryExpense = false;
  try {
    const salaryExpenseResult = await createSalaryExpense({
      supabase,
      tenantId,
      amount: expenseAmount,
      description: expenseDescription,
      context: 'Finalize salary expense',
      expenseDate,
    });
    createdSalaryExpense = salaryExpenseResult.created;
  } catch (error: unknown) {
    const rollbackErrors = await rollbackFinalizeSalarySideEffects({
      supabase,
      salarySnapshot,
      sessionSnapshots,
    });
    return {
      success: false,
      error: `Failed to create salary expense during finalization: ${getErrorMessage(error, 'Unknown expense error')}.${formatRollbackErrors(rollbackErrors)}`,
    };
  }

  try {
    await recordSalaryStatusAudit({ recordId: ktvId, status: 'finalized', amount: record.total_salary });
  } catch (error: unknown) {
    const rollbackErrors = await rollbackFinalizeSalarySideEffects({
      supabase,
      salarySnapshot,
      sessionSnapshots,
      tenantId: createdSalaryExpense ? tenantId : undefined,
      expenseDescription: createdSalaryExpense ? expenseDescription : undefined,
    });
    return {
      success: false,
      error: `Failed to record finalize salary audit log: ${getErrorMessage(error, 'Unknown audit error')}.${formatRollbackErrors(rollbackErrors)}`,
    };
  }
  revalidateSalaryAndFinancePages();
  return { success: true };
}

/** ADMIN: Finalize ALL confirmed records */
export async function finalizeAllSalaryRecords() {
  const auth = await getSalaryAdminAuth();
  if (!auth.ok) {
    return buildBulkSalaryActionResult('Chốt sổ tất cả', 0, 0, [{
      ktvId: 'UNKNOWN',
      error: auth.error,
    }]);
  }

  const supabase = await createClient();
  const tenantId = auth.tenantId;

  const monthYear = getMonthStart();
  const { data: confirmed, error: confirmedError } = await supabase
    .from('salary_records')
    .select('ktv_id')
    .eq('month_year', monthYear)
    .eq('status', 'confirmed')
    .eq('tenant_id', tenantId);

  if (confirmedError) {
    return buildBulkSalaryActionResult('Chốt sổ tất cả', 0, 0, [{
      ktvId: 'FETCH_TARGETS',
      error: `Không thể tải danh sách lương đã xác nhận: ${confirmedError.message}`,
    }]);
  }

  const targets = confirmed ?? [];
  let count = 0;
  const failures: BulkSalaryActionFailure[] = [];
  for (const r of targets) {
    try {
      const res = await finalizeSalaryRecord(r.ktv_id);
      if (res.success) {
        count++;
      } else {
        failures.push({ ktvId: r.ktv_id, error: res.error || 'Không thể chốt sổ lương' });
      }
    } catch (error: unknown) {
      failures.push({ ktvId: r.ktv_id, error: getErrorMessage(error, 'Không thể chốt sổ lương') });
    }
  }
  return buildBulkSalaryActionResult('Chốt sổ tất cả', count, targets.length, failures);
}

/** ADMIN: Trigger auto-confirm for records published > 48h ago */
export async function checkAndAutoConfirm() {
  const auth = await getSalaryAdminAuth();
  if (!auth.ok) {
    return {
      success: false,
      count: 0,
      error: auth.error,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('auto_confirm_stale_salary_records', {
    p_tenant_id: auth.tenantId,
  });

  if (error) {
    return {
      success: false,
      count: 0,
      error: `auto_confirm_stale_salary_records failed: ${error.message}`,
    };
  }

  const count = data as number | null;

  if (count && count > 0) revalidateSalaryPage();
  return { success: true, count: count ?? 0 };
}

export async function approveSalary(ktvId: string) {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const auth = await getSalaryAdminAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const tenantId = auth.tenantId;

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
      .eq('tenant_id', tenantId)
      .single();

    if (ktvError) throw ktvError;
    const ktv = ktvData;
    if (!ktv) {
      return { success: false, error: 'Không tìm thấy KTV cần phê duyệt lương' };
    }

    const previousSalaryRecord = await snapshotSalaryRecord(supabase, ktvId, monthYear, tenantId);

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
      .eq('tenant_id', tenantId)
      .single();
    if (fetchError) {
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
        error: `Failed to fetch approved salary record: ${fetchError.message}.${rollbackMessage}`,
      };
    }

    const approvedRecord = recordData as Pick<SalaryRecordRow, 'id'> | null;
    if (!approvedRecord) {
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
        error: `Failed to fetch approved salary record: missing approved salary row.${rollbackMessage}`,
      };
    }

    const expenseAmount = res.totalSalary;
    const expenseDate = new Date().toISOString();
    const expenseDescription = `Thanh toán lương T${monthLabel} - KTV ${ktv.full_name || 'Nhân viên'} [salary_record_id:${approvedRecord.id}] [ktv_id:${ktvId}]`;
    let createdSalaryExpense = false;
    try {
      const salaryExpenseResult = await createSalaryExpense({
        supabase,
        tenantId,
        amount: expenseAmount,
        description: expenseDescription,
        context: 'Approve salary expense',
        expenseDate,
      });
      createdSalaryExpense = salaryExpenseResult.created;
    } catch (expenseError: unknown) {
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
        error: `Failed to create salary expense during approval: ${getErrorMessage(expenseError, 'Unknown expense error')}.${rollbackMessage}`,
      };
    }

    try {
      await recordSalaryStatusAudit({
        recordId: ktvId,
        status: 'approved',
        amount: res.totalSalary,
        ktvName: ktv.full_name,
      });
    } catch (auditError: unknown) {
      const expenseRollbackError = createdSalaryExpense
        ? await deleteSalaryExpenseByDescription(supabase, tenantId, expenseDescription)
        : undefined;
      const salaryRollbackError = await restoreSalaryConfigSnapshot(
        supabase,
        previousSalaryRecord,
        ktvId,
        monthYear,
        tenantId
      );
      const rollbackErrors = [
        ...(expenseRollbackError ? [`expenses delete failed: ${expenseRollbackError}`] : []),
        ...(salaryRollbackError ? [`salary_records restore failed: ${salaryRollbackError}`] : []),
      ];
      return {
        success: false,
        error: `Failed to record approve salary audit log: ${getErrorMessage(auditError, 'Unknown audit error')}.${formatRollbackErrors(rollbackErrors)}`,
      };
    }
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
  const auth = await getSalaryAdminAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const tenantId = auth.tenantId;

  const lockFailure = await getSalaryMonthLockFailure(
    monthYear,
    'Tháng lương đã bị khóa, không thể chỉnh sửa cấu hình lương.'
  );
  if (lockFailure) return lockFailure;

  try {
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
  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const auth = await getSalaryAdminAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const tenantId = auth.tenantId;

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
