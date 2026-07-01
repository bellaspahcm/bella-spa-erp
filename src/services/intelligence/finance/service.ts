/**
 * Finance Intelligence Service
 * 
 * Service layer with caching for Financial Intelligence metrics.
 * Implements cache → DB fallback pattern with automatic cache invalidation.
 * 
 * Cache Flow:
 * 1. Check cache → If hit, return immediately
 * 2. Query database (materialized views) → Compute metrics
 * 3. Write to cache → Return result
 * 
 * Cache Strategy:
 * - Monthly P&L: 1 hour TTL (less frequently changing than operational)
 * - Cash Flow Analysis: 1 hour TTL (daily aggregations)
 * - Budget Variance: 1 hour TTL (monthly comparisons)
 * - Expense/Revenue Breakdown: 1 hour TTL (aggregated data)
 * - Cash Flow Forecast: 1 hour TTL (computationally expensive)
 * - Profitability Trends: 1 hour TTL (historical analysis)
 * - Financial Ratios: 1 hour TTL (derived metrics)
 * 
 * Cache Invalidation:
 * Automatic via BusinessEventListener → CacheInvalidator
 * - revenue.confirmed → Invalidates finance:*
 * - expense.approved → Invalidates finance:*
 * - period.closed → Invalidates finance:*
 */

import type { IntelligenceService, DateRange, TimePeriod, IntelligenceResponse, CacheService } from '../shared/types';
import { IntelligenceError, QueryError } from '../shared/types';
import { getCache } from '../cache';
import { buildCacheKey, parseDateRange, formatDate } from '../shared/helpers';
import { DEFAULT_CACHE_TTL, CACHE_KEY_PREFIX } from '../shared/constants';
import type {
  MonthlyPnL,
  CashFlowAnalysis,
  BudgetVariance,
  ExpenseBreakdown,
  RevenueBreakdown,
  CashFlowForecast,
  ProfitabilityTrends,
  FinancialRatios,
} from './queries';
import {
  getMonthlyPnL as queryMonthlyPnL,
  getCashFlowAnalysis as queryCashFlowAnalysis,
  getBudgetVariance as queryBudgetVariance,
  getExpenseBreakdown as queryExpenseBreakdown,
  getRevenueBreakdown as queryRevenueBreakdown,
  getCashFlowForecast as queryCashFlowForecast,
  getProfitabilityTrends as queryProfitabilityTrends,
  getFinancialRatios as queryFinancialRatios,
} from './queries';

// ─────────────────────────────────────────────────────────────────────────────
// Finance Intelligence Service
// ─────────────────────────────────────────────────────────────────────────────

export class FinanceIntelligenceService implements IntelligenceService {
  readonly moduleName = 'finance';
  private cache: CacheService;

  /**
   * Create Finance Intelligence Service.
   * @param cache - Optional cache instance (defaults to getCache() singleton).
   */
  constructor(cache?: CacheService) {
    this.cache = cache || getCache();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Monthly P&L
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Monthly Profit & Loss Statement.
   * 
   * Retrieves revenue, expense, and profit breakdown for the specified date range.
   * Queries the mv_monthly_pnl materialized view for performance.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns Monthly P&L statements with cache metadata
   */
  async getMonthlyPnL(
    tenantId: string,
    dateRange: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<MonthlyPnL[]>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as any);

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.FINANCE,
        tenantId,
        'monthlyPnL',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: MonthlyPnL[] | null = null;
      try {
        cached = await this.cache.get<MonthlyPnL[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getMonthlyPnL] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database (materialized view)
      const data = await queryMonthlyPnL(tenantId, dateRange);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.FINANCE.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getMonthlyPnL] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_monthly_pnl'],
        },
      };
    } catch (error) {
      throw this.handleError('getMonthlyPnL', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Cash Flow Analysis
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Cash Flow Analysis.
   * 
   * Retrieves cash inflows and outflows by payment method for the specified date range.
   * Queries the mv_cash_flow materialized view for performance.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns Cash flow analyses with cache metadata
   */
  async getCashFlowAnalysis(
    tenantId: string,
    dateRange: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<CashFlowAnalysis[]>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as any);

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.FINANCE,
        tenantId,
        'cashFlowAnalysis',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: CashFlowAnalysis[] | null = null;
      try {
        cached = await this.cache.get<CashFlowAnalysis[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getCashFlowAnalysis] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database (materialized view)
      const data = await queryCashFlowAnalysis(tenantId, dateRange);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.FINANCE.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getCashFlowAnalysis] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_cash_flow'],
        },
      };
    } catch (error) {
      throw this.handleError('getCashFlowAnalysis', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Budget Variance
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Budget Variance Analysis.
   * 
   * Compares actual spending/revenue against budgeted amounts for a specific month.
   * Queries the mv_budget_variance materialized view for performance.
   * 
   * @param tenantId - Tenant ID
   * @param month - Month in YYYY-MM format (e.g., '2026-06')
   * @returns Budget variance by category with cache metadata
   */
  async getBudgetVariance(
    tenantId: string,
    month: string
  ): Promise<IntelligenceResponse<BudgetVariance[]>> {
    const startTime = Date.now();

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.FINANCE,
        tenantId,
        'budgetVariance',
        { month }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: BudgetVariance[] | null = null;
      try {
        cached = await this.cache.get<BudgetVariance[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getBudgetVariance] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database (materialized view)
      const data = await queryBudgetVariance(tenantId, month);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.FINANCE.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getBudgetVariance] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_budget_variance'],
        },
      };
    } catch (error) {
      throw this.handleError('getBudgetVariance', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Expense Breakdown
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Expense Breakdown.
   * 
   * Retrieves detailed expense breakdown by category and payment method.
   * Aggregates data from operating_expenses and salary_expenses tables.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns Expense breakdown with cache metadata
   */
  async getExpenseBreakdown(
    tenantId: string,
    dateRange: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<ExpenseBreakdown>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as any);

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.FINANCE,
        tenantId,
        'expenseBreakdown',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: ExpenseBreakdown | null = null;
      try {
        cached = await this.cache.get<ExpenseBreakdown>(cacheKey);
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getExpenseBreakdown] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database
      const data = await queryExpenseBreakdown(tenantId, dateRange);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.FINANCE.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getExpenseBreakdown] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['expenses', 'revenue'],
        },
      };
    } catch (error) {
      throw this.handleError('getExpenseBreakdown', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Revenue Breakdown
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Revenue Breakdown.
   * 
   * Retrieves detailed revenue breakdown by type and payment method.
   * Aggregates data from revenue table.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns Revenue breakdown with cache metadata
   */
  async getRevenueBreakdown(
    tenantId: string,
    dateRange: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<RevenueBreakdown>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as any);

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.FINANCE,
        tenantId,
        'revenueBreakdown',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: RevenueBreakdown | null = null;
      try {
        cached = await this.cache.get<RevenueBreakdown>(cacheKey);
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getRevenueBreakdown] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database
      const data = await queryRevenueBreakdown(tenantId, dateRange);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.FINANCE.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getRevenueBreakdown] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['revenue'],
        },
      };
    } catch (error) {
      throw this.handleError('getRevenueBreakdown', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Cash Flow Forecast
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Cash Flow Forecast.
   * 
   * Generates cash flow forecast for upcoming months based on historical patterns.
   * Uses moving average method to predict future inflows and outflows.
   * 
   * @param tenantId - Tenant ID
   * @param forecastMonths - Number of months to forecast (default: 3)
   * @returns Cash flow forecasts with cache metadata
   */
  async getCashFlowForecast(
    tenantId: string,
    forecastMonths: number = 3
  ): Promise<IntelligenceResponse<CashFlowForecast[]>> {
    const startTime = Date.now();

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.FINANCE,
        tenantId,
        'cashFlowForecast',
        { forecastMonths }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: CashFlowForecast[] | null = null;
      try {
        cached = await this.cache.get<CashFlowForecast[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getCashFlowForecast] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database and compute forecast
      const data = await queryCashFlowForecast(tenantId, forecastMonths);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour (computationally expensive)
          tags: [CACHE_KEY_PREFIX.FINANCE.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getCashFlowForecast] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_cash_flow'],
        },
      };
    } catch (error) {
      throw this.handleError('getCashFlowForecast', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Profitability Trends
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Profitability Trends.
   * 
   * Analyzes profitability trends over the specified date range.
   * Calculates margins, averages, and identifies trends.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns Profitability trends with cache metadata
   */
  async getProfitabilityTrends(
    tenantId: string,
    dateRange: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<ProfitabilityTrends>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as any);

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.FINANCE,
        tenantId,
        'profitabilityTrends',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: ProfitabilityTrends | null = null;
      try {
        cached = await this.cache.get<ProfitabilityTrends>(cacheKey);
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getProfitabilityTrends] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database and compute trends
      const data = await queryProfitabilityTrends(tenantId, dateRange);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.FINANCE.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getProfitabilityTrends] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_monthly_pnl'],
        },
      };
    } catch (error) {
      throw this.handleError('getProfitabilityTrends', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Financial Ratios
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Financial Ratios.
   * 
   * Calculates key financial ratios for liquidity, efficiency, and profitability analysis.
   * Note: This is a simplified implementation. Full implementation requires balance sheet data.
   * 
   * @param tenantId - Tenant ID
   * @param month - Month in YYYY-MM format (e.g., '2026-06')
   * @returns Financial ratios with cache metadata
   */
  async getFinancialRatios(
    tenantId: string,
    month: string
  ): Promise<IntelligenceResponse<FinancialRatios>> {
    const startTime = Date.now();

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.FINANCE,
        tenantId,
        'financialRatios',
        { month }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: FinancialRatios | null = null;
      try {
        cached = await this.cache.get<FinancialRatios>(cacheKey);
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getFinancialRatios] Cache read error, falling back to database:', cacheError);
        // Continue to database query
      }

      if (cached) {
        return {
          data: cached,
          metadata: {
            generatedAt: new Date(),
            cacheHit: true,
            queryTimeMs: Date.now() - startTime,
            dataSourcesUsed: ['cache'],
          },
        };
      }

      // Query database and compute ratios
      const data = await queryFinancialRatios(tenantId, month);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: 3600, // 1 hour
          tags: [CACHE_KEY_PREFIX.FINANCE.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[FinanceIntelligence.getFinancialRatios] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_monthly_pnl', 'mv_cash_flow'],
        },
      };
    } catch (error) {
      throw this.handleError('getFinancialRatios', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Interface Implementation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Health check for Finance Intelligence module.
   * Tests database connection and cache availability.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test cache
      const testKey = `${CACHE_KEY_PREFIX.FINANCE}:health:test`;
      await this.cache.set(testKey, { test: true }, { ttl: 10 });
      const cached = await this.cache.get(testKey);
      await this.cache.delete(testKey);

      if (!cached) {
        console.error('[FinanceIntelligence] Cache health check failed');
        return false;
      }

      // TODO: Test database connection (query a simple materialized view)
      // For now, assume DB is healthy if cache is healthy
      return true;
    } catch (error) {
      console.error('[FinanceIntelligence] Health check failed:', error);
      return false;
    }
  }

  /**
   * Clear all cached data for Finance Intelligence module.
   * Used for manual cache invalidation or testing.
   * 
   * @param tenantId - Optional tenant ID to clear only that tenant's cache
   */
  async clearCache(tenantId?: string): Promise<void> {
    try {
      if (tenantId) {
        // Clear cache for specific tenant
        await this.cache.deleteByTag(`tenant:${tenantId}`);
        console.log(`[FinanceIntelligence] Cache cleared for tenant: ${tenantId}`);
      } else {
        // Clear all finance cache
        await this.cache.deletePattern(`${CACHE_KEY_PREFIX.FINANCE}:*`);
        console.log('[FinanceIntelligence] Cache cleared successfully');
      }
    } catch (error) {
      console.error('[FinanceIntelligence] Failed to clear cache:', error);
      throw new IntelligenceError(
        'Failed to clear finance intelligence cache',
        'CACHE_CLEAR_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Error Handling
  // ───────────────────────────────────────────────────────────────────────────

  private handleError(method: string, error: unknown): IntelligenceError {
    if (error instanceof IntelligenceError || error instanceof QueryError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`[FinanceIntelligence.${method}] Error:`, error);

    return new IntelligenceError(
      `Finance intelligence operation failed: ${message}`,
      'FINANCE_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

let financeIntelligenceInstance: FinanceIntelligenceService | null = null;

/**
 * Get singleton instance of FinanceIntelligenceService.
 * Lazy initialization on first access.
 */
export function getFinanceIntelligenceService(): FinanceIntelligenceService {
  if (!financeIntelligenceInstance) {
    financeIntelligenceInstance = new FinanceIntelligenceService();
  }
  return financeIntelligenceInstance;
}
