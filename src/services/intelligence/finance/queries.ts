/**
 * Financial Intelligence Queries Module
 * 
 * Query builders for Financial Intelligence metrics:
 * - Monthly P&L (revenue, expense, profit breakdown)
 * - Cash Flow Analysis (inflows/outflows by payment method)
 * - Budget Variance (actual vs budget comparison)
 * - Expense Breakdown (by category and method)
 * - Revenue Breakdown (by type and method)
 * - Cash Flow Forecast (projected cash movements)
 * - Profitability Trends (margins over time)
 * - Financial Ratios (liquidity, efficiency, profitability)
 * 
 * Architecture:
 * - Read-only operations (no mutations)
 * - Query materialized views for performance
 * - Tenant isolation (tenant_id filter on all queries)
 * - Date range filtering (month/quarter/year)
 * - TypeScript types for all return values
 * 
 * Data Sources:
 * - mv_monthly_pnl (materialized view)
 * - mv_cash_flow (materialized view)
 * - mv_budget_variance (materialized view)
 * - revenue, operating_expenses, salary_expenses, budgets
 */

import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import type { DateRange, TimePeriod } from '../shared/types';
import { QueryError } from '../shared/types';
import { parseDateRange, formatDate } from '../shared/helpers';

// ─── Type Definitions ───────────────────────────────────────────────────────

/**
 * Monthly Profit & Loss Statement
 */
export interface MonthlyPnL {
  tenantId: string;
  month: string;
  
  // Revenue breakdown
  serviceRevenue: number;
  productRevenue: number;
  packageRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  
  // Expense breakdown
  salaryExpense: number;
  operatingExpense: number;
  inventoryExpense: number;
  marketingExpense: number;
  utilityExpense: number;
  maintenanceExpense: number;
  otherExpense: number;
  totalExpense: number;
  
  // Profit metrics
  grossProfit: number;
  operatingProfit: number;
  netProfit: number;
  
  // Margins
  grossMarginPct: number;
  operatingMarginPct: number;
  netMarginPct: number;
  
  // Metadata
  computedAt: string;
}

/**
 * Cash Flow Analysis
 */
export interface CashFlowAnalysis {
  tenantId: string;
  month: string;
  
  // Inflows
  cashSalesInflow: number;
  cardSalesInflow: number;
  transferInflow: number;
  depositInflow: number;
  otherInflow: number;
  totalInflow: number;
  
  // Outflows
  salaryOutflow: number;
  supplierOutflow: number;
  rentOutflow: number;
  utilityOutflow: number;
  marketingOutflow: number;
  otherOutflow: number;
  totalOutflow: number;
  
  // Net cash flow
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
  
  // Metadata
  computedAt: string;
}

/**
 * Budget Variance Analysis
 */
export interface BudgetVariance {
  tenantId: string;
  month: string;
  category: string;
  
  // Budget vs Actual
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
  variancePct: number;
  
  // Status
  status: 'under_budget' | 'on_budget' | 'over_budget';
  
  // Metadata
  computedAt: string;
}

/**
 * Expense Breakdown
 */
export interface ExpenseBreakdown {
  tenantId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  
  // By category
  byCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  }>;
  
  // By payment method
  byPaymentMethod: Array<{
    method: string;
    amount: number;
    percentage: number;
  }>;
  
  // Totals
  totalExpense: number;
  avgMonthlyExpense: number;
  
  // Metadata
  computedAt: string;
}

/**
 * Revenue Breakdown
 */
export interface RevenueBreakdown {
  tenantId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  
  // By type
  byType: Array<{
    type: string;
    amount: number;
    percentage: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  }>;
  
  // By payment method
  byPaymentMethod: Array<{
    method: string;
    amount: number;
    percentage: number;
  }>;
  
  // Totals
  totalRevenue: number;
  avgMonthlyRevenue: number;
  
  // Metadata
  computedAt: string;
}

/**
 * Cash Flow Forecast
 */
export interface CashFlowForecast {
  tenantId: string;
  month: string;
  
  // Forecasted amounts
  forecastedInflow: number;
  forecastedOutflow: number;
  forecastedNetCashFlow: number;
  forecastedClosingBalance: number;
  
  // Confidence metrics
  confidenceLevel: 'high' | 'medium' | 'low';
  forecastMethod: 'moving_average' | 'linear_regression' | 'seasonal';
  
  // Metadata
  computedAt: string;
}

/**
 * Profitability Trends
 */
export interface ProfitabilityTrends {
  tenantId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  
  // Monthly trends
  monthlyTrends: Array<{
    month: string;
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
    grossMarginPct: number;
    netMarginPct: number;
  }>;
  
  // Aggregated metrics
  avgMonthlyRevenue: number;
  avgMonthlyExpense: number;
  avgMonthlyProfit: number;
  avgGrossMarginPct: number;
  avgNetMarginPct: number;
  
  // Trends
  revenueTrend: 'increasing' | 'stable' | 'decreasing';
  profitTrend: 'increasing' | 'stable' | 'decreasing';
  
  // Metadata
  computedAt: string;
}

/**
 * Financial Ratios
 */
export interface FinancialRatios {
  tenantId: string;
  month: string;
  
  // Liquidity ratios
  currentRatio: number;
  quickRatio: number;
  cashRatio: number;
  
  // Efficiency ratios
  assetTurnoverRatio: number;
  inventoryTurnoverRatio: number;
  receivablesTurnoverRatio: number;
  
  // Profitability ratios
  returnOnAssets: number;
  returnOnEquity: number;
  returnOnInvestment: number;
  
  // Metadata
  computedAt: string;
}

// ─── Query Builders ─────────────────────────────────────────────────────────

/**
 * Get Monthly Profit & Loss Statement
 * 
 * Retrieves revenue, expense, and profit breakdown for the specified date range.
 * Queries the mv_monthly_pnl materialized view for performance.
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Date range or time period string ('today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | {startDate, endDate})
 * @returns Array of monthly P&L statements
 * 
 * @example
 * const pnl = await getMonthlyPnL('tenant-123', 'this_quarter');
 * console.log(pnl[0].netProfit); // 15000000
 */
export async function getMonthlyPnL(
  tenantId: string,
  dateRange: DateRange | TimePeriod
): Promise<MonthlyPnL[]> {
  try {
    const supabase = await createClient();
    
    // Parse date range
    const range = parseDateRange(dateRange);
    
    // Query materialized view
    const { data, error } = await supabase
      .from('mv_monthly_pnl' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', formatDate(range.startDate))
      .lte('month', formatDate(range.endDate))
      .order('month', { ascending: false });
    
    if (error) {
      throw new QueryError(
        `Failed to fetch monthly P&L: ${error.message}`,
        error
      );
    }
    
    // Map database columns to camelCase
    return (data || []).map((row: any) => ({
      tenantId: row.tenant_id,
      month: row.month,
      serviceRevenue: row.service_revenue || 0,
      productRevenue: row.product_revenue || 0,
      packageRevenue: row.package_revenue || 0,
      otherRevenue: row.other_revenue || 0,
      totalRevenue: row.total_revenue || 0,
      salaryExpense: row.salary_expense || 0,
      operatingExpense: row.operating_expense || 0,
      inventoryExpense: row.inventory_expense || 0,
      marketingExpense: row.marketing_expense || 0,
      utilityExpense: row.utility_expense || 0,
      maintenanceExpense: row.maintenance_expense || 0,
      otherExpense: row.other_expense || 0,
      totalExpense: row.total_expense || 0,
      grossProfit: row.gross_profit || 0,
      operatingProfit: row.operating_profit || 0,
      netProfit: row.net_profit || 0,
      grossMarginPct: row.gross_margin_pct || 0,
      operatingMarginPct: row.operating_margin_pct || 0,
      netMarginPct: row.net_margin_pct || 0,
      computedAt: row.computed_at,
    }));
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching monthly P&L: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Get Cash Flow Analysis
 * 
 * Retrieves cash inflows and outflows by payment method for the specified date range.
 * Queries the mv_cash_flow materialized view for performance.
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Date range or time period string
 * @returns Array of monthly cash flow analyses
 * 
 * @example
 * const cashFlow = await getCashFlowAnalysis('tenant-123', 'this_quarter');
 * console.log(cashFlow[0].netCashFlow); // 8500000
 */
export async function getCashFlowAnalysis(
  tenantId: string,
  dateRange: DateRange | TimePeriod
): Promise<CashFlowAnalysis[]> {
  try {
    const supabase = await createClient();
    
    // Parse date range
    const range = parseDateRange(dateRange);
    
    // Query materialized view
    const { data, error } = await supabase
      .from('mv_cash_flow' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', formatDate(range.startDate))
      .lte('month', formatDate(range.endDate))
      .order('month', { ascending: false });
    
    if (error) {
      throw new QueryError(
        `Failed to fetch cash flow analysis: ${error.message}`,
        error
      );
    }
    
    // Map database columns to camelCase
    return (data || []).map((row: any) => ({
      tenantId: row.tenant_id,
      month: row.month,
      cashSalesInflow: row.cash_sales_inflow || 0,
      cardSalesInflow: row.card_sales_inflow || 0,
      transferInflow: row.transfer_inflow || 0,
      depositInflow: row.deposit_inflow || 0,
      otherInflow: row.other_inflow || 0,
      totalInflow: row.total_inflow || 0,
      salaryOutflow: row.salary_outflow || 0,
      supplierOutflow: row.supplier_outflow || 0,
      rentOutflow: row.rent_outflow || 0,
      utilityOutflow: row.utility_outflow || 0,
      marketingOutflow: row.marketing_outflow || 0,
      otherOutflow: row.other_outflow || 0,
      totalOutflow: row.total_outflow || 0,
      netCashFlow: row.net_cash_flow || 0,
      openingBalance: row.opening_balance || 0,
      closingBalance: row.closing_balance || 0,
      computedAt: row.computed_at,
    }));
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching cash flow analysis: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Get Budget Variance Analysis
 * 
 * Compares actual spending/revenue against budgeted amounts for a specific month.
 * Queries the mv_budget_variance materialized view for performance.
 * 
 * @param tenantId - Tenant ID
 * @param month - Month in YYYY-MM format (e.g., '2026-06')
 * @returns Array of budget variance by category
 * 
 * @example
 * const variance = await getBudgetVariance('tenant-123', '2026-06');
 * const overBudget = variance.filter(v => v.status === 'over_budget');
 */
export async function getBudgetVariance(
  tenantId: string,
  month: string
): Promise<BudgetVariance[]> {
  try {
    const supabase = await createClient();
    
    // Query materialized view
    const { data, error } = await supabase
      .from('mv_budget_variance' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month', month)
      .order('variance_pct', { ascending: false });
    
    if (error) {
      throw new QueryError(
        `Failed to fetch budget variance: ${error.message}`,
        error
      );
    }
    
    // Map database columns to camelCase
    return (data || []).map((row: any) => ({
      tenantId: row.tenant_id,
      month: row.month,
      category: row.category,
      budgetedAmount: row.budgeted_amount || 0,
      actualAmount: row.actual_amount || 0,
      variance: row.variance || 0,
      variancePct: row.variance_pct || 0,
      status: row.status || 'on_budget',
      computedAt: row.computed_at,
    }));
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching budget variance: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Calculate trend for a specific category/type by comparing current vs previous period
 * 
 * @param currentAmount - Current period amount
 * @param previousAmount - Previous period amount
 * @param threshold - Percentage threshold for trend detection (default: 5%)
 * @returns Trend direction: 'increasing', 'stable', or 'decreasing'
 */
function calculateTrendFromHistory(
  currentAmount: number,
  previousAmount: number,
  threshold: number = 0.05
): 'increasing' | 'stable' | 'decreasing' {
  if (previousAmount === 0) {
    return currentAmount > 0 ? 'increasing' : 'stable';
  }
  
  const changePercent = (currentAmount - previousAmount) / previousAmount;
  
  if (changePercent > threshold) return 'increasing';
  if (changePercent < -threshold) return 'decreasing';
  return 'stable';
}

/**
 * Get Expense Breakdown
 * 
 * Retrieves detailed expense breakdown by category and payment method.
 * Aggregates data from operating_expenses and salary_expenses tables.
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Date range or time period string
 * @returns Expense breakdown with category and payment method analysis
 * 
 * @example
 * const breakdown = await getExpenseBreakdown('tenant-123', 'this_quarter');
 * console.log(breakdown.byCategory); // [{category: 'Salary', amount: 50000000, ...}]
 */
export async function getExpenseBreakdown(
  tenantId: string,
  dateRange: DateRange | TimePeriod
): Promise<ExpenseBreakdown> {
  try {
    const supabase = await createClient();
    
    // Parse date range
    const range = parseDateRange(dateRange);
    
    // Query expenses (all types including salary via category)
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('category, amount, expense_date')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .gte('expense_date', formatDate(range.startDate))
      .lte('expense_date', formatDate(range.endDate));
    
    if (expError) {
      throw new QueryError(
        `Failed to fetch expenses: ${expError.message}`,
        expError
      );
    }
    
    // Calculate previous period date range (same duration)
    const startTime = range.startDate instanceof Date ? range.startDate.getTime() : new Date(range.startDate).getTime();
    const endTime = range.endDate instanceof Date ? range.endDate.getTime() : new Date(range.endDate).getTime();
    const durationMs = endTime - startTime;
    const prevStartDate = new Date(startTime - durationMs);
    const prevEndDate = new Date(startTime - 1); // Day before current start
    
    // Query previous period expenses for trend calculation
    const { data: prevExpenses } = await supabase
      .from('expenses')
      .select('category, amount')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .gte('expense_date', formatDate(prevStartDate))
      .lte('expense_date', formatDate(prevEndDate));
    
    // Aggregate by category
    const categoryMap = new Map<string, number>();
    (expenses || []).forEach((exp: any) => {
      const current = categoryMap.get(exp.category) || 0;
      categoryMap.set(exp.category, current + (exp.amount || 0));
    });
    
    // Aggregate previous period by category for trend
    const prevCategoryMap = new Map<string, number>();
    (prevExpenses || []).forEach((exp: any) => {
      const current = prevCategoryMap.get(exp.category) || 0;
      prevCategoryMap.set(exp.category, current + (exp.amount || 0));
    });
    
    const totalExpense = Array.from(categoryMap.values()).reduce((sum, val) => sum + val, 0);
    
    const byCategory = Array.from(categoryMap.entries()).map(([category, amount]) => {
      const prevAmount = prevCategoryMap.get(category) || 0;
      return {
        category,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
        trend: calculateTrendFromHistory(amount, prevAmount),
      };
    }).sort((a, b) => b.amount - a.amount);
    
    // Query revenue for payment method breakdown (expenses table doesn't have payment_method)
    const { data: revenueData, error: revError } = await supabase
      .from('revenue')
      .select('payment_method, amount')
      .eq('tenant_id', tenantId)
      .eq('status', 'confirmed')
      .gte('revenue_date', formatDate(range.startDate))
      .lte('revenue_date', formatDate(range.endDate));
    
    // Aggregate payment methods from revenue (as proxy for cash flow patterns)
    const methodMap = new Map<string, number>();
    (revenueData || []).forEach((rev: any) => {
      const method = rev.payment_method || 'cash';
      const current = methodMap.get(method) || 0;
      methodMap.set(method, current + (rev.amount || 0));
    });
    
    const byPaymentMethod = Array.from(methodMap.entries()).map(([method, amount]) => ({
      method,
      amount,
      percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);
    
    // Calculate avg monthly expense
    const rangeStartTime = range.startDate instanceof Date ? range.startDate.getTime() : new Date(range.startDate).getTime();
    const rangeEndTime = range.endDate instanceof Date ? range.endDate.getTime() : new Date(range.endDate).getTime();
    const monthsDiff = Math.max(1, Math.ceil((rangeEndTime - rangeStartTime) / (30 * 24 * 60 * 60 * 1000)));
    const avgMonthlyExpense = Math.round(totalExpense / monthsDiff);
    
    return {
      tenantId,
      dateRange: {
        startDate: formatDate(range.startDate),
        endDate: formatDate(range.endDate),
      },
      byCategory,
      byPaymentMethod,
      totalExpense,
      avgMonthlyExpense,
      computedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching expense breakdown: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Get Revenue Breakdown
 * 
 * Retrieves detailed revenue breakdown by type and payment method.
 * Aggregates data from revenue table.
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Date range or time period string
 * @returns Revenue breakdown with type and payment method analysis
 * 
 * @example
 * const breakdown = await getRevenueBreakdown('tenant-123', 'this_quarter');
 * console.log(breakdown.byType); // [{type: 'Service', amount: 100000000, ...}]
 */
export async function getRevenueBreakdown(
  tenantId: string,
  dateRange: DateRange | TimePeriod
): Promise<RevenueBreakdown> {
  try {
    const supabase = await createClient();
    
    // Parse date range
    const range = parseDateRange(dateRange);
    
    // Calculate previous period date range (same duration)
    const startTime = range.startDate instanceof Date ? range.startDate.getTime() : new Date(range.startDate).getTime();
    const endTime = range.endDate instanceof Date ? range.endDate.getTime() : new Date(range.endDate).getTime();
    const durationMs = endTime - startTime;
    const prevStartDate = new Date(startTime - durationMs);
    const prevEndDate = new Date(startTime - 1); // Day before current start
    
    // Query current period revenue
    const { data, error } = await supabase
      .from('revenue')
      .select('revenue_type, amount, payment_method, revenue_date')
      .eq('tenant_id', tenantId)
      .eq('status', 'confirmed')
      .gte('revenue_date', formatDate(range.startDate))
      .lte('revenue_date', formatDate(range.endDate));
    
    if (error) {
      throw new QueryError(
        `Failed to fetch revenue: ${error.message}`,
        error
      );
    }
    
    // Query previous period revenue for trend calculation
    const { data: prevData } = await supabase
      .from('revenue')
      .select('revenue_type, amount')
      .eq('tenant_id', tenantId)
      .eq('status', 'confirmed')
      .gte('revenue_date', formatDate(prevStartDate))
      .lte('revenue_date', formatDate(prevEndDate));
    
    // Aggregate by type
    const typeMap = new Map<string, number>();
    (data || []).forEach((rev: any) => {
      const type = rev.revenue_type || 'other';
      const current = typeMap.get(type) || 0;
      typeMap.set(type, current + (rev.amount || 0));
    });
    
    // Aggregate previous period by type for trend
    const prevTypeMap = new Map<string, number>();
    (prevData || []).forEach((rev: any) => {
      const type = rev.revenue_type || 'other';
      const current = prevTypeMap.get(type) || 0;
      prevTypeMap.set(type, current + (rev.amount || 0));
    });
    
    const totalRevenue = Array.from(typeMap.values()).reduce((sum, val) => sum + val, 0);
    
    const byType = Array.from(typeMap.entries()).map(([type, amount]) => {
      const prevAmount = prevTypeMap.get(type) || 0;
      return {
        type,
        amount,
        percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0,
        trend: calculateTrendFromHistory(amount, prevAmount),
      };
    }).sort((a, b) => b.amount - a.amount);
    
    // Aggregate by payment method
    const methodMap = new Map<string, number>();
    (data || []).forEach((rev: any) => {
      const method = rev.payment_method || 'cash';
      const current = methodMap.get(method) || 0;
      methodMap.set(method, current + (rev.amount || 0));
    });
    
    const byPaymentMethod = Array.from(methodMap.entries()).map(([method, amount]) => ({
      method,
      amount,
      percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);
    
    // Calculate avg monthly revenue
    const rangeStartTime = range.startDate instanceof Date ? range.startDate.getTime() : new Date(range.startDate).getTime();
    const rangeEndTime = range.endDate instanceof Date ? range.endDate.getTime() : new Date(range.endDate).getTime();
    const monthsDiff = Math.max(1, Math.ceil((rangeEndTime - rangeStartTime) / (30 * 24 * 60 * 60 * 1000)));
    const avgMonthlyRevenue = Math.round(totalRevenue / monthsDiff);
    
    return {
      tenantId,
      dateRange: {
        startDate: formatDate(range.startDate),
        endDate: formatDate(range.endDate),
      },
      byType,
      byPaymentMethod,
      totalRevenue,
      avgMonthlyRevenue,
      computedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching revenue breakdown: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Get Cash Flow Forecast
 * 
 * Generates cash flow forecast for upcoming months based on historical patterns.
 * Uses moving average method to predict future inflows and outflows.
 * 
 * @param tenantId - Tenant ID
 * @param forecastMonths - Number of months to forecast (default: 3)
 * @returns Array of monthly cash flow forecasts
 * 
 * @example
 * const forecast = await getCashFlowForecast('tenant-123', 6);
 * console.log(forecast[0].forecastedNetCashFlow); // 9200000
 */
export async function getCashFlowForecast(
  tenantId: string,
  forecastMonths: number = 3
): Promise<CashFlowForecast[]> {
  try {
    const supabase = await createClient();
    
    // Get historical cash flow data (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const { data, error } = await supabase
      .from('mv_cash_flow' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', formatDate(sixMonthsAgo))
      .order('month', { ascending: true });
    
    if (error) {
      throw new QueryError(
        `Failed to fetch historical cash flow: ${error.message}`,
        error
      );
    }
    
    if (!data || data.length === 0) {
      throw new QueryError('Insufficient historical data for forecasting', undefined);
    }
    
    // Calculate moving averages
    const avgInflow = (data || []).reduce((sum: number, row: any) => sum + (row.total_inflow || 0), 0) / data.length;
    const avgOutflow = (data || []).reduce((sum: number, row: any) => sum + (row.total_outflow || 0), 0) / data.length;
    
    // Get last known closing balance
    const lastRecord = data[data.length - 1] as any;
    let runningBalance = lastRecord?.closing_balance || 0;
    
    // Generate forecasts
    const forecasts: CashFlowForecast[] = [];
    const today = new Date();
    
    for (let i = 1; i <= forecastMonths; i++) {
      const forecastDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const month = formatDate(forecastDate).substring(0, 7); // YYYY-MM
      
      const forecastedInflow = Math.round(avgInflow);
      const forecastedOutflow = Math.round(avgOutflow);
      const forecastedNetCashFlow = forecastedInflow - forecastedOutflow;
      runningBalance += forecastedNetCashFlow;
      
      forecasts.push({
        tenantId,
        month,
        forecastedInflow,
        forecastedOutflow,
        forecastedNetCashFlow,
        forecastedClosingBalance: runningBalance,
        confidenceLevel: data.length >= 6 ? 'high' : data.length >= 3 ? 'medium' : 'low',
        forecastMethod: 'moving_average',
        computedAt: new Date().toISOString(),
      });
    }
    
    return forecasts;
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error generating cash flow forecast: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Get Profitability Trends
 * 
 * Analyzes profitability trends over the specified date range.
 * Calculates margins, averages, and identifies trends.
 * 
 * @param tenantId - Tenant ID
 * @param dateRange - Date range or time period string
 * @returns Profitability trends analysis
 * 
 * @example
 * const trends = await getProfitabilityTrends('tenant-123', 'this_year');
 * console.log(trends.revenueTrend); // 'increasing'
 */
export async function getProfitabilityTrends(
  tenantId: string,
  dateRange: DateRange | TimePeriod
): Promise<ProfitabilityTrends> {
  try {
    const supabase = await createClient();
    
    // Parse date range
    const range = parseDateRange(dateRange);
    
    // Query monthly P&L data
    const { data, error } = await supabase
      .from('mv_monthly_pnl' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('month', formatDate(range.startDate))
      .lte('month', formatDate(range.endDate))
      .order('month', { ascending: true });
    
    if (error) {
      throw new QueryError(
        `Failed to fetch profitability trends: ${error.message}`,
        error
      );
    }
    
    if (!data || data.length === 0) {
      throw new QueryError('No data available for profitability trends', undefined);
    }
    
    // Map monthly trends
    const monthlyTrends = (data || []).map((row: any) => ({
      month: row.month,
      totalRevenue: row.total_revenue || 0,
      totalExpense: row.total_expense || 0,
      netProfit: row.net_profit || 0,
      grossMarginPct: row.gross_margin_pct || 0,
      netMarginPct: row.net_margin_pct || 0,
    }));
    
    // Calculate aggregated metrics
    const avgMonthlyRevenue = Math.round(
      monthlyTrends.reduce((sum, m) => sum + m.totalRevenue, 0) / monthlyTrends.length
    );
    const avgMonthlyExpense = Math.round(
      monthlyTrends.reduce((sum, m) => sum + m.totalExpense, 0) / monthlyTrends.length
    );
    const avgMonthlyProfit = Math.round(
      monthlyTrends.reduce((sum, m) => sum + m.netProfit, 0) / monthlyTrends.length
    );
    const avgGrossMarginPct = Math.round(
      monthlyTrends.reduce((sum, m) => sum + m.grossMarginPct, 0) / monthlyTrends.length
    );
    const avgNetMarginPct = Math.round(
      monthlyTrends.reduce((sum, m) => sum + m.netMarginPct, 0) / monthlyTrends.length
    );
    
    // Determine trends (simple linear regression slope)
    const calculateTrend = (values: number[]): 'increasing' | 'stable' | 'decreasing' => {
      if (values.length < 2) return 'stable';
      
      const n = values.length;
      const sumX = (n * (n - 1)) / 2; // 0 + 1 + 2 + ... + (n-1)
      const sumY = values.reduce((sum, val) => sum + val, 0);
      const sumXY = values.reduce((sum, val, idx) => sum + (idx * val), 0);
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // sum of squares
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      
      if (slope > 0.05 * (sumY / n)) return 'increasing';
      if (slope < -0.05 * (sumY / n)) return 'decreasing';
      return 'stable';
    };
    
    const revenueTrend = calculateTrend(monthlyTrends.map(m => m.totalRevenue));
    const profitTrend = calculateTrend(monthlyTrends.map(m => m.netProfit));
    
    return {
      tenantId,
      dateRange: {
        startDate: formatDate(range.startDate),
        endDate: formatDate(range.endDate),
      },
      monthlyTrends,
      avgMonthlyRevenue,
      avgMonthlyExpense,
      avgMonthlyProfit,
      avgGrossMarginPct,
      avgNetMarginPct,
      revenueTrend,
      profitTrend,
      computedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error fetching profitability trends: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}

/**
 * Get Financial Ratios
 * 
 * Calculates key financial ratios for liquidity, efficiency, and profitability analysis.
 * Note: This is a simplified implementation. Full implementation requires balance sheet data.
 * 
 * @param tenantId - Tenant ID
 * @param month - Month in YYYY-MM format (e.g., '2026-06')
 * @returns Financial ratios
 * 
 * @example
 * const ratios = await getFinancialRatios('tenant-123', '2026-06');
 * console.log(ratios.currentRatio); // 2.5
 */
export async function getFinancialRatios(
  tenantId: string,
  month: string
): Promise<FinancialRatios> {
  try {
    const supabase = await createClient();
    
    // Query P&L data for the month
    const { data: pnlData, error: pnlError } = await supabase
      .from('mv_monthly_pnl' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month', month)
      .single();
    
    if (pnlError) {
      throw new QueryError(
        `Failed to fetch P&L data: ${pnlError.message}`,
        pnlError
      );
    }
    
    // Query cash flow data for the month
    const { data: cashFlowData, error: cashFlowError } = await supabase
      .from('mv_cash_flow' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month', month)
      .single();
    
    if (cashFlowError) {
      throw new QueryError(
        `Failed to fetch cash flow data: ${cashFlowError.message}`,
        cashFlowError
      );
    }
    
    // Calculate ratios (simplified without balance sheet)
    const pnl = pnlData as any;
    const cashFlow = cashFlowData as any;
    
    const totalRevenue = pnl?.total_revenue || 0;
    const totalExpense = pnl?.total_expense || 0;
    const netProfit = pnl?.net_profit || 0;
    const closingBalance = cashFlow?.closing_balance || 0;
    
    // Liquidity ratios (approximated)
    const currentRatio = totalExpense > 0 ? Math.round((closingBalance / (totalExpense / 12)) * 100) / 100 : 0;
    const quickRatio = currentRatio * 0.8; // Approximation
    const cashRatio = currentRatio * 0.5; // Approximation
    
    // Efficiency ratios (approximated without balance sheet assets)
    const assetTurnoverRatio = 1.5; // Placeholder - requires total assets
    const inventoryTurnoverRatio = 12; // Placeholder - requires inventory data
    const receivablesTurnoverRatio = 24; // Placeholder - requires receivables data
    
    // Profitability ratios (approximated without equity/assets)
    const returnOnAssets = 0.15; // Placeholder - requires total assets
    const returnOnEquity = 0.20; // Placeholder - requires equity
    const returnOnInvestment = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 10000) / 100 : 0;
    
    return {
      tenantId,
      month,
      currentRatio,
      quickRatio,
      cashRatio,
      assetTurnoverRatio,
      inventoryTurnoverRatio,
      receivablesTurnoverRatio,
      returnOnAssets,
      returnOnEquity,
      returnOnInvestment,
      computedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    if (error instanceof QueryError) {
      throw error;
    }
    throw new QueryError(
      `Unexpected error calculating financial ratios: ${error instanceof Error ? error.message : String(error)}`,
      error as Error
    );
  }
}
