/**
 * Decision Engine Platform - Cache Utilities
 * 
 * Utilities for cache key generation, hashing, and management.
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 15
 */

import crypto from 'crypto';
import type { DecisionContext } from '../types';

/**
 * Generate cache key for decision result
 * 
 * Cache key structure:
 * `decision:{decisionType}:{tenantId}:{hash}`
 * 
 * Where hash is MD5 of stringified input data (sorted keys for consistency)
 * 
 * @param context - Decision context
 * @returns Cache key string
 * 
 * @example
 * ```typescript
 * const key = generateDecisionCacheKey({
 *   tenantId: 'bella-spa-vn',
 *   decisionType: 'auto-approval',
 *   data: { amount: 3000000, tier: 'vip' }
 * });
 * // Returns: 'decision:auto-approval:bella-spa-vn:a1b2c3d4e5f6'
 * ```
 */
export function generateDecisionCacheKey(context: DecisionContext): string {
  const hash = hashObject(context.data);
  return `decision:${context.decisionType}:${context.tenantId}:${hash}`;
}

/**
 * Generate cache key for rule definition
 * 
 * @param ruleId - Rule identifier
 * @param tenantId - Tenant identifier
 * @returns Cache key string
 * 
 * @example
 * ```typescript
 * const key = generateRuleCacheKey('auto-approval-threshold', 'bella-spa-vn');
 * // Returns: 'rule:auto-approval-threshold:bella-spa-vn'
 * ```
 */
export function generateRuleCacheKey(
  ruleId: string,
  tenantId: string
): string {
  return `rule:${ruleId}:${tenantId}`;
}

/**
 * Generate cache key for BI query result
 * 
 * @param queryId - Query identifier
 * @param params - Query parameters
 * @param tenantId - Tenant identifier
 * @returns Cache key string
 * 
 * @example
 * ```typescript
 * const key = generateBIQueryCacheKey(
 *   'approval-rate-by-segment',
 *   { segment: 'vip' },
 *   'bella-spa-vn'
 * );
 * // Returns: 'bi-query:approval-rate-by-segment:bella-spa-vn:hash123'
 * ```
 */
export function generateBIQueryCacheKey(
  queryId: string,
  params: Record<string, unknown>,
  tenantId: string
): string {
  const hash = hashObject(params);
  return `bi-query:${queryId}:${tenantId}:${hash}`;
}

/**
 * Generate cache key for ML model result
 * 
 * @param modelId - Model identifier
 * @param features - Model input features
 * @param tenantId - Tenant identifier
 * @returns Cache key string
 * 
 * @example
 * ```typescript
 * const key = generateMLModelCacheKey(
 *   'booking-approval-v2',
 *   { amount: 10000000, customerHistory: {...} },
 *   'bella-spa-vn'
 * );
 * // Returns: 'ml-model:booking-approval-v2:bella-spa-vn:hash456'
 * ```
 */
export function generateMLModelCacheKey(
  modelId: string,
  features: Record<string, unknown>,
  tenantId: string
): string {
  const hash = hashObject(features);
  return `ml-model:${modelId}:${tenantId}:${hash}`;
}

/**
 * Generate invalidation pattern for tenant
 * 
 * @param tenantId - Tenant identifier
 * @param decisionType - Optional decision type filter
 * @returns Cache key pattern string
 * 
 * @example
 * ```typescript
 * // Invalidate all decisions for tenant
 * const pattern = generateInvalidationPattern('bella-spa-vn');
 * // Returns: 'decision:*:bella-spa-vn:*'
 * 
 * // Invalidate specific decision type
 * const pattern = generateInvalidationPattern('bella-spa-vn', 'auto-approval');
 * // Returns: 'decision:auto-approval:bella-spa-vn:*'
 * ```
 */
export function generateInvalidationPattern(
  tenantId: string,
  decisionType?: string
): string {
  if (decisionType) {
    return `decision:${decisionType}:${tenantId}:*`;
  }
  return `decision:*:${tenantId}:*`;
}

/**
 * Hash object to generate consistent cache key
 * 
 * Uses MD5 hash of JSON-stringified object with sorted keys.
 * 
 * @param obj - Object to hash
 * @returns MD5 hash (first 12 characters)
 * 
 * @example
 * ```typescript
 * const hash1 = hashObject({ b: 2, a: 1 });
 * const hash2 = hashObject({ a: 1, b: 2 });
 * // hash1 === hash2 (order doesn't matter)
 * ```
 */
export function hashObject(obj: Record<string, unknown>): string {
  // Sort keys for consistent hashing
  const sortedObj = sortObjectKeys(obj);
  const jsonString = JSON.stringify(sortedObj);
  const hash = crypto.createHash('md5').update(jsonString).digest('hex');
  return hash.substring(0, 12); // First 12 characters
}

/**
 * Sort object keys recursively for consistent hashing
 * 
 * @param obj - Object to sort
 * @returns Object with sorted keys
 */
export function sortObjectKeys(
  obj: Record<string, unknown>
): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object') {
    return obj as Record<string, unknown>;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null
        ? sortObjectKeys(item as Record<string, unknown>)
        : item
    ) as unknown as Record<string, unknown>;
  }

  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sortedObj[key] = sortObjectKeys(value as Record<string, unknown>);
    } else {
      sortedObj[key] = value;
    }
  }

  return sortedObj;
}

/**
 * Parse cache key to extract components
 * 
 * @param cacheKey - Cache key to parse
 * @returns Parsed components or null if invalid format
 * 
 * @example
 * ```typescript
 * const parsed = parseCacheKey('decision:auto-approval:bella-spa-vn:a1b2c3');
 * // Returns: {
 * //   type: 'decision',
 * //   decisionType: 'auto-approval',
 * //   tenantId: 'bella-spa-vn',
 * //   hash: 'a1b2c3'
 * // }
 * ```
 */
export function parseCacheKey(cacheKey: string): {
  type: string;
  decisionType: string;
  tenantId: string;
  hash: string;
} | null {
  const parts = cacheKey.split(':');

  if (parts.length !== 4) {
    return null;
  }

  const [type, decisionType, tenantId, hash] = parts;

  return {
    type,
    decisionType,
    tenantId,
    hash,
  };
}

/**
 * Check if cache key matches pattern
 * 
 * Supports wildcards (*) in pattern.
 * 
 * @param cacheKey - Cache key to test
 * @param pattern - Pattern with wildcards
 * @returns True if key matches pattern
 * 
 * @example
 * ```typescript
 * matchesCachePattern(
 *   'decision:auto-approval:bella-spa-vn:abc123',
 *   'decision:*:bella-spa-vn:*'
 * ); // true
 * 
 * matchesCachePattern(
 *   'decision:auto-approval:other-tenant:abc123',
 *   'decision:*:bella-spa-vn:*'
 * ); // false
 * ```
 */
export function matchesCachePattern(
  cacheKey: string,
  pattern: string
): boolean {
  // Convert pattern to regex
  // Escape special regex chars except *
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(cacheKey);
}

/**
 * Calculate approximate size of value in bytes
 * 
 * Used for memory tracking in in-memory caches.
 * 
 * @param value - Value to measure
 * @returns Approximate size in bytes
 * 
 * @example
 * ```typescript
 * const size = calculateValueSize({ data: 'hello world' });
 * console.log('Size:', size, 'bytes');
 * ```
 */
export function calculateValueSize(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'string') {
    return value.length * 2; // UTF-16 encoding (2 bytes per char)
  }

  if (typeof value === 'number') {
    return 8; // 64-bit number
  }

  if (typeof value === 'boolean') {
    return 4; // Boolean
  }

  if (typeof value === 'object') {
    try {
      const jsonString = JSON.stringify(value);
      return jsonString.length * 2;
    } catch {
      return 0;
    }
  }

  return 0;
}

/**
 * Format bytes to human-readable string
 * 
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., '1.5 MB')
 * 
 * @example
 * ```typescript
 * formatBytes(1024); // '1 KB'
 * formatBytes(1572864); // '1.5 MB'
 * formatBytes(104857600); // '100 MB'
 * ```
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Generate time-based cache key (for time-sensitive caching)
 * 
 * Groups cache entries by time bucket (e.g., per minute, per hour).
 * 
 * @param baseKey - Base cache key
 * @param bucketSize - Time bucket size in milliseconds
 * @returns Cache key with time bucket
 * 
 * @example
 * ```typescript
 * // Cache per minute (60000ms)
 * const key = generateTimedCacheKey('decision:key', 60000);
 * // Returns: 'decision:key:bucket:1234567' (bucket changes every minute)
 * ```
 */
export function generateTimedCacheKey(
  baseKey: string,
  bucketSize: number = 60000 // Default: 1 minute
): string {
  const bucket = Math.floor(Date.now() / bucketSize);
  return `${baseKey}:bucket:${bucket}`;
}
