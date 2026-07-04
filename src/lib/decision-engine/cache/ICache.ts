/**
 * Decision Engine Platform - Cache Abstraction
 * 
 * Cache interface for Decision Engine Platform.
 * Supports both in-memory and distributed caching (Redis).
 * 
 * **Design Principle**: Cache is EXTERNAL to Decision Engine.
 * Engine itself remains stateless. Cache is used by:
 * - Providers (to cache rule definitions, BI results, ML models)
 * - Business Modules (to cache decision results)
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 15
 */

/**
 * Cache interface for Decision Engine Platform
 * 
 * Supports get/set/delete operations with TTL management.
 * Thread-safe and async-first design.
 * 
 * @example Basic Usage
 * ```typescript
 * const cache = new InMemoryCache();
 * 
 * // Set value with TTL (seconds)
 * await cache.set('key', { data: 'value' }, 300);
 * 
 * // Get value
 * const value = await cache.get<{ data: string }>('key');
 * 
 * // Delete value
 * await cache.delete('key');
 * 
 * // Clear all
 * await cache.clear();
 * ```
 */
export interface ICache {
  /**
   * Get value from cache
   * 
   * @param key - Cache key
   * @returns Promise<T | null> - Cached value or null if not found/expired
   * 
   * @example
   * ```typescript
   * const result = await cache.get<DecisionResult>('decision:auto-approval:tenant1:hash123');
   * if (result) {
   *   console.log('Cache hit:', result);
   * } else {
   *   console.log('Cache miss');
   * }
   * ```
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Set value in cache with optional TTL
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time-to-live in seconds (optional)
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * // Cache for 5 minutes (300 seconds)
   * await cache.set('decision:key', result, 300);
   * 
   * // Cache forever (no TTL)
   * await cache.set('rule:def', ruleDefinition);
   * ```
   */
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Delete value from cache
   * 
   * @param key - Cache key (supports wildcards for pattern deletion)
   * @returns Promise<number> - Number of keys deleted
   * 
   * @example
   * ```typescript
   * // Delete single key
   * await cache.delete('decision:key');
   * 
   * // Delete pattern (if supported by implementation)
   * await cache.delete('decision:tenant1:*');
   * ```
   */
  delete(key: string): Promise<number>;

  /**
   * Check if key exists in cache
   * 
   * @param key - Cache key
   * @returns Promise<boolean> - True if key exists and not expired
   * 
   * @example
   * ```typescript
   * if (await cache.has('decision:key')) {
   *   console.log('Key exists in cache');
   * }
   * ```
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear all cached values
   * 
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * await cache.clear();
   * console.log('All cache cleared');
   * ```
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   * 
   * @returns Promise<CacheStats>
   * 
   * @example
   * ```typescript
   * const stats = await cache.getStats();
   * console.log('Hit rate:', stats.hitRate);
   * ```
   */
  getStats(): Promise<CacheStats>;

  /**
   * Close cache connections and cleanup resources
   * 
   * @returns Promise<void>
   * 
   * @example
   * ```typescript
   * await cache.close();
   * ```
   */
  close(): Promise<void>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of get requests */
  hits: number;

  /** Total number of cache misses */
  misses: number;

  /** Cache hit rate (0.0 to 1.0) */
  hitRate: number;

  /** Number of keys currently in cache */
  keys: number;

  /** Memory usage in bytes (if applicable) */
  memoryUsage?: number;

  /** Maximum memory limit in bytes (if applicable) */
  memoryLimit?: number;

  /** Number of evictions due to memory/TTL */
  evictions: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Cache name (for logging and identification) */
  name?: string;

  /** Default TTL in seconds (if not specified in set()) */
  defaultTTL?: number;

  /** Maximum number of keys (for in-memory caches) */
  maxKeys?: number;

  /** Maximum memory in bytes (for in-memory caches) */
  maxMemory?: number;

  /** Eviction policy: 'lru' | 'lfu' | 'fifo' */
  evictionPolicy?: 'lru' | 'lfu' | 'fifo';

  /** Enable compression (for large values) */
  enableCompression?: boolean;

  /** Serialization format: 'json' | 'msgpack' */
  serializationFormat?: 'json' | 'msgpack';
}

/**
 * Cache entry metadata (internal use)
 */
export interface CacheEntry<T = unknown> {
  /** Cached value */
  value: T;

  /** Creation timestamp */
  createdAt: number;

  /** Expiration timestamp (if TTL set) */
  expiresAt?: number;

  /** Last access timestamp (for LRU) */
  lastAccessedAt: number;

  /** Access count (for LFU) */
  accessCount: number;

  /** Size in bytes (approximate) */
  size: number;
}

/**
 * Create default cache config
 * 
 * @param overrides - Config overrides
 * @returns Complete CacheConfig with defaults
 */
export function createCacheConfig(
  overrides?: Partial<CacheConfig>
): CacheConfig {
  return {
    name: 'decision-engine-cache',
    defaultTTL: 300, // 5 minutes
    maxKeys: 10000,
    maxMemory: 100 * 1024 * 1024, // 100MB
    evictionPolicy: 'lru',
    enableCompression: false,
    serializationFormat: 'json',
    ...overrides,
  };
}
