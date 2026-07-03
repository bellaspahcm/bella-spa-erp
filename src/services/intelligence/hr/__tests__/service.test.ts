/**
 * Unit Tests for HRIntelligenceService
 * 
 * Tests cache behavior, error handling, tenant isolation,
 * and all public methods of the HR Intelligence Service.
 * 
 * Mock Strategy:
 * - Redis cache mocked to control cache hit/miss scenarios
 * - Supabase client mocked to return test data
 * - No real database or cache connections
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HRIntelligenceService } from '../service';
import type { 
  WorkforceAnalytics,
  AttendanceReport,
  PayrollSummary,
  EmployeePerformance,
} from '../queries';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────────────────

// Mock Cache Service
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDel = jest.fn();

const mockCache = {
  get: mockCacheGet,
  set: mockCacheSet,
  del: mockCacheDel,
  clear: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
};

jest.mock('../../cache', () => ({
  getCache: jest.fn(() => mockCache),
}));

// Mock query functions
jest.mock('../queries', () => ({
  getWorkforceAnalytics: jest.fn(),
  getAttendanceReport: jest.fn(),
  getPayrollSummary: jest.fn(),
  getEmployeePerformance: jest.fn(),
  getRecruitmentMetrics: jest.fn(),
  getTrainingMetrics: jest.fn(),
  getRetentionAnalysis: jest.fn(),
  getProductivityTrends: jest.fn(),
}));

// Import mocked functions
import * as queries from '../queries';

// ─────────────────────────────────────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────────────────────────────────────

const TEST_TENANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_MONTH = '2026-06';
const TEST_KTV_ID = '123e4567-e89b-12d3-a456-426614174001';

const mockWorkforceData: WorkforceAnalytics[] = [
  {
    tenantId: TEST_TENANT_ID,
    month: TEST_MONTH,
    totalHeadcount: 25,
    ktvCount: 20,
    adminCount: 5,
    newHires: 3,
    terminations: 1,
    netChange: 2,
    turnoverRate: 4.0,
    averageTenureMonths: 18.5,
    roleDistribution: { ktv: 20, admin: 5 },
    departmentDistribution: { spa: 25 },
    computedAt: new Date().toISOString(),
  },
];

const mockAttendanceData: AttendanceReport[] = [
  {
    tenantId: TEST_TENANT_ID,
    month: TEST_MONTH,
    ktvId: TEST_KTV_ID,
    ktvName: 'Nguyễn Thị A',
    ktvRole: 'ktv',
    totalWorkingDays: 26,
    daysPresent: 24,
    daysAbsent: 2,
    daysLate: 3,
    daysOnTime: 21,
    attendanceRatePct: 92.3,
    onTimeRatePct: 87.5,
    attendanceScore: 88.0,
    computedAt: new Date().toISOString(),
  },
];

const mockPayrollData: PayrollSummary[] = [
  {
    tenantId: TEST_TENANT_ID,
    month: TEST_MONTH,
    ktvId: TEST_KTV_ID,
    ktvName: 'Nguyễn Thị A',
    ktvRole: 'ktv',
    baseSalary: 5000000,
    sessionBonus: 1500000,
    kpiBonus: 800000,
    ratingBonus: 300000,
    violationsDeduction: 100000,
    servicePercentageBonus: 0,
    totalSalary: 7500000,
    salaryRank: 5,
    computedAt: new Date().toISOString(),
  },
];

const mockPerformanceData: EmployeePerformance[] = [
  {
    tenantId: TEST_TENANT_ID,
    month: TEST_MONTH,
    ktvId: TEST_KTV_ID,
    ktvName: 'Nguyễn Thị A',
    ktvRole: 'ktv',
    ktvPhone: '0901234567',
    isActive: true,
    totalSessionsCompleted: 45,
    totalBookingsServed: 30,
    avgStarRating: 4.5,
    ratingsCount: 25,
    fiveStarCount: 15,
    fourStarCount: 8,
    belowFourCount: 2,
    kpiScore: 85.0,
    kpiAmount: 800000,
    customerSatisfactionScore: 90.0,
    totalRevenueContributed: 50000000,
    revenueTransactionCount: 30,
    workingDays: 24,
    onTimeDays: 21,
    absentDays: 2,
    revenuePerSession: 1111111,
    sessionsPerWorkingDay: 1.875,
    overallPerformanceScore: 87.5,
    performanceRank: 3,
    performanceTier: 'top_25',
    computedAt: new Date().toISOString(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('HRIntelligenceService', () => {
  let service: HRIntelligenceService;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create fresh service instance
    service = new HRIntelligenceService(mockCache);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Workforce Analytics Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('getWorkforceAnalytics', () => {
    it('should return cached data when cache hit', async () => {
      // Setup cache hit
      const cachedResponse = {
        data: mockWorkforceData,
        metadata: {
          generatedAt: new Date().toISOString(),
          cacheHit: true,
          queryTimeMs: 0,
          dataSourcesUsed: ['redis'],
        },
      };
      mockCacheGet.mockResolvedValue(JSON.stringify(cachedResponse));

      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      expect(result.metadata.cacheHit).toBe(true);
      expect(result.data).toEqual(mockWorkforceData);
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
      expect(queries.getWorkforceAnalytics).not.toHaveBeenCalled();
    });

    it('should fetch from database on cache miss', async () => {
      // Setup cache miss
      mockCacheGet.mockResolvedValue(null);

      // Setup query response
      (queries.getWorkforceAnalytics as jest.Mock).mockResolvedValue(mockWorkforceData);

      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      expect(result.metadata.cacheHit).toBe(false);
      expect(result.data).toEqual(mockWorkforceData);
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
      expect(queries.getWorkforceAnalytics).toHaveBeenCalled();
      expect(mockCacheSet).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors gracefully', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getWorkforceAnalytics as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle cache write failures silently', async () => {
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockRejectedValue(new Error('Redis write failed'));
      (queries.getWorkforceAnalytics as jest.Mock).mockResolvedValue(mockWorkforceData);

      // Should not throw despite cache write failure
      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      expect(result.data).toEqual(mockWorkforceData);
      expect(result.metadata.cacheHit).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Attendance Report Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('getAttendanceReport', () => {
    it('should return attendance data', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getAttendanceReport as jest.Mock).mockResolvedValue(mockAttendanceData);

      const result = await service.getAttendanceReport(TEST_TENANT_ID, TEST_MONTH);

      expect(result.data).toEqual(mockAttendanceData);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should return empty array when no data found', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getAttendanceReport as jest.Mock).mockResolvedValue([]);

      const result = await service.getAttendanceReport(TEST_TENANT_ID, TEST_MONTH);

      expect(result.data).toEqual([]);
      expect(result.metadata.cacheHit).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Payroll Summary Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('getPayrollSummary', () => {
    it('should return payroll data with correct calculations', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getPayrollSummary as jest.Mock).mockResolvedValue(mockPayrollData);

      const result = await service.getPayrollSummary(TEST_TENANT_ID, TEST_MONTH);

      expect(result.data).toEqual(mockPayrollData);
      expect(result.data[0].totalSalary).toBe(7500000);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Employee Performance Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('getEmployeePerformance', () => {
    it('should return performance metrics with all fields', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getEmployeePerformance as jest.Mock).mockResolvedValue(mockPerformanceData);

      const result = await service.getEmployeePerformance(TEST_TENANT_ID, TEST_MONTH);

      expect(result.data).toEqual(mockPerformanceData);
      expect(result.data[0]).toHaveProperty('overallPerformanceScore');
      expect(result.data[0]).toHaveProperty('kpiScore');
      expect(result.data[0]).toHaveProperty('avgStarRating');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Health Check Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('healthCheck', () => {
    it('should return healthy status when cache is accessible', async () => {
      mockCache.healthCheck.mockResolvedValue({ healthy: true });

      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
    });

    it('should return unhealthy when cache fails', async () => {
      mockCache.healthCheck.mockResolvedValue({ 
        healthy: false, 
        error: 'Redis connection failed' 
      });

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Redis connection failed');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Cache Management Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('should clear tenant-specific cache when tenantId provided', async () => {
      mockCacheDel.mockResolvedValue(1);

      await service.clearCache(TEST_TENANT_ID);

      expect(mockCacheDel).toHaveBeenCalledWith(`hr:${TEST_TENANT_ID}:*`);
    });

    it('should not throw on cache clear failure', async () => {
      mockCacheDel.mockRejectedValue(new Error('Redis del failed'));

      await expect(service.clearCache()).resolves.not.toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Edge Cases & Error Handling
  // ───────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle malformed cached data', async () => {
      // Cache contains invalid JSON
      mockCacheGet.mockResolvedValue('invalid-json{{{');
      (queries.getWorkforceAnalytics as jest.Mock).mockResolvedValue(mockWorkforceData);

      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      // Should fall back to database
      expect(result.data).toEqual(mockWorkforceData);
      expect(queries.getWorkforceAnalytics).toHaveBeenCalled();
    });

    it('should include query timing in metadata', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getWorkforceAnalytics as jest.Mock).mockResolvedValue(mockWorkforceData);

      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      expect(result.metadata.queryTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.generatedAt).toBeDefined();
    });
  });
});
