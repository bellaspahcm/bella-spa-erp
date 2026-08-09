/**
 * Intelligence Layer - Shared Types & Interfaces
 * 
 * Base interfaces for all Intelligence modules.
 * These interfaces define the contracts between:
 * - Intelligence Layer ↔ Consumers (AI Agents, Dashboard, Reports)
 * - Intelligence Layer ↔ Cache Layer
 * - Intelligence Layer ↔ Event Infrastructure
 */

// ─────────────────────────────────────────────────────────────────────────────
// Common Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Time period for filtering data.
 * Used across all intelligence modules.
 */
export type TimePeriod = 
  | 'day'       // Single day
  | 'week'      // 7 days
  | 'month'     // 30 days
  | 'quarter'   // 90 days
  | 'year'      // 365 days
  | 'custom';   // Custom date range

/**
 * Date range for custom periods.
 */
export interface DateRange {
  startDate: Date | string;
  endDate: Date | string;
}

/**
 * Common query parameters for all intelligence modules.
 */
export interface BaseIntelligenceParams {
  tenantId: string;
  period?: TimePeriod;
  dateRange?: DateRange;
}

/**
 * Standard metadata returned with all intelligence responses.
 */
export interface IntelligenceMetadata {
  generatedAt: Date;
  cacheHit: boolean;
  queryTimeMs: number;
  dataSourcesUsed: string[]; // ['mv_executive_summary', 'v_sales_pipeline', ...]
}

/**
 * Standard response wrapper for all intelligence modules.
 */
export interface IntelligenceResponse<T> {
  data: T;
  metadata: IntelligenceMetadata;
}

// ─────────────────────────────────────────────────────────────────────────────
// Base Intelligence Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base interface for all intelligence modules.
 * Each domain (Executive, Finance, Marketing, etc.) implements this interface.
 */
export interface IntelligenceService {
  /**
   * Module name (e.g., 'executive', 'finance', 'marketing').
   */
  readonly moduleName: string;

  /**
   * Health check for the module.
   * Returns true if module is operational (can connect to DB, cache, etc.).
   */
  healthCheck(): Promise<boolean>;

  /**
   * Clear all cached data for this module.
   * Used for manual cache invalidation or testing.
   */
  clearCache(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cache expiration options.
 */
export interface CacheOptions {
  /**
   * Time-to-live in seconds.
   * If not provided, uses default TTL for the cache layer.
   */
  ttl?: number;

  /**
   * Tags for grouping related cache entries.
   * Used for bulk invalidation (e.g., invalidate all 'finance' tagged entries).
   */
  tags?: string[];
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number; // 0.0 to 1.0
  totalKeys: number;
  memoryUsedBytes?: number;
}

/**
 * Multi-tier cache service.
 * Orchestrates Memory → Redis → Database fallback.
 */
export interface CacheService {
  /**
   * Get value from cache.
   * Returns null if not found or expired.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set value in cache.
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Delete single key from cache.
   */
  delete(key: string): Promise<void>;

  /**
   * Delete all keys matching a pattern.
   * Example: deletePattern('finance:*') deletes all finance-related cache entries.
   */
  deletePattern(pattern: string): Promise<void>;

  /**
   * Delete all keys with a specific tag.
   * Example: deleteByTag('finance') deletes all entries tagged with 'finance'.
   */
  deleteByTag(tag: string): Promise<void>;

  /**
   * Get cache statistics.
   */
  getStats(): Promise<CacheStats>;

  /**
   * Clear all cache entries.
   * Use with caution in production!
   */
  clear(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event System Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Business event types.
 * Emitted when significant business actions occur.
 */
export enum BusinessEventType {
  // Booking events
  BOOKING_CREATED = 'booking.created',
  BOOKING_CONFIRMED = 'booking.confirmed',
  BOOKING_CANCELLED = 'booking.cancelled',
  BOOKING_COMPLETED = 'booking.completed',

  // Session events
  SESSION_COMPLETED = 'session.completed',
  SESSION_REVIEWED = 'session.reviewed',

  // Revenue events
  REVENUE_RECORDED = 'revenue.recorded',
  PAYMENT_RECEIVED = 'payment.received',

  // Expense events
  EXPENSE_RECORDED = 'expense.recorded',
  EXPENSE_APPROVED = 'expense.approved',

  // Salary events
  SALARY_PUBLISHED = 'salary.published',
  SALARY_CONFIRMED = 'salary.confirmed',
  SALARY_FINALIZED = 'salary.finalized',

  // Customer events
  CUSTOMER_CREATED = 'customer.created',
  CUSTOMER_UPDATED = 'customer.updated',

  // HR events
  EMPLOYEE_HIRED = 'employee.hired',
  EMPLOYEE_TERMINATED = 'employee.terminated',
  ATTENDANCE_MARKED = 'attendance.marked',

  // Marketing events
  CAMPAIGN_STARTED = 'campaign.started',
  CAMPAIGN_ENDED = 'campaign.ended',

  // Accounting events
  PERIOD_CLOSED = 'period.closed',
  JOURNAL_ENTRY_POSTED = 'journal_entry.posted',
}

/**
 * Business event payload.
 */
export interface BusinessEvent {
  eventType: BusinessEventType;
  tenantId: string;
  entityId: string; // ID of the entity that triggered the event (booking_id, session_id, etc.)
  entityType: string; // 'booking', 'session', 'revenue', etc.
  timestamp: Date;
  payload: Record<string, unknown>; // Event-specific data
}

/**
 * Event handler function.
 */
export type EventHandler = (event: BusinessEvent) => Promise<void>;

/**
 * Event listener service.
 * Extends the Accounting Outbox Pattern to handle business events.
 */
export interface EventListener {
  /**
   * Register an event handler for a specific event type.
   */
  on(eventType: BusinessEventType, handler: EventHandler): void;

  /**
   * Register an event handler for multiple event types.
   */
  onMany(eventTypes: BusinessEventType[], handler: EventHandler): void;

  /**
   * Emit a business event.
   * Used by Intelligence Layer to trigger actions (e.g., cache invalidation).
   */
  emit(event: BusinessEvent): Promise<void>;

  /**
   * Start listening for events.
   * Called once during app initialization.
   */
  start(): Promise<void>;

  /**
   * Stop listening for events.
   * Called during graceful shutdown.
   */
  stop(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base error class for Intelligence Layer.
 */
export class IntelligenceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'IntelligenceError';
  }
}

/**
 * Error thrown when cache operation fails.
 */
export class CacheError extends IntelligenceError {
  constructor(message: string, cause?: Error) {
    super(message, 'CACHE_ERROR', cause);
    this.name = 'CacheError';
  }
}

/**
 * Error thrown when event system fails.
 */
export class EventError extends IntelligenceError {
  constructor(message: string, cause?: Error) {
    super(message, 'EVENT_ERROR', cause);
    this.name = 'EventError';
  }
}

/**
 * Error thrown when data query fails.
 */
export class QueryError extends IntelligenceError {
  constructor(message: string, cause?: Error) {
    super(message, 'QUERY_ERROR', cause);
    this.name = 'QueryError';
  }
}
