#!/usr/bin/env node
/**
 * R4.3.4.1 — FULL END-TO-END LIFECYCLE TEST
 * 
 * Prove complete authorization → execution chain works end-to-end:
 * 
 * Developer Request
 *     ↓
 * R3 Authority (Permission Check)
 *     ↓
 * R4.2 Approval Gate (Create + Verify)
 *     ↓
 * R4.3.2 Gate Token (Issue)
 *     ↓
 * R4.3.3 Execution Boundary (Validate + Consume + Execute)
 *     ↓
 * Migration Execution
 *     ↓
 * Audit Trail
 *     ↓
 * Result Verification
 * 
 * This is NOT a unit test. This is INTEGRATION PROOF.
 */

process.env.TZ = 'UTC';

import { executeMigrationWithAuthorization } from './execute-migration-wrapper.mjs';
import { computeHash, computeApprovalHash } from './r4-verify-approval.mjs';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
dotenv.config();

async function runFullLifecycleTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R4.3.4.1 — FULL END-TO-END LIFECYCLE TEST                 ║');
  console.log('║ Complete Authorization → Execution Chain                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const dbUrl = process.env.DATABASE_URL;
  const executorUrl = process.env.DATABASE_EXECUTOR_URL || dbUrl;
  
  if (!dbUrl || !executorUrl) {
    console.error('❌ DATABASE_URL or DATABASE_EXECUTOR_URL not configured');
    process.exit(1);
  }
  
  // Parse URLs
  const parseUrl = (url) => {
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) throw new Error('Invalid DATABASE_URL format');
    const [, user, password, host, port, database] = match;
    return { host, port: parseInt(port), database, user, password, ssl: { rejectUnauthorized: false } };
  };
  
  const devConfig = parseUrl(dbUrl);
  const execConfig = parseUrl(executorUrl);
  
  const devDb = new Client(devConfig);
  const execDb = new Client(execConfig);
  
  const testId = 'LIFECYCLE_' + Date.now();
  let lifecycleSuccess = true;
  let lifecycleSteps = [];
  
  function logStep(step, status, details = '') {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '🔄';
    console.log(`${icon} ${step}`);
    if (details) console.log(`   ${details}\n`);
    lifecycleSteps.push({ step, status, details });
    if (status === 'FAIL') lifecycleSuccess = false;
  }
  
  try {
    await devDb.connect();
    await execDb.connect();
    console.log('✅ Connected to database (developer + executor credentials)\n');
    
    // ========================================================================
    // STEP 0: Setup test table
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 0: Environment Setup');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    await execDb.query(`
      CREATE TABLE IF NOT EXISTS bella_lifecycle_test (
        test_id VARCHAR(50) PRIMARY KEY,
        test_name VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await execDb.query(`DELETE FROM bella_lifecycle_test WHERE test_id LIKE 'LIFECYCLE_%'`);
    
    logStep('Environment setup', 'PASS', 'Test table created');
    
    // ========================================================================
    // STEP 1: Developer Request (R3 Authority Check)
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 1: Developer Request (R3 Authority Check)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Developer attempts to directly mutate Production...\n');
    
    let developerBlocked = false;
    try {
      await devDb.query(`INSERT INTO bella_lifecycle_test (test_id, test_name) VALUES ('${testId}', 'Direct Insert')`);
      logStep('R3 Authority: Developer direct mutation', 'FAIL', 'Developer was NOT blocked by R3');
    } catch (error) {
      if (error.message.includes('permission denied')) {
        developerBlocked = true;
        logStep('R3 Authority: Developer direct mutation', 'PASS', 'Developer blocked by R3 (permission denied)');
      } else {
        logStep('R3 Authority: Developer direct mutation', 'FAIL', `Unexpected error: ${error.message}`);
      }
    }
    
    if (!developerBlocked) {
      console.log('❌ LIFECYCLE FAILED: R3 authority not enforced\n');
      process.exit(1);
    }
    
    console.log('Developer must request approval through proper channel...\n');
    
    // ========================================================================
    // STEP 2: Create Migration Request
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 2: Migration Request Submission');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const migrationContent = `INSERT INTO bella_lifecycle_test (test_id, test_name) VALUES ('${testId}', 'Authorized Migration')`;
    const migration_hash = computeHash(migrationContent);
    
    console.log('Migration Request:');
    console.log(`  Content: ${migrationContent}`);
    console.log(`  Hash: ${migration_hash.substring(0, 16)}...\n`);
    
    logStep('Migration request prepared', 'PASS', `Hash: ${migration_hash.substring(0, 16)}...`);
    
    // ========================================================================
    // STEP 3: R4.2 Approval Gate (Create Approval)
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 3: R4.2 Approval Gate (Authorization)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Admin/DBA creates approval for migration...\n');
    
    // Create approval with proper hash
    const tempResult = await execDb.query(`
      INSERT INTO bella_migration_approval (
        migration_id, migration_hash, requester_id, approver_id,
        approver_role, target_environment, target_schema,
        expires_at, valid_from,
        approval_hash, status, created_by, created_at, approved_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        (NOW() AT TIME ZONE 'UTC') + INTERVAL '2 hours',
        (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 minute',
        'temp', 'approved', $8,
        NOW() AT TIME ZONE 'UTC',
        NOW() AT TIME ZONE 'UTC'
      )
      RETURNING approval_id, approved_at, expires_at
    `, [
      'TEMP_MIG', migration_hash,
      'lifecycle_developer', 'lifecycle_approver', 'admin',
      'production', 'public', 'lifecycle_approver'
    ]);
    
    const approval_id = tempResult.rows[0].approval_id;
    const approved_at = tempResult.rows[0].approved_at;
    const expires_at = tempResult.rows[0].expires_at;
    
    // Compute canonical approval hash
    const approvalForHash = {
      approval_id,
      migration_id: approval_id,
      migration_hash,
      requester_id: 'lifecycle_developer',
      approver_id: 'lifecycle_approver',
      approved_at,
      target_environment: 'production',
      expires_at
    };
    
    const approval_hash = computeApprovalHash(approvalForHash);
    
    // Update with correct hash
    await execDb.query(`
      UPDATE bella_migration_approval
      SET migration_id = $1, approval_hash = $2
      WHERE approval_id = $1
    `, [approval_id, approval_hash]);
    
    console.log(`Approval created:`);
    console.log(`  Approval ID: ${approval_id}`);
    console.log(`  Approver: lifecycle_approver (admin)`);
    console.log(`  Expires: ${expires_at.toISOString()}\n`);
    
    logStep('R4.2 Approval created', 'PASS', `Approval ID: ${approval_id}`);
    
    // ========================================================================
    // STEP 4: R4.3 Complete Authorization → Execution Chain
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 4: R4.3 Authorization → Execution Chain');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Executing migration through R4.3 wrapper...\n');
    console.log('This triggers:');
    console.log('  → R4.2 Approval Verification (8 invariants)');
    console.log('  → R4.3.2 Gate Token Issuance');
    console.log('  → R4.3.3 Executor Authorization (3 gates)');
    console.log('  → Migration Execution');
    console.log('  → Audit Trail\n');
    
    let executionResult;
    let executionSuccess = false;
    
    try {
      executionResult = await executeMigrationWithAuthorization({
        approval_id,
        migration_content: migrationContent,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      });
      
      executionSuccess = executionResult.status === 'SUCCESS';
      
      if (executionSuccess) {
        console.log('✅ Execution completed successfully\n');
        console.log(`  Status: ${executionResult.status}`);
        console.log(`  Token ID: ${executionResult.token_id}`);
        console.log(`  Rows Affected: ${executionResult.rows_affected}`);
        console.log(`  Total Time: ${executionResult.total_execution_time_ms}ms\n`);
        
        logStep('R4.3 Authorization chain', 'PASS', 'All gates passed, execution succeeded');
      } else {
        console.log(`❌ Execution failed: ${executionResult.status}\n`);
        logStep('R4.3 Authorization chain', 'FAIL', `Status: ${executionResult.status}`);
      }
      
    } catch (error) {
      console.log(`❌ Execution failed with exception: ${error.message}\n`);
      logStep('R4.3 Authorization chain', 'FAIL', `Exception: ${error.message}`);
    }
    
    // ========================================================================
    // STEP 5: Verify Mutation Occurred
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 5: Mutation Verification');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const mutationCheck = await execDb.query(`
      SELECT * FROM bella_lifecycle_test WHERE test_id = $1
    `, [testId]);
    
    const mutationOccurred = mutationCheck.rows.length > 0;
    
    if (mutationOccurred) {
      console.log(`✅ Mutation verified in database`);
      console.log(`  Test ID: ${testId}`);
      console.log(`  Test Name: ${mutationCheck.rows[0].test_name}`);
      console.log(`  Created At: ${mutationCheck.rows[0].created_at}\n`);
      
      logStep('Mutation verification', 'PASS', 'Record found in database');
    } else {
      console.log(`❌ Mutation NOT found in database\n`);
      logStep('Mutation verification', 'FAIL', 'Record not found');
    }
    
    // ========================================================================
    // STEP 6: Verify Audit Trail
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 6: Audit Trail Verification');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Check gate tokens table
    const tokenCheck = await execDb.query(`
      SELECT token_id, status, created_at, used_at
      FROM bella_gate_tokens
      WHERE approval_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [approval_id]);
    
    if (tokenCheck.rows.length > 0) {
      const token = tokenCheck.rows[0];
      console.log(`✅ Gate token audit found`);
      console.log(`  Token ID: ${token.token_id}`);
      console.log(`  Status: ${token.status}`);
      console.log(`  Issued: ${token.created_at}`);
      console.log(`  Used: ${token.used_at || 'N/A'}\n`);
      
      logStep('Audit trail: Gate token', 'PASS', `Token ID: ${token.token_id}, Status: ${token.status}`);
    } else {
      console.log(`⚠️  No gate token found in audit\n`);
      logStep('Audit trail: Gate token', 'FAIL', 'Token not found');
    }
    
    // Check approval status
    const approvalCheck = await execDb.query(`
      SELECT status, approved_at, used_at
      FROM bella_migration_approval
      WHERE approval_id = $1
    `, [approval_id]);
    
    if (approvalCheck.rows.length > 0) {
      const approval = approvalCheck.rows[0];
      console.log(`✅ Approval record found`);
      console.log(`  Status: ${approval.status}`);
      console.log(`  Approved: ${approval.approved_at}`);
      console.log(`  Used: ${approval.used_at || 'N/A'}\n`);
      
      logStep('Audit trail: Approval', 'PASS', `Status: ${approval.status}`);
    } else {
      console.log(`❌ Approval record not found\n`);
      logStep('Audit trail: Approval', 'FAIL', 'Approval not found');
    }
    
    // ========================================================================
    // STEP 7: Verify Developer Still Cannot Bypass
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 7: Post-Execution Authority Check');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Developer attempts direct mutation again (should still be blocked)...\n');
    
    let stillBlocked = false;
    try {
      await devDb.query(`INSERT INTO bella_lifecycle_test (test_id, test_name) VALUES ('BYPASS_${testId}', 'Bypass Attempt')`);
      logStep('Post-execution: Developer bypass attempt', 'FAIL', 'Developer was NOT blocked');
    } catch (error) {
      if (error.message.includes('permission denied')) {
        stillBlocked = true;
        logStep('Post-execution: Developer bypass attempt', 'PASS', 'Developer still blocked by R3');
      } else {
        logStep('Post-execution: Developer bypass attempt', 'FAIL', `Unexpected error: ${error.message}`);
      }
    }
    
    // ========================================================================
    // CLEANUP
    // ========================================================================
    await execDb.query(`DELETE FROM bella_lifecycle_test WHERE test_id = $1`, [testId]);
    await execDb.query(`DROP TABLE IF EXISTS bella_lifecycle_test`);
    console.log('🧹 Cleanup: Test data removed\n');
    
    // ========================================================================
    // LIFECYCLE SUMMARY
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('FULL LIFECYCLE TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    lifecycleSteps.forEach((s, i) => {
      const icon = s.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} Step ${i}: ${s.step} → ${s.status}`);
      if (s.details) console.log(`   ${s.details}`);
    });
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (lifecycleSuccess && executionSuccess && mutationOccurred && developerBlocked && stillBlocked) {
      console.log('🎉 FULL LIFECYCLE TEST PASSED\n');
      console.log('Complete chain verified:');
      console.log('  ✅ R3: Developer blocked from direct mutation');
      console.log('  ✅ R4.2: Approval gate enforced');
      console.log('  ✅ R4.3.2: Gate token issued');
      console.log('  ✅ R4.3.3: Executor authorization enforced');
      console.log('  ✅ Migration executed successfully');
      console.log('  ✅ Mutation verified in database');
      console.log('  ✅ Audit trail recorded');
      console.log('  ✅ Post-execution: Authority maintained\n');
      console.log('✅ Authorization → Execution lifecycle is COMPLETE and SECURE\n');
      process.exit(0);
    } else {
      console.log('❌ FULL LIFECYCLE TEST FAILED\n');
      console.log('One or more steps in the authorization → execution chain failed.\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Lifecycle test failed with exception:', error);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await devDb.end();
    await execDb.end();
  }
}

// Run full lifecycle test
runFullLifecycleTest();
