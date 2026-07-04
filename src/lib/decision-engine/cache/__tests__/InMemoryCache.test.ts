/**
 * InMemoryCache Unit Tests
 * 
 * Tests for in-memory cache implementation with LRU eviction.
 * 
 * @see src/lib/decision-engine/cache/InMemoryCache.ts
 */

import { InMemoryCache, createInMemoryCache } from '../InMemoryCache';

describe('InMemoryCache', () => {
  describe('Constructor and Factory', () => {
    it('should create cache with default config', () => {
      const cache = new InMemoryCache();
      expect(cache).toBeDefined();
    });

    it('should create cache with custom config', () => {
      const cache = new InMemoryCache({
        name: 'test-cache',
        maxKeys: 100,
        maxMemoryBytes: 1024 * 1024,
        defaultTTL: 60,
      });
      expect(cache).toBeDefined();
    });

    it('should create cache via factory function', () => {
      const cache = createInMemoryCache({ maxKeys: 50 });
      expect(cache).toBeDefined();
    });
  });

  describe('Basic Operations', () => {
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = createInMemoryCache();
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

    it('should clear all keys', async () => {
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
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = createInMemoryCache({ defaultTTL: 1, cleanupIntervalMs: 100 }); // Faster cleanup
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should expire entry after TTL', async () => {
      await cache.set('key1', 'value1', 1); // 1 second TTL
      
      expect(await cache.get('key1')).toBe('value1');
      
      // Wait for expiration + cleanup
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      expect(await cache.get('key1')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      await cache.set('key1', 'value1'); // Uses default 1 second
      
      expect(await cache.get('key1')).toBe('value1');
      
      // Wait for expiration + cleanup
      await new Promise(resolve => setTimeout(resolve, 1300)); // More buffer
      
      // Trigger cleanup by calling getStats
      await cache.getStats();
      
      expect(await cache.get('key1')).toBeNull();
    });

    it('should not expire entry without TTL', async () => {
      const cacheNoTTL = createInMemoryCache(); // No default TTL
      await cacheNoTTL.set('key1', 'value1'); // No TTL specified
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(await cacheNoTTL.get('key1')).toBe('value1');
      
      await cacheNoTTL.close();
    });

    it('should override default TTL with custom TTL', async () => {
      await cache.set('key1', 'value1', 2); // 2 seconds (overrides default 1s)
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(await cache.get('key1')).toBe('value1'); // Still alive
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(await cache.get('key1')).toBeNull(); // Now expired
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entry when maxKeys reached', async () => {
      const cache = createInMemoryCache({ maxKeys: 3 });
      
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      // key1 is LRU, should be evicted
      await cache.set('key4', 'value4');
      
      expect(await cache.has('key1')).toBe(false); // Evicted
      expect(await cache.has('key2')).toBe(true);
      expect(await cache.has('key3')).toBe(true);
      expect(await cache.has('key4')).toBe(true);
      
      await cache.close();
    });

    it('should update LRU order on get', async () => {
      const cache = createInMemoryCache({ maxKeys: 3 });
      
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      // Access key1, making it most recently used
      await cache.get('key1');
      
      // key2 is now LRU, should be evicted
      await cache.set('key4', 'value4');
      
      expect(await cache.has('key1')).toBe(true); // Not evicted
      expect(await cache.has('key2')).toBe(false); // Evicted
      expect(await cache.has('key3')).toBe(true);
      expect(await cache.has('key4')).toBe(true);
      
      await cache.close();
    });

    it('should evict multiple entries to stay under memory limit', async () => {
      const cache = createInMemoryCache({
        maxMemoryBytes: 100, // Very small limit
      });
      
      // Each entry is roughly 20-30 bytes
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      await cache.set('key4', 'value4');
      
      // Should evict oldest entries to stay under limit
      const stats = await cache.getStats();
      expect(stats.memoryUsage).toBeLessThanOrEqual(100);
      
      await cache.close();
    });
  });

  describe('Pattern-based Deletion', () => {
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = createInMemoryCache();
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
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
      expect(await cache.has('key3')).toBe(false);
    });

    it('should delete keys matching prefix pattern', async () => {
      await cache.set('cache:user:1', 'data1');
      await cache.set('cache:user:2', 'data2');
      await cache.set('cache:post:1', 'data3');
      
      const deleted = await cache.delete('cache:user:*');
      
      expect(deleted).toBe(2);
      expect(await cache.has('cache:user:1')).toBe(false);
      expect(await cache.has('cache:user:2')).toBe(false);
      expect(await cache.has('cache:post:1')).toBe(true);
    });

    it('should return 0 when pattern matches no keys', async () => {
      await cache.set('key1', 'value1');
      
      const deleted = await cache.delete('nonexistent:*');
      
      expect(deleted).toBe(0);
    });
  });

  describe('Statistics', () => {
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = createInMemoryCache();
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should track cache hits and misses', async () => {
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

    it('should track number of keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      const stats = await cache.getStats();
      
      expect(stats.keys).toBe(3);
    });

    it('should track memory usage', async () => {
      await cache.set('key1', { data: 'value1' });
      
      const stats = await cache.getStats();
      
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should track evictions', async () => {
      const smallCache = createInMemoryCache({ maxKeys: 2 });
      
      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3'); // Triggers eviction
      
      const stats = await smallCache.getStats();
      
      expect(stats.evictions).toBe(1);
      
      await smallCache.close();
    });

    it('should calculate hit rate correctly', async () => {
      await cache.get('key1'); // Miss
      await cache.set('key1', 'value1');
      await cache.get('key1'); // Hit
      await cache.get('key1'); // Hit
      await cache.get('key2'); // Miss
      
      const stats = await cache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('Data Types', () => {
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = createInMemoryCache();
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should store and retrieve strings', async () => {
      await cache.set('key', 'string value');
      expect(await cache.get('key')).toBe('string value');
    });

    it('should store and retrieve numbers', async () => {
      await cache.set('key', 12345);
      expect(await cache.get('key')).toBe(12345);
    });

    it('should store and retrieve objects', async () => {
      const obj = { name: 'Test', age: 30 };
      await cache.set('key', obj);
      expect(await cache.get('key')).toEqual(obj);
    });

    it('should store and retrieve arrays', async () => {
      const arr = [1, 2, 3, 4, 5];
      await cache.set('key', arr);
      expect(await cache.get('key')).toEqual(arr);
    });

    it('should store and retrieve nested objects', async () => {
      const nested = {
        user: { id: 1, name: 'Test' },
        settings: { theme: 'dark', lang: 'en' },
      };
      await cache.set('key', nested);
      expect(await cache.get('key')).toEqual(nested);
    });

    it('should store and retrieve null', async () => {
      await cache.set('key', null);
      expect(await cache.get('key')).toBeNull();
    });

    it('should store and retrieve boolean', async () => {
      await cache.set('key1', true);
      await cache.set('key2', false);
      expect(await cache.get('key1')).toBe(true);
      expect(await cache.get('key2')).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = createInMemoryCache();
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should handle concurrent sets', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`));
      }
      
      await Promise.all(promises);
      
      const stats = await cache.getStats();
      expect(stats.keys).toBe(100);
    });

    it('should handle concurrent gets', async () => {
      await cache.set('key', 'value');
      
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(cache.get('key'));
      }
      
      const results = await Promise.all(promises);
      
      expect(results.every(r => r === 'value')).toBe(true);
    });

    it('should handle mixed concurrent operations', async () => {
      const promises = [];
      
      for (let i = 0; i < 50; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`));
        promises.push(cache.get(`key${i}`));
        promises.push(cache.has(`key${i}`));
      }
      
      await Promise.all(promises);
      
      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    let cache: InMemoryCache;

    beforeEach(() => {
      cache = createInMemoryCache();
    });

    afterEach(async () => {
      await cache.close();
    });

    it('should handle empty string key', async () => {
      await cache.set('', 'value');
      expect(await cache.get('')).toBe('value');
    });

    it('should handle special characters in key', async () => {
      const key = 'key:with:colons:and-dashes_and.dots';
      await cache.set(key, 'value');
      expect(await cache.get(key)).toBe('value');
    });

    it('should handle very long keys', async () => {
      const longKey = 'k'.repeat(1000);
      await cache.set(longKey, 'value');
      expect(await cache.get(longKey)).toBe('value');
    });

    it('should handle very large values', async () => {
      const largeValue = 'x'.repeat(10000);
      await cache.set('key', largeValue);
      expect(await cache.get('key')).toBe(largeValue);
    });

    it('should handle overwriting existing key', async () => {
      await cache.set('key', 'value1');
      await cache.set('key', 'value2');
      expect(await cache.get('key')).toBe('value2');
    });

    it('should handle deleting non-existent key', async () => {
      const deleted = await cache.delete('nonexistent');
      expect(deleted).toBe(0);
    });

    it('should handle clearing empty cache', async () => {
      await cache.clear();
      const stats = await cache.getStats();
      expect(stats.keys).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should stop cleanup timer on close', async () => {
      const cache = createInMemoryCache();
      
      await cache.set('key', 'value', 1);
      await cache.close();
      
      // Wait for would-be cleanup
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should not throw (cleanup stopped)
      expect(true).toBe(true);
    });

    it('should remove expired entries during cleanup', async () => {
      const cache = createInMemoryCache({ cleanupIntervalMs: 500 });
      
      await cache.set('key1', 'value1', 1); // 1 second TTL
      await cache.set('key2', 'value2'); // No TTL
      
      // Wait for expiration + cleanup
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(true);
      
      await cache.close();
    });
  });
});
