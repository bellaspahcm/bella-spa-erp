/**
 * Intelligence Layer - Events Module
 * 
 * Exports:
 * - BusinessEventListener: Polls accounting_outbox and emits business events
 * - cacheInvalidationHandler: Invalidates cache when events occur
 * - registerCacheInvalidation: Registers cache invalidation with event listener
 * 
 * Usage:
 * ```typescript
 * import { getEventListener, registerCacheInvalidation } from '@/services/intelligence/events';
 * 
 * // During app initialization
 * const eventListener = getEventListener();
 * registerCacheInvalidation(eventListener);
 * await eventListener.start();
 * ```
 */

export {
  BusinessEventListener,
  getEventListener,
  resetEventListener,
} from './event-listener';

export {
  cacheInvalidationHandler,
  registerCacheInvalidation,
} from './cache-invalidator';
