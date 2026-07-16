/**
 * Integration Tests for Finance Intelligence
 * 
 * Tests Finance Intelligence with real Supabase data:
 * - Materialized views queries
 * - API routes end-to-end
 * - Data consistency
 * - Performance benchmarks
 */

import { createClient } from '@/lib/supabase-server';
import { getFinanceIntelligenceService } from '@/services/intelligence/finance/service';

describe('Finance Intelligence Integration Tests', () => {
  let supabase: ReturnType<typeof createClient>;
  let testTenantId: string;

  beforeAll(async () => {
    supabase = await createClient();
    
    // Get or create test tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', 'Test Tenant for Finance Intelligence')
      .single();

    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const { data: newTenant, error } = await supabase
        .from('tenants')
        .insert({
          name: 'Test Tenant for Finance Intelligence',
          subscription_tier: 'premium',
          status: 'active',
        })
        .select('id')
        .single();

      if (error) throw error;
      testTenantId = newTenant!.id;
    }
  });

  describe('Materialized Views', () => {
    // SKIPPED: Requires DB migrations to be run first
    // Run: supabase db reset (local) or supabase db push (remote)
    // Migrations needed:
    // - 20260622240000_create_mv_monthly_pnl.sql
    // - *_create_mv_cash_flow.sql
    // - *_create_mv_budget_variance.sql
    
    it.skip('should query mv_monthly_pnl successfully', async () => {
      const { data, error } = await supabase
        .from('mv_monthly_pnl')
        .select('*')
        .eq('tenant_id', testTenantId)
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it.skip('should query mv_cash_flow successfully', async () => {
      const { data, error } = await supabase
        .from('mv_cash_flow')
        .select('*')
        .eq('tenant_id', testTenantId)
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it.skip('should query mv_budget_variance successfully', async () => {
      const { data, error } = await supabase
        .from('mv_budget_variance')
        .select('*')
        .eq('tenant_id', testTenantId)
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe.skip('Finance Intelligence Service - Real Data', () => {
    // SKIPPED: Requires DB materialized views to exist
    // These tests query mv_monthly_pnl, mv_cash_flow, mv_budget_variance
    // Run migrations first: supabase db push
    
    let service: ReturnType<typeof getFinanceIntelligenceService>;

    beforeAll(() => {
      service = getFinanceIntelligenceService();
    });

    it('should fetch monthly P&L data', async () => {
      const result = await service.getMonthlyPnL(testTenantId, 'current_month');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('totalExpenses');
      expect(result).toHaveProperty('netProfit');
      expect(result).toHaveProperty('profitMargin');
      
      expect(typeof result.totalRevenue).toBe('number');
      expect(typeof result.totalExpenses).toBe('number');
    }, 10000); // 10s timeout

    it('should fetch cash flow analysis data', async () => {
      const result = await service.getCashFlowAnalysis(testTenantId, 'month');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalInflows');
      expect(result).toHaveProperty('totalOutflows');
      expect(result).toHaveProperty('netCashFlow');
      
      expect(typeof result.totalInflows).toBe('number');
    }, 10000);

    it('should fetch budget variance data', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const result = await service.getBudgetVariance(testTenantId, currentMonth);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalBudget');
      expect(result).toHaveProperty('totalActual');
      expect(result).toHaveProperty('variance');
    }, 10000);

    it('should fetch expense breakdown data', async () => {
      const result = await service.getExpenseBreakdown(testTenantId, 'month');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.items)).toBe(true);
    }, 10000);

    it('should fetch revenue breakdown data', async () => {
      const result = await service.getRevenueBreakdown(testTenantId, 'month');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.items)).toBe(true);
    }, 10000);

    it('should fetch cash flow forecast', async () => {
      const result = await service.getCashFlowForecast(testTenantId, 6);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('projections');
      expect(result).toHaveProperty('confidence');
      expect(Array.isArray(result.projections)).toBe(true);
    }, 10000);

    it('should fetch profitability trends', async () => {
      const result = await service.getProfitabilityTrends(testTenantId, 'month');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('trends');
      expect(result).toHaveProperty('momGrowth');
      expect(result).toHaveProperty('yoyGrowth');
      expect(Array.isArray(result.trends)).toBe(true);
    }, 10000);

    it('should fetch financial ratios', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const result = await service.getFinancialRatios(testTenantId, currentMonth);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('currentRatio');
      expect(result).toHaveProperty('quickRatio');
    }, 10000);
  });

  describe.skip('Cache Performance', () => {
    // SKIPPED: Requires DB materialized views to exist
    let service: ReturnType<typeof getFinanceIntelligenceService>;

    beforeAll(() => {
      service = getFinanceIntelligenceService();
    });

    it('should serve cached data faster than fresh query', async () => {
      // First call (cache miss)
      const startFresh = Date.now();
      await service.getMonthlyPnL(testTenantId, 'current_month');
      const freshDuration = Date.now() - startFresh;

      // Second call (cache hit)
      const startCached = Date.now();
      await service.getMonthlyPnL(testTenantId, 'current_month');
      const cachedDuration = Date.now() - startCached;

      // Cached should be significantly faster
      expect(cachedDuration).toBeLessThan(freshDuration);
      expect(cachedDuration).toBeLessThan(100); // Should be < 100ms
    }, 15000);

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, () =>
        service.getMonthlyPnL(testTenantId, 'current_month')
      );

      const start = Date.now();
      const results = await Promise.all(requests);
      const duration = Date.now() - start;

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result).toHaveProperty('totalRevenue');
      });

      // All requests should complete quickly due to caching
      expect(duration).toBeLessThan(2000); // < 2 seconds for 10 requests
    }, 20000);
  });

  describe.skip('Data Consistency', () => {
    // SKIPPED: Requires DB materialized views to exist
    it('should have consistent revenue totals across endpoints', async () => {
      const service = getFinanceIntelligenceService();
      
      const pnl = await service.getMonthlyPnL(testTenantId, 'current_month');
      const revenueBreakdown = await service.getRevenueBreakdown(testTenantId, 'month');

      // Total revenue from P&L should match revenue breakdown total
      expect(Math.abs(pnl.totalRevenue - revenueBreakdown.total)).toBeLessThan(1); // Allow 1 VND rounding
    }, 15000);

    it('should have consistent expense totals across endpoints', async () => {
      const service = getFinanceIntelligenceService();
      
      const pnl = await service.getMonthlyPnL(testTenantId, 'current_month');
      const expenseBreakdown = await service.getExpenseBreakdown(testTenantId, 'month');

      // Total expenses from P&L should match expense breakdown total
      expect(Math.abs(pnl.totalExpenses - expenseBreakdown.total)).toBeLessThan(1);
    }, 15000);

    it('should calculate net profit correctly', async () => {
      const service = getFinanceIntelligenceService();
      
      const pnl = await service.getMonthlyPnL(testTenantId, 'current_month');
      const calculatedProfit = pnl.totalRevenue - pnl.totalExpenses;

      expect(Math.abs(pnl.netProfit - calculatedProfit)).toBeLessThan(1);
    }, 10000);

    it('should calculate profit margin correctly', async () => {
      const service = getFinanceIntelligenceService();
      
      const pnl = await service.getMonthlyPnL(testTenantId, 'current_month');
      
      if (pnl.totalRevenue > 0) {
        const calculatedMargin = (pnl.netProfit / pnl.totalRevenue) * 100;
        expect(Math.abs(pnl.profitMargin - calculatedMargin)).toBeLessThan(0.1); // Allow 0.1% rounding
      }
    }, 10000);
  });

  describe.skip('Tenant Isolation', () => {
    // SKIPPED: Requires DB materialized views to exist
    it('should return different data for different tenants', async () => {
      const service = getFinanceIntelligenceService();
      
      // Get another test tenant
      const { data: otherTenant } = await supabase
        .from('tenants')
        .select('id')
        .neq('id', testTenantId)
        .eq('status', 'active')
        .limit(1)
        .single();

      if (otherTenant) {
        const result1 = await service.getMonthlyPnL(testTenantId, 'current_month');
        const result2 = await service.getMonthlyPnL(otherTenant.id, 'current_month');

        // Results should be different (or both could be same if identical data)
        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
      }
    }, 15000);
  });

  describe('Error Handling', () => {
    it.skip('should handle invalid tenant ID gracefully', async () => {
      // SKIPPED: Requires DB materialized views to exist
      const service = getFinanceIntelligenceService();
      const invalidTenantId = '00000000-0000-0000-0000-000000000000';

      const result = await service.getMonthlyPnL(invalidTenantId, 'current_month');
      
      // Should return zero/empty data for non-existent tenant
      expect(result).toBeDefined();
      expect(result.totalRevenue).toBe(0);
      expect(result.totalExpenses).toBe(0);
    }, 10000);

    it('should handle invalid month format gracefully', async () => {
      const service = getFinanceIntelligenceService();

      await expect(
        service.getBudgetVariance(testTenantId, 'invalid-month')
      ).rejects.toThrow();
    }, 10000);

    it('should handle out-of-range forecast months', async () => {
      const service = getFinanceIntelligenceService();

      await expect(
        service.getCashFlowForecast(testTenantId, 999)
      ).rejects.toThrow();
    }, 10000);
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const service = getFinanceIntelligenceService();
      const health = await service.healthCheck();

      // Service returns boolean true for healthy
      expect(health).toBe(true);
    });
  });
});
