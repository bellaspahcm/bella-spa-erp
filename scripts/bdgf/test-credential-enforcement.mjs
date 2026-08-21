#!/usr/bin/env node
/**
 * BDGF — R3 CREDENTIAL ENFORCEMENT VERIFICATION
 * 
 * Purpose: Prove that 3 canonical mutation authorities are CLOSED
 * Phase: R3 Remediation (Database Role Separation)
 * 
 * Tests:
 *   1. Authority #1: DATABASE_URL (developer) → mutation → ❌ MUST FAIL
 *   2. Authority #2: Supabase CLI → production mutation → ❌ MUST FAIL (manual)
 *   3. Authority #3: SERVICE_ROLE_KEY → exec_sql → ❌ MUST FAIL (manual/API test)
 *   4. Controlled Path: Valid Human GO → BDGF → Executor → ✅ MUST PASS
 * 
 * R3 SUCCESS CRITERIA:
 *   ALL 4 tests must pass for R3 to be considered COMPLETE
 * 
 * Usage:
 *   # Run all automated tests
 *   node scripts/bdgf/test-credential-enforcement.mjs
 * 
 *   # Run specific test
 *   node scripts/bdgf/test-credential-enforcement.mjs --test=authority1
 *   node scripts/bdgf/test-credential-enforcement.mjs --test=governed-path
 * 
 * Environment Variables Required:
 *   DATABASE_URL              - Developer credentials (bella_developer role)
 *   DATABASE_EXECUTOR_URL     - Executor credentials (bella_migration_executor role)
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TESTS = {
  authority1: {
    name: 'Authority #1: Developer DATABASE_URL → Mutation',
    description: 'Verify developer credentials CANNOT perform DML mutations',
    run: testAuthority1
  },
  governedPath: {
    name: 'Controlled Path: Human GO → BDGF → Executor → Mutation',
    description: 'Verify executor credentials CAN perform mutations (with approval)',
    run: testGovernedPath
  }
};

const MANUAL_TESTS = {
  authority2: {
    name: 'Authority #2: Supabase CLI → Production Mutation',
    instructions: `
1. Ensure developer is linked to dev project only (not prod):
   npx supabase link --project-ref <dev-ref>

2. Attempt to push migration to production:
   npx supabase db push

3. Expected: Permission denied OR "Not linked to production project"

4. If test PASSES (mutation blocked): ✅ Authority #2 CLOSED
   If test FAILS (mutation succeeded): ❌ Authority #2 BYPASS EXISTS
    `
  },
  authority3: {
    name: 'Authority #3: SERVICE_ROLE_KEY → exec_sql',
    instructions: `
1. Get developer's SERVICE_ROLE_KEY from .env

2. Attempt exec_sql mutation:
   curl -X POST https://<project>.supabase.co/rest/v1/rpc/exec_sql \\
     -H "apikey: $SERVICE_ROLE_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"query": "INSERT INTO migration_governance.role_usage_audit (role_name, operation_type, succeeded) VALUES (\\'bypass-test\\', \\'INSERT\\', true);"}'

3. Expected: 403 Forbidden OR function not found OR RLS policy denial

4. If test PASSES (mutation blocked): ✅ Authority #3 CLOSED
   If test FAILS (mutation succeeded): ❌ Authority #3 BYPASS EXISTS
    `
  }
};

// ============================================================================
// TEST RESULTS TRACKING
// ============================================================================

const results = {
  passed: [],
  failed: [],
  skipped: []
};

function recordResult(testName, passed, message) {
  if (passed) {
    results.passed.push({ test: testName, message });
  } else {
    results.failed.push({ test: testName, message });
  }
}

// ============================================================================
// TEST 1: Authority #1 — Developer DATABASE_URL → Mutation → FAIL
// ============================================================================

async function testAuthority1() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ TEST 1: Authority #1 — Developer DATABASE_URL → Mutation                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found in environment');
    recordResult('Authority #1', false, 'DATABASE_URL not configured');
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    
    // Check current role
    const roleResult = await client.query('SELECT current_user');
    const currentRole = roleResult.rows[0].current_user;
    console.log(`Current role: ${currentRole}`);
    
    if (currentRole !== 'bella_developer') {
      console.log(`⚠️  WARNING: Expected role 'bella_developer', got '${currentRole}'`);
      console.log('   This test may not accurately reflect R3 enforcement.');
    }
    console.log();

    // ========================================================================
    // TEST 1A: DML — INSERT (should FAIL)
    // ========================================================================
    console.log('TEST 1A: DML — INSERT into tenants');
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO tenants (name, subscription_tier, onboarding_stage, is_blocked)
        VALUES ('test-r3-bypass-insert', 'FREE', 'REGISTERED', false)
      `);
      await client.query('ROLLBACK');
      
      // If we get here, INSERT succeeded (BAD)
      console.log('❌ FAILED: INSERT succeeded (should have been blocked)\n');
      recordResult('Authority #1 — INSERT', false, 'Developer can INSERT (bypass exists)');
    } catch (error) {
      // INSERT failed (GOOD)
      if (error.message.includes('permission denied')) {
        console.log('✅ PASSED: INSERT blocked by role permissions');
        console.log(`   Error: ${error.message}\n`);
        recordResult('Authority #1 — INSERT', true, 'Developer INSERT blocked');
      } else {
        console.log(`⚠️  FAILED: INSERT failed but with unexpected error: ${error.message}\n`);
        recordResult('Authority #1 — INSERT', false, `Unexpected error: ${error.message}`);
      }
    }

    // ========================================================================
    // TEST 1B: DML — UPDATE (should FAIL)
    // ========================================================================
    console.log('TEST 1B: DML — UPDATE tenants');
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE tenants
        SET subscription_tier = 'ENTERPRISE'
        WHERE id = (SELECT id FROM tenants LIMIT 1)
      `);
      await client.query('ROLLBACK');
      
      // If we get here, UPDATE succeeded (BAD)
      console.log('❌ FAILED: UPDATE succeeded (should have been blocked)\n');
      recordResult('Authority #1 — UPDATE', false, 'Developer can UPDATE (bypass exists)');
    } catch (error) {
      // UPDATE failed (GOOD)
      if (error.message.includes('permission denied')) {
        console.log('✅ PASSED: UPDATE blocked by role permissions');
        console.log(`   Error: ${error.message}\n`);
        recordResult('Authority #1 — UPDATE', true, 'Developer UPDATE blocked');
      } else {
        console.log(`⚠️  FAILED: UPDATE failed but with unexpected error: ${error.message}\n`);
        recordResult('Authority #1 — UPDATE', false, `Unexpected error: ${error.message}`);
      }
    }

    // ========================================================================
    // TEST 1C: DML — DELETE (should FAIL)
    // ========================================================================
    console.log('TEST 1C: DML — DELETE from tenants');
    try {
      await client.query('BEGIN');
      await client.query(`
        DELETE FROM tenants
        WHERE id = (SELECT id FROM tenants LIMIT 1)
      `);
      await client.query('ROLLBACK');
      
      // If we get here, DELETE succeeded (BAD)
      console.log('❌ FAILED: DELETE succeeded (should have been blocked)\n');
      recordResult('Authority #1 — DELETE', false, 'Developer can DELETE (bypass exists)');
    } catch (error) {
      // DELETE failed (GOOD)
      if (error.message.includes('permission denied')) {
        console.log('✅ PASSED: DELETE blocked by role permissions');
        console.log(`   Error: ${error.message}\n`);
        recordResult('Authority #1 — DELETE', true, 'Developer DELETE blocked');
      } else {
        console.log(`⚠️  FAILED: DELETE failed but with unexpected error: ${error.message}\n`);
        recordResult('Authority #1 — DELETE', false, `Unexpected error: ${error.message}`);
      }
    }

    // ========================================================================
    // TEST 1D: DDL — CREATE TABLE (should FAIL)
    // ========================================================================
    console.log('TEST 1D: DDL — CREATE TABLE');
    try {
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE test_r3_bypass (id int)
      `);
      await client.query('ROLLBACK');
      
      // If we get here, CREATE TABLE succeeded (BAD)
      console.log('❌ FAILED: CREATE TABLE succeeded (should have been blocked)\n');
      recordResult('Authority #1 — DDL', false, 'Developer can CREATE TABLE (bypass exists)');
    } catch (error) {
      // CREATE TABLE failed (GOOD)
      if (error.message.includes('permission denied') || error.message.includes('must be owner')) {
        console.log('✅ PASSED: CREATE TABLE blocked by role permissions');
        console.log(`   Error: ${error.message}\n`);
        recordResult('Authority #1 — DDL', true, 'Developer DDL blocked');
      } else {
        console.log(`⚠️  FAILED: CREATE TABLE failed but with unexpected error: ${error.message}\n`);
        recordResult('Authority #1 — DDL', false, `Unexpected error: ${error.message}`);
      }
    }

    // ========================================================================
    // TEST 1E: SELECT (should SUCCEED - verify read capability)
    // ========================================================================
    console.log('TEST 1E: SELECT from tenants (should succeed - verify read capability)');
    try {
      const selectResult = await client.query('SELECT COUNT(*) FROM tenants');
      const count = selectResult.rows[0].count;
      console.log(`✅ PASSED: SELECT succeeded (found ${count} tenants)`);
      console.log('   Developer has read capability as expected\n');
      recordResult('Authority #1 — SELECT', true, 'Developer can SELECT (read-only capability verified)');
    } catch (error) {
      console.log(`❌ FAILED: SELECT failed unexpectedly: ${error.message}\n`);
      recordResult('Authority #1 — SELECT', false, `SELECT should work: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Connection error:', error.message);
    recordResult('Authority #1', false, `Connection error: ${error.message}`);
  } finally {
    await client.end();
  }
}

// ============================================================================
// TEST 4: Controlled Path — Human GO → BDGF → Executor → Mutation → SUCCESS
// ============================================================================

async function testGovernedPath() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ TEST 4: Controlled Path — Human GO → BDGF → Executor → Mutation             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  if (!process.env.DATABASE_EXECUTOR_URL) {
    console.log('❌ DATABASE_EXECUTOR_URL not found in environment');
    console.log('   This credential should be configured for bella_migration_executor role');
    recordResult('Governed Path', false, 'DATABASE_EXECUTOR_URL not configured');
    return;
  }

  const executorClient = new Client({ connectionString: process.env.DATABASE_EXECUTOR_URL });

  try {
    await executorClient.connect();
    
    // Check current role
    const roleResult = await executorClient.query('SELECT current_user');
    const currentRole = roleResult.rows[0].current_user;
    console.log(`Current role: ${currentRole}`);
    
    if (currentRole !== 'bella_migration_executor') {
      console.log(`⚠️  WARNING: Expected role 'bella_migration_executor', got '${currentRole}'`);
      console.log('   This test may not accurately reflect R3 enforcement.');
    }
    console.log();

    // ========================================================================
    // TEST 4A: Verify executor CAN perform DML
    // ========================================================================
    console.log('TEST 4A: Verify executor CAN perform INSERT');
    try {
      await executorClient.query('BEGIN');
      const insertResult = await executorClient.query(`
        INSERT INTO migration_governance.role_usage_audit 
          (role_name, operation_type, succeeded, query_text)
        VALUES 
          ('bella_migration_executor', 'INSERT', true, 'R3 verification test')
        RETURNING id
      `);
      await executorClient.query('COMMIT');
      
      const insertedId = insertResult.rows[0].id;
      console.log(`✅ PASSED: Executor can INSERT (audit record ${insertedId} created)`);
      recordResult('Governed Path — INSERT', true, 'Executor INSERT succeeded');
      
      // Clean up test record
      await executorClient.query(`DELETE FROM migration_governance.role_usage_audit WHERE id = $1`, [insertedId]);
      console.log('   Test record cleaned up\n');
      
    } catch (error) {
      console.log(`❌ FAILED: Executor INSERT blocked: ${error.message}\n`);
      recordResult('Governed Path — INSERT', false, `Executor should be able to INSERT: ${error.message}`);
    }

    // ========================================================================
    // TEST 4B: Verify executor CAN perform DDL
    // ========================================================================
    console.log('TEST 4B: Verify executor CAN perform CREATE TABLE');
    try {
      await executorClient.query('BEGIN');
      await executorClient.query(`
        CREATE TABLE IF NOT EXISTS test_r3_executor_capability (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          test_data text
        )
      `);
      await executorClient.query(`DROP TABLE test_r3_executor_capability`);
      await executorClient.query('COMMIT');
      
      console.log(`✅ PASSED: Executor can CREATE TABLE (and DROP)`);
      recordResult('Governed Path — DDL', true, 'Executor DDL succeeded');
      console.log();
      
    } catch (error) {
      await executorClient.query('ROLLBACK');
      console.log(`❌ FAILED: Executor DDL blocked: ${error.message}\n`);
      recordResult('Governed Path — DDL', false, `Executor should be able to perform DDL: ${error.message}`);
    }

    // ========================================================================
    // TEST 4C: Verify executor CAN read approval table (R2 integration)
    // ========================================================================
    console.log('TEST 4C: Verify executor can access R2 approval mechanism');
    try {
      const approvalCheck = await executorClient.query(`
        SELECT EXISTS (
          SELECT 1 FROM migration_governance.approvals LIMIT 1
        ) as table_exists
      `);
      
      console.log('✅ PASSED: Executor can access migration_governance.approvals');
      console.log('   R2 + R3 integration verified\n');
      recordResult('Governed Path — R2 Integration', true, 'Executor can access approval table');
      
    } catch (error) {
      console.log(`⚠️  WARNING: Executor cannot access approvals table: ${error.message}`);
      console.log('   This may indicate R2+R3 integration issue\n');
      recordResult('Governed Path — R2 Integration', false, `Cannot access approvals: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Connection error:', error.message);
    recordResult('Governed Path', false, `Connection error: ${error.message}`);
  } finally {
    await executorClient.end();
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                                ║');
  console.log('║             BDGF — R3 CREDENTIAL ENFORCEMENT VERIFICATION                      ║');
  console.log('║                                                                                ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Purpose: Verify 3 canonical mutation authorities are CLOSED                   ║');
  console.log('║ Phase: R3 Remediation (Database Role Separation)                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');

  // Parse command line args
  const args = process.argv.slice(2);
  const testArg = args.find(arg => arg.startsWith('--test='));
  const specificTest = testArg ? testArg.split('=')[1] : null;

  if (specificTest) {
    console.log(`\nRunning specific test: ${specificTest}\n`);
    if (TESTS[specificTest]) {
      await TESTS[specificTest].run();
    } else {
      console.log(`❌ Unknown test: ${specificTest}`);
      console.log(`Available tests: ${Object.keys(TESTS).join(', ')}`);
      process.exit(1);
    }
  } else {
    console.log('\nRunning all automated tests...\n');
    for (const [key, test] of Object.entries(TESTS)) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`TEST: ${test.name}`);
      console.log(`Description: ${test.description}`);
      console.log('='.repeat(80));
      await test.run();
    }
  }

  // ============================================================================
  // PRINT RESULTS SUMMARY
  // ============================================================================
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ R3 VERIFICATION RESULTS SUMMARY                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  console.log(`✅ PASSED: ${results.passed.length} tests`);
  results.passed.forEach(r => {
    console.log(`   - ${r.test}: ${r.message}`);
  });
  console.log();

  console.log(`❌ FAILED: ${results.failed.length} tests`);
  results.failed.forEach(r => {
    console.log(`   - ${r.test}: ${r.message}`);
  });
  console.log();

  // ============================================================================
  // MANUAL TESTS INSTRUCTIONS
  // ============================================================================
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ MANUAL TESTS REQUIRED                                                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  for (const [key, test] of Object.entries(MANUAL_TESTS)) {
    console.log(`\n${test.name}`);
    console.log('-'.repeat(80));
    console.log(test.instructions);
  }

  // ============================================================================
  // R3 PASS/FAIL DETERMINATION
  // ============================================================================
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ R3 SUCCESS CRITERIA                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  const allAutomatedPassed = results.failed.length === 0 && results.passed.length > 0;

  if (allAutomatedPassed) {
    console.log('✅ AUTOMATED TESTS: PASSED');
    console.log('\nR3 will be considered COMPLETE when:');
    console.log('  1. ✅ All automated tests pass (current status)');
    console.log('  2. ⏳ Manual Test — Authority #2 (Supabase CLI) verified');
    console.log('  3. ⏳ Manual Test — Authority #3 (SERVICE_ROLE_KEY) verified');
    console.log('\nNext Steps:');
    console.log('  - Execute manual tests above');
    console.log('  - Document results in evidence/g3a-architecture/R3_COMPLETION_SUMMARY.md');
    console.log('  - If all tests pass: R3 COMPLETE ✅');
    console.log('  - If any test fails: Review credential distribution and re-test');
  } else {
    console.log('❌ AUTOMATED TESTS: FAILED');
    console.log(`\n${results.failed.length} test(s) failed. R3 is NOT complete.`);
    console.log('\nCommon Issues:');
    console.log('  - DATABASE_URL still using postgres role (not bella_developer)');
    console.log('  - DATABASE_EXECUTOR_URL not configured');
    console.log('  - Migration 20260820110000_database_role_separation.sql not applied');
    console.log('  - Role passwords not set');
    console.log('\nReview R3_CREDENTIAL_DISTRIBUTION_PLAN.md and re-run tests.');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  process.exit(results.failed.length > 0 ? 1 : 0);
}

// ============================================================================
// MAIN
// ============================================================================

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
