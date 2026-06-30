/**
 * Operational Intelligence Service
 * 
 * Service layer with caching for Operations Manager Dashboard metrics.
 * Implements cache → DB fallback pattern with automatic cache invalidation.
 * 
 * Cache Flow:
 * 1. Check cache → If hit, return immediately
 * 2. Query database (materialized views) → Compute metrics
 * 3. Write to cache → Return result
 * 
 * Cache Strategy:
 * - KTV Performance: 10 min TTL (refresh frequency of mv_ktv_performance_summary)
 * - Inventory Status: 5 min TTL (refresh frequency of mv_inventory_status)
 * - Session Analytics: 10 min TTL (refresh frequency of mv_session_analytics)
 * 
 * Cache Invalidation:
 * Automatic via BusinessEventListener → CacheInvalidator
 * - SESSION_COMPLETED → Invalidates operational:*
 * - ATTENDANCE_MARKED → Invalidates operational:*
 * - Inventory changes → Invalidates operational:*
 */

import type { IntelligenceService, DateRange, TimePeriod, IntelligenceResponse } from '../shared/types';
import { IntelligenceError, QueryError } from '../shared/types';
import { getCache } from '../cache';
import { buildCacheKey, parseDateRange, formatDate } from '../shared/helpers';
import { DEFAULT_CACHE_TTL, CACHE_KEY_PREFIX } from '../shared/constants';
import type {
  KtvPerformance,
  KtvLeaderboardEntry,
  InventoryStatus,
  InventoryForecast,
  SessionAnalytics,
  CapacityUtilization,
} from './queries';
import {
  getKtvPerformance as queryKtvPerformance,
  getKtvLeaderboard as queryKtvLeaderboard,
  getInventoryStatus as queryInventoryStatus,
  getInventoryForecast as queryInventoryForecast,
  getSessionAnalytics as querySessionAnalytics,
  getCapacityUtilization as queryCapacityUtilization,
} from './queries';

// ─────────────────────────────────────────────────────────────────────────────
// Operational Intelligence Service
// ─────────────────────────────────────────────────────────────────────────────

export class OperationalIntelligenceService implements IntelligenceService {
  readonly moduleName = 'operational';
  private cache = getCache();

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - KTV Performance
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get KTV performance metrics (sessions, ratings, revenue, attendance).
   * 
   * @param ktvId - KTV user ID
   * @param dateRange - Period to analyze (or TimePeriod string)
   * @returns KTV performance metrics with cache metadata
   */
  async getKtvPerformance(
    ktvId: string,
    dateRange: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<KtvPerformance[]>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as any);

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.OPERATIONAL,
        ktvId,
        'ktvPerformance',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      // Check cache
      const cached = await this.cache.get<KtvPerformance[]>(cacheKey);
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
      const data = await queryKtvPerformance(ktvId, dateRange);

      // Write to cache (TTL: 10 minutes - matches mv_ktv_performance_summary refresh)
      await this.cache.set(cacheKey, data, {
        ttl: DEFAULT_CACHE_TTL.OPERATIONAL,
        tags: [CACHE_KEY_PREFIX.OPERATIONAL.replace(':', ''), `ktv:${ktvId}`],
      });

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_ktv_performance_summary'],
        },
      };
    } catch (error) {
      throw this.handleError('getKtvPerformance', error);
    }
  }

  /**
   * Get KTV leaderboard ranked by specified metric.
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze
   * @param metric - Metric to rank by ('revenue' | 'sessions' | 'rating')
   * @param limit - Number of top KTVs (default: 10)
   * @returns Top KTVs leaderboard with cache metadata
   */
  async getKtvLeaderboard(
    tenantId: string,
    dateRange: DateRange | TimePeriod,
    metric: 'revenue' | 'sessions' | 'rating' = 'revenue',
    limit: number = 10
  ): Promise<IntelligenceResponse<KtvLeaderboardEntry[]>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as any);

    try {
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.OPERATIONAL,
        tenantId,
        'ktvLeaderboard',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
          metric,
          limit,
        }
      );

      const cached = await this.cache.get<KtvLeaderboardEntry[]>(cacheKey);
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

      const data = await queryKtvLeaderboard(tenantId, dateRange, metric, limit);

      await this.cache.set(cacheKey, data, {
        ttl: DEFAULT_CACHE_TTL.OPERATIONAL,
        tags: ['operational', `tenant:${tenantId}`],
      });

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_ktv_performance_summary'],
        },
      };
    } catch (error) {
      throw this.handleError('getKtvLeaderboard', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Inventory Intelligence
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get inventory status for all products or filtered by stock status.
   * 
   * @param tenantId - Tenant ID
   * @param stockStatus - Optional filter by stock status
   * @returns Inventory status list with cache metadata
   */
  async getInventoryStatus(
    tenantId: string,
    stockStatus?: 'out_of_stock' | 'low_stock' | 'medium_stock' | 'high_stock'
  ): Promise<IntelligenceResponse<InventoryStatus[]>> {
    const startTime = Date.now();

    try {
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.OPERATIONAL,
        tenantId,
        'inventoryStatus',
        { stockStatus: stockStatus || 'all' }
      );

      const cached = await this.cache.get<InventoryStatus[]>(cacheKey);
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

      const data = await queryInventoryStatus(tenantId, stockStatus);

      // Lower TTL for inventory (5 minutes - more critical data)
      await this.cache.set(cacheKey, data, {
        ttl: 300, // 5 minutes
        tags: ['operational', `tenant:${tenantId}`, 'inventory'],
      });

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_inventory_status'],
        },
      };
    } catch (error) {
      throw this.handleError('getInventoryStatus', error);
    }
  }

  /**
   * Get inventory forecast for a specific product.
   * 
   * @param productId - Product ID
   * @param days - Forecast horizon in days (default: 30)
   * @returns Inventory forecast with cache metadata
   */
  async getInventoryForecast(
    productId: string,
    days: number = 30
  ): Promise<IntelligenceResponse<InventoryForecast>> {
    const startTime = Date.now();

    try {
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.OPERATIONAL,
        productId,
        'inventoryForecast',
        { days }
      );

      const cached = await this.cache.get<InventoryForecast>(cacheKey);
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

      const data = await queryInventoryForecast(productId, days);

      // Lower TTL for forecasts (5 minutes)
      await this.cache.set(cacheKey, data, {
        ttl: 300, // 5 minutes
        tags: ['operational', `product:${productId}`, 'inventory'],
      });

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_inventory_status'],
        },
      };
    } catch (error) {
      throw this.handleError('getInventoryForecast', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Session Analytics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get session analytics by day (completion rates, peak hours, satisfaction).
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze
   * @returns Session analytics with cache metadata
   */
  async getSessionAnalytics(
    tenantId: string,
    dateRange: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<SessionAnalytics[]>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as any);

    try {
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.OPERATIONAL,
        tenantId,
        'sessionAnalytics',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      const cached = await this.cache.get<SessionAnalytics[]>(cacheKey);
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

      const data = await querySessionAnalytics(tenantId, dateRange);

      await this.cache.set(cacheKey, data, {
        ttl: DEFAULT_CACHE_TTL.OPERATIONAL,
        tags: ['operational', `tenant:${tenantId}`],
      });

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_session_analytics'],
        },
      };
    } catch (error) {
      throw this.handleError('getSessionAnalytics', error);
    }
  }

  /**
   * Get capacity utilization metrics (booking capacity, utilization rates).
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Period to analyze
   * @returns Capacity utilization with cache metadata
   */
  async getCapacityUtilization(
    tenantId: string,
    dateRange: DateRange | TimePeriod
  ): Promise<IntelligenceResponse<CapacityUtilization[]>> {
    const startTime = Date.now();
    const parsedRange = parseDateRange(dateRange as any);

    try {
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.OPERATIONAL,
        tenantId,
        'capacityUtilization',
        {
          startDate: formatDate(parsedRange.startDate),
          endDate: formatDate(parsedRange.endDate),
        }
      );

      const cached = await this.cache.get<CapacityUtilization[]>(cacheKey);
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

      const data = await queryCapacityUtilization(tenantId, dateRange);

      await this.cache.set(cacheKey, data, {
        ttl: DEFAULT_CACHE_TTL.OPERATIONAL,
        tags: ['operational', `tenant:${tenantId}`],
      });

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_session_analytics'],
        },
      };
    } catch (error) {
      throw this.handleError('getCapacityUtilization', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Interface Implementation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Health check for Operational Intelligence module.
   * Tests database connection and cache availability.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test cache
      const testKey = `${CACHE_KEY_PREFIX.OPERATIONAL}:health:test`;
      await this.cache.set(testKey, { test: true }, { ttl: 10 });
      const cached = await this.cache.get(testKey);
      await this.cache.delete(testKey);

      if (!cached) {
        console.error('[OperationalIntelligence] Cache health check failed');
        return false;
      }

      // TODO: Test database connection (query a simple materialized view)
      // For now, assume DB is healthy if cache is healthy
      return true;
    } catch (error) {
      console.error('[OperationalIntelligence] Health check failed:', error);
      return false;
    }
  }

  /**
   * Clear all cached data for Operational Intelligence module.
   * Used for manual cache invalidation or testing.
   */
  async clearCache(): Promise<void> {
    try {
      await this.cache.deletePattern(`${CACHE_KEY_PREFIX.OPERATIONAL}:*`);
      console.log('[OperationalIntelligence] Cache cleared successfully');
    } catch (error) {
      console.error('[OperationalIntelligence] Failed to clear cache:', error);
      throw new IntelligenceError(
        'Failed to clear operational intelligence cache',
        'CACHE_CLEAR_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Error Handling
  // ───────────────────────────────────────────────────────────────────────────

  private handleError(functionName: string, error: unknown): IntelligenceError {
    if (error instanceof IntelligenceError || error instanceof QueryError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`[OperationalIntelligence.${functionName}] Error:`, error);

    return new IntelligenceError(
      `Operational intelligence operation failed: ${message}`,
      'OPERATIONAL_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

let serviceInstance: OperationalIntelligenceService | null = null;

/**
 * Get singleton instance of OperationalIntelligenceService.
 * Lazy initialization on first access.
 */
export function getOperationalIntelligenceService(): OperationalIntelligenceService {
  if (!serviceInstance) {
    serviceInstance = new OperationalIntelligenceService();
  }
  return serviceInstance;
}
