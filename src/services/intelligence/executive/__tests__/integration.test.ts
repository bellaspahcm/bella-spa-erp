/**
 * Integration Tests: Executive Intelligence with Real Supabase
 * 
 * Tests executive intelligence layer with real database queries:
 * 1. Fetch revenue summary for test tenant (real DB query)
 * 2. Verify cache invalidation on revenue.created event
 * 3. Test period switching (day → week → month)
 * 4. Test date range filtering with real data
 * 5. Verify query performance (<200ms for cached, <1s for fresh)
 * 
 * Prerequisites:
 * - Test Supabase instance with seeded data
 * - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.test
 * - Test tenant with revenue, bookings, sessions, expenses
 * 
 * Note: These tests query real database and may be slower than unit tests.
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  ExecutiveIntelligenceService,
  getExecutiveIntelligence,
  resetExecutiveIntelligence,
} from '../service';
import { getCache } from '../../cache';

// Environment variables for test Supabase instance
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Skip integration tests if Supabase credentials not available
const skipIntegrationTests = !supabaseUrl || !supabaseKey;

// Test tenant ID (should exist in test database with seeded data)
const TEST_TENANT_ID = process.env.TEST_TENANT_ID || '00000000-0000-0000-0000-000000000000';

// Performance thresholds
const PERFORMANCE_THRESHOLD = {
  CACHED_QUERY_MS: 200,   // Cache hit should be <200ms
  FRESH_QUERY_MS: 1000,   // Fresh DB query should be <1s
  TOTAL_DASHBOARD_MS: 5000, // All 5 metrics should load <5s
};

describe('Executive Intelligence - Integration Tests', () => {
  let supabase: ReturnType<typeof createClient<Database>> | null = null;
  let service: ExecutiveIntelligenceService | null = null;

  beforeAll(() => {
    if (skipIntegrationTests) {
      console.log('⚠️  Skipping integration tests - Supabase credentials not available');
      console.log('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to run integration tests');
      return;
    }

    // Create Supabase client
    supabase = createClient<Database>(supabaseUrl!, supabaseKey!);

    // Get service instance
    service = getExecutiveIntelligence();
  });

  afterEach(async () => {
    if (!skipIntegrationTests && service) {
      // Clear cache after each test to avoid interference
      await service.clearCache();
      resetExecutiveIntelligence();
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: Fetch Revenue Summary with Real Data
  // ───────────────────────────────────────────────────────────────────────────

  describe('Test 1: Revenue Summary with Real Data', () => {
    it('should fetch revenue summary from database on cache miss', async () => {
      if (skipIntegrationTests) return;

      const startTime = performance.now();

      const result = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.cacheHit).toBe(false); // First query = cache miss
      expect(result.metadata.dataSourcesUsed).toContain('revenue');

      // Verify data schema
      expect(result.data).toHaveProperty('period');
      expect(result.data).toHaveProperty('totalRevenue');
      expect(result.data).toHaveProperty('revenueGrowth');

      // Verify performance (fresh query should be <1s)
      console.log(`  ⏱️  Fresh query time: ${queryTime.toFixed(2)}ms`);
      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD.FRESH_QUERY_MS);
    });

    it('should return cached data on second query (cache hit)', async () => {
      if (skipIntegrationTests) return;

      // First query (cache miss)
      await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');

      // Second query (cache hit)
      const startTime = performance.now();
      const result = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');
      const endTime = performance.now();
      const queryTime = endTime - startTime;

      // Verify cache hit
      expect(result.metadata.cacheHit).toBe(true);
      expect(result.metadata.dataSourcesUsed).toEqual(['cache']);

      // Verify performance (cached query should be <200ms)
      console.log(`  ⚡ Cached query time: ${queryTime.toFixed(2)}ms`);
      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLD.CACHED_QUERY_MS);
    });

    it('should handle custom date range filtering', async () => {
      if (skipIntegrationTests) return;

      const dateRange = {
        startDate: '2026-06-01',
        endDate: '2026-06-15', // First half of June
      };

      const result = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, dateRange);

      expect(result.data).toBeDefined();
      expect(result.data.period).toBe('2026-06-01'); // Should match start date
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: Cache Invalidation on Data Changes
  // ───────────────────────────────────────────────────────────────────────────

  describe('Test 2: Cache Invalidation', () => {
    it('should invalidate cache when clearCache is called', async () => {
      if (skipIntegrationTests) return;

      // Populate cache
      const firstResult = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');
      expect(firstResult.metadata.cacheHit).toBe(false);

      // Verify cache hit
      const secondResult = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');
      expect(secondResult.metadata.cacheHit).toBe(true);

      // Clear cache
      await service!.clearCache();

      // Next query should be cache miss
      const thirdResult = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');
      expect(thirdResult.metadata.cacheHit).toBe(false);
    });

    it('should support tenant-specific cache clearing', async () => {
      if (skipIntegrationTests) return;

      const cache = getCache();

      // Populate cache for test tenant
      await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');

      // Clear cache by tenant tag
      await cache.deleteByTag(`tenant:${TEST_TENANT_ID}`);

      // Next query should be cache miss
      const result = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');
      expect(result.metadata.cacheHit).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: Period Switching (Day → Week → Month)
  // ───────────────────────────────────────────────────────────────────────────

  describe('Test 3: Period Switching', () => {
    it('should handle day period query', async () => {
      if (skipIntegrationTests) return;

      const result = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'day');

      expect(result.data).toBeDefined();
      expect(result.data.period).toBeDefined();
      // Day period should return data for current day
    });

    it('should handle week period query', async () => {
      if (skipIntegrationTests) return;

      const result = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'week');

      expect(result.data).toBeDefined();
      expect(result.data.period).toBeDefined();
      // Week period should return data for current week
    });

    it('should handle month period query', async () => {
      if (skipIntegrationTests) return;

      const result = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');

      expect(result.data).toBeDefined();
      expect(result.data.period).toBeDefined();
      // Month period should return data for current month
    });

    it('should handle quarter period query', async () => {
      if (skipIntegrationTests) return;

      const result = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'quarter');

      expect(result.data).toBeDefined();
      expect(result.data.period).toBeDefined();
      // Quarter period should return data for current quarter (Q1/Q2/Q3/Q4)
    });

    it('should handle year period query', async () => {
      if (skipIntegrationTests) return;

      const result = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'year');

      expect(result.data).toBeDefined();
      expect(result.data.period).toBeDefined();
      // Year period should return data for current year
    });

    it('should generate different cache keys for different periods', async () => {
      if (skipIntegrationTests) return;

      // Query multiple periods
      const dayResult = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'day');
      const weekResult = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'week');
      const monthResult = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');

      // First query for each period should be cache miss
      expect(dayResult.metadata.cacheHit).toBe(false);
      expect(weekResult.metadata.cacheHit).toBe(false);
      expect(monthResult.metadata.cacheHit).toBe(false);

      // Second query for same period should be cache hit
      const dayResult2 = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'day');
      expect(dayResult2.metadata.cacheHit).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 4: All 5 Executive Metrics
  // ───────────────────────────────────────────────────────────────────────────

  describe('Test 4: All 5 Metrics Integration', () => {
    it('should fetch all 5 metrics successfully', async () => {
      if (skipIntegrationTests) return;

      const dateRange = 'month';

      // Fetch all 5 metrics in parallel (simulates dashboard load)
      const startTime = performance.now();

      const [revenue, efficiency, customer, financial, growth] = await Promise.all([
        service!.getMonthlyRevenueSummary(TEST_TENANT_ID, dateRange),
        service!.getOperationalEfficiency(TEST_TENANT_ID, dateRange),
        service!.getCustomerMetrics(TEST_TENANT_ID, dateRange),
        service!.getFinancialHealth(TEST_TENANT_ID, dateRange),
        service!.getGrowthIndicators(TEST_TENANT_ID, dateRange),
      ]);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Verify all metrics loaded successfully
      expect(revenue.data).toBeDefined();
      expect(efficiency.data).toBeDefined();
      expect(customer.data).toBeDefined();
      expect(financial.data).toBeDefined();
      expect(growth.data).toBeDefined();

      // Verify total dashboard load time
      console.log(`  📊 Total dashboard load time: ${totalTime.toFixed(2)}ms`);
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLD.TOTAL_DASHBOARD_MS);

      // First load should be all cache misses
      expect(revenue.metadata.cacheHit).toBe(false);
      expect(efficiency.metadata.cacheHit).toBe(false);
      expect(customer.metadata.cacheHit).toBe(false);
      expect(financial.metadata.cacheHit).toBe(false);
      expect(growth.metadata.cacheHit).toBe(false);
    });

    it('should serve all 5 metrics from cache on second load', async () => {
      if (skipIntegrationTests) return;

      const dateRange = 'month';

      // First load (populate cache)
      await Promise.all([
        service!.getMonthlyRevenueSummary(TEST_TENANT_ID, dateRange),
        service!.getOperationalEfficiency(TEST_TENANT_ID, dateRange),
        service!.getCustomerMetrics(TEST_TENANT_ID, dateRange),
        service!.getFinancialHealth(TEST_TENANT_ID, dateRange),
        service!.getGrowthIndicators(TEST_TENANT_ID, dateRange),
      ]);

      // Second load (from cache)
      const startTime = performance.now();

      const [revenue, efficiency, customer, financial, growth] = await Promise.all([
        service!.getMonthlyRevenueSummary(TEST_TENANT_ID, dateRange),
        service!.getOperationalEfficiency(TEST_TENANT_ID, dateRange),
        service!.getCustomerMetrics(TEST_TENANT_ID, dateRange),
        service!.getFinancialHealth(TEST_TENANT_ID, dateRange),
        service!.getGrowthIndicators(TEST_TENANT_ID, dateRange),
      ]);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All should be cache hits
      expect(revenue.metadata.cacheHit).toBe(true);
      expect(efficiency.metadata.cacheHit).toBe(true);
      expect(customer.metadata.cacheHit).toBe(true);
      expect(financial.metadata.cacheHit).toBe(true);
      expect(growth.metadata.cacheHit).toBe(true);

      // Cached load should be much faster
      console.log(`  ⚡ Cached dashboard load time: ${totalTime.toFixed(2)}ms`);
      expect(totalTime).toBeLessThan(1000); // All 5 metrics from cache <1s
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 5: Query Performance Benchmarks
  // ───────────────────────────────────────────────────────────────────────────

  describe('Test 5: Performance Benchmarks', () => {
    it('should measure cache vs fresh query performance', async () => {
      if (skipIntegrationTests) return;

      const iterations = 5;
      const freshTimes: number[] = [];
      const cachedTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Clear cache before fresh query
        await service!.clearCache();

        // Measure fresh query
        const freshStart = performance.now();
        await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');
        const freshEnd = performance.now();
        freshTimes.push(freshEnd - freshStart);

        // Measure cached query (same params)
        const cachedStart = performance.now();
        await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');
        const cachedEnd = performance.now();
        cachedTimes.push(cachedEnd - cachedStart);
      }

      // Calculate averages
      const avgFreshTime = freshTimes.reduce((a, b) => a + b) / iterations;
      const avgCachedTime = cachedTimes.reduce((a, b) => a + b) / iterations;
      const speedup = avgFreshTime / avgCachedTime;

      console.log('\n  📈 Performance Benchmark Results:');
      console.log(`     Fresh Query Avg:  ${avgFreshTime.toFixed(2)}ms`);
      console.log(`     Cached Query Avg: ${avgCachedTime.toFixed(2)}ms`);
      console.log(`     Speedup:          ${speedup.toFixed(2)}x faster`);

      // Verify performance targets
      expect(avgCachedTime).toBeLessThan(PERFORMANCE_THRESHOLD.CACHED_QUERY_MS);
      expect(avgFreshTime).toBeLessThan(PERFORMANCE_THRESHOLD.FRESH_QUERY_MS);
      expect(speedup).toBeGreaterThan(2); // Cache should be at least 2x faster
    });

    it('should measure cache hit rate over multiple queries', async () => {
      if (skipIntegrationTests) return;

      const totalQueries = 20;
      let cacheHits = 0;

      // Clear cache first
      await service!.clearCache();

      for (let i = 0; i < totalQueries; i++) {
        const result = await service!.getMonthlyRevenueSummary(TEST_TENANT_ID, 'month');
        if (result.metadata.cacheHit) {
          cacheHits++;
        }
      }

      const hitRate = (cacheHits / totalQueries) * 100;

      console.log(`\n  📊 Cache Hit Rate: ${hitRate.toFixed(1)}% (${cacheHits}/${totalQueries})`);

      // After first query, all subsequent should be cache hits
      // Expected hit rate: 95% (19/20 hits)
      expect(hitRate).toBeGreaterThan(90);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 6: Health Check
  // ───────────────────────────────────────────────────────────────────────────

  describe('Test 6: Health Check', () => {
    it('should return true when cache is operational', async () => {
      if (skipIntegrationTests) return;

      const isHealthy = await service!.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should verify cache can write and read', async () => {
      if (skipIntegrationTests) return;

      const cache = getCache();

      // Write test data
      await cache.set('test:healthcheck', { test: true }, { ttl: 10 });

      // Read test data
      const data = await cache.get('test:healthcheck');

      // Clean up
      await cache.delete('test:healthcheck');

      expect(data).toEqual({ test: true });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 7: Error Handling
  // ───────────────────────────────────────────────────────────────────────────

  describe('Test 7: Error Handling', () => {
    it('should handle invalid tenant ID gracefully', async () => {
      if (skipIntegrationTests) return;

      const invalidTenantId = 'invalid-uuid';

      // Should throw error or return empty result (depending on implementation)
      await expect(
        service!.getMonthlyRevenueSummary(invalidTenantId, 'month')
      ).rejects.toThrow();
    });

    it('should handle invalid date range gracefully', async () => {
      if (skipIntegrationTests) return;

      const invalidDateRange = {
        startDate: '2026-13-01', // Invalid month
        endDate: '2026-12-31',
      };

      // Should throw error or handle gracefully
      await expect(
        service!.getMonthlyRevenueSummary(TEST_TENANT_ID, invalidDateRange as any)
      ).rejects.toThrow();
    });
  });
});
