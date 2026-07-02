/**
 * Finance Intelligence API Hooks
 * Phase 8 Task #4: Dashboard Integration
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export interface FinanceIntelligenceResponse<T = any> {
  success: boolean;
  data: T;
  metadata: {
    cached: boolean;
    execution_time_ms: number;
    period?: string;
    tenant_id?: string;
  };
}

export interface MonthlyPnLData {
  month: string;
  total_revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  operating_profit: number;
  net_profit: number;
  profit_margin_pct: number;
}

export interface CashFlowData {
  month: string;
  operating_cash_flow: number;
  investing_cash_flow: number;
  financing_cash_flow: number;
  net_cash_flow: number;
  cash_balance: number;
}

export interface BudgetVarianceData {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  variance_pct: number;
}

export interface ExpenseBreakdownData {
  category: string;
  amount: number;
  percentage: number;
}

export interface RevenueBreakdownData {
  source: string;
  amount: number;
  percentage: number;
}

export interface FinancialRatiosData {
  current_ratio: number;
  quick_ratio: number;
  debt_to_equity: number;
  return_on_assets: number;
  return_on_equity: number;
  gross_margin: number;
  operating_margin: number;
  net_margin: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchMonthlyPnL(tenantId: string, month: string): Promise<FinanceIntelligenceResponse<MonthlyPnLData[]>> {
  const params = new URLSearchParams({ tenant_id: tenantId, month });
  const response = await fetch(`/api/intelligence/finance/monthly-pnl?${params}`);
  
  if (!response.ok) {
    throw new Error(`Monthly P&L failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchCashFlowAnalysis(tenantId: string, month: string): Promise<FinanceIntelligenceResponse<CashFlowData[]>> {
  const params = new URLSearchParams({ tenant_id: tenantId, month });
  const response = await fetch(`/api/intelligence/finance/cash-flow-analysis?${params}`);
  
  if (!response.ok) {
    throw new Error(`Cash flow analysis failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchBudgetVariance(tenantId: string, month: string): Promise<FinanceIntelligenceResponse<BudgetVarianceData[]>> {
  const params = new URLSearchParams({ tenant_id: tenantId, month });
  const response = await fetch(`/api/intelligence/finance/budget-variance?${params}`);
  
  if (!response.ok) {
    throw new Error(`Budget variance failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchExpenseBreakdown(tenantId: string, month: string): Promise<FinanceIntelligenceResponse<ExpenseBreakdownData[]>> {
  const params = new URLSearchParams({ tenant_id: tenantId, month });
  const response = await fetch(`/api/intelligence/finance/expense-breakdown?${params}`);
  
  if (!response.ok) {
    throw new Error(`Expense breakdown failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchRevenueBreakdown(tenantId: string, month: string): Promise<FinanceIntelligenceResponse<RevenueBreakdownData[]>> {
  const params = new URLSearchParams({ tenant_id: tenantId, month });
  const response = await fetch(`/api/intelligence/finance/revenue-breakdown?${params}`);
  
  if (!response.ok) {
    throw new Error(`Revenue breakdown failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchFinancialRatios(tenantId: string, month: string): Promise<FinanceIntelligenceResponse<FinancialRatiosData>> {
  const params = new URLSearchParams({ tenant_id: tenantId, month });
  const response = await fetch(`/api/intelligence/finance/financial-ratios?${params}`);
  
  if (!response.ok) {
    throw new Error(`Financial ratios failed: ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Hook for monthly P&L data
 * 
 * @example
 * const { data, isLoading, error } = useMonthlyPnL({
 *   tenantId: 'tenant-123',
 *   month: '2026-06'
 * });
 */
export function useMonthlyPnL(
  tenantId: string,
  month: string,
  queryOptions?: Omit<UseQueryOptions<FinanceIntelligenceResponse<MonthlyPnLData[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['finance', 'monthly-pnl', tenantId, month],
    queryFn: () => fetchMonthlyPnL(tenantId, month),
    staleTime: 1 * 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook for cash flow analysis
 * 
 * @example
 * const { data, isLoading, error } = useCashFlowAnalysis({
 *   tenantId: 'tenant-123',
 *   month: '2026-06'
 * });
 */
export function useCashFlowAnalysis(
  tenantId: string,
  month: string,
  queryOptions?: Omit<UseQueryOptions<FinanceIntelligenceResponse<CashFlowData[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['finance', 'cash-flow', tenantId, month],
    queryFn: () => fetchCashFlowAnalysis(tenantId, month),
    staleTime: 1 * 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook for budget variance
 * 
 * @example
 * const { data, isLoading, error } = useBudgetVariance({
 *   tenantId: 'tenant-123',
 *   month: '2026-06'
 * });
 */
export function useBudgetVariance(
  tenantId: string,
  month: string,
  queryOptions?: Omit<UseQueryOptions<FinanceIntelligenceResponse<BudgetVarianceData[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['finance', 'budget-variance', tenantId, month],
    queryFn: () => fetchBudgetVariance(tenantId, month),
    staleTime: 1 * 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook for expense breakdown
 * 
 * @example
 * const { data, isLoading, error } = useExpenseBreakdown({
 *   tenantId: 'tenant-123',
 *   month: '2026-06'
 * });
 */
export function useExpenseBreakdown(
  tenantId: string,
  month: string,
  queryOptions?: Omit<UseQueryOptions<FinanceIntelligenceResponse<ExpenseBreakdownData[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['finance', 'expense-breakdown', tenantId, month],
    queryFn: () => fetchExpenseBreakdown(tenantId, month),
    staleTime: 1 * 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook for revenue breakdown
 * 
 * @example
 * const { data, isLoading, error } = useRevenueBreakdown({
 *   tenantId: 'tenant-123',
 *   month: '2026-06'
 * });
 */
export function useRevenueBreakdown(
  tenantId: string,
  month: string,
  queryOptions?: Omit<UseQueryOptions<FinanceIntelligenceResponse<RevenueBreakdownData[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['finance', 'revenue-breakdown', tenantId, month],
    queryFn: () => fetchRevenueBreakdown(tenantId, month),
    staleTime: 1 * 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook for financial ratios
 * 
 * @example
 * const { data, isLoading, error } = useFinancialRatios({
 *   tenantId: 'tenant-123',
 *   month: '2026-06'
 * });
 */
export function useFinancialRatios(
  tenantId: string,
  month: string,
  queryOptions?: Omit<UseQueryOptions<FinanceIntelligenceResponse<FinancialRatiosData>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['finance', 'financial-ratios', tenantId, month],
    queryFn: () => fetchFinancialRatios(tenantId, month),
    staleTime: 1 * 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    ...queryOptions
  });
}

/**
 * Hook to fetch all finance data in parallel (for dashboard overview)
 * 
 * @example
 * const financeData = useAllFinanceData('tenant-123', '2026-06');
 * 
 * if (financeData.isLoading) return <Loading />;
 * 
 * const { pnl, cashFlow, budgetVariance, expenses, revenue, ratios } = financeData;
 */
export function useAllFinanceData(tenantId: string, month: string) {
  const pnl = useMonthlyPnL(tenantId, month);
  const cashFlow = useCashFlowAnalysis(tenantId, month);
  const budgetVariance = useBudgetVariance(tenantId, month);
  const expenses = useExpenseBreakdown(tenantId, month);
  const revenue = useRevenueBreakdown(tenantId, month);
  const ratios = useFinancialRatios(tenantId, month);
  
  return {
    pnl,
    cashFlow,
    budgetVariance,
    expenses,
    revenue,
    ratios,
    isLoading: pnl.isLoading || cashFlow.isLoading || budgetVariance.isLoading || 
               expenses.isLoading || revenue.isLoading || ratios.isLoading,
    isError: pnl.isError || cashFlow.isError || budgetVariance.isError || 
             expenses.isError || revenue.isError || ratios.isError,
    error: pnl.error || cashFlow.error || budgetVariance.error || 
           expenses.error || revenue.error || ratios.error
  };
}
