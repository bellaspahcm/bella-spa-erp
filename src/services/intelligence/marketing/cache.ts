/**
 * Simple In-Memory Cache Layer with TTL
 * 
 * Provides caching for Marketing Intelligence queries to reduce database load.
 * 
 * Features:
 * - TTL (Time-To-Live) support
 * - Automatic expiration
 * - Cache invalidation by key pattern
 * - Cache statistics (hits, misses, evictions)
 * 
 * NOTE: This is an in-memory cache, so it will be reset on server restart.
 * For production with multiple server instances, consider using Redis instead.
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Priority 2 Task #7
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp in milliseconds
  createdAt: number; // Unix timestamp in milliseconds
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

/**
 * In-Memory Cache with TTL
 * 
 * Usage:
 * ```typescript
 * const cache = new InMemoryCache<CustomerData>({ defaultTTL: 300000 }); // 5 minutes
 * 
 * // Get from cache or fetch
 * const data = await cache.getOrSet('customer:123', async () => {
 *   return await fetchCustomerData('123');
 * }, 60000); // Custom TTL: 1 minute
 * 
 * // Manual get/set
 * cache.set('key', value, 60000);
 * const value = cache.get('key');
 * 
 * // Invalidate cache
 * cache.delete('key');
 * cache.clear(); // Clear all
 * cache.invalidatePattern('customer:*'); // Clear by pattern
 * ```
 */
export class InMemoryCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
  };
  
  constructor(
    private options: {
      defaultTTL?: number; // milliseconds (default: 5 minutes)
      maxSize?: number; // maximum number of entries (default: 1000)
      cleanupInterval?: number; // milliseconds (default: 60 seconds)
    } = {}
  ) {
    this.options.defaultTTL = options.defaultTTL ?? 300000; // 5 minutes
    this.options.maxSize = options.maxSize ?? 1000;
    this.options.cleanupInterval = options.cleanupInterval ?? 60000; // 1 minute
    
    // Start automatic cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get value from cache
   * 
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return undefined;
    }
    
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time-to-live in milliseconds (optional, uses defaultTTL if not provided)
   */
  set(key: string, value: T, ttl?: number): void {
    const ttlToUse = ttl ?? this.options.defaultTTL!;
    const now = Date.now();
    
    // Check if cache is full (LRU eviction)
    if (this.cache.size >= this.options.maxSize! && !this.cache.has(key)) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }
    
    this.cache.set(key, {
      value,
      expiresAt: now + ttlToUse,
      createdAt: now,
    });
    
    this.stats.size = this.cache.size;
  }

  /**
   * Get from cache or set if not found
   * 
   * This is a helper method that simplifies the common pattern:
   * 1. Check cache
   * 2. If not found, fetch data
   * 3. Store in cache
   * 4. Return data
   * 
   * @param key - Cache key
   * @param fetchFn - Function to fetch data if not in cache
   * @param ttl - Optional TTL override
   * @returns Cached or fetched value
   */
  async getOrSet(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key);
    
    if (cached !== undefined) {
      return cached;
    }
    
    // Fetch and cache
    const value = await fetchFn();
    this.set(key, value, ttl);
    
    return value;
  }

  /**
   * Delete a key from cache
   * 
   * @param key - Cache key
   * @returns True if key was deleted, false if not found
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Check if key exists in cache (and not expired)
   * 
   * @param key - Cache key
   * @returns True if key exists and not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.evictions++;
      return false;
    }
    
    return true;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.evictions += size;
    this.stats.size = 0;
  }

  /**
   * Invalidate cache entries matching a pattern
   * 
   * Pattern matching:
   * - 'prefix:*' - matches all keys starting with 'prefix:'
   * - '*:suffix' - matches all keys ending with ':suffix'
   * - '*pattern*' - matches all keys containing 'pattern'
   * 
   * @param pattern - Pattern to match (supports wildcards)
   * @returns Number of keys deleted
   */
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*') + '$'
    );
    
    let deleted = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    
    this.stats.evictions += deleted;
    this.stats.size = this.cache.size;
    
    return deleted;
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache stats (hits, misses, evictions, size)
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: this.cache.size,
    };
  }

  /**
   * Get all cache keys
   * 
   * @returns Array of cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size (number of entries)
   * 
   * @returns Number of entries in cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Start automatic cleanup interval to remove expired entries
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpired();
    }, this.options.cleanupInterval!);
  }

  /**
   * Remove all expired entries from cache
   * 
   * This is called automatically by the cleanup interval,
   * but can also be called manually for immediate cleanup.
   * 
   * @returns Number of expired entries removed
   */
  cleanupExpired(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      this.stats.evictions += removed;
      this.stats.size = this.cache.size;
      console.log(`[InMemoryCache] Cleaned up ${removed} expired entries`);
    }
    
    return removed;
  }
}

// ─── Singleton Cache Instances ──────────────────────────────────────────────

/**
 * Global cache instances for different Intelligence modules
 * 
 * Each module can have its own cache with different TTL settings:
 * - Marketing: 5 minutes (external ads data changes frequently)
 * - Customer: 10 minutes (customer insights are more stable)
 * - Finance: 15 minutes (financial reports are less volatile)
 * - Operations: 5 minutes (operational metrics change frequently)
 * - HR: 15 minutes (HR metrics are relatively stable)
 */

export const marketingCache = new InMemoryCache({
  defaultTTL: 300000, // 5 minutes
  maxSize: 500,
  cleanupInterval: 60000, // 1 minute
});

export const customerCache = new InMemoryCache({
  defaultTTL: 600000, // 10 minutes
  maxSize: 1000,
  cleanupInterval: 120000, // 2 minutes
});

export const financeCache = new InMemoryCache({
  defaultTTL: 900000, // 15 minutes
  maxSize: 500,
  cleanupInterval: 180000, // 3 minutes
});

export const operationsCache = new InMemoryCache({
  defaultTTL: 300000, // 5 minutes
  maxSize: 1000,
  cleanupInterval: 60000, // 1 minute
});

export const hrCache = new InMemoryCache({
  defaultTTL: 900000, // 15 minutes
  maxSize: 500,
  cleanupInterval: 180000, // 3 minutes
});

/**
 * Helper function to generate cache keys
 * 
 * Usage:
 * ```typescript
 * const key = createCacheKey('marketing', 'campaign-analytics', tenantId, startDate, endDate);
 * // Result: 'marketing:campaign-analytics:tenant123:2026-06-01:2026-06-07'
 * ```
 */
export function createCacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

/**
 * Helper function to invalidate cache by tenant
 * 
 * Invalidates all cache entries for a specific tenant across all modules.
 * Useful when tenant data is updated and you want to force a refresh.
 * 
 * @param tenantId - Tenant UUID
 */
export function invalidateTenantCache(tenantId: string): void {
  const pattern = `*:${tenantId}:*`;
  
  marketingCache.invalidatePattern(pattern);
  customerCache.invalidatePattern(pattern);
  financeCache.invalidatePattern(pattern);
  operationsCache.invalidatePattern(pattern);
  hrCache.invalidatePattern(pattern);
  
  console.log(`[Cache] Invalidated all cache for tenant ${tenantId}`);
}

/**
 * Helper function to get all cache statistics
 * 
 * @returns Combined stats for all cache instances
 */
export function getAllCacheStats() {
  return {
    marketing: marketingCache.getStats(),
    customer: customerCache.getStats(),
    finance: financeCache.getStats(),
    operations: operationsCache.getStats(),
    hr: hrCache.getStats(),
  };
}

/**
 * Helper function to clear all caches
 * 
 * WARNING: This will clear all cached data across all modules.
 * Use with caution, preferably only in development or during maintenance.
 */
export function clearAllCaches(): void {
  marketingCache.clear();
  customerCache.clear();
  financeCache.clear();
  operationsCache.clear();
  hrCache.clear();
  
  console.log('[Cache] Cleared all cache instances');
}
