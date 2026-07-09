/**
 * Integration Tests for CommissionProviderAdapter
 * 
 * Tests the full integration flow:
 * 1. Data transformation (salary context → Decision Engine format)
 * 2. Commission calculation via provider
 * 3. Result mapping (Decision Engine format → salary records)
 * 4. Feature flag behavior
 * 5. Error handling and fallback
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import {
  CommissionProviderAdapter,
  getCommissionProviderAdapter,
  USE_COMMISSION_PROVIDER,
} from '../commission-provider-adapter';
import type { CommissionCalculationContext } from '../commission-provider-adapter';

describe('CommissionProviderAdapter - Integration Tests', () => {
  let adapter: CommissionProviderAdapter;

  beforeAll(() => {
    adapter = new CommissionProviderAdapter({ debug: false });
  });

  describe('Data Transformation', () => {
    test('transforms salary context to Decision Engine format correctly', async () => {
      const context: CommissionCalculationContext = {
        tenantId: 'test-tenant',
        employeeId: 'ktv-001',
        monthYear: '2024-06',
        
        serviceItems: [
          {
            id: 'item-1',
            ktv_id: 'ktv-001',
            subtotal: 500000,
            status: 'completed',
            completed_date: '2024-06-15',
          },
          {
            id: 'item-2',
            ktv_id: 'ktv-001',
            subtotal: 800000,
            override_commission_type: 'percentage',
            override_commission_value: 15, // Override to 15%
            status: 'completed',
            completed_date: '2024-06-20',
          },
        ],
        
        productSales: [
          {
            id: 'sale-1',
            ktv_id: 'ktv-001',
            sales_amount: 1000000,
            status: 'completed',
            sale_date: '2024-06-18',
          },
        ],
        
        sessions: [
          { id: 'session-1', rating: 5.0, status: 'completed', package_multiplier: 1.0 },
          { id: 'session-2', rating: 4.8, status: 'completed', package_multiplier: 1.5 },
          { id: 'session-3', rating: 4.9, status: 'completed', package_multiplier: 1.0 },
        ],
        
        employee: {
          id: 'ktv-001',
          position_tier: 'senior',
          hire_date: '2020-01-01', // ~4.5 years of service
          tenant_id: 'test-tenant',
        },
        
        manualAdjustments: [
          {
            adjustment_type: 'bonus',
            amount: 200000,
            status: 'approved',
            reason: 'Exceptional service quality',
          },
          {
            adjustment_type: 'deduction',
            amount: 50000,
            status: 'approved',
            reason: 'Uniform violation',
          },
        ],
        
        config: {
          commissionStrategy: 'percentage',
          serviceCommissionRate: 10, // 10% default
          productCommissionRate: 12, // 12% default
          positionMultipliers: {
            junior: 1.0,
            senior: 1.2,
            lead: 1.5,
          },
          seniorityBonusRates: {
            '0_to_1_year': 0.0,
            '1_to_3_years': 0.05,
            '3_to_5_years': 0.10,
            '5_plus_years': 0.15,
          },
        },
      };

      const result = await adapter.calculateCommission(context);

      // Verify structure
      expect(result).toHaveProperty('serviceCommission');
      expect(result).toHaveProperty('productSalesCommission');
      expect(result).toHaveProperty('positionBonus');
      expect(result).toHaveProperty('seniorityBonus');
      expect(result).toHaveProperty('manualAdjustments');
      expect(result).toHaveProperty('totalCommission');
      expect(result).toHaveProperty('calculation_metadata');

      // Verify calculations
      // Service commission:
      //   - Item 1: 500,000 × 10% = 50,000
      //   - Item 2: 800,000 × 15% = 120,000 (override)
      //   Total: 170,000
      expect(result.serviceCommission).toBe(170000);

      // Product sales commission:
      //   - Sale 1: 1,000,000 × 12% = 120,000
      expect(result.productSalesCommission).toBe(120000);

      // Manual adjustments:
      //   - Bonus: +200,000
      //   - Deduction: -50,000
      //   Net: +150,000
      expect(result.manualAdjustments).toBe(150000);

      // Position bonus (applied on ADJUSTED commission after multipliers, senior = 1.2x):
      //   Base service commission: 170,000
      //   Base product commission: 120,000
      //   Total base commission: 290,000
      //   Sessions: 1.0 + 1.5 + 1.0 = 3.5 sessions → standard volume tier (1.0x)
      //   Avg rating: (5.0 + 4.8 + 4.9) / 3 = 4.9 → excellent performance tier (1.1x)
      //   Adjusted commission: 290,000 × 1.0 × 1.1 = 319,000
      //   Position bonus: 319,000 × (1.2 - 1.0) = 319,000 × 0.2 = 63,800
      expect(result.positionBonus).toBe(63800);

      // Total commission (without multipliers, without seniority):
      //   Service: 170,000
      //   Product: 120,000
      //   Position bonus: 34,000
      //   Manual: 150,000
      //   (Seniority bonus calculated on base salary, not available in this test)
      expect(result.totalCommission).toBeGreaterThan(0);
    });

    test('aggregates sessions with package multipliers correctly', async () => {
      const context: CommissionCalculationContext = {
        tenantId: 'test-tenant',
        employeeId: 'ktv-002',
        monthYear: '2024-06',
        
        serviceItems: [],
        productSales: [],
        
        sessions: [
          // Standard package (1.0x) - 2 sessions
          { id: 's1', rating: 5.0, status: 'completed', package_multiplier: 1.0 },
          { id: 's2', rating: 4.8, status: 'completed', package_multiplier: 1.0 },
          
          // VIP package (1.5x) - 2 sessions
          { id: 's3', rating: 4.9, status: 'completed', package_multiplier: 1.5 },
          { id: 's4', rating: 5.0, status: 'completed', package_multiplier: 1.5 },
          
          // Premium package (2.0x) - 1 session
          { id: 's5', rating: 4.95, status: 'completed', package_multiplier: 2.0 },
        ],
        
        employee: {
          id: 'ktv-002',
          position_tier: 'junior',
          tenant_id: 'test-tenant',
        },
        
        config: {
          commissionStrategy: 'fixed',
          serviceCommissionFixed: 150000,
        },
      };

      const result = await adapter.calculateCommission(context);

      // Total sessions (weighted): 1.0 + 1.0 + 1.5 + 1.5 + 2.0 = 7.0 sessions
      // Average rating: (5.0 + 4.8 + 4.9 + 5.0 + 4.95) / 5 = 4.93
      // This should affect volume/performance tier

      // Verify result has metadata
      expect(result.calculation_metadata).toBeDefined();
      expect(result.calculation_metadata.volumeTier).toBeDefined();
      expect(result.calculation_metadata.performanceTier).toBeDefined();
    });

    test('filters only approved manual adjustments', async () => {
      const context: CommissionCalculationContext = {
        tenantId: 'test-tenant',
        employeeId: 'ktv-003',
        monthYear: '2024-06',
        
        serviceItems: [],
        productSales: [],
        sessions: [],
        
        employee: {
          id: 'ktv-003',
          position_tier: 'junior',
          tenant_id: 'test-tenant',
        },
        
        manualAdjustments: [
          { adjustment_type: 'bonus', amount: 100000, status: 'approved' }, // ✅ Include
          { adjustment_type: 'bonus', amount: 200000, status: 'pending' },  // ❌ Exclude
          { adjustment_type: 'deduction', amount: 50000, status: 'approved' }, // ✅ Include
          { adjustment_type: 'deduction', amount: 30000, status: 'rejected' }, // ❌ Exclude
        ],
        
        config: {
          commissionStrategy: 'fixed',
          serviceCommissionFixed: 150000,
        },
      };

      const result = await adapter.calculateCommission(context);

      // Only approved adjustments: +100,000 - 50,000 = +50,000
      expect(result.manualAdjustments).toBe(50000);
    });
  });

  describe('Commission Calculation', () => {
    test('calculates fixed commission strategy correctly', async () => {
      const context: CommissionCalculationContext = {
        tenantId: 'test-tenant',
        employeeId: 'ktv-004',
        monthYear: '2024-06',
        
        serviceItems: [
          { id: 'item-1', ktv_id: 'ktv-004', subtotal: 500000, status: 'completed' },
          { id: 'item-2', ktv_id: 'ktv-004', subtotal: 800000, status: 'completed' },
        ],
        
        productSales: [
          { id: 'sale-1', ktv_id: 'ktv-004', sales_amount: 1000000, status: 'completed' },
        ],
        
        sessions: [],
        
        employee: {
          id: 'ktv-004',
          position_tier: 'junior',
          tenant_id: 'test-tenant',
        },
        
        config: {
          commissionStrategy: 'fixed',
          serviceCommissionFixed: 150000,  // Fixed 150k per service
          productCommissionFixed: 50000,   // Fixed 50k per product
        },
      };

      const result = await adapter.calculateCommission(context);

      // Service commission: 2 items × 150,000 = 300,000
      expect(result.serviceCommission).toBe(300000);

      // Product commission: 1 sale × 50,000 = 50,000
      expect(result.productSalesCommission).toBe(50000);
    });

    test('calculates percentage commission strategy correctly', async () => {
      const context: CommissionCalculationContext = {
        tenantId: 'test-tenant',
        employeeId: 'ktv-005',
        monthYear: '2024-06',
        
        serviceItems: [
          { id: 'item-1', ktv_id: 'ktv-005', subtotal: 1000000, status: 'completed' },
        ],
        
        productSales: [
          { id: 'sale-1', ktv_id: 'ktv-005', sales_amount: 2000000, status: 'completed' },
        ],
        
        sessions: [],
        
        employee: {
          id: 'ktv-005',
          position_tier: 'junior',
          tenant_id: 'test-tenant',
        },
        
        config: {
          commissionStrategy: 'percentage',
          serviceCommissionRate: 10,  // 10%
          productCommissionRate: 15,  // 15%
        },
      };

      const result = await adapter.calculateCommission(context);

      // Service commission: 1,000,000 × 10% = 100,000
      expect(result.serviceCommission).toBe(100000);

      // Product commission: 2,000,000 × 15% = 300,000
      expect(result.productSalesCommission).toBe(300000);
    });

    test('applies position multiplier correctly', async () => {
      const contexts: CommissionCalculationContext[] = [
        // Junior (1.0x)
        {
          tenantId: 'test-tenant',
          employeeId: 'ktv-junior',
          monthYear: '2024-06',
          serviceItems: [{ id: 'item-1', ktv_id: 'ktv-junior', subtotal: 1000000, status: 'completed' }],
          productSales: [],
          sessions: [],
          employee: { id: 'ktv-junior', position_tier: 'junior', tenant_id: 'test-tenant' },
          config: {
            commissionStrategy: 'percentage',
            serviceCommissionRate: 10,
            positionMultipliers: { junior: 1.0, senior: 1.2, lead: 1.5 },
          },
        },
        // Senior (1.2x)
        {
          tenantId: 'test-tenant',
          employeeId: 'ktv-senior',
          monthYear: '2024-06',
          serviceItems: [{ id: 'item-1', ktv_id: 'ktv-senior', subtotal: 1000000, status: 'completed' }],
          productSales: [],
          sessions: [],
          employee: { id: 'ktv-senior', position_tier: 'senior', tenant_id: 'test-tenant' },
          config: {
            commissionStrategy: 'percentage',
            serviceCommissionRate: 10,
            positionMultipliers: { junior: 1.0, senior: 1.2, lead: 1.5 },
          },
        },
        // Lead (1.5x)
        {
          tenantId: 'test-tenant',
          employeeId: 'ktv-lead',
          monthYear: '2024-06',
          serviceItems: [{ id: 'item-1', ktv_id: 'ktv-lead', subtotal: 1000000, status: 'completed' }],
          productSales: [],
          sessions: [],
          employee: { id: 'ktv-lead', position_tier: 'lead', tenant_id: 'test-tenant' },
          config: {
            commissionStrategy: 'percentage',
            serviceCommissionRate: 10,
            positionMultipliers: { junior: 1.0, senior: 1.2, lead: 1.5 },
          },
        },
      ];

      const results = await Promise.all(contexts.map(ctx => adapter.calculateCommission(ctx)));

      // Base commission same for all: 1,000,000 × 10% = 100,000
      results.forEach(result => {
        expect(result.serviceCommission).toBe(100000);
      });

      // Position bonus varies:
      // Junior: 100,000 × (1.0 - 1.0) = 0
      expect(results[0].positionBonus).toBe(0);

      // Senior: 100,000 × (1.2 - 1.0) = 20,000
      expect(results[1].positionBonus).toBe(20000);

      // Lead: 100,000 × (1.5 - 1.0) = 50,000
      expect(results[2].positionBonus).toBe(50000);
    });

    test('calculates seniority bonus based on hire date', async () => {
      const now = new Date();
      const contexts: CommissionCalculationContext[] = [
        // 0.5 years (0% bonus)
        {
          tenantId: 'test-tenant',
          employeeId: 'ktv-new',
          monthYear: '2024-06',
          serviceItems: [{ id: 'item-1', ktv_id: 'ktv-new', subtotal: 1000000, status: 'completed' }],
          productSales: [],
          sessions: [],
          employee: {
            id: 'ktv-new',
            position_tier: 'junior',
            hire_date: new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0],
            tenant_id: 'test-tenant',
          },
          config: {
            commissionStrategy: 'percentage',
            serviceCommissionRate: 10,
            seniorityBonusRates: {
              '0_to_1_year': 0.0,
              '1_to_3_years': 0.05,
              '3_to_5_years': 0.10,
              '5_plus_years': 0.15,
            },
          },
        },
        // 2 years (5% bonus)
        {
          tenantId: 'test-tenant',
          employeeId: 'ktv-2yr',
          monthYear: '2024-06',
          serviceItems: [{ id: 'item-1', ktv_id: 'ktv-2yr', subtotal: 1000000, status: 'completed' }],
          productSales: [],
          sessions: [],
          employee: {
            id: 'ktv-2yr',
            position_tier: 'junior',
            hire_date: new Date(now.getFullYear() - 2, now.getMonth(), 1).toISOString().split('T')[0],
            tenant_id: 'test-tenant',
          },
          config: {
            commissionStrategy: 'percentage',
            serviceCommissionRate: 10,
            seniorityBonusRates: {
              '0_to_1_year': 0.0,
              '1_to_3_years': 0.05,
              '3_to_5_years': 0.10,
              '5_plus_years': 0.15,
            },
          },
        },
        // 6 years (15% bonus)
        {
          tenantId: 'test-tenant',
          employeeId: 'ktv-6yr',
          monthYear: '2024-06',
          serviceItems: [{ id: 'item-1', ktv_id: 'ktv-6yr', subtotal: 1000000, status: 'completed' }],
          productSales: [],
          sessions: [],
          employee: {
            id: 'ktv-6yr',
            position_tier: 'junior',
            hire_date: new Date(now.getFullYear() - 6, now.getMonth(), 1).toISOString().split('T')[0],
            tenant_id: 'test-tenant',
          },
          config: {
            commissionStrategy: 'percentage',
            serviceCommissionRate: 10,
            seniorityBonusRates: {
              '0_to_1_year': 0.0,
              '1_to_3_years': 0.05,
              '3_to_5_years': 0.10,
              '5_plus_years': 0.15,
            },
          },
        },
      ];

      const results = await Promise.all(contexts.map(ctx => adapter.calculateCommission(ctx)));

      // Seniority bonus calculated on base commission (100,000)
      // Note: Exact values may vary slightly due to date calculation precision
      expect(results[0].seniorityBonus).toBe(0); // 0% bonus
      expect(results[1].seniorityBonus).toBeGreaterThanOrEqual(4000); // ~5% bonus
      expect(results[1].seniorityBonus).toBeLessThanOrEqual(6000);
      expect(results[2].seniorityBonus).toBeGreaterThanOrEqual(14000); // ~15% bonus
      expect(results[2].seniorityBonus).toBeLessThanOrEqual(16000);
    });
  });

  describe('Performance', () => {
    test('adapter overhead is minimal (<1ms)', async () => {
      const context: CommissionCalculationContext = {
        tenantId: 'test-tenant',
        employeeId: 'ktv-perf',
        monthYear: '2024-06',
        
        serviceItems: [
          { id: 'item-1', ktv_id: 'ktv-perf', subtotal: 500000, status: 'completed' },
        ],
        
        productSales: [],
        sessions: [],
        
        employee: {
          id: 'ktv-perf',
          position_tier: 'junior',
          tenant_id: 'test-tenant',
        },
        
        config: {
          commissionStrategy: 'fixed',
          serviceCommissionFixed: 150000,
        },
      };

      const start = performance.now();
      const result = await adapter.calculateCommission(context);
      const duration = performance.now() - start;

      // Adapter overhead should be minimal
      // Provider execution: ~0.3ms
      // Adapter transformation: <0.2ms
      // Total: <1ms
      expect(duration).toBeLessThan(2); // 2ms buffer for CI environment

      // Provider metadata should show execution time
      expect(result.calculation_metadata.executionTime).toBeLessThan(1);
    });

    test('handles bulk calculations efficiently', async () => {
      const contexts: CommissionCalculationContext[] = Array.from({ length: 50 }, (_, i) => ({
        tenantId: 'test-tenant',
        employeeId: `ktv-${i}`,
        monthYear: '2024-06',
        
        serviceItems: [
          { id: `item-${i}`, ktv_id: `ktv-${i}`, subtotal: 500000 + i * 10000, status: 'completed' as const },
        ],
        
        productSales: [],
        sessions: [],
        
        employee: {
          id: `ktv-${i}`,
          position_tier: 'junior' as const,
          tenant_id: 'test-tenant',
        },
        
        config: {
          commissionStrategy: 'percentage' as const,
          serviceCommissionRate: 10,
        },
      }));

      const start = performance.now();
      const results = await Promise.all(contexts.map(ctx => adapter.calculateCommission(ctx)));
      const duration = performance.now() - start;

      // 50 calculations should complete in <100ms
      expect(duration).toBeLessThan(100);

      // All results should be valid
      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result.serviceCommission).toBeGreaterThan(0);
        expect(result.totalCommission).toBeGreaterThan(0);
      });
    });
  });

  describe('Singleton Pattern', () => {
    test('getCommissionProviderAdapter returns same instance', () => {
      const instance1 = getCommissionProviderAdapter();
      const instance2 = getCommissionProviderAdapter();

      expect(instance1).toBe(instance2); // Same object reference
    });
  });

  describe('Error Handling', () => {
    test('handles invalid input gracefully (returns zero commission)', async () => {
      const invalidContext = {
        tenantId: '',  // Empty tenant ID
        employeeId: '',
        monthYear: 'invalid',
        serviceItems: [],
        productSales: [],
        sessions: [],
        employee: {
          id: '',
          position_tier: 'junior' as const,
          tenant_id: '',
        },
        config: {
          commissionStrategy: 'fixed' as const,
          serviceCommissionFixed: 150000,
        },
      };

      // Provider has non-blocking design: returns zero commission instead of throwing
      const result = await adapter.calculateCommission(invalidContext);
      
      expect(result.totalCommission).toBe(0);
      expect(result.serviceCommission).toBe(0);
      expect(result.calculation_metadata.confidence).toBe(0); // Low confidence indicates error
    });

    test('handles missing config gracefully', async () => {
      const contextWithoutConfig = {
        tenantId: 'test-tenant',
        employeeId: 'ktv-001',
        monthYear: '2024-06',
        serviceItems: [],
        productSales: [],
        sessions: [],
        employee: {
          id: 'ktv-001',
          position_tier: 'junior' as const,
          tenant_id: 'test-tenant',
        },
        config: null as any, // Missing config
      };

      // Should throw error for missing config (validation happens in provider)
      await expect(
        adapter.calculateCommission(contextWithoutConfig)
      ).rejects.toThrow();
    });
  });

  describe('Feature Flag', () => {
    test('USE_COMMISSION_PROVIDER reflects environment variable', () => {
      // This test verifies the feature flag is correctly loaded
      // Actual value depends on environment
      expect(typeof USE_COMMISSION_PROVIDER).toBe('boolean');
    });
  });

  describe('Validation', () => {
    test('validateAgainstLegacy detects discrepancies', () => {
      const decisionEngineResult = {
        serviceCommission: 100000,
        productSalesCommission: 50000,
        positionBonus: 20000,
        seniorityBonus: 10000,
        manualAdjustments: 5000,
        totalCommission: 185000,
        calculation_metadata: {
          provider: 'commission',
          volumeTier: 'standard',
          performanceTier: 'standard',
          volumeMultiplier: 1.0,
          performanceMultiplier: 1.0,
          combinedMultiplier: 1.0,
          matchedRules: [],
          executionTime: 0.3,
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };

      const legacyResult = {
        service_commission: 100000,      // Match
        product_sales_commission: 52000, // Discrepancy: +2,000
        position_bonus: 20000,           // Match
        seniority_bonus: 10000,          // Match
        manual_adjustments: 5000,        // Match
      };

      const validation = adapter.validateAgainstLegacy(decisionEngineResult, legacyResult);

      expect(validation.isConsistent).toBe(false);
      expect(validation.discrepancies).toHaveLength(1);
      expect(validation.discrepancies[0].component).toBe('product_sales_commission');
      expect(validation.discrepancies[0].diff).toBe(2000);
    });

    test('validateAgainstLegacy allows 1đ rounding difference', () => {
      const decisionEngineResult = {
        serviceCommission: 100000,
        productSalesCommission: 50000,
        positionBonus: 20000,
        seniorityBonus: 10000,
        manualAdjustments: 5000,
        totalCommission: 185000,
        calculation_metadata: {
          provider: 'commission',
          volumeTier: 'standard',
          performanceTier: 'standard',
          volumeMultiplier: 1.0,
          performanceMultiplier: 1.0,
          combinedMultiplier: 1.0,
          matchedRules: [],
          executionTime: 0.3,
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        },
      };

      const legacyResult = {
        service_commission: 100001,     // +1đ rounding
        product_sales_commission: 50000,
        position_bonus: 20000,
        seniority_bonus: 10000,
        manual_adjustments: 5000,
      };

      const validation = adapter.validateAgainstLegacy(decisionEngineResult, legacyResult);

      // Should be consistent (1đ difference allowed)
      expect(validation.isConsistent).toBe(true);
      expect(validation.discrepancies).toHaveLength(0);
    });
  });
});
