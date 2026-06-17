'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '../../../services/audit-actions';
import { getCurrentUser } from '../../../services/user-actions';
import { createAccountingDataClient } from './client';

/**
 * Retrieves all accounting periods for the current tenant.
 * 
 * Returns accounting periods ordered by start date (newest first), showing
 * period status, date ranges, and closure information.
 * 
 * @returns Array of accounting periods with status and date information
 * 
 * @throws {Error} If user is not authenticated or missing tenant session
 * @throws {Error} If database query fails
 * 
 * @remarks
 * **Period Statuses:**
 * - `OPEN`: Current active period, accepts new entries
 * - `CLOSED`: Period closed, no new entries allowed
 * - `LOCKED`: Period locked, no modifications allowed
 * 
 * **Ordering:**
 * Results ordered by `start_date` descending (newest periods first).
 * 
 * **Tenant Isolation:**
 * Automatically filters by current user's `tenant_id`.
 * 
 * **Use Cases:**
 * - Period management dashboard
 * - Month-end close workflows
 * - Period selection in reports
 * - Validating entry dates against open periods
 * 
 * @example
 * ```typescript
 * const periods = await getAccountingPeriods();
 * 
 * // Find the current open period
 * const openPeriod = periods.find(p => p.status === 'OPEN');
 * console.log(`Current period: ${openPeriod?.start_date} to ${openPeriod?.end_date}`);
 * 
 * // Check if a date is in an open period
 * const today = new Date().toISOString().slice(0, 10);
 * const canPost = periods.some(p => 
 *   p.status === 'OPEN' && 
 *   today >= p.start_date && 
 *   today <= p.end_date
 * );
 * ```
 * 
 * @see {@link closePeriodAction} for closing periods
 * @see {@link reopenPeriodAction} for reopening periods
 */
export async function getAccountingPeriods() {
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');
  const supabase = await createAccountingDataClient();

  const { data, error } = await supabase
    .from('accounting_periods')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('start_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Previews closing entries that will be generated when closing an accounting period.
 * 
 * Generates a preview of period-end closing journal entries without actually posting them.
 * Shows how temporary accounts (revenue/expense) will be closed to retained earnings.
 * 
 * @param periodId - UUID of the accounting period to preview
 * @returns Array of preview entries showing proposed closing transactions
 * 
 * @throws {Error} If user is not authenticated or not an admin
 * @throws {Error} If database RPC call fails
 * 
 * @remarks
 * **Authorization:**
 * - Only `admin` or `super_admin` roles can preview closing entries
 * - Tenant isolation enforced via RPC
 * 
 * **Vietnamese Accounting Standards (TT133):**
 * The closing process follows Vietnamese GAAP requirements:
 * - **Revenue accounts (711-719)**: Closed with debit entries
 * - **Expense accounts (511-699)**: Closed with credit entries
 * - **Net income/loss**: Transferred to account 421 (Retained Earnings)
 * 
 * **Closing Entry Structure:**
 * ```typescript
 * // If revenue > expenses (profit):
 * Debit: 711 (Service Revenue)     50,000,000đ
 * Debit: 512 (Operating Expenses)  -30,000,000đ
 * Credit: 421 (Retained Earnings)  20,000,000đ
 * 
 * // If expenses > revenue (loss):
 * Debit: 421 (Retained Earnings)   10,000,000đ
 * Credit: 711 (Service Revenue)    -40,000,000đ
 * Credit: 512 (Operating Expenses) 50,000,000đ
 * ```
 * 
 * **Preview Purpose:**
 * - Validates closing entry calculations before actual close
 * - Allows admin to review impact on retained earnings
 * - Identifies potential issues (unbalanced entries, missing accounts)
 * - Provides transparency for audit trail
 * 
 * **No Side Effects:**
 * This function is read-only and does not modify any data.
 * Actual closing happens in {@link closePeriodAction}.
 * 
 * @example
 * ```typescript
 * // Preview closing entries for June 2026
 * const preview = await previewClosingEntries(periodId);
 * 
 * console.log('Proposed closing entries:');
 * preview.forEach(entry => {
 *   console.log(`${entry.account_code} ${entry.account_name}:`);
 *   console.log(`  Debit: ${entry.debit_amount.toLocaleString('vi-VN')}đ`);
 *   console.log(`  Credit: ${entry.credit_amount.toLocaleString('vi-VN')}đ`);
 * });
 * 
 * // Calculate net impact on retained earnings
 * const retainedEarningsImpact = preview
 *   .filter(e => e.account_code === '421')
 *   .reduce((sum, e) => sum + Number(e.credit_amount || 0) - Number(e.debit_amount || 0), 0);
 * 
 * console.log(`Net income to retained earnings: ${retainedEarningsImpact.toLocaleString('vi-VN')}đ`);
 * ```
 * 
 * @see {@link closePeriodAction} for actually closing the period
 * @see {@link getIncomeStatementReport} for period profit/loss
 */
export async function previewClosingEntries(periodId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can preview closing entries.');
  }

  const { data, error } = await supabase.rpc('preview_closing_entries', {
    p_period_id: periodId,
  });

  if (error) throw error;
  return data || [];
}

/**
 * Closes an accounting period and generates closing journal entries.
 * 
 * Atomically closes the period by running health checks, generating closing entries,
 * locking all journal entries in the period, and updating period status to CLOSED.
 * 
 * @param periodId - UUID of the accounting period to close
 * @returns Success result object
 * 
 * @throws {Error} If user is not authenticated or not an admin
 * @throws {Error} If period has blocking issues (draft journals, failed outbox, unbalanced entries)
 * @throws {Error} If database RPC call fails
 * 
 * @remarks
 * **Authorization:**
 * - Only `admin` or `super_admin` roles can close periods
 * - Tenant isolation enforced
 * 
 * **Atomic Period Close Process:**
 * The RPC `close_accounting_period` performs the following in a single transaction:
 * 1. **Preflight Health Checks**:
 *    - No DRAFT journal entries (all must be POSTED)
 *    - No FAILED or DEAD accounting outbox events
 *    - All journal entries balanced (debits = credits)
 * 2. **Generate Closing Entries**:
 *    - Close revenue accounts (711-719) to retained earnings (421)
 *    - Close expense accounts (511-699) to retained earnings (421)
 *    - Post closing entries with `reference_type: 'PERIOD_CLOSE'`
 * 3. **Lock Journal Entries**:
 *    - Set `is_locked = true` on all entries in period
 *    - Prevent modifications to closed period data
 * 4. **Update Period Status**:
 *    - Set `status = 'CLOSED'`
 *    - Record `closed_at` timestamp
 *    - Record `closed_by` admin ID
 * 
 * **Critical Business Rules:**
 * - **Irreversible Operation**: Period close is difficult to undo (requires {@link reopenPeriodAction})
 * - **Always run health checks first**: Use `getMonthClosePreflight` before closing
 * - **Always preview closing entries**: Use {@link previewClosingEntries} to validate calculations
 * - **Tax implications**: Closed periods affect financial reports and tax filings
 * 
 * **Audit Trail:**
 * - Records audit log with admin ID who closed the period
 * - Closing entries include reference to period ID
 * - All locked entries preserve original creation metadata
 * 
 * **Cache Invalidation:**
 * - Revalidates `/dashboard/accounting/periods` list
 * - Revalidates `/dashboard/accounting/journals` (newly locked)
 * 
 * **Month-End Close Workflow:**
 * ```typescript
 * // Step 1: Check health
 * const health = await getMonthClosePreflight('2026-06');
 * if (!health.can_close_month) {
 *   console.error('Blockers exist:', health.blockers);
 *   return;
 * }
 * 
 * // Step 2: Preview closing entries
 * const preview = await previewClosingEntries(periodId);
 * console.log('Closing entries preview:', preview);
 * 
 * // Step 3: Get admin confirmation
 * const confirmed = confirm('Close period? This cannot be easily undone.');
 * if (!confirmed) return;
 * 
 * // Step 4: Close period
 * await closePeriodAction(periodId);
 * console.log('Period closed successfully');
 * ```
 * 
 * @example
 * ```typescript
 * // Close June 2026 period
 * try {
 *   await closePeriodAction('period-uuid-123');
 *   alert('Đã đóng kỳ kế toán thành công');
 * } catch (error) {
 *   console.error('Period close failed:', error.message);
 *   alert('Không thể đóng kỳ: ' + error.message);
 * }
 * ```
 * 
 * @see {@link previewClosingEntries} for previewing closing entries before close
 * @see {@link reopenPeriodAction} for reopening a closed period
 * @see {@link getMonthClosePreflight} for health checks (defined elsewhere)
 */
export async function closePeriodAction(periodId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can close accounting periods.');
  }

  // RPC close_accounting_period handles validation, generation, lock cascade atomically
  const { error } = await supabase.rpc('close_accounting_period', { p_period_id: periodId });
  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_periods',
    record_id: periodId,
    new_data: { status: 'CLOSED', closed_by: user.id },
  });

  await safeRevalidatePath('/dashboard/accounting/periods');
  await safeRevalidatePath('/dashboard/accounting/journals');
  return { success: true };
}

/**
 * Reopens a closed accounting period for retroactive adjustments.
 * 
 * Unlocks a closed period to allow corrections and adjustments, reverting
 * the period status to OPEN and unlocking associated journal entries.
 * 
 * @param periodId - UUID of the accounting period to reopen
 * @returns Success result object
 * 
 * @throws {Error} If user is not authenticated
 * @throws {Error} If database RPC call fails
 * 
 * @remarks
 * **Authorization:**
 * - Requires authenticated user (no specific role check in code, but typically admin-only in practice)
 * - Tenant isolation enforced via RPC
 * 
 * **Reopen Process:**
 * The RPC `reopen_accounting_period` performs:
 * 1. **Unlock Journal Entries**:
 *    - Set `is_locked = false` on all entries in period
 *    - Allow modifications and new entries
 * 2. **Update Period Status**:
 *    - Set `status = 'OPEN'`
 *    - Clear `closed_at` and `closed_by` fields
 *    - Record `reopened_at` and `reopened_by`
 * 3. **Preserve Closing Entries**:
 *    - Does NOT delete closing entries (they remain for audit trail)
 *    - Admin must manually reverse closing entries if needed
 * 
 * **Critical Security Considerations:**
 * - **Financial impact**: Reopening affects reported financials and tax filings
 * - **Audit trail**: All reopens are logged for compliance
 * - **Multi-period impact**: Reopening affects retained earnings in subsequent periods
 * - **Coordination required**: Notify accountants before reopening to avoid conflicts
 * 
 * **Use Cases:**
 * - Correcting posting errors discovered after close
 * - Adding missed transactions (late invoices, accruals)
 * - Adjusting closing entries
 * - Reversing incorrect journal entries
 * 
 * **Best Practices:**
 * 1. Document the reason for reopening (audit trail)
 * 2. Notify all stakeholders (accountants, auditors, tax preparers)
 * 3. Make only necessary corrections
 * 4. Re-close the period promptly after corrections
 * 5. Update financial reports and tax filings if affected
 * 
 * **Audit Trail:**
 * - Records audit log with admin ID who reopened the period
 * - Preserves original closing metadata for reference
 * - All modifications during reopen period are tracked
 * 
 * **Cache Invalidation:**
 * - Revalidates `/dashboard/accounting/periods` list
 * 
 * @example
 * ```typescript
 * // Reopen June 2026 to correct a posting error
 * try {
 *   await reopenPeriodAction('period-uuid-123');
 *   console.log('Period reopened - make corrections now');
 *   
 *   // Make corrections...
 *   await postManualJournalEntry({ ... });
 *   
 *   // Re-close when done
 *   await closePeriodAction('period-uuid-123');
 * } catch (error) {
 *   console.error('Failed to reopen period:', error.message);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Admin workflow with documentation
 * const reason = prompt('Lý do mở lại kỳ kế toán?');
 * 
 * await reopenPeriodAction(periodId);
 * 
 * // Log the reason for audit
 * await recordAuditLog({
 *   action: 'UPDATE',
 *   table_name: 'accounting_periods',
 *   record_id: periodId,
 *   new_data: { reopen_reason: reason }
 * });
 * 
 * alert('Đã mở lại kỳ kế toán. Vui lòng sửa lỗi và đóng lại ngay.');
 * ```
 * 
 * @see {@link closePeriodAction} for closing periods
 * @see {@link reverseJournalEntry} for reversing entries during reopen
 */
export async function reopenPeriodAction(periodId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized.');

  const { error } = await supabase.rpc('reopen_accounting_period', { p_period_id: periodId });
  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_periods',
    record_id: periodId,
    new_data: { status: 'OPEN', reopened_by: user.id },
  });

  await safeRevalidatePath('/dashboard/accounting/periods');
  return { success: true };
}
