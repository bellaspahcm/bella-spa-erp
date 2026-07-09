/**
 * Verify Discount Provider
 * 
 * Quick verification script to ensure Discount Provider works correctly.
 * Tests rule evaluation, tier mapping, and discount calculations.
 */

import { DiscountProvider } from '../src/lib/decision-engine/providers/discount';
import type { DiscountDecisionInput } from '../src/lib/decision-engine/providers/discount';

console.log('🔍 Verifying Discount Provider...\n');

const provider = new DiscountProvider({ debug: true });

// Test scenarios
const testScenarios: Array<{
  name: string;
  input: DiscountDecisionInput;
  expectedDiscount: number;
  expectedTier: string;
}> = [
  {
    name: 'VIP Customer (≥50M spending)',
    input: {
      tenantId: 'bella-spa-vn',
      totalAmount: 10000000,
      customer: {
        id: 'cust-vip-001',
        status: 'vip',
        totalSpending: 60000000,
        completedBookingsCount: 25,
      },
    },
    expectedDiscount: 15,
    expectedTier: 'vip',
  },
  {
    name: 'Loyal Customer (≥20M spending)',
    input: {
      tenantId: 'bella-spa-vn',
      totalAmount: 5000000,
      customer: {
        id: 'cust-loyal-001',
        status: 'active',
        totalSpending: 25000000,
        completedBookingsCount: 8,
      },
    },
    expectedDiscount: 10,
    expectedTier: 'loyal',
  },
  {
    name: 'Active Customer (>1 booking)',
    input: {
      tenantId: 'bella-spa-vn',
      totalAmount: 3000000,
      customer: {
        id: 'cust-active-001',
        status: 'active',
        totalSpending: 5000000,
        completedBookingsCount: 3,
      },
    },
    expectedDiscount: 5,
    expectedTier: 'active',
  },
  {
    name: 'New Customer (first booking)',
    input: {
      tenantId: 'bella-spa-vn',
      totalAmount: 4000000,
      customer: {
        id: 'cust-new-001',
        status: 'new',
        totalSpending: 0,
        completedBookingsCount: 0,
        isFirstBooking: true,
      },
    },
    expectedDiscount: 5,
    expectedTier: 'new',
  },
  {
    name: 'Bundle Discount (3+ services)',
    input: {
      tenantId: 'bella-spa-vn',
      totalAmount: 8000000,
      customer: {
        id: 'cust-bundle-001',
        status: 'new',
        totalSpending: 0,
        completedBookingsCount: 0,
      },
      purchase: {
        serviceCount: 4,
      },
    },
    expectedDiscount: 12,
    expectedTier: 'new',
  },
  {
    name: 'Referral Discount',
    input: {
      tenantId: 'bella-spa-vn',
      totalAmount: 6000000,
      customer: {
        id: 'cust-referral-001',
        status: 'new',
        totalSpending: 0,
        completedBookingsCount: 0,
      },
      purchase: {
        referralCode: 'REF123456',
      },
    },
    expectedDiscount: 8,
    expectedTier: 'new',
  },
];

// Run tests
async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const scenario of testScenarios) {
    try {
      const result = await provider.evaluate(scenario.input);

      const discountMatch = result.discountPercent === scenario.expectedDiscount;
      const tierMatch = result.customerTier === scenario.expectedTier;

      if (discountMatch && tierMatch) {
        console.log(`✅ ${scenario.name}`);
        console.log(`   Discount: ${result.discountPercent}% (expected: ${scenario.expectedDiscount}%)`);
        console.log(`   Tier: ${result.customerTier} (expected: ${scenario.expectedTier})`);
        console.log(`   Amount: ${scenario.input.totalAmount.toLocaleString()} → ${result.finalAmount.toLocaleString()} VND`);
        console.log(`   Reason: ${result.reason}`);
        console.log(`   Execution time: ${result.executionTime}ms`);
        console.log('');
        passed++;
      } else {
        console.log(`❌ ${scenario.name}`);
        console.log(`   Expected: ${scenario.expectedDiscount}% discount, ${scenario.expectedTier} tier`);
        console.log(`   Got: ${result.discountPercent}% discount, ${result.customerTier} tier`);
        console.log('');
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${scenario.name} - ERROR`);
      console.log(`   ${error instanceof Error ? error.message : String(error)}`);
      console.log('');
      failed++;
    }
  }

  return { passed, failed, total: testScenarios.length };
}

// Execute
runTests().then(({ passed, failed, total }) => {
  console.log('📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}/${total}`);
  console.log(`   ❌ Failed: ${failed}/${total}`);
  console.log('');

  if (failed === 0) {
    console.log('🎉 All tests passed! Discount Provider is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the output above.');
    process.exit(1);
  }
}).catch((error) => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
