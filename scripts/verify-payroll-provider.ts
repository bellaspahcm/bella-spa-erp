/**
 * Verification Script: Payroll Provider Integration
 * 
 * Tests PayrollProvider with realistic scenarios covering all 4 components:
 * - KPI Bonus (threshold, linear, tier strategies)
 * - Attendance Deduction (late, absent, combined strategies)
 * - Rating Bonus (threshold, linear, tier strategies)
 * - Commission (fixed, tier, percentage, service strategies)
 * 
 * Run: npx tsx scripts/verify-payroll-provider.ts
 */

import { PayrollProvider } from '../src/lib/decision-engine/providers/payroll';
import type { PayrollDecisionInput } from '../src/lib/decision-engine/providers/payroll';

/**
 * Test Scenario 1: Standard Employee (meets all targets)
 */
async function testStandardEmployee() {
  console.log('\n📊 Test 1: Standard Employee (35 sessions, 4.8 rating, 2 late)');
  
  const provider = new PayrollProvider();
  
  const input: PayrollDecisionInput = {
    tenantId: 'bella-spa-vn',
    employeeId: 'emp-001',
    monthYear: '2026-07',
    sessions: {
      count: 35,
      avgRating: 4.8,
      totalRevenue: 15000000,
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
  
  console.log('  ✅ KPI Bonus:', result.components.kpiBonus.amount.toLocaleString('vi-VN'), 'đ');
  console.log('  ✅ Rating Bonus:', result.components.ratingBonus.amount.toLocaleString('vi-VN'), 'đ');
  console.log('  ✅ Commission:', result.components.sessionCommission.amount.toLocaleString('vi-VN'), 'đ');
  console.log('  ⚠️  Late Deduction:', result.components.attendanceDeduction.amount.toLocaleString('vi-VN'), 'đ');
  console.log('  📈 Total Bonuses:', result.totalBonuses.toLocaleString('vi-VN'), 'đ');
  console.log('  📉 Total Deductions:', result.totalDeductions.toLocaleString('vi-VN'), 'đ');
  console.log('  💰 Net Adjustment:', result.netAdjustment.toLocaleString('vi-VN'), 'đ');
  console.log('  ⏱️  Execution Time:', result.executionTime, 'ms');
  
  // Verify
  const expectedKPI = 1000000; // 35 >= 30
  const expectedRating = 50000; // 4.8 >= 4.5
  const expectedCommission = 35 * 120000; // 35 sessions × 120k
  const expectedDeduction = 2 * 50000; // 2 late days
  
  const pass = 
    result.components.kpiBonus.amount === expectedKPI &&
    result.components.ratingBonus.amount === expectedRating &&
    result.components.sessionCommission.amount === expectedCommission &&
    Math.abs(result.components.attendanceDeduction.amount) === expectedDeduction;
  
  return pass ? '✅ PASS' : '❌ FAIL';
}

/**
 * Test Scenario 2: Below Target (no bonuses)
 */
async function testBelowTarget() {
  console.log('\n📊 Test 2: Below Target (20 sessions, 4.2 rating, 3 absent)');
  
  const provider = new PayrollProvider();
  
  const input: PayrollDecisionInput = {
    tenantId: 'bella-spa-vn',
    employeeId: 'emp-002',
    monthYear: '2026-07',
    sessions: {
      count: 20,
      avgRating: 4.2,
      totalRevenue: 8000000,
    },
    attendance: {
      lateDays: 0,
      absentDays: 3,
      workingDays: 23,
    },
    employee: {
      baseSalary: 7000000,
    },
    config: {
      kpi: {
        enabled: true,
        strategy: 'threshold',
        params: { target: 30, bonus: 1000000 },
      },
      attendance: {
        enabled: true,
        strategy: 'absent_deduction',
        params: { absentPenalty: 200000 },
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
  
  console.log('  ❌ KPI Bonus:', result.components.kpiBonus.amount.toLocaleString('vi-VN'), 'đ (below target)');
  console.log('  ❌ Rating Bonus:', result.components.ratingBonus.amount.toLocaleString('vi-VN'), 'đ (below 4.5)');
  console.log('  ✅ Commission:', result.components.sessionCommission.amount.toLocaleString('vi-VN'), 'đ');
  console.log('  ⚠️  Absent Deduction:', result.components.attendanceDeduction.amount.toLocaleString('vi-VN'), 'đ');
  console.log('  💰 Net Adjustment:', result.netAdjustment.toLocaleString('vi-VN'), 'đ');
  
  // Verify
  const pass = 
    result.components.kpiBonus.amount === 0 &&
    result.components.ratingBonus.amount === 0 &&
    result.components.sessionCommission.amount === 20 * 120000 &&
    Math.abs(result.components.attendanceDeduction.amount) === 3 * 200000;
  
  return pass ? '✅ PASS' : '❌ FAIL';
}

/**
 * Test Scenario 3: Tier Strategy (high performance)
 */
async function testTierStrategy() {
  console.log('\n📊 Test 3: Tier Strategy (40 sessions, 4.9 rating, perfect attendance)');
  
  const provider = new PayrollProvider();
  
  const input: PayrollDecisionInput = {
    tenantId: 'bella-spa-vn',
    employeeId: 'emp-003',
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
      baseSalary: 9000000,
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
            { min: 11, max: 20, rate: 120000 },
            { min: 21, max: 999, rate: 150000 },
          ],
        },
      },
    },
  };
  
  const result = await provider.evaluate(input);
  
  console.log('  ✅ KPI Bonus (Tier 3):', result.components.kpiBonus.amount.toLocaleString('vi-VN'), 'đ');
  console.log('  ✅ Rating Bonus (Tier 3):', result.components.ratingBonus.amount.toLocaleString('vi-VN'), 'đ');
  console.log('  ✅ Commission (Tier 3):', result.components.sessionCommission.amount.toLocaleString('vi-VN'), 'đ');
  console.log('  ✅ No Deductions:', result.components.attendanceDeduction.amount.toLocaleString('vi-VN'), 'đ');
  console.log('  📈 Total Bonuses:', result.totalBonuses.toLocaleString('vi-VN'), 'đ');
  console.log('  💰 Net Adjustment:', result.netAdjustment.toLocaleString('vi-VN'), 'đ');
  
  // Verify
  const expectedKPI = 1500000; // Tier 3 (31+)
  const expectedRating = 150000; // Tier 3 (4.8-5.0)
  const expectedCommission = 40 * 150000; // Tier 3 rate
  
  const pass = 
    result.components.kpiBonus.amount === expectedKPI &&
    result.components.ratingBonus.amount === expectedRating &&
    result.components.sessionCommission.amount === expectedCommission &&
    result.components.attendanceDeduction.amount === 0;
  
  return pass ? '✅ PASS' : '❌ FAIL';
}

/**
 * Test Scenario 4: Commission Gate (below minimum)
 */
async function testCommissionGate() {
  console.log('\n📊 Test 4: Commission Gate (3 sessions, minSessions=5)');
  
  const provider = new PayrollProvider();
  
  const input: PayrollDecisionInput = {
    tenantId: 'bella-spa-vn',
    employeeId: 'emp-004',
    monthYear: '2026-07',
    sessions: {
      count: 3,
      avgRating: 4.5,
      totalRevenue: 2000000,
    },
    attendance: {
      lateDays: 0,
      absentDays: 0,
      workingDays: 26,
    },
    employee: {
      baseSalary: 7000000,
    },
    config: {
      kpi: { enabled: false, strategy: 'threshold', params: {} },
      attendance: { enabled: false, strategy: 'combined', params: {} },
      rating: { enabled: false, strategy: 'threshold', params: {} },
      commission: {
        enabled: true,
        strategy: 'fixed',
        params: { rate: 120000, minSessions: 5 },
      },
    },
  };
  
  const result = await provider.evaluate(input);
  
  console.log('  ❌ Commission:', result.components.sessionCommission.amount.toLocaleString('vi-VN'), 'đ (gate rejected)');
  console.log('  💬 Reason:', result.components.sessionCommission.reason);
  
  // Verify gate rejection
  const pass = 
    result.components.sessionCommission.amount === 0 &&
    result.components.sessionCommission.reason.includes('Minimum sessions');
  
  return pass ? '✅ PASS' : '❌ FAIL';
}

/**
 * Main verification
 */
async function verifyPayrollProvider() {
  console.log('🔍 Verifying Payroll Provider Integration...\n');
  console.log('Testing 4 scenarios across all salary components:\n');

  const results = {
    test1: await testStandardEmployee(),
    test2: await testBelowTarget(),
    test3: await testTierStrategy(),
    test4: await testCommissionGate(),
  };

  console.log('\n📊 Test Summary:');
  console.log('  Test 1 (Standard Employee):', results.test1);
  console.log('  Test 2 (Below Target):', results.test2);
  console.log('  Test 3 (Tier Strategy):', results.test3);
  console.log('  Test 4 (Commission Gate):', results.test4);

  const allPass = Object.values(results).every(r => r === '✅ PASS');

  if (allPass) {
    console.log('\n✅ All tests passed!');
    console.log('   Payroll Provider integration successful!');
    console.log('   Ready for Step 3: Comprehensive Testing');
  } else {
    console.log('\n❌ Some tests failed. Review output above.');
    process.exit(1);
  }
}

// Run verification
verifyPayrollProvider().catch(console.error);
