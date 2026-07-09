/**
 * @fileoverview CommissionProvider Performance Tests
 * 
 * Tests execution speed and throughput.
 * 
 * Targets:
 * - Single evaluation: <2ms
 * - Bulk evaluation (100): <200ms (avg <2ms)
 * 
 * Total: 2 performance tests
 */

import { CommissionProvider } from '../commission-provider';
import type { CommissionDecisionInput } from '../types';

describe('CommissionProvider - Performance Tests', () => {
  let provider: CommissionProvider;

  beforeEach(() => {
    provider = new CommissionProvider({ debug: false });
  });

  it('should evaluate single commission in <2ms', async () => {
    const input: CommissionDecisionInput = {
      tenantId: 'test-tenant',
      employeeId: 'ktv-001',
      monthYear: '2024-06',

      serviceItems: [
        { subtotal: 500_000 },
        { subtotal: 600_000 },
        { subtotal: 450_000 },
      ],
      productSales: [
        { salesAmount: 1_000_000 },
        { salesAmount: 1_500_000 },
      ],

      totalSessions: 35,
      completedSessions: 35,
      avgRating: 4.6,

      positionTier: 'senior',
      hireDate: new Date('2022-01-01'),

      config: {
        commissionStrategy: 'percentage',
        serviceCommissionRate: 10,
        productCommissionRate: 12,
      },
    };

    const result = await provider.evaluate(input);

    // Check execution time
    expect(result.executionTimeMs).toBeLessThan(2);
    expect(result.executionTimeMs).toBeGreaterThan(0);

    console.log(`Single evaluation: ${result.executionTimeMs.toFixed(2)}ms`);
  });

  it('should evaluate 100 commissions in <200ms (bulk)', async () => {
    const createInput = (index: number): CommissionDecisionInput => ({
      tenantId: 'test-tenant',
      employeeId: `ktv-${index}`,
      monthYear: '2024-06',

      serviceItems: Array.from({ length: 5 }, (_, i) => ({
        subtotal: 500_000 + i * 100_000,
      })),
      productSales: Array.from({ length: 2 }, (_, i) => ({
        salesAmount: 1_000_000 + i * 500_000,
      })),

      totalSessions: 30 + (index % 50),
      completedSessions: 30 + (index % 50),
      avgRating: 4.0 + (index % 10) / 10,

      positionTier: ['junior', 'senior', 'lead'][index % 3] as any,
      hireDate: new Date(2020 + (index % 5), 0, 1),

      config: {
        commissionStrategy: 'percentage',
        serviceCommissionRate: 10,
        productCommissionRate: 12,
      },
    });

    const startTime = performance.now();
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) => provider.evaluate(createInput(i)))
    );
    const endTime = performance.now();

    const totalTime = endTime - startTime;
    const avgTime = totalTime / 100;

    console.log(`Bulk evaluation (100):`);
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Average time: ${avgTime.toFixed(2)}ms`);
    console.log(`  Throughput: ${(1000 / avgTime).toFixed(0)} evaluations/second`);

    // Check total time
    expect(totalTime).toBeLessThan(200);

    // Check average time
    expect(avgTime).toBeLessThan(2);

    // All evaluations succeeded
    expect(results).toHaveLength(100);
    expect(results.every((r) => r.totalCommission > 0)).toBe(true);
  });
});
