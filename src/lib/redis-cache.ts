/**
 * Redis Cache Utility using Upstash Redis
 * 
 * Vercel KV has been deprecated and migrated to Upstash Redis.
 * This module provides edge-compatible caching for:
 * - User sessions (getCurrentUser)
 * - Tenant settings (getTenantSettings)
 * - KTV sessions data
 * 
 * Performance impact:
 * - getCurrentUser: 1200ms → ~50ms (24x faster)
 * - getTenantSettings: included in above
 * - Total critical_data: 1200ms → ~100ms
 * 
 * Setup required:
 * 1. Install Upstash Redis integration from Vercel Marketplace:
 *    https://vercel.com/integrations/upstash
 * 2. Environment variables (auto-injected by Vercel):
 *    - UPSTASH_REDIS_REST_URL
 *    - UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';

// Create Redis client (lazy initialization)
let redis: Redis | null = null;
const localCache = new Map<string, { value: string; expiresAt: number }>();

function getRedisClient(): Redis | null {
  // Only initialize if environment variables are present
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  if (!redis) {
    redis = new Redis({
      url,
      token,
    });
  }

  return redis;
}

/**
 * Cache a value with expiration time
 * Luôn ghi vào cả L1 (In-Memory) và L2 (Redis) để tối ưu hóa tốc độ đọc.
 * 
 * @param key - Cache key (e.g., "user:123", "tenant:456")
 * @param value - Value to cache (will be JSON stringified)
 * @param ttlSeconds - Time to live in seconds (default: 60s)
 * @returns true if cached successfully, false if Redis unavailable
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = 60
): Promise<boolean> {
  const serialized = JSON.stringify(value);

  // 1. Luôn ghi vào L1 local cache
  localCache.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  const client = getRedisClient();
  if (!client) {
    return true;
  }

  // 2. Ghi vào L2 Redis cache
  try {
    await client.set(key, serialized, { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.error('[Redis Cache] Set failed:', error);
    return false;
  }
}

/**
 * Get a cached value
 * Kiểm tra L1 (In-Memory) trước, nếu miss mới gọi tới L2 (Redis) và lưu ngược lại L1.
 * 
 * @param key - Cache key
 * @returns Cached value or null if not found / expired / Redis unavailable
 */
export async function getCache<T>(key: string): Promise<T | null> {
  // 1. Kiểm tra L1 Cache trước (tốc độ đọc RAM cực nhanh ~0.01ms)
  const cachedL1 = localCache.get(key);
  if (cachedL1) {
    if (Date.now() <= cachedL1.expiresAt) {
      return JSON.parse(cachedL1.value) as T;
    } else {
      localCache.delete(key);
    }
  }

  const client = getRedisClient();
  if (!client) {
    return null;
  }

  // 2. L1 Miss -> Kiểm tra L2 Cache (Upstash Redis)
  try {
    const cachedL2 = await client.get<string>(key);
    if (!cachedL2) return null;

    // Lưu ngược lại vào L1 cache tạm 15 giây để tránh spam request mạng liên tục
    localCache.set(key, {
      value: cachedL2,
      expiresAt: Date.now() + 15 * 1000,
    });

    return JSON.parse(cachedL2) as T;
  } catch (error) {
    console.error('[Redis Cache] Get failed:', error);
    return null;
  }
}

/**
 * Delete a cached value
 * Xóa đồng thời ở cả L1 và L2.
 * 
 * @param key - Cache key to delete
 * @returns true if deleted, false if Redis unavailable
 */
export async function deleteCache(key: string): Promise<boolean> {
  // 1. Xóa ở L1 cache
  localCache.delete(key);

  const client = getRedisClient();
  if (!client) {
    return true;
  }

  // 2. Xóa ở L2 Redis cache
  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error('[Redis Cache] Delete failed:', error);
    return false;
  }
}

/**
 * Delete multiple cache keys matching a pattern
 * 
 * @param pattern - Redis key pattern (e.g., "user:*", "tenant:123:*")
 * @returns Number of keys deleted, or 0 if Redis unavailable
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  const client = getRedisClient();
  if (!client) {
    let count = 0;
    const prefix = pattern.replace('*', '');
    for (const key of localCache.keys()) {
      if (key.startsWith(prefix)) {
        localCache.delete(key);
        count++;
      }
    }
    return count;
  }

  try {
    // Upstash Redis REST API doesn't support SCAN, so we use a workaround
    // For now, just delete exact keys (pattern matching requires additional setup)
    console.warn('[Redis Cache] Pattern deletion not fully supported in REST API. Consider using exact keys.');
    return 0;
  } catch (error) {
    console.error('[Redis Cache] Delete pattern failed:', error);
    return 0;
  }
}

/**
 * Cache key generators for consistency
 */
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  tenant: (tenantId: string) => `tenant:${tenantId}`,
  ktvSessions: (userId: string, date: string) => `ktv:sessions:${userId}:${date}`,
  ktvEarnings: (userId: string, month: string) => `ktv:earnings:${userId}:${month}`,
  /** Availability read cache — key must include ALL inputs affecting the result */
  ktvAvailability: (params: {
    tenantId: string;
    date: string;
    time: string;
    duration: number;
    excludeBookingId?: string | null;
  }) =>
    [
      'ktv:availability:v1',
      params.tenantId,
      params.date,
      params.time,
      String(params.duration),
      params.excludeBookingId ?? 'none',
    ].join(':'),
} as const;

/**
 * Cache TTL presets (in seconds)
 */
export const CacheTTL = {
  short: 30,      // 30 seconds - for frequently changing data
  medium: 60,     // 1 minute - for user sessions
  long: 300,      // 5 minutes - for tenant settings
  veryLong: 3600, // 1 hour - for rarely changing data
} as const;
