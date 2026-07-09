/**
 * Payroll Provider - Integration Tests
 * 
 * Tests complete end-to-end salary calculation with multiple components enabled.
 * Verifies rule evaluation, component aggregation, and metadata generation.
 * 
 * Test Coverage:
 * 1. Full Salary Calculation (4 tests)
 * 
 * Total: 4 Integration Tests (Simplified for verification)
 */

import { PayrollProvider } from '../payroll-provider';
import type { PayrollDecisionInput } from '../types';

describe('PayrollProvider - Integration Tests', () => {
  let provider: PayrollProvider;

  beforeEach(() => {
    provider = new PayrollProvider();
  });

  // ===============================================
  // Category 1: Full Salary Calculation (4 tests)
  // ===============================================
  describe('Full Salary Calculation', () => {
    it('should calculate complete salary with all bonuses (standard employee)', async () => {
      const input: PayrollDecisionInput = {
        tenantId: 'bella-spa-vn',
        employeeId: 'emp-standard',
        monthYear: '2026-07',
        sessions: {
          count: 35,
          avgRating: 4.8,
          totalRevenue: 18000000,
        },
        attendance: {
          lateDays: 2,
          absentDays: 0,
          workingDays: 26,
        },
        employee: {
          baseSalary: 8000000,
        },
        config: {
          kpi: {
            enabled: true,
            strategy: 'threshold',
            params: { target: 30, bonus: 1000000 },
          },
          attendance: {
            enabled: true,
            strategy: 'combined',
            params: { latePenalty: 50000, absentPenalty: 200000 },
          },
          rating: {
            enabled: true,
            strategy: 'threshold',
            params: { minRating: 4.5, bonus: 50000 },
          },
          commission: {
            enabled: true,
            strategy: 'fixed',
            params: { rate: 120000 },
          },
        },
      };

      const result = await provider.evaluate(input);

      // Expected:
      // KPI: 1,000,000 (35 >= 30)
      // Attendance: -100,000 (2 late * 50,000)
      // Rating: 50,000 (4.8 >= 4.5)
      // Commission: 4,200,000 (35 * 120,000)
      // Total bonuses: 5,250,000
      // Total deductions: 100,000
      // Net: 5,150,000

      expect(result.eligible).toBe(true);
      expect(result.components.kpiBonus.amount).toBe(1000000);
      expect(result.components.attendanceDeduction.amount).toBe(-100000);
      expect(result.components.ratingBonus.amount).toBe(50000);
      expect(result.components.sessionCommission.amount).toBe(4200000);
      expect(result.totalBonuses).toBe(5250000);
      expect(result.totalDeductions).toBe(100000);
      expect(result.netAdjustment).toBe(5150000);
      expect(result.provider).toBe('PayrollProvider');
      expect(result.matchedRules.length).toBeGreaterThan(0);
    });

    it('should calculate complete salary with mixed performance (below target)', async () => {
      const input: PayrollDecisionInput = {
        tenantId: 'bella-spa-vn',
        employeeId: 'emp-below-target',
        monthYear: '2026-07',
        sessions: {
          count: 20,
          avgRating: 4.2,
          totalRevenue: 10000000,
        },
        attendance: {
          lateDays: 1,
          absentDays: 3,
          workingDays: 22,
        },
        employee: {
          baseSalary: 8000000,
        },
        config: {
          kpi: {
            enabled: true,
            strategy: 'threshold',
            params: { target: 30, bonus: 1000000 },
          },
          attendance: {
            enabled: true,
            strategy: 'combined',
            params: { latePenalty: 50000, absentPenalty: 200000 },
          },
          rating: {
            enabled: true,
            strategy: 'threshold',
            params: { minRating: 4.5, bonus: 50000 },
          },
          commission: {
            enabled: true,
            strategy: 'fixed',
            params: { rate: 120000 },
          },
        },
      };

      const result = await provider.evaluate(input);

      // Expected:
      // KPI: 0 (20 < 30)
      // Attendance: -650,000 (1 late * 50,000 + 3 absent * 200,000)
      // Rating: 0 (4.2 < 4.5)
      // Commission: 2,400,000 (20 * 120,000)
      // Net: 2,400,000 - 650,000 = 1,750,000

      expect(result.components.kpiBonus.amount).toBe(0);
      expect(result.components.attendanceDeduction.amount).toBe(-650000);
      expect(result.components.ratingBonus.amount).toBe(0);
      expect(result.components.sessionCommission.amount).toBe(2400000);
      expect(result.totalBonuses).toBe(2400000);
      expect(result.totalDeductions).toBe(650000);
      expect(result.netAdjustment).toBe(1750000);
    });

    it('should calculate salary with tier strategies (high performer)', async () => {
      const input: PayrollDecisionInput = {
        tenantId: 'bella-spa-vn',
        employeeId: 'emp-high-performer',
        monthYear: '2026-07',
        sessions: {
          count: 40,
          avgRating: 4.9,
          totalRevenue: 20000000,
        },
        attendance: {
          lateDays: 0,
          absentDays: 0,
          workingDays: 26,
        },
        employee: {
          baseSalary: 8000000,
        },
        config: {
          kpi: {
            enabled: true,
            strategy: 'tier',
            params: {
              tiers: [
                { min: 0, max: 20, bonus: 0 },
                { min: 21, max: 30, bonus: 500000 },
                { min: 31, max: 999, bonus: 1500000 },
              ],
            },
          },
          attendance: {
            enabled: true,
            strategy: 'combined',
            params: { latePenalty: 50000, absentPenalty: 200000 },
          },
          rating: {
            enabled: true,
            strategy: 'tier',
            params: {
              tiers: [
                { min: 0, max: 4.4, bonus: 0 },
                { min: 4.5, max: 4.7, bonus: 50000 },
                { min: 4.8, max: 5.0, bonus: 150000 },
              ],
            },
          },
          commission: {
            enabled: true,
            strategy: 'tier',
            params: {
              tiers: [
                { min: 0, max: 10, rate: 100000 },
                { min: 11, max: 30, rate: 120000 },
                { min: 31, max: 999, rate: 150000 },
              ],
            },
          },
        },
      };

      const result = await provider.evaluate(input);

      // Expected:
      // KPI: 1,500,000 (40 in Tier 3)
      // Attendance: 0 (no violations)
      // Rating: 150,000 (4.9 in Tier 3)
      // Commission: 6,000,000 (40 * 150,000 Tier 3 rate)
      // Net: 7,650,000

      expect(result.components.kpiBonus.amount).toBe(1500000);
      expect(result.components.attendanceDeduction.amount).toBe(0);
      expect(result.components.ratingBonus.amount).toBe(150000);
      expect(result.components.sessionCommission.amount).toBe(6000000);
      expect(result.netAdjustment).toBe(7650000);
    });

    it('should handle commission gate rejection (below minSessions)', async () => {
      const input: PayrollDecisionInput = {
        tenantId: 'bella-spa-vn',
        employeeId: 'emp-low-sessions',
        monthYear: '2026-07',
        sessions: {
          count: 3,
          avgRating: 4.8,
          totalRevenue: 1500000,
        },
        attendance: {
          lateDays: 0,
          absentDays: 0,
          workingDays: 26,
        },
        employee: {
          baseSalary: 8000000,
        },
        config: {
          kpi: {
            enabled: true,
            strategy: 'threshold',
            params: { target: 30, bonus: 1000000 },
          },
          attendance: {
            enabled: true,
            strategy: 'combined',
            params: { latePenalty: 50000, absentPenalty: 200000 },
          },
          rating: {
            enabled: true,
            strategy: 'threshold',
            params: { minRating: 4.5, bonus: 50000 },
          },
          commission: {
            enabled: true,
            strategy: 'fixed',
            params: { rate: 120000, minSessions: 5 },
          },
        },
      };

      const result = await provider.evaluate(input);

      // Expected:
      // KPI: 0 (3 < 30)
      // Attendance: 0 (no violations)
      // Rating: 50,000 (4.8 >= 4.5)
      // Commission: 0 (gate rejected: 3 < 5)
      // Net: 50,000

      expect(result.components.kpiBonus.amount).toBe(0);
      expect(result.components.attendanceDeduction.amount).toBe(0);
      expect(result.components.ratingBonus.amount).toBe(50000);
      expect(result.components.sessionCommission.amount).toBe(0);
      expect(result.components.sessionCommission.reason).toContain('Minimum sessions not met');
      expect(result.netAdjustment).toBe(50000);
    });
  });
});
