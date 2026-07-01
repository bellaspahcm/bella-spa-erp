/**
 * Integration Tests for HR Intelligence
 * 
 * Tests the complete HR Intelligence pipeline with real Supabase data:
 * - Materialized views return correct schema
 * - Query functions transform data correctly
 * - Service layer handles caching properly
 * - Multi-tenant isolation works
 * 
 * Note: These tests require a test database with sample data.
 * Run with: npm test -- src/services/intelligence/hr/__tests__/integration.test.ts
 * 
 * Prerequisites:
 * - Test database with materialized views created
 * - Sample tenant data seeded
 * - Environment variables configured (SUPABASE_URL, SUPABASE_SERVICE_KEY)
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createServerClient } from '@/lib/supabase-server';
import { HRIntelligenceService } from '../service';
import { MemoryCacheService } from '../../cache/memory-cache';
import type { Database } from '@/types/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Test Configuration
// ─────────────────────────────────────────────────────────────────────────────

// Skip integration tests if not in integration test environment
const SKIP_INTEGRATION_TESTS = process.env.SKIP_INTEGRATION_TESTS === 'true';

// Test tenant ID (should exist in test database)
const TEST_TENANT_ID = process.env.TEST_TENANT_ID || 'test-tenant-id';
const TEST_MONTH = '2026-06';

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe.skip('HR Intelligence Integration Tests', () => {
  let service: HRIntelligenceService;
  let supabase: ReturnType<typeof createServerClient>;

  beforeAll(async () => {
    if (SKIP_INTEGRATION_TESTS) {
      console.log('⚠️  Skipping integration tests (SKIP_INTEGRATION_TESTS=true)');
      return;
    }

    // Create service with memory cache (no Redis dependency for tests)
    const cache = new MemoryCacheService();
    service = new HRIntelligenceService(cache);

    // Create Supabase client
    supabase = createServerClient();

    // Verify test tenant exists
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', TEST_TENANT_ID)
      .single();

    if (error || !tenant) {
      throw new Error(
        `Test tenant ${TEST_TENANT_ID} not found. Please seed test data first.`
      );
    }

    console.log(`✓ Using test tenant: ${tenant.name} (${tenant.id})`);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Materialized View Schema Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Materialized Views Schema', () => {
    it('mv_workforce_analytics should have correct columns', async () => {
      const { data, error } = await supabase
        .from('mv_workforce_analytics' as any)
        .select('*')
        .eq('tenant_id', TEST_TENANT_ID)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (acceptable for empty tables)
        throw error;
      }

      if (data) {
        expect(data).toHaveProperty('tenant_id');
        expect(data).toHaveProperty('month');
        expect(data).toHaveProperty('total_headcount');
        expect(data).toHaveProperty('ktv_count');
        expect(data).toHaveProperty('admin_count');
        expect(data).toHaveProperty('new_hires');
        expect(data).toHaveProperty('terminations');
        expect(data).toHaveProperty('turnover_rate');
        expect(data).toHaveProperty('average_tenure_months');
      }
    });

    it('mv_attendance_summary should have correct columns', async () => {
      const { data, error } = await supabase
        .from('mv_attendance_summary' as any)
        .select('*')
        .eq('tenant_id', TEST_TENANT_ID)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        expect(data).toHaveProperty('tenant_id');
        expect(data).toHaveProperty('month');
        expect(data).toHaveProperty('ktv_id');
        expect(data).toHaveProperty('ktv_name');
        expect(data).toHaveProperty('days_present');
        expect(data).toHaveProperty('days_absent');
        expect(data).toHaveProperty('days_late');
        expect(data).toHaveProperty('attendance_rate_pct');
        expect(data).toHaveProperty('on_time_rate_pct');
      }
    });

    it('mv_payroll_summary should have correct columns', async () => {
      const { data, error } = await supabase
        .from('mv_payroll_summary' as any)
        .select('*')
        .eq('tenant_id', TEST_TENANT_ID)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        expect(data).toHaveProperty('tenant_id');
        expect(data).toHaveProperty('month');
        expect(data).toHaveProperty('ktv_id');
        expect(data).toHaveProperty('ktv_name');
        expect(data).toHaveProperty('base_salary');
        expect(data).toHaveProperty('session_bonus');
        expect(data).toHaveProperty('kpi_bonus');
        expect(data).toHaveProperty('total_salary');
      }
    });

    it('mv_employee_performance should have correct columns', async () => {
      const { data, error } = await supabase
        .from('mv_employee_performance' as any)
        .select('*')
        .eq('tenant_id', TEST_TENANT_ID)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        expect(data).toHaveProperty('tenant_id');
        expect(data).toHaveProperty('month');
        expect(data).toHaveProperty('ktv_id');
        expect(data).toHaveProperty('ktv_name');
        expect(data).toHaveProperty('total_sessions_completed');
        expect(data).toHaveProperty('avg_star_rating');
        expect(data).toHaveProperty('kpi_score');
        expect(data).toHaveProperty('overall_performance_score');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Service Method Integration Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('HRIntelligenceService Methods', () => {
    it('getWorkforceAnalytics should return valid data', async () => {
      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('generatedAt');
      expect(result.metadata).toHaveProperty('cacheHit');
      expect(result.metadata).toHaveProperty('queryTimeMs');

      if (result.data.length > 0) {
        const workforce = result.data[0];
        expect(workforce.tenantId).toBe(TEST_TENANT_ID);
        expect(typeof workforce.totalHeadcount).toBe('number');
        expect(typeof workforce.turnoverRate).toBe('number');
        expect(workforce.totalHeadcount).toBeGreaterThanOrEqual(0);
      }
    });

    it('getAttendanceReport should return valid data', async () => {
      const result = await service.getAttendanceReport(TEST_TENANT_ID, TEST_MONTH);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');

      if (result.data.length > 0) {
        const attendance = result.data[0];
        expect(attendance.tenantId).toBe(TEST_TENANT_ID);
        expect(typeof attendance.attendanceRatePct).toBe('number');
        expect(typeof attendance.onTimeRatePct).toBe('number');
        expect(attendance.attendanceRatePct).toBeGreaterThanOrEqual(0);
        expect(attendance.attendanceRatePct).toBeLessThanOrEqual(100);
      }
    });

    it('getPayrollSummary should return valid data', async () => {
      const result = await service.getPayrollSummary(TEST_TENANT_ID, TEST_MONTH);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');

      if (result.data.length > 0) {
        const payroll = result.data[0];
        expect(payroll.tenantId).toBe(TEST_TENANT_ID);
        expect(typeof payroll.baseSalary).toBe('number');
        expect(typeof payroll.totalSalary).toBe('number');
        expect(payroll.baseSalary).toBeGreaterThanOrEqual(0);
        expect(payroll.totalSalary).toBeGreaterThanOrEqual(payroll.baseSalary);
      }
    });

    it('getEmployeePerformance should return valid data', async () => {
      const result = await service.getEmployeePerformance(TEST_TENANT_ID, TEST_MONTH);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');

      if (result.data.length > 0) {
        const performance = result.data[0];
        expect(performance.tenantId).toBe(TEST_TENANT_ID);
        expect(typeof performance.overallPerformanceScore).toBe('number');
        expect(typeof performance.kpiScore).toBe('number');
        expect(typeof performance.avgStarRating).toBe('number');
        expect(performance.overallPerformanceScore).toBeGreaterThanOrEqual(0);
        expect(performance.overallPerformanceScore).toBeLessThanOrEqual(100);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Caching Behavior Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cache Behavior', () => {
    it('should cache results on first call', async () => {
      // Clear cache first
      await service.clearCache(TEST_TENANT_ID);

      // First call - should hit database
      const result1 = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);
      expect(result1.metadata.cacheHit).toBe(false);

      // Second call - should hit cache
      const result2 = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);
      expect(result2.metadata.cacheHit).toBe(true);

      // Results should be identical
      expect(result2.data).toEqual(result1.data);
    });

    it('should clear cache when requested', async () => {
      // Populate cache
      await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      // Clear cache
      await service.clearCache(TEST_TENANT_ID);

      // Next call should hit database again
      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);
      expect(result.metadata.cacheHit).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Multi-Tenant Isolation Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Multi-Tenant Isolation', () => {
    it('should only return data for requested tenant', async () => {
      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      result.data.forEach((item) => {
        expect(item.tenantId).toBe(TEST_TENANT_ID);
      });
    });

    it('should not leak data between tenants in cache', async () => {
      const tenant1Id = TEST_TENANT_ID;
      const tenant2Id = 'different-tenant-id';

      // Fetch for tenant 1
      const result1 = await service.getWorkforceAnalytics(tenant1Id, TEST_MONTH);

      // Fetch for tenant 2 (may fail if tenant doesn't exist, that's OK)
      try {
        const result2 = await service.getWorkforceAnalytics(tenant2Id, TEST_MONTH);
        
        // If both succeed, verify data is different
        if (result1.data.length > 0 && result2.data.length > 0) {
          expect(result1.data[0].tenantId).not.toBe(result2.data[0].tenantId);
        }
      } catch (error) {
        // Tenant 2 may not exist, that's acceptable
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Data Quality Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Data Quality', () => {
    it('workforce analytics should have consistent headcount', async () => {
      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      if (result.data.length > 0) {
        const workforce = result.data[0];
        
        // Total headcount should equal sum of role counts
        const calculatedTotal = workforce.ktvCount + workforce.adminCount;
        expect(workforce.totalHeadcount).toBe(calculatedTotal);

        // Net change should equal new hires minus terminations
        const calculatedNetChange = workforce.newHires - workforce.terminations;
        expect(workforce.netChange).toBe(calculatedNetChange);
      }
    });

    it('attendance rates should be within valid range', async () => {
      const result = await service.getAttendanceReport(TEST_TENANT_ID, TEST_MONTH);

      result.data.forEach((attendance) => {
        expect(attendance.attendanceRatePct).toBeGreaterThanOrEqual(0);
        expect(attendance.attendanceRatePct).toBeLessThanOrEqual(100);
        expect(attendance.onTimeRatePct).toBeGreaterThanOrEqual(0);
        expect(attendance.onTimeRatePct).toBeLessThanOrEqual(100);
      });
    });

    it('payroll totals should be sum of components', async () => {
      const result = await service.getPayrollSummary(TEST_TENANT_ID, TEST_MONTH);

      result.data.forEach((payroll) => {
        const calculatedTotal =
          payroll.baseSalary +
          payroll.sessionBonus +
          payroll.kpiBonus +
          payroll.ratingBonus -
          payroll.violationsDeduction;

        // Allow small rounding differences
        const difference = Math.abs(payroll.totalSalary - calculatedTotal);
        expect(difference).toBeLessThan(1);
      });
    });

    it('performance scores should be within valid range', async () => {
      const result = await service.getEmployeePerformance(TEST_TENANT_ID, TEST_MONTH);

      result.data.forEach((performance) => {
        expect(performance.overallPerformanceScore).toBeGreaterThanOrEqual(0);
        expect(performance.overallPerformanceScore).toBeLessThanOrEqual(100);
        expect(performance.kpiScore).toBeGreaterThanOrEqual(0);
        expect(performance.kpiScore).toBeLessThanOrEqual(100);
        expect(performance.avgStarRating).toBeGreaterThanOrEqual(0);
        expect(performance.avgStarRating).toBeLessThanOrEqual(5);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Performance Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Performance', () => {
    it('should complete workforce analytics query within acceptable time', async () => {
      const startTime = Date.now();
      await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);
      const duration = Date.now() - startTime;

      // Should complete within 2 seconds (generous limit for CI/CD)
      expect(duration).toBeLessThan(2000);
    });

    it('should have faster cache hits than database queries', async () => {
      // Clear cache
      await service.clearCache(TEST_TENANT_ID);

      // Database query (cache miss)
      const start1 = Date.now();
      const result1 = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);
      const dbDuration = Date.now() - start1;

      expect(result1.metadata.cacheHit).toBe(false);

      // Cache hit
      const start2 = Date.now();
      const result2 = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);
      const cacheDuration = Date.now() - start2;

      expect(result2.metadata.cacheHit).toBe(true);

      // Cache should be significantly faster (at least 2x)
      expect(cacheDuration).toBeLessThan(dbDuration / 2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle invalid tenant ID gracefully', async () => {
      const invalidTenantId = 'invalid-uuid-format';

      await expect(
        service.getWorkforceAnalytics(invalidTenantId, TEST_MONTH)
      ).rejects.toThrow();
    });

    it('should handle non-existent tenant gracefully', async () => {
      const nonExistentTenant = '00000000-0000-0000-0000-000000000000';

      const result = await service.getWorkforceAnalytics(nonExistentTenant, TEST_MONTH);

      // Should return empty array, not throw error
      expect(result.data).toEqual([]);
    });

    it('should handle invalid date format gracefully', async () => {
      const invalidMonth = 'invalid-date';

      await expect(
        service.getWorkforceAnalytics(TEST_TENANT_ID, invalidMonth as any)
      ).rejects.toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Health Check Test
  // ───────────────────────────────────────────────────────────────────────────

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});
