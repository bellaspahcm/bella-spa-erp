/**
 * @fileoverview CommissionProvider Edge Case Tests
 * 
 * Tests boundary conditions and edge cases.
 * 
 * Coverage:
 * - Zero commission (no sales)
 * - Boundary conditions (exactly at tier threshold)
 * - Manual adjustments (bonus/deduction)
 * 
 * Total: 3 edge case tests
 */

import { CommissionProvider } from '../commission-provider';
import type { CommissionDecisionInput } from '../types';

describe('CommissionProvider - Edge Cases', () => {
  let provider: CommissionProvider;

  beforeEach(() => {
    provider = new CommissionProvider({ debug: false });
  });

  it('should handle zero commission (no sales)', async () => {
    const input: CommissionDecisionInput = {
      tenantId: 'test-tenant',
      employeeId: 'ktv-001',
      monthYear: '2024-06',

      // NO SALES!
      serviceItems: [],
      productSales: [],

      totalSessions: 0,
      completedSessions: 0,
      avgRating: 0,

      positionTier: 'junior',

      config: {
        commissionStrategy: 'percentage',
        serviceCommissionRate: 10,
        productCommissionRate: 12,
      },
    };

    const result = await provider.evaluate(input);

    // All zero
    expect(result.baseCommission).toBe(0);
    expect(result.adjustedCommission).toBe(0);
    expect(result.totalCommission).toBe(0);

    // Standard tiers (default)
    expect(result.volumeTier).toBe('standard');
    expect(result.performanceTier).toBe('standard');

    // Multipliers at baseline
    expect(result.volumeMultiplier).toBe(1.0);
    expect(result.performanceMultiplier).toBe(1.0);
  });

  it('should handle boundary conditions (exactly at tier thresholds)', async () => {
    // Test exactly at volume tier boundary (30 sessions)
    const input1: CommissionDecisionInput = {
      tenantId: 'test-tenant',
      employeeId: 'ktv-001',
      monthYear: '2024-06',
      serviceItems: [{ subtotal: 1_000_000 }],
      productSales: [],
      totalSessions: 30, // Exactly at high tier threshold
      completedSessions: 30,
      avgRating: 4.0,
      positionTier: 'junior',
      config: {
        commissionStrategy: 'percentage',
        serviceCommissionRate: 10,
      },
    };

    const result1 = await provider.evaluate(input1);
    expect(result1.volumeTier).toBe('high'); // Should be high, not standard
    expect(result1.volumeMultiplier).toBe(1.1);

    // Test exactly at performance tier boundary (4.5 rating)
    const input2: CommissionDecisionInput = {
      ...input1,
      avgRating: 4.5, // Exactly at good tier threshold
    };

    const result2 = await provider.evaluate(input2);
    expect(result2.performanceTier).toBe('good'); // Should be good, not standard
    expect(result2.performanceMultiplier).toBe(1.05);

    // Test exactly at elite tier boundary (80 sessions)
    const input3: CommissionDecisionInput = {
      ...input1,
      totalSessions: 80, // Exactly at elite tier threshold
    };

    const result3 = await provider.evaluate(input3);
    expect(result3.volumeTier).toBe('elite');
    expect(result3.volumeMultiplier).toBe(1.3);

    // Test exactly at perfect tier boundary (4.95 rating)
    const input4: CommissionDecisionInput = {
      ...input1,
      avgRating: 4.95, // Exactly at perfect tier threshold
    };

    const result4 = await provider.evaluate(input4);
    expect(result4.performanceTier).toBe('perfect');
    expect(result4.performanceMultiplier).toBe(1.15);
  });

  it('should handle manual adjustments (bonus and deduction)', async () => {
    const input: CommissionDecisionInput = {
      tenantId: 'test-tenant',
      employeeId: 'ktv-001',
      monthYear: '2024-06',

      serviceItems: [{ subtotal: 1_000_000 }],
      productSales: [],

      totalSessions: 10,
      completedSessions: 10,
      avgRating: 4.0,

      positionTier: 'junior',

      // Manual adjustments
      manualAdjustments: [
        {
          adjustment_type: 'bonus',
          amount: 500_000,
          status: 'approved',
          reason: 'Exceptional performance',
        },
        {
          adjustment_type: 'bonus',
          amount: 200_000,
          status: 'approved',
          reason: 'Customer referral',
        },
        {
          adjustment_type: 'deduction',
          amount: 100_000,
          status: 'approved',
          reason: 'Late submission',
        },
        {
          adjustment_type: 'bonus',
          amount: 300_000,
          status: 'draft', // NOT approved!
        },
      ],

      config: {
        commissionStrategy: 'percentage',
        serviceCommissionRate: 10,
      },
    };

    const result = await provider.evaluate(input);

    // Base commission
    expect(result.baseCommission).toBe(100_000);

    // Manual adjustments (only approved)
    // 500k + 200k - 100k = 600k (draft ignored)
    expect(result.manualAdjustments).toBe(600_000);

    // Total includes adjustments
    expect(result.totalCommission).toBe(700_000); // 100k + 600k
  });
});
