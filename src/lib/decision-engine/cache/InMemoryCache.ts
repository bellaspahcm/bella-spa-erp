/**
 * Decision Engine Platform - In-Memory Cache Implementation
 * 
 * High-performance in-memory cache with:
 * - LRU (Least Recently Used) eviction policy
 * - TTL (Time-To-Live) expiration
 * - Memory limits with automatic eviction
 * - Thread-safe operations
 * - Cache statistics tracking
 * 
 * **Use Cases**:
 * - Development and testing
 * - Single-server deployments
 * - Low-latency caching (<1ms access time)
 * - Provider-level caching (rule definitions, small datasets)
 * 
 * **Not Suitable For**:
 * - Multi-server deployments (no shared cache)
 * - Large datasets (memory constraints)
 * - Persistent caching (lost on restart)
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 15
 */

import type {
  ICache,
  CacheStats,
  CacheConfig,
  CacheEntry,
} from './ICache';
import { createCacheConfig } from './ICache';
import { calculateValueSize, matchesCachePattern } from './utils';

/**
 * In-Memory Cache with LRU eviction
 * 
 * Implements ICache interface with in-memory storage.
 * Thread-safe with async operations.
 * 
 * @example Basic Usage
 * ```typescript
 * const cache = new InMemoryCache({
 *   maxKeys: 1000,
 *   maxMemory: 10 * 1024 * 1024, // 10MB
 *   defaultTTL: 300 // 5 minutes
 * });
 * 
 * await cache.set('key', { data: 'value' }, 300);
 * const value = await cache.get('key');
 * 
 * const stats = await cache.getStats();
 * console.log('Hit rate:', stats.hitRate);
 * 
 * await cache.close();
 * ```
 */
export class InMemoryCache implements ICache {
  private readonly config: CacheConfig;
  private readonly store: Map<string, CacheEntry>;
  private readonly accessOrder: string[]; // LRU tracking
  
  // Statistics
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;
  private currentMemory: number = 0;

  // Background cleanup
  private cleanupInterval?: NodeJS.Timeout;
  private readonly cleanupIntervalMs: number = 60000; // 1 minute

  /**
   * Create InMemoryCache instance
   * 
   * @param config - Cache configuration
   */
  constructor(config?: Partial<CacheConfig>) {
    this.config = createCacheConfig(config);
    this.store = new Map();
    this.accessOrder = [];

    // Start background cleanup for expired entries
    this.startCleanup();
  }

  /**
   * Get value from cache
   * 
   * @param key - Cache key
   * @returns Promise<T | null> - Cached value or null if not found/expired
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);

    // Cache miss
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.misses++;
      return null;
    }

    // Cache hit - update LRU
    this.hits++;
    this.updateAccessOrder(key);
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;

    return entry.value as T;
  }

  /**
   * Set value in cache with optional TTL
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time-to-live in seconds (optional)
   * @returns Promise<void>
   */
  async set<T = unknown>(
    key: string,
    value: T,
    ttlSeconds?: number
  ): Promise<void> {
    const now = Date.now();
    const size = calculateValueSize(value);

    // Create cache entry
    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: ttlSeconds ? now + ttlSeconds * 1000 : undefined,
      lastAccessedAt: now,
      accessCount: 0,
      size,
    };

    // Check if key already exists
    const existingEntry = this.store.get(key);
    if (existingEntry) {
      // Update memory tracking
      this.currentMemory -= existingEntry.size;
      this.currentMemory += size;
    } else {
      // New entry - check memory and key limits
      await this.ensureCapacity(size);
      this.currentMemory += size;
    }

    // Store entry
    this.store.set(key, entry as CacheEntry);
    this.updateAccessOrder(key);
  }

  /**
   * Delete value from cache
   * 
   * @param key - Cache key (supports wildcards for pattern deletion)
   * @returns Promise<number> - Number of keys deleted
   */
  async delete(key: string): Promise<number> {
    // Check if pattern (contains *)
    if (key.includes('*')) {
      return this.deletePattern(key);
    }

    // Single key deletion
    const entry = this.store.get(key);
    if (!entry) {
      return 0;
    }

    this.store.delete(key);
    this.removeFromAccessOrder(key);
    this.currentMemory -= entry.size;

    return 1;
  }

  /**
   * Delete keys matching pattern
   * 
   * @param pattern - Pattern with wildcards
   * @returns Number of keys deleted
   * @private
   */
  private deletePattern(pattern: string): number {
    let deletedCount = 0;

    for (const key of this.store.keys()) {
      if (matchesCachePattern(key, pattern)) {
        const entry = this.store.get(key);
        if (entry) {
          this.store.delete(key);
          this.removeFromAccessOrder(key);
          this.currentMemory -= entry.size;
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }

  /**
   * Check if key exists in cache
   * 
   * @param key - Cache key
   * @returns Promise<boolean> - True if key exists and not expired
   */
  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cached values
   * 
   * @returns Promise<void>
   */
  async clear(): Promise<void> {
    this.store.clear();
    this.accessOrder.length = 0;
    this.currentMemory = 0;
    
    // Reset statistics (keep hits/misses for historical tracking)
    // this.hits = 0;
    // this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache statistics
   * 
   * @returns Promise<CacheStats>
   */
  async getStats(): Promise<CacheStats> {
    // Clean up expired entries before calculating stats
    await this.cleanupExpired();

    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      keys: this.store.size,
      memoryUsage: this.currentMemory,
      memoryLimit: this.config.maxMemory,
      evictions: this.evictions,
    };
  }

  /**
   * Close cache connections and cleanup resources
   * 
   * @returns Promise<void>
   */
  async close(): Promise<void> {
    // Stop background cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Clear all data
    await this.clear();
  }

  /**
   * Check if entry is expired
   * 
   * @param entry - Cache entry
   * @returns True if expired
   * @private
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) {
      return false;
    }

    return Date.now() >= entry.expiresAt;
  }

  /**
   * Update LRU access order
   * 
   * @param key - Cache key
   * @private
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.removeFromAccessOrder(key);

    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   * 
   * @param key - Cache key
   * @private
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Ensure cache has capacity for new entry
   * 
   * Evicts entries if necessary (LRU policy).
   * 
   * @param requiredSize - Size of new entry
   * @returns Promise<void>
   * @private
   */
  private async ensureCapacity(requiredSize: number): Promise<void> {
    const maxKeys = this.config.maxKeys || Infinity;
    const maxMemory = this.config.maxMemory || Infinity;

    // Check key limit
    while (this.store.size >= maxKeys) {
      await this.evictLRU();
    }

    // Check memory limit
    while (this.currentMemory + requiredSize > maxMemory) {
      await this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   * 
   * @returns Promise<void>
   * @private
   */
  private async evictLRU(): Promise<void> {
    if (this.accessOrder.length === 0) {
      return;
    }

    // Get least recently used key (first in access order)
    const lruKey = this.accessOrder[0];
    const entry = this.store.get(lruKey);

    if (entry) {
      this.store.delete(lruKey);
      this.removeFromAccessOrder(lruKey);
      this.currentMemory -= entry.size;
      this.evictions++;
    }
  }

  /**
   * Start background cleanup of expired entries
   * 
   * @private
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupIntervalMs);

    // Don't prevent process from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Clean up expired entries
   * 
   * @returns Promise<number> - Number of entries cleaned up
   * @private
   */
  private async cleanupExpired(): Promise<number> {
    let cleanedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (this.isExpired(entry)) {
        this.store.delete(key);
        this.removeFromAccessOrder(key);
        this.currentMemory -= entry.size;
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Get all keys in cache (for debugging/testing)
   * 
   * @returns Array of cache keys
   */
  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get cache configuration (for debugging/testing)
   * 
   * @returns CacheConfig
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }
}

/**
 * Create InMemoryCache instance
 * 
 * Factory function for convenience.
 * 
 * @param config - Cache configuration
 * @returns InMemoryCache instance
 * 
 * @example
 * ```typescript
 * const cache = createInMemoryCache({
 *   maxKeys: 1000,
 *   maxMemory: 10 * 1024 * 1024,
 *   defaultTTL: 300
 * });
 * ```
 */
export function createInMemoryCache(
  config?: Partial<CacheConfig>
): InMemoryCache {
  return new InMemoryCache(config);
}
