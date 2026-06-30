/**
 * Unit Tests: Executive Intelligence Service
 * 
 * Tests caching logic and error handling in ExecutiveIntelligenceService:
 * - Cache hit/miss scenarios
 * - Cache write-through pattern
 * - Error handling (wrap QueryError → IntelligenceError)
 * - Health check functionality
 * - Cache clearing
 * - Singleton pattern
 * 
 * Test Coverage:
 * - All 5 service methods with cache scenarios
 * - Cache TTL and tags configuration
 * - Error propagation
 * - Cache invalidation
 */

import {
  ExecutiveIntelligenceService,
  getExecutiveIntelligence,
  resetExecutiveIntelligence,
} from '../service';
import type { CacheService } from '../../shared/types';
import { IntelligenceError, QueryError } from '../../shared/types';
import { DEFAULT_CACHE_TTL, CACHE_KEY_PREFIX } from '../../shared/constants';
import * as queries from '../queries';

// Mock getCache
jest.mock('../../cache', () => ({
  getCache: jest.fn(),
}));

// Mock queries module
jest.mock('../queries', () => ({
  getMonthlyRevenueSummary: jest.fn(),
  getOperationalEfficiency: jest.fn(),
  getCustomerMetrics: jest.fn(),
  getFinancialHealth: jest.fn(),
  getGrowthIndicators: jest.fn(),
}));

describe('ExecutiveIntelligenceService', () => {
  const mockTenantId = '12345678-1234-4123-a123-123456789012';
  const mockDateRange = {
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  };

  let service: ExecutiveIntelligenceService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Reset singleton
    resetExecutiveIntelligence();

    // Create mock cache
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deletePattern: jest.fn(),
      deleteByTag: jest.fn(),
      getStats: jest.fn(),
      clear: jest.fn(),
    };

    // Mock getCache to return mockCache
    const { getCache } = require('../../cache');
    (getCache as jest.Mock).mockReturnValue(mockCache);

    // Create service instance
    service = new ExecutiveIntelligenceService();

    // Reset all query mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test: getMonthlyRevenueSummary
  // ───────────────────────────────────────────────────────────────────────────

  describe('getMonthlyRevenueSummary', () => {
    const mockRevenueData = {
      period: '2026-06-01',
      totalRevenue: 10000000,
      revenueGrowth: 25,
      topRevenueSources: [{ source: 'service', revenue: 8000000, percentage: 80 }],
      revenueByPaymentMethod: [{ method: 'cash', revenue: 7000000, percentage: 70 }],
    };

    it('should return cached data on cache hit', async () => {
      mockCache.get.mockResolvedValue(mockRevenueData);

      const result = await service.getMonthlyRevenueSummary(mockTenantId, mockDateRange);

      expect(result.data).toEqual(mockRevenueData);
      expect(result.metadata.cacheHit).toBe(true);
      expect(result.metadata.dataSourcesUsed).toEqual(['cache']);
      expect(mockCache.get).toHaveBeenCalledTimes(1);
      expect(queries.getMonthlyRevenueSummary).not.toHaveBeenCalled();
    });

    it('should query database on cache miss', async () => {
      mockCache.get.mockResolvedValue(null); // Cache miss
      (queries.getMonthlyRevenueSummary as jest.Mock).mockResolvedValue(mockRevenueData);

      const result = await service.getMonthlyRevenueSummary(mockTenantId, mockDateRange);

      expect(result.data).toEqual(mockRevenueData);
      expect(result.metadata.cacheHit).toBe(false);
      expect(result.metadata.dataSourcesUsed).toEqual(['revenue', 'bookings']);
      expect(mockCache.get).toHaveBeenCalledTimes(1);
      expect(queries.getMonthlyRevenueSummary).toHaveBeenCalledWith(mockTenantId, mockDateRange);
    });

    it('should write to cache after database query', async () => {
      mockCache.get.mockResolvedValue(null);
      (queries.getMonthlyRevenueSummary as jest.Mock).mockResolvedValue(mockRevenueData);

      await service.getMonthlyRevenueSummary(mockTenantId, mockDateRange);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('monthlyRevenueSummary'),
        mockRevenueData,
        {
          ttl: DEFAULT_CACHE_TTL.EXECUTIVE,
          tags: ['executive', `tenant:${mockTenantId}`],
        }
      );
    });

    it('should wrap QueryError in IntelligenceError', async () => {
      mockCache.get.mockResolvedValue(null);
      (queries.getMonthlyRevenueSummary as jest.Mock).mockRejectedValue(
        new QueryError('Database query failed', new Error('Connection timeout'))
      );

      await expect(service.getMonthlyRevenueSummary(mockTenantId, mockDateRange)).rejects.toThrow(
        IntelligenceError
      );
    });

    it('should handle date range as TimePeriod string', async () => {
      mockCache.get.mockResolvedValue(null);
      (queries.getMonthlyRevenueSummary as jest.Mock).mockResolvedValue(mockRevenueData);

      await service.getMonthlyRevenueSummary(mockTenantId, 'month');

      expect(queries.getMonthlyRevenueSummary).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({ startDate: expect.any(Date), endDate: expect.any(Date) })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test: getOperationalEfficiency
  // ───────────────────────────────────────────────────────────────────────────

  describe('getOperationalEfficiency', () => {
    const mockEfficiencyData = {
      period: '2026-06-01',
      ktvUtilizationRate: 75,
      averageSessionRating: 4.5,
      serviceCompletionRate: 85,
      revenuePerKtv: 5000000,
    };

    it('should return cached data on cache hit', async () => {
      mockCache.get.mockResolvedValue(mockEfficiencyData);

      const result = await service.getOperationalEfficiency(mockTenantId, mockDateRange);

      expect(result.data).toEqual(mockEfficiencyData);
      expect(result.metadata.cacheHit).toBe(true);
      expect(mockCache.get).toHaveBeenCalledTimes(1);
      expect(queries.getOperationalEfficiency).not.toHaveBeenCalled();
    });

    it('should query database on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      (queries.getOperationalEfficiency as jest.Mock).mockResolvedValue(mockEfficiencyData);

      const result = await service.getOperationalEfficiency(mockTenantId, mockDateRange);

      expect(result.data).toEqual(mockEfficiencyData);
      expect(result.metadata.cacheHit).toBe(false);
      expect(queries.getOperationalEfficiency).toHaveBeenCalledWith(mockTenantId, mockDateRange);
    });

    it('should write to cache with correct TTL and tags', async () => {
      mockCache.get.mockResolvedValue(null);
      (queries.getOperationalEfficiency as jest.Mock).mockResolvedValue(mockEfficiencyData);

      await service.getOperationalEfficiency(mockTenantId, mockDateRange);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        mockEfficiencyData,
        expect.objectContaining({
          ttl: expect.any(Number),
          tags: expect.arrayContaining([expect.stringContaining('tenant:')]),
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test: getCustomerMetrics
  // ───────────────────────────────────────────────────────────────────────────

  describe('getCustomerMetrics', () => {
    const mockCustomerData = {
      period: '2026-06-01',
      newCustomers: 50,
      retentionRate: 75,
      averageBookingValue: 2500000,
      customerLifetimeValue: 7500000,
    };

    it('should return cached data on cache hit', async () => {
      mockCache.get.mockResolvedValue(mockCustomerData);

      const result = await service.getCustomerMetrics(mockTenantId, mockDateRange);

      expect(result.data).toEqual(mockCustomerData);
      expect(result.metadata.cacheHit).toBe(true);
    });

    it('should query database on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      (queries.getCustomerMetrics as jest.Mock).mockResolvedValue(mockCustomerData);

      const result = await service.getCustomerMetrics(mockTenantId, mockDateRange);

      expect(result.data).toEqual(mockCustomerData);
      expect(result.metadata.cacheHit).toBe(false);
      expect(queries.getCustomerMetrics).toHaveBeenCalledWith(mockTenantId, mockDateRange);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test: getFinancialHealth
  // ───────────────────────────────────────────────────────────────────────────

  describe('getFinancialHealth', () => {
    const mockFinancialData = {
      period: '2026-06-01',
      profitMargin: 60,
      cashFlow: 9000000,
      outstandingReceivables: 2000000,
      expenseBreakdown: [{ category: 'salary', amount: 3000000, percentage: 50 }],
    };

    it('should return cached data on cache hit', async () => {
      mockCache.get.mockResolvedValue(mockFinancialData);

      const result = await service.getFinancialHealth(mockTenantId, mockDateRange);

      expect(result.data).toEqual(mockFinancialData);
      expect(result.metadata.cacheHit).toBe(true);
    });

    it('should query database on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      (queries.getFinancialHealth as jest.Mock).mockResolvedValue(mockFinancialData);

      const result = await service.getFinancialHealth(mockTenantId, mockDateRange);

      expect(result.data).toEqual(mockFinancialData);
      expect(result.metadata.cacheHit).toBe(false);
      expect(queries.getFinancialHealth).toHaveBeenCalledWith(mockTenantId, mockDateRange);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test: getGrowthIndicators
  // ───────────────────────────────────────────────────────────────────────────

  describe('getGrowthIndicators', () => {
    const mockGrowthData = {
      period: '2026-06-01',
      monthOverMonthGrowth: 25,
      yearOverYearGrowth: 50,
      projectedRevenue: 12000000,
      topGrowingServices: [{ service: 'service', growthRate: 30, currentRevenue: 8000000 }],
    };

    it('should return cached data on cache hit', async () => {
      mockCache.get.mockResolvedValue(mockGrowthData);

      const result = await service.getGrowthIndicators(mockTenantId, mockDateRange);

      expect(result.data).toEqual(mockGrowthData);
      expect(result.metadata.cacheHit).toBe(true);
    });

    it('should query database on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      (queries.getGrowthIndicators as jest.Mock).mockResolvedValue(mockGrowthData);

      const result = await service.getGrowthIndicators(mockTenantId, mockDateRange);

      expect(result.data).toEqual(mockGrowthData);
      expect(result.metadata.cacheHit).toBe(false);
      expect(queries.getGrowthIndicators).toHaveBeenCalledWith(mockTenantId, mockDateRange);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test: Health Check
  // ───────────────────────────────────────────────────────────────────────────

  describe('healthCheck', () => {
    it('should return true when cache is operational', async () => {
      mockCache.set.mockResolvedValue(undefined);
      mockCache.get.mockResolvedValue({ test: true });
      mockCache.delete.mockResolvedValue(undefined);

      const result = await service.healthCheck();

      expect(result).toBe(true);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('healthcheck'),
        { test: true },
        { ttl: 10 }
      );
      expect(mockCache.get).toHaveBeenCalledWith(expect.stringContaining('healthcheck'));
      expect(mockCache.delete).toHaveBeenCalledWith(expect.stringContaining('healthcheck'));
    });

    it('should return false when cache fails', async () => {
      mockCache.set.mockRejectedValue(new Error('Cache connection failed'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test: Clear Cache
  // ───────────────────────────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('should clear all executive cache entries', async () => {
      mockCache.deletePattern.mockResolvedValue(undefined);

      await service.clearCache();

      expect(mockCache.deletePattern).toHaveBeenCalledWith(`${CACHE_KEY_PREFIX.EXECUTIVE}*`);
    });

    it('should throw IntelligenceError on cache clear failure', async () => {
      mockCache.deletePattern.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.clearCache()).rejects.toThrow(IntelligenceError);
      await expect(service.clearCache()).rejects.toThrow(/Failed to clear Executive Intelligence cache/);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test: Singleton Pattern
  // ───────────────────────────────────────────────────────────────────────────

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getExecutiveIntelligence();
      const instance2 = getExecutiveIntelligence();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton instance', () => {
      const instance1 = getExecutiveIntelligence();
      resetExecutiveIntelligence();
      const instance2 = getExecutiveIntelligence();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test: Error Handling
  // ───────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should wrap QueryError with context', async () => {
      mockCache.get.mockResolvedValue(null);
      const queryError = new QueryError('Database query failed', new Error('Connection timeout'));
      (queries.getMonthlyRevenueSummary as jest.Mock).mockRejectedValue(queryError);

      await expect(service.getMonthlyRevenueSummary(mockTenantId, mockDateRange)).rejects.toThrow(
        IntelligenceError
      );
      await expect(service.getMonthlyRevenueSummary(mockTenantId, mockDateRange)).rejects.toThrow(
        /getMonthlyRevenueSummary/
      );
    });

    it('should propagate IntelligenceError without re-wrapping', async () => {
      mockCache.get.mockResolvedValue(null);
      const intelligenceError = new IntelligenceError(
        'Intelligence layer error',
        'INTELLIGENCE_ERROR'
      );
      (queries.getMonthlyRevenueSummary as jest.Mock).mockRejectedValue(intelligenceError);

      await expect(service.getMonthlyRevenueSummary(mockTenantId, mockDateRange)).rejects.toThrow(
        intelligenceError
      );
    });

    it('should wrap unknown errors', async () => {
      mockCache.get.mockResolvedValue(null);
      (queries.getMonthlyRevenueSummary as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      await expect(service.getMonthlyRevenueSummary(mockTenantId, mockDateRange)).rejects.toThrow(
        IntelligenceError
      );
      await expect(service.getMonthlyRevenueSummary(mockTenantId, mockDateRange)).rejects.toThrow(
        /Unexpected error/
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test: Cache Key Generation
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys for same parameters', async () => {
      mockCache.get.mockResolvedValue(null);
      (queries.getMonthlyRevenueSummary as jest.Mock).mockResolvedValue({
        period: '2026-06-01',
        totalRevenue: 10000000,
        revenueGrowth: 25,
        topRevenueSources: [],
        revenueByPaymentMethod: [],
      });

      await service.getMonthlyRevenueSummary(mockTenantId, mockDateRange);
      await service.getMonthlyRevenueSummary(mockTenantId, mockDateRange);

      // Should call cache.get with the same key twice
      expect(mockCache.get).toHaveBeenCalledTimes(2);
      const firstCallKey = (mockCache.get as jest.Mock).mock.calls[0][0];
      const secondCallKey = (mockCache.get as jest.Mock).mock.calls[1][0];
      expect(firstCallKey).toBe(secondCallKey);
    });

    it('should generate different cache keys for different parameters', async () => {
      mockCache.get.mockResolvedValue(null);
      (queries.getMonthlyRevenueSummary as jest.Mock).mockResolvedValue({
        period: '2026-06-01',
        totalRevenue: 10000000,
        revenueGrowth: 25,
        topRevenueSources: [],
        revenueByPaymentMethod: [],
      });

      const dateRange1 = { startDate: '2026-06-01', endDate: '2026-06-30' };
      const dateRange2 = { startDate: '2026-05-01', endDate: '2026-05-31' };

      await service.getMonthlyRevenueSummary(mockTenantId, dateRange1);
      await service.getMonthlyRevenueSummary(mockTenantId, dateRange2);

      const firstCallKey = (mockCache.get as jest.Mock).mock.calls[0][0];
      const secondCallKey = (mockCache.get as jest.Mock).mock.calls[1][0];
      expect(firstCallKey).not.toBe(secondCallKey);
    });
  });
});
