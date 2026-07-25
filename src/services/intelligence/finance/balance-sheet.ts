/**
 * Balance Sheet Query Service
 * 
 * Calculates Balance Sheet from accounting journal entries.
 * 
 * Balance Sheet Formula:
 * Assets = Liabilities + Equity
 * 
 * Data Sources:
 * - accounting_accounts: Chart of accounts with account types
 * - journal_entries: All accounting transactions
 * - journal_entry_lines: Debit/Credit entries per account
 * 
 * Calculation Method:
 * 1. Sum all debit/credit amounts per account up to the specified date
 * 2. Calculate balance = debit - credit (for assets) or credit - debit (for liabilities/equity)
 * 3. Classify into Balance Sheet categories based on account code
 * 4. Aggregate into Current/Non-Current for Assets and Liabilities
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Priority 3 Task #2
 */

import { createClient } from '@/lib/supabase-server';
import { QueryError } from '../shared/types';
import type {
  BalanceSheet,
  BalanceSheetParams,
  Assets,
  CurrentAssets,
  NonCurrentAssets,
  Liabilities,
  CurrentLiabilities,
  LongTermLiabilities,
  Equity,
} from './balance-sheet-types';
import {
  isCurrentAsset,
  isNonCurrentAsset,
  isCurrentLiability,
  isLongTermLiability,
  getEquityCategory,
  ACCOUNT_MAPPING,
} from './balance-sheet-types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  debitTotal: number;
  creditTotal: number;
  balance: number; // Net balance (debit - credit for assets, credit - debit for liabilities/equity)
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Get end date of a period (last day of month)
 */
function getEndOfPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(year, month, 0); // Day 0 = last day of previous month
  return lastDay.toISOString().split('T')[0];
}

/**
 * Get start of fiscal year (assuming Jan 1)
 */
function getStartOfFiscalYear(date: string): string {
  const year = date.split('-')[0];
  return `${year}-01-01`;
}

/**
 * Calculate account balances from journal entries
 */
async function getAccountBalances(
  tenantId: string,
  asOfDate: string
): Promise<AccountBalance[]> {
  const supabase = await createClient();

  // Query all journal entry lines up to the specified date
  const { data: lines, error } = await supabase
    .from('journal_entry_lines' as any)
    .select(`
      account_id,
      debit_amount,
      credit_amount,
      accounting_accounts!inner (
        account_code,
        account_name,
        account_type,
        tenant_id
      ),
      journal_entries!inner (
        entry_date,
        status,
        tenant_id
      )
    `)
    .eq('journal_entries.tenant_id', tenantId)
    .eq('journal_entries.status', 'posted') // Only posted entries
    .lte('journal_entries.entry_date', asOfDate)
    .eq('accounting_accounts.tenant_id', tenantId);

  if (error) {
    throw new QueryError('Failed to fetch journal entry lines', error);
  }

  // Aggregate balances by account
  const balanceMap = new Map<string, AccountBalance>();

  for (const line of (lines as any[]) || []) {
    const accountId = line.account_id;
    const account = line.accounting_accounts;
    
    if (!balanceMap.has(accountId)) {
      balanceMap.set(accountId, {
        accountId,
        accountCode: account.account_code,
        accountName: account.account_name,
        accountType: account.account_type.toLowerCase() as any,
        debitTotal: 0,
        creditTotal: 0,
        balance: 0,
      });
    }

    const existing = balanceMap.get(accountId)!;
    existing.debitTotal += Number(line.debit_amount) || 0;
    existing.creditTotal += Number(line.credit_amount) || 0;
  }

  // Calculate net balance for each account
  for (const balance of balanceMap.values()) {
    // For assets: balance = debit - credit (positive = asset increase)
    // For liabilities/equity: balance = credit - debit (positive = liability/equity increase)
    if (balance.accountType === 'asset') {
      balance.balance = balance.debitTotal - balance.creditTotal;
    } else if (balance.accountType === 'liability' || balance.accountType === 'equity') {
      balance.balance = balance.creditTotal - balance.debitTotal;
    } else {
      // Revenue/Expense accounts (Income Statement)
      // These should be closed to equity, but if still open, include in current P&L
      balance.balance = balance.creditTotal - balance.debitTotal;
    }
  }

  return Array.from(balanceMap.values());
}

/**
 * Get current period P&L (Revenue - Expenses)
 */
async function getCurrentPeriodPnL(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const supabase = await createClient();

  // Query revenue and expense accounts for the period
  const { data: lines, error } = await supabase
    .from('journal_entry_lines' as any)
    .select(`
      debit_amount,
      credit_amount,
      accounting_accounts!inner (
        account_type,
        tenant_id
      ),
      journal_entries!inner (
        entry_date,
        status,
        tenant_id
      )
    `)
    .eq('journal_entries.tenant_id', tenantId)
    .eq('journal_entries.status', 'posted')
    .gte('journal_entries.entry_date', startDate)
    .lte('journal_entries.entry_date', endDate)
    .eq('accounting_accounts.tenant_id', tenantId)
    .in('accounting_accounts.account_type', ['revenue', 'expense']);

  if (error) {
    throw new QueryError('Failed to fetch P&L data', error);
  }

  let revenue = 0;
  let expenses = 0;

  for (const line of (lines as any[]) || []) {
    const accountType = line.accounting_accounts.account_type.toLowerCase();
    const debit = Number(line.debit_amount) || 0;
    const credit = Number(line.credit_amount) || 0;

    if (accountType === 'revenue') {
      revenue += credit - debit; // Revenue is credit balance
    } else if (accountType === 'expense') {
      expenses += debit - credit; // Expense is debit balance
    }
  }

  return revenue - expenses; // Net income
}

// ─── Main Query Function ────────────────────────────────────────────────────

/**
 * Get Balance Sheet for a tenant as of a specific date
 * 
 * @param params - Query parameters (tenantId, date, period)
 * @returns Balance Sheet with Assets, Liabilities, and Equity
 */
export async function getBalanceSheet(
  params: BalanceSheetParams
): Promise<BalanceSheet> {
  const { tenantId, date, period } = params;

  try {
    // Determine the as-of date
    let asOfDate: string;
    let periodStr: string;

    if (period) {
      asOfDate = getEndOfPeriod(period);
      periodStr = period;
    } else if (date) {
      asOfDate = date;
      periodStr = date.slice(0, 7); // YYYY-MM
    } else {
      // Default to end of current month
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      periodStr = `${year}-${month}`;
      asOfDate = getEndOfPeriod(periodStr);
    }

    // Get account balances up to the as-of date
    const balances = await getAccountBalances(tenantId, asOfDate);

    // Get current period P&L
    const fiscalYearStart = getStartOfFiscalYear(asOfDate);
    const currentPeriodPnL = await getCurrentPeriodPnL(tenantId, fiscalYearStart, asOfDate);

    // Initialize balance sheet structure
    const currentAssets: CurrentAssets = {
      cash: 0,
      accountsReceivable: 0,
      inventory: 0,
      prepaidExpenses: 0,
      otherCurrentAssets: 0,
      total: 0,
    };

    const nonCurrentAssets: NonCurrentAssets = {
      fixedAssets: 0,
      accumulatedDepreciation: 0,
      netFixedAssets: 0,
      longTermInvestments: 0,
      intangibleAssets: 0,
      otherNonCurrentAssets: 0,
      total: 0,
    };

    const currentLiabilities: CurrentLiabilities = {
      accountsPayable: 0,
      shortTermDebt: 0,
      accruedExpenses: 0,
      unearnedRevenue: 0,
      otherCurrentLiabilities: 0,
      total: 0,
    };

    const longTermLiabilities: LongTermLiabilities = {
      longTermDebt: 0,
      deferredTaxLiabilities: 0,
      otherLongTermLiabilities: 0,
      total: 0,
    };

    const equity: Equity = {
      shareCapital: 0,
      retainedEarnings: 0,
      currentPeriodPnL: currentPeriodPnL,
      otherEquity: 0,
      total: 0,
    };

    // Classify account balances into categories
    for (const balance of balances) {
      const code = balance.accountCode;
      const amount = balance.balance;

      // Skip zero balances
      if (amount === 0) continue;

      // Assets
      if (balance.accountType === 'asset') {
        if (isCurrentAsset(code)) {
          // Current Assets
          if ((ACCOUNT_MAPPING.CASH as readonly string[]).includes(code)) {
            currentAssets.cash += amount;
          } else if ((ACCOUNT_MAPPING.ACCOUNTS_RECEIVABLE as readonly string[]).includes(code)) {
            currentAssets.accountsReceivable += amount;
          } else if ((ACCOUNT_MAPPING.INVENTORY as readonly string[]).includes(code)) {
            currentAssets.inventory += amount;
          } else if ((ACCOUNT_MAPPING.PREPAID_EXPENSES as readonly string[]).includes(code)) {
            currentAssets.prepaidExpenses += amount;
          } else {
            currentAssets.otherCurrentAssets += amount;
          }
        } else if (isNonCurrentAsset(code)) {
          // Non-Current Assets
          if ((ACCOUNT_MAPPING.FIXED_ASSETS as readonly string[]).includes(code)) {
            nonCurrentAssets.fixedAssets += amount;
          } else if ((ACCOUNT_MAPPING.ACCUMULATED_DEPRECIATION as readonly string[]).includes(code)) {
            nonCurrentAssets.accumulatedDepreciation += amount; // This is negative
          } else if ((ACCOUNT_MAPPING.INTANGIBLE_ASSETS as readonly string[]).includes(code)) {
            nonCurrentAssets.intangibleAssets += amount;
          } else {
            nonCurrentAssets.otherNonCurrentAssets += amount;
          }
        }
      }

      // Liabilities
      else if (balance.accountType === 'liability') {
        if (isCurrentLiability(code)) {
          // Current Liabilities
          if ((ACCOUNT_MAPPING.ACCOUNTS_PAYABLE as readonly string[]).includes(code)) {
            currentLiabilities.accountsPayable += amount;
          } else if ((ACCOUNT_MAPPING.SHORT_TERM_DEBT as readonly string[]).includes(code)) {
            currentLiabilities.shortTermDebt += amount;
          } else if ((ACCOUNT_MAPPING.ACCRUED_EXPENSES as readonly string[]).includes(code)) {
            currentLiabilities.accruedExpenses += amount;
          } else if ((ACCOUNT_MAPPING.UNEARNED_REVENUE as readonly string[]).includes(code)) {
            currentLiabilities.unearnedRevenue += amount;
          } else {
            currentLiabilities.otherCurrentLiabilities += amount;
          }
        } else if (isLongTermLiability(code)) {
          // Long-Term Liabilities
          if ((ACCOUNT_MAPPING.LONG_TERM_DEBT as readonly string[]).includes(code)) {
            longTermLiabilities.longTermDebt += amount;
          } else {
            longTermLiabilities.otherLongTermLiabilities += amount;
          }
        }
      }

      // Equity
      else if (balance.accountType === 'equity') {
        const category = getEquityCategory(code);
        if (category === 'capital') {
          equity.shareCapital += amount;
        } else if (category === 'retained') {
          equity.retainedEarnings += amount;
        } else {
          equity.otherEquity += amount;
        }
      }
    }

    // Calculate totals
    currentAssets.total = 
      currentAssets.cash +
      currentAssets.accountsReceivable +
      currentAssets.inventory +
      currentAssets.prepaidExpenses +
      currentAssets.otherCurrentAssets;

    nonCurrentAssets.netFixedAssets = 
      nonCurrentAssets.fixedAssets + 
      nonCurrentAssets.accumulatedDepreciation; // Accumulated depreciation is negative

    nonCurrentAssets.total = 
      nonCurrentAssets.netFixedAssets +
      nonCurrentAssets.longTermInvestments +
      nonCurrentAssets.intangibleAssets +
      nonCurrentAssets.otherNonCurrentAssets;

    currentLiabilities.total = 
      currentLiabilities.accountsPayable +
      currentLiabilities.shortTermDebt +
      currentLiabilities.accruedExpenses +
      currentLiabilities.unearnedRevenue +
      currentLiabilities.otherCurrentLiabilities;

    longTermLiabilities.total = 
      longTermLiabilities.longTermDebt +
      longTermLiabilities.deferredTaxLiabilities +
      longTermLiabilities.otherLongTermLiabilities;

    equity.total = 
      equity.shareCapital +
      equity.retainedEarnings +
      equity.currentPeriodPnL +
      equity.otherEquity;

    const assets: Assets = {
      current: currentAssets,
      nonCurrent: nonCurrentAssets,
      total: currentAssets.total + nonCurrentAssets.total,
    };

    const liabilities: Liabilities = {
      current: currentLiabilities,
      longTerm: longTermLiabilities,
      total: currentLiabilities.total + longTermLiabilities.total,
    };

    // Validate balance sheet equation
    const balanceDifference = assets.total - (liabilities.total + equity.total);
    const isBalanced = Math.abs(balanceDifference) < 0.01; // Allow 1 cent rounding error

    return {
      tenantId,
      date: asOfDate,
      period: periodStr,
      assets,
      liabilities,
      equity,
      isBalanced,
      balanceDifference,
    };

  } catch (error) {
    if (error instanceof QueryError) throw error;
    const errorObj = error instanceof Error ? error : new Error(String(error));
    throw new QueryError('Unexpected error in getBalanceSheet', errorObj);
  }
}

/**
 * Get Balance Sheet for multiple periods (for trend analysis)
 * 
 * @param tenantId - Tenant UUID
 * @param periods - Array of periods (YYYY-MM)
 * @returns Array of Balance Sheets
 */
export async function getBalanceSheetTrend(
  tenantId: string,
  periods: string[]
): Promise<BalanceSheet[]> {
  const results: BalanceSheet[] = [];

  for (const period of periods) {
    const balanceSheet = await getBalanceSheet({ tenantId, period });
    results.push(balanceSheet);
  }

  return results;
}
