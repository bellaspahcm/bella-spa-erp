/**
 * Multi-Tier Cache Strategy
 * 
 * Orchestrates Memory → Redis → Database fallback.
 * 
 * Cache Hierarchy:
 * 1. Memory Cache (L1): Fastest, process-local, < 1ms
 * 2. Redis Cache (L2): Fast, shared, 1-5ms
 * 3. Database (L3): Slowest, source of truth, 10-100ms
 * 
 * Read Flow:
 * 1. Check Memory Cache → If hit, return immediately
 * 2. Check Redis Cache → If hit, backfill Memory Cache, return
 * 3. Query Database → If hit, backfill both caches, return
 * 
 * Write Flow:
 * 1. Write to Memory Cache
 * 2. Write to Redis Cache (async, fire-and-forget)
 * 3. Database writes are NOT handled by cache layer
 * 
 * Invalidation Flow:
 * 1. Delete from Memory Cache
 * 2. Delete from Redis Cache
 * 3. Next read will fetch fresh data from Database
 */

import type { CacheService, CacheOptions, CacheStats } from '../shared/types';
import { CacheError } from '../shared/types';
import { MemoryCache, getMemoryCache, resetMemoryCache } from './memory-cache';
import { RedisCache, getRedisCache, resetRedisCache } from './redis-cache';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MultiTierCacheConfig {
  /**
   * Enable Memory Cache (L1).
   * @default true
   */
  enableMemory?: boolean;

  /**
   * Enable Redis Cache (L2).
   * @default true
   */
  enableRedis?: boolean;

  /**
   * Memory cache TTL multiplier.
   * Memory cache will have shorter TTL than Redis to ensure freshness.
   * @default 0.5 (50% of Redis TTL)
   */
  memoryTTLMultiplier?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Tier Cache Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class MultiTierCache implements CacheService {
  private memory: MemoryCache | null = null;
  private redis: RedisCache | null = null;
  private readonly memoryTTLMultiplier: number;

  constructor(config: MultiTierCacheConfig = {}) {
    const enableMemory = config.enableMemory ?? true;
    const enableRedis = config.enableRedis ?? true;
    this.memoryTTLMultiplier = config.memoryTTLMultiplier ?? 0.5;

    if (enableMemory) {
      this.memory = getMemoryCache({
        defaultTTL: 150, // 2.5 minutes (50% of Redis default 5min)
        maxSize: 10000,
        autoCleanup: true,
        cleanupIntervalSeconds: 60,
      });
    }

    if (enableRedis) {
      this.redis = getRedisCache({
        defaultTTL: 300, // 5 minutes
        keyPrefix: 'intelligence:',
      });
    }

    if (!enableMemory && !enableRedis) {
      console.warn('[MultiTierCache] Both Memory and Redis caches are disabled. Performance will be degraded.');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    try {
      // L1: Check Memory Cache
      if (this.memory) {
        const memoryValue = await this.memory.get<T>(key);
        if (memoryValue !== null) {
          return memoryValue;
        }
      }

      // L2: Check Redis Cache (with error handling)
      if (this.redis) {
        try {
          const redisValue = await this.redis.get<T>(key);
          if (redisValue !== null) {
            // Backfill Memory Cache
            if (this.memory) {
              await this.memory.set(key, redisValue, {
                ttl: 150, // Memory cache has shorter TTL
              });
            }
            return redisValue;
          }
        } catch (redisError) {
          // Redis error: log but don't fail entire request
          console.warn(`[MultiTierCache] Redis cache error for key "${key}":`, redisError instanceof Error ? redisError.message : 'Unknown');
          // Continue to return null (cache miss) rather than throwing
        }
      }

      // L3: Database query should be handled by caller
      return null;
    } catch (error) {
      throw new CacheError(
        `Failed to get key "${key}" from multi-tier cache`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      // Write to Memory Cache (if enabled)
      if (this.memory) {
        const memoryTTL = options?.ttl
          ? Math.floor(options.ttl * this.memoryTTLMultiplier)
          : undefined;

        promises.push(
          this.memory.set(key, value, {
            ...options,
            ttl: memoryTTL,
          })
        );
      }

      // Write to Redis Cache (if enabled) - with error handling
      if (this.redis) {
        promises.push(
          this.redis.set(key, value, options).catch(redisError => {
            // Redis error: log but don't fail entire request
            console.warn(`[MultiTierCache] Redis cache write error for key "${key}":`, redisError instanceof Error ? redisError.message : 'Unknown');
            // Don't re-throw - allow request to continue with Memory cache only
          })
        );
      }

      // Wait for all writes to complete (Redis errors are caught above)
      await Promise.all(promises);
    } catch (error) {
      throw new CacheError(
        `Failed to set key "${key}" in multi-tier cache`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      if (this.memory) {
        promises.push(this.memory.delete(key));
      }

      if (this.redis) {
        promises.push(this.redis.delete(key));
      }

      await Promise.all(promises);
    } catch (error) {
      throw new CacheError(
        `Failed to delete key "${key}" from multi-tier cache`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      if (this.memory) {
        promises.push(this.memory.deletePattern(pattern));
      }

      if (this.redis) {
        promises.push(this.redis.deletePattern(pattern));
      }

      await Promise.all(promises);
    } catch (error) {
      throw new CacheError(
        `Failed to delete pattern "${pattern}" from multi-tier cache`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async deleteByTag(tag: string): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      if (this.memory) {
        promises.push(this.memory.deleteByTag(tag));
      }

      if (this.redis) {
        promises.push(this.redis.deleteByTag(tag));
      }

      await Promise.all(promises);
    } catch (error) {
      throw new CacheError(
        `Failed to delete by tag "${tag}" from multi-tier cache`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      // Get stats from Redis (more comprehensive)
      if (this.redis) {
        return await this.redis.getStats();
      }

      // Fallback to Memory stats
      if (this.memory) {
        return await this.memory.getStats();
      }

      // No cache enabled
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalKeys: 0,
        memoryUsedBytes: 0,
      };
    } catch (error) {
      throw new CacheError(
        'Failed to get stats from multi-tier cache',
        error instanceof Error ? error : undefined
      );
    }
  }

  async clear(): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      if (this.memory) {
        promises.push(this.memory.clear());
      }

      if (this.redis) {
        promises.push(this.redis.clear());
      }

      await Promise.all(promises);
    } catch (error) {
      throw new CacheError(
        'Failed to clear multi-tier cache',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Health check for all cache layers.
   * Returns true if at least one cache layer is operational.
   */
  async healthCheck(): Promise<boolean> {
    const checks: boolean[] = [];

    if (this.memory) {
      // Memory cache is always healthy if instantiated
      checks.push(true);
    }

    if (this.redis) {
      const redisHealthy = await this.redis.healthCheck();
      checks.push(redisHealthy);
    }

    // At least one cache layer must be healthy
    return checks.some(healthy => healthy);
  }

  /**
   * Get detailed health status for all cache layers.
   */
  async getHealthStatus(): Promise<{
    memory: boolean;
    redis: boolean;
    overall: boolean;
  }> {
    const memoryHealthy = this.memory !== null;
    const redisHealthy = this.redis ? await this.redis.healthCheck() : false;
    const overall = memoryHealthy || redisHealthy;

    return {
      memory: memoryHealthy,
      redis: redisHealthy,
      overall,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global singleton instance of MultiTierCache.
 */
let multiTierCacheInstance: MultiTierCache | null = null;

/**
 * Get or create the singleton MultiTierCache instance.
 */
export function getCache(config?: MultiTierCacheConfig): MultiTierCache {
  if (!multiTierCacheInstance) {
    const isTestEnv = process.env.NODE_ENV === 'test';
    const redisUrl = process.env.REDIS_URL;
    const isLocalhostRedis = redisUrl?.includes('localhost') || redisUrl?.includes('127.0.0.1');
    const isVercel = process.env.VERCEL === '1';
    
    // Automatically disable Redis on Vercel if it misconfigures to localhost
    const hasValidRedis = !!redisUrl && !(isVercel && isLocalhostRedis);

    multiTierCacheInstance = new MultiTierCache({
      enableMemory: true,
      enableRedis: !isTestEnv && hasValidRedis,
      ...config,
    });
  }
  return multiTierCacheInstance;
}

/**
 * Reset the singleton instance.
 * Used in testing or when changing configuration.
 */
export function resetCache(): void {
  // Also reset Memory and Redis cache singletons
  if (multiTierCacheInstance) {
    try {
      multiTierCacheInstance.clear();
    } catch (e) {
      // Ignore errors during cleanup
    }
  }
  
  multiTierCacheInstance = null;
  resetMemoryCache();
  resetRedisCache();
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export type { MultiTierCacheConfig };

// Re-export individual cache implementations
export { MemoryCache, getMemoryCache, resetMemoryCache } from './memory-cache';
export { RedisCache, getRedisCache, resetRedisCache } from './redis-cache';
export type { MemoryCacheConfig } from './memory-cache';
export type { RedisCacheConfig } from './redis-cache';

