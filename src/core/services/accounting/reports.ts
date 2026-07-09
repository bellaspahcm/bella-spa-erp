'use server';

import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { AI_SALARY_RECON_THRESHOLDS } from '@/config/ai-constants';
import {
  calculateSalaryReconciliationDiffPercent,
  hasSalaryLegacyReconciliationRecord,
  resolveSalaryReconciliationStatus,
} from '@/lib/business-rules/salary';
import { getCurrentUser } from '../../../services/user-actions';
import { createAccountingDataClient } from './client';
import type { ReconciliationRow, SalaryReconciliationRow } from './types';

type SalaryReconciliationRpcArgs = {
  p_tenant_id: string;
  p_month_year: string;
};

type ReportRpcError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

type SalaryReconciliationRpc = (
  fn: 'get_salary_reconciliation_report',
  args: SalaryReconciliationRpcArgs
) => Promise<{ data: unknown; error: ReportRpcError | null }>;

type SalaryReconciliationRpcClient = {
  rpc: SalaryReconciliationRpc;
};

function callSalaryReconciliationReportRpc(client: unknown, args: SalaryReconciliationRpcArgs) {
  return (client as SalaryReconciliationRpcClient).rpc('get_salary_reconciliation_report', args);
}

function normalizeSalaryReconciliationReportRows(data: unknown): SalaryReconciliationRow[] {
  const rows = Array.isArray(data) ? data as SalaryReconciliationRow[] : [];

  return rows.map((row) => {
    const hasLegacyRecord = hasSalaryLegacyReconciliationRecord({
      status: row.status,
      legacyStatus: row.legacy_status,
    });
    const diffTotal = hasLegacyRecord
      ? Number(row.diff_total ?? (Number(row.legacy_total || 0) - Number(row.ai_total || 0)))
      : null;
    const diffPercent = hasLegacyRecord
      ? row.diff_percent ?? calculateSalaryReconciliationDiffPercent({
        legacyTotal: row.legacy_total,
        aiTotal: row.ai_total,
        hasLegacyRecord,
      })
      : null;
    const normalizedStatus = resolveSalaryReconciliationStatus({
      status: row.status,
      legacyStatus: row.legacy_status,
      hasLegacyRecord,
      legacyTotal: row.legacy_total,
      aiTotal: row.ai_total,
      diffAmount: diffTotal,
      diffPercent,
      thresholds: AI_SALARY_RECON_THRESHOLDS,
    });

    return {
      ...row,
      diff_total: diffTotal,
      diff_percent: diffPercent,
      status: normalizedStatus === 'NO_LEGACY' ? 'PENDING_LEGACY' : normalizedStatus,
    };
  });
}

/**
 * Fetches the trial balance report as of a specific date.
 * 
 * Returns all accounts with their debit/credit balances, ensuring
 * total debits equal total credits for accounting integrity validation.
 * 
 * @param asOfDate - Report date (ISO format: YYYY-MM-DD)
 * @returns Array of account balances with debit/credit totals
 * 
 * @throws {Error} If user is not authenticated or missing tenant session
 * @throws {Error} If database RPC call fails
 * 
 * @remarks
 * **Trial Balance Purpose:**
 * - Validates accounting equation: Debits = Credits
 * - Shows current balance for all accounts
 * - Used for period-end verification
 * - Foundation for balance sheet and income statement
 * 
 * **Report Structure:**
 * Each row contains:
 * - `account_code`: Chart of accounts code
 * - `account_name`: Account name
 * - `debit_balance`: Total debit balance
 * - `credit_balance`: Total credit balance
 * - Account type and category
 * 
 * **Tenant Isolation:**
 * Automatically filters by current user's tenant via RPC.
 * 
 * @example
 * ```typescript
 * // Get trial balance for June 30, 2026
 * const trialBalance = await getTrialBalanceReport('2026-06-30');
 * 
 * const totalDebits = trialBalance.reduce((sum, row) => 
 *   sum + Number(row.debit_balance || 0), 0
 * );
 * const totalCredits = trialBalance.reduce((sum, row) => 
 *   sum + Number(row.credit_balance || 0), 0
 * );
 * 
 * console.log(`Total Debits: ${totalDebits.toLocaleString('vi-VN')}đ`);
 * console.log(`Total Credits: ${totalCredits.toLocaleString('vi-VN')}đ`);
 * console.log(`Balanced: ${totalDebits === totalCredits ? 'Yes' : 'No'}`);
 * ```
 * 
 * @see {@link getBalanceSheetReport} for balance sheet derived from trial balance
 * @see {@link getIncomeStatementReport} for income statement
 */
export async function getTrialBalanceReport(asOfDate: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase.rpc('get_trial_balance', {
    p_tenant_id: user.tenant_id,
    p_as_of_date: asOfDate,
  });

  if (error) throw error;
  return data || [];
}

/**
 * Fetches the income statement (profit & loss) report for a date range.
 * 
 * Returns revenue and expense summary with net profit/loss calculation.
 * 
 * @param fromDate - Start date (ISO format: YYYY-MM-DD)
 * @param toDate - End date (ISO format: YYYY-MM-DD)
 * @returns Income statement summary object, or null if no data
 * 
 * @throws {Error} If user is not authenticated or missing tenant session
 * @throws {Error} If database RPC call fails
 * 
 * @remarks
 * **Income Statement Formula:**
 * ```
 * Net Profit = Total Revenue - Total Expenses
 * ```
 * 
 * **Report Structure:**
 * ```typescript
 * {
 *   total_revenue: number,        // Sum of all revenue accounts (5xxx)
 *   total_operating_expense: number,  // Operating expenses (6xxx)
 *   total_salary_expense: number,     // Salary costs (642x)
 *   total_expense: number,            // All expenses
 *   net_profit: number,               // Revenue - Expenses
 *   period_from: string,
 *   period_to: string
 * }
 * ```
 * 
 * **Critical Business Rules:**
 * - Only includes POSTED journal entries
 * - Filters by entry_date within range
 * - Revenue accounts: Credit balance (positive)
 * - Expense accounts: Debit balance (positive)
 * 
 * **Tenant Isolation:**
 * Automatically filters by current user's tenant via RPC.
 * 
 * @example
 * ```typescript
 * // Get P&L for June 2026
 * const incomeStatement = await getIncomeStatementReport(
 *   '2026-06-01',
 *   '2026-06-30'
 * );
 * 
 * if (incomeStatement) {
 *   console.log(`Revenue: ${incomeStatement.total_revenue.toLocaleString('vi-VN')}đ`);
 *   console.log(`Operating Expenses: ${incomeStatement.total_operating_expense.toLocaleString('vi-VN')}đ`);
 *   console.log(`Salary Expenses: ${incomeStatement.total_salary_expense.toLocaleString('vi-VN')}đ`);
 *   console.log(`Net Profit: ${incomeStatement.net_profit.toLocaleString('vi-VN')}đ`);
 * }
 * ```
 * 
 * @see {@link getBalanceSheetReport} for balance sheet
 * @see {@link getCashFlowStatementReport} for cash flow
 */
export async function getIncomeStatementReport(fromDate: string, toDate: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase.rpc('get_income_statement', {
    p_tenant_id: user.tenant_id,
    p_from_date: fromDate,
    p_to_date: toDate,
  });

  if (error) throw error;
  return data?.[0] || null;
}

/**
 * Fetches the balance sheet report as of a specific date.
 * 
 * Returns snapshot of assets, liabilities, and equity at a point in time.
 * 
 * @param asOfDate - Report date (ISO format: YYYY-MM-DD)
 * @returns Balance sheet summary object, or null if no data
 * 
 * @throws {Error} If user is not authenticated or missing tenant session
 * @throws {Error} If database RPC call fails
 * 
 * @remarks
 * **Accounting Equation:**
 * ```
 * Assets = Liabilities + Equity
 * ```
 * 
 * **Report Structure:**
 * ```typescript
 * {
 *   total_assets: number,           // All asset accounts (1xxx)
 *   total_current_assets: number,   // Cash, receivables, inventory
 *   total_fixed_assets: number,     // Property, equipment, vehicles
 *   total_liabilities: number,      // All liability accounts (2xxx, 3xxx)
 *   total_current_liabilities: number,  // Short-term payables
 *   total_equity: number,           // Owner's equity (4xxx)
 *   as_of_date: string
 * }
 * ```
 * 
 * **Account Classifications:**
 * - **Assets (1xxx)**: Debit balance = positive
 * - **Liabilities (2xxx, 3xxx)**: Credit balance = positive
 * - **Equity (4xxx)**: Credit balance = positive
 * 
 * **Validation:**
 * The balance sheet must always balance:
 * `total_assets === total_liabilities + total_equity`
 * 
 * **Tenant Isolation:**
 * Automatically filters by current user's tenant via RPC.
 * 
 * @example
 * ```typescript
 * // Get balance sheet as of June 30, 2026
 * const balanceSheet = await getBalanceSheetReport('2026-06-30');
 * 
 * if (balanceSheet) {
 *   console.log(`Total Assets: ${balanceSheet.total_assets.toLocaleString('vi-VN')}đ`);
 *   console.log(`Total Liabilities: ${balanceSheet.total_liabilities.toLocaleString('vi-VN')}đ`);
 *   console.log(`Total Equity: ${balanceSheet.total_equity.toLocaleString('vi-VN')}đ`);
 *   
 *   const isBalanced = 
 *     balanceSheet.total_assets === 
 *     (balanceSheet.total_liabilities + balanceSheet.total_equity);
 *   console.log(`Balanced: ${isBalanced ? 'Yes' : 'No'}`);
 * }
 * ```
 * 
 * @see {@link getTrialBalanceReport} for detailed account balances
 * @see {@link getIncomeStatementReport} for profit/loss
 */
export async function getBalanceSheetReport(asOfDate: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase.rpc('get_balance_sheet', {
    p_tenant_id: user.tenant_id,
    p_as_of_date: asOfDate,
  });

  if (error) throw error;
  return data?.[0] || null;
}

/**
 * Fetches the account ledger (transaction history) for a specific account.
 * 
 * Returns all journal line entries for an account within a date range,
 * showing beginning balance, transactions, and ending balance.
 * 
 * @param accountId - UUID of the accounting account
 * @param fromDate - Start date (ISO format: YYYY-MM-DD)
 * @param toDate - End date (ISO format: YYYY-MM-DD)
 * @returns Array of ledger entries with running balance
 * 
 * @throws {Error} If user is not authenticated or missing tenant session
 * @throws {Error} If database RPC call fails
 * 
 * @remarks
 * **Ledger Purpose:**
 * - Shows all debits and credits for an account
 * - Provides audit trail for account activity
 * - Calculates running balance after each transaction
 * - Used for account reconciliation
 * 
 * **Report Structure:**
 * Each row contains:
 * - `entry_date`: Transaction date
 * - `description`: Journal entry description
 * - `debit_amount`: Debit amount (if any)
 * - `credit_amount`: Credit amount (if any)
 * - `balance`: Running balance after transaction
 * - `journal_entry_id`: Link to source journal entry
 * - `reference_type`: Source transaction type
 * - `reference_id`: Source entity ID
 * 
 * **Balance Calculation:**
 * - **Asset/Expense accounts**: Balance = Previous + Debit - Credit
 * - **Liability/Revenue/Equity accounts**: Balance = Previous + Credit - Debit
 * 
 * **Tenant Isolation:**
 * Automatically filters by current user's tenant via RPC.
 * 
 * @example
 * ```typescript
 * // Get cash account ledger for June 2026
 * const ledger = await getAccountLedgerReport(
 *   'cash-account-uuid',
 *   '2026-06-01',
 *   '2026-06-30'
 * );
 * 
 * console.log(`Beginning Balance: ${ledger[0]?.balance || 0}`);
 * console.log(`Transactions: ${ledger.length}`);
 * console.log(`Ending Balance: ${ledger[ledger.length - 1]?.balance || 0}`);
 * 
 * // Show all transactions
 * ledger.forEach(entry => {
 *   console.log(`${entry.entry_date}: ${entry.description}`);
 *   console.log(`  Debit: ${entry.debit_amount.toLocaleString('vi-VN')}đ`);
 *   console.log(`  Credit: ${entry.credit_amount.toLocaleString('vi-VN')}đ`);
 *   console.log(`  Balance: ${entry.balance.toLocaleString('vi-VN')}đ`);
 * });
 * ```
 * 
 * @see {@link getTrialBalanceReport} for all account balances
 * @see {@link getJournalEntries} for all journal entries
 */
export async function getAccountLedgerReport(accountId: string, fromDate: string, toDate: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase.rpc('get_account_ledger', {
    p_tenant_id: user.tenant_id,
    p_account_id: accountId,
    p_from_date: fromDate,
    p_to_date: toDate,
  });

  if (error) throw error;
  return data || [];
}

/**
 * Fetches the cash flow statement for a date range.
 * 
 * Returns cash inflows and outflows categorized by operating, investing,
 * and financing activities.
 * 
 * @param fromDate - Start date (ISO format: YYYY-MM-DD)
 * @param toDate - End date (ISO format: YYYY-MM-DD)
 * @returns Cash flow summary object, or null if no data
 * 
 * @throws {Error} If user is not authenticated or missing tenant session
 * @throws {Error} If database RPC call fails
 * 
 * @remarks
 * **Cash Flow Categories:**
 * - **Operating Activities**: Cash from core business operations
 *   - Revenue collections
 *   - Expense payments
 *   - Salary payments
 * - **Investing Activities**: Capital expenditures and asset purchases
 *   - Equipment purchases
 *   - Property investments
 * - **Financing Activities**: Loans, capital, and distributions
 *   - Owner investments
 *   - Loan proceeds/repayments
 *   - Dividends paid
 * 
 * **Report Structure:**
 * ```typescript
 * {
 *   cash_from_operations: number,    // Operating cash flow
 *   cash_from_investing: number,     // Investing cash flow
 *   cash_from_financing: number,     // Financing cash flow
 *   net_cash_flow: number,           // Total cash change
 *   beginning_cash: number,          // Cash at period start
 *   ending_cash: number,             // Cash at period end
 *   period_from: string,
 *   period_to: string
 * }
 * ```
 * 
 * **Cash Flow Formula:**
 * ```
 * Net Cash Flow = Operations + Investing + Financing
 * Ending Cash = Beginning Cash + Net Cash Flow
 * ```
 * 
 * **Tenant Isolation:**
 * Automatically filters by current user's tenant via RPC.
 * 
 * @example
 * ```typescript
 * // Get cash flow for June 2026
 * const cashFlow = await getCashFlowStatementReport(
 *   '2026-06-01',
 *   '2026-06-30'
 * );
 * 
 * if (cashFlow) {
 *   console.log(`Operating Activities: ${cashFlow.cash_from_operations.toLocaleString('vi-VN')}đ`);
 *   console.log(`Investing Activities: ${cashFlow.cash_from_investing.toLocaleString('vi-VN')}đ`);
 *   console.log(`Financing Activities: ${cashFlow.cash_from_financing.toLocaleString('vi-VN')}đ`);
 *   console.log(`Net Cash Flow: ${cashFlow.net_cash_flow.toLocaleString('vi-VN')}đ`);
 *   console.log(`Beginning Cash: ${cashFlow.beginning_cash.toLocaleString('vi-VN')}đ`);
 *   console.log(`Ending Cash: ${cashFlow.ending_cash.toLocaleString('vi-VN')}đ`);
 * }
 * ```
 * 
 * @see {@link getIncomeStatementReport} for profit/loss
 * @see {@link getBalanceSheetReport} for balance sheet
 */
export async function getCashFlowStatementReport(fromDate: string, toDate: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase.rpc('get_cash_flow_statement', {
    p_tenant_id: user.tenant_id,
    p_from_date: fromDate,
    p_to_date: toDate,
  });

  if (error) throw error;
  return data?.[0] || null;
}

/**
 * Fetches the cross-module reconciliation report for accounting integrity validation.
 * 
 * Compares business transactions (sessions, expenses, revenues) with posted journal
 * entries to detect missing or mismatched accounting records.
 * 
 * @param fromDate - Start date (ISO format: YYYY-MM-DD)
 * @param toDate - End date (ISO format: YYYY-MM-DD)
 * @returns Array of reconciliation rows showing business vs. accounting data
 * 
 * @throws {Error} If user is not authenticated, not an admin/accountant, or missing tenant session
 * @throws {Error} If database RPC call fails
 * 
 * @remarks
 * **Authorization:**
 * - Only `admin`, `super_admin`, or `accountant` roles can access
 * - Tenant isolation enforced
 * 
 * **Reconciliation Purpose:**
 * - Detects missing journal entries for completed sessions
 * - Identifies discrepancies between business and accounting data
 * - Validates accounting completeness and accuracy
 * - Provides audit trail for data integrity
 * 
 * **Report Structure:**
 * Each row contains:
 * - `entity_type`: Business entity type ('session', 'expense', 'revenue')
 * - `entity_id`: Business entity UUID
 * - `entity_date`: Business transaction date
 * - `entity_amount`: Business transaction amount
 * - `journal_entry_id`: Matching journal entry ID (if exists)
 * - `journal_status`: Journal entry status (POSTED, DRAFT, null)
 * - `journal_amount`: Accounting entry amount
 * - `diff_amount`: Discrepancy amount (entity - journal)
 * - `reconciliation_status`: 'MATCH' | 'MISSING_JOURNAL' | 'AMOUNT_MISMATCH'
 * 
 * **Reconciliation Rules:**
 * - `MATCH`: Journal entry exists, amounts match
 * - `MISSING_JOURNAL`: No journal entry for business transaction
 * - `AMOUNT_MISMATCH`: Journal entry exists but amounts differ
 * 
 * **Service Role Requirement:**
 * Uses admin/service-role client to bypass RLS for cross-table queries.
 * Falls back to user client if service key not configured (for development).
 * 
 * **Critical for Data Integrity:**
 * This report is the primary tool for detecting accounting outbox failures
 * and ensuring all business transactions have corresponding journal entries.
 * 
 * @example
 * ```typescript
 * // Get reconciliation report for June 2026
 * const report = await getReconciliationReport(
 *   '2026-06-01',
 *   '2026-06-30'
 * );
 * 
 * // Analyze discrepancies
 * const missingSessions = report.filter(row => 
 *   row.entity_type === 'session' && 
 *   row.reconciliation_status === 'MISSING_JOURNAL'
 * );
 * 
 * const amountMismatches = report.filter(row => 
 *   row.reconciliation_status === 'AMOUNT_MISMATCH'
 * );
 * 
 * console.log(`Missing journal entries: ${missingSessions.length}`);
 * console.log(`Amount mismatches: ${amountMismatches.length}`);
 * 
 * // Show details
 * missingSessions.forEach(row => {
 *   console.log(`Session ${row.entity_id}:`);
 *   console.log(`  Date: ${row.entity_date}`);
 *   console.log(`  Amount: ${row.entity_amount.toLocaleString('vi-VN')}đ`);
 *   console.log(`  Status: Missing journal entry`);
 * });
 * ```
 * 
 * @see {@link getOutboxEvents} for monitoring accounting outbox failures
 * @see {@link getJournalEntries} for viewing journal entries
 */
export async function getReconciliationReport(fromDate: string, toDate: string): Promise<ReconciliationRow[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin hoặc kế toán của chi nhánh mới được xem báo cáo đối soát chéo.');
  }

  const url = getSupabaseAdminUrl();
  const serviceKey = getSupabaseAdminKey();

  // Fallback sang user client nếu hoàn toàn không có serviceKey (ví dụ: trên Vercel chưa cấu hình)
  if (!serviceKey) {
    console.warn('[getReconciliationReport] SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY is missing. Using user client fallback.');
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_reconciliation_report', {
      p_tenant_id: user.tenant_id,
      p_from_date: fromDate,
      p_to_date: toDate,
    });

    if (error) {
      console.error('[getReconciliationReport] Fallback RPC error:', JSON.stringify({
        message: error.message, code: error.code, details: error.details, hint: error.hint,
      }, null, 2));
      throw error; // Zero Silent Database Failures
    }
    return (data as ReconciliationRow[]) || [];
  }

  // Sử dụng adminClient chính thức (service role)
  const { createClient: createAdmin } = await import('@supabase/supabase-js');
  const adminClient = createAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await adminClient.rpc('get_reconciliation_report', {
    p_tenant_id: user.tenant_id,
    p_from_date: fromDate,
    p_to_date: toDate,
  });

  if (error) {
    console.error('[getReconciliationReport] RPC error:', JSON.stringify({
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    }, null, 2));
    throw error; // Zero Silent Database Failures
  }
  return (data as ReconciliationRow[]) || [];
}

/**
 * Fetches the salary reconciliation report comparing AI-calculated vs. manual accountant salaries.
 * 
 * Compares automated salary calculations with legacy manual entries to detect
 * discrepancies, validate AI accuracy, and identify records needing review.
 * 
 * @param monthYear - Salary period in YYYY-MM-01 format (e.g., "2026-06-01")
 * @returns Array of salary reconciliation rows with discrepancy analysis
 * 
 * @throws {Error} If user is not authenticated, not an admin/accountant, or missing tenant session
 * @throws {Error} If database RPC call fails
 * 
 * @remarks
 * **Authorization:**
 * - Only `admin`, `super_admin`, or `accountant` roles can access
 * - Tenant isolation enforced
 * 
 * **Reconciliation Purpose:**
 * - Validates AI salary calculation accuracy
 * - Identifies discrepancies requiring manual review
 * - Tracks transition from manual to automated salary processing
 * - Provides audit trail for salary changes
 * 
 * **Report Structure:**
 * Each row contains:
 * - `ktv_id`: KTV employee UUID
 * - `ktv_name`: KTV full name
 * - `ai_total`: AI/system-calculated total salary
 * - `legacy_total`: Manual accountant-calculated salary
 * - `diff_total`: Absolute difference (AI - Legacy)
 * - `diff_percent`: Percentage difference
 * - `status`: Reconciliation status
 * - `legacy_status`: Legacy record status ('POSTED', 'MISSING', etc.)
 * - Salary component breakdowns (base, sessions, rating, KPI, deductions)
 * 
 * **Reconciliation Statuses:**
 * - `'MATCH'`: AI and legacy totals match within threshold (< ±0.1% or ±1,000đ)
 * - `'MINOR_DIFF'`: Small discrepancy (< 5%)
 * - `'MAJOR_DIFF'`: Large discrepancy (≥ 5%)
 * - `'PENDING_LEGACY'`: No legacy record exists yet (shown as "Chưa chốt lương")
 * 
 * **Discrepancy Thresholds:**
 * Configured in {@link AI_SALARY_RECON_THRESHOLDS}:
 * - `MATCH_ABS_VND`: ±1,000đ absolute tolerance
 * - `MATCH_PERCENT`: ±0.1% relative tolerance
 * - `MAJOR_DIFF_PERCENT`: 5% major discrepancy threshold
 * 
 * **Critical Business Rule:**
 * KTVs with `status === 'PENDING_LEGACY'` (no saved record) are NOT counted
 * as discrepancies in dashboard statistics. They are separate from actual
 * mismatches between AI and legacy calculations.
 * 
 * **Service Role Requirement:**
 * Uses service-role client via {@link createAccountingDataClient} to access
 * salary data across modules.
 * 
 * @example
 * ```typescript
 * // Get salary reconciliation for June 2026
 * const report = await getSalaryReconciliationReport('2026-06-01');
 * 
 * // Analyze discrepancies
 * const matches = report.filter(row => row.status === 'MATCH');
 * const minorDiffs = report.filter(row => row.status === 'MINOR_DIFF');
 * const majorDiffs = report.filter(row => row.status === 'MAJOR_DIFF');
 * const pending = report.filter(row => row.status === 'PENDING_LEGACY');
 * 
 * console.log(`Matches: ${matches.length}`);
 * console.log(`Minor Differences: ${minorDiffs.length}`);
 * console.log(`Major Differences: ${majorDiffs.length}`);
 * console.log(`Pending Legacy: ${pending.length}`);
 * 
 * // Show major discrepancies
 * majorDiffs.forEach(row => {
 *   console.log(`${row.ktv_name}:`);
 *   console.log(`  AI Total: ${row.ai_total.toLocaleString('vi-VN')}đ`);
 *   console.log(`  Legacy Total: ${row.legacy_total.toLocaleString('vi-VN')}đ`);
 *   console.log(`  Difference: ${row.diff_total.toLocaleString('vi-VN')}đ (${row.diff_percent.toFixed(2)}%)`);
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Export to CSV for review
 * const report = await getSalaryReconciliationReport('2026-06-01');
 * const csv = report
 *   .map(row => `${row.ktv_name},${row.ai_total},${row.legacy_total},${row.diff_total},${row.status}`)
 *   .join('\n');
 * ```
 * 
 * @see {@link resolveSalaryReconciliationStatus} for status calculation logic
 * @see {@link calculateSalaryReconciliationDiffPercent} for percentage calculation
 * @see {@link AI_SALARY_RECON_THRESHOLDS} for threshold configuration
 */
export async function getSalaryReconciliationReport(monthYear: string): Promise<SalaryReconciliationRow[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin/kế toán mới được xem báo cáo đối soát lương.');
  }

  // Set tenant context before calling RPC (required for service-role client)
  console.log('[getSalaryReconciliationReport] BEFORE set_session_tenant - tenant_id:', user.tenant_id);
  const supabase = await createAccountingDataClient();
  
  const { error: tenantContextError } = await supabase.rpc('set_session_tenant', {
    p_tenant_id: user.tenant_id,
  });
  console.log('[getSalaryReconciliationReport] AFTER set_session_tenant - error:', tenantContextError);
  
  if (tenantContextError) {
    console.error('[getSalaryReconciliationReport] Failed to set tenant context:', tenantContextError);
    throw new Error('Failed to set tenant context for salary reconciliation');
  }
  
  const { data, error } = await callSalaryReconciliationReportRpc(supabase, {
    p_tenant_id: user.tenant_id,
    p_month_year: monthYear,
  });

  if (error) {
    console.error('[getSalaryReconciliationReport] RPC error:', JSON.stringify({
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    }, null, 2));
    throw error; // Zero Silent Database Failures
  }
  return normalizeSalaryReconciliationReportRows(data);
}
