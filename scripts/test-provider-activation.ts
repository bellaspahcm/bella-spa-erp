/**
 * Provider Activation Test Script
 * 
 * This script directly calls the salary recalculation engine to test
 * KPIProvider, AttendanceProvider, and RatingProvider in Phase 2 mode.
 * 
 * Run with: npx tsx scripts/test-provider-activation.ts
 * 
 * Prerequisites:
 * - .env.local has USE_CONFIG_PROVIDERS=true
 * - Dev server running (npm run dev)
 * - Valid tenant_id and employee_id in database
 */

import { recalculateAndSaveSalaryRecord } from '../src/modules/hr-salary/actions/salary-recalculation-engine';

async function testProviderActivation() {
  console.log('🚀 Provider Activation Test Started\n');
  console.log('=' .repeat(60));
  
  // Test configuration
  const TEST_CONFIG = {
    tenantId: '0e66365b-42b0-420e-acca-f7d7692e125e', // Replace with your tenant ID
    employeeId: 'ccb36cf7-3e3c-4af8-a5a4-e83d78c0a2f7', // Replace with test KTV ID
    month: '2026-06', // June 2026
    year: 2026
  };

  console.log('📋 Test Configuration:');
  console.log(`   Tenant ID: ${TEST_CONFIG.tenantId}`);
  console.log(`   Employee ID: ${TEST_CONFIG.employeeId}`);
  console.log(`   Month: ${TEST_CONFIG.month}`);
  console.log(`   USE_CONFIG_PROVIDERS: ${process.env.USE_CONFIG_PROVIDERS || 'false'}\n`);

  if (process.env.USE_CONFIG_PROVIDERS !== 'true') {
    console.error('❌ ERROR: USE_CONFIG_PROVIDERS is not set to "true" in .env.local');
    console.error('   Please update .env.local and restart this script.\n');
    process.exit(1);
  }

  try {
    console.log('⏳ Triggering salary recalculation...\n');
    console.log('=' .repeat(60));
    
    const result = await recalculateAndSaveSalaryRecord({
      employeeId: TEST_CONFIG.employeeId,
      tenantId: TEST_CONFIG.tenantId,
      month: TEST_CONFIG.month,
      year: TEST_CONFIG.year,
    });

    console.log('=' .repeat(60));
    console.log('\n✅ RECALCULATION COMPLETED\n');
    
    if (result.success) {
      console.log('📊 Result Summary:');
      console.log(`   Employee: ${result.data.employeeName}`);
      console.log(`   Total Salary: ${result.data.totalSalary.toLocaleString('vi-VN')} VNĐ`);
      console.log(`   Status: ${result.data.status}\n`);
      
      console.log('💰 Salary Components:');
      console.log(`   Base Salary: ${result.data.baseSalary.toLocaleString('vi-VN')} VNĐ`);
      console.log(`   Session Bonus: ${result.data.sessionBonus.toLocaleString('vi-VN')} VNĐ`);
      console.log(`   KPI Bonus: ${result.data.kpiBonus.toLocaleString('vi-VN')} VNĐ`);
      console.log(`   Rating Bonus: ${result.data.ratingBonus.toLocaleString('vi-VN')} VNĐ`);
      console.log(`   Deductions: -${result.data.deductions.toLocaleString('vi-VN')} VNĐ`);
      console.log(`   Advances: -${result.data.advances.toLocaleString('vi-VN')} VNĐ\n`);
      
      console.log('🔍 Check Console Logs Above For:');
      console.log('   ✓ [PHASE_2_ACTIVE] markers (should appear 3 times)');
      console.log('   ✓ KPIProvider evaluation logs');
      console.log('   ✓ AttendanceProvider evaluation logs');
      console.log('   ✓ RatingProvider evaluation logs\n');
      
      console.log('✅ SUCCESS: Providers are active and functioning correctly!');
      console.log('   Next: Deploy to production with USE_CONFIG_PROVIDERS=true in Vercel\n');
    } else {
      console.error('❌ FAILED: Recalculation returned error');
      console.error(`   Error: ${result.error}\n`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ EXCEPTION: Recalculation threw an error');
    console.error(error);
    console.error('\nCheck the error details above and fix before deploying.\n');
    process.exit(1);
  }
}

// Run test
testProviderActivation().then(() => {
  console.log('🎉 Test completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed with unexpected error:');
  console.error(error);
  process.exit(1);
});
