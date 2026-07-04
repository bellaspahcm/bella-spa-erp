/**
 * Decision Engine Platform - Cache Module
 * 
 * Cache abstraction layer for Decision Engine Platform.
 * Provides interfaces, strategies, and utilities for caching decision results.
 * 
 * @module cache
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 15
 */

// Cache interface and config
export type {
  ICache,
  CacheStats,
  CacheConfig,
  CacheEntry,
} from './ICache';

export { createCacheConfig } from './ICache';

// Cache strategies
export type { ICacheStrategy } from './ICacheStrategy';

export {
  DefaultCacheStrategy,
  ConservativeCacheStrategy,
  AggressiveCacheStrategy,
  NoCacheStrategy,
  RuleBasedCacheStrategy,
  createCacheStrategy,
} from './ICacheStrategy';

// Cache implementations
export { InMemoryCache, createInMemoryCache } from './InMemoryCache';

export {
  RedisCache,
  createRedisCache,
  createRedisCacheFromUrl,
} from './RedisCache';

export type { RedisCacheConfig } from './RedisCache';

// Cache utilities
export {
  generateDecisionCacheKey,
  generateRuleCacheKey,
  generateBIQueryCacheKey,
  generateMLModelCacheKey,
  generateInvalidationPattern,
  generateTimedCacheKey,
  hashObject,
  sortObjectKeys,
  parseCacheKey,
  matchesCachePattern,
  calculateValueSize,
  formatBytes,
} from './utils';
