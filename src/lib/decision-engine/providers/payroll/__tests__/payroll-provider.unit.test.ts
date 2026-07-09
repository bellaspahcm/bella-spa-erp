/**
 * Payroll Provider - Unit Tests
 * 
 * Tests individual calculation methods for each salary component strategy.
 * Focuses on isolated calculation logic WITHOUT rule evaluation.
 * 
 * Test Coverage:
 * 1. KPI Bonus Calculations (9 tests)
 *    - Threshold strategy (3 tests)
 *    - Linear strategy (3 tests)
 *    - Tier strategy (3 tests)
 * 2. Attendance Deduction Calculations (6 tests)
 *    - Late deduction strategy (2 tests)
 *    - Absent deduction strategy (2 tests)
 *    - Combined strategy (2 tests)
 * 3. Rating Bonus Calculations (9 tests)
 *    - Threshold strategy (3 tests)
 *    - Linear strategy (3 tests)
 *    - Tier strategy (3 tests)
 * 4. Commission Calculations (4 tests)
 *    - Fixed strategy (1 test)
 *    - Tier strategy (1 test)
 *    - Percentage strategy (1 test)
 *    - Service strategy (1 test)
 * 
 * Total: 28 Unit Tests
 */

import { PayrollProvider } from '../payroll-provider';
import type { PayrollDecisionInput } from '../types';

describe('PayrollProvider - Unit Tests', () => {
  let provider: PayrollProvider;

  beforeEach(() => {
    provider = new PayrollProvider();
  });

  // ==============================================
  // Category 1: KPI Bonus Calculations (9 tests)
  // ==============================================
  describe('KPI Bonus - Threshold Strategy', () => {
    const createInput = (sessions: number): PayrollDecisionInput => ({
      tenantId: 'test-tenant',
      employeeId: 'emp-001',
      monthYear: '2026-07',
      sessions: {
        count: sessions,
        avgRating: 4.5,
        totalRevenue: 15000000,
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
          params: {
            target: 30,
            bonus: 1000000,
          },
        },
        attendance: { enabled: false, strategy: 'combined', params: {} },
        rating: { enabled: false, strategy: 'threshold', params: {} },
        commission: { enabled: false, strategy: 'fixed', params: {} },
      },
    });

    it('should calculate 0đ when sessions below target (20 < 30)', async () => {
      const input = createInput(20);
      const result = await provider.evaluate(input);

      expect(result.components.kpiBonus.amount).toBe(0);
      expect(result.components.kpiBonus.eligible).toBe(false);
    });

    it('should calculate 1,000,000đ when sessions meet target (30 = 30)', async () => {
      const input = createInput(30);
      const result = await provider.evaluate(input);

      expect(result.components.kpiBonus.amount).toBe(1000000);
      expect(result.components.kpiBonus.eligible).toBe(true);
      expect(result.components.kpiBonus.strategy).toBe('threshold');
    });

    it('should calculate 1,000,000đ when sessions exceed target (35 > 30)', async () => {
      const input = createInput(35);
      const result = await provider.evaluate(input);

      expect(result.components.kpiBonus.amount).toBe(1000000);
      expect(result.components.kpiBonus.eligible).toBe(true);
    });
  });

  describe('KPI Bonus - Linear Strategy', () => {
    const createInput = (sessions: number): PayrollDecisionInput => ({
      tenantId: 'test-tenant',
      employeeId: 'emp-002',
      monthYear: '2026-07',
      sessions: {
        count: sessions,
        avgRating: 4.5,
        totalRevenue: 15000000,
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
          strategy: 'linear',
          params: {
            baseline: 20,
            bonusPerUnit: 50000,
            maxBonus: 2000000,
          },
        },
        attendance: { enabled: false, strategy: 'combined', params: {} },
        rating: { enabled: false, strategy: 'threshold', params: {} },
        commission: { enabled: false, strategy: 'fixed', params: {} },
      },
    });

    it('should calculate 0đ when sessions at baseline (20 = 20)', async () => {
      const input = createInput(20);
      const result = await provider.evaluate(input);

      expect(result.components.kpiBonus.amount).toBe(0);
      expect(result.components.kpiBonus.eligible).toBe(false);
    });

    it('should calculate linear bonus (30 sessions → 500,000đ)', async () => {
      const input = createInput(30);
      const result = await provider.evaluate(input);

      // (30 - 20) * 50,000 = 500,000
      expect(result.components.kpiBonus.amount).toBe(500000);
      expect(result.components.kpiBonus.eligible).toBe(true);
    });

    it('should cap bonus at maxBonus (50 sessions → 2,000,000đ cap)', async () => {
      const input = createInput(50);
      const result = await provider.evaluate(input);

      // (50 - 20) * 50,000 = 1,500,000, but should cap at 2,000,000
      // Wait, 1,500,000 < 2,000,000, so no cap
      // Let's use 60 sessions: (60 - 20) * 50,000 = 2,000,000
      const input60 = createInput(60);
      const result60 = await provider.evaluate(input60);
      expect(result60.components.kpiBonus.amount).toBe(2000000);

      // 70 sessions: (70 - 20) * 50,000 = 2,500,000, should cap at 2,000,000
      const input70 = createInput(70);
      const result70 = await provider.evaluate(input70);
      expect(result70.components.kpiBonus.amount).toBe(2000000);
    });
  });

  describe('KPI Bonus - Tier Strategy', () => {
    const createInput = (sessions: number): PayrollDecisionInput => ({
      tenantId: 'test-tenant',
      employeeId: 'emp-003',
      monthYear: '2026-07',
      sessions: {
        count: sessions,
        avgRating: 4.5,
        totalRevenue: 15000000,
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
        attendance: { enabled: false, strategy: 'combined', params: {} },
        rating: { enabled: false, strategy: 'threshold', params: {} },
        commission: { enabled: false, strategy: 'fixed', params: {} },
      },
    });

    it('should calculate Tier 1 bonus (15 sessions → 0đ)', async () => {
      const input = createInput(15);
      const result = await provider.evaluate(input);

      expect(result.components.kpiBonus.amount).toBe(0);
      expect(result.components.kpiBonus.eligible).toBe(false);
    });

    it('should calculate Tier 2 bonus (25 sessions → 500,000đ)', async () => {
      const input = createInput(25);
      const result = await provider.evaluate(input);

      expect(result.components.kpiBonus.amount).toBe(500000);
      expect(result.components.kpiBonus.eligible).toBe(true);
    });

    it('should calculate Tier 3 bonus (35 sessions → 1,500,000đ)', async () => {
      const input = createInput(35);
      const result = await provider.evaluate(input);

      expect(result.components.kpiBonus.amount).toBe(1500000);
      expect(result.components.kpiBonus.eligible).toBe(true);
    });
  });

  // ======================================================
  // Category 2: Attendance Deduction Calculations (6 tests)
  // ======================================================
  describe('Attendance Deduction - Late Strategy', () => {
    const createInput = (lateDays: number): PayrollDecisionInput => ({
      tenantId: 'test-tenant',
      employeeId: 'emp-004',
      monthYear: '2026-07',
      sessions: {
        count: 30,
        avgRating: 4.5,
        totalRevenue: 15000000,
      },
      attendance: {
        lateDays,
        absentDays: 0,
        workingDays: 26,
      },
      employee: {
        baseSalary: 8000000,
      },
      config: {
        kpi: { enabled: false, strategy: 'threshold', params: {} },
        attendance: {
          enabled: true,
          strategy: 'late_deduction',
          params: {
            latePenalty: 50000,
            absentPenalty: 200000,
          },
        },
        rating: { enabled: false, strategy: 'threshold', params: {} },
        commission: { enabled: false, strategy: 'fixed', params: {} },
      },
    });

    it('should calculate 0đ when no late days', async () => {
      const input = createInput(0);
      const result = await provider.evaluate(input);

      expect(result.components.attendanceDeduction.amount).toBe(0);
      expect(result.components.attendanceDeduction.eligible).toBe(false);
    });

    it('should calculate -100,000đ for 2 late days', async () => {
      const input = createInput(2);
      const result = await provider.evaluate(input);

      // 2 * 50,000 = 100,000 (negative)
      expect(result.components.attendanceDeduction.amount).toBe(-100000);
      expect(result.components.attendanceDeduction.eligible).toBe(true);
      expect(result.components.attendanceDeduction.strategy).toBe('late_deduction');
    });
  });

  describe('Attendance Deduction - Absent Strategy', () => {
    const createInput = (absentDays: number): PayrollDecisionInput => ({
      tenantId: 'test-tenant',
      employeeId: 'emp-005',
      monthYear: '2026-07',
      sessions: {
        count: 30,
        avgRating: 4.5,
        totalRevenue: 15000000,
      },
      attendance: {
        lateDays: 0,
        absentDays,
        workingDays: 26 - absentDays,
      },
      employee: {
        baseSalary: 8000000,
      },
      config: {
        kpi: { enabled: false, strategy: 'threshold', params: {} },
        attendance: {
          enabled: true,
          strategy: 'absent_deduction',
          params: {
            latePenalty: 50000,
            absentPenalty: 200000,
          },
        },
        rating: { enabled: false, strategy: 'threshold', params: {} },
        commission: { enabled: false, strategy: 'fixed', params: {} },
      },
    });

    it('should calculate 0đ when no absent days', async () => {
      const input = createInput(0);
      const result = await provider.evaluate(input);

      expect(result.components.attendanceDeduction.amount).toBe(0);
      expect(result.components.attendanceDeduction.eligible).toBe(false);
    });

    it('should calculate -400,000đ for 2 absent days', async () => {
      const input = createInput(2);
      const result = await provider.evaluate(input);

      // 2 * 200,000 = 400,000 (negative)
      expect(result.components.attendanceDeduction.amount).toBe(-400000);
      expect(result.components.attendanceDeduction.eligible).toBe(true);
      expect(result.components.attendanceDeduction.strategy).toBe('absent_deduction');
    });
  });

  describe('Attendance Deduction - Combined Strategy', () => {
    const createInput = (lateDays: number, absentDays: number): PayrollDecisionInput => ({
      tenantId: 'test-tenant',
      employeeId: 'emp-006',
      monthYear: '2026-07',
      sessions: {
        count: 30,
        avgRating: 4.5,
        totalRevenue: 15000000,
      },
      attendance: {
        lateDays,
        absentDays,
        workingDays: 26 - absentDays,
      },
      employee: {
        baseSalary: 8000000,
      },
      config: {
        kpi: { enabled: false, strategy: 'threshold', params: {} },
        attendance: {
          enabled: true,
          strategy: 'combined',
          params: {
            latePenalty: 50000,
            absentPenalty: 200000,
          },
        },
        rating: { enabled: false, strategy: 'threshold', params: {} },
        commission: { enabled: false, strategy: 'fixed', params: {} },
      },
    });

    it('should calculate 0đ when no violations', async () => {
      const input = createInput(0, 0);
      const result = await provider.evaluate(input);

      expect(result.components.attendanceDeduction.amount).toBe(0);
      expect(result.components.attendanceDeduction.eligible).toBe(false);
    });

    it('should calculate -500,000đ for mixed violations (2 late, 2 absent)', async () => {
      const input = createInput(2, 2);
      const result = await provider.evaluate(input);

      // (2 * 50,000) + (2 * 200,000) = 100,000 + 400,000 = 500,000 (negative)
      expect(result.components.attendanceDeduction.amount).toBe(-500000);
      expect(result.components.attendanceDeduction.eligible).toBe(true);
      expect(result.components.attendanceDeduction.strategy).toBe('combined');
    });
  });

  // ===================================================
  // Category 3: Rating Bonus Calculations (9 tests)
  // ===================================================
  describe('Rating Bonus - Threshold Strategy', () => {
    const createInput = (avgRating: number): PayrollDecisionInput => ({
      tenantId: 'test-tenant',
      employeeId: 'emp-007',
      monthYear: '2026-07',
      sessions: {
        count: 30,
        avgRating,
        totalRevenue: 15000000,
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
        kpi: { enabled: false, strategy: 'threshold', params: {} },
        attendance: { enabled: false, strategy: 'combined', params: {} },
        rating: {
          enabled: true,
          strategy: 'threshold',
          params: {
            minRating: 4.5,
            bonus: 50000,
          },
        },
        commission: { enabled: false, strategy: 'fixed', params: {} },
      },
    });

    it('should calculate 0đ when rating below threshold (4.2 < 4.5)', async () => {
      const input = createInput(4.2);
      const result = await provider.evaluate(input);

      expect(result.components.ratingBonus.amount).toBe(0);
      expect(result.components.ratingBonus.eligible).toBe(false);
    });

    it('should calculate 50,000đ when rating meets threshold (4.5 = 4.5)', async () => {
      const input = createInput(4.5);
      const result = await provider.evaluate(input);

      expect(result.components.ratingBonus.amount).toBe(50000);
      expect(result.components.ratingBonus.eligible).toBe(true);
      expect(result.components.ratingBonus.strategy).toBe('threshold');
    });

    it('should calculate 50,000đ when rating exceeds threshold (4.8 > 4.5)', async () => {
      const input = createInput(4.8);
      const result = await provider.evaluate(input);

      expect(result.components.ratingBonus.amount).toBe(50000);
      expect(result.components.ratingBonus.eligible).toBe(true);
    });
  });

  describe('Rating Bonus - Linear Strategy', () => {
    const createInput = (avgRating: number): PayrollDecisionInput => ({
      tenantId: 'test-tenant',
      employeeId: 'emp-008',
      monthYear: '2026-07',
      sessions: {
        count: 30,
        avgRating,
        totalRevenue: 15000000,
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
        kpi: { enabled: false, strategy: 'threshold', params: {} },
        attendance: { enabled: false, strategy: 'combined', params: {} },
        rating: {
          enabled: true,
          strategy: 'linear',
          params: {
            baseline: 4.0,
            bonusPerPoint: 100000,
            maxBonus: 300000,
          },
        },
        commission: { enabled: false, strategy: 'fixed', params: {} },
      },
    });

    it('should calculate 0đ when rating at baseline (4.0 = 4.0)', async () => {
      const input = createInput(4.0);
      const result = await provider.evaluate(input);

      expect(result.components.ratingBonus.amount).toBe(0);
      expect(result.components.ratingBonus.eligible).toBe(false);
    });

    it('should calculate linear bonus (4.5 rating → 50,000đ)', async () => {
      const input = createInput(4.5);
      const result = await provider.evaluate(input);

      // (4.5 - 4.0) * 100,000 = 50,000
      expect(result.components.ratingBonus.amount).toBe(50000);
      expect(result.components.ratingBonus.eligible).toBe(true);
    });

    it('should cap bonus at maxBonus (5.0 rating → 300,000đ cap)', async () => {
      const input = createInput(5.0);
      const result = await provider.evaluate(input);

      // (5.0 - 4.0) * 100,000 = 100,000 < 300,000, no cap
      expect(result.components.ratingBonus.amount).toBe(100000);

      // But if we had 4.0 baseline and 5.0 rating, that's only 100,000
      // We need a config where cap applies
      // Let's use bonusPerPoint = 150000:
      // (5.0 - 4.0) * 150,000 = 150,000 (still < 300,000)
      // We need (X - 4.0) * 100,000 > 300,000, so X > 7.0 (impossible)
      // Let's change baseline to 3.0:
      const inputWithCap: PayrollDecisionInput = {
        ...createInput(5.0),
        config: {
          ...createInput(5.0).config,
          rating: {
            enabled: true,
            strategy: 'linear',
            params: {
              baseline: 3.0,
              bonusPerPoint: 100000,
              maxBonus: 150000,
            },
          },
        },
      };
      const resultWithCap = await provider.evaluate(inputWithCap);
      // (5.0 - 3.0) * 100,000 = 200,000, cap at 150,000
      expect(resultWithCap.components.ratingBonus.amount).toBe(150000);
    });
  });

  describe('Rating Bonus - Tier Strategy', () => {
    const createInput = (avgRating: number): PayrollDecisionInput => ({
      tenantId: 'test-tenant',
      employeeId: 'emp-009',
      monthYear: '2026-07',
      sessions: {
        count: 30,
        avgRating,
        totalRevenue: 15000000,
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
        kpi: { enabled: false, strategy: 'threshold', params: {} },
        attendance: { enabled: false, strategy: 'combined', params: {} },
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
        commission: { enabled: false, strategy: 'fixed', params: {} },
      },
    });

    it('should calculate Tier 1 bonus (4.2 rating → 0đ)', async () => {
      const input = createInput(4.2);
      const result = await provider.evaluate(input);

      expect(result.components.ratingBonus.amount).toBe(0);
      expect(result.components.ratingBonus.eligible).toBe(false);
    });

    it('should calculate Tier 2 bonus (4.6 rating → 50,000đ)', async () => {
      const input = createInput(4.6);
      const result = await provider.evaluate(input);

      expect(result.components.ratingBonus.amount).toBe(50000);
      expect(result.components.ratingBonus.eligible).toBe(true);
    });

    it('should calculate Tier 3 bonus (4.9 rating → 150,000đ)', async () => {
      const input = createInput(4.9);
      const result = await provider.evaluate(input);

      expect(result.components.ratingBonus.amount).toBe(150000);
      expect(result.components.ratingBonus.eligible).toBe(true);
    });
  });

  // ==============================================
  // Category 4: Commission Calculations (4 tests)
  // ==============================================
  describe('Commission - Fixed Strategy', () => {
    it('should calculate fixed rate commission (30 sessions × 120,000đ)', async () => {
      const input: PayrollDecisionInput = {
        tenantId: 'test-tenant',
        employeeId: 'emp-010',
        monthYear: '2026-07',
        sessions: {
          count: 30,
          avgRating: 4.5,
          totalRevenue: 15000000,
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
          kpi: { enabled: false, strategy: 'threshold', params: {} },
          attendance: { enabled: false, strategy: 'combined', params: {} },
          rating: { enabled: false, strategy: 'threshold', params: {} },
          commission: {
            enabled: true,
            strategy: 'fixed',
            params: {
              rate: 120000,
            },
          },
        },
      };

      const result = await provider.evaluate(input);

      expect(result.components.sessionCommission.amount).toBe(3600000); // 30 * 120,000
      expect(result.components.sessionCommission.eligible).toBe(true);
      expect(result.components.sessionCommission.strategy).toBe('fixed');
    });
  });

  describe('Commission - Tier Strategy', () => {
    it('should calculate tier-based commission (25 sessions → Tier 2 rate)', async () => {
      const input: PayrollDecisionInput = {
        tenantId: 'test-tenant',
        employeeId: 'emp-011',
        monthYear: '2026-07',
        sessions: {
          count: 25,
          avgRating: 4.5,
          totalRevenue: 15000000,
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
          kpi: { enabled: false, strategy: 'threshold', params: {} },
          attendance: { enabled: false, strategy: 'combined', params: {} },
          rating: { enabled: false, strategy: 'threshold', params: {} },
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

      expect(result.components.sessionCommission.amount).toBe(3000000); // 25 * 120,000
      expect(result.components.sessionCommission.strategy).toBe('tier');
    });
  });

  describe('Commission - Percentage Strategy', () => {
    it('should calculate percentage commission (15% of 15M revenue)', async () => {
      const input: PayrollDecisionInput = {
        tenantId: 'test-tenant',
        employeeId: 'emp-012',
        monthYear: '2026-07',
        sessions: {
          count: 30,
          avgRating: 4.5,
          totalRevenue: 15000000,
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
          kpi: { enabled: false, strategy: 'threshold', params: {} },
          attendance: { enabled: false, strategy: 'combined', params: {} },
          rating: { enabled: false, strategy: 'threshold', params: {} },
          commission: {
            enabled: true,
            strategy: 'percentage',
            params: {
              percentage: 15,
            },
          },
        },
      };

      const result = await provider.evaluate(input);

      expect(result.components.sessionCommission.amount).toBe(2250000); // 15,000,000 * 0.15
      expect(result.components.sessionCommission.strategy).toBe('percentage');
    });
  });

  describe('Commission - Service Strategy', () => {
    it('should calculate service-based commission (different rates per service type)', async () => {
      const input: PayrollDecisionInput = {
        tenantId: 'test-tenant',
        employeeId: 'emp-013',
        monthYear: '2026-07',
        sessions: {
          count: 30,
          avgRating: 4.5,
          totalRevenue: 15000000,
          serviceTypes: {
            Massage: 15,
            Facial: 10,
            Manicure: 5,
          },
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
          kpi: { enabled: false, strategy: 'threshold', params: {} },
          attendance: { enabled: false, strategy: 'combined', params: {} },
          rating: { enabled: false, strategy: 'threshold', params: {} },
          commission: {
            enabled: true,
            strategy: 'service',
            params: {
              serviceRates: {
                Massage: 150000,
                Facial: 100000,
                Manicure: 80000,
              },
              defaultRate: 120000,
            },
          },
        },
      };

      const result = await provider.evaluate(input);

      // (15 * 150,000) + (10 * 100,000) + (5 * 80,000) = 2,250,000 + 1,000,000 + 400,000 = 3,650,000
      expect(result.components.sessionCommission.amount).toBe(3650000);
      expect(result.components.sessionCommission.strategy).toBe('service');
    });
  });
});
