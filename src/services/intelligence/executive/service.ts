/**
 * Executive Intelligence Service
 * 
 * Service layer with caching for CEO Dashboard metrics.
 * Implements cache → DB fallback pattern with automatic cache invalidation.
 * 
 * Cache Flow:
 * 1. Check cache → If hit, return immediately
 * 2. Query database → Compute metrics
 * 3. Write to cache → Return result
 * 
 * Cache Invalidation:
 * Automatic via BusinessEventListener → CacheInvalidator
 * - BOOKING_CONFIRMED → Invalidates executive:*
 * - SESSION_COMPLETED → Invalidates executive:*
 * - REVENUE_RECORDED → Invalidates executive:*
 * - EXPENSE_RECORDED → Invalidates executive:*
 */

import type { IntelligenceService, DateRange, IntelligenceResponse } from '../shared/types';
import { IntelligenceError, QueryError } from '../shared/types';
import { getCache } from '../cache';
import { buildCacheKey, parseDateRange, formatDate } from '../shared/helpers';
import { DEFAULT_CACHE_TTL, CACHE_KEY_PREFIX } from '../shared/constants';
import type {
  MonthlyRevenueSummary,
  OperationalEfficiency,
  CustomerMetrics,
  FinancialHealth,
  GrowthIndicators,
} from './queries';
import {
  getMonthlyRevenueSummary as queryMonthlyRevenueSummary,
  getOperationalEfficiency as queryOperationalEfficiency,
  getCustomerMetrics as queryCustomerMetrics,
  getFinancialHealth as queryFinancialHealth,
  getGrowthIndicators as queryGrowthIndicators,
} from './queries';

// ─────────────────────────────────────────────────────────────────────────────
// Executive Intelligence Service
// ─────────────────────────────────────────────────────────────────────────────

export class ExecutiveIntelligenceService implements IntelligenceService {
  readonly moduleName = 'executive';
  private cache = getCache();

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Revenue Metrics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get monthly revenue summary with growth indicators.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns Revenue summary with cache metadata
   */
  async getMonthlyRevenueSummary(
    tenantId: string,
    dateRange: DateRange | string
  ): Promise<IntelligenceResponse<MonthlyRevenueSummary>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as unknown);

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.EXECUTIVE,
        tenantId,
        'monthlyRevenueSummary',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      // Check cache
      const cached = await this.cache.get<MonthlyRevenueSummary>(cacheKey);
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
      const data = await queryMonthlyRevenueSummary(tenantId, parsedRange);

      // Write to cache (TTL: 10 minutes for dashboard data)
      await this.cache.set(cacheKey, data, {
        ttl: DEFAULT_CACHE_TTL.EXECUTIVE,
        tags: [CACHE_KEY_PREFIX.EXECUTIVE.replace(':', ''), `tenant:${tenantId}`],
      });

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['revenue', 'bookings'],
        },
      };
    } catch (error) {
      throw this.handleError('getMonthlyRevenueSummary', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Operational Metrics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get operational efficiency metrics (KTV utilization, ratings, completion rate).
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze
   * @returns Operational efficiency metrics with cache metadata
   */
  async getOperationalEfficiency(
    tenantId: string,
    dateRange: DateRange | string
  ): Promise<IntelligenceResponse<OperationalEfficiency>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as unknown);

    try {
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.EXECUTIVE,
        tenantId,
        'operationalEfficiency',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      const cached = await this.cache.get<OperationalEfficiency>(cacheKey);
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

      const data = await queryOperationalEfficiency(tenantId, parsedRange);

      await this.cache.set(cacheKey, data, {
        ttl: DEFAULT_CACHE_TTL.EXECUTIVE,
        tags: ['executive', `tenant:${tenantId}`],
      });

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['session_logs', 'users', 'bookings'],
        },
      };
    } catch (error) {
      throw this.handleError('getOperationalEfficiency', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Customer Metrics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get customer acquisition and retention metrics.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze
   * @returns Customer metrics with cache metadata
   */
  async getCustomerMetrics(
    tenantId: string,
    dateRange: DateRange | string
  ): Promise<IntelligenceResponse<CustomerMetrics>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as unknown);

    try {
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.EXECUTIVE,
        tenantId,
        'customerMetrics',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      const cached = await this.cache.get<CustomerMetrics>(cacheKey);
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

      const data = await queryCustomerMetrics(tenantId, parsedRange);

      await this.cache.set(cacheKey, data, {
        ttl: DEFAULT_CACHE_TTL.EXECUTIVE,
        tags: ['executive', `tenant:${tenantId}`],
      });

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['bookings', 'customers'],
        },
      };
    } catch (error) {
      throw this.handleError('getCustomerMetrics', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Financial Metrics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get financial health indicators (profit margin, cash flow, expenses).
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze
   * @returns Financial health metrics with cache metadata
   */
  async getFinancialHealth(
    tenantId: string,
    dateRange: DateRange | string
  ): Promise<IntelligenceResponse<FinancialHealth>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as unknown);

    try {
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.EXECUTIVE,
        tenantId,
        'financialHealth',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      const cached = await this.cache.get<FinancialHealth>(cacheKey);
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

      const data = await queryFinancialHealth(tenantId, parsedRange);

      await this.cache.set(cacheKey, data, {
        ttl: DEFAULT_CACHE_TTL.EXECUTIVE,
        tags: ['executive', `tenant:${tenantId}`],
      });

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['revenue', 'expenses'],
        },
      };
    } catch (error) {
      throw this.handleError('getFinancialHealth', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Growth Metrics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get growth indicators (MoM, YoY, projections, top growing services).
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze
   * @returns Growth indicators with cache metadata
   */
  async getGrowthIndicators(
    tenantId: string,
    dateRange: DateRange | string
  ): Promise<IntelligenceResponse<GrowthIndicators>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as unknown);

    try {
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.EXECUTIVE,
        tenantId,
        'growthIndicators',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      const cached = await this.cache.get<GrowthIndicators>(cacheKey);
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

      const data = await queryGrowthIndicators(tenantId, parsedRange);

      await this.cache.set(cacheKey, data, {
        ttl: DEFAULT_CACHE_TTL.EXECUTIVE,
        tags: ['executive', `tenant:${tenantId}`],
      });

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
      throw this.handleError('getGrowthIndicators', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // IntelligenceService Interface Implementation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Health check for Executive Intelligence module.
   * Returns true if cache is operational.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test cache connectivity
      const testKey = `${CACHE_KEY_PREFIX.EXECUTIVE}healthcheck:${Date.now()}`;
      await this.cache.set(testKey, { test: true }, { ttl: 10 });
      const result = await this.cache.get(testKey);
      await this.cache.delete(testKey);

      return result !== null;
    } catch (error) {
      console.error('[ExecutiveIntelligence] Health check failed:', error);
      return false;
    }
  }

  /**
   * Clear all cached data for Executive Intelligence.
   * Used for manual cache invalidation or testing.
   */
  async clearCache(): Promise<void> {
    try {
      await this.cache.deletePattern(`${CACHE_KEY_PREFIX.EXECUTIVE}*`);
      console.info('[ExecutiveIntelligence] Cache cleared successfully');
    } catch (error) {
      throw new IntelligenceError(
        'Failed to clear Executive Intelligence cache',
        'CACHE_CLEAR_ERROR',
        error as Error
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Utilities
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Handle and wrap errors with context.
   */
  private handleError(method: string, error: unknown): IntelligenceError {
    if (error instanceof QueryError) {
      return new IntelligenceError(
        `[ExecutiveIntelligence.${method}] ${error.message}`,
        'QUERY_ERROR',
        error
      );
    }

    if (error instanceof IntelligenceError) {
      return error;
    }

    return new IntelligenceError(
      `[ExecutiveIntelligence.${method}] Unexpected error`,
      'UNKNOWN_ERROR',
      error as Error
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global singleton instance of ExecutiveIntelligenceService.
 */
let executiveIntelligenceInstance: ExecutiveIntelligenceService | null = null;

/**
 * Get or create the singleton ExecutiveIntelligenceService instance.
 */
export function getExecutiveIntelligence(): ExecutiveIntelligenceService {
  if (!executiveIntelligenceInstance) {
    executiveIntelligenceInstance = new ExecutiveIntelligenceService();
  }
  return executiveIntelligenceInstance;
}

/**
 * Reset the singleton instance.
 * Used in testing.
 */
export function resetExecutiveIntelligence(): void {
  executiveIntelligenceInstance = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────────────────────

export default getExecutiveIntelligence;
