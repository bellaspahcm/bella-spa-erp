/**
 * Cache Integration Tests
 * 
 * Tests for cache integration with DecisionEngine.
 * Verifies cache behavior in real decision workflows.
 * 
 * @see src/lib/decision-engine/core/DecisionEngine.ts
 */

import { InMemoryEventPublisher } from '@/lib/events/publishers/InMemoryEventPublisher';
import { NoOpLogger } from '@/lib/logger';
import {
  AggressiveCacheStrategy,
  ConservativeCacheStrategy,
  DefaultCacheStrategy,
  NoCacheStrategy,
} from '../ICacheStrategy';
import { createInMemoryCache } from '../InMemoryCache';
import { DecisionEngine } from '../../core/DecisionEngine';
import { createProviderRegistry } from '../../core/DecisionProviderRegistry';
import { RuleProvider } from '../../providers/RuleProvider';
import type { DecisionContext } from '../../types';

describe('Cache Integration with DecisionEngine', () => {
  describe('Basic Cache Integration', () => {
    it('should use cache when enabled', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new DefaultCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      // First evaluation - cache miss
      const result1 = await engine.evaluate(context);
      expect(result1.approved).toBe(true);
      expect(result1.metadata?.fromCache).toBeUndefined();

      // Second evaluation - cache hit
      const result2 = await engine.evaluate(context);
      expect(result2.approved).toBe(true);
      expect(result2.metadata?.fromCache).toBe(true);
      expect(result2.executionTime).toBeLessThan(result1.executionTime);

      await cache.close();
    });

    it('should work without cache', async () => {
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      const result = await engine.evaluate(context);
      expect(result.approved).toBe(true);
      expect(result.metadata?.fromCache).toBeUndefined();
    });

    it('should gracefully degrade on cache errors', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new DefaultCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      // Close cache to simulate errors
      await cache.close();

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      // Should still work despite cache errors
      const result = await engine.evaluate(context);
      expect(result.approved).toBe(true);
    });
  });

  describe('Cache Strategies', () => {
    it('should respect DefaultCacheStrategy', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new DefaultCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      await engine.evaluate(context);
      await engine.evaluate(context);

      const stats = engine.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      await cache.close();
    });

    it('should respect ConservativeCacheStrategy', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new ConservativeCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const approvedContext: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      // Conservative strategy only caches approved with high confidence
      await engine.evaluate(approvedContext);
      await engine.evaluate(approvedContext);

      const stats = engine.getCacheStats();
      expect(stats.hits).toBe(1);

      await cache.close();
    });

    it('should respect AggressiveCacheStrategy', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new AggressiveCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      // Aggressive strategy caches everything
      await engine.evaluate(context);
      await engine.evaluate(context);

      const stats = engine.getCacheStats();
      expect(stats.hits).toBe(1);

      await cache.close();
    });

    it('should respect NoCacheStrategy', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new NoCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      // NoCache strategy never caches
      await engine.evaluate(context);
      await engine.evaluate(context);

      const stats = engine.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2);

      await cache.close();
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits and misses', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new DefaultCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const context1: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      const context2: DecisionContext = {
        ...context1,
        data: { amount: 6000000 }, // Different data = different cache key
      };

      // Evaluation 1 - miss
      await engine.evaluate(context1);

      // Evaluation 2 - hit (same context)
      await engine.evaluate(context1);

      // Evaluation 3 - miss (different context)
      await engine.evaluate(context2);

      // Evaluation 4 - hit (same as #3)
      await engine.evaluate(context2);

      const stats = engine.getCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(50);
      expect(stats.totalRequests).toBe(4);
      expect(stats.cacheEnabled).toBe(true);

      await cache.close();
    });

    it('should report cache disabled when no cache', () => {
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const stats = engine.getCacheStats();
      expect(stats.cacheEnabled).toBe(false);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache by tenant', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new DefaultCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      // Cache decision
      await engine.evaluate(context);

      // Invalidate cache
      const deleted = await engine.invalidateCache('test-tenant');
      expect(deleted).toBeGreaterThan(0);

      // Next evaluation should be cache miss
      await engine.evaluate(context);

      const stats = engine.getCacheStats();
      expect(stats.misses).toBe(2); // Initial miss + post-invalidation miss

      await cache.close();
    });

    it('should invalidate cache by module', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new DefaultCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const bookingContext: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      const leaveContext: DecisionContext = {
        ...bookingContext,
        module: 'leave',
      };

      // Cache both decisions
      await engine.evaluate(bookingContext);
      await engine.evaluate(leaveContext);

      // Invalidate only booking module
      await engine.invalidateCache('test-tenant', 'booking');

      // Booking should be miss, leave should be hit
      await engine.evaluate(bookingContext); // Miss
      await engine.evaluate(leaveContext); // Hit

      const stats = engine.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(3);

      await cache.close();
    });

    it('should invalidate cache by decision type', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new DefaultCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const approvalContext: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      const pricingContext: DecisionContext = {
        ...approvalContext,
        decisionType: 'pricing',
      };

      // Cache both decisions
      await engine.evaluate(approvalContext);
      await engine.evaluate(pricingContext);

      // Invalidate only auto-approval
      await engine.invalidateCache('test-tenant', 'booking', 'auto-approval');

      // Approval should be miss, pricing should be hit
      await engine.evaluate(approvalContext); // Miss
      await engine.evaluate(pricingContext); // Hit

      const stats = engine.getCacheStats();
      expect(stats.hits).toBe(1);

      await cache.close();
    });

    it('should handle invalidation when cache not enabled', async () => {
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const deleted = await engine.invalidateCache('test-tenant');
      expect(deleted).toBe(0);
    });
  });

  describe('Cache Warming', () => {
    it('should warm cache with common scenarios', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new DefaultCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const contexts: DecisionContext[] = [
        {
          tenantId: 'test-tenant',
          module: 'booking',
          decisionType: 'auto-approval',
          ruleType: 'if-then',
          rule: {
            condition: { field: 'amount', operator: '<', value: 5000000 },
            action: { approve: true },
          },
          data: { amount: 3000000 },
        },
        {
          tenantId: 'test-tenant',
          module: 'booking',
          decisionType: 'auto-approval',
          ruleType: 'if-then',
          rule: {
            condition: { field: 'amount', operator: '<', value: 5000000 },
            action: { approve: true },
          },
          data: { amount: 4000000 },
        },
      ];

      const result = await engine.warmCache(contexts);
      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);

      // Subsequent evaluations should be cache hits
      await engine.evaluate(contexts[0]);
      await engine.evaluate(contexts[1]);

      const stats = engine.getCacheStats();
      expect(stats.hits).toBe(2);

      await cache.close();
    });

    it('should handle warming failures gracefully', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new DefaultCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const contexts: DecisionContext[] = [
        {
          tenantId: 'test-tenant',
          module: 'booking',
          decisionType: 'auto-approval',
          ruleType: 'if-then',
          rule: {
            condition: { field: 'amount', operator: '<', value: 5000000 },
            action: { approve: true },
          },
          data: { amount: 3000000 },
        },
        {
          tenantId: 'test-tenant',
          module: 'booking',
          decisionType: 'invalid',
          ruleType: 'unsupported', // This will fail
          rule: {},
          data: {},
        },
      ];

      const result = await engine.warmCache(contexts);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);

      await cache.close();
    });

    it('should handle warming when cache not enabled', async () => {
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const result = await engine.warmCache([]);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('Cache Clear', () => {
    it('should clear entire cache', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new DefaultCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      // Cache decision
      await engine.evaluate(context);

      // Clear cache
      await engine.clearCache();

      // Next evaluation should be cache miss
      await engine.evaluate(context);

      const stats = engine.getCacheStats();
      expect(stats.misses).toBe(2);

      await cache.close();
    });

    it('should handle clear when cache not enabled', async () => {
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      // Should not throw
      await expect(engine.clearCache()).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should significantly reduce latency with cache hit', async () => {
      const cache = createInMemoryCache();
      const registry = createProviderRegistry();
      registry.register(new RuleProvider());

      const engine = new DecisionEngine({
        registry,
        cache,
        cacheStrategy: new DefaultCacheStrategy(),
        eventPublisher: new InMemoryEventPublisher(),
        logger: new NoOpLogger(),
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {
          condition: { field: 'amount', operator: '<', value: 5000000 },
          action: { approve: true },
        },
        data: { amount: 3000000 },
      };

      // First evaluation (cache miss)
      const result1 = await engine.evaluate(context);
      const cacheMissTime = result1.executionTime;

      // Second evaluation (cache hit)
      const result2 = await engine.evaluate(context);
      const cacheHitTime = result2.executionTime;

      // Cache hit should be faster
      expect(cacheHitTime).toBeLessThan(cacheMissTime);
      expect(cacheHitTime).toBeLessThan(10); // Target: <10ms

      await cache.close();
    });
  });
});
