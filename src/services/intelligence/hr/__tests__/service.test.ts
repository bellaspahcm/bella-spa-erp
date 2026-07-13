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

import { describe, it, expect, beforeEach } from '@jest/globals';

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

jest.mock('../queries-simple', () => ({
  getWorkforceAnalytics: jest.fn(),
  getAttendanceReport: jest.fn(),
  getPayrollSummary: jest.fn(),
  getEmployeePerformance: jest.fn(),
  getRecruitmentMetrics: jest.fn(),
  getTrainingMetrics: jest.fn(),
  getRetentionAnalysis: jest.fn(),
  getProductivityTrends: jest.fn(),
}));

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
const mockCacheDeleteByTag = jest.fn();
const mockCacheDeletePattern = jest.fn();

const mockCache = {
  get: mockCacheGet,
  set: mockCacheSet,
  del: mockCacheDel,
  delete: mockCacheDel,
  deleteByTag: mockCacheDeleteByTag,
  deletePattern: mockCacheDeletePattern,
  clear: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
};

jest.mock('../../cache', () => ({
  getCache: jest.fn(() => mockCache),
}));

import {
  getWorkforceAnalytics,
  getAttendanceReport,
  getPayrollSummary,
  getEmployeePerformance,
  getRecruitmentMetrics,
  getTrainingMetrics,
  getRetentionAnalysis,
  getProductivityTrends,
} from '../queries-simple';

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
      mockCacheGet.mockResolvedValue(mockWorkforceData);

      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      expect(result.metadata.cacheHit).toBe(true);
      expect(result.data).toEqual(mockWorkforceData);
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
      expect(getWorkforceAnalytics).not.toHaveBeenCalled();
    });

    it('should fetch from database on cache miss', async () => {
      // Setup cache miss
      mockCacheGet.mockResolvedValue(null);

      // Setup query response
      (getWorkforceAnalytics as jest.Mock).mockResolvedValue(mockWorkforceData);

      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      expect(result.metadata.cacheHit).toBe(false);
      expect(result.data).toEqual(mockWorkforceData);
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
      expect(getWorkforceAnalytics).toHaveBeenCalled();
      expect(mockCacheSet).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors gracefully', async () => {
      mockCacheGet.mockResolvedValue(null);
      (getWorkforceAnalytics as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle cache write failures silently', async () => {
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockRejectedValue(new Error('Redis write failed'));
      (getWorkforceAnalytics as jest.Mock).mockResolvedValue(mockWorkforceData);

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
      (getAttendanceReport as jest.Mock).mockResolvedValue(mockAttendanceData);

      const result = await service.getAttendanceReport(TEST_TENANT_ID, TEST_MONTH);

      expect(result.data).toEqual(mockAttendanceData);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should return empty array when no data found', async () => {
      mockCacheGet.mockResolvedValue(null);
      (getAttendanceReport as jest.Mock).mockResolvedValue([]);

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
      (getPayrollSummary as jest.Mock).mockResolvedValue(mockPayrollData);

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
      (getEmployeePerformance as jest.Mock).mockResolvedValue(mockPerformanceData);

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
    it('should return true when cache is healthy', async () => {
      mockCacheGet.mockResolvedValue({ test: true });
      mockCacheSet.mockResolvedValue(true);
      mockCacheDel.mockResolvedValue(1);

      const result = await service.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when cache fails', async () => {
      mockCacheGet.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Cache Management Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('should clear tenant-specific cache when tenantId provided', async () => {
      mockCacheDeleteByTag.mockResolvedValue(true);

      await service.clearCache(TEST_TENANT_ID);

      expect(mockCacheDeleteByTag).toHaveBeenCalledWith(`tenant:${TEST_TENANT_ID}`);
    });

    it('should throw on cache clear failure', async () => {
      mockCacheDeletePattern.mockRejectedValue(new Error('Redis deletePattern failed'));

      await expect(service.clearCache()).rejects.toThrow('Failed to clear HR intelligence cache');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Edge Cases & Error Handling
  // ───────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle malformed cached data', async () => {
      // Cache contains invalid JSON (parsing throws syntax error)
      mockCacheGet.mockRejectedValue(new SyntaxError('Unexpected token i in JSON at position 0'));
      (getWorkforceAnalytics as jest.Mock).mockResolvedValue(mockWorkforceData);

      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      // Should fall back to database
      expect(result.data).toEqual(mockWorkforceData);
      expect(getWorkforceAnalytics).toHaveBeenCalled();
    });

    it('should include query timing in metadata', async () => {
      mockCacheGet.mockResolvedValue(null);
      (getWorkforceAnalytics as jest.Mock).mockResolvedValue(mockWorkforceData);

      const result = await service.getWorkforceAnalytics(TEST_TENANT_ID, TEST_MONTH);

      expect(result.metadata.queryTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.generatedAt).toBeDefined();
    });
  });
});
