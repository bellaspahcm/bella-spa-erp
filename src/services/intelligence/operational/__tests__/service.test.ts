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
import type { CacheService } from '../../shared/types';

// ─── Mock Dependencies ──────────────────────────────────────────────────────

// Mock queries-simple module using alias path to ensure Jest resolver matches correctly
jest.mock('@/services/intelligence/operational/queries-simple', () => ({
  __esModule: true,
  getKTVPerformance: jest.fn(),
  getKTVLeaderboard: jest.fn(),
  getInventoryStatus: jest.fn(),
  getInventoryForecast: jest.fn(),
  getSessionAnalytics: jest.fn(),
  getCapacityUtilization: jest.fn(),
}));

// Load service dynamically after registering mock
const { OperationalIntelligenceService } = require('../service');

// Import mocked functions via requireMock
const queriesSimple = jest.requireMock('@/services/intelligence/operational/queries-simple') as any;

// Create mock cache instance (will be passed to service constructor)
const createMockCache = (): jest.Mocked<CacheService> => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  deletePattern: jest.fn(),
  deleteByTag: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue(true),
  clear: jest.fn(),
  getStats: jest.fn().mockReturnValue({
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalKeys: 0,
  }),
});

// ─── Mock Data ──────────────────────────────────────────────────────────────

const TEST_TENANT_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const TEST_KTV_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockKtvPerformanceData = [
  {
    ktvId: TEST_KTV_ID,
    tenantId: TEST_TENANT_ID,
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

const mockLeaderboardData = [
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
  let service: any;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create fresh mock cache for each test
    mockCache = createMockCache();

    // Reset cache mock defaults
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockCache.delete.mockResolvedValue(undefined);
    mockCache.deletePattern.mockResolvedValue(undefined);
    mockCache.deleteByTag.mockResolvedValue(undefined);
    mockCache.getStats.mockResolvedValue({
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
    } as any);

    // Create service instance with mock cache
    service = new OperationalIntelligenceService(mockCache);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: Cache Hit Scenario
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cache Hit Scenarios', () => {
    it('should return cached data on cache hit for getKtvPerformance', async () => {
      mockCache.get.mockResolvedValue(mockKtvPerformanceData);

      const result = await service.getKtvPerformance(
        TEST_TENANT_ID,
        TEST_KTV_ID,
        'month'
      );

      // Verify cache was checked
      expect(mockCache.get).toHaveBeenCalledTimes(1);
      expect(mockCache.get).toHaveBeenCalledWith(
        expect.stringContaining(`operational::${TEST_KTV_ID}:ktvPerformance`)
      );

      // Verify cache was NOT written (already exists)
      expect(mockCache.set).not.toHaveBeenCalled();

      // Verify response metadata
      expect(result.metadata.cacheHit).toBe(true);
      expect(result.metadata.dataSourcesUsed).toEqual(['cache']);
      expect(result.data).toEqual(mockKtvPerformanceData);
      expect(result.metadata.queryTimeMs).toBeLessThan(50);
    });

    it('should serve leaderboard from cache on second query', async () => {
      mockCache.get.mockResolvedValue(mockLeaderboardData);

      const result = await service.getKtvLeaderboard(
        TEST_TENANT_ID,
        'month'
      );

      expect(mockCache.get).toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(result.metadata.cacheHit).toBe(true);
      expect(result.data).toEqual(mockLeaderboardData);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: Cache Key Construction
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cache Key Construction', () => {
    it('should build correct cache key for KTV performance queries', async () => {
      mockCache.get.mockResolvedValue(mockKtvPerformanceData);

      await service.getKtvPerformance(TEST_TENANT_ID, 'test-ktv-id', 'month');

      expect(mockCache.get).toHaveBeenCalledWith(
        expect.stringMatching(/operational::test-ktv-id:ktvPerformance:.*/)
      );
    });

    it('should build correct cache key for leaderboard queries', async () => {
      mockCache.get.mockResolvedValue(mockLeaderboardData);

      await service.getKtvLeaderboard(TEST_TENANT_ID, 'week', 'revenue', 5);

      expect(mockCache.get).toHaveBeenCalledWith(
        expect.stringMatching(/operational::6ba7b810-9dad-41d1-80b4-00c04fd430c8:ktvLeaderboard:.*/)
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: healthCheck Method
  // ───────────────────────────────────────────────────────────────────────────

  describe('healthCheck', () => {
    it('should return true when cache is healthy', async () => {
      mockCache.set.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue({ test: true });
      mockCache.delete.mockResolvedValue(undefined);

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockCache.set).toHaveBeenCalledWith(
        'operational::health:test',
        { test: true },
        { ttl: 10 }
      );
      expect(mockCache.get).toHaveBeenCalledWith('operational::health:test');
      expect(mockCache.delete).toHaveBeenCalledWith('operational::health:test');
    });

    it('should return false when cache is unhealthy', async () => {
      mockCache.set.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue(null);

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should handle cache health check errors gracefully', async () => {
      mockCache.set.mockRejectedValue(new Error('Cache connection failed'));

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 4: clearCache Method
  // ───────────────────────────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('should clear all operational cache entries', async () => {
      mockCache.deletePattern.mockResolvedValue(undefined);

      await service.clearCache();

      expect(mockCache.deletePattern).toHaveBeenCalledWith('operational::*');
    });

    it('should propagate cache clearing errors', async () => {
      mockCache.deletePattern.mockRejectedValue(new Error('Cache clear failed'));

      await expect(service.clearCache()).rejects.toThrow('Failed to clear operational intelligence cache');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 5: Cache Error Resilience
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cache Error Resilience', () => {
    it('should handle cache read errors gracefully (log warning, continue)', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache read failed'));
      queriesSimple.getKTVPerformance.mockRejectedValue(new Error('Database error'));

      await expect(
        service.getKtvPerformance(TEST_TENANT_ID, 'test-ktv-id', 'month')
      ).rejects.toThrow('Database error');

      expect(mockCache.get).toHaveBeenCalled();
      expect(queriesSimple.getKTVPerformance).toHaveBeenCalledWith(TEST_TENANT_ID, 'test-ktv-id');
    });
  });
});
