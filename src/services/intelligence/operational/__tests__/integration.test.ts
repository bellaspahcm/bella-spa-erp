/**
 * Integration Tests: Operational Intelligence with Real Supabase
 * 
 * Tests operational intelligence queries with real database:
 * - Data structure validation
 * - Materialized view queries
 * - Date range filtering
 * - Error handling
 * 
 * Prerequisites:
 * - Supabase instance with seeded test data
 * - Environment variables:
 *   * NEXT_PUBLIC_SUPABASE_URL
 *   * NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   * TEST_TENANT_ID (optional)
 *   * TEST_KTV_ID (optional)
 * 
 * Setup:
 * 1. Copy .env.local to .env.test
 * 2. Set TEST_TENANT_ID to valid tenant UUID
 * 3. Set TEST_KTV_ID to valid KTV user UUID
 * 4. Ensure materialized views are refreshed
 * 
 * Run:
 * npm test -- integration.test.ts
 * 
 * Note: Tests skip gracefully if credentials not available.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import type {
  KtvPerformance,
  KtvLeaderboardEntry,
  InventoryStatus,
  SessionAnalytics,
  CapacityUtilization,
} from '../queries';
import {
  getKtvPerformance,
  getKtvLeaderboard,
  getInventoryStatus,
  getInventoryForecast,
  getSessionAnalytics,
  getCapacityUtilization,
} from '../queries';

// ─────────────────────────────────────────────────────────────────────────────
// Environment Setup
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const skipTests = !supabaseUrl || !supabaseKey;

// Test IDs (override with real IDs from your test database)
const TEST_TENANT_ID = process.env.TEST_TENANT_ID || '00000000-0000-0000-0000-000000000000';
const TEST_KTV_ID = process.env.TEST_KTV_ID || '00000000-0000-0000-0000-000000000001';

// Skip message
const SKIP_REASON = 'Supabase credentials not available. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.';

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function isValidDate(date: any): boolean {
  return date instanceof Date || (typeof date === 'string' && !isNaN(Date.parse(date)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Operational Intelligence - Integration Tests', () => {
  // Skip all tests if credentials not available
  beforeAll(() => {
    if (skipTests) {
      console.warn(`[Integration Tests] ${SKIP_REASON}`);
    } else {
      console.log('[Integration Tests] Running with Supabase:', supabaseUrl);
      console.log('[Integration Tests] Test Tenant:', TEST_TENANT_ID);
      console.log('[Integration Tests] Test KTV:', TEST_KTV_ID);
    }
  });

  if (skipTests) {
    it.skip(SKIP_REASON, () => {});
    return;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: KTV Performance
  // ───────────────────────────────────────────────────────────────────────────

  describe('getKtvPerformance', () => {
    it('should fetch KTV performance data with valid structure', async () => {
      const result = await getKtvPerformance(TEST_KTV_ID, 'month');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // If data exists, validate structure
      if (result.length > 0) {
        const record: KtvPerformance = result[0];
        
        // Validate required fields
        expect(isValidUUID(record.ktvId)).toBe(true);
        expect(isValidUUID(record.tenantId)).toBe(true);
        expect(typeof record.ktvName).toBe('string');
        expect(isValidDate(record.month)).toBe(true);
        
        // Validate numeric fields
        expect(typeof record.totalSessionsCompleted).toBe('number');
        expect(typeof record.completionRatePct).toBe('number');
        expect(record.completionRatePct).toBeGreaterThanOrEqual(0);
        expect(record.completionRatePct).toBeLessThanOrEqual(100);
        
        // Validate optional fields
        if (record.avgRating !== null) {
          expect(typeof record.avgRating).toBe('number');
          expect(record.avgRating).toBeGreaterThanOrEqual(0);
          expect(record.avgRating).toBeLessThanOrEqual(5);
        }
        
        console.log('[Integration] KTV Performance sample:', {
          name: record.ktvName,
          sessions: record.totalSessionsCompleted,
          rating: record.avgRating,
          revenue: record.totalRevenue,
        });
      } else {
        console.warn('[Integration] No KTV performance data found for:', TEST_KTV_ID);
      }
    }, 30000); // 30s timeout

    it('should handle different time periods', async () => {
      const periods: Array<'day' | 'week' | 'month' | 'quarter' | 'year'> = ['week', 'month', 'quarter'];
      
      for (const period of periods) {
        const result = await getKtvPerformance(TEST_KTV_ID, period);
        expect(Array.isArray(result)).toBe(true);
        console.log(`[Integration] ${period} data points:`, result.length);
      }
    }, 30000);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: KTV Leaderboard
  // ───────────────────────────────────────────────────────────────────────────

  describe('getKtvLeaderboard', () => {
    it('should fetch leaderboard with proper rankings', async () => {
      const result = await getKtvLeaderboard(TEST_TENANT_ID, 'month', 'revenue', 10);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        const entry: KtvLeaderboardEntry = result[0];
        
        // Validate structure
        expect(typeof entry.rank).toBe('number');
        expect(isValidUUID(entry.ktvId)).toBe(true);
        expect(typeof entry.ktvName).toBe('string');
        expect(typeof entry.metricValue).toBe('number');
        
        // Validate ranking order (rank 1 should be first)
        expect(result[0].rank).toBe(1);
        if (result.length > 1) {
          expect(result[1].rank).toBe(2);
        }
        
        // Validate metric values are sorted descending
        if (result.length > 1) {
          expect(result[0].metricValue).toBeGreaterThanOrEqual(result[1].metricValue);
        }
        
        console.log('[Integration] Top KTV:', {
          rank: entry.rank,
          name: entry.ktvName,
          revenue: entry.totalRevenue,
          sessions: entry.totalSessionsCompleted,
          rating: entry.avgRating,
        });
      } else {
        console.warn('[Integration] No leaderboard data found for tenant:', TEST_TENANT_ID);
      }
    }, 30000);

    it('should support different ranking metrics', async () => {
      const metrics: Array<'revenue' | 'sessions' | 'rating'> = ['revenue', 'sessions', 'rating'];
      
      for (const metric of metrics) {
        const result = await getKtvLeaderboard(TEST_TENANT_ID, 'month', metric, 5);
        expect(Array.isArray(result)).toBe(true);
        
        if (result.length > 0) {
          console.log(`[Integration] Top ${metric}:`, result[0].ktvName, '=', result[0].metricValue);
        }
      }
    }, 30000);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: Inventory Status
  // ───────────────────────────────────────────────────────────────────────────

  describe('getInventoryStatus', () => {
    it('should fetch inventory with stock status', async () => {
      const result = await getInventoryStatus(TEST_TENANT_ID);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        const item: InventoryStatus = result[0];
        
        // Validate structure
        expect(isValidUUID(item.productId)).toBe(true);
        expect(typeof item.productName).toBe('string');
        expect(typeof item.currentStock).toBe('number');
        expect(typeof item.stockStatus).toBe('string');
        expect(['out_of_stock', 'low_stock', 'medium_stock', 'high_stock']).toContain(item.stockStatus);
        
        console.log('[Integration] Sample inventory:', {
          product: item.productName,
          stock: item.currentStock,
          status: item.stockStatus,
          avgUsage: item.avgDailyUsage,
        });
      } else {
        console.warn('[Integration] No inventory data found for tenant:', TEST_TENANT_ID);
      }
    }, 30000);

    it('should filter by stock status', async () => {
      const statuses: Array<'out_of_stock' | 'low_stock' | 'medium_stock' | 'high_stock'> = 
        ['out_of_stock', 'low_stock', 'medium_stock', 'high_stock'];
      
      for (const status of statuses) {
        const result = await getInventoryStatus(TEST_TENANT_ID, status);
        expect(Array.isArray(result)).toBe(true);
        
        // All results should have the requested status
        result.forEach((item: InventoryStatus) => {
          expect(item.stockStatus).toBe(status);
        });
        
        console.log(`[Integration] ${status} items:`, result.length);
      }
    }, 30000);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 4: Session Analytics
  // ───────────────────────────────────────────────────────────────────────────

  describe('getSessionAnalytics', () => {
    it('should fetch session analytics by day', async () => {
      const result = await getSessionAnalytics(TEST_TENANT_ID, 'week');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        const analytics: SessionAnalytics = result[0];
        
        // Validate structure
        expect(isValidDate(analytics.date)).toBe(true);
        expect(typeof analytics.totalSessions).toBe('number');
        expect(typeof analytics.completedSessions).toBe('number');
        expect(typeof analytics.completionRatePct).toBe('number');
        expect(analytics.completionRatePct).toBeGreaterThanOrEqual(0);
        expect(analytics.completionRatePct).toBeLessThanOrEqual(100);
        
        console.log('[Integration] Session analytics sample:', {
          date: analytics.date,
          total: analytics.totalSessions,
          completed: analytics.completedSessions,
          rate: analytics.completionRatePct + '%',
          avgRating: analytics.avgRating,
        });
      } else {
        console.warn('[Integration] No session analytics found for tenant:', TEST_TENANT_ID);
      }
    }, 30000);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 5: Capacity Utilization
  // ───────────────────────────────────────────────────────────────────────────

  describe('getCapacityUtilization', () => {
    it('should calculate capacity utilization rates', async () => {
      const result = await getCapacityUtilization(TEST_TENANT_ID, 'week');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        const capacity: CapacityUtilization = result[0];
        
        // Validate structure
        expect(isValidDate(capacity.date)).toBe(true);
        expect(typeof capacity.totalSlots).toBe('number');
        expect(typeof capacity.bookedSlots).toBe('number');
        expect(typeof capacity.utilizationPct).toBe('number');
        expect(capacity.utilizationPct).toBeGreaterThanOrEqual(0);
        expect(capacity.utilizationPct).toBeLessThanOrEqual(100);
        
        // Logical consistency
        expect(capacity.bookedSlots).toBeLessThanOrEqual(capacity.totalSlots);
        
        console.log('[Integration] Capacity utilization sample:', {
          date: capacity.date,
          booked: capacity.bookedSlots,
          total: capacity.totalSlots,
          utilization: capacity.utilizationPct + '%',
          peakHour: capacity.peakHour,
        });
      } else {
        console.warn('[Integration] No capacity data found for tenant:', TEST_TENANT_ID);
      }
    }, 30000);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 6: Error Handling
  // ───────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle invalid UUID gracefully', async () => {
      await expect(
        getKtvPerformance('invalid-uuid', 'month')
      ).rejects.toThrow();
    });

    it('should handle non-existent tenant', async () => {
      const nonExistentTenant = '00000000-0000-0000-0000-000000000099';
      const result = await getKtvLeaderboard(nonExistentTenant, 'month');
      
      // Should return empty array, not throw
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});
