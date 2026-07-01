/**
 * Unit Tests: OperationalIntelligenceService
 * 
 * Tests service layer with cache-first pattern:
 * - Cache hit/miss scenarios
 * - Cache TTL behavior
 * - healthCheck method
 * - clearCache method
 * - Error handling and propagation
 * 
 * Cache Strategy:
 * - Check cache first (cache hit → return immediately)
 * - On cache miss → query database → write cache → return
 * - TTL: 10 minutes (OPERATIONAL), 5 minutes (inventory - more critical)
 * - Tags: ['operational', 'tenant:{tenantId}'] for bulk invalidation
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { OperationalIntelligenceService } from '../service';
import type { KtvPerformance, KtvLeaderboardEntry } from '../queries';

// ─── Mock Dependencies ──────────────────────────────────────────────────────

// Mock cache
const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  deleteByTag: jest.fn(),
  deleteByPattern: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue(true),
};

// Mock query functions
jest.mock('../queries', () => ({
  getKtvPerformance: jest.fn(),
  getKtvLeaderboard: jest.fn(),
  getInventoryStatus: jest.fn(),
  getInventoryForecast: jest.fn(),
  getSessionAnalytics: jest.fn(),
  getCapacityUtilization: jest.fn(),
}));

// Mock cache factory
jest.mock('../../cache', () => ({
  getCache: jest.fn(() => mockCache),
}));


// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockKtvPerformanceData: KtvPerformance[] = [
  {
    ktvId: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    ktvName: 'Nguyễn Thị Hoa',
    ktvEmail: 'hoa.nguyen@example.com',
    ktvPhone: '0901234567',
    month: '2026-06-01',
    totalSessionsCompleted: 45,
    totalSessionsCancelled: 3,
    totalSessionsNoShow: 2,
    totalSessionsAll: 50,
    completionRatePct: 90.0,
    avgRating: 4.5,
    highRatingsCount: 40,
    lowRatingsCount: 5,
    totalRatingsCount: 45,
    totalRevenue: 45000000,
    avgRevenuePerSession: 1000000,
    totalServiceCommission: 4500000,
    totalSessionBonus: 2250000,
    daysPresent: 22,
    daysAbsent: 2,
    daysLate: 1,
    totalAttendanceDays: 26,
    attendanceRatePct: 84.6,
    lastSessionDate: '2026-06-21',
    uniqueCustomersServed: 30,
    computedAt: '2026-06-22T10:00:00Z',
  },
];

const mockLeaderboardData: KtvLeaderboardEntry[] = [
  {
    rank: 1,
    ktvId: 'ktv-1',
    ktvName: 'KTV 1',
    metricValue: 50000000,
    totalSessionsCompleted: 50,
    avgRating: 4.8,
    totalRevenue: 50000000,
    attendanceRatePct: 92.3,
  },
  {
    rank: 2,
    ktvId: 'ktv-2',
    ktvName: 'KTV 2',
    metricValue: 40000000,
    totalSessionsCompleted: 40,
    avgRating: 4.5,
    totalRevenue: 40000000,
    attendanceRatePct: 88.5,
  },
];


// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('OperationalIntelligenceService', () => {
  let service: OperationalIntelligenceService;
  let queryMocks: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset cache mock
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockCache.delete.mockResolvedValue(1);
    mockCache.deleteByTag.mockResolvedValue(5);
    mockCache.deleteByPattern.mockResolvedValue(10);

    // Get query mocks
    queryMocks = require('../queries');
    queryMocks.getKtvPerformance.mockResolvedValue(mockKtvPerformanceData);
    queryMocks.getKtvLeaderboard.mockResolvedValue(mockLeaderboardData);

    // Create service instance
    service = new OperationalIntelligenceService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: Cache Miss Scenario (First Query)
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cache Miss Scenarios', () => {
    it('should query database on cache miss for getKtvPerformance', async () => {
      mockCache.get.mockResolvedValue(null); // Cache miss

      const result = await service.getKtvPerformance(
        '550e8400-e29b-41d4-a716-446655440000',
        'month'
      );

      // Verify cache was checked
      expect(mockCache.get).toHaveBeenCalledTimes(1);

      // Verify database was queried
      expect(queryMocks.getKtvPerformance).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'month'
      );

      // Verify data was written to cache
      expect(mockCache.set).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String), // cache key
        mockKtvPerformanceData,
        expect.objectContaining({
          ttl: expect.any(Number),
          tags: expect.arrayContaining(['operational']),
        })
      );

      // Verify response metadata
      expect(result.metadata.cacheHit).toBe(false);
      expect(result.metadata.dataSourcesUsed).toContain('mv_ktv_performance_summary');
      expect(result.data).toEqual(mockKtvPerformanceData);
    });

    it('should query database on cache miss for getKtvLeaderboard', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await service.getKtvLeaderboard(
        '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
        'month',
        'revenue',
        10
      );

      expect(mockCache.get).toHaveBeenCalled();
      expect(queryMocks.getKtvLeaderboard).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
      expect(result.metadata.cacheHit).toBe(false);
    });
  });


  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: Cache Hit Scenario (Second Query)
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cache Hit Scenarios', () => {
    it('should return cached data on cache hit', async () => {
      // Simulate cache hit
      mockCache.get.mockResolvedValue(mockKtvPerformanceData);

      const result = await service.getKtvPerformance(
        '550e8400-e29b-41d4-a716-446655440000',
        'month'
      );

      // Verify cache was checked
      expect(mockCache.get).toHaveBeenCalledTimes(1);

      // Verify database was NOT queried (cache hit!)
      expect(queryMocks.getKtvPerformance).not.toHaveBeenCalled();

      // Verify cache was NOT written (already exists)
      expect(mockCache.set).not.toHaveBeenCalled();

      // Verify response metadata
      expect(result.metadata.cacheHit).toBe(true);
      expect(result.metadata.dataSourcesUsed).toEqual(['cache']);
      expect(result.data).toEqual(mockKtvPerformanceData);

      // Verify query time is fast (< 50ms for cache hit)
      expect(result.metadata.queryTimeMs).toBeLessThan(50);
    });

    it('should serve leaderboard from cache on second query', async () => {
      mockCache.get.mockResolvedValue(mockLeaderboardData);

      const result = await service.getKtvLeaderboard(
        '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
        'month'
      );

      expect(mockCache.get).toHaveBeenCalled();
      expect(queryMocks.getKtvLeaderboard).not.toHaveBeenCalled();
      expect(result.metadata.cacheHit).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: Cache TTL Behavior
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cache TTL', () => {
    it('should use 10-minute TTL for KTV/session metrics', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.getKtvPerformance('550e8400-e29b-41d4-a716-446655440000', 'month');

      // Verify TTL = 10 minutes (600 seconds)
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({
          ttl: 600, // 10 minutes
        })
      );
    });

    it('should use appropriate cache tags for invalidation', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.getKtvPerformance('ktv-123', 'month');

      // Verify tags include operational and ktv-specific tag
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({
          tags: expect.arrayContaining(['operational', 'ktv:ktv-123']),
        })
      );
    });
  });


  // ───────────────────────────────────────────────────────────────────────────
  // Test 4: healthCheck Method
  // ───────────────────────────────────────────────────────────────────────────

  describe('healthCheck', () => {
    it('should return true when cache is healthy', async () => {
      mockCache.healthCheck.mockResolvedValue(true);

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockCache.healthCheck).toHaveBeenCalledTimes(1);
    });

    it('should return false when cache is unhealthy', async () => {
      mockCache.healthCheck.mockResolvedValue(false);

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should handle cache health check errors gracefully', async () => {
      mockCache.healthCheck.mockRejectedValue(new Error('Cache connection failed'));

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 5: clearCache Method
  // ───────────────────────────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('should clear all operational cache entries', async () => {
      await service.clearCache();

      // Verify deleteByPattern was called with operational prefix
      expect(mockCache.deleteByPattern).toHaveBeenCalledWith('operational:*');
    });

    it('should handle cache clearing errors gracefully', async () => {
      mockCache.deleteByPattern.mockRejectedValue(new Error('Cache clear failed'));

      // Should not throw
      await expect(service.clearCache()).resolves.not.toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 6: Error Handling
  // ───────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should propagate query errors', async () => {
      mockCache.get.mockResolvedValue(null);
      queryMocks.getKtvPerformance.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        service.getKtvPerformance('550e8400-e29b-41d4-a716-446655440000', 'month')
      ).rejects.toThrow();
    });

    it('should handle cache read errors by querying database', async () => {
      // Cache read fails
      mockCache.get.mockRejectedValue(new Error('Cache read failed'));
      // But database query succeeds
      queryMocks.getKtvPerformance.mockResolvedValue(mockKtvPerformanceData);

      const result = await service.getKtvPerformance(
        '550e8400-e29b-41d4-a716-446655440000',
        'month'
      );

      // Should still return data from database
      expect(result.data).toEqual(mockKtvPerformanceData);
      expect(result.metadata.cacheHit).toBe(false);
    });

    it('should handle cache write errors gracefully', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockRejectedValue(new Error('Cache write failed'));
      queryMocks.getKtvPerformance.mockResolvedValue(mockKtvPerformanceData);

      // Should still return data (cache write failure is not critical)
      const result = await service.getKtvPerformance(
        '550e8400-e29b-41d4-a716-446655440000',
        'month'
      );

      expect(result.data).toEqual(mockKtvPerformanceData);
    });
  });
});

