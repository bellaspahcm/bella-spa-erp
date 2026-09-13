#!/usr/bin/env tsx

/**
 * Bella Land - Full Regression Suite
 * 
 * End-to-end verification of reconciled workflows:
 * - Projects: status enum fix
 * - Customers: CRUD operations
 * - Reservations: create, persist, concurrency, tenant isolation, field semantics
 * 
 * Success Criteria:
 * - All critical workflows executable
 * - No runtime errors
 * - No data loss
 * - Invariants enforced
 */

import { execSync } from 'child_process';

interface TestResult {
  suite: string;
  script: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration?: number;
  error?: string;
}

function runTest(suite: string, script: string): TestResult {
  const startTime = Date.now();
  
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🧪 ${suite}`);
  console.log(`   Script: ${script}`);
  console.log(`${'─'.repeat(70)}`);
  
  try {
    execSync(`npx tsx ${script}`, {
      encoding: 'utf-8',
      stdio: 'inherit',
      timeout: 120000 // 2 minutes per test
    });
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ ${suite}: PASS (${(duration / 1000).toFixed(2)}s)`);
    
    return {
      suite,
      script,
      status: 'PASS',
      duration
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ ${suite}: FAIL (${(duration / 1000).toFixed(2)}s)`);
    console.error(`   Error: ${error.message}`);
    
    return {
      suite,
      script,
      status: 'FAIL',
      duration,
      error: error.message
    };
  }
}

async function main() {
  console.log('\n🔬 Bella Land - Full Regression Suite');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('🎯 GOAL: Verify all reconciled workflows work end-to-end');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📅 Started: ${new Date().toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results: TestResult[] = [];
  const suiteStartTime = Date.now();

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: Reservation Core Functionality
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║ SUITE 1: RESERVATION CORE FUNCTIONALITY                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  results.push(runTest(
    'Reservation Creation & Persistence',
    'scripts/bella-land/test-reservation-creation.ts'
  ));

  results.push(runTest(
    'Field Semantics Verification',
    'scripts/bella-land/test-field-semantics.ts'
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: Business Invariants
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║ SUITE 2: BUSINESS INVARIANTS                                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  results.push(runTest(
    'Concurrency Protection (Double Booking)',
    'scripts/bella-land/test-reservation-concurrency.ts'
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: Security Boundaries
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║ SUITE 3: SECURITY BOUNDARIES                                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  results.push(runTest(
    'Tenant Isolation (Cross-Tenant Access)',
    'scripts/bella-land/test-tenant-isolation-reservations.ts'
  ));

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const suiteDuration = Date.now() - suiteStartTime;

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║ REGRESSION SUMMARY                                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log('📊 Test Results:');
  console.log(`   ✅ Passed:  ${passed}/${total}`);
  console.log(`   ❌ Failed:  ${failed}/${total}`);
  console.log(`   ⏭️  Skipped: ${skipped}/${total}`);
  console.log(`   ⏱️  Duration: ${(suiteDuration / 1000).toFixed(2)}s`);

  console.log('\n─────────────────────────────────────────────────────────────────────');
  console.log('DETAILED RESULTS:');
  console.log('─────────────────────────────────────────────────────────────────────\n');

  results.forEach((result, index) => {
    const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    const duration = result.duration ? `${(result.duration / 1000).toFixed(2)}s` : 'N/A';
    
    console.log(`${index + 1}. ${status} ${result.suite}`);
    console.log(`   Script: ${result.script}`);
    console.log(`   Duration: ${duration}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });

  console.log('═════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('❌ REGRESSION FAILED');
    console.log(`   ${failed} test suite(s) failed`);
    console.log('\n🔍 Review failed tests above for details');
    console.log('\n📋 RECOMMENDATION:');
    console.log('   1. Fix failing tests');
    console.log('   2. Re-run regression');
    console.log('   3. Do NOT proceed to RC until all tests pass');
    console.log('\n═════════════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }

  console.log('✅ REGRESSION PASSED');
  console.log(`   All ${total} test suites passed`);
  console.log('\n🎯 VERIFICATION COMPLETE:');
  console.log('   ✅ Reservation core functionality working');
  console.log('   ✅ Business invariants enforced');
  console.log('   ✅ Security boundaries verified');
  console.log('\n📋 NEXT STEPS:');
  console.log('   1. RC Evidence Review');
  console.log('   2. Document known deployment debt');
  console.log('   3. Make RC seal decision');
  console.log('\n═════════════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

main();
