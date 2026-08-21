#!/usr/bin/env node
/**
 * BDGF — TEST APPROVAL ENFORCEMENT
 * 
 * Purpose: Verify machine-verifiable Human GO enforcement
 * Phase: R2 Remediation (Negative + Positive Tests)
 * 
 * Tests:
 *   1. NO APPROVAL → BLOCKED
 *   2. INVALID APPROVAL (HOLD status) → BLOCKED
 *   3. EXPIRED APPROVAL → BLOCKED
 *   4. WRONG ENVIRONMENT → BLOCKED
 *   5. MISSING CONDITIONS → BLOCKED
 *   6. VALID APPROVAL → ALLOWED
 * 
 * Success Criterion:
 *   - Tests 1-5 must return is_approved=FALSE
 *   - Test 6 must return is_approved=TRUE
 * 
 * Exit Code:
 *   0 = ALL TESTS PASS (enforcement working)
 *   1 = ANY TEST FAIL (enforcement broken)
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

let passCount = 0;
let failCount = 0;

function testPass(testName, details = '') {
  console.log(`✅ ${testName}`);
  if (details) console.log(`   ${details}`);
  passCount++;
}

function testFail(testName, details) {
  console.log(`❌ ${testName}`);
  console.log(`   ${details}`);
  failCount++;
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ BDGF — TEST APPROVAL ENFORCEMENT                                             ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Purpose: Verify NO APPROVAL → BLOCKED enforcement                           ║');
  console.log('║ Phase: R2 Remediation (Machine-Verifiable Human GO)                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Database connection established\n');

    // ==========================================================================
    // TEST 1: NO APPROVAL → BLOCKED
    // ==========================================================================
    console.log('TEST 1: NO APPROVAL → BLOCKED\n');
    
    const test1Result = await client.query(`
      SELECT * FROM migration_governance.verify_approval(
        'test-migration-no-approval',
        'production',
        'test-executor'
      )
    `);
    
    const test1 = test1Result.rows[0];
    if (!test1.is_approved && test1.failure_reason && test1.failure_reason.includes('NO APPROVAL')) {
      testPass('NO APPROVAL correctly BLOCKED', `Reason: ${test1.failure_reason}`);
    } else {
      testFail('NO APPROVAL should be BLOCKED', `Expected is_approved=false, got ${test1.is_approved}`);
    }

    // ==========================================================================
    // TEST 2: INVALID APPROVAL (HOLD status) → BLOCKED
    // ==========================================================================
    console.log('\nTEST 2: INVALID APPROVAL (HOLD status) → BLOCKED\n');

    // Create HOLD approval
    await client.query(`
      INSERT INTO migration_governance.approvals (
        migration_id,
        migration_files,
        environment,
        approval_type,
        status,
        backup_confirmed,
        monitoring_confirmed,
        scope_confirmed,
        requested_by
      ) VALUES (
        'test-migration-hold',
        ARRAY['test.sql'],
        'production',
        'HUMAN_GO',
        'HOLD',
        FALSE,
        FALSE,
        FALSE,
        'test@system'
      )
      ON CONFLICT DO NOTHING
    `);

    const test2Result = await client.query(`
      SELECT * FROM migration_governance.verify_approval(
        'test-migration-hold',
        'production',
        'test-executor'
      )
    `);

    const test2 = test2Result.rows[0];
    if (!test2.is_approved) {
      testPass('HOLD status correctly BLOCKED', 'No GO approval found');
    } else {
      testFail('HOLD status should be BLOCKED', `Expected is_approved=false, got ${test2.is_approved}`);
    }

    // ==========================================================================
    // TEST 3: EXPIRED APPROVAL → BLOCKED
    // ==========================================================================
    console.log('\nTEST 3: EXPIRED APPROVAL → BLOCKED\n');

    // Create expired approval
    await client.query(`
      INSERT INTO migration_governance.approvals (
        migration_id,
        migration_files,
        environment,
        approval_type,
        status,
        backup_confirmed,
        monitoring_confirmed,
        scope_confirmed,
        requested_by,
        approved_by,
        approved_at,
        expires_at
      ) VALUES (
        'test-migration-expired',
        ARRAY['test.sql'],
        'production',
        'HUMAN_GO',
        'GO',
        TRUE,
        TRUE,
        TRUE,
        'test@system',
        'approver@system',
        NOW() - INTERVAL '8 days',
        NOW() - INTERVAL '1 day'
      )
      ON CONFLICT DO NOTHING
    `);

    const test3Result = await client.query(`
      SELECT * FROM migration_governance.verify_approval(
        'test-migration-expired',
        'production',
        'test-executor'
      )
    `);

    const test3 = test3Result.rows[0];
    if (!test3.is_approved && test3.failure_reason && test3.failure_reason.includes('EXPIRED')) {
      testPass('EXPIRED approval correctly BLOCKED', `Reason: ${test3.failure_reason}`);
    } else {
      testFail('EXPIRED approval should be BLOCKED', `Expected is_approved=false, got ${test3.is_approved}`);
    }

    // ==========================================================================
    // TEST 4: WRONG ENVIRONMENT → BLOCKED
    // ==========================================================================
    console.log('\nTEST 4: WRONG ENVIRONMENT → BLOCKED\n');

    // Create staging approval
    await client.query(`
      INSERT INTO migration_governance.approvals (
        migration_id,
        migration_files,
        environment,
        approval_type,
        status,
        backup_confirmed,
        monitoring_confirmed,
        scope_confirmed,
        requested_by,
        approved_by,
        approved_at
      ) VALUES (
        'test-migration-env',
        ARRAY['test.sql'],
        'staging',
        'HUMAN_GO',
        'GO',
        TRUE,
        TRUE,
        TRUE,
        'test@system',
        'approver@system',
        NOW()
      )
      ON CONFLICT DO NOTHING
    `);

    // Try to verify for production
    const test4Result = await client.query(`
      SELECT * FROM migration_governance.verify_approval(
        'test-migration-env',
        'production',
        'test-executor'
      )
    `);

    const test4 = test4Result.rows[0];
    if (!test4.is_approved && test4.failure_reason && test4.failure_reason.includes('NO APPROVAL')) {
      testPass('WRONG ENVIRONMENT correctly BLOCKED', 'Staging approval not valid for production');
    } else {
      testFail('WRONG ENVIRONMENT should be BLOCKED', `Expected is_approved=false, got ${test4.is_approved}`);
    }

    // ==========================================================================
    // TEST 5: MISSING CONDITIONS → BLOCKED
    // ==========================================================================
    console.log('\nTEST 5: MISSING CONDITIONS (backup not confirmed) → BLOCKED\n');

    // Create approval with GO status but missing backup condition
    await client.query(`
      INSERT INTO migration_governance.approvals (
        migration_id,
        migration_files,
        environment,
        approval_type,
        status,
        backup_confirmed,
        monitoring_confirmed,
        scope_confirmed,
        requested_by
      ) VALUES (
        'test-migration-no-backup',
        ARRAY['test.sql'],
        'production',
        'HUMAN_GO',
        'PENDING',
        FALSE,
        TRUE,
        TRUE,
        'test@system'
      )
      ON CONFLICT DO NOTHING
    `);

    // Attempt to UPDATE to GO (should fail constraint)
    try {
      await client.query(`
        UPDATE migration_governance.approvals
        SET status = 'GO', approved_by = 'test', approved_at = NOW()
        WHERE migration_id = 'test-migration-no-backup'
      `);
      testFail('MISSING CONDITION should be rejected by constraint', 'UPDATE succeeded but should have failed');
    } catch (error) {
      if (error.message.includes('approval_requires_conditions')) {
        testPass('MISSING CONDITION correctly blocked by constraint', 'Database constraint prevented GO without backup confirmation');
      } else {
        testFail('Unexpected error', error.message);
      }
    }

    // ==========================================================================
    // TEST 6: VALID APPROVAL → ALLOWED
    // ==========================================================================
    console.log('\nTEST 6: VALID APPROVAL → ALLOWED\n');

    // Create valid approval
    const insertResult = await client.query(`
      INSERT INTO migration_governance.approvals (
        migration_id,
        migration_files,
        environment,
        approval_type,
        status,
        backup_confirmed,
        monitoring_confirmed,
        scope_confirmed,
        requested_by,
        approved_by,
        approved_at,
        approval_signature,
        expires_at
      ) VALUES (
        'test-migration-valid',
        ARRAY['test.sql'],
        'production',
        'HUMAN_GO',
        'GO',
        TRUE,
        TRUE,
        TRUE,
        'test@system',
        'approver@system',
        NOW(),
        'valid-signature-hash',
        NOW() + INTERVAL '7 days'
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `);

    const test6Result = await client.query(`
      SELECT * FROM migration_governance.verify_approval(
        'test-migration-valid',
        'production',
        'test-executor'
      )
    `);

    const test6 = test6Result.rows[0];
    if (test6.is_approved === true && test6.failure_reason === null) {
      testPass('VALID APPROVAL correctly ALLOWED', `Approval ID: ${test6.approval_id}`);
    } else {
      testFail('VALID APPROVAL should be ALLOWED', `Expected is_approved=true, got ${test6.is_approved}, reason: ${test6.failure_reason}`);
    }

    // ==========================================================================
    // SUMMARY
    // ==========================================================================
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ TEST SUMMARY                                                                 ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ PASS: ${passCount.toString().padEnd(71)}║`);
    console.log(`║ FAIL: ${failCount.toString().padEnd(71)}║`);
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

    if (failCount === 0) {
      console.log('🎉 ALL TESTS PASSED — Approval enforcement is working correctly!\n');
      console.log('✅ R2 VERIFICATION: Machine-Verifiable Human GO enforcement CONFIRMED\n');
      console.log('Key findings:');
      console.log('  - NO APPROVAL → BLOCKED ✅');
      console.log('  - INVALID APPROVAL → BLOCKED ✅');
      console.log('  - EXPIRED APPROVAL → BLOCKED ✅');
      console.log('  - WRONG ENVIRONMENT → BLOCKED ✅');
      console.log('  - MISSING CONDITIONS → BLOCKED ✅');
      console.log('  - VALID APPROVAL → ALLOWED ✅\n');
      process.exit(0);
    } else {
      console.log(`❌ ${failCount} TEST(S) FAILED — Approval enforcement has gaps!\n`);
      console.log('R2 INCOMPLETE: Fix enforcement issues before proceeding to R3.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test execution error:');
    console.error(error.message);
    process.exit(1);
  } finally {
    // Cleanup test data
    try {
      await client.query(`
        DELETE FROM migration_governance.approvals
        WHERE migration_id LIKE 'test-migration-%'
      `);
      console.log('🧹 Test data cleaned up\n');
    } catch (cleanupError) {
      console.warn('⚠️  Cleanup warning:', cleanupError.message);
    }
    
    await client.end();
  }
}

runTests();
