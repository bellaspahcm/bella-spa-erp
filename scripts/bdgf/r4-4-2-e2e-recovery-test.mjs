#!/usr/bin/env node
/**
 * R4.4.2 — E2E RECOVERY TEST
 * 
 * Proves recovery procedures work end-to-end for all 4 failure types.
 * 
 * Test Scenarios:
 * 1. Authorization Failure → Verify zero mutation
 * 2. Transactional Failure → Verify auto-rollback
 * 3. Non-Transactional Failure → Inspect partial state (simulated)
 * 4. Environment Failure → Inspect unknown state (simulated)
 * 
 * Success Criteria:
 * - Incident created ✅
 * - Recovery procedure executed ✅
 * - Verification passed ✅
 * - Recovery action recorded ✅
 */

process.env.TZ = 'UTC';

import dotenv from 'dotenv';
import crypto from 'crypto';
import { executeWithMonitoring } from './r4-4-monitoring.mjs';
import { executeRecovery } from './r4-4-2-recovery-control.mjs';
import {
  getTestDB,
  cleanupTestData,
  createUsedToken,
  createTokenForInvalidSQL
} from './r4-4-test-fixtures.mjs';

dotenv.config();

let testCount = 0;
let passCount = 0;
let failCount = 0;

function testResult(name, pass, details = '') {
  testCount++;
  const icon = pass ? '✅' : '❌';
  const status = pass ? 'PASS' : 'FAIL';
  
  console.log(`${icon} Test ${testCount}: ${name} → ${status}`);
  if (details) console.log(`   ${details}`);
  console.log('');
  
  if (pass) passCount++;
  else failCount++;
}

async function runE2ERecoveryTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R4.4.2 — E2E RECOVERY TEST                               ║');
  console.log('║ 4 Failure Types × Recovery Procedures                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const db = await getTestDB();
  
  try {
    console.log('🧹 Cleaning up old test data...\n');
    await cleanupTestData(db);
    
    // ========================================================================
    // TEST 1: Authorization Failure Recovery
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('TEST 1: Authorization Failure Recovery');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Step 1: Creating replay attack scenario...');
    const { token: replayToken, migration_content: replaySQL } = await createUsedToken(db);
    console.log(`✅ Token created and marked as used: ${replayToken.token_id}\n`);
    
    console.log('Step 2: Attempting execution (should be blocked)...');
    let test1IncidentId = null;
    
    try {
      await executeWithMonitoring({
        token: replayToken,
        migration_content: replaySQL,
        executor_identity: 'bella_migration_executor'
      });
      console.log('⚠️  Execution was not blocked (unexpected)\n');
    } catch (error) {
      console.log(`✅ Execution blocked: ${error.code}\n`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Get incident ID
    const test1Incident = await db.query(`
      SELECT incident_id, incident_type
      FROM bella_security_incidents
      WHERE token_id = $1
      ORDER BY occurred_at DESC LIMIT 1
    `, [replayToken.token_id]);
    
    if (test1Incident.rows.length > 0) {
      test1IncidentId = test1Incident.rows[0].incident_id;
      console.log(`✅ Incident recorded: ${test1IncidentId}\n`);
    } else {
      console.log('❌ No incident found\n');
    }
    
    console.log('Step 3: Executing recovery procedure...');
    const recovery1 = await executeRecovery(test1IncidentId, db);
    
    const test1Pass = recovery1 && 
                     recovery1.status === 'verified' &&
                     recovery1.classification.type === 'AUTHORIZATION_FAILURE' &&
                     recovery1.verification.verified === true;
    
    testResult(
      'Authorization Failure → Zero Mutation Verified',
      test1Pass,
      test1Pass 
        ? `Recovery ${recovery1.recovery_id}: ${recovery1.verification.reason}`
        : 'Recovery verification failed'
    );
    
    // ========================================================================
    // TEST 2: Transactional Failure Recovery
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('TEST 2: Transactional Failure Recovery');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Step 1: Creating token for invalid SQL...');
    const { token: invalidToken, migration_content: invalidSQL } = await createTokenForInvalidSQL(db, {
      invalidSQL: 'CREATE TABL syntax_error (id INT)' // Typo: TABL
    });
    console.log(`✅ Token created: ${invalidToken.token_id}\n`);
    
    console.log('Step 2: Attempting execution (should fail with syntax error)...');
    let test2IncidentId = null;
    
    try {
      await executeWithMonitoring({
        token: invalidToken,
        migration_content: invalidSQL,
        executor_identity: 'bella_migration_executor'
      });
      console.log('⚠️  Execution succeeded (unexpected)\n');
    } catch (error) {
      console.log(`✅ Execution failed: ${error.message}\n`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Get incident ID
    const test2Incident = await db.query(`
      SELECT incident_id, incident_type
      FROM bella_security_incidents
      WHERE token_id = $1
      ORDER BY occurred_at DESC LIMIT 1
    `, [invalidToken.token_id]);
    
    if (test2Incident.rows.length > 0) {
      test2IncidentId = test2Incident.rows[0].incident_id;
      console.log(`✅ Incident recorded: ${test2IncidentId}\n`);
    } else {
      console.log('❌ No incident found\n');
    }
    
    console.log('Step 3: Executing recovery procedure...');
    const recovery2 = await executeRecovery(test2IncidentId, db);
    
    const test2Pass = recovery2 && 
                     recovery2.status === 'verified' &&
                     recovery2.classification.type === 'TRANSACTIONAL_FAILURE' &&
                     recovery2.verification.verified === true;
    
    testResult(
      'Transactional Failure → Auto-Rollback Verified',
      test2Pass,
      test2Pass 
        ? `Recovery ${recovery2.recovery_id}: ${recovery2.verification.reason}`
        : 'Recovery verification failed'
    );
    
    // ========================================================================
    // TEST 3: Non-Transactional Failure (Simulated)
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('TEST 3: Non-Transactional Failure Recovery (Simulated)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Note: Non-transactional DDL requires manual setup.');
    console.log('      Simulating by creating incident with non_transactional flag.\n');
    
    // Create simulated incident
    const test3IncidentId = crypto.randomUUID();
    await db.query(`
      INSERT INTO bella_security_incidents (
        incident_id,
        incident_type,
        severity,
        occurred_at,
        detected_at,
        detection_method,
        error_code,
        error_message,
        error_details,
        recovery_required,
        recovery_status,
        created_by
      ) VALUES (
        $1, 'execution_failure', 'ERROR', NOW(), NOW(),
        'executeMigration', 'UNKNOWN',
        'Simulated non-transactional failure',
        $2, true, 'pending', 'system'
      )
    `, [test3IncidentId, JSON.stringify({ non_transactional: true })]);
    
    console.log(`✅ Simulated incident created: ${test3IncidentId}\n`);
    
    console.log('Step 3: Executing recovery procedure...');
    const recovery3 = await executeRecovery(test3IncidentId, db);
    
    const test3Pass = recovery3 && 
                     recovery3.classification.type === 'NON_TRANSACTIONAL_FAILURE' &&
                     recovery3.status === 'needs_action';
    
    testResult(
      'Non-Transactional Failure → Manual Inspection Required',
      test3Pass,
      test3Pass 
        ? `Recovery ${recovery3.recovery_id}: Requires manual review`
        : 'Recovery classification failed'
    );
    
    // ========================================================================
    // TEST 4: Environment Failure (Simulated)
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('TEST 4: Environment Failure Recovery (Simulated)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Note: Environment failure requires network/DB interruption.');
    console.log('      Simulating by creating incident with timeout flag.\n');
    
    // Create simulated incident
    const test4IncidentId = crypto.randomUUID();
    await db.query(`
      INSERT INTO bella_security_incidents (
        incident_id,
        incident_type,
        severity,
        occurred_at,
        detected_at,
        detection_method,
        error_code,
        error_message,
        error_details,
        recovery_required,
        recovery_status,
        created_by
      ) VALUES (
        $1, 'execution_failure', 'ERROR', NOW(), NOW(),
        'executeMigration', 'ETIMEDOUT',
        'Simulated environment failure',
        $2, true, 'pending', 'system'
      )
    `, [test4IncidentId, JSON.stringify({ timeout: true, network_error: true })]);
    
    console.log(`✅ Simulated incident created: ${test4IncidentId}\n`);
    
    console.log('Step 3: Executing recovery procedure...');
    const recovery4 = await executeRecovery(test4IncidentId, db);
    
    const test4Pass = recovery4 && 
                     recovery4.classification.type === 'ENVIRONMENT_FAILURE' &&
                     (recovery4.status === 'verified' || recovery4.status === 'needs_action');
    
    testResult(
      'Environment Failure → State Inspection Complete',
      test4Pass,
      test4Pass 
        ? `Recovery ${recovery4.recovery_id}: ${recovery4.verification.reason}`
        : 'Recovery inspection failed'
    );
    
    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('E2E RECOVERY TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`Total Tests: ${testCount}`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}\n`);
    
    // Query recovery actions
    const recoveries = await db.query(`
      SELECT action_type, execution_result, COUNT(*) as count
      FROM bella_recovery_actions
      GROUP BY action_type, execution_result
      ORDER BY action_type
    `);
    
    console.log('📊 Recovery Actions Recorded:');
    if (recoveries.rows.length > 0) {
      recoveries.rows.forEach(row => {
        console.log(`   ${row.action_type}: ${row.count} (${row.execution_result})`);
      });
    } else {
      console.log('   (none)');
    }
    console.log('');
    
    if (passCount === testCount) {
      console.log('🎉 ALL E2E RECOVERY TESTS PASSED\n');
      console.log('Recovery Procedures Verified:');
      console.log('  ✅ Type 1: Authorization Failure → Zero mutation verified');
      console.log('  ✅ Type 2: Transactional Failure → Auto-rollback verified');
      console.log('  ✅ Type 3: Non-Transactional → Manual inspection triggered');
      console.log('  ✅ Type 4: Environment Failure → State inspection complete\n');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ R4.4.2 RECOVERY CONTROL VERIFIED');
      console.log('═══════════════════════════════════════════════════════════\n');
      process.exit(0);
    } else {
      console.log('❌ E2E RECOVERY INCOMPLETE\n');
      console.log(`Tests passed: ${passCount}/${testCount}\n`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n❌ Test execution error: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.end();
  }
}

runE2ERecoveryTests();
