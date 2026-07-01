/**
 * Integration Tests: Operational Intelligence with Real Supabase
 * 
 * Tests operational intelligence queries with real database:
 * - getKtvPerformance
 * - getKtvLeaderboard
 * - getInventoryStatus
 * - getSessionAnalytics
 * 
 * Prerequisites:
 * - Test Supabase instance with seeded data
 * - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.test
 * - Test tenant with materialized views populated
 * 
 * Note: Skip if Supabase credentials not available.
 */

import { describe, it, expect } from '@jest/globals';
import {
  getKtvPerformance,
  getKtvLeaderboard,
  getInventoryStatus,
  getSessionAnalytics,
  getCapacityUtilization,
} from '../queries';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const skipTests = !supabaseUrl || !supabaseKey;

const TEST_TENANT_ID = process.env.TEST_TENANT_ID || '00000000-0000-0000-0000-000000000000';
const TEST_KTV_ID = process.env.TEST_KTV_ID || '00000000-0000-0000-0000-000000000001';

describe('Operational Intelligence - Integration Tests', () => {
  if (skipTests) {
    it.skip('skipping - Supabase credentials not available', () => {});
    return;
  }

  describe('getKtvPerformance', () => {
    it('should fetch KTV performance data', async () => {
      const result = await getKtvPerformance(TEST_KTV_ID, 'month');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getKtvLeaderboard', () => {
    it('should fetch leaderboard with rankings', async () => {
      const result = await getKtvLeaderboard(TEST_TENANT_ID, 'month', 'revenue', 10);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getInventoryStatus', () => {
    it('should fetch inventory status', async () => {
      const result = await getInventoryStatus(TEST_TENANT_ID);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSessionAnalytics', () => {
    it('should fetch session analytics', async () => {
      const result = await getSessionAnalytics(TEST_TENANT_ID, 'week');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getCapacityUtilization', () => {
    it('should calculate capacity utilization', async () => {
      const result = await getCapacityUtilization(TEST_TENANT_ID, 'day');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
