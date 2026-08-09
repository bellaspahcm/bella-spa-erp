/**
 * Unit Tests for Finance Intelligence Service
 *
 * Tests FinanceIntelligenceService class including:
 * - Cache-first pattern
 * - Error handling
 * - Data transformation
 * - Method signatures
 */

// ─── Shared cache store (defined outside so tests can clear it) ───────────────
// Must use `var` so it is accessible inside the hoisted jest.mock factory
// eslint-disable-next-line no-var
var cacheStore: Map<string, unknown>;

// Mock the entire multi-tier cache layer so MemoryCache singleton
// doesn't leak between test cases.
jest.mock('@/services/intelligence/cache', () => {
  // Lazily initialise the store inside the factory to avoid hoisting issues
  const store: Map<string, unknown> = new Map();
  // Expose it on the module so tests can reach it via require()
  (global as Record<string, unknown>).__testCacheStore = store;

  const instance = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: unknown) => { store.set(key, value); }),
    delete: jest.fn(async (key: string) => { store.delete(key); }),
    deletePattern: jest.fn(async (pattern: string) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      for (const key of store.keys()) {
        if (regex.test(key)) store.delete(key);
      }
    }),
    deleteByTag: jest.fn(async (_tag: string) => { store.clear(); }),
    clear: jest.fn(async () => { store.clear(); }),
    getStats: jest.fn(async () => ({
      hits: 0, misses: 0, hitRate: 0, totalKeys: 0, memoryUsedBytes: 0,
    })),
    healthCheck: jest.fn(async () => true),
  };

  return {
    getCache: jest.fn(() => instance),
    resetCache: jest.fn(() => { store.clear(); }),
    MultiTierCache: jest.fn(() => instance),
    getMemoryCache: jest.fn(() => instance),
    resetMemoryCache: jest.fn(),
    getRedisCache: jest.fn(() => instance),
    resetRedisCache: jest.fn(),
  };
});

// ─── Mock queries ─────────────────────────────────────────────────────────────
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
  getMonthlyPnL:        jest.fn(() => Promise.resolve(mockQueryResults.monthlyPnL)),
  getCashFlowAnalysis:  jest.fn(() => Promise.resolve(mockQueryResults.cashFlowAnalysis)),
  getBudgetVariance:    jest.fn(() => Promise.resolve(mockQueryResults.budgetVariance)),
  getExpenseBreakdown:  jest.fn(() => Promise.resolve({ items: [], total: 0 })),
  getRevenueBreakdown:  jest.fn(() => Promise.resolve({ items: [], total: 0 })),
  getCashFlowForecast:  jest.fn(() => Promise.resolve({ projections: [], confidence: 85 })),
  getProfitabilityTrends: jest.fn(() => Promise.resolve({ trends: [], momGrowth: 10, yoyGrowth: 25 })),
  getFinancialRatios:   jest.fn(() => Promise.resolve({ currentRatio: 1.5, quickRatio: 1.2 })),
}));

import { getFinanceIntelligenceService } from '@/services/intelligence/finance/service';

// Helper: clear the mock cache store between tests
function clearTestCacheStore(): void {
  const store = (global as Record<string, unknown>).__testCacheStore as Map<string, unknown> | undefined;
  store?.clear();
}

// ─────────────────────────────────────────────────────────────────────────────

describe('FinanceIntelligenceService', () => {
  let service: ReturnType<typeof getFinanceIntelligenceService>;

  beforeEach(() => {
    clearTestCacheStore();
    jest.clearAllMocks();
    service = getFinanceIntelligenceService();
  });

  // ── Singleton ─────────────────────────────────────────────────────────────

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      expect(getFinanceIntelligenceService()).toBe(getFinanceIntelligenceService());
    });
  });

  // ── getMonthlyPnL ─────────────────────────────────────────────────────────

  describe('getMonthlyPnL', () => {
    const tenantId = 'test-tenant-pnl';
    const period   = 'current_month';

    it('returns P&L data on first call (cache miss)', async () => {
      const result = await service.getMonthlyPnL('pnl-miss', period);
      expect(result.data).toEqual(mockQueryResults.monthlyPnL);
      expect(result.metadata.cacheHit).toBe(false);
    });

    it('returns cached data on second call (cache hit)', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      const tid = 'pnl-hit';

      await service.getMonthlyPnL(tid, period);
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(1);

      const result = await service.getMonthlyPnL(tid, period);
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(1); // not called again
      expect(result.metadata.cacheHit).toBe(true);
      expect(result.data).toEqual(mockQueryResults.monthlyPnL);
    });

    it('calls queries separately for different periods', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      // Use DateRange objects with distinct dates to guarantee different cache keys
      const range1 = { startDate: new Date('2026-06-01'), endDate: new Date('2026-06-30') };
      const range2 = { startDate: new Date('2026-05-01'), endDate: new Date('2026-05-31') };
      const tid = 'pnl-periods';
      await service.getMonthlyPnL(tid, range1);
      await service.getMonthlyPnL(tid, range2);
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(2);
    });

    it('passes a DateRange object directly to the query', async () => {
      const queries  = require('@/services/intelligence/finance/queries');
      const tid       = 'pnl-daterange';
      const startDate = new Date('2026-05-01');
      const endDate   = new Date('2026-05-31');
      const range     = { startDate, endDate };

      await service.getMonthlyPnL(tid, range);
      expect(queries.getMonthlyPnL).toHaveBeenCalledWith(tid, range);
    });
  });

  // ── getCashFlowAnalysis ───────────────────────────────────────────────────

  describe('getCashFlowAnalysis', () => {
    const tenantId = 'test-tenant-cf';
    const period   = 'month';

    it('returns cash-flow data', async () => {
      const result = await service.getCashFlowAnalysis(tenantId, period);
      expect(result.data).toEqual(mockQueryResults.cashFlowAnalysis);
      expect(result.data.totalInflows).toBe(10000000);
      expect(result.data.netCashFlow).toBe(4000000);
    });

    it('caches results by tenant + period', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      await service.getCashFlowAnalysis(tenantId, period);
      await service.getCashFlowAnalysis(tenantId, period);
      expect(queries.getCashFlowAnalysis).toHaveBeenCalledTimes(1);
    });
  });

  // ── getBudgetVariance ─────────────────────────────────────────────────────

  describe('getBudgetVariance', () => {
    const tenantId = 'test-tenant-bv';
    const month    = '2026-06';

    it('returns budget variance data', async () => {
      const result = await service.getBudgetVariance(tenantId, month);
      expect(result.data).toEqual(mockQueryResults.budgetVariance);
      expect(result.data.variance).toBe(-500000);
      expect(result.data.variancePercent).toBe(-5);
    });

    it('caches results by tenant + month', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      await service.getBudgetVariance(tenantId, month);
      await service.getBudgetVariance(tenantId, month);
      expect(queries.getBudgetVariance).toHaveBeenCalledTimes(1);
    });

    it('treats different months as separate cache entries', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      await service.getBudgetVariance(tenantId, '2026-05');
      await service.getBudgetVariance(tenantId, '2026-06');
      expect(queries.getBudgetVariance).toHaveBeenCalledTimes(2);
    });
  });

  // ── getCashFlowForecast ───────────────────────────────────────────────────

  describe('getCashFlowForecast', () => {
    const tenantId      = 'test-tenant-fcst';
    const forecastMonths = 6;

    it('returns forecast data', async () => {
      const result = await service.getCashFlowForecast(tenantId, forecastMonths);
      expect(result.data).toHaveProperty('projections');
      expect(result.data).toHaveProperty('confidence');
      expect(result.data.confidence).toBe(85);
    });

    it('caches forecast results', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      await service.getCashFlowForecast(tenantId, forecastMonths);
      await service.getCashFlowForecast(tenantId, forecastMonths);
      expect(queries.getCashFlowForecast).toHaveBeenCalledTimes(1);
    });

    it('treats different forecast horizons separately', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      await service.getCashFlowForecast(tenantId, 3);
      await service.getCashFlowForecast(tenantId, 12);
      expect(queries.getCashFlowForecast).toHaveBeenCalledTimes(2);
    });
  });

  // ── Error Handling ────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('propagates query errors to the caller', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      queries.getMonthlyPnL.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        service.getMonthlyPnL('test-tenant-err', 'current_month'),
      ).rejects.toThrow('Database error');
    });
  });

  // ── Cache Invalidation ────────────────────────────────────────────────────

  describe('Cache Invalidation', () => {
    it('forces a DB hit after clearCache(tenantId)', async () => {
      const queries  = require('@/services/intelligence/finance/queries');
      const tenantId = 'test-tenant-inv';

      await service.getMonthlyPnL(tenantId, 'current_month');
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(1);

      await service.clearCache(tenantId);
      jest.clearAllMocks();

      await service.getMonthlyPnL(tenantId, 'current_month');
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(1);
    });
  });

  // ── Health Check ──────────────────────────────────────────────────────────

  describe('Health Check', () => {
    it('returns true when cache layer is healthy', async () => {
      const health = await service.healthCheck();
      expect(health).toBe(true);
    });
  });

  // ── Tenant Isolation ──────────────────────────────────────────────────────

  describe('Tenant Isolation', () => {
    it('uses separate cache keys per tenant', async () => {
      const queries = require('@/services/intelligence/finance/queries');

      await service.getMonthlyPnL('tenant-A', 'current_month');
      await service.getMonthlyPnL('tenant-B', 'current_month');

      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(2);
      expect(queries.getMonthlyPnL).toHaveBeenNthCalledWith(1, 'tenant-A', 'current_month');
      expect(queries.getMonthlyPnL).toHaveBeenNthCalledWith(2, 'tenant-B', 'current_month');
    });
  });

  // ── Cache TTL Simulation ──────────────────────────────────────────────────

  describe('Cache TTL', () => {
    it('re-queries DB after the cache store is cleared (simulates TTL expiry)', async () => {
      const queries  = require('@/services/intelligence/finance/queries');
      const tenantId = 'test-tenant-ttl';

      // First call → cache miss → DB query
      await service.getMonthlyPnL(tenantId, 'current_month');
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(1);

      // Simulate TTL expiry: wipe the store & reset call counts
      clearTestCacheStore();
      jest.clearAllMocks();

      // Second call → should be a cache miss again → DB query
      await service.getMonthlyPnL(tenantId, 'current_month');
      expect(queries.getMonthlyPnL).toHaveBeenCalledTimes(1);
    });
  });

  // ── Data Transformation ───────────────────────────────────────────────────

  describe('Data Transformation', () => {
    it('wraps response in IntelligenceResponse shape', async () => {
      const result = await service.getMonthlyPnL('test-tenant-shape', 'current_month');

      expect(result.data).toHaveProperty('totalRevenue');
      expect(result.data).toHaveProperty('totalExpenses');
      expect(result.data).toHaveProperty('netProfit');
      expect(result.data).toHaveProperty('profitMargin');
      expect(typeof result.data.totalRevenue).toBe('number');
    });

    it('wraps null query result as { data: null, ... }', async () => {
      const queries = require('@/services/intelligence/finance/queries');
      queries.getMonthlyPnL.mockResolvedValueOnce(null);

      const result = await service.getMonthlyPnL('test-tenant-null', 'current_month');
      expect(result.data).toBeNull();
    });
  });
});
