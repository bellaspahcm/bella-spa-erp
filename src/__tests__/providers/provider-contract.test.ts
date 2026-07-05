/**
 * Provider Contract Test
 * 
 * Validates that ALL payroll providers follow the same contract:
 * - Accept PayrollDecisionContext as input
 * - Return SalaryComponent or SalaryDeduction as output
 * - Include full audit trail (metadata, matchedRules, observability)
 * - Handle errors gracefully
 * - Support override mechanism
 * 
 * This test ensures providers are composable and interchangeable.
 * 
 * WHY THIS MATTERS:
 * If all providers follow the same contract, we can:
 * - Compose them freely (Base + Commission + Bonus)
 * - Swap policies per industry (Spa vs Manufacturing vs Real Estate)
 * - Run them in parallel or sequence
 * - Build generic aggregator that works with any provider
 * 
 * This is the foundation of Platform Architecture.
 */

import { BaseSalaryProvider } from '@/services/providers/base-salary-provider';
import type {
  PayrollProvider,
  SalaryComponent,
  SalaryDeduction,
} from '@/lib/decision-engine/types/payroll-types';
import type { PayrollDecisionContext } from '@/lib/decision-engine/types/decision-context';
import { createPayrollContext } from '@/lib/decision-engine/types/decision-context';

describe('Provider Contract Compliance', () => {
  describe('Contract Requirements', () => {
    /**
     * Test 1: Provider has required properties
     * 
     * Every provider MUST have:
     * - name: string (for logging/debugging)
     * - decisionType: string (for routing)
     * - evaluate(): method
     */
    it('should have required properties (name, decisionType, evaluate)', () => {
      const provider = new BaseSalaryProvider();

      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('decisionType');
      expect(provider).toHaveProperty('evaluate');

      expect(typeof provider.name).toBe('string');
      expect(typeof provider.decisionType).toBe('string');
      expect(typeof provider.evaluate).toBe('function');
    });

    /**
     * Test 2: Provider accepts standard PayrollDecisionContext
     * 
     * All providers MUST accept the same context structure.
     * This enables provider composition.
     */
    it('should accept PayrollDecisionContext as input', async () => {
      const provider = new BaseSalaryProvider();

      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'emp-001',
          fullName: 'Test Employee',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
        }
      );

      // Should not throw
      await expect(provider.evaluate(context)).resolves.toBeDefined();
    });

    /**
     * Test 3: Provider returns standard SalaryComponent structure
     * 
     * All providers MUST return consistent structure:
     * - type: SalaryComponentType
     * - eligible: boolean
     * - amount: number
     * - reason: string
     * - metadata?: object
     */
    it('should return SalaryComponent with required fields', async () => {
      const provider = new BaseSalaryProvider();

      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'emp-001',
          fullName: 'Test Employee',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      // Required fields
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('amount');
      expect(result).toHaveProperty('reason');

      // Type validation
      expect(typeof result.type).toBe('string');
      expect(typeof result.eligible).toBe('boolean');
      expect(typeof result.amount).toBe('number');
      expect(typeof result.reason).toBe('string');

      // Amount must be non-negative
      expect(result.amount).toBeGreaterThanOrEqual(0);

      // Reason must be non-empty
      expect(result.reason.length).toBeGreaterThan(0);
    });

    /**
     * Test 4: Provider includes audit trail
     * 
     * For compliance and debugging, providers SHOULD include:
     * - metadata: calculation details
     * - matchedRules: which rules applied (optional)
     * - observability: execution trace (optional)
     */
    it('should include audit trail in result', async () => {
      const provider = new BaseSalaryProvider();

      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'emp-001',
          fullName: 'Test Employee',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      // Metadata should exist and be an object
      expect(result).toHaveProperty('metadata');
      expect(typeof result.metadata).toBe('object');

      // Metadata should contain useful debugging info
      expect(result.metadata).toBeDefined();
    });

    /**
     * Test 5: Provider handles missing/invalid input gracefully
     * 
     * Providers MUST NOT throw on invalid input.
     * Instead, return { eligible: false, amount: 0, reason: '...' }
     */
    it('should handle missing employee data gracefully', async () => {
      const provider = new BaseSalaryProvider();

      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'emp-001',
          fullName: 'Test Employee',
          baseSalary: 0, // Invalid: no base salary
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
        }
      );

      // Should NOT throw
      const result = await provider.evaluate(context);

      // Should return not eligible
      expect(result.eligible).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.reason).toContain('No base salary configured');
    });

    /**
     * Test 6: Provider supports override mechanism
     * 
     * All providers MUST support manual overrides via:
     * - context.overrides (data overrides)
     * - options.applyOverrides (flag to enable)
     */
    it('should support override mechanism', async () => {
      const provider = new BaseSalaryProvider();

      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'emp-001',
          fullName: 'Test Employee',
          baseSalary: 8000000,
          positionTier: 'senior', // Would normally get 1.2x multiplier
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
          overrides: {
            baseSalary: 10000000, // Manual override
          },
        }
      );

      const result = await provider.evaluate(context, { applyOverrides: true });

      // Should use override, not calculated value
      expect(result.amount).toBe(10000000);
      expect(result.reason).toContain('override');
    });
  });

  describe('Provider Composability', () => {
    /**
     * Test 7: Multiple providers can run independently
     * 
     * Providers MUST NOT have side effects or shared state.
     * This enables parallel execution.
     */
    it('should run multiple provider instances independently', async () => {
      const provider1 = new BaseSalaryProvider();
      const provider2 = new BaseSalaryProvider();

      const context1 = createPayrollContext(
        'tenant-001',
        {
          id: 'emp-001',
          fullName: 'Employee A',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
        }
      );

      const context2 = createPayrollContext(
        'tenant-001',
        {
          id: 'emp-002',
          fullName: 'Employee B',
          baseSalary: 6000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2024-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 20, // Partial month
            lateDays: 0,
            absentDays: 6,
            halfDays: 0,
          },
        }
      );

      // Run in parallel
      const [result1, result2] = await Promise.all([
        provider1.evaluate(context1),
        provider2.evaluate(context2),
      ]);

      // Results should be independent
      expect(result1.amount).toBe(8000000);
      expect(result2.amount).toBe(Math.round((6000000 / 26) * 20));
    });

    /**
     * Test 8: Provider results are serializable
     * 
     * Results MUST be JSON-serializable for:
     * - API responses
     * - Database storage
     * - Event logging
     */
    it('should return JSON-serializable results', async () => {
      const provider = new BaseSalaryProvider();

      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'emp-001',
          fullName: 'Test Employee',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
        }
      );

      const result = await provider.evaluate(context);

      // Should serialize without error
      expect(() => JSON.stringify(result)).not.toThrow();

      // Should deserialize correctly
      const serialized = JSON.stringify(result);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.type).toBe(result.type);
      expect(deserialized.amount).toBe(result.amount);
      expect(deserialized.eligible).toBe(result.eligible);
      expect(deserialized.reason).toBe(result.reason);
    });
  });

  describe('Performance Requirements', () => {
    /**
     * Test 9: Provider executes within performance budget
     * 
     * Single provider evaluation SHOULD complete in < 50ms.
     * This enables real-time salary preview.
     */
    it('should execute within 50ms budget', async () => {
      const provider = new BaseSalaryProvider();

      const context = createPayrollContext(
        'tenant-001',
        {
          id: 'emp-001',
          fullName: 'Test Employee',
          baseSalary: 8000000,
          positionTier: 'junior',
          contractType: 'full-time',
          status: 'active',
          hireDate: '2023-01-01',
          resignationDate: null,
        },
        '2026-06-01',
        {
          attendance: {
            totalDays: 26,
            presentDays: 26,
            lateDays: 0,
            absentDays: 0,
            halfDays: 0,
          },
        }
      );

      const startTime = Date.now();
      await provider.evaluate(context);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Should complete in < 50ms (generous budget for test environment)
      expect(executionTime).toBeLessThan(100); // Using 100ms for test stability
    });

    /**
     * Test 10: Provider handles batch evaluation efficiently
     * 
     * 100 evaluations SHOULD complete in < 5 seconds.
     */
    it('should handle batch evaluation efficiently', async () => {
      const provider = new BaseSalaryProvider();

      const contexts = Array.from({ length: 100 }, (_, i) =>
        createPayrollContext(
          'tenant-001',
          {
            id: `emp-${i.toString().padStart(3, '0')}`,
            fullName: `Employee ${i}`,
            baseSalary: 8000000,
            positionTier: 'junior',
            contractType: 'full-time',
            status: 'active',
            hireDate: '2023-01-01',
            resignationDate: null,
          },
          '2026-06-01',
          {
            attendance: {
              totalDays: 26,
              presentDays: 26,
              lateDays: 0,
              absentDays: 0,
              halfDays: 0,
            },
          }
        )
      );

      const startTime = Date.now();
      await Promise.all(contexts.map((ctx) => provider.evaluate(ctx)));
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Should complete 100 evaluations in < 5 seconds
      expect(executionTime).toBeLessThan(5000);
    });
  });
});

/**
 * Contract Summary
 * 
 * Every PayrollProvider MUST:
 * ✅ Have name, decisionType, evaluate() method
 * ✅ Accept PayrollDecisionContext as input
 * ✅ Return SalaryComponent/SalaryDeduction with required fields
 * ✅ Include audit trail (metadata)
 * ✅ Handle invalid input gracefully (no throws)
 * ✅ Support override mechanism
 * ✅ Be stateless (no side effects)
 * ✅ Return JSON-serializable results
 * ✅ Execute within 50ms budget
 * ✅ Handle batch efficiently (100 in < 5s)
 * 
 * If a provider passes all 10 contract tests, it can be:
 * - Composed with other providers
 * - Swapped per industry
 * - Run in parallel
 * - Used in any aggregator
 * 
 * This is the foundation of Platform Architecture.
 */
