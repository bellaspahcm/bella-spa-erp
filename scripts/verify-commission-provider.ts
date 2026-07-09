/**
 * @fileoverview Commission Provider Verification Script (Fixed)
 * 
 * Run: npx tsx scripts/verify-commission-provider.ts
 */

import { CommissionProvider } from '../src/lib/decision-engine/providers/commission';
import type { CommissionDecisionInput } from '../src/lib/decision-engine/providers/commission';

const provider = new CommissionProvider({ debug: true });

console.log('🧪 COMMISSION PROVIDER VERIFICATION');
console.log('====================================\n');

/**
 * Test 1: Standard Employee
 */
async function test1() {
  console.log('📊 Test 1: Standard Employee (Percentage Strategy)');
  console.log('--------------------------------------------------');

  const input: CommissionDecisionInput = {
    tenantId: 'test-tenant',
    employeeId: 'ktv-001',
    monthYear: '2024-06',

    serviceItems: [
      { subtotal: 500_000 },
      { subtotal: 600_000 },
      { subtotal: 450_000 },
      { subtotal: 550_000 },
      { subtotal: 400_000 },
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

  try {
    const result = await provider.evaluate(input);

    console.log('\nOutput:');
    console.log(`  Service commission:     ${result.serviceCommission.toLocaleString('vi-VN')}đ`);
    console.log(`  Product commission:     ${result.productSalesCommission.toLocaleString('vi-VN')}đ`);
    console.log(`  Base commission:        ${result.baseCommission.toLocaleString('vi-VN')}đ`);
    console.log(`  Volume tier:            ${result.volumeTier} (${result.volumeMultiplier}x)`);
    console.log(`  Performance tier:       ${result.performanceTier} (${result.performanceMultiplier}x)`);
    console.log(`  Adjusted commission:    ${result.adjustedCommission.toLocaleString('vi-VN')}đ`);
    console.log(`  Position bonus:         ${result.positionBonus.toLocaleString('vi-VN')}đ`);
    console.log(`  Seniority bonus:        ${result.seniorityBonus.toLocaleString('vi-VN')}đ`);
    console.log(`  💰 TOTAL COMMISSION:    ${result.totalCommission.toLocaleString('vi-VN')}đ`);
    console.log(`  Execution time:         ${result.executionTimeMs.toFixed(2)}ms\n`);

    console.log('✅ Test 1 completed\n');
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }
}

/**
 * Test 2: High Performer
 */
async function test2() {
  console.log('📊 Test 2: High Performer (Elite Tier)');
  console.log('---------------------------------------');

  const input: CommissionDecisionInput = {
    tenantId: 'test-tenant',
    employeeId: 'ktv-002',
    monthYear: '2024-06',

    serviceItems: Array.from({ length: 20 }, () => ({ subtotal: 800_000 })),
    productSales: Array.from({ length: 10 }, () => ({ salesAmount: 1_500_000 })),

    totalSessions: 100,
    completedSessions: 100,
    avgRating: 5.0,

    positionTier: 'lead',
    hireDate: new Date('2019-01-01'),

    config: {
      commissionStrategy: 'percentage',
      serviceCommissionRate: 10,
      productCommissionRate: 12,
    },
  };

  try {
    const result = await provider.evaluate(input);

    console.log('\nOutput:');
    console.log(`  Base commission:        ${result.baseCommission.toLocaleString('vi-VN')}đ`);
    console.log(`  Combined multiplier:    ${result.combinedMultiplier.toFixed(3)}x 🚀`);
    console.log(`  Adjusted commission:    ${result.adjustedCommission.toLocaleString('vi-VN')}đ`);
    console.log(`  💰 TOTAL COMMISSION:    ${result.totalCommission.toLocaleString('vi-VN')}đ`);
    console.log(`  Execution time:         ${result.executionTimeMs.toFixed(2)}ms\n`);

    console.log('✅ Test 2 completed\n');
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
  }
}

/**
 * Run all tests
 */
async function runAll() {
  await test1();
  await test2();

  console.log('🎉 ALL TESTS COMPLETED');
  console.log('======================\n');
}

runAll().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
