/**
 * RedisCache Unit Tests
 * 
 * Tests for Redis cache implementation with circuit breaker.
 * Uses mock Redis client to avoid requiring actual Redis server.
 * 
 * @see src/lib/decision-engine/cache/RedisCache.ts
 */

import type Redis from 'ioredis';
import { RedisCache, createRedisCache, createRedisCacheFromUrl } from '../RedisCache';

// Mock ioredis
jest.mock('ioredis', () => {
  const mockRedis = {
    data: new Map<string, { value: string; ttl?: number; expiresAt?: number }>(),
    
    get: jest.fn(async function(this: any, key: string) {
      const entry = this.data.get(key);
      if (!entry) return null;
      
      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.data.delete(key);
        return null;
      }
      
      return entry.value;
    }),
    
    set: jest.fn(async function(this: any, key: string, value: string) {
      this.data.set(key, { value });
      return 'OK';
    }),
    
    setex: jest.fn(async function(this: any, key: string, ttl: number, value: string) {
      this.data.set(key, {
        value,
        ttl,
        expiresAt: Date.now() + ttl * 1000,
      });
      return 'OK';
    }),
    
    del: jest.fn(async function(this: any, ...keys: string[]) {
      let deleted = 0;
      for (const key of keys) {
        if (this.data.delete(key)) {
          deleted++;
        }
      }
      return deleted;
    }),
    
    exists: jest.fn(async function(this: any, key: string) {
      return this.data.has(key) ? 1 : 0;
    }),
    
    scan: jest.fn(async function(
      this: any,
      cursor: string,
      match: string,
      pattern: string,
      count: string,
      countValue: number
    ) {
      const keys = Array.from(this.data.keys());
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      const matchedKeys = keys.filter(k => regex.test(k));
      return ['0', matchedKeys];
    }),
    
    flushdb: jest.fn(async function(this: any) {
      this.data.clear();
      return 'OK';
    }),
    
    dbsize: jest.fn(async function(this: any) {
      return this.data.size;
    }),
    
    info: jest.fn(async () => {
      return 'used_memory:1024000';
    }),
    
    quit: jest.fn(async () => 'OK'),
    disconnect: jest.fn(),
    
    on: jest.fn(),
  };
  
  return jest.fn(() => mockRedis);
});

describe('RedisCache', () => {
  describe('Constructor and Factory', () => {
    it('should create cache with default config', () => {
      const cache = new RedisCache();
      expect(cache).toBeDefined();
    });

    it('should create cache with custom config', () => {
      const cache = new RedisCache({
        host: 'localhost',
        port: 6379,
        defaultTTL: 300,
        keyPrefix: 'test:',
      });
      expect(cache).toBeDefined();
    });

    it('should create cache via factory function', () => {
      const cache = createRedisCache({ defaultTTL: 600 });
      expect(cache).toBeDefined();
    });

    it('should create cache from connection string', () => {
      const cache = createRedisCacheFromUrl('redis://localhost:6379/0');
      expect(cache).toBeDefined();
    });
  });

  describe('Basic Operations', () => {
    let cache: RedisCache;

    beforeEach(() => {
      cache = createRedisCache({ keyPrefix: 'test:' });
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should set and get value', async () => {
      await cache.set('key1', { data: 'value1' });
      const value = await cache.get<{ data: string }>('key1');
      
      expect(value).toEqual({ data: 'value1' });
    });

    it('should return null for non-existent key', async () => {
      const value = await cache.get('non-existent');
      expect(value).toBeNull();
    });

    it('should check key existence', async () => {
      await cache.set('key1', 'value1');
      
      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('non-existent')).toBe(false);
    });

    it('should delete single key', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      const deleted = await cache.delete('key1');
      
      expect(deleted).toBe(1);
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(true);
    });

    it('should clear all keys with prefix', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      await cache.clear();
      
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
      expect(await cache.has('key3')).toBe(false);
    });
  });

  describe('TTL (Time-To-Live)', () => {
    let cache: RedisCache;

    beforeEach(() => {
      cache = createRedisCache({ defaultTTL: 300 });
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should set value with custom TTL', async () => {
      await cache.set('key1', 'value1', 60);
      expect(await cache.get('key1')).toBe('value1');
    });

    it('should use default TTL when not specified', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.get('key1')).toBe('value1');
    });

    it('should set value without TTL when defaultTTL is 0', async () => {
      const cacheNoTTL = createRedisCache({ defaultTTL: 0 });
      await cacheNoTTL.set('key1', 'value1');
      expect(await cacheNoTTL.get('key1')).toBe('value1');
      await cacheNoTTL.close();
    });
  });

  describe('Pattern-based Deletion', () => {
    let cache: RedisCache;

    beforeEach(() => {
      cache = createRedisCache({ keyPrefix: 'app:' });
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should delete keys matching wildcard pattern', async () => {
      await cache.set('user:123:profile', 'data1');
      await cache.set('user:123:settings', 'data2');
      await cache.set('user:456:profile', 'data3');
      
      const deleted = await cache.delete('user:123:*');
      
      expect(deleted).toBe(2);
      expect(await cache.has('user:123:profile')).toBe(false);
      expect(await cache.has('user:123:settings')).toBe(false);
      expect(await cache.has('user:456:profile')).toBe(true);
    });

    it('should delete all keys with * pattern', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      const deleted = await cache.delete('*');
      
      expect(deleted).toBe(3);
    });

    it('should return 0 when pattern matches no keys', async () => {
      await cache.set('key1', 'value1');
      
      const deleted = await cache.delete('nonexistent:*');
      
      expect(deleted).toBe(0);
    });
  });

  describe('Serialization', () => {
    let cache: RedisCache;

    beforeEach(() => {
      cache = createRedisCache();
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should serialize and deserialize strings', async () => {
      await cache.set('key', 'string value');
      expect(await cache.get('key')).toBe('string value');
    });

    it('should serialize and deserialize numbers', async () => {
      await cache.set('key', 12345);
      expect(await cache.get('key')).toBe(12345);
    });

    it('should serialize and deserialize objects', async () => {
      const obj = { name: 'Test', age: 30 };
      await cache.set('key', obj);
      expect(await cache.get('key')).toEqual(obj);
    });

    it('should serialize and deserialize arrays', async () => {
      const arr = [1, 2, 3, 4, 5];
      await cache.set('key', arr);
      expect(await cache.get('key')).toEqual(arr);
    });

    it('should serialize and deserialize nested objects', async () => {
      const nested = {
        user: { id: 1, name: 'Test' },
        settings: { theme: 'dark', lang: 'en' },
      };
      await cache.set('key', nested);
      expect(await cache.get('key')).toEqual(nested);
    });

    it('should serialize and deserialize null', async () => {
      await cache.set('key', null);
      expect(await cache.get('key')).toBeNull();
    });

    it('should serialize and deserialize boolean', async () => {
      await cache.set('key1', true);
      await cache.set('key2', false);
      expect(await cache.get('key1')).toBe(true);
      expect(await cache.get('key2')).toBe(false);
    });
  });

  describe('Statistics', () => {
    let cache: RedisCache;

    beforeEach(() => {
      cache = createRedisCache();
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should track cache hits and misses', async () => {
      await cache.set('key1', 'value1');
      
      await cache.get('key1'); // Hit
      await cache.get('key2'); // Miss
      await cache.get('key1'); // Hit
      
      const stats = await cache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should track number of keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      const stats = await cache.getStats();
      
      expect(stats.keys).toBe(3);
    });

    it('should track memory usage from Redis', async () => {
      const stats = await cache.getStats();
      
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should calculate hit rate correctly', async () => {
      await cache.set('key1', 'value1');
      
      await cache.get('key1'); // Hit
      await cache.get('key2'); // Miss
      await cache.get('key1'); // Hit
      await cache.get('key3'); // Miss
      
      const stats = await cache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('Circuit Breaker', () => {
    let cache: RedisCache;
    let mockClient: any;

    beforeEach(() => {
      cache = createRedisCache({
        circuitBreakerThreshold: 3,
        circuitBreakerResetTimeout: 1000,
      });
      mockClient = (cache as any).client;
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should open circuit after threshold failures', async () => {
      // Simulate failures
      mockClient.get.mockRejectedValueOnce(new Error('Connection error'));
      mockClient.get.mockRejectedValueOnce(new Error('Connection error'));
      mockClient.get.mockRejectedValueOnce(new Error('Connection error'));
      
      await cache.get('key1'); // Failure 1
      await cache.get('key2'); // Failure 2
      await cache.get('key3'); // Failure 3 - opens circuit
      
      expect(cache.getCircuitState()).toBe('OPEN');
      
      // Next request should be rejected immediately
      const result = await cache.get('key4');
      expect(result).toBeNull();
    });

    it('should enter half-open state after timeout', async () => {
      // Open circuit
      mockClient.get.mockRejectedValue(new Error('Connection error'));
      await cache.get('key1');
      await cache.get('key2');
      await cache.get('key3');
      
      expect(cache.getCircuitState()).toBe('OPEN');
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should allow test request
      mockClient.get.mockResolvedValueOnce('"test"');
      await cache.get('key5');
      
      // Circuit should close after successful request
      expect(cache.getCircuitState()).toBe('CLOSED');
    });

    it('should close circuit after successful request in half-open state', async () => {
      // Open circuit
      mockClient.get.mockRejectedValue(new Error('Connection error'));
      await cache.get('key1');
      await cache.get('key2');
      await cache.get('key3');
      
      // Wait for half-open
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Successful request should close circuit
      mockClient.get.mockResolvedValueOnce('"success"');
      await cache.get('key4');
      
      expect(cache.getCircuitState()).toBe('CLOSED');
    });

    it('should reopen circuit on failure in half-open state', async () => {
      // Open circuit
      mockClient.get.mockRejectedValue(new Error('Connection error'));
      await cache.get('key1');
      await cache.get('key2');
      await cache.get('key3');
      
      // Wait for half-open
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Failed test request should reopen circuit
      mockClient.get.mockRejectedValueOnce(new Error('Still failing'));
      await cache.get('key4');
      
      expect(cache.getCircuitState()).toBe('OPEN');
    });

    it('should track failure count', async () => {
      mockClient.get.mockRejectedValue(new Error('Connection error'));
      
      await cache.get('key1');
      expect(cache.getFailureCount()).toBe(1);
      
      await cache.get('key2');
      expect(cache.getFailureCount()).toBe(2);
    });

    it('should reset failure count on success', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Connection error'));
      await cache.get('key1');
      
      expect(cache.getFailureCount()).toBe(1);
      
      mockClient.get.mockResolvedValueOnce('"success"');
      await cache.get('key2');
      
      expect(cache.getFailureCount()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    let cache: RedisCache;
    let mockClient: any;

    beforeEach(() => {
      cache = createRedisCache();
      mockClient = (cache as any).client;
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should handle get errors gracefully', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Redis error'));
      
      const result = await cache.get('key');
      
      expect(result).toBeNull(); // Graceful fallback
    });

    it('should handle set errors gracefully', async () => {
      mockClient.setex.mockRejectedValueOnce(new Error('Redis error'));
      
      // Should not throw
      await expect(cache.set('key', 'value')).resolves.not.toThrow();
    });

    it('should handle delete errors gracefully', async () => {
      mockClient.del.mockRejectedValueOnce(new Error('Redis error'));
      
      const result = await cache.delete('key');
      
      expect(result).toBe(0);
    });

    it('should handle has errors gracefully', async () => {
      mockClient.exists.mockRejectedValueOnce(new Error('Redis error'));
      
      const result = await cache.has('key');
      
      expect(result).toBe(false);
    });

    it('should handle clear errors gracefully', async () => {
      mockClient.scan.mockRejectedValueOnce(new Error('Redis error'));
      
      // Should not throw
      await expect(cache.clear()).resolves.not.toThrow();
    });

    it('should handle serialization errors', async () => {
      const circular: any = {};
      circular.self = circular;
      
      await expect(cache.set('key', circular)).rejects.toThrow();
    });
  });

  describe('Key Prefixing', () => {
    it('should prefix all keys with keyPrefix', async () => {
      const cache = createRedisCache({ keyPrefix: 'myapp:' });
      const mockClient = (cache as any).client;
      
      await cache.set('user:123', 'data');
      
      // Check that Redis client received prefixed key
      expect(mockClient.setex).toHaveBeenCalledWith(
        'myapp:user:123',
        expect.any(Number),
        expect.any(String)
      );
      
      await cache.close();
    });

    it('should work without keyPrefix', async () => {
      const cache = createRedisCache({ keyPrefix: '' });
      const mockClient = (cache as any).client;
      
      await cache.set('user:123', 'data');
      
      expect(mockClient.setex).toHaveBeenCalledWith(
        'user:123',
        expect.any(Number),
        expect.any(String)
      );
      
      await cache.close();
    });
  });

  describe('Connection Management', () => {
    it('should close connection gracefully', async () => {
      const cache = createRedisCache();
      const mockClient = (cache as any).client;
      
      await cache.close();
      
      expect(mockClient.quit).toHaveBeenCalled();
    });

    it('should force disconnect on close error', async () => {
      const cache = createRedisCache();
      const mockClient = (cache as any).client;
      
      mockClient.quit.mockRejectedValueOnce(new Error('Quit error'));
      
      await cache.close();
      
      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('Advanced Operations', () => {
    let cache: RedisCache;

    beforeEach(() => {
      cache = createRedisCache();
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should handle overwriting existing key', async () => {
      await cache.set('key', 'value1');
      await cache.set('key', 'value2');
      expect(await cache.get('key')).toBe('value2');
    });

    it('should handle concurrent operations', async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`));
      }
      
      await Promise.all(promises);
      
      const stats = await cache.getStats();
      expect(stats.keys).toBe(50);
    });

    it('should get Redis client for advanced operations', () => {
      const client = cache.getClient();
      expect(client).toBeDefined();
    });
  });
});
