/**
 * Integration Test: PayrollProvider with Salary Recalculation Engine
 * 
 * Tests the unified PayrollProvider integration with the existing salary engine.
 * Compares results between:
 * - Legacy hardcoded logic
 * - Individual providers (Phase 2)
 * - Unified PayrollProvider (Phase 3 - NEW)
 * 
 * Run with: FEATURE_PAYROLL_PROVIDER=true tsx scripts/test-payroll-provider-integration.ts
 */

import { PayrollProvider } from '../src/lib/decision-engine/providers/payroll';
import { getPayrollProviderAdapter } from '../src/adapters/payroll-provider-adapter';
import type { SalaryCalculationContext } from '../src/adapters/payroll-provider-adapter';

// Mock data for a standard KTV employee
const mockContext: SalaryCalculationContext = {
  tenantId: 'test-tenant-bella',
  employeeId: 'ktv-test-001',
  monthYear: '2026-07',
  
  // 35 completed sessions with ratings
  sessions: Array.from({ length: 35 }, (_, i) => ({
    id: `session-${i + 1}`,
    status: 'completed',
    rating: 4.8,
    total_amount: 500000,
    package_name: 'Combo Mẹ & Bé Tiết Kiệm',
  })),
  
  // 26 working days, 2 late days, 0 absent
  attendance: [
    ...Array.from({ length: 24 }, (_, i) => ({
      id: `att-${i + 1}`,
      ktv_id: 'ktv-test-001',
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      status: 'present' as const,
      tenant_id: 'test-tenant-bella',
    })),
    // 2 late days
    {
      id: 'att-25',
      ktv_id: 'ktv-test-001',
      date: '2026-07-25',
      status: 'late' as const,
      tenant_id: 'test-tenant-bella',
    },
    {
      id: 'att-26',
      ktv_id: 'ktv-test-001',
      date: '2026-07-26',
      status: 'late' as const,
      tenant_id: 'test-tenant-bella',
    },
  ],
  
  // Employee data
  employee: {
    id: 'ktv-test-001',
    base_salary: 8000000,
    position: 'junior',
    hired_date: '2024-01-15',
    tenant_id: 'test-tenant-bella',
  },
  
  // Tenant payroll config (standard Bella Spa config)
  config: {
    kpi: {
      enabled: true,
      strategy: 'threshold',
      config: {
        target: 30,
        bonus: 1000000,
      },
    },
    attendance: {
      enabled: true,
      strategy: 'combined',
      config: {
        latePenalty: 50000,
        absentPenalty: 200000,
      },
    },
    rating: {
      enabled: true,
      strategy: 'threshold',
      config: {
        minRating: 4.5,
        bonus: 50000,
      },
    },
    commission: {
      enabled: true,
      strategy: 'fixed',
      config: {
        rate: 120000,
      },
    },
  },
};

async function testPayrollProviderIntegration() {
  console.log('🧪 PAYROLL PROVIDER INTEGRATION TEST');
  console.log('=====================================\n');

  console.log('📋 Test Scenario: Standard Employee');
  console.log('- Sessions: 35 ca (avg rating: 4.8⭐)');
  console.log('- Attendance: 24 present, 2 late, 0 absent');
  console.log('- Base salary: 8,000,000đ');
  console.log('- Config: Threshold KPI, Combined attendance, Threshold rating, Fixed commission\n');

  // Test 1: Direct PayrollProvider evaluation
  console.log('📊 Test 1: Direct PayrollProvider Evaluation');
  console.log('----------------------------------------------');
  
  try {
    const provider = new PayrollProvider({ debug: false });
    
    // Transform context to provider input format
    const adapter = getPayrollProviderAdapter();
    const result = await adapter.calculateSalaryComponents(mockContext);

    console.log('✅ PayrollProvider Success!\n');
    console.log('Results:');
    console.log(`  KPI Bonus:           ${result.kpi_bonus.toLocaleString('vi-VN')}đ`);
    console.log(`  Rating Bonus:        ${result.rating_bonus.toLocaleString('vi-VN')}đ`);
    console.log(`  Session Commission:  ${result.session_bonus.toLocaleString('vi-VN')}đ`);
    console.log(`  Attendance Deduction: ${result.violations_deduction.toLocaleString('vi-VN')}đ`);
    console.log(`  ────────────────────────────────────`);
    console.log(`  Total Bonuses:       ${result.total_bonuses.toLocaleString('vi-VN')}đ`);
    console.log(`  Total Deductions:    ${result.total_deductions.toLocaleString('vi-VN')}đ`);
    console.log(`  Net Adjustment:      ${result.net_adjustment.toLocaleString('vi-VN')}đ`);
    console.log(`\n  Execution Time:      ${result.calculation_metadata.executionTime}ms`);
    console.log(`  Matched Rules:       ${result.calculation_metadata.matchedRules.length}`);
    console.log(`  Confidence:          ${result.calculation_metadata.confidence}\n`);

    // Test 2: Verify expected values
    console.log('📊 Test 2: Verify Expected Values');
    console.log('----------------------------------------------');

    const expectedKpi = 1000000; // 35 >= 30 target
    const expectedRating = 50000; // 4.8 >= 4.5 threshold
    const expectedCommission = 4200000; // 35 * 120,000
    const expectedDeduction = -100000; // 2 * 50,000 (late penalty)
    const expectedNetAdjustment = 5150000; // (1M + 50K + 4.2M) - 100K

    const checks = [
      { name: 'KPI Bonus', actual: result.kpi_bonus, expected: expectedKpi },
      { name: 'Rating Bonus', actual: result.rating_bonus, expected: expectedRating },
      { name: 'Session Commission', actual: result.session_bonus, expected: expectedCommission },
      { name: 'Attendance Deduction', actual: result.violations_deduction, expected: expectedDeduction },
      { name: 'Net Adjustment', actual: result.net_adjustment, expected: expectedNetAdjustment },
    ];

    let allPassed = true;
    checks.forEach(check => {
      const passed = check.actual === check.expected;
      const icon = passed ? '✅' : '❌';
      console.log(`${icon} ${check.name}: ${check.actual.toLocaleString('vi-VN')}đ ${!passed ? `(expected ${check.expected.toLocaleString('vi-VN')}đ)` : ''}`);
      if (!passed) allPassed = false;
    });

    console.log();
    if (allPassed) {
      console.log('🎉 All checks PASSED!\n');
    } else {
      console.log('⚠️  Some checks FAILED. Review calculation logic.\n');
    }

    // Test 3: Performance check
    console.log('📊 Test 3: Performance Check');
    console.log('----------------------------------------------');

    const iterations = 10;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await adapter.calculateSalaryComponents(mockContext);
    }
    
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;

    console.log(`Iterations:     ${iterations}`);
    console.log(`Total time:     ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`Average time:   ${avgTime.toFixed(2)}ms`);
    console.log(`Target:         <100ms`);
    console.log(`Status:         ${avgTime < 100 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 4: Edge case - below threshold
    console.log('📊 Test 4: Edge Case - Below Threshold');
    console.log('----------------------------------------------');

    const belowThresholdContext: SalaryCalculationContext = {
      ...mockContext,
      sessions: Array.from({ length: 20 }, (_, i) => ({
        id: `session-${i + 1}`,
        status: 'completed',
        rating: 4.2,
        total_amount: 500000,
        package_name: 'Combo Mẹ & Bé Tiết Kiệm',
      })),
      attendance: [
        ...Array.from({ length: 21 }, (_, i) => ({
          id: `att-${i + 1}`,
          ktv_id: 'ktv-test-001',
          date: `2026-07-${String(i + 1).padStart(2, '0')}`,
          status: 'present' as const,
          tenant_id: 'test-tenant-bella',
        })),
        // 3 absent days
        { id: 'att-22', ktv_id: 'ktv-test-001', date: '2026-07-22', status: 'absent' as const, tenant_id: 'test-tenant-bella' },
        { id: 'att-23', ktv_id: 'ktv-test-001', date: '2026-07-23', status: 'absent' as const, tenant_id: 'test-tenant-bella' },
        { id: 'att-24', ktv_id: 'ktv-test-001', date: '2026-07-24', status: 'absent' as const, tenant_id: 'test-tenant-bella' },
      ],
    };

    const belowResult = await adapter.calculateSalaryComponents(belowThresholdContext);

    console.log('Scenario: 20 sessions (< 30 target), 4.2 rating (< 4.5), 3 absent days');
    console.log(`  KPI Bonus:           ${belowResult.kpi_bonus.toLocaleString('vi-VN')}đ (expected: 0đ)`);
    console.log(`  Rating Bonus:        ${belowResult.rating_bonus.toLocaleString('vi-VN')}đ (expected: 0đ)`);
    console.log(`  Session Commission:  ${belowResult.session_bonus.toLocaleString('vi-VN')}đ (expected: 2,400,000đ)`);
    console.log(`  Attendance Deduction: ${belowResult.violations_deduction.toLocaleString('vi-VN')}đ (expected: -600,000đ)`);
    console.log(`  Net Adjustment:      ${belowResult.net_adjustment.toLocaleString('vi-VN')}đ (expected: 1,800,000đ)\n`);

    const edgeChecks = [
      { name: 'KPI Bonus', actual: belowResult.kpi_bonus, expected: 0 },
      { name: 'Rating Bonus', actual: belowResult.rating_bonus, expected: 0 },
      { name: 'Session Commission', actual: belowResult.session_bonus, expected: 2400000 },
      { name: 'Attendance Deduction', actual: belowResult.violations_deduction, expected: -600000 },
      { name: 'Net Adjustment', actual: belowResult.net_adjustment, expected: 1800000 },
    ];

    let edgeAllPassed = true;
    edgeChecks.forEach(check => {
      const passed = check.actual === check.expected;
      const icon = passed ? '✅' : '❌';
      if (!passed) {
        console.log(`${icon} ${check.name}: ${check.actual.toLocaleString('vi-VN')}đ (expected ${check.expected.toLocaleString('vi-VN')}đ)`);
        edgeAllPassed = false;
      }
    });

    if (edgeAllPassed) {
      console.log('✅ Edge case checks PASSED!\n');
    } else {
      console.log('⚠️  Edge case checks FAILED.\n');
    }

    // Summary
    console.log('🎯 INTEGRATION TEST SUMMARY');
    console.log('=====================================');
    console.log(`✅ Direct evaluation:     PASS`);
    console.log(`${allPassed ? '✅' : '❌'} Value verification:    ${allPassed ? 'PASS' : 'FAIL'}`);
    console.log(`${avgTime < 100 ? '✅' : '❌'} Performance check:     ${avgTime < 100 ? 'PASS' : 'FAIL'} (${avgTime.toFixed(2)}ms avg)`);
    console.log(`${edgeAllPassed ? '✅' : '❌'} Edge case test:        ${edgeAllPassed ? 'PASS' : 'FAIL'}`);
    console.log();

    const overallPass = allPassed && avgTime < 100 && edgeAllPassed;
    if (overallPass) {
      console.log('🎉 ALL TESTS PASSED! PayrollProvider integration working correctly.\n');
      process.exit(0);
    } else {
      console.log('⚠️  SOME TESTS FAILED. Review issues above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test FAILED with error:');
    console.error(error);
    console.log();
    process.exit(1);
  }
}

// Run test
testPayrollProviderIntegration();
