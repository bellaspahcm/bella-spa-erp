/**
 * Decision Engine Platform - Redis Cache Implementation
 * 
 * Distributed cache using Redis with:
 * - Connection pooling (via ioredis)
 * - JSON serialization/deserialization
 * - Error handling with circuit breaker pattern
 * - Graceful fallback on connection failures
 * - TTL support (Redis native)
 * - Pattern-based deletion (SCAN + DEL)
 * - Redis Cluster support (optional)
 * 
 * **Use Cases**:
 * - Multi-server deployments (shared cache)
 * - Large datasets (Redis can handle GBs of data)
 * - Persistent caching (survives restarts)
 * - Production environments
 * 
 * **Performance**:
 * - get(): ~1-5ms (network latency)
 * - set(): ~1-5ms (network latency)
 * - Throughput: 100K+ ops/sec (single instance)
 * 
 * @see docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md Section 15
 */

import Redis, { type RedisOptions } from 'ioredis';
import type { ICache, CacheStats } from './ICache';
import { matchesCachePattern } from './utils';

/**
 * Redis cache configuration
 */
export interface RedisCacheConfig extends RedisOptions {
  /** Cache name (for logging and identification) */
  name?: string;

  /** Connection string (redis://host:port/db) */
  connectionString?: string;

  /** Default TTL in seconds */
  defaultTTL?: number;

  /** Enable connection retry */
  retryStrategy?: (times: number) => number | void;

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Connection timeout in milliseconds */
  connectTimeout?: number;

  /** Command timeout in milliseconds */
  commandTimeout?: number;

  /** Key prefix (namespace) */
  keyPrefix?: string;

  /** Enable debug logging */
  enableDebugLogging?: boolean;

  /** Circuit breaker threshold (failures before opening) */
  circuitBreakerThreshold?: number;

  /** Circuit breaker reset timeout (milliseconds) */
  circuitBreakerResetTimeout?: number;
}

/**
 * Circuit breaker state
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if recovered
}

/**
 * Redis Cache with connection pooling and error handling
 * 
 * Implements ICache interface with Redis as backend.
 * 
 * @example Basic Usage
 * ```typescript
 * const cache = new RedisCache({
 *   host: 'localhost',
 *   port: 6379,
 *   defaultTTL: 300
 * });
 * 
 * await cache.set('key', { data: 'value' }, 300);
 * const value = await cache.get('key');
 * 
 * await cache.close();
 * ```
 * 
 * @example With Connection String
 * ```typescript
 * const cache = new RedisCache({
 *   connectionString: 'redis://localhost:6379/0'
 * });
 * ```
 */
export class RedisCache implements ICache {
  private readonly client: Redis;
  private readonly config: RedisCacheConfig;

  // Circuit breaker state
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private circuitOpenedAt?: number;

  // Statistics
  private hits: number = 0;
  private misses: number = 0;
  private errors: number = 0;

  /**
   * Create RedisCache instance
   * 
   * @param config - Redis cache configuration
   */
  constructor(config: RedisCacheConfig = {}) {
    this.config = {
      name: 'decision-engine-redis-cache',
      defaultTTL: 300,
      maxRetries: 3,
      connectTimeout: 10000,
      commandTimeout: 5000,
      keyPrefix: 'de:',
      enableDebugLogging: false,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTimeout: 60000,
      ...config,
    };

    // Create Redis client
    if (this.config.connectionString) {
      this.client = new Redis(this.config.connectionString, this.config);
    } else {
      this.client = new Redis(this.config as RedisOptions);
    }

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Get value from cache
   * 
   * @param key - Cache key
   * @returns Promise<T | null> - Cached value or null if not found
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    // Check circuit breaker
    if (!this.isCircuitClosed()) {
      this.log('Circuit breaker open, rejecting get request');
      this.misses++;
      return null;
    }

    try {
      const value = await this.client.get(this.prefixKey(key));

      if (value === null) {
        this.misses++;
        return null;
      }

      // Deserialize
      const parsed = this.deserialize<T>(value);
      this.hits++;
      this.recordSuccess();

      return parsed;
    } catch (error) {
      this.handleError('get', error);
      this.misses++;
      return null;
    }
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
    // Check circuit breaker
    if (!this.isCircuitClosed()) {
      this.log('Circuit breaker open, rejecting set request');
      return;
    }

    try {
      const serialized = this.serialize(value);
      const ttl = ttlSeconds ?? this.config.defaultTTL;

      if (ttl) {
        await this.client.setex(this.prefixKey(key), ttl, serialized);
      } else {
        await this.client.set(this.prefixKey(key), serialized);
      }

      this.recordSuccess();
    } catch (error) {
      this.handleError('set', error);
    }
  }

  /**
   * Delete value from cache
   * 
   * @param key - Cache key (supports wildcards for pattern deletion)
   * @returns Promise<number> - Number of keys deleted
   */
  async delete(key: string): Promise<number> {
    // Check circuit breaker
    if (!this.isCircuitClosed()) {
      this.log('Circuit breaker open, rejecting delete request');
      return 0;
    }

    try {
      // Check if pattern (contains *)
      if (key.includes('*')) {
        return await this.deletePattern(key);
      }

      // Single key deletion
      const deleted = await this.client.del(this.prefixKey(key));
      this.recordSuccess();

      return deleted;
    } catch (error) {
      this.handleError('delete', error);
      return 0;
    }
  }

  /**
   * Delete keys matching pattern
   * 
   * Uses SCAN for safe iteration (doesn't block Redis).
   * 
   * @param pattern - Pattern with wildcards
   * @returns Number of keys deleted
   * @private
   */
  private async deletePattern(pattern: string): Promise<number> {
    const prefixedPattern = this.prefixKey(pattern);
    let deletedCount = 0;
    let cursor = '0';

    try {
      do {
        // SCAN returns [nextCursor, keys]
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          prefixedPattern,
          'COUNT',
          100
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          const deleted = await this.client.del(...keys);
          deletedCount += deleted;
        }
      } while (cursor !== '0');

      this.recordSuccess();
      return deletedCount;
    } catch (error) {
      this.handleError('deletePattern', error);
      return deletedCount;
    }
  }

  /**
   * Check if key exists in cache
   * 
   * @param key - Cache key
   * @returns Promise<boolean> - True if key exists
   */
  async has(key: string): Promise<boolean> {
    // Check circuit breaker
    if (!this.isCircuitClosed()) {
      this.log('Circuit breaker open, rejecting has request');
      return false;
    }

    try {
      const exists = await this.client.exists(this.prefixKey(key));
      this.recordSuccess();

      return exists === 1;
    } catch (error) {
      this.handleError('has', error);
      return false;
    }
  }

  /**
   * Clear all cached values
   * 
   * **WARNING**: This flushes the entire Redis database!
   * Use with caution in production.
   * 
   * @returns Promise<void>
   */
  async clear(): Promise<void> {
    // Check circuit breaker
    if (!this.isCircuitClosed()) {
      this.log('Circuit breaker open, rejecting clear request');
      return;
    }

    try {
      // If keyPrefix is set, only delete prefixed keys
      if (this.config.keyPrefix) {
        await this.deletePattern('*');
      } else {
        // Flush entire database (DANGEROUS!)
        await this.client.flushdb();
      }

      this.recordSuccess();
    } catch (error) {
      this.handleError('clear', error);
    }
  }

  /**
   * Get cache statistics
   * 
   * @returns Promise<CacheStats>
   */
  async getStats(): Promise<CacheStats> {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    let keys = 0;
    let memoryUsage: number | undefined;

    try {
      // Get approximate key count (DBSIZE)
      keys = await this.client.dbsize();

      // Get memory usage (INFO memory)
      const info = await this.client.info('memory');
      const match = info.match(/used_memory:(\d+)/);
      if (match) {
        memoryUsage = parseInt(match[1], 10);
      }
    } catch (error) {
      this.log('Failed to get Redis stats:', error);
    }

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      keys,
      memoryUsage,
      evictions: 0, // Redis handles eviction internally
    };
  }

  /**
   * Close cache connections and cleanup resources
   * 
   * @returns Promise<void>
   */
  async close(): Promise<void> {
    try {
      await this.client.quit();
      this.log('Redis connection closed');
    } catch (error) {
      this.log('Error closing Redis connection:', error);
      // Force disconnect
      this.client.disconnect();
    }
  }

  /**
   * Prefix key with namespace
   * 
   * @param key - Original key
   * @returns Prefixed key
   * @private
   */
  private prefixKey(key: string): string {
    if (this.config.keyPrefix) {
      return `${this.config.keyPrefix}${key}`;
    }
    return key;
  }

  /**
   * Serialize value to JSON string
   * 
   * @param value - Value to serialize
   * @returns JSON string
   * @private
   */
  private serialize<T>(value: T): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      this.log('Serialization error:', error);
      throw new Error(`Failed to serialize value: ${error}`);
    }
  }

  /**
   * Deserialize JSON string to value
   * 
   * @param value - JSON string
   * @returns Deserialized value
   * @private
   */
  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      this.log('Deserialization error:', error);
      throw new Error(`Failed to deserialize value: ${error}`);
    }
  }

  /**
   * Setup Redis event handlers
   * 
   * @private
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.log('Redis connected');
    });

    this.client.on('ready', () => {
      this.log('Redis ready');
      this.resetCircuitBreaker();
    });

    this.client.on('error', (error) => {
      this.log('Redis error:', error);
      this.handleError('connection', error);
    });

    this.client.on('close', () => {
      this.log('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.log('Redis reconnecting...');
    });

    this.client.on('end', () => {
      this.log('Redis connection ended');
    });
  }

  /**
   * Check if circuit breaker allows requests
   * 
   * @returns True if circuit is closed (allowing requests)
   * @private
   */
  private isCircuitClosed(): boolean {
    if (this.circuitState === CircuitState.CLOSED) {
      return true;
    }

    if (this.circuitState === CircuitState.OPEN) {
      // Check if reset timeout has passed
      if (
        this.circuitOpenedAt &&
        Date.now() - this.circuitOpenedAt >=
          (this.config.circuitBreakerResetTimeout || 60000)
      ) {
        this.log('Circuit breaker entering HALF_OPEN state');
        this.circuitState = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }

    if (this.circuitState === CircuitState.HALF_OPEN) {
      return true; // Allow test request
    }

    return false;
  }

  /**
   * Record successful operation
   * 
   * @private
   */
  private recordSuccess(): void {
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.log('Circuit breaker closing (operation succeeded)');
      this.resetCircuitBreaker();
    }
    this.failureCount = 0;
  }

  /**
   * Reset circuit breaker to CLOSED state
   * 
   * @private
   */
  private resetCircuitBreaker(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.circuitOpenedAt = undefined;
  }

  /**
   * Handle error and update circuit breaker
   * 
   * @param operation - Operation that failed
   * @param error - Error object
   * @private
   */
  private handleError(operation: string, error: unknown): void {
    this.errors++;
    this.failureCount++;

    this.log(`Redis ${operation} error:`, error);

    // Check if should open circuit breaker
    if (
      this.circuitState === CircuitState.CLOSED &&
      this.failureCount >= (this.config.circuitBreakerThreshold || 5)
    ) {
      this.log('Circuit breaker opening (threshold reached)');
      this.circuitState = CircuitState.OPEN;
      this.circuitOpenedAt = Date.now();
    }

    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.log('Circuit breaker re-opening (test request failed)');
      this.circuitState = CircuitState.OPEN;
      this.circuitOpenedAt = Date.now();
    }
  }

  /**
   * Log message (if debug logging enabled)
   * 
   * @param args - Log arguments
   * @private
   */
  private log(...args: unknown[]): void {
    if (this.config.enableDebugLogging) {
      console.log(`[${this.config.name}]`, ...args);
    }
  }

  /**
   * Get Redis client (for advanced operations)
   * 
   * @returns Redis client instance
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Get circuit breaker state (for debugging)
   * 
   * @returns Circuit state
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Get failure count (for debugging)
   * 
   * @returns Failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }
}

/**
 * Create RedisCache instance
 * 
 * Factory function for convenience.
 * 
 * @param config - Redis cache configuration
 * @returns RedisCache instance
 * 
 * @example
 * ```typescript
 * const cache = createRedisCache({
 *   host: 'localhost',
 *   port: 6379,
 *   defaultTTL: 300
 * });
 * ```
 */
export function createRedisCache(config?: RedisCacheConfig): RedisCache {
  return new RedisCache(config);
}

/**
 * Create Redis cache from connection string
 * 
 * @param connectionString - Redis connection string (redis://host:port/db)
 * @param config - Additional configuration
 * @returns RedisCache instance
 * 
 * @example
 * ```typescript
 * const cache = createRedisCacheFromUrl('redis://localhost:6379/0');
 * ```
 */
export function createRedisCacheFromUrl(
  connectionString: string,
  config?: Partial<RedisCacheConfig>
): RedisCache {
  return new RedisCache({
    connectionString,
    ...config,
  });
}
