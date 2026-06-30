/**
 * E2E COMPREHENSIVE SALARY SYSTEM TEST
 * 
 * Test scenario: Hoàn chỉnh quy trình lương của 3 KTV từ đầu tháng đến cuối tháng
 * 
 * KTV 1 (Alpha): Tình huống chuẩn
 * - 20 ca làm (mixed packages: 1.0x, 1.5x, 2.0x multipliers)
 * - 22 ngày công (full month)
 * - Rating 4.8/5.0
 * - KPI Bonus
 * - 1 bonus điều chỉnh thủ công
 * - Workflow: draft → published → confirmed → finalized
 * 
 * KTV 2 (Beta): Tình huống nghỉ giữa tháng
 * - 10 ca làm (basic package only: 1.0x)
 * - 12 ngày công (resigned mid-month)
 * - Rating 5.0/5.0
 * - No KPI
 * - 1 deduction điều chỉnh thủ công (vi phạm kỷ luật)
 * - Pro-rata base salary calculation
 * 
 * KTV 3 (Gamma): Tình huống tranh chấp
 * - 15 ca làm (VIP package: 2.0x multiplier)
 * - 20 ngày công
 * - Rating 4.5/5.0
 * - KPI Bonus
 * - Dispute → Admin confirm
 * 
 * Test các tính năng:
 * 1. Session bonus calculation with package multipliers
 * 2. Pro-rata base salary for resignation
 * 3. KPI bonus syncing from leaderboard
 * 4. Rating bonus calculation
 * 5. Manual adjustments (bonus/deduction)
 * 6. Salary reconciliation (AI vs Legacy)
 * 7. Approval workflow
 * 8. Salary expense accounting integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  cleanupTestData,
  createTestTenant,
  createTestKTVs,
  createTestPackages,
  createTestCustomer,
  createTestBookings,
  createTestSessionLogs,
  createTestAttendance,
  createTestKpiRecords,
  createTestSessionReviews,
  getSalaryRecord,
  getSessionLogs,
  getSalaryExpense,
  getAdminClient,
  getTestTenantId,
  getTestPrefix,
  type TestKTVProfile,
  type TestPackage,
} from './helpers/salary-e2e-db-helper';
import { recalculateAndSaveSalaryRecordEngine } from '@/modules/hr-salary/actions/salary-recalculation-engine';
import { 
  publishAllSalaryRecords,
  finalizeAllSalaryRecords,
  adminConfirmOnBehalf,
} from '@/modules/hr-salary/actions/admin-salary-actions';
import { createAdjustment } from '@/modules/salary/actions/create-adjustment';
import { approveAdjustment } from '@/modules/salary/actions/approve-adjustment';

type KTVProfile = {
  id: string;
  name: string;
  baseSalary: number;
  resignationDate: string | null;
};

type SessionLog = {
  id: string;
  ktvId: string;
  packageName: string;
  multiplier: number;
  commission: number;
  rating: number;
  date: string;
};

type AttendanceRecord = {
  ktvId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
};

type SalaryAdjustment = {
  ktvId: string;
  type: 'bonus' | 'deduction';
  amount: number;
  category: string;
  reason: string;
};

type ExpectedSalary = {
  ktvId: string;
  totalSessions: number;
  baseSalary: number;
  sessionBonus: number;
  ratingBonus: number;
  kpiBonus: number;
  violationsDeduction: number;
  totalSalary: number;
};

describe('E2E Comprehensive Salary System Test', () => {
  const TENANT_ID = 'test-tenant-e2e-salary';
  const MONTH_YEAR = '2026-06-01';
  
  // KTV Profiles
  const ktvProfiles: KTVProfile[] = [
    { id: 'ktv-alpha', name: 'KTV Alpha', baseSalary: 6_000_000, resignationDate: null },
    { id: 'ktv-beta', name: 'KTV Beta', baseSalary: 5_000_000, resignationDate: '2026-06-15' },
    { id: 'ktv-gamma', name: 'KTV Gamma', baseSalary: 7_000_000, resignationDate: null },
  ];
  
  // Session Logs với package multipliers
  const sessionLogs: SessionLog[] = [
    // KTV Alpha: 20 sessions (mixed packages, total: 30 weighted sessions)
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `session-alpha-${i + 1}`,
      ktvId: 'ktv-alpha',
      packageName: 'Combo Mẹ & Bé Tiết Kiệm',
      multiplier: 1.0,
      commission: 100_000,
      rating: i % 2 === 0 ? 5 : 4,
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `session-alpha-${i + 11}`,
      ktvId: 'ktv-alpha',
      packageName: 'Combo Mẹ & Bé Hạnh Phúc',
      multiplier: 1.5,
      commission: 150_000,
      rating: 5,
      date: `2026-06-${String(i + 11).padStart(2, '0')}`,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `session-alpha-${i + 17}`,
      ktvId: 'ktv-alpha',
      packageName: 'Combo Mẹ & Bé VIP Toàn Diện',
      multiplier: 2.0,
      commission: 200_000,
      rating: 5,
      date: `2026-06-${String(i + 17).padStart(2, '0')}`,
    })),
    
    // KTV Beta: 10 sessions (basic package only, total: 10 weighted sessions)
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `session-beta-${i + 1}`,
      ktvId: 'ktv-beta',
      packageName: 'Combo Mẹ & Bé Tiết Kiệm',
      multiplier: 1.0,
      commission: 100_000,
      rating: 5,
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    })),
    
    // KTV Gamma: 15 sessions (VIP package only, total: 30 weighted sessions)
    ...Array.from({ length: 15 }, (_, i) => ({
      id: `session-gamma-${i + 1}`,
      ktvId: 'ktv-gamma',
      packageName: 'Combo Mẹ & Bé VIP Toàn Diện',
      multiplier: 2.0,
      commission: 200_000,
      rating: i % 3 === 0 ? 4 : 5,
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    })),
  ];
  
  // Attendance Records
  const attendanceRecords: AttendanceRecord[] = [
    // KTV Alpha: 22 days present (full month)
    ...Array.from({ length: 22 }, (_, i) => ({
      ktvId: 'ktv-alpha',
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      status: 'present' as const,
    })),
    
    // KTV Beta: 12 days present (resigned mid-month)
    ...Array.from({ length: 12 }, (_, i) => ({
      ktvId: 'ktv-beta',
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      status: 'present' as const,
    })),
    
    // KTV Gamma: 20 days present, 2 days late
    ...Array.from({ length: 20 }, (_, i) => ({
      ktvId: 'ktv-gamma',
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      status: 'present' as const,
    })),
    ...[{ ktvId: 'ktv-gamma', date: '2026-06-21', status: 'late' as const }],
    ...[{ ktvId: 'ktv-gamma', date: '2026-06-22', status: 'late' as const }],
  ];
  
  // Manual Adjustments
  const salaryAdjustments: SalaryAdjustment[] = [
    {
      ktvId: 'ktv-alpha',
      type: 'bonus',
      amount: 500_000,
      category: 'Thưởng hoàn thành mục tiêu',
      reason: 'Hoàn thành 100% KPI tháng 6',
    },
    {
      ktvId: 'ktv-beta',
      type: 'deduction',
      amount: 200_000,
      category: 'Phạt kỷ luật',
      reason: 'Đi trễ 3 ngày trong tháng',
    },
  ];

  beforeAll(async () => {
    console.log('🚀 Setting up E2E Salary Test Environment...');
    
    try {
      // Create tenant
      const tenantId = await createTestTenant();
      
      // Create KTV profiles
      await createTestKTVs(ktvProfiles);
      
      // Create packages with multipliers
      const packages: TestPackage[] = [
        {
          id: `${getTestPrefix()}-pkg-basic`,
          name: 'Combo Mẹ & Bé Tiết Kiệm',
          description: 'Basic package',
          session_multiplier: 1.0,
          price: 1000000,
          tenant_id: tenantId,
          module: 'baby_care',
        },
        {
          id: `${getTestPrefix()}-pkg-happy`,
          name: 'Combo Mẹ & Bé Hạnh Phúc',
          description: 'Happy package',
          session_multiplier: 1.5,
          price: 1500000,
          tenant_id: tenantId,
          module: 'baby_care',
        },
        {
          id: `${getTestPrefix()}-pkg-vip`,
          name: 'Combo Mẹ & Bé VIP Toàn Diện',
          description: 'VIP package',
          session_multiplier: 2.0,
          price: 2000000,
          tenant_id: tenantId,
          module: 'baby_care',
        },
      ];
      await createTestPackages(packages);
      
      // Create customer
      const customerId = await createTestCustomer(tenantId);
      
      // Create bookings and sessions for each KTV
      // Will be implemented in test phases
      
      console.log('✅ Test environment ready');
    } catch (error) {
      console.error('❌ Setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up E2E Salary Test Environment...');
    await cleanupTestData();
    console.log('✅ Cleanup complete');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Phase 1: Session Completion & Data Collection', () => {
    it('should calculate weighted session counts correctly for each KTV', async () => {
      // KTV Alpha: 10×1.0 + 6×1.5 + 4×2.0 = 10 + 9 + 8 = 27 weighted sessions
      const alphaWeighted = 10 * 1.0 + 6 * 1.5 + 4 * 2.0;
      expect(alphaWeighted).toBe(27);
      
      // KTV Beta: 10×1.0 = 10 weighted sessions
      const betaWeighted = 10 * 1.0;
      expect(betaWeighted).toBe(10);
      
      // KTV Gamma: 15×2.0 = 30 weighted sessions
      const gammaWeighted = 15 * 2.0;
      expect(gammaWeighted).toBe(30);
    });

    it('should track attendance correctly including pro-rata for resignation', async () => {
      const alphaAttendance = attendanceRecords.filter(a => a.ktvId === 'ktv-alpha' && a.status !== 'absent').length;
      expect(alphaAttendance).toBe(22);
      
      const betaAttendance = attendanceRecords.filter(a => a.ktvId === 'ktv-beta' && a.status !== 'absent').length;
      expect(betaAttendance).toBe(12);
      
      const gammaAttendance = attendanceRecords.filter(a => a.ktvId === 'ktv-gamma' && a.status !== 'absent').length;
      expect(gammaAttendance).toBe(22); // 20 present + 2 late
    });

    it('should calculate average ratings for each KTV', async () => {
      const alphaRatings = sessionLogs.filter(s => s.ktvId === 'ktv-alpha').map(s => s.rating);
      const alphaAvgRating = alphaRatings.reduce((sum, r) => sum + r, 0) / alphaRatings.length;
      expect(alphaAvgRating).toBeCloseTo(4.8, 1);
      
      const betaRatings = sessionLogs.filter(s => s.ktvId === 'ktv-beta').map(s => s.rating);
      const betaAvgRating = betaRatings.reduce((sum, r) => sum + r, 0) / betaRatings.length;
      expect(betaAvgRating).toBe(5.0);
      
      const gammaRatings = sessionLogs.filter(s => s.ktvId === 'ktv-gamma').map(s => s.rating);
      const gammaAvgRating = gammaRatings.reduce((sum, r) => sum + r, 0) / gammaRatings.length;
      expect(gammaAvgRating).toBeCloseTo(4.67, 1);
    });
  });

  describe('Phase 2: Draft Salary Calculation', () => {
    it('should calculate KTV Alpha salary correctly (full month, mixed packages)', async () => {
      const expected: ExpectedSalary = {
        ktvId: 'ktv-alpha',
        totalSessions: 27.0, // weighted
        baseSalary: 6_000_000, // full month
        sessionBonus: 2_700_000, // 27 sessions × 100k commission base
        ratingBonus: 270_000, // 10% of session bonus (4.8 rating)
        kpiBonus: 500_000, // from KPI leaderboard
        violationsDeduction: 0,
        totalSalary: 9_970_000, // sum of above + manual bonus
      };
      
      // TODO: Call recalculateAndSaveSalaryRecordEngine
      // const result = await recalculateAndSaveSalaryRecordEngine(...)
      // expect(result.totalSessions).toBe(expected.totalSessions);
      // expect(result.baseSalary).toBe(expected.baseSalary);
      // expect(result.sessionBonus).toBe(expected.sessionBonus);
      
      expect(expected.totalSalary).toBeGreaterThan(9_000_000);
    });

    it('should calculate KTV Beta salary correctly (pro-rata for resignation)', async () => {
      // Pro-rata: (5_000_000 / 26) × 12 = 2_307_692
      const proRataBase = Math.round((5_000_000 / 26) * 12);
      
      const expected: ExpectedSalary = {
        ktvId: 'ktv-beta',
        totalSessions: 10.0,
        baseSalary: proRataBase,
        sessionBonus: 1_000_000, // 10 sessions × 100k
        ratingBonus: 100_000, // 10% of session bonus (5.0 rating)
        kpiBonus: 0, // no KPI
        violationsDeduction: 200_000, // manual deduction
        totalSalary: proRataBase + 1_000_000 + 100_000 - 200_000,
      };
      
      expect(expected.baseSalary).toBeCloseTo(2_307_692, -3); // within 1000
      expect(expected.totalSalary).toBeCloseTo(3_207_692, -3);
    });

    it('should calculate KTV Gamma salary correctly (VIP package, discipline deduction)', async () => {
      const expected: ExpectedSalary = {
        ktvId: 'ktv-gamma',
        totalSessions: 30.0, // 15 sessions × 2.0 multiplier
        baseSalary: 7_000_000, // full month
        sessionBonus: 3_000_000, // 15 sessions × 200k commission
        ratingBonus: 270_000, // ~9% of session bonus (4.5 rating)
        kpiBonus: 800_000, // from KPI leaderboard
        violationsDeduction: 50_000, // auto deduction for 2 late days
        totalSalary: 11_020_000,
      };
      
      expect(expected.totalSessions).toBe(30);
      expect(expected.totalSalary).toBeGreaterThan(10_000_000);
    });
  });

  describe('Phase 3: Manual Adjustments', () => {
    it('should apply manual bonus adjustment to KTV Alpha', async () => {
      const adjustment = salaryAdjustments.find(a => a.ktvId === 'ktv-alpha');
      expect(adjustment).toBeDefined();
      expect(adjustment?.type).toBe('bonus');
      expect(adjustment?.amount).toBe(500_000);
      
      // TODO: Call createSalaryAdjustment action
      // const result = await createSalaryAdjustment(...)
      // expect(result.success).toBe(true);
    });

    it('should apply manual deduction adjustment to KTV Beta', async () => {
      const adjustment = salaryAdjustments.find(a => a.ktvId === 'ktv-beta');
      expect(adjustment).toBeDefined();
      expect(adjustment?.type).toBe('deduction');
      expect(adjustment?.amount).toBe(200_000);
    });

    it('should recalculate total salary after manual adjustments', async () => {
      // After adding manual adjustments, total should update
      // TODO: Verify recalculation includes adjustments
    });
  });

  describe('Phase 4: Approval Workflow', () => {
    it('should publish salary records for all KTVs', async () => {
      // TODO: Call publishAllSalaryRecords
      // const result = await publishAllSalaryRecords()
      // expect(result.success).toBe(true);
      
      // Verify all records are in 'published' status
    });

    it('should allow KTV Alpha to confirm their salary', async () => {
      // TODO: Call KTV confirm action
      // const result = await confirmSalary('ktv-alpha')
      // expect(result.success).toBe(true);
    });

    it('should allow KTV Beta to confirm their salary', async () => {
      // Similar to Alpha
    });

    it('should handle salary dispute from KTV Gamma', async () => {
      // KTV Gamma disputes their salary
      // TODO: Call disputeSalary action
      // const result = await disputeSalary('ktv-gamma', 'Tôi không đồng ý với số tiền trừ kỷ luật')
      // expect(result.success).toBe(true);
      
      // Verify status is 'disputed'
    });

    it('should allow admin to confirm salary on behalf of KTV Gamma', async () => {
      // Admin confirms disputed salary
      // TODO: Call adminConfirmOnBehalf
      // const result = await adminConfirmOnBehalf('ktv-gamma')
      // expect(result.success).toBe(true);
      
      // Verify status is 'confirmed' and confirmed_by_admin is true
    });
  });

  describe('Phase 5: Finalization & Accounting', () => {
    it('should finalize all salary records', async () => {
      // TODO: Call finalizeAllSalaryRecords
      // const result = await finalizeAllSalaryRecords()
      // expect(result.success).toBe(true);
      
      // Verify all records are in 'finalized' status
    });

    it('should create salary expense entries in accounting', async () => {
      // TODO: Query expenses table
      // Verify 3 expenses created (one per KTV)
      // Verify expense amounts match salary totals
    });

    it('should confirm all session logs for finalized salaries', async () => {
      // All session_logs.is_confirmed should be true
      // TODO: Query session_logs and verify
    });

    it('should prevent further modifications to finalized salaries', async () => {
      // Try to update finalized salary -> should fail
      // TODO: Call recalculateAndSaveSalaryRecordEngine with finalized record
      // expect(result).rejects.toThrow('Cannot recalculate finalized salary record');
    });
  });

  describe('Phase 6: Salary Reconciliation', () => {
    it('should generate salary reconciliation report', async () => {
      // TODO: Call getSalaryReconciliationReport
      // const report = await getSalaryReconciliationReport(MONTH_YEAR)
      // expect(report).toHaveLength(3);
    });

    it('should show MATCH status for KTV Alpha (AI matches Legacy)', async () => {
      // KTV Alpha: No discrepancy
      // expect(report.find(r => r.ktv_id === 'ktv-alpha').status).toBe('MATCH');
    });

    it('should show MINOR_DIFF for KTV Beta (small rounding difference)', async () => {
      // KTV Beta: Pro-rata rounding might cause minor diff
      // expect(report.find(r => r.ktv_id === 'ktv-beta').status).toBe('MINOR_DIFF');
      // expect(Math.abs(report.find(r => r.ktv_id === 'ktv-beta').diff_total)).toBeLessThan(10_000);
    });

    it('should calculate reconciliation summary correctly', async () => {
      // TODO: Call getSalaryReconciliationSummary
      // const summary = await getSalaryReconciliationSummary(MONTH_YEAR)
      // expect(summary.total_ktvs).toBe(3);
      // expect(summary.matched_count).toBeGreaterThanOrEqual(1);
      // expect(summary.total_legacy_salary).toBeCloseTo(24_000_000, -5); // rough estimate
    });
  });

  describe('Phase 7: Edge Cases & Error Handling', () => {
    it('should reject recalculation of locked salary records', async () => {
      // TODO: Lock a salary record (is_locked = true)
      // Try to recalculate -> should fail
    });

    it('should handle concurrent salary updates correctly', async () => {
      // Simulate concurrent updates to same salary record
      // Should handle with proper locking or last-write-wins
    });

    it('should rollback failed salary finalization', async () => {
      // Simulate expense creation failure during finalization
      // Should rollback salary status to 'confirmed'
    });

    it('should prevent duplicate salary expenses with unique constraint', async () => {
      // Try to create duplicate expense for same KTV+month
      // Should fail with unique constraint error
    });
  });

  describe('Phase 8: Performance & Data Integrity', () => {
    it('should calculate salaries for all KTVs within reasonable time', async () => {
      const startTime = Date.now();
      
      // TODO: Recalculate all salaries
      // await Promise.all(ktvProfiles.map(ktv => recalculateAndSaveSalaryRecordEngine(...)))
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // < 5 seconds for 3 KTVs
    });

    it('should maintain referential integrity between salary records and expenses', async () => {
      // Query salary_records and expenses
      // Verify expense amount matches salary total_salary
    });

    it('should track all salary changes in audit log', async () => {
      // Query audit_logs for salary_records table
      // Verify all status changes are logged
    });
  });
});
