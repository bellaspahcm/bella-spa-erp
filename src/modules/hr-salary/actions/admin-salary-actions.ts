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
 * Wrapper for the central salary recalculation engine.
 * 
 * Delegates to {@link recalculateAndSaveSalaryRecordEngine} to handle pro-rata base salary,
 * session multipliers, KPI bonus sync, rating bonuses, attendance deductions, and status-based
 * preservation rules.
 * 
 * @param supabase - Authenticated Supabase client with tenant context
 * @param ktvId - Unique identifier of the KTV employee
 * @param monthYear - Salary period in YYYY-MM-01 format
 * @param tenantId - Tenant identifier for multi-tenancy isolation
 * @param overrides - Optional manual salary adjustments (base salary, KPI, deductions, status)
 * 
 * @returns Promise resolving to success status and calculated total salary
 * 
 * @throws {Error} If salary record is locked or finalized
 * @throws {Error} If database operations fail
 * 
 * @remarks
 * This wrapper exists for backward compatibility and to provide a simpler interface
 * for admin salary workflow functions. All business logic lives in the engine.
 * 
 * **Use this function when:**
 * - Publishing salary for KTV confirmation
 * - Applying admin manual adjustments
 * - Updating salary configuration
 * - Transitioning salary status
 * 
 * @example
 * ```typescript
 * // Recalculate with manual KPI bonus override
 * await recalculateAndSaveSalaryRecord(
 *   supabase,
 *   'ktv-uuid',
 *   '2026-06-01',
 *   'tenant-uuid',
 *   { kpi_bonus: 1500000, status: 'pending_approval' }
 * );
 * ```
 * 
 * @see {@link recalculateAndSaveSalaryRecordEngine} for full business logic documentation
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
 * Publishes a KTV salary record for employee confirmation.
 * 
 * Calculates the final salary breakdown (base salary, session bonus, rating bonus, KPI bonus,
 * deductions) and transitions the record from 'draft' to 'published' status. Once published,
 * the KTV can view and confirm their salary through the mobile app or web portal.
 * 
 * **Authorization**: Requires admin, super_admin, accountant, or hr role
 * 
 * @param ktvId - Unique identifier of the KTV employee
 * 
 * @returns Promise resolving to:
 * - `{ success: true }` if salary published successfully
 * - `{ success: false, error: string }` if operation failed
 * 
 * @throws {Error} Never throws - all errors are caught and returned in result object
 * 
 * @remarks
 * **Business Rules:**
 * - Month cannot be locked ({@link getSalaryMonthLockFailure})
 * - Recalculates all salary components dynamically before publishing
 * - Creates audit trail entry for status transition
 * - Revalidates salary pages in the UI
 * - **Rollback Strategy**: If audit logging fails, restores previous salary record state
 * 
 * **Status Lifecycle:**
 * - Before: `draft` (dynamic calculation)
 * - After: `published` (locked for KTV confirmation)
 * 
 * **Side Effects:**
 * - Updates `salary_records` table (status → 'published', published_at timestamp)
 * - Creates audit log entry
 * - Revalidates `/dashboard/salary` page cache
 * 
 * @example
 * ```typescript
 * // Publish salary for a specific KTV
 * const result = await publishSalaryRecord('ktv-uuid-123');
 * if (result.success) {
 *   console.log('Salary published. KTV can now confirm.');
 * } else {
 *   console.error(`Failed to publish: ${result.error}`);
 * }
 * ```
 * 
 * @see {@link publishAllSalaryRecords} for bulk publishing
 * @see {@link recalculateAndSaveSalaryRecord} for salary calculation logic
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

/**
 * Publishes all draft salary records for the current period in bulk.
 * 
 * Iterates through all KTV employees and calls {@link publishSalaryRecord} for each one.
 * Returns a summary of successes and failures for admin review.
 * 
 * **Authorization**: Requires admin, super_admin, accountant, or hr role
 * 
 * @returns Promise resolving to bulk action result with counts and failure details:
 * - `success`: true if all records published, false if any failed
 * - `count`: Number of successfully published records
 * - `total`: Total number of target KTVs
 * - `failedCount`: Number of failed operations
 * - `failures`: Array of `{ ktvId, error }` objects for debugging
 * - `error`: Human-readable Vietnamese error summary (if failures occurred)
 * 
 * @throws {Error} Never throws - all errors are caught and returned in result object
 * 
 * @remarks
 * **Use Cases:**
 * - End-of-month salary processing workflow
 * - Batch salary publication before KTV payroll day
 * - Automated salary confirmation triggers
 * 
 * **Performance:**
 * - Executes sequentially (not parallel) to avoid database lock contention
 * - Large tenant with 50+ KTVs may take 30-60 seconds
 * - Consider running as background job for production systems
 * 
 * **Error Handling:**
 * - Individual failures do not halt bulk operation
 * - Partial success is possible (some records published, some failed)
 * - Check `failures` array for detailed error messages per KTV
 * 
 * @example
 * ```typescript
 * // Publish salary for all KTVs at end of month
 * const result = await publishAllSalaryRecords();
 * console.log(`Published ${result.count}/${result.total} salary records`);
 * 
 * if (result.failedCount > 0) {
 *   console.error('Failures:', result.failures);
 * }
 * ```
 * 
 * @see {@link publishSalaryRecord} for single KTV salary publication
 */
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

/**
 * Admin confirms salary on behalf of a KTV who cannot access the confirmation system.
 * 
 * Used for KTVs without smartphones or those unable to access the mobile app.
 * Transitions the salary record from 'published' or 'disputed' to 'confirmed' status
 * with a special flag indicating admin confirmation on behalf of the employee.
 * 
 * **Authorization**: Requires admin, super_admin, accountant, or hr role
 * 
 * @param ktvId - Unique identifier of the KTV employee
 * 
 * @returns Promise resolving to:
 * - `{ success: true }` if confirmation successful
 * - `{ success: false, error: string }` if operation failed
 * 
 * @throws {Error} Never throws - all errors are caught and returned in result object
 * 
 * @remarks
 * **Business Rules:**
 * - Month cannot be locked ({@link getSalaryMonthLockFailure})
 * - Only records in 'published' or 'disputed' status can be confirmed
 * - Sets `confirmed_by_admin: true` flag to distinguish from KTV self-confirmation
 * - Creates audit trail with special `confirmed_on_behalf_of_ktv_id` field
 * - **Rollback Strategy**: If audit logging fails, restores previous confirmation state
 * 
 * **Status Lifecycle:**
 * - Before: `published` or `disputed`
 * - After: `confirmed` (with `confirmed_by_admin: true`)
 * 
 * **Audit Trail:**
 * - Records who performed the confirmation and on behalf of which KTV
 * - Maintains compliance for labor law documentation
 * 
 * @example
 * ```typescript
 * // Confirm salary for KTV without smartphone access
 * const result = await adminConfirmOnBehalf('ktv-uuid-123');
 * if (result.success) {
 *   console.log('Salary confirmed by admin on behalf of KTV');
 * } else {
 *   console.error(`Confirmation failed: ${result.error}`);
 * }
 * ```
 * 
 * @see {@link ktvConfirmSalary} for KTV self-confirmation
 * @see {@link finalizeSalaryRecord} for final salary lock and expense creation
 */
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

/**
 * Finalizes a confirmed salary record and creates corresponding expense entry.
 * 
 * This is the **final step** in the salary workflow. It locks the salary record permanently,
 * creates an `expenses` table entry for accounting integration, and confirms all associated
 * session logs to prevent future modifications.
 * 
 * **Authorization**: Requires admin, super_admin, accountant, or hr role
 * 
 * @param ktvId - Unique identifier of the KTV employee
 * 
 * @returns Promise resolving to:
 * - `{ success: true }` if finalization successful
 * - `{ success: false, error: string }` if operation failed
 * 
 * @throws {Error} Never throws - all errors are caught and returned in result object
 * 
 * @remarks
 * **Business Rules:**
 * - Month cannot be locked ({@link getSalaryMonthLockFailure})
 * - Only records in 'confirmed' status can be finalized
 * - **Side Effects** (in order):
 *   1. Updates `salary_records.status` → 'finalized'
 *   2. Sets `salary_records.finalized_at` timestamp
 *   3. Locks all `session_logs.is_confirmed` → true for this KTV
 *   4. Creates `expenses` entry (category: 'salary', status: 'submitted')
 *   5. Records audit log entry
 * 
 * **Rollback Strategy:**
 * - Snapshots salary and session states before any mutations
 * - If any step fails, attempts to restore all previous states
 * - Rollback errors are appended to the main error message
 * - Expense deletion handled if creation succeeds but subsequent steps fail
 * 
 * **Financial Integration:**
 * - Creates expense with description: "Lương T{MM}/{YYYY} - {KTV Name} [salary_record_id:{id}] [ktv_id:{id}]"
 * - Links salary record to expense for accounting reconciliation
 * - Expense status: 'submitted' (awaiting finance approval)
 * 
 * **Status Lifecycle:**
 * - Before: `confirmed` (KTV acknowledged)
 * - After: `finalized` (fully locked, expense created)
 * 
 * **Cache Invalidation:**
 * - Revalidates both `/dashboard/salary` AND `/dashboard/finance` pages
 * - Finance page update ensures expense appears in accounting reports immediately
 * 
 * @example
 * ```typescript
 * // Finalize salary and create expense entry
 * const result = await finalizeSalaryRecord('ktv-uuid-123');
 * if (result.success) {
 *   console.log('Salary finalized. Expense entry created.');
 * } else {
 *   console.error(`Finalization failed: ${result.error}`);
 * }
 * ```
 * 
 * @see {@link finalizeAllSalaryRecords} for bulk finalization
 * @see {@link createSalaryExpense} for expense creation logic
 */
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

/**
 * Finalizes all confirmed salary records for the current period in bulk.
 * 
 * Executes {@link finalizeSalaryRecord} for all KTVs with 'confirmed' status salary records.
 * Creates expense entries for each finalized record and locks all associated sessions.
 * 
 * **Authorization**: Requires admin, super_admin, accountant, or hr role
 * 
 * @returns Promise resolving to bulk action result with counts and failure details:
 * - `success`: true if all records finalized, false if any failed
 * - `count`: Number of successfully finalized records
 * - `total`: Total number of confirmed records found
 * - `failedCount`: Number of failed operations
 * - `failures`: Array of `{ ktvId, error }` objects for debugging
 * - `error`: Human-readable Vietnamese error summary (if failures occurred)
 * 
 * @throws {Error} Never throws - all errors are caught and returned in result object
 * 
 * @remarks
 * **Use Cases:**
 * - End-of-month payroll closing workflow
 * - Batch expense creation before accounting period close
 * - Automated payroll finalization triggers
 * 
 * **Performance:**
 * - Executes sequentially to avoid race conditions on expense creation
 * - Large tenant with 50+ KTVs may take 1-2 minutes
 * - Each finalization includes: DB updates, expense creation, session locks, audit logging
 * - **Consider running as background job** for production systems
 * 
 * **Error Handling:**
 * - Individual failures do not halt bulk operation
 * - Partial success is possible (some finalized, some failed)
 * - Check `failures` array for detailed error messages per KTV
 * - Failed records remain in 'confirmed' status for retry
 * 
 * **Financial Impact:**
 * - Creates expense entries for ALL successfully finalized records
 * - Expenses appear immediately in finance dashboard
 * - Failed finalizations do NOT create expense entries
 * 
 * @example
 * ```typescript
 * // Finalize all confirmed salaries at month-end
 * const result = await finalizeAllSalaryRecords();
 * console.log(`Finalized ${result.count}/${result.total} salary records`);
 * console.log(`Created ${result.count} expense entries for accounting`);
 * 
 * if (result.failedCount > 0) {
 *   console.error('Failed to finalize:', result.failures);
 * }
 * ```
 * 
 * @see {@link finalizeSalaryRecord} for single KTV finalization
 */
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

/**
 * Auto-confirms salary records published more than 48 hours ago.
 * 
 * Triggers database RPC function `auto_confirm_stale_salary_records` to transition
 * long-pending salary records from 'published' to 'confirmed' status automatically.
 * 
 * Used when KTVs fail to confirm their salary within the grace period (typically 48 hours).
 * Prevents payroll workflow from blocking due to unresponsive employees.
 * 
 * **Authorization**: Requires admin, super_admin, accountant, or hr role
 * 
 * @returns Promise resolving to:
 * - `{ success: true, count: number }` if auto-confirmation executed successfully
 * - `{ success: false, count: 0, error: string }` if RPC call failed
 * 
 * @throws {Error} Never throws - all errors are caught and returned in result object
 * 
 * @remarks
 * **Business Rules:**
 * - Only affects records in 'published' status
 * - Only affects records where `published_at < NOW() - INTERVAL '48 hours'`
 * - Sets `ktv_confirmed_at` to current timestamp
 * - Does NOT set `confirmed_by_admin` flag (distinguishes from manual admin confirmation)
 * 
 * **Scheduling Recommendation:**
 * - Run daily via cron job or scheduled task
 * - Suggested time: 2 AM local time (off-peak hours)
 * - Example cron: `0 2 * * * /usr/bin/node /path/to/auto-confirm-job.js`
 * 
 * **Cache Invalidation:**
 * - Only revalidates pages if `count > 0` (optimization to avoid unnecessary cache clears)
 * - Revalidates `/dashboard/salary` to reflect updated confirmation statuses
 * 
 * @example
 * ```typescript
 * // Daily scheduled job to auto-confirm stale salaries
 * const result = await checkAndAutoConfirm();
 * if (result.success) {
 *   console.log(`Auto-confirmed ${result.count} salary records`);
 * } else {
 *   console.error(`Auto-confirm failed: ${result.error}`);
 * }
 * ```
 * 
 * @see {@link adminConfirmOnBehalf} for manual admin confirmation
 * @see Database RPC: `auto_confirm_stale_salary_records` for implementation details
 */
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

/**
 * Approves a KTV salary record and creates corresponding expense entry (LEGACY WORKFLOW).
 * 
 * **⚠️ DEPRECATED**: This function implements the old salary approval workflow where admin
 * directly approves salary without KTV confirmation. New workflows should use:
 * 1. {@link publishSalaryRecord} → KTV confirms → {@link finalizeSalaryRecord}
 * 
 * Transitions salary record from any draft/pending state to 'approved' status and creates
 * an expense entry for accounting integration.
 * 
 * **Authorization**: Requires admin, super_admin, accountant, or hr role
 * 
 * @param ktvId - Unique identifier of the KTV employee
 * 
 * @returns Promise resolving to:
 * - `{ success: true }` if approval successful
 * - `{ success: false, error: string }` if operation failed
 * 
 * @throws {Error} Never throws - all errors are caught and returned in result object
 * 
 * @remarks
 * **Business Rules:**
 * - Month cannot be locked ({@link getSalaryMonthLockFailure})
 * - Recalculates all salary components before approval
 * - Creates expense entry with status 'submitted'
 * - **Rollback Strategy**: If expense creation or audit logging fails, restores previous salary state
 * 
 * **Side Effects (in order):**
 * 1. Recalculates salary with status 'approved'
 * 2. Fetches updated record for expense description
 * 3. Creates `expenses` entry (category: 'salary', status: 'submitted')
 * 4. Records audit log entry
 * 5. Revalidates finance and salary dashboard pages
 * 
 * **Expense Description Format:**
 * `"Thanh toán lương T{MM}/{YYYY} - KTV {Name} [salary_record_id:{id}] [ktv_id:{id}]"`
 * 
 * **Status Lifecycle (Legacy):**
 * - Before: `draft` or `pending_approval`
 * - After: `approved` (bypasses KTV confirmation)
 * 
 * @example
 * ```typescript
 * // Legacy: Directly approve salary (skip KTV confirmation)
 * const result = await approveSalary('ktv-uuid-123');
 * if (result.success) {
 *   console.log('Salary approved. Expense entry created.');
 * } else {
 *   console.error(`Approval failed: ${result.error}`);
 * }
 * ```
 * 
 * @see {@link publishSalaryRecord} for modern KTV-confirmation workflow
 * @see {@link finalizeSalaryRecord} for final salary lock after KTV confirmation
 */
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

/**
 * Updates salary configuration with manual admin adjustments.
 * 
 * Allows admin to override calculated salary components (base salary, KPI bonus, deductions, advances)
 * and recalculate the total salary with the new values. Used for manual adjustments and corrections.
 * 
 * **Authorization**: Requires admin, super_admin, accountant, or hr role
 * 
 * @param ktvId - Unique identifier of the KTV employee
 * @param payload - Manual salary adjustments to apply
 * @param payload.baseSalary - Override calculated base salary (e.g., for pro-rata adjustments)
 * @param payload.kpiBonus - Override KPI bonus from kpi_records table
 * @param payload.deductions - Override auto-calculated attendance penalties
 * @param payload.advances - Override service percentage bonus/advances
 * 
 * @returns Promise resolving to:
 * - `{ success: true }` if configuration updated successfully
 * - `{ success: false, error: string }` if operation failed
 * 
 * @throws {Error} Never throws - all errors are caught and returned in result object
 * 
 * @remarks
 * **Business Rules:**
 * - Month cannot be locked ({@link getSalaryMonthLockFailure})
 * - Sets status to 'pending_approval' after manual adjustments
 * - **Rollback Strategy**: If audit logging fails, restores previous salary configuration
 * - All overrides are preserved in non-draft records (see {@link recalculateAndSaveSalaryRecord})
 * 
 * **Use Cases:**
 * - Manual correction of auto-calculated base salary
 * - Override KPI bonus for special circumstances
 * - Adjust deductions for approved leave/exceptions
 * - Apply service percentage advances
 * 
 * **Audit Trail:**
 * - Records old and new values for all changed fields
 * - Maintains compliance for labor law documentation
 * - Enables salary change history tracking
 * 
 * @example
 * ```typescript
 * // Override base salary due to mid-month promotion
 * const result = await updateSalaryConfig('ktv-uuid-123', {
 *   baseSalary: 8000000,  // Promoted to senior KTV
 *   kpiBonus: 1500000,    // Performance bonus
 *   deductions: 0,        // Waive late penalties
 *   advances: 500000      // Service percentage advance
 * });
 * 
 * if (result.success) {
 *   console.log('Salary configuration updated');
 * }
 * ```
 * 
 * @see {@link recalculateAndSaveSalaryRecord} for recalculation logic with overrides
 */
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

  // ✅ NEW: Check if KTV's salary record is finalized (critical for data integrity)
  const { getKtvSalaryImmutabilityFailure } = await import('./admin-salary-workflow-helpers');
  const immutabilityFailure = await getKtvSalaryImmutabilityFailure(
    supabase,
    ktvId,
    monthYear,
    tenantId,
    'Không thể chỉnh sửa: Bảng lương KTV này đã hoàn tất (finalized) và đã xuất chi.',
    'Không thể chỉnh sửa: Bảng lương KTV này đã bị khóa (month-end close).'
  );
  if (immutabilityFailure) return immutabilityFailure;

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

/**
 * Confirms a KTV's completed session count and locks sessions for salary calculation.
 * 
 * Marks all completed sessions for a KTV as confirmed (prevents future edits) and updates
 * the salary record with the final session count. Used when admin verifies session data
 * before salary publication.
 * 
 * **Authorization**: Requires admin, super_admin, accountant, or hr role
 * 
 * @param ktvId - Unique identifier of the KTV employee
 * @param totalSessions - Total weighted session count (including package multipliers)
 * 
 * @returns Promise resolving to:
 * - `{ success: true }` if sessions confirmed successfully
 * - `{ success: false, error: string }` if operation failed
 * 
 * @throws {Error} Never throws - all errors are caught and returned in result object
 * 
 * @remarks
 * **Business Rules:**
 * - Month cannot be locked ({@link getSalaryMonthLockFailure})
 * - Sets `session_logs.is_confirmed = true` for all completed sessions by this KTV
 * - Recalculates salary with the confirmed session count
 * - **Rollback Strategy**: If salary recalculation fails, restores previous session confirmation states
 * 
 * **Session Multipliers:**
 * - The `totalSessions` parameter should already include package multipliers:
 *   - Basic packages: 1.0x
 *   - Happy packages: 1.5x  
 *   - VIP packages: 2.0x
 * - Example: 10 VIP sessions = `totalSessions: 20.0`
 * 
 * **Side Effects (in order):**
 * 1. Snapshots current session confirmation states
 * 2. Updates all `session_logs.is_confirmed → true` for KTV's completed sessions
 * 3. Recalculates salary with `total_sessions` override and status 'pending_approval'
 * 4. If salary recalculation fails, attempts to restore session confirmation states
 * 
 * **Use Cases:**
 * - Pre-publication session verification
 * - Manual session count corrections
 * - Lock sessions before salary approval
 * 
 * @example
 * ```typescript
 * // Confirm 25.5 weighted sessions (e.g., 20 Basic + 5 Happy = 20*1.0 + 5*1.5 = 27.5)
 * const result = await confirmKtvSessions('ktv-uuid-123', 27.5);
 * if (result.success) {
 *   console.log('Sessions confirmed and locked. Salary recalculated.');
 * } else {
 *   console.error(`Confirmation failed: ${result.error}`);
 * }
 * ```
 * 
 * @see {@link calculateWeightedSessionCount} for session multiplier calculation
 * @see {@link BUSINESS_RULES.SESSIONS.MULTIPLIERS} for package coefficients
 */
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

  // ✅ NEW: Check if KTV's salary record is finalized (critical for data integrity)
  const { getKtvSalaryImmutabilityFailure } = await import('./admin-salary-workflow-helpers');
  const immutabilityFailure = await getKtvSalaryImmutabilityFailure(
    supabase,
    ktvId,
    currentMonthYear,
    tenantId,
    'Không thể xác nhận số buổi: Bảng lương KTV này đã hoàn tất (finalized) và đã xuất chi.',
    'Không thể xác nhận số buổi: Bảng lương KTV này đã bị khóa (month-end close).'
  );
  if (immutabilityFailure) return immutabilityFailure;
  
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
