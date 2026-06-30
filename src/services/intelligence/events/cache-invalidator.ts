/**
 * Cache Invalidator
 * 
 * Event handler that invalidates cache when business events occur.
 * Registered with BusinessEventListener to receive events.
 * 
 * Invalidation Strategy:
 * - Domain-specific: Invalidate only affected domain caches
 * - Pattern-based: Use cache key patterns to invalidate related entries
 * - Tag-based: Use cache tags to bulk invalidate
 * 
 * Examples:
 * - BOOKING_CONFIRMED → Invalidate sales:*, customer:*, executive:*
 * - SESSION_COMPLETED → Invalidate hr:*, executive:*
 * - EXPENSE_RECORDED → Invalidate finance:*, executive:*
 * - SALARY_FINALIZED → Invalidate hr:*, finance:*, executive:*
 */

import { BusinessEventType, type BusinessEvent, type EventHandler } from '../shared/types';
import { getCache } from '../cache';

// ─────────────────────────────────────────────────────────────────────────────
// Cache Invalidation Rules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map business event types to cache patterns/tags that should be invalidated.
 */
const INVALIDATION_RULES: Record<BusinessEventType, string[]> = {
  // Booking events affect sales, customer, and executive domains
  [BusinessEventType.BOOKING_CREATED]: [
    'sales:*',
    'customer:*',
    'executive:*',
  ],
  [BusinessEventType.BOOKING_CONFIRMED]: [
    'sales:*',
    'customer:*',
    'executive:*',
    'finance:*', // Revenue recognition
  ],
  [BusinessEventType.BOOKING_CANCELLED]: [
    'sales:*',
    'customer:*',
    'executive:*',
    'finance:*', // Refund
  ],
  [BusinessEventType.BOOKING_COMPLETED]: [
    'sales:*',
    'customer:*',
    'executive:*',
  ],

  // Session events affect HR and customer domains
  [BusinessEventType.SESSION_COMPLETED]: [
    'hr:*',
    'customer:*',
    'executive:*',
  ],
  [BusinessEventType.SESSION_REVIEWED]: [
    'hr:*',
    'customer:*',
  ],

  // Revenue events affect finance and executive domains
  [BusinessEventType.REVENUE_RECORDED]: [
    'finance:*',
    'executive:*',
  ],
  [BusinessEventType.PAYMENT_RECEIVED]: [
    'finance:*',
    'executive:*',
  ],

  // Expense events affect finance and executive domains
  [BusinessEventType.EXPENSE_RECORDED]: [
    'finance:*',
    'executive:*',
  ],
  [BusinessEventType.EXPENSE_APPROVED]: [
    'finance:*',
    'executive:*',
  ],

  // Salary events affect HR, finance, and executive domains
  [BusinessEventType.SALARY_PUBLISHED]: [
    'hr:*',
    'finance:*',
    'executive:*',
  ],
  [BusinessEventType.SALARY_CONFIRMED]: [
    'hr:*',
    'finance:*',
    'executive:*',
  ],
  [BusinessEventType.SALARY_FINALIZED]: [
    'hr:*',
    'finance:*',
    'executive:*',
  ],

  // Customer events affect customer and marketing domains
  [BusinessEventType.CUSTOMER_CREATED]: [
    'customer:*',
    'marketing:*',
    'executive:*',
  ],
  [BusinessEventType.CUSTOMER_UPDATED]: [
    'customer:*',
  ],

  // HR events affect HR and executive domains
  [BusinessEventType.EMPLOYEE_HIRED]: [
    'hr:*',
    'executive:*',
  ],
  [BusinessEventType.EMPLOYEE_TERMINATED]: [
    'hr:*',
    'executive:*',
  ],
  [BusinessEventType.ATTENDANCE_MARKED]: [
    'hr:*',
  ],

  // Marketing events affect marketing and executive domains
  [BusinessEventType.CAMPAIGN_STARTED]: [
    'marketing:*',
    'executive:*',
  ],
  [BusinessEventType.CAMPAIGN_ENDED]: [
    'marketing:*',
    'executive:*',
  ],

  // Accounting events affect finance and executive domains
  [BusinessEventType.PERIOD_CLOSED]: [
    'finance:*',
    'executive:*',
  ],
  [BusinessEventType.JOURNAL_ENTRY_POSTED]: [
    'finance:*',
    'executive:*',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Cache Invalidation Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Event handler that invalidates cache based on business events.
 */
export const cacheInvalidationHandler: EventHandler = async (event: BusinessEvent) => {
  try {
    const cache = getCache();
    const patterns = INVALIDATION_RULES[event.eventType];

    if (!patterns || patterns.length === 0) {
      console.debug(`[CacheInvalidator] No invalidation rules for ${event.eventType}`);
      return;
    }

    console.log(
      `[CacheInvalidator] Invalidating cache for ${event.eventType} (${patterns.length} patterns)`
    );

    // Invalidate all matching patterns
    const promises = patterns.map(pattern =>
      cache.deletePattern(pattern).catch((error) => {
        console.error(`[CacheInvalidator] Failed to invalidate pattern "${pattern}":`, error);
        // Don't throw - continue invalidating other patterns
      })
    );

    await Promise.all(promises);

    console.log(
      `[CacheInvalidator] Successfully invalidated cache for ${event.eventType}`
    );
  } catch (error) {
    console.error(
      `[CacheInvalidator] Error invalidating cache for ${event.eventType}:`,
      error instanceof Error ? error.message : error
    );
    // Don't throw - event handler errors should not break the system
  }
};

/**
 * Register cache invalidation handler with event listener.
 * Call this once during app initialization.
 */
export function registerCacheInvalidation(eventListener: { onMany: (events: BusinessEventType[], handler: EventHandler) => void }): void {
  // Register handler for all event types
  const allEventTypes = Object.values(BusinessEventType);
  eventListener.onMany(allEventTypes, cacheInvalidationHandler);

  console.info('[CacheInvalidator] Registered cache invalidation handler for all event types');
}
