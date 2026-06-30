/**
 * Memory Cache Implementation
 * 
 * In-memory cache using Node.js Map.
 * Fast, synchronous access with automatic TTL expiration.
 * 
 * Features:
 * - TTL-based expiration
 * - Tag-based grouping
 * - Pattern-based deletion (wildcard support)
 * - LRU eviction (when maxSize is reached)
 * - Statistics tracking
 * 
 * Trade-offs:
 * - ✅ Fastest cache layer (< 1ms access)
 * - ✅ No network overhead
 * - ❌ Not shared across instances (each process has its own cache)
 * - ❌ Lost on process restart
 * - ❌ Limited by Node.js heap memory
 */

import type { CacheService, CacheOptions, CacheStats } from '../shared/types';
import { CacheError } from '../shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp (ms)
  tags: string[];
  accessedAt: number; // For LRU eviction
}

interface MemoryCacheConfig {
  /**
   * Default TTL in seconds.
   * @default 300 (5 minutes)
   */
  defaultTTL?: number;

  /**
   * Maximum number of entries in cache.
   * When exceeded, LRU entries are evicted.
   * @default 10000
   */
  maxSize?: number;

  /**
   * Enable automatic cleanup of expired entries.
   * @default true
   */
  autoCleanup?: boolean;

  /**
   * Cleanup interval in seconds.
   * @default 60 (1 minute)
   */
  cleanupIntervalSeconds?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory Cache Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class MemoryCache implements CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private tagIndex = new Map<string, Set<string>>(); // tag → Set of keys
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
  };

  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private readonly autoCleanup: boolean;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: MemoryCacheConfig = {}) {
    this.defaultTTL = config.defaultTTL ?? 300; // 5 minutes
    this.maxSize = config.maxSize ?? 10000;
    this.autoCleanup = config.autoCleanup ?? true;

    if (this.autoCleanup) {
      const intervalMs = (config.cleanupIntervalSeconds ?? 60) * 1000;
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpired();
      }, intervalMs);

      // Unref so it doesn't prevent Node.js from exiting
      this.cleanupInterval.unref();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        this.delete(key); // Remove expired entry
        this.stats.misses++;
        return null;
      }

      // Update access time for LRU
      entry.accessedAt = Date.now();
      this.stats.hits++;

      return entry.value as T;
    } catch (error) {
      throw new CacheError(
        `Failed to get key "${key}" from memory cache`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      // Evict LRU entry if cache is full
      if (this.cache.size >= this.maxSize) {
        this.evictLRU();
      }

      const ttl = options?.ttl ?? this.defaultTTL;
      const tags = options?.tags ?? [];

      const entry: CacheEntry<T> = {
        value,
        expiresAt: Date.now() + ttl * 1000,
        tags,
        accessedAt: Date.now(),
      };

      this.cache.set(key, entry);
      this.stats.sets++;

      // Update tag index
      for (const tag of tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    } catch (error) {
      throw new CacheError(
        `Failed to set key "${key}" in memory cache`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const entry = this.cache.get(key);
      if (!entry) return;

      // Remove from tag index
      for (const tag of entry.tags) {
        const keys = this.tagIndex.get(tag);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }

      this.cache.delete(key);
      this.stats.deletes++;
    } catch (error) {
      throw new CacheError(
        `Failed to delete key "${key}" from memory cache`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const regex = this.patternToRegex(pattern);
      const keysToDelete: string[] = [];

      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }

      // Delete in batch
      await Promise.all(keysToDelete.map(key => this.delete(key)));
    } catch (error) {
      throw new CacheError(
        `Failed to delete pattern "${pattern}" from memory cache`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async deleteByTag(tag: string): Promise<void> {
    try {
      const keys = this.tagIndex.get(tag);
      if (!keys) return;

      // Delete all keys with this tag
      await Promise.all(Array.from(keys).map(key => this.delete(key)));

      // Tag index entry will be removed by delete() method
    } catch (error) {
      throw new CacheError(
        `Failed to delete by tag "${tag}" from memory cache`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getStats(): Promise<CacheStats> {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // Estimate memory usage (rough approximation)
    const avgEntrySize = 1024; // Assume ~1KB per entry
    const memoryUsedBytes = this.cache.size * avgEntrySize;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      totalKeys: this.cache.size,
      memoryUsedBytes,
    };
  }

  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.tagIndex.clear();
      this.resetStats();
    } catch (error) {
      throw new CacheError(
        'Failed to clear memory cache',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Shutdown the memory cache.
   * Clears cleanup interval and cache data.
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.cache.clear();
    this.tagIndex.clear();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Remove expired entries from cache.
   * Called periodically if autoCleanup is enabled.
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.debug(`[MemoryCache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Evict least recently used entry.
   * Called when cache size exceeds maxSize.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccessTime = Date.now();

    // Find LRU entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessedAt < oldestAccessTime) {
        oldestAccessTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
      console.debug(`[MemoryCache] Evicted LRU entry: ${oldestKey}`);
    }
  }

  /**
   * Convert wildcard pattern to RegExp.
   * Supports: *, ?, [abc], [a-z]
   * 
   * Examples:
   * - 'finance:*' → /^finance:.*$/
   * - 'user:?:profile' → /^user:.{1}:profile$/
   */
  private patternToRegex(pattern: string): RegExp {
    // Escape special regex characters except *, ?, [, ]
    let regexStr = pattern
      .replace(/[.+^${}()|\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.{1}');

    return new RegExp(`^${regexStr}$`);
  }

  /**
   * Reset statistics counters.
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global singleton instance of MemoryCache.
 * Used across the application to avoid multiple cache instances.
 */
let memoryCacheInstance: MemoryCache | null = null;

/**
 * Get or create the singleton MemoryCache instance.
 */
export function getMemoryCache(config?: MemoryCacheConfig): MemoryCache {
  if (!memoryCacheInstance) {
    memoryCacheInstance = new MemoryCache(config);
  }
  return memoryCacheInstance;
}

/**
 * Reset the singleton instance.
 * Used in testing to create a fresh cache.
 */
export function resetMemoryCache(): void {
  if (memoryCacheInstance) {
    memoryCacheInstance.shutdown();
    memoryCacheInstance = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export type { MemoryCacheConfig };

