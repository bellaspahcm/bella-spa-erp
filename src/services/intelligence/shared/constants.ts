/**
 * Intelligence Layer - Constants
 * 
 * Shared constants used across all intelligence modules.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Cache Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default cache TTL (Time-To-Live) in seconds.
 */
export const DEFAULT_CACHE_TTL = {
  /**
   * Memory cache TTL (L1).
   * Short TTL to ensure freshness.
   */
  MEMORY: 150, // 2.5 minutes

  /**
   * Redis cache TTL (L2).
   * Longer TTL as Redis is shared across instances.
   */
  REDIS: 300, // 5 minutes

  /**
   * Executive metrics cache TTL.
   * Can be longer as these are aggregated views.
   */
  EXECUTIVE: 600, // 10 minutes

  /**
   * Operational metrics cache TTL.
   * Medium TTL matching materialized view refresh rates (5-10 min).
   */
  OPERATIONAL: 600, // 10 minutes

  /**
   * Finance metrics cache TTL.
   * Longer as financial data changes less frequently.
   */
  FINANCE: 900, // 15 minutes

  /**
   * Marketing metrics cache TTL.
   * Medium TTL as campaign data updates frequently.
   */
  MARKETING: 300, // 5 minutes

  /**
   * Sales metrics cache TTL.
   * Short TTL as sales pipeline changes frequently.
   */
  SALES: 180, // 3 minutes

  /**
   * HR metrics cache TTL.
   * Medium TTL as HR data updates moderately.
   */
  HR: 300, // 5 minutes

  /**
   * Customer metrics cache TTL.
   * Medium TTL as customer data updates moderately.
   */
  CUSTOMER: 300, // 5 minutes

  /**
   * Forecast cache TTL.
   * Longer as forecasts are computationally expensive.
   */
  FORECAST: 1800, // 30 minutes

  /**
   * Recommendation cache TTL.
   * Longer as recommendations are computationally expensive.
   */
  RECOMMENDATION: 1800, // 30 minutes
};

// ─────────────────────────────────────────────────────────────────────────────
// Cache Key Prefixes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache key prefixes for different intelligence modules.
 * Used to namespace cache keys and enable pattern-based invalidation.
 */
export const CACHE_KEY_PREFIX = {
  EXECUTIVE: 'executive:',
  OPERATIONAL: 'operational:',
  FINANCE: 'finance:',
  MARKETING: 'marketing:',
  SALES: 'sales:',
  HR: 'hr:',
  CUSTOMER: 'customer:',
  FORECAST: 'forecast:',
  RECOMMENDATION: 'recommendation:',
};

// ─────────────────────────────────────────────────────────────────────────────
// Cache Tags
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache tags for grouping related cache entries.
 * Used for bulk invalidation by tag.
 */
export const CACHE_TAG = {
  EXECUTIVE: 'executive',
  OPERATIONAL: 'operational',
  FINANCE: 'finance',
  MARKETING: 'marketing',
  SALES: 'sales',
  HR: 'hr',
  CUSTOMER: 'customer',
  FORECAST: 'forecast',
  RECOMMENDATION: 'recommendation',
};

// ─────────────────────────────────────────────────────────────────────────────
// Event Listener Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Event listener polling interval in milliseconds.
 * How often to poll accounting_outbox for new events.
 */
export const EVENT_POLLING_INTERVAL_MS = 5000; // 5 seconds

/**
 * Maximum number of events to process per poll.
 */
export const MAX_EVENTS_PER_POLL = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Query Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum number of items to return in a single query.
 */
export const MAX_QUERY_LIMIT = 1000;

/**
 * Default number of items to return in a paginated query.
 */
export const DEFAULT_PAGE_SIZE = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Date Format
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard date format for database queries.
 * Format: YYYY-MM-DD
 */
export const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Standard datetime format for database queries.
 * Format: YYYY-MM-DD HH:mm:ss
 */
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

// ─────────────────────────────────────────────────────────────────────────────
// Module Names
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intelligence module names.
 * Used for logging and debugging.
 */
export const MODULE_NAME = {
  EXECUTIVE: 'executive',
  OPERATIONAL: 'operational',
  FINANCE: 'finance',
  MARKETING: 'marketing',
  SALES: 'sales',
  HR: 'hr',
  CUSTOMER: 'customer',
  FORECAST: 'forecast',
  RECOMMENDATION: 'recommendation',
} as const;
