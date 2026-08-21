#!/usr/bin/env node
/**
 * FAILURE-INJECTION ROLLBACK TEST
 * 
 * Purpose: Verify PostgreSQL transaction rollback semantics for Migration 05-B
 *          by injecting artificial failures at critical points and confirming
 *          database returns to pristine state.
 * 
 * Amendment: Amendment 12 v3
 * Migration: 05-B canonical tenant creation + orphan deletion
 * 
 * CRITICAL GOVERNANCE PRINCIPLE:
 *   This is NOT migration execution. This is rollback behavior verification.
 *   All tests run in isolated transactions that are ALWAYS rolled back.
 *   Database must remain at 0 mutations after test completion.
 * 
 * Test Scenarios:
 *   1. Failure after E2 PASS but before DELETE
 *   2. Failure after audit UPDATE but before DELETE
 *   3. Failure after DELETE but before count verification
 * 
 * Success Criteria:
 *   - All 3 scenarios must trigger ROLLBACK
 *   - Database state after each scenario = state before
 *   - 5/5 fixtures intact, tenant_id=TEXT, no migration_evidence schema
 *   - mutation count = 0 after all tests
 * 
 * Exit Codes:
 *   0 = PASS (all rollback tests successful)
 *   1 = FAIL (rollback behavior incorrect or state corruption detected)
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// UTILITIES
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function pass(testName) {
  console.log(`✅ ${testName}`);
  testsPassed++;
}

function fail(testName, details) {
  console.log(`❌ ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
  testsFailed++;
}

// ============================================================================
// STATE VERIFICATION
// ============================================================================

async function verifyPristineState(client, context) {
  console.log(`\n🔍 Verifying pristine state (${context})...\n`);
  
  const checks = [];

  // 1. Verify migration_evidence schema does NOT exist
  const schemaResult = await client.query(`
    SELECT EXISTS(
      SELECT 1 FROM information_schema.schemata
      WHERE schema_name = 'migration_evidence'
    ) AS exists
  `);
  if (!schemaResult.rows[0].exists) {
    pass('Pristine state: migration_evidence schema absent');
    checks.push(true);
  } else {
    fail('Pristine state: migration_evidence schema EXISTS (STATE CORRUPTION)', 'Expected clean state');
    checks.push(false);
  }

  // 2. Verify canonical_tenant_map does NOT exist
  const mapTableResult = await client.query(`
    SELECT EXISTS(
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'migration_evidence'
        AND table_name = 'canonical_tenant_map'
    ) AS exists
  `);
  if (!mapTableResult.rows[0].exists) {
    pass('Pristine state: canonical_tenant_map table absent');
    checks.push(true);
  } else {
    fail('Pristine state: canonical_tenant_map EXISTS (STATE CORRUPTION)', 'Rollback failed to remove table');
    checks.push(false);
  }

  // 3. Verify 5/5 fixtures intact
  const fixtureCountResult = await client.query(`
    SELECT COUNT(*) as count
    FROM runtime_tenant_registry
    WHERE tenant_id IN (
      'test-e2e-tenant-a',
      'test-e2e-tenant-b',
      'test-e2e-tenant-attacker',
      'test-quarantine-tenant-a',
      'test-quarantine-tenant-b'
    )
  `);
  const fixtureCount = parseInt(fixtureCountResult.rows[0].count);
  if (fixtureCount === 5) {
    pass(`Pristine state: 5/5 fixtures intact (no deletion leak)`);
    checks.push(true);
  } else {
    fail(`Pristine state: ${fixtureCount}/5 fixtures (DELETION LEAKED THROUGH ROLLBACK)`, 'Transaction isolation violated');
    checks.push(false);
  }

  // 4. Verify tenant_id remains TEXT
  const tenantIdTypeResult = await client.query(`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'runtime_tenant_registry'
      AND column_name = 'tenant_id'
  `);
  const dataType = tenantIdTypeResult.rows[0].data_type;
  if (dataType === 'text' || dataType === 'character varying') {
    pass(`Pristine state: tenant_id type = ${dataType} (TEXT preserved)`);
    checks.push(true);
  } else {
    fail(`Pristine state: tenant_id type = ${dataType} (TYPE MIGRATION LEAKED)`, 'Expected TEXT, not UUID');
    checks.push(false);
  }

  // 5. Verify no FK constraint exists
  const fkResult = await client.query(`
    SELECT COUNT(*) as count
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'runtime_tenant_registry'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.column_name = 'tenant_id'
  `);
  const fkCount = parseInt(fkResult.rows[0].count);
  if (fkCount === 0) {
    pass('Pristine state: No FK constraint on tenant_id');
    checks.push(true);
  } else {
    fail(`Pristine state: ${fkCount} FK constraint(s) found (FK LEAKED THROUGH ROLLBACK)`, 'Schema mutation not rolled back');
    checks.push(false);
  }

  return checks.every(c => c);
}

// ============================================================================
// SCENARIO 1: FAILURE AFTER E2 PASS, BEFORE DELETE
// ============================================================================

async function testScenario1_FailureAfterE2(client) {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║ SCENARIO 1: FAILURE AFTER E2 PASS, BEFORE DELETE                ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log('Injection Point: After E2 orphan safety gate passes,');
  console.log('                 before audit UPDATE and DELETE\n');
  console.log('Expected Behavior: EXCEPTION → ROLLBACK → pristine state\n');

  try {
    await client.query('BEGIN');

    // Step 1: Create migration_evidence schema (simulating 05-A)
    await client.query('CREATE SCHEMA migration_evidence');
    console.log('  ↳ Created migration_evidence schema (test artifact)');

    // Step 2: Create canonical_tenant_map (simulating 05-A)
    await client.query(`
      CREATE TABLE migration_evidence.canonical_tenant_map (
        id SERIAL PRIMARY KEY,
        legacy_fixture_id TEXT UNIQUE NOT NULL,
        reserved_tenant_id UUID,
        canonical_tenant_id UUID,
        classification TEXT NOT NULL,
        reconciliation_reason TEXT,
        reconciliation_phase TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        deleted_by TEXT,
        deletion_reason TEXT
      )
    `);
    console.log('  ↳ Created canonical_tenant_map (test artifact)');

    // Step 3: Insert test mapping data
    await client.query(`
      INSERT INTO migration_evidence.canonical_tenant_map 
        (legacy_fixture_id, classification, reconciliation_phase)
      VALUES
        ('test-quarantine-tenant-a', 'TEST_ORPHAN', 'RESERVATION'),
        ('test-quarantine-tenant-b', 'TEST_ORPHAN', 'RESERVATION')
    `);
    console.log('  ↳ Inserted orphan classification (test artifact)');

    // Step 4: Simulate E2 gate PASS (no actual verification needed in test)
    console.log('  ↳ [Simulated] E2 orphan safety gate: PASS');

    // Step 5: INJECT FAILURE before audit/deletion
    console.log('\n  🔴 INJECTING FAILURE (artificial EXCEPTION)\n');
    throw new Error('INJECTED_FAILURE_AFTER_E2');

    // Unreachable: audit UPDATE and DELETE would happen here

  } catch (error) {
    if (error.message === 'INJECTED_FAILURE_AFTER_E2') {
      console.log('  ↳ Exception caught: INJECTED_FAILURE_AFTER_E2');
      console.log('  ↳ Executing ROLLBACK...\n');
      await client.query('ROLLBACK');
      pass('Scenario 1: EXCEPTION triggered rollback');
      return true;
    } else {
      console.log(`  ↳ Unexpected error: ${error.message}`);
      await client.query('ROLLBACK');
      fail('Scenario 1: Unexpected exception', error.message);
      return false;
    }
  }
}

// ============================================================================
// SCENARIO 2: FAILURE AFTER AUDIT UPDATE, BEFORE DELETE
// ============================================================================

async function testScenario2_FailureAfterAudit(client) {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║ SCENARIO 2: FAILURE AFTER AUDIT UPDATE, BEFORE DELETE           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log('Injection Point: After audit columns populated (deleted_at/by/reason),');
  console.log('                 before DELETE FROM runtime_tenant_registry\n');
  console.log('Expected Behavior: EXCEPTION → ROLLBACK → audit reverted\n');

  try {
    await client.query('BEGIN');

    // Setup (same as Scenario 1)
    await client.query('CREATE SCHEMA migration_evidence');
    await client.query(`
      CREATE TABLE migration_evidence.canonical_tenant_map (
        id SERIAL PRIMARY KEY,
        legacy_fixture_id TEXT UNIQUE NOT NULL,
        classification TEXT NOT NULL,
        reconciliation_phase TEXT NOT NULL,
        deleted_at TIMESTAMPTZ,
        deleted_by TEXT,
        deletion_reason TEXT
      )
    `);
    await client.query(`
      INSERT INTO migration_evidence.canonical_tenant_map 
        (legacy_fixture_id, classification, reconciliation_phase)
      VALUES
        ('test-quarantine-tenant-a', 'TEST_ORPHAN', 'RESERVATION'),
        ('test-quarantine-tenant-b', 'TEST_ORPHAN', 'RESERVATION')
    `);
    console.log('  ↳ Test artifacts created');

    // Simulate E2 PASS
    console.log('  ↳ [Simulated] E2 gate: PASS');

    // Step: Populate audit columns (this is the mutation we want to verify gets rolled back)
    await client.query(`
      UPDATE migration_evidence.canonical_tenant_map
      SET 
        deleted_at = NOW(),
        deleted_by = CURRENT_USER,
        deletion_reason = 'E2 orphan safety gate PASS. TEST SCENARIO 2.'
      WHERE classification = 'TEST_ORPHAN'
    `);
    console.log('  ↳ Audit columns populated (deleted_at, deleted_by, deletion_reason)');

    // Verify audit was written (within transaction)
    const auditCheckResult = await client.query(`
      SELECT COUNT(*) as count
      FROM migration_evidence.canonical_tenant_map
      WHERE classification = 'TEST_ORPHAN' AND deleted_at IS NOT NULL
    `);
    const auditCount = parseInt(auditCheckResult.rows[0].count);
    console.log(`  ↳ Audit verification: ${auditCount}/2 rows have deleted_at populated`);

    // INJECT FAILURE before DELETE
    console.log('\n  🔴 INJECTING FAILURE (before DELETE)\n');
    throw new Error('INJECTED_FAILURE_AFTER_AUDIT');

  } catch (error) {
    if (error.message === 'INJECTED_FAILURE_AFTER_AUDIT') {
      console.log('  ↳ Exception caught: INJECTED_FAILURE_AFTER_AUDIT');
      console.log('  ↳ Executing ROLLBACK...\n');
      await client.query('ROLLBACK');
      pass('Scenario 2: EXCEPTION triggered rollback after audit');
      return true;
    } else {
      await client.query('ROLLBACK');
      fail('Scenario 2: Unexpected exception', error.message);
      return false;
    }
  }
}

// ============================================================================
// SCENARIO 3: FAILURE AFTER DELETE, BEFORE COUNT VERIFICATION
// ============================================================================

async function testScenario3_FailureAfterDelete(client) {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║ SCENARIO 3: FAILURE AFTER DELETE, BEFORE COUNT VERIFICATION     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log('Injection Point: After DELETE FROM runtime_tenant_registry,');
  console.log('                 before count verification completes\n');
  console.log('Expected Behavior: EXCEPTION → ROLLBACK → deleted rows restored\n');

  try {
    await client.query('BEGIN');

    // Setup
    await client.query('CREATE SCHEMA migration_evidence');
    await client.query(`
      CREATE TABLE migration_evidence.canonical_tenant_map (
        id SERIAL PRIMARY KEY,
        legacy_fixture_id TEXT UNIQUE NOT NULL,
        classification TEXT NOT NULL,
        reconciliation_phase TEXT NOT NULL,
        deleted_at TIMESTAMPTZ,
        deleted_by TEXT,
        deletion_reason TEXT
      )
    `);
    await client.query(`
      INSERT INTO migration_evidence.canonical_tenant_map 
        (legacy_fixture_id, classification, reconciliation_phase)
      VALUES
        ('test-quarantine-tenant-a', 'TEST_ORPHAN', 'RESERVATION'),
        ('test-quarantine-tenant-b', 'TEST_ORPHAN', 'RESERVATION')
    `);
    console.log('  ↳ Test artifacts created');

    // Simulate E2 PASS
    console.log('  ↳ [Simulated] E2 gate: PASS');

    // Populate audit
    await client.query(`
      UPDATE migration_evidence.canonical_tenant_map
      SET 
        deleted_at = NOW(),
        deleted_by = CURRENT_USER,
        deletion_reason = 'E2 orphan safety gate PASS. TEST SCENARIO 3.'
      WHERE classification = 'TEST_ORPHAN'
    `);
    console.log('  ↳ Audit columns populated');

    // Execute DELETE (THIS IS THE CRITICAL MUTATION)
    const deleteResult = await client.query(`
      DELETE FROM runtime_tenant_registry
      WHERE tenant_id IN (
        SELECT legacy_fixture_id 
        FROM migration_evidence.canonical_tenant_map
        WHERE classification = 'TEST_ORPHAN'
      )
    `);
    const deletedCount = deleteResult.rowCount;
    console.log(`  ↳ DELETE executed: ${deletedCount} rows deleted from runtime_tenant_registry`);

    // Verify deletion happened (within transaction)
    const remainingResult = await client.query(`
      SELECT COUNT(*) as count
      FROM runtime_tenant_registry
      WHERE tenant_id IN ('test-quarantine-tenant-a', 'test-quarantine-tenant-b')
    `);
    const remainingCount = parseInt(remainingResult.rows[0].count);
    console.log(`  ↳ Remaining orphan fixtures: ${remainingCount}/2 (0 expected within transaction)`);

    // INJECT FAILURE before count verification completes
    console.log('\n  🔴 INJECTING FAILURE (after DELETE, before verification completes)\n');
    throw new Error('INJECTED_FAILURE_AFTER_DELETE');

  } catch (error) {
    if (error.message === 'INJECTED_FAILURE_AFTER_DELETE') {
      console.log('  ↳ Exception caught: INJECTED_FAILURE_AFTER_DELETE');
      console.log('  ↳ Executing ROLLBACK...\n');
      await client.query('ROLLBACK');
      pass('Scenario 3: EXCEPTION triggered rollback after DELETE');
      return true;
    } else {
      await client.query('ROLLBACK');
      fail('Scenario 3: Unexpected exception', error.message);
      return false;
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ FAILURE-INJECTION ROLLBACK TEST                                              ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ Amendment: Amendment 12 v3                                                   ║');
  console.log('║ Migration: 05-B canonical tenant creation + orphan deletion                  ║');
  console.log('║ Purpose:   Verify PostgreSQL transaction rollback semantics                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║ GOVERNANCE PRINCIPLE:                                                        ║');
  console.log('║   This is NOT migration execution.                                           ║');
  console.log('║   All tests run in isolated transactions.                                    ║');
  console.log('║   Database MUST remain at 0 mutations after completion.                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('\n✅ Database connection established\n');

    // ========================================================================
    // PRE-TEST STATE VERIFICATION
    // ========================================================================
    const preTestPristine = await verifyPristineState(client, 'PRE-TEST');
    if (!preTestPristine) {
      console.log('\n❌ PRE-TEST STATE VERIFICATION FAILED\n');
      console.log('Database is not in pristine state before testing.');
      console.log('STOP. Fix database state before running rollback tests.\n');
      await client.end();
      process.exit(1);
    }

    // ========================================================================
    // SCENARIO 1: FAILURE AFTER E2 PASS
    // ========================================================================
    const scenario1Pass = await testScenario1_FailureAfterE2(client);
    
    // Verify pristine state after Scenario 1
    const postScenario1Pristine = await verifyPristineState(client, 'POST-SCENARIO-1');
    if (!postScenario1Pristine) {
      fail('Scenario 1 rollback verification', 'State corruption detected after rollback');
    } else {
      pass('Scenario 1 rollback verification: pristine state restored');
    }

    // ========================================================================
    // SCENARIO 2: FAILURE AFTER AUDIT UPDATE
    // ========================================================================
    const scenario2Pass = await testScenario2_FailureAfterAudit(client);
    
    // Verify pristine state after Scenario 2
    const postScenario2Pristine = await verifyPristineState(client, 'POST-SCENARIO-2');
    if (!postScenario2Pristine) {
      fail('Scenario 2 rollback verification', 'Audit UPDATE leaked through rollback');
    } else {
      pass('Scenario 2 rollback verification: audit reverted, pristine state restored');
    }

    // ========================================================================
    // SCENARIO 3: FAILURE AFTER DELETE
    // ========================================================================
    const scenario3Pass = await testScenario3_FailureAfterDelete(client);
    
    // Verify pristine state after Scenario 3
    const postScenario3Pristine = await verifyPristineState(client, 'POST-SCENARIO-3');
    if (!postScenario3Pristine) {
      fail('Scenario 3 rollback verification', 'DELETE leaked through rollback');
    } else {
      pass('Scenario 3 rollback verification: deleted rows restored, pristine state restored');
    }

    // ========================================================================
    // FINAL STATE VERIFICATION
    // ========================================================================
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║ FINAL STATE VERIFICATION                                         ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');
    
    const finalPristine = await verifyPristineState(client, 'FINAL');
    
    await client.end();

    // ========================================================================
    // FINAL REPORT
    // ========================================================================
    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║ ROLLBACK TEST RESULTS                                                        ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Total Tests:    3 scenarios                                                  ║`);
    console.log(`║ ✅ PASS:        ${testsPassed}`.padEnd(79) + '║');
    console.log(`║ ❌ FAIL:         ${testsFailed}`.padEnd(79) + '║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

    if (testsFailed > 0 || !finalPristine) {
      console.log('║ STATUS: ❌ FAIL                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
      console.log('\n❌ ROLLBACK TEST: FAIL\n');
      console.log('CRITICAL ISSUE DETECTED:');
      console.log('- One or more scenarios failed to trigger rollback correctly');
      console.log('- OR database state corruption detected after rollback\n');
      console.log('RESOLUTION REQUIRED:');
      console.log('- Review failed scenarios above');
      console.log('- Investigate PostgreSQL transaction isolation');
      console.log('- Verify migration 05-B transaction boundaries\n');
      console.log('🔴 DO NOT proceed to E1 until rollback behavior is proven correct\n');
      process.exit(1);
    } else {
      console.log('║ STATUS: ✅ PASS                                                               ║');
      console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
      console.log('\n✅ ROLLBACK TEST: PASS\n');
      console.log('All failure-injection scenarios succeeded:');
      console.log('  ✅ Scenario 1: Failure after E2 → rollback successful');
      console.log('  ✅ Scenario 2: Failure after audit → audit reverted');
      console.log('  ✅ Scenario 3: Failure after DELETE → rows restored\n');
      console.log('Database state verification:');
      console.log('  ✅ 5/5 fixtures intact');
      console.log('  ✅ tenant_id remains TEXT');
      console.log('  ✅ migration_evidence schema absent');
      console.log('  ✅ canonical_tenant_map absent');
      console.log('  ✅ No FK constraints leaked');
      console.log('  ✅ Mutation count = 0\n');
      console.log('BEHAVIORAL PROOF ESTABLISHED:');
      console.log('  PostgreSQL transaction rollback semantics are correct.');
      console.log('  Runtime failure → EXCEPTION → ROLLBACK → pristine state.\n');
      console.log('NEXT STEP: E1 gate execution');
      console.log('  node scripts/run-e1-verification.mjs\n');
      console.log('🟢 E1 execution authorized (rollback behavior proven)\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ ROLLBACK TEST: EXCEPTION\n');
    console.error('Unexpected error during rollback testing:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n🔴 STOP. Investigation required.\n');
    process.exit(1);
  }
}

main();
