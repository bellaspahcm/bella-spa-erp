'use server';

import { getFinancialOverview as getFinancialOverviewAction } from './transaction-overview';
import {
  confirmTransaction as confirmTransactionAction,
  recordTransaction as recordTransactionAction,
} from './transaction-mutations';

export type ConfirmTransactionResult =
  | { success: true }
  | { success: false; error: string };

export type RecordTransactionInput = Parameters<typeof recordTransactionAction>[0];
export type RecordTransactionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Extracts error message from unknown error object with fallback.
 * 
 * @param error - Unknown error object (Error, object, string, etc.)
 * @param fallback - Default message if error message cannot be extracted
 * @returns Error message string
 * 
 * @remarks
 * **Error Handling Priority:**
 * 1. If `Error` instance → use `.message`
 * 2. If object with `message` property → extract it
 * 3. Otherwise → use fallback message
 * 
 * **Use Case:**
 * Safely extract error messages in catch blocks without type assertions.
 * 
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const message = getErrorMessage(error, 'Operation failed');
 *   console.error(message);
 * }
 * ```
 */
function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message ? message : fallback;
  }
  return fallback;
}

/**
 * Fetches the financial overview with revenue, expenses, and cash balance.
 * 
 * Returns a summary of financial transactions including pending, confirmed,
 * and rejected items with total amounts and balances.
 * 
 * @returns Financial overview object with transaction summaries
 * 
 * @throws {Error} If database queries fail
 * @throws {Error} If tenant ID cannot be resolved
 * 
 * @remarks
 * **Overview Structure:**
 * The returned object typically includes:
 * - Total revenue (pending, confirmed, total)
 * - Total expenses (pending, approved, total)
 * - Cash balance and projections
 * - Transaction counts by status
 * 
 * **Data Sources:**
 * - `revenue` table: All revenue transactions
 * - `expenses` table: All expense transactions
 * - Aggregated by status for breakdown
 * 
 * **Tenant Isolation:**
 * Automatically filters by current user's tenant ID.
 * 
 * @example
 * ```typescript
 * const overview = await getFinancialOverview();
 * 
 * console.log(`Total Revenue: ${overview.total_revenue.toLocaleString('vi-VN')}đ`);
 * console.log(`Pending Revenue: ${overview.pending_revenue.toLocaleString('vi-VN')}đ`);
 * console.log(`Total Expenses: ${overview.total_expenses.toLocaleString('vi-VN')}đ`);
 * console.log(`Cash Balance: ${overview.cash_balance.toLocaleString('vi-VN')}đ`);
 * ```
 * 
 * @see {@link getMonthlyPnL} for profit/loss reporting
 */
export async function getFinancialOverview() {
  return getFinancialOverviewAction();
}

/**
 * Confirms a financial transaction (revenue or expense).
 * 
 * Updates transaction status to confirmed/approved, making it effective
 * for financial reporting and accounting.
 * 
 * @param id - UUID of the transaction to confirm
 * @param type - Transaction type ('revenue' or 'expense')
 * @returns Success result object
 * 
 * @remarks
 * **Status Transitions:**
 * - **Revenue**: 'pending' → 'confirmed'
 * - **Expense**: 'submitted' → 'approved'
 * 
 * **Authorization:**
 * - Typically requires admin or accountant role
 * - Enforced in underlying `confirmTransactionAction`
 * 
 * **Side Effects:**
 * - Revenue: May trigger accounting outbox event for journal entry
 * - Expense: May trigger approval notifications
 * - Cache invalidation for financial reports
 * 
 * **Error Handling:**
 * - Returns `{ success: false, error: string }` on failure
 * - Logs error to console for debugging
 * - Does NOT throw (safe for UI calls)
 * 
 * @example
 * ```typescript
 * // Confirm a revenue transaction
 * const result = await confirmTransaction('revenue-uuid', 'revenue');
 * 
 * if (result.success) {
 *   alert('Đã xác nhận doanh thu');
 * } else {
 *   alert('Lỗi: ' + result.error);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Confirm an expense
 * const result = await confirmTransaction('expense-uuid', 'expense');
 * 
 * if (!result.success) {
 *   console.error('Failed to approve expense:', result.error);
 * }
 * ```
 * 
 * @see {@link recordTransaction} for creating new transactions
 */
export async function confirmTransaction(
  id: string,
  type: 'revenue' | 'expense'
): Promise<ConfirmTransactionResult> {
  try {
    await confirmTransactionAction(id, type);
    return { success: true };
  } catch (error) {
    console.error('[confirmTransactionActionResult]', error);
    return {
      success: false,
      error: getErrorMessage(error, 'Không thể xác nhận giao dịch'),
    };
  }
}

/**
 * Records a new financial transaction (revenue or expense).
 * 
 * Creates a new revenue or expense entry in the database with validation
 * and proper status initialization.
 * 
 * @param data - Transaction data input (amount, type, date, description, etc.)
 * @returns Success result object
 * 
 * @remarks
 * **Transaction Input:**
 * The input object typically includes:
 * - `amount`: Transaction amount in VND
 * - `type`: 'revenue' or 'expense'
 * - `date`: Transaction date (ISO format)
 * - `description`: Human-readable description
 * - `category`: Category/classification
 * - `payment_method`: Cash, bank transfer, etc.
 * 
 * **Initial Status:**
 * - **Revenue**: Created with `status = 'pending'`
 * - **Expense**: Created with `status = 'submitted'`
 * 
 * **Validation:**
 * - Amount must be positive
 * - Required fields must be present
 * - Date must be valid
 * - Category must be valid for type
 * 
 * **Authorization:**
 * - Revenue: Typically any staff can record
 * - Expense: Typically requires requestor role
 * - Enforced in underlying `recordTransactionAction`
 * 
 * **Side Effects:**
 * - Inserts row into `revenue` or `expenses` table
 * - May trigger notifications for approvers
 * - Cache invalidation for transaction lists
 * 
 * **Error Handling:**
 * - Returns `{ success: false, error: string }` on failure
 * - Logs error to console for debugging
 * - Does NOT throw (safe for UI calls)
 * 
 * @example
 * ```typescript
 * // Record a revenue transaction
 * const result = await recordTransaction({
 *   amount: 5000000,
 *   type: 'revenue',
 *   date: '2026-06-15',
 *   description: 'Thanh toán gói dịch vụ VIP',
 *   category: 'service_revenue',
 *   payment_method: 'bank_transfer'
 * });
 * 
 * if (result.success) {
 *   alert('Đã ghi nhận doanh thu');
 * } else {
 *   alert('Lỗi: ' + result.error);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Record an expense transaction
 * const result = await recordTransaction({
 *   amount: 2000000,
 *   type: 'expense',
 *   date: '2026-06-15',
 *   description: 'Mua vật tư spa',
 *   category: 'supplies',
 *   payment_method: 'cash'
 * });
 * 
 * if (!result.success) {
 *   console.error('Failed to record expense:', result.error);
 * }
 * ```
 * 
 * @see {@link confirmTransaction} for approving transactions
 * @see {@link getFinancialOverview} for viewing transaction summary
 */
export async function recordTransaction(data: RecordTransactionInput): Promise<RecordTransactionResult> {
  try {
    await recordTransactionAction(data);
    return { success: true };
  } catch (error) {
    console.error('[recordTransactionActionResult]', error);
    return {
      success: false,
      error: getErrorMessage(error, 'Không thể ghi nhận giao dịch'),
    };
  }
}
