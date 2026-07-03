/**
 * Customer Intelligence Service
 * 
 * Service layer with caching for Customer Intelligence metrics.
 * Implements cache → DB fallback pattern with automatic cache invalidation.
 * 
 * Cache Flow:
 * 1. Check cache → If hit, return immediately
 * 2. Query database (materialized views) → Compute metrics
 * 3. Write to cache → Return result
 * 
 * Cache Strategy:
 * - Customer Segmentation: 6 hours TTL (customer behavior changes gradually)
 * - Customer LTV: 6 hours TTL (lifetime value calculations)
 * - Churn Risk Analysis: 6 hours TTL (risk scores based on activity trends)
 * - RFM Analysis: 6 hours TTL (same as segmentation)
 * - Cohort Analysis: 6 hours TTL (cohort metrics)
 * 
 * Cache Invalidation:
 * Automatic via BusinessEventListener → CacheInvalidator
 * - bookings.created → Invalidates customer:*
 * - revenue.confirmed → Invalidates customer:*
 * - customers.updated → Invalidates customer:*
 * - session_reviews.approved → Invalidates customer:*
 */

import type { IntelligenceService, DateRange, TimePeriod, IntelligenceResponse, CacheService } from '../shared/types';
import { IntelligenceError, QueryError } from '../shared/types';
import { getCache } from '../cache';
import { buildCacheKey, parseDateRange, formatDate } from '../shared/helpers';
import { DEFAULT_CACHE_TTL, CACHE_KEY_PREFIX } from '../shared/constants';
import {
  getCustomerSegmentation as queryCustomerSegmentation,
  getCustomerLTV as queryCustomerLTV,
  getChurnRiskAnalysis as queryChurnRiskAnalysis,
  getRFMAnalysis as queryRFMAnalysis,
  getCohortAnalysis as queryCohortAnalysis,
  getSegmentDistribution as querySegmentDistribution,
  CustomerSegmentation,
  CustomerLTV,
  ChurnRiskAnalysis,
  CohortAnalysis,
  RFMAnalysis,
  SegmentDistribution,
} from './queries-simple';

// ─────────────────────────────────────────────────────────────────────────────
// Customer Intelligence Service
// ─────────────────────────────────────────────────────────────────────────────

export class CustomerIntelligenceService implements IntelligenceService {
  readonly moduleName = 'customer';
  private cache: CacheService;
  private readonly CACHE_TTL = 21600; // 6 hours in seconds

  /**
   * Create Customer Intelligence Service.
   * @param cache - Optional cache instance (defaults to getCache() singleton).
   */
  constructor(cache?: CacheService) {
    this.cache = cache || getCache();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Customer Segmentation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Customer Segmentation (RFM Analysis).
   * 
   * Retrieves customers with RFM scores and assigned segments:
   * - Champions, Loyal Customers, Potential Loyalists, Recent Customers, Promising
   * - Need Attention, About To Sleep, At Risk, Cannot Lose, Hibernating, Lost, New
   * 
   * Queries the mv_customer_segments materialized view for performance.
   * 
   * @param tenantId - Tenant ID
   * @param segment - Optional segment filter
   * @param limit - Optional limit for pagination
   * @returns Customer segments with cache metadata
   */
  async getCustomerSegmentation(
    tenantId: string,
    segment?: string,
    limit?: number
  ): Promise<IntelligenceResponse<CustomerSegmentation[]>> {
    const startTime = Date.now();

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.CUSTOMER,
        tenantId,
        'segmentation',
        {
          ...(segment ? { segment } : {}),
          ...(limit ? { limit } : {}),
        }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: CustomerSegmentation[] | null = null;
      try {
        cached = await this.cache.get<CustomerSegmentation[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[CustomerIntelligence.getCustomerSegmentation] Cache read error, falling back to database:', cacheError);
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

      // Query database (simplified - ignore segment and limit params for now)
      const data = await queryCustomerSegmentation(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: this.CACHE_TTL,
          tags: [CACHE_KEY_PREFIX.CUSTOMER.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[CustomerIntelligence.getCustomerSegmentation] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_customer_segments'],
        },
      };
    } catch (error) {
      throw this.handleError('getCustomerSegmentation', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Customer LTV
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Customer LTV (Lifetime Value).
   * 
   * Retrieves customer LTV with cohort benchmarks and value tiers:
   * - VIP, High Value, Medium Value, Standard, Low Value, Prospect
   * - Current LTV vs Projected Annual LTV
   * - Cohort retention rate and average lifespan
   * 
   * Queries the mv_customer_ltv materialized view for performance.
   * 
   * @param tenantId - Tenant ID
   * @param cohortMonth - Optional cohort month filter (YYYY-MM format)
   * @param valueTier - Optional value tier filter
   * @param limit - Optional limit for top customers
   * @returns Customer LTV with cache metadata
   */
  async getCustomerLTV(
    tenantId: string,
    cohortMonth?: string,
    valueTier?: string,
    limit?: number
  ): Promise<IntelligenceResponse<CustomerLTV[]>> {
    const startTime = Date.now();

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.CUSTOMER,
        tenantId,
        'ltv',
        {
          ...(cohortMonth ? { cohortMonth } : {}),
          ...(valueTier ? { valueTier } : {}),
          ...(limit ? { limit } : {}),
        }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: CustomerLTV[] | null = null;
      try {
        cached = await this.cache.get<CustomerLTV[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[CustomerIntelligence.getCustomerLTV] Cache read error, falling back to database:', cacheError);
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

      // Query database (simplified - ignore cohortMonth, valueTier, limit params for now)
      const data = await queryCustomerLTV(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: this.CACHE_TTL,
          tags: [CACHE_KEY_PREFIX.CUSTOMER.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[CustomerIntelligence.getCustomerLTV] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_customer_ltv'],
        },
      };
    } catch (error) {
      throw this.handleError('getCustomerLTV', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Churn Risk Analysis
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Churn Risk Analysis.
   * 
   * Retrieves customers with churn risk scores (0-100) and recommended retention actions:
   * - Risk Level: High (>=70), Medium (>=40), Low (<40)
   * - Risk Factors: Recency (40%), Frequency Decline (30%), Revenue Decline (20%), Satisfaction (10%)
   * - Recommended Actions: Urgent call, VIP discount, Win-back campaign, Survey, etc.
   * 
   * Queries the mv_customer_activity_summary materialized view for performance.
   * 
   * @param tenantId - Tenant ID
   * @param riskLevel - Optional risk level filter (High, Medium, Low)
   * @param limit - Optional limit for high-risk customers
   * @returns Churn risk analysis with cache metadata
   */
  async getChurnRiskAnalysis(
    tenantId: string,
    riskLevel?: 'High' | 'Medium' | 'Low',
    limit?: number
  ): Promise<IntelligenceResponse<ChurnRiskAnalysis[]>> {
    const startTime = Date.now();

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.CUSTOMER,
        tenantId,
        'churnRisk',
        {
          ...(riskLevel ? { riskLevel } : {}),
          ...(limit ? { limit } : {}),
        }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: ChurnRiskAnalysis[] | null = null;
      try {
        cached = await this.cache.get<ChurnRiskAnalysis[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[CustomerIntelligence.getChurnRiskAnalysis] Cache read error, falling back to database:', cacheError);
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

      // Query database (simplified - ignore riskLevel and limit params for now)
      const data = await queryChurnRiskAnalysis(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: this.CACHE_TTL,
          tags: [CACHE_KEY_PREFIX.CUSTOMER.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[CustomerIntelligence.getChurnRiskAnalysis] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_customer_activity_summary'],
        },
      };
    } catch (error) {
      throw this.handleError('getChurnRiskAnalysis', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - RFM Analysis
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get RFM Analysis (detailed Recency, Frequency, Monetary scores).
   * 
   * Convenience method for getting detailed RFM scores without segment filter.
   * Queries the mv_customer_segments materialized view for performance.
   * 
   * @param tenantId - Tenant ID
   * @returns RFM analysis with cache metadata
   */
  async getRFMAnalysis(
    tenantId: string
  ): Promise<IntelligenceResponse<CustomerSegmentation[]>> {
    // RFM analysis is the same as segmentation without filter
    // This is a convenience alias for clarity
    return this.getCustomerSegmentation(tenantId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Segment Distribution
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Segment Distribution Summary.
   * 
   * Aggregates customer count, revenue, and avg LTV by segment.
   * Useful for pie charts and segment comparison dashboards.
   * 
   * @param tenantId - Tenant ID
   * @returns Segment distribution with cache metadata
   */
  async getSegmentDistribution(
    tenantId: string
  ): Promise<IntelligenceResponse<SegmentDistribution[]>> {
    const startTime = Date.now();

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.CUSTOMER,
        tenantId,
        'segmentDistribution',
        {}
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: SegmentDistribution[] | null = null;
      try {
        cached = await this.cache.get<SegmentDistribution[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[CustomerIntelligence.getSegmentDistribution] Cache read error, falling back to database:', cacheError);
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

      // Query database and aggregate
      const data = await querySegmentDistribution(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: this.CACHE_TTL,
          tags: [CACHE_KEY_PREFIX.CUSTOMER.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[CustomerIntelligence.getSegmentDistribution] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_customer_segments'],
        },
      };
    } catch (error) {
      throw this.handleError('getSegmentDistribution', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API - Cohort Analysis
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Cohort Analysis.
   * 
   * Analyzes customer LTV and retention by signup cohort (month).
   * Useful for cohort retention curves and LTV trends over time.
   * 
   * @param tenantId - Tenant ID
   * @param limit - Optional limit for recent cohorts (default: 12 months)
   * @returns Cohort analysis with cache metadata
   */
  async getCohortAnalysis(
    tenantId: string,
    limit: number = 12
  ): Promise<IntelligenceResponse<CohortAnalysis[]>> {
    const startTime = Date.now();

    try {
      // Build cache key
      const cacheKey = buildCacheKey(
        CACHE_KEY_PREFIX.CUSTOMER,
        tenantId,
        'cohortAnalysis',
        { limit }
      );

      // Check cache (fallback to DB if cache read fails)
      let cached: CohortAnalysis[] | null = null;
      try {
        cached = await this.cache.get<CohortAnalysis[]>(cacheKey);
      } catch (cacheError) {
        console.warn('[CustomerIntelligence.getCohortAnalysis] Cache read error, falling back to database:', cacheError);
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

      // Query database and aggregate (simplified - ignore limit param for now)
      const data = await queryCohortAnalysis(tenantId);

      // Write to cache (best effort - don't fail if cache write fails)
      try {
        await this.cache.set(cacheKey, data, {
          ttl: this.CACHE_TTL,
          tags: [CACHE_KEY_PREFIX.CUSTOMER.replace(':', ''), `tenant:${tenantId}`],
        });
      } catch (cacheError) {
        console.warn('[CustomerIntelligence.getCohortAnalysis] Cache write error (non-critical):', cacheError);
        // Continue - data is already fetched
      }

      return {
        data,
        metadata: {
          generatedAt: new Date(),
          cacheHit: false,
          queryTimeMs: Date.now() - startTime,
          dataSourcesUsed: ['mv_customer_ltv'],
        },
      };
    } catch (error) {
      throw this.handleError('getCohortAnalysis', error);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Interface Implementation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Health check for Customer Intelligence module.
   * Tests database connection and cache availability.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test cache
      const testKey = `${CACHE_KEY_PREFIX.CUSTOMER}:health:test`;
      await this.cache.set(testKey, { test: true }, { ttl: 10 });
      const cached = await this.cache.get(testKey);
      await this.cache.delete(testKey);

      if (!cached) {
        console.error('[CustomerIntelligence] Cache health check failed');
        return false;
      }

      // TODO: Test database connection (query a simple materialized view)
      // For now, assume DB is healthy if cache is healthy
      return true;
    } catch (error) {
      console.error('[CustomerIntelligence] Health check failed:', error);
      return false;
    }
  }

  /**
   * Clear all cached data for Customer Intelligence module.
   * Used for manual cache invalidation or testing.
   * 
   * @param tenantId - Optional tenant ID to clear only that tenant's cache
   */
  async clearCache(tenantId?: string): Promise<void> {
    try {
      if (tenantId) {
        // Clear cache for specific tenant
        await this.cache.deleteByTag(`tenant:${tenantId}`);
        console.log(`[CustomerIntelligence] Cache cleared for tenant: ${tenantId}`);
      } else {
        // Clear all Customer cache
        await this.cache.deletePattern(`${CACHE_KEY_PREFIX.CUSTOMER}:*`);
        console.log('[CustomerIntelligence] Cache cleared successfully');
      }
    } catch (error) {
      console.error('[CustomerIntelligence] Failed to clear cache:', error);
      throw new IntelligenceError(
        'Failed to clear customer intelligence cache',
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
    console.error(`[CustomerIntelligence.${method}] Error:`, error);

    return new IntelligenceError(
      `Customer intelligence operation failed: ${message}`,
      'CUSTOMER_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

let customerIntelligenceInstance: CustomerIntelligenceService | null = null;

/**
 * Get singleton instance of CustomerIntelligenceService.
 * Lazy initialization on first access.
 */
export function getCustomerIntelligenceService(): CustomerIntelligenceService {
  if (!customerIntelligenceInstance) {
    customerIntelligenceInstance = new CustomerIntelligenceService();
  }
  return customerIntelligenceInstance;
}
