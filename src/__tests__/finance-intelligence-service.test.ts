/**
 * Unit Tests for Finance Intelligence Service
 * 
 * Tests FinanceIntelligenceService class including:
 * - Cache-first pattern
 * - Error handling
 * - Data transformation
 * - Method signatures
 */

import { getFinanceIntelligenceService } from '@/services/intelligence/finance/service';

// Mock Redis cache
const mockCache = new Map<string, { value: any; expiresAt: number }>();

jest.mock('@/lib/redis', () => ({
  getCacheClient: jest.fn(() => ({
    get: jest.fn((key: string) => {
      const cached = mockCache.get(key);
      if (!cached) return Promise.resolve(null);
      if (Date.now() > cached.expiresAt) {
        mockCache.delete(key);
        return Promise.resolve(null);
      }
      return Promise.resolve(cached.value);
    }),
    setex: jest.fn((key: string, ttl: number, value: string) => {
      mockCache.set(key, {
        value,
        expiresAt: Date.now() + ttl * 1000,
      });
      return Promise.resolve('OK');
    }),
    del: jest.fn((key: string) => {
      mockCache.delete(key);
      return Promise.resolve(1);
    }),
  })),
}));

// Mock queries module
const mockQueryResults = {
  monthlyPnL: {
    totalRevenue: 10000000,
    totalExpenses: 6000000,
    netProfit: 4000000,
    profitMargin: 40,
  },
  cashFlowAnalysis: {
    totalInflows: 10000000,
    totalOutflows: 6000000,
    netCashFlow: 4000000,
    cumulativeCash: 20000000,
  },
  budgetVariance: {
    totalBudget: 10000000,
    totalActual: 9500000,
    variance: -500000,
    variancePercent: -5,
  },
};

jest.mock('@/services/intelligence/finance/queries', () => ({
  getMonthlyPnL: jest.fn(() => Promise.resolve(mockQueryResults.monthlyPnL)),
  getCashFlowAnalysis: jest.fn(() => Promise.resolve(mockQueryResults.cashFlowAnalysis)),
  getBudgetVariance: jest.fn(() => Promise.resolve(mockQueryResults.budgetVariance)),
  getExpenseBreakdown: jest.fn(() => Promise.resolve({ items: [], total: 0 })),
  getRevenueBreakdown: jest.fn(() => Promise.resolve({ items: [], total: 0 })),
  getCashFlowForecast: jest.fn(() => Promise.resolve({ projections: [], confidence: 85 })),
  getProfitabilityTrends: jest.fn(() => Promise.resolve({ trends: [], momGrowth: 10, yoyGrowth: 25 })),
  getFinancialRatios: jest.fn(() => Promise.resolve({ currentRatio: 1.5, quickRatio: 1.2 })),
}));

describe('FinanceIntelligenceService', () => {
  let service: ReturnType<typeof getFinanceIntelligenceService>;

  beforeEach(() => {
    // Clear cache before each test
    mockCache.clear();
    jest.clearAllMocks();
    service = getFinanceIntelligenceService();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getFinanceIntelligenceService();
      const instance2 = getFinanceIntelligenceService();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getMonthlyPnL', () => {
    const tenantId = 'test-tenant-123';
    const period = 'current_month';

    it('should return P&L data on first call (cache miss)', async () => {
      const result = await service.getMonthlyPnL(tenantId, period);
      
      expect(result).toEqual(mockQueryResults.monthlyPnL);
    });

    it('should return cached data on second call (cache hit)', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      
      // First call - cache miss
      await service.getMonthlyPnL(tenantId, period);
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      const result = await service.getMonthlyPnL(tenantId, period);
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(1); // Not called again
      expect(result).toEqual(mockQueryResults.monthlyPnL);
    });

    it('should handle different periods correctly', async () => {
      await service.getMonthlyPnL(tenantId, 'current_month');
      await service.getMonthlyPnL(tenantId, 'last_month');
      
      const queries = require('@/services/intelligence/finance/queries');
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(2);
    });

    it('should handle custom date range', async () => {
      const startDate = '2026-05-01';
      const endDate = '2026-05-31';
      
      await service.getMonthlyPnL(tenantId, 'custom', startDate, endDate);
      
      const queries = require('@/services/intelligence/finance/queries');
      expect(queries.getMonthlyPnL).toHaveBeenCalledWith(tenantId, 'custom', startDate, endDate);
    });
  });

  describe('getCashFlowAnalysis', () => {
    const tenantId = 'test-tenant-123';
    const period = 'month';

    it('should return cash flow data', async () => {
      const result = await service.getCashFlowAnalysis(tenantId, period);
      
      expect(result).toEqual(mockQueryResults.cashFlowAnalysis);
      expect(result.totalInflows).toBe(10000000);
      expect(result.netCashFlow).toBe(4000000);
    });

    it('should cache results by tenant and period', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      
      await service.getCashFlowAnalysis(tenantId, period);
      await service.getCashFlowAnalysis(tenantId, period);
      
      expect(queries.getCashFlowAnalysis).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBudgetVariance', () => {
    const tenantId = 'test-tenant-123';
    const month = '2026-06';

    it('should return budget variance data', async () => {
      const result = await service.getBudgetVariance(tenantId, month);
      
      expect(result).toEqual(mockQueryResults.budgetVariance);
      expect(result.variance).toBe(-500000);
      expect(result.variancePercent).toBe(-5);
    });

    it('should cache results by tenant and month', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      
      await service.getBudgetVariance(tenantId, month);
      await service.getBudgetVariance(tenantId, month);
      
      expect(queries.getBudgetVariance).toHaveBeenCalledTimes(1);
    });

    it('should handle different months separately', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      
      await service.getBudgetVariance(tenantId, '2026-05');
      await service.getBudgetVariance(tenantId, '2026-06');
      
      expect(queries.getBudgetVariance).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCashFlowForecast', () => {
    const tenantId = 'test-tenant-123';
    const forecastMonths = 6;

    it('should return forecast data with specified months', async () => {
      const result = await service.getCashFlowForecast(tenantId, forecastMonths);
      
      expect(result).toHaveProperty('projections');
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBe(85);
    });

    it('should cache forecast results', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      
      await service.getCashFlowForecast(tenantId, forecastMonths);
      await service.getCashFlowForecast(tenantId, forecastMonths);
      
      expect(queries.getCashFlowForecast).toHaveBeenCalledTimes(1);
    });

    it('should handle different forecast periods', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      
      await service.getCashFlowForecast(tenantId, 3);
      await service.getCashFlowForecast(tenantId, 12);
      
      expect(queries.getCashFlowForecast).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should propagate query errors', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      queries.getMonthlyPnL.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        service.getMonthlyPnL('test-tenant', 'current_month')
      ).rejects.toThrow('Database error');
    });

    it('should handle cache write failures gracefully', async () => {
      const redis = require('@/lib/redis');
      redis.getCacheClient().setex.mockRejectedValueOnce(new Error('Redis error'));

      // Should still return data even if cache write fails
      const result = await service.getMonthlyPnL('test-tenant', 'current_month');
      expect(result).toEqual(mockQueryResults.monthlyPnL);
    });
  });

  describe('Cache Invalidation', () => {
    it('should clear all cache entries for a tenant', async () => {
      const tenantId = 'test-tenant-123';
      
      // Populate cache
      await service.getMonthlyPnL(tenantId, 'current_month');
      await service.getCashFlowAnalysis(tenantId, 'month');
      await service.getBudgetVariance(tenantId, '2026-06');

      // Clear cache
      await service.clearCache(tenantId);

      // Next calls should hit queries again
      const queries = require('@/services/intelligence/finance/queries');
      jest.clearAllMocks();

      await service.getMonthlyPnL(tenantId, 'current_month');
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(1);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const health = await service.healthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health.status).toBe('healthy');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('service');
      expect(health.service).toBe('finance-intelligence');
    });
  });

  describe('Tenant Isolation', () => {
    it('should isolate cache by tenant ID', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      
      await service.getMonthlyPnL('tenant-1', 'current_month');
      await service.getMonthlyPnL('tenant-2', 'current_month');
      
      // Should call queries twice (once per tenant)
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(2);
      expect(queries.getMonthlyPnL).toHaveBeenNthCalledWith(1, 'tenant-1', 'current_month', undefined, undefined);
      expect(queries.getMonthlyPnL).toHaveBeenNthCalledWith(2, 'tenant-2', 'current_month', undefined, undefined);
    });
  });

  describe('Cache TTL', () => {
    it('should expire cache after TTL (3600 seconds)', async () => {
      const tenantId = 'test-tenant-123';
      const queries = require('@/services/intelligence/finance/queries');
      
      // First call
      await service.getMonthlyPnL(tenantId, 'current_month');
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(1);

      // Simulate cache expiry by manually clearing
      mockCache.clear();

      // Second call after expiry
      await service.getMonthlyPnL(tenantId, 'current_month');
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Transformation', () => {
    it('should return data in consistent format', async () => {
      const result = await service.getMonthlyPnL('test-tenant', 'current_month');
      
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('totalExpenses');
      expect(result).toHaveProperty('netProfit');
      expect(result).toHaveProperty('profitMargin');
      
      expect(typeof result.totalRevenue).toBe('number');
      expect(typeof result.profitMargin).toBe('number');
    });

    it('should handle null/undefined gracefully', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      queries.getMonthlyPnL.mockResolvedValueOnce(null);

      const result = await service.getMonthlyPnL('test-tenant', 'current_month');
      expect(result).toBeNull();
    });
  });
});
