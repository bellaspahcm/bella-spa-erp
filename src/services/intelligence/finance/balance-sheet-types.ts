/**
 * Balance Sheet Types
 * 
 * Types for Balance Sheet (Bảng Cân Đối Kế Toán) and Financial Ratios.
 * 
 * Balance Sheet Structure:
 * - Assets = Liabilities + Equity
 * - Assets: Current Assets + Non-Current Assets
 * - Liabilities: Current Liabilities + Long-Term Liabilities
 * - Equity: Share Capital + Retained Earnings + Current Period P&L
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Priority 3 Task #1
 */

// ─── Asset Types ────────────────────────────────────────────────────────────

export interface CurrentAssets {
  cash: number; // Tiền mặt, tiền gửi ngân hàng
  accountsReceivable: number; // Phải thu khách hàng
  inventory: number; // Hàng tồn kho
  prepaidExpenses: number; // Chi phí trả trước
  otherCurrentAssets: number; // Tài sản ngắn hạn khác
  total: number;
}

export interface NonCurrentAssets {
  fixedAssets: number; // Tài sản cố định (equipment, furniture)
  accumulatedDepreciation: number; // Khấu hao lũy kế (negative)
  netFixedAssets: number; // Tài sản cố định ròng
  longTermInvestments: number; // Đầu tư dài hạn
  intangibleAssets: number; // Tài sản vô hình (software, patents)
  otherNonCurrentAssets: number; // Tài sản dài hạn khác
  total: number;
}

export interface Assets {
  current: CurrentAssets;
  nonCurrent: NonCurrentAssets;
  total: number;
}

// ─── Liability Types ────────────────────────────────────────────────────────

export interface CurrentLiabilities {
  accountsPayable: number; // Phải trả nhà cung cấp
  shortTermDebt: number; // Vay ngắn hạn
  accruedExpenses: number; // Chi phí phải trả (lương, thuế)
  unearnedRevenue: number; // Doanh thu chưa thực hiện (deposits)
  otherCurrentLiabilities: number; // Nợ ngắn hạn khác
  total: number;
}

export interface LongTermLiabilities {
  longTermDebt: number; // Vay dài hạn
  deferredTaxLiabilities: number; // Thuế thu nhập hoãn lại
  otherLongTermLiabilities: number; // Nợ dài hạn khác
  total: number;
}

export interface Liabilities {
  current: CurrentLiabilities;
  longTerm: LongTermLiabilities;
  total: number;
}

// ─── Equity Types ───────────────────────────────────────────────────────────

export interface Equity {
  shareCapital: number; // Vốn góp chủ sở hữu
  retainedEarnings: number; // Lợi nhuận giữ lại các năm trước
  currentPeriodPnL: number; // Lãi/lỗ kỳ hiện tại
  otherEquity: number; // Quỹ khác
  total: number;
}

// ─── Balance Sheet ──────────────────────────────────────────────────────────

export interface BalanceSheet {
  tenantId: string;
  date: string; // YYYY-MM-DD (as of date)
  period: string; // YYYY-MM (month)
  
  assets: Assets;
  liabilities: Liabilities;
  equity: Equity;
  
  // Validation check
  isBalanced: boolean; // assets.total === liabilities.total + equity.total
  balanceDifference: number; // Should be 0 if balanced
}

// ─── Financial Ratios ───────────────────────────────────────────────────────

export interface LiquidityRatios {
  // Khả năng thanh toán ngắn hạn
  currentRatio: number; // Current Assets / Current Liabilities (>= 1.0 is good)
  quickRatio: number; // (Current Assets - Inventory) / Current Liabilities (>= 1.0 is good)
  cashRatio: number; // Cash / Current Liabilities
  workingCapital: number; // Current Assets - Current Liabilities
}

export interface SolvencyRatios {
  // Khả năng thanh toán dài hạn
  debtToEquityRatio: number; // Total Liabilities / Equity (< 2.0 is good)
  debtToAssetsRatio: number; // Total Liabilities / Total Assets (< 0.6 is good)
  equityMultiplier: number; // Total Assets / Equity
  interestCoverageRatio: number; // EBIT / Interest Expense
}

export interface ProfitabilityRatios {
  // Khả năng sinh lời
  returnOnAssets: number; // Net Income / Total Assets (ROA %)
  returnOnEquity: number; // Net Income / Equity (ROE %)
  profitMargin: number; // Net Income / Revenue (%)
  grossProfitMargin: number; // Gross Profit / Revenue (%)
  operatingMargin: number; // Operating Income / Revenue (%)
}

export interface EfficiencyRatios {
  // Hiệu quả hoạt động
  assetTurnover: number; // Revenue / Total Assets
  inventoryTurnover: number; // COGS / Average Inventory
  receivablesTurnover: number; // Revenue / Average Accounts Receivable
  daysSalesOutstanding: number; // 365 / Receivables Turnover (days)
  daysInventoryOutstanding: number; // 365 / Inventory Turnover (days)
}

export interface FinancialRatios {
  tenantId: string;
  period: string; // YYYY-MM
  
  liquidity: LiquidityRatios;
  solvency: SolvencyRatios;
  profitability: ProfitabilityRatios;
  efficiency: EfficiencyRatios;
  
  // Reference data
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  revenue: number;
  netIncome: number;
}

// ─── Query Parameters ───────────────────────────────────────────────────────

export interface BalanceSheetParams {
  tenantId: string;
  date?: string; // Optional: YYYY-MM-DD (defaults to end of current month)
  period?: string; // Optional: YYYY-MM (for monthly balance sheet)
}

export interface FinancialRatiosParams {
  tenantId: string;
  period?: string; // Optional: YYYY-MM (defaults to current month)
  compareWithPreviousPeriod?: boolean; // If true, also return previous period ratios
}

// ─── Account Mapping ────────────────────────────────────────────────────────

/**
 * Account Type to Balance Sheet Category Mapping
 * 
 * This maps accounting account types to balance sheet line items.
 * Used to aggregate journal entry balances into balance sheet categories.
 */
export const ACCOUNT_MAPPING = {
  // Assets
  CASH: ['1111', '1112', '1113'], // Cash, Petty Cash, Bank Accounts
  ACCOUNTS_RECEIVABLE: ['1131', '1132', '1133'], // Customer Receivables
  INVENTORY: ['1561', '1562'], // Raw Materials, Finished Goods
  PREPAID_EXPENSES: ['1421', '1422'], // Prepaid Rent, Prepaid Insurance
  FIXED_ASSETS: ['2111', '2112', '2113', '2114'], // Buildings, Equipment, Furniture, Vehicles
  ACCUMULATED_DEPRECIATION: ['2118'], // Accumulated Depreciation (contra-asset)
  INTANGIBLE_ASSETS: ['2211', '2212'], // Software, Patents
  
  // Liabilities
  ACCOUNTS_PAYABLE: ['3311', '3312'], // Supplier Payables, Other Payables
  SHORT_TERM_DEBT: ['3411', '3412'], // Short-term Loans, Credit Lines
  ACCRUED_EXPENSES: ['3388', '3389'], // Accrued Salaries, Accrued Taxes
  UNEARNED_REVENUE: ['3351'], // Customer Deposits, Prepayments
  LONG_TERM_DEBT: ['3441', '3442'], // Long-term Loans, Bonds Payable
  
  // Equity
  SHARE_CAPITAL: ['4111'], // Owner's Capital, Share Capital
  RETAINED_EARNINGS: ['4211'], // Retained Earnings from Previous Periods
} as const;

/**
 * Account Type Categories
 * 
 * Categorizes account types into Balance Sheet vs Income Statement.
 */
export const ACCOUNT_TYPE_CATEGORY = {
  BALANCE_SHEET: ['asset', 'liability', 'equity'] as const,
  INCOME_STATEMENT: ['revenue', 'expense'] as const,
} as const;

/**
 * Current vs Non-Current Classification
 * 
 * Heuristic rules to classify accounts as current (< 1 year) or non-current (>= 1 year).
 * Based on account code prefix:
 * - 11xx = Current Assets
 * - 21xx = Non-Current Assets
 * - 33xx = Current Liabilities
 * - 34xx = Long-Term Liabilities
 */
export function isCurrentAsset(accountCode: string): boolean {
  return accountCode.startsWith('11');
}

export function isNonCurrentAsset(accountCode: string): boolean {
  return accountCode.startsWith('21') || accountCode.startsWith('22');
}

export function isCurrentLiability(accountCode: string): boolean {
  return accountCode.startsWith('33') || accountCode.startsWith('31');
}

export function isLongTermLiability(accountCode: string): boolean {
  return accountCode.startsWith('34');
}

/**
 * Equity Classification
 * 
 * Classifies equity accounts into share capital, retained earnings, or other.
 */
export function getEquityCategory(accountCode: string): 'capital' | 'retained' | 'other' {
  if (accountCode.startsWith('411')) return 'capital';
  if (accountCode.startsWith('421')) return 'retained';
  return 'other';
}
