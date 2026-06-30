/**
 * Intelligence Layer - Main Entry Point
 * 
 * The Intelligence Layer is a semantic layer between:
 * - Data: Database Views, Materialized Views, Stored Procedures
 * - Consumers: AI Agents, Dashboard, Reports, Export APIs
 * 
 * Architecture:
 * - Extension, NOT Refactoring (reuses existing Modular Monolith)
 * - Read-Only Operations (no business transactions)
 * - Event-Driven Cache Invalidation (reuses Accounting Outbox Pattern)
 * - Multi-Tier Caching (Memory → Redis → Database)
 * 
 * Phase 0 Status: Foundation Complete ✅
 * - ✅ Project structure (8 domains + shared)
 * - ✅ Base types & interfaces
 * - ✅ Memory Cache (L1)
 * - ✅ Redis Cache (L2)
 * - ✅ Multi-Tier Cache Strategy
 * - ✅ Business Event Listener
 * - ✅ Cache Invalidation Handler
 * - ✅ Shared utilities & constants
 * 
 * Next Phase: Phase 1 - Executive Intelligence MVP (Week 3-6)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared Types, Constants, Helpers
// ─────────────────────────────────────────────────────────────────────────────

export * from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Cache Layer
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Multi-Tier Cache (main interface)
  MultiTierCache,
  getCache,
  resetCache,

  // Individual cache implementations
  MemoryCache,
  getMemoryCache,
  resetMemoryCache,
  RedisCache,
  getRedisCache,
  resetRedisCache,
} from './cache';

export type {
  MultiTierCacheConfig,
  MemoryCacheConfig,
  RedisCacheConfig,
} from './cache';

// ─────────────────────────────────────────────────────────────────────────────
// Event System
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Event Listener
  BusinessEventListener,
  getEventListener,
  resetEventListener,

  // Cache Invalidation
  cacheInvalidationHandler,
  registerCacheInvalidation,
} from './events';

// ─────────────────────────────────────────────────────────────────────────────
// Domain Modules (Placeholder - Implemented in Future Phases)
// ─────────────────────────────────────────────────────────────────────────────

// Phase 1: Executive Intelligence (Week 3-6)
// export * from './executive';

// Phase 2: Finance Intelligence (Week 7-10)
// export * from './finance';

// Phase 3: Marketing Intelligence (Week 11-14)
// export * from './marketing';

// Phase 4: Sales Intelligence (Week 15-18)
// export * from './sales';

// Phase 5: HR Intelligence (Week 19-22)
// export * from './hr';

// Phase 6: Customer Intelligence (Week 23-26)
// export * from './customer';

// Phase 7: Forecast Intelligence (Week 27-32)
// export * from './forecast';
// export * from './recommendation';

// ─────────────────────────────────────────────────────────────────────────────
// Initialization Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize Intelligence Layer.
 * Call this once during app startup.
 * 
 * @param config - Configuration options
 * @returns Promise that resolves when initialization is complete
 * 
 * @example
 * ```typescript
 * import { initializeIntelligence } from '@/services/intelligence';
 * 
 * // In your app initialization (e.g., layout.tsx or middleware)
 * await initializeIntelligence({
 *   enableCache: true,
 *   enableEvents: true,
 * });
 * ```
 */
export async function initializeIntelligence(config: {
  enableCache?: boolean;
  enableEvents?: boolean;
  tenantId?: string;
} = {}): Promise<void> {
  const { enableCache = true, enableEvents = true, tenantId } = config;

  console.info('[Intelligence] Initializing Intelligence Layer...');

  // Initialize cache (if enabled)
  if (enableCache) {
    // Import getCache dynamically to avoid circular dependency
    const { getCache: getCacheInstance } = await import('./cache');
    const cache = getCacheInstance({
      enableMemory: true,
      enableRedis: true,
    });

    const healthStatus = await cache.getHealthStatus();
    console.info('[Intelligence] Cache initialized:', {
      memory: healthStatus.memory ? 'OK' : 'DISABLED',
      redis: healthStatus.redis ? 'OK' : 'DISABLED',
    });
  }

  // Initialize event listener (if enabled)
  if (enableEvents) {
    // Import getEventListener dynamically to avoid circular dependency
    const { getEventListener: getEventListenerInstance, registerCacheInvalidation: registerCache } = await import('./events');
    const eventListener = getEventListenerInstance({
      pollingIntervalMs: 5000,
      enableLogging: process.env.NODE_ENV === 'development',
      tenantId,
    });

    // Register cache invalidation handler
    registerCache(eventListener);

    // Start listening for events
    await eventListener.start();

    console.info('[Intelligence] Event listener started');
  }

  console.info('[Intelligence] Intelligence Layer initialized successfully ✅');
}

/**
 * Shutdown Intelligence Layer.
 * Call this during graceful shutdown.
 * 
 * @example
 * ```typescript
 * import { shutdownIntelligence } from '@/services/intelligence';
 * 
 * // In your shutdown handler
 * process.on('SIGTERM', async () => {
 *   await shutdownIntelligence();
 *   process.exit(0);
 * });
 * ```
 */
export async function shutdownIntelligence(): Promise<void> {
  console.info('[Intelligence] Shutting down Intelligence Layer...');

  // Stop event listener
  const { getEventListener: getEventListenerInstance } = await import('./events');
  const eventListener = getEventListenerInstance();
  await eventListener.stop();

  // Clear cache (optional - only in testing)
  // const { getCache: getCacheInstance } = await import('./cache');
  // await getCacheInstance().clear();

  console.info('[Intelligence] Intelligence Layer shut down successfully');
}
