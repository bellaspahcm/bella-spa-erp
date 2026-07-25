/**
 * Financial Ratios Calculation Service
 * 
 * Calculates real financial ratios from Balance Sheet and P&L data.
 * 
 * Ratio Categories:
 * 1. Liquidity Ratios - Short-term financial health
 * 2. Solvency Ratios - Long-term debt capacity
 * 3. Profitability Ratios - Ability to generate profit
 * 4. Efficiency Ratios - Asset utilization effectiveness
 * 
 * Data Sources:
 * - Balance Sheet (from balance-sheet.ts)
 * - P&L Statement (from queries.ts)
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Priority 3 Task #3
 */

import { QueryError } from '../shared/types';
import { getBalanceSheet } from './balance-sheet';
import { getMonthlyPnL } from './queries';
import type {
  FinancialRatios,
  FinancialRatiosParams,
  LiquidityRatios,
  SolvencyRatios,
  ProfitabilityRatios,
  EfficiencyRatios,
} from './balance-sheet-types';

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Get previous period (month before)
 */
function getPreviousPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

/**
 * Safe division (returns 0 if denominator is 0)
 */
function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

// ─── Main Calculation Function ──────────────────────────────────────────────

/**
 * Calculate Financial Ratios for a tenant
 * 
 * @param params - Query parameters (tenantId, period, compareWithPreviousPeriod)
 * @returns Financial Ratios with Liquidity, Solvency, Profitability, Efficiency
 */
export async function getFinancialRatios(
  params: FinancialRatiosParams
): Promise<FinancialRatios> {
  const { tenantId, period, compareWithPreviousPeriod: _compareWithPreviousPeriod } = params;

  try {
    // Determine the period
    const currentPeriod = period || new Date().toISOString().slice(0, 7);

    // Get Balance Sheet for current period
    const balanceSheet = await getBalanceSheet({ tenantId, period: currentPeriod });

    // Get P&L for current period
    const pnlData = await getMonthlyPnL(tenantId, {
      startDate: `${currentPeriod}-01`,
      endDate: `${currentPeriod}-31`,
    });
    const pnlRecord = pnlData[0];
    
    // Extract key figures from P&L
    const revenue = pnlRecord?.totalRevenue || 0;
    const costOfGoodsSold = pnlRecord?.inventoryExpense || 0; // COGS approximation
    const grossProfit = pnlRecord?.grossProfit || 0;
    const operatingIncome = pnlRecord?.operatingProfit || 0;
    const netIncome = pnlRecord?.netProfit || 0;
    const interestExpense = 0; // Not tracked in current P&L, default to 0
    const ebit = netIncome + interestExpense; // Earnings Before Interest & Tax

    // Get previous period data for average calculations
    const previousPeriod = getPreviousPeriod(currentPeriod);
    const previousBalanceSheet = await getBalanceSheet({ tenantId, period: previousPeriod });

    // Extract Balance Sheet figures
    const currentAssets = balanceSheet.assets.current.total;
    const totalAssets = balanceSheet.assets.total;
    const cash = balanceSheet.assets.current.cash;
    const inventory = balanceSheet.assets.current.inventory;
    const accountsReceivable = balanceSheet.assets.current.accountsReceivable;
    
    const currentLiabilities = balanceSheet.liabilities.current.total;
    const totalLiabilities = balanceSheet.liabilities.total;
    
    const equity = balanceSheet.equity.total;

    // Average calculations (for ratios that need average balances)
    const avgTotalAssets = (totalAssets + previousBalanceSheet.assets.total) / 2;
    const avgInventory = (inventory + previousBalanceSheet.assets.current.inventory) / 2;
    const avgAccountsReceivable = (accountsReceivable + previousBalanceSheet.assets.current.accountsReceivable) / 2;

    // ─── 1. Liquidity Ratios ────────────────────────────────────────────────

    const liquidity: LiquidityRatios = {
      currentRatio: safeDivide(currentAssets, currentLiabilities),
      quickRatio: safeDivide(currentAssets - inventory, currentLiabilities),
      cashRatio: safeDivide(cash, currentLiabilities),
      workingCapital: currentAssets - currentLiabilities,
    };

    // ─── 2. Solvency Ratios ─────────────────────────────────────────────────

    const solvency: SolvencyRatios = {
      debtToEquityRatio: safeDivide(totalLiabilities, equity),
      debtToAssetsRatio: safeDivide(totalLiabilities, totalAssets),
      equityMultiplier: safeDivide(totalAssets, equity),
      interestCoverageRatio: safeDivide(ebit, interestExpense),
    };

    // ─── 3. Profitability Ratios ────────────────────────────────────────────

    const profitability: ProfitabilityRatios = {
      returnOnAssets: safeDivide(netIncome, avgTotalAssets) * 100, // ROA %
      returnOnEquity: safeDivide(netIncome, equity) * 100, // ROE %
      profitMargin: safeDivide(netIncome, revenue) * 100, // Net Profit Margin %
      grossProfitMargin: safeDivide(grossProfit, revenue) * 100, // Gross Profit Margin %
      operatingMargin: safeDivide(operatingIncome, revenue) * 100, // Operating Margin %
    };

    // ─── 4. Efficiency Ratios ───────────────────────────────────────────────
    
    const efficiency: EfficiencyRatios = {
      assetTurnover: safeDivide(revenue, avgTotalAssets),
      inventoryTurnover: safeDivide(costOfGoodsSold, avgInventory),
      receivablesTurnover: safeDivide(revenue, avgAccountsReceivable),
      daysSalesOutstanding: safeDivide(365, safeDivide(revenue, avgAccountsReceivable)),
      daysInventoryOutstanding: safeDivide(365, safeDivide(costOfGoodsSold, avgInventory)),
    };

    return {
      tenantId,
      period: currentPeriod,
      liquidity,
      solvency,
      profitability,
      efficiency,
      
      // Reference data
      totalAssets,
      totalLiabilities,
      totalEquity: equity,
      revenue,
      netIncome,
    };

  } catch (error) {
    if (error instanceof QueryError) throw error;
    const errorObj = error instanceof Error ? error : new Error(String(error));
    throw new QueryError('Unexpected error in getFinancialRatios', errorObj);
  }
}

/**
 * Get Financial Ratios trend for multiple periods
 * 
 * @param tenantId - Tenant UUID
 * @param periods - Array of periods (YYYY-MM)
 * @returns Array of Financial Ratios
 */
export async function getFinancialRatiosTrend(
  tenantId: string,
  periods: string[]
): Promise<FinancialRatios[]> {
  const results: FinancialRatios[] = [];

  for (const period of periods) {
    const ratios = await getFinancialRatios({ tenantId, period });
    results.push(ratios);
  }

  return results;
}

/**
 * Get Financial Ratios with industry benchmarks comparison
 * 
 * Industry benchmarks for Spa/Beauty/Wellness industry (Vietnam):
 * - Current Ratio: 1.5 - 2.0 (good liquidity)
 * - Quick Ratio: 1.0 - 1.5 (adequate short-term coverage)
 * - Debt-to-Equity: 0.5 - 1.5 (moderate leverage)
 * - ROE: 15% - 25% (healthy profitability)
 * - ROA: 10% - 20% (efficient asset utilization)
 * - Profit Margin: 10% - 20% (sustainable margins)
 * - Asset Turnover: 1.5 - 2.5 (good revenue generation)
 * 
 * @param params - Query parameters
 * @returns Financial Ratios with benchmark comparison
 */
export async function getFinancialRatiosWithBenchmarks(
  params: FinancialRatiosParams
): Promise<{
  ratios: FinancialRatios;
  benchmarks: {
    liquidity: { currentRatio: [number, number]; quickRatio: [number, number] };
    solvency: { debtToEquity: [number, number] };
    profitability: { roe: [number, number]; roa: [number, number]; profitMargin: [number, number] };
    efficiency: { assetTurnover: [number, number] };
  };
  comparison: {
    currentRatio: 'above' | 'within' | 'below';
    quickRatio: 'above' | 'within' | 'below';
    debtToEquity: 'above' | 'within' | 'below';
    roe: 'above' | 'within' | 'below';
    roa: 'above' | 'within' | 'below';
    profitMargin: 'above' | 'within' | 'below';
    assetTurnover: 'above' | 'within' | 'below';
  };
}> {
  const ratios = await getFinancialRatios(params);

  // Industry benchmarks for Spa/Beauty/Wellness sector
  const benchmarks = {
    liquidity: {
      currentRatio: [1.5, 2.0] as [number, number],
      quickRatio: [1.0, 1.5] as [number, number],
    },
    solvency: {
      debtToEquity: [0.5, 1.5] as [number, number],
    },
    profitability: {
      roe: [15, 25] as [number, number],
      roa: [10, 20] as [number, number],
      profitMargin: [10, 20] as [number, number],
    },
    efficiency: {
      assetTurnover: [1.5, 2.5] as [number, number],
    },
  };

  // Compare ratios with benchmarks
  const compare = (value: number, range: [number, number]): 'above' | 'within' | 'below' => {
    if (value < range[0]) return 'below';
    if (value > range[1]) return 'above';
    return 'within';
  };

  const comparison = {
    currentRatio: compare(ratios.liquidity.currentRatio, benchmarks.liquidity.currentRatio),
    quickRatio: compare(ratios.liquidity.quickRatio, benchmarks.liquidity.quickRatio),
    debtToEquity: compare(ratios.solvency.debtToEquityRatio, benchmarks.solvency.debtToEquity),
    roe: compare(ratios.profitability.returnOnEquity, benchmarks.profitability.roe),
    roa: compare(ratios.profitability.returnOnAssets, benchmarks.profitability.roa),
    profitMargin: compare(ratios.profitability.profitMargin, benchmarks.profitability.profitMargin),
    assetTurnover: compare(ratios.efficiency.assetTurnover, benchmarks.efficiency.assetTurnover),
  };

  return {
    ratios,
    benchmarks,
    comparison,
  };
}

/**
 * Get Financial Health Score (0-100)
 * 
 * Weighted composite score based on key ratios:
 * - Liquidity (30%): Current Ratio, Quick Ratio
 * - Solvency (25%): Debt-to-Equity
 * - Profitability (30%): ROE, Profit Margin
 * - Efficiency (15%): Asset Turnover
 * 
 * Score interpretation:
 * - 90-100: Excellent (A+)
 * - 80-89: Very Good (A)
 * - 70-79: Good (B)
 * - 60-69: Fair (C)
 * - 50-59: Needs Improvement (D)
 * - 0-49: Poor (F)
 * 
 * @param params - Query parameters
 * @returns Financial health score and grade
 */
export async function getFinancialHealthScore(
  params: FinancialRatiosParams
): Promise<{
  score: number; // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    liquidity: number;
    solvency: number;
    profitability: number;
    efficiency: number;
  };
  ratios: FinancialRatios;
}> {
  const { ratios, benchmarks } = await getFinancialRatiosWithBenchmarks(params);

  // Score each category (0-100)
  const scoreRatio = (value: number, benchmark: [number, number], ideal: 'middle' | 'higher' | 'lower'): number => {
    const [min, max] = benchmark;
    const mid = (min + max) / 2;
    
    if (ideal === 'middle') {
      // Best score at midpoint of range
      const distance = Math.abs(value - mid);
      const range = max - min;
      return Math.max(0, Math.min(100, 100 - (distance / range) * 100));
    } else if (ideal === 'higher') {
      // Higher is better
      if (value >= max) return 100;
      if (value <= min) return 60;
      return 60 + ((value - min) / (max - min)) * 40;
    } else {
      // Lower is better
      if (value <= min) return 100;
      if (value >= max) return 60;
      return 100 - ((value - min) / (max - min)) * 40;
    }
  };

  // Liquidity (30%)
  const liquidityScore = (
    scoreRatio(ratios.liquidity.currentRatio, benchmarks.liquidity.currentRatio, 'middle') * 0.6 +
    scoreRatio(ratios.liquidity.quickRatio, benchmarks.liquidity.quickRatio, 'middle') * 0.4
  );

  // Solvency (25%)
  const solvencyScore = scoreRatio(ratios.solvency.debtToEquityRatio, benchmarks.solvency.debtToEquity, 'lower');

  // Profitability (30%)
  const profitabilityScore = (
    scoreRatio(ratios.profitability.returnOnEquity, benchmarks.profitability.roe, 'higher') * 0.5 +
    scoreRatio(ratios.profitability.profitMargin, benchmarks.profitability.profitMargin, 'higher') * 0.5
  );

  // Efficiency (15%)
  const efficiencyScore = scoreRatio(ratios.efficiency.assetTurnover, benchmarks.efficiency.assetTurnover, 'higher');

  // Weighted total score
  const score = Math.round(
    liquidityScore * 0.30 +
    solvencyScore * 0.25 +
    profitabilityScore * 0.30 +
    efficiencyScore * 0.15
  );

  // Determine grade
  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 50) grade = 'D';
  else grade = 'F';

  return {
    score,
    grade,
    breakdown: {
      liquidity: Math.round(liquidityScore),
      solvency: Math.round(solvencyScore),
      profitability: Math.round(profitabilityScore),
      efficiency: Math.round(efficiencyScore),
    },
    ratios,
  };
}
