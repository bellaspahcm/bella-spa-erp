/**
 * Cache Configuration - Performance Tuning
 * Phase 8: Optimization & Production Readiness
 * 
 * Centralized cache configuration with optimized TTL values
 */

// ============================================================================
// CACHE TTL CONFIGURATION (in milliseconds)
// ============================================================================

export const CACHE_TTL = {
  // Forecast caching (balance between freshness and performance)
  FORECAST_REVENUE: 12 * 60 * 60 * 1000, // 12 hours (longer for revenue - changes slowly)
  FORECAST_CHURN: 24 * 60 * 60 * 1000, // 24 hours (churn risk doesn't change daily)
  FORECAST_DEMAND: 6 * 60 * 60 * 1000, // 6 hours (demand patterns change more frequently)
  FORECAST_ACCURACY: 24 * 60 * 60 * 1000, // 24 hours (metrics updated daily)
  
  // Recommendation caching
  RECOMMENDATION_SERVICE: 6 * 60 * 60 * 1000, // 6 hours (customer preferences change slowly)
  RECOMMENDATION_PACKAGE: 12 * 60 * 60 * 1000, // 12 hours (packages change infrequently)
  RECOMMENDATION_UPSELL: 3 * 60 * 60 * 1000, // 3 hours (upsell patterns more dynamic)
  
  // Customer data caching
  CUSTOMER_CONTEXT: 2 * 60 * 60 * 1000, // 2 hours
  CUSTOMER_INTERACTIONS: 6 * 60 * 60 * 1000, // 6 hours (syncs with MV refresh)
  
  // Reference data caching (rarely changes)
  SERVICES_CATALOG: 24 * 60 * 60 * 1000, // 24 hours
  PACKAGES_CATALOG: 24 * 60 * 60 * 1000, // 24 hours
  SERVICE_RATINGS: 6 * 60 * 60 * 1000, // 6 hours
} as const;

// ============================================================================
// CACHE EVICTION POLICIES
// ============================================================================

export const CACHE_LIMITS = {
  // Maximum cache entries per tenant
  MAX_FORECAST_CACHE_PER_TENANT: 1000,
  MAX_RECOMMENDATION_CACHE_PER_TENANT: 5000,
  
  // LRU eviction threshold (percentage)
  EVICTION_THRESHOLD: 0.9, // Evict when 90% full
  
  // Stale entry cleanup (not accessed in X hours)
  STALE_THRESHOLD_HOURS: 48,
} as const;

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

export function generateForecastCacheKey(params: {
  tenantId: string;
  forecastType: string;
  horizon: number;
  modelName?: string;
}): string {
  const { tenantId, forecastType, horizon, modelName } = params;
  return `forecast:${tenantId}:${forecastType}:${horizon}:${modelName || 'auto'}`;
}

export function generateRecommendationCacheKey(params: {
  tenantId: string;
  customerId: string;
  type: string;
  context?: Record<string, unknown>;
}): string {
  const { tenantId, customerId, type, context } = params;
  const contextStr = context ? JSON.stringify(context) : '';
  return `rec:${tenantId}:${customerId}:${type}:${contextStr}`;
}

// ============================================================================
// CACHE WARMING STRATEGIES
// ============================================================================

export const CACHE_WARMING = {
  // Pre-warm cache for high-value customers
  WARM_TOP_CUSTOMERS: true,
  TOP_CUSTOMER_COUNT: 100, // Top 100 customers by LTV
  
  // Pre-warm popular recommendations
  WARM_POPULAR_ITEMS: true,
  POPULAR_ITEMS_COUNT: 50,
  
  // Warming schedule (cron expression)
  WARMING_SCHEDULE: '0 1 * * *', // Daily at 1:00 AM
} as const;

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

export const CACHE_METRICS = {
  // Track these metrics for monitoring
  TRACK_HIT_RATE: true,
  TRACK_LATENCY: true,
  TRACK_SIZE: true,
  
  // Alert thresholds
  MIN_HIT_RATE: 0.80, // Alert if hit rate < 80%
  MAX_MISS_LATENCY_MS: 500, // Alert if cache miss > 500ms
} as const;

// ============================================================================
// CACHE INVALIDATION RULES
// ============================================================================

export const CACHE_INVALIDATION = {
  // Invalidate forecast cache when new data arrives
  ON_NEW_DATA: true,
  
  // Invalidate recommendation cache on these events
  ON_NEW_PURCHASE: true,
  ON_CUSTOMER_UPDATE: false, // Too frequent
  ON_SERVICE_UPDATE: true,
  ON_PACKAGE_UPDATE: true,
  
  // Batch invalidation (wait X seconds before invalidating)
  BATCH_DELAY_MS: 5000, // 5 seconds
} as const;
