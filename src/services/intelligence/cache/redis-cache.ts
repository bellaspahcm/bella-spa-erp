/**
 * Redis Cache Implementation
 * 
 * Redis cache wrapper using ioredis client.
 * Persistent, shared cache across multiple instances.
 * 
 * Features:
 * - TTL-based expiration (automatic)
 * - Tag-based grouping (using Redis Sets)
 * - Pattern-based deletion (SCAN + DEL)
 * - JSON serialization/deserialization
 * - Connection pooling & auto-reconnect
 * 
 * Trade-offs:
 * - ✅ Shared across all instances
 * - ✅ Persistent (survives restarts)
 * - ✅ Large memory capacity (separate server)
 * - ❌ Network latency (1-5ms)
 * - ❌ Requires Redis server
 */

import Redis from 'ioredis';
import type { CacheService, CacheOptions, CacheStats } from '../shared/types';
import { CacheError } from '../shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RedisCacheConfig {
  /**
   * Redis connection URL.
   * @default process.env.REDIS_URL || 'redis://localhost:6379'
   */
  url?: string;

  /**
   * Redis key prefix (namespace).
   * @default 'intelligence:'
   */
  keyPrefix?: string;

  /**
   * Default TTL in seconds.
   * @default 600 (10 minutes)
   */
  defaultTTL?: number;

  /**
   * Max retry attempts for failed operations.
   * @default 3
   */
  maxRetries?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redis Cache Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class RedisCache implements CacheService {
  private redis: Redis;
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;
  private readonly maxRetries: number;

  // Track stats (approximate, as Redis doesn't track per-instance)
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(config: RedisCacheConfig = {}) {
    const url = config.url || process.env.REDIS_URL || 'redis://localhost:6379';
    this.keyPrefix = config.keyPrefix || 'intelligence:';
    this.defaultTTL = config.defaultTTL ?? 600; // 10 minutes
    this.maxRetries = config.maxRetries ?? 3;

    this.redis = new Redis(url, {
      keyPrefix: this.keyPrefix,
      retryStrategy: (times) => {
        if (times > this.maxRetries) {
          console.error('[RedisCache] Max retries exceeded, giving up');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 2000); // Exponential backoff, max 2s
        return delay;
      },
      maxRetriesPerRequest: this.maxRetries,
      enableReadyCheck: true,
      lazyConnect: false, // Connect immediately
      connectTimeout: 1500, // Timeout connection attempt after 1.5s
      enableOfflineQueue: false, // Return error immediately on connection loss instead of queuing commands
    });

    // Event handlers
    this.redis.on('error', (err) => {
      console.error('[RedisCache] Connection error:', err);
    });

    this.redis.on('connect', () => {
      console.info('[RedisCache] Connected to Redis');
    });

    this.redis.on('ready', () => {
      console.info('[RedisCache] Redis client ready');
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(value) as T;
    } catch (error) {
      // If JSON parse fails, return null instead of throwing
      if (error instanceof SyntaxError) {
        console.warn(`[RedisCache] Invalid JSON for key "${key}"`);
        await this.delete(key); // Delete corrupted entry
        return null;
      }

      throw new CacheError(
        `Failed to get key "${key}" from Redis`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl ?? this.defaultTTL;
      const tags = options?.tags ?? [];

      // Serialize value to JSON
      const serialized = JSON.stringify(value);

      // Set value with TTL (EX = seconds)
      await this.redis.setex(key, ttl, serialized);

      // Update tag index (if tags provided)
      if (tags.length > 0) {
        await this.updateTagIndex(key, tags);
      }
    } catch (error) {
      throw new CacheError(
        `Failed to set key "${key}" in Redis`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // Remove from tag index first
      await this.removeFromTagIndex(key);

      // Delete the key
      await this.redis.del(key);
    } catch (error) {
      throw new CacheError(
        `Failed to delete key "${key}" from Redis`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      // Use SCAN to find keys matching pattern (cursor-based iteration)
      const keysToDelete: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );

        cursor = nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== '0');

      // Delete in batches
      if (keysToDelete.length > 0) {
        const pipeline = this.redis.pipeline();
        for (const key of keysToDelete) {
          // Remove keyPrefix before calling delete (redis client adds it automatically)
          const unprefixedKey = key.startsWith(this.keyPrefix)
            ? key.substring(this.keyPrefix.length)
            : key;
          await this.delete(unprefixedKey);
        }
        await pipeline.exec();
      }
    } catch (error) {
      throw new CacheError(
        `Failed to delete pattern "${pattern}" from Redis`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async deleteByTag(tag: string): Promise<void> {
    try {
      const tagKey = this.getTagKey(tag);
      const keys = await this.redis.smembers(tagKey);

      if (keys.length === 0) return;

      // Delete all keys with this tag
      const pipeline = this.redis.pipeline();
      for (const key of keys) {
        pipeline.del(key);
      }
      pipeline.del(tagKey); // Delete tag index itself

      await pipeline.exec();
    } catch (error) {
      throw new CacheError(
        `Failed to delete by tag "${tag}" from Redis`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      // Get Redis INFO stats
      const info = await this.redis.info('stats');
      const lines = info.split('\r\n');

      let keyspaceHits = 0;
      let keyspaceMisses = 0;

      for (const line of lines) {
        if (line.startsWith('keyspace_hits:')) {
          keyspaceHits = parseInt(line.split(':')[1], 10);
        } else if (line.startsWith('keyspace_misses:')) {
          keyspaceMisses = parseInt(line.split(':')[1], 10);
        }
      }

      const totalRequests = keyspaceHits + keyspaceMisses;
      const hitRate = totalRequests > 0 ? keyspaceHits / totalRequests : 0;

      // Get memory usage
      const memoryInfo = await this.redis.info('memory');
      const memoryLine = memoryInfo.split('\r\n').find(l => l.startsWith('used_memory:'));
      const memoryUsedBytes = memoryLine ? parseInt(memoryLine.split(':')[1], 10) : 0;

      // Get total keys (approximate)
      const dbInfo = await this.redis.info('keyspace');
      const dbLine = dbInfo.split('\r\n').find(l => l.startsWith('db0:'));
      const totalKeys = dbLine
        ? parseInt(dbLine.match(/keys=(\d+)/)?.[1] || '0', 10)
        : 0;

      return {
        hits: keyspaceHits,
        misses: keyspaceMisses,
        hitRate,
        totalKeys,
        memoryUsedBytes,
      };
    } catch (_error) {
      // Return local stats if Redis INFO fails
      console.warn('[RedisCache] Failed to get Redis stats, using local approximation');
      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate,
        totalKeys: 0,
        memoryUsedBytes: 0,
      };
    }
  }

  async clear(): Promise<void> {
    try {
      // WARNING: FLUSHDB clears ALL keys in current database!
      // In production, consider using deletePattern('*') instead
      await this.redis.flushdb();
      this.resetStats();
    } catch (error) {
      throw new CacheError(
        'Failed to clear Redis cache',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Check if Redis is connected and responsive.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Gracefully disconnect from Redis.
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get Redis key for a tag index.
   */
  private getTagKey(tag: string): string {
    return `tag:${tag}`;
  }

  /**
   * Update tag index: Add key to all tag sets.
   */
  private async updateTagIndex(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tag of tags) {
      const tagKey = this.getTagKey(tag);
      pipeline.sadd(tagKey, key);
    }

    await pipeline.exec();
  }

  /**
   * Remove key from all tag indexes.
   */
  private async removeFromTagIndex(key: string): Promise<void> {
    // Find all tags containing this key (SCAN all tag: keys)
    let cursor = '0';
    const tagKeys: string[] = [];

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${this.keyPrefix}tag:*`,
        'COUNT',
        100
      );

      cursor = nextCursor;
      tagKeys.push(...keys);
    } while (cursor !== '0');

    // Remove key from each tag set
    if (tagKeys.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const tagKey of tagKeys) {
        const unprefixedTagKey = tagKey.startsWith(this.keyPrefix)
          ? tagKey.substring(this.keyPrefix.length)
          : tagKey;
        pipeline.srem(unprefixedTagKey, key);
      }
      await pipeline.exec();
    }
  }

  /**
   * Reset local statistics counters.
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global singleton instance of RedisCache.
 */
let redisCacheInstance: RedisCache | null = null;

/**
 * Get or create the singleton RedisCache instance.
 */
export function getRedisCache(config?: RedisCacheConfig): RedisCache {
  if (!redisCacheInstance) {
    redisCacheInstance = new RedisCache(config);
  }
  return redisCacheInstance;
}

/**
 * Reset the singleton instance.
 * Used in testing or when changing configuration.
 */
export async function resetRedisCache(): Promise<void> {
  if (redisCacheInstance) {
    await redisCacheInstance.disconnect();
    redisCacheInstance = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export type { RedisCacheConfig };

