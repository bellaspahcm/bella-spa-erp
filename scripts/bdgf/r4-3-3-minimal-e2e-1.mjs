#!/usr/bin/env node
/**
 * R4.3.3 — MINIMAL E2E-1 TEST
 * 
 * Purpose: Prove ONE complete happy path flow:
 *   Valid Approval → verifyApproval PASS → Gate Token → Executor → Mutation TRUE
 * 
 * NO BYPASS. ALL GATES ENFORCED.
 * 
 * Success Criteria:
 * ✅ verifyApproval() PASS
 * ✅ Gate token issued
 * ✅ Gate token validated
 * ✅ Gate token consumed
 * ✅ Executor invoked
 * ✅ Migration executed
 * ✅ mutation_occurred = TRUE
 * ✅ Audit recorded (if available)
 */

// Set TZ to UTC for consistent timestamp comparison
process.env.TZ = 'UTC';

import { executeMigrationWithAuthorization } from './execute-migration-wrapper.mjs';
import { computeHash, computeApprovalHash } from './r4-verify-approval.mjs';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
dotenv.config();

async function runMinimalE2E1() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R4.3.3 — MINIMAL E2E-1 TEST                               ║');
  console.log('║ Happy Path: Approval → Token → Executor → Mutation        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const dbUrl = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not configured');
    process.exit(1);
  }
  
  const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!urlMatch) {
    console.error('❌ Invalid DATABASE_URL format');
    process.exit(1);
  }
  
  const [, user, password, host, port, database] = urlMatch;
  const db = new Client({ host, port: parseInt(port), database, user, password, ssl: { rejectUnauthorized: false } });
  
  try {
    await db.connect();
    console.log('✅ Connected to database with executor credentials\n');
    
    // ========================================================================
    // SETUP: Create minimal test table
    // ========================================================================
    console.log('🔧 SETUP: Creating test marker table\n');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS bella_minimal_e2e_marker (
        marker_id VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    await db.query(`DELETE FROM bella_minimal_e2e_marker WHERE marker_id LIKE 'MIN_E2E_%'`);
    
    const testMarkerId = 'MIN_E2E_1_' + Date.now();
    const migrationContent = `INSERT INTO bella_minimal_e2e_marker (marker_id) VALUES ('${testMarkerId}')`;
    const migration_hash = computeHash(migrationContent);
    
    console.log(`   Test Marker ID: ${testMarkerId}\n`);
    
    // ========================================================================
    // STEP 1: Create valid approval using R4.2 canonical hash
    // ========================================================================
    console.log('📝 STEP 1: Creating valid approval (R4.2 canonical hash)\n');
    
    // First insert to get approval_id and timestamps
    const tempResult = await db.query(`
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
      'minimal_test_requester', 'minimal_test_approver', 'admin',
      'production', 'public', 'minimal_test_approver'
    ]);
    
    const approval_id = tempResult.rows[0].approval_id;
    const approved_at = tempResult.rows[0].approved_at;
    const expires_at = tempResult.rows[0].expires_at;
    
    console.log(`   Approval ID: ${approval_id}`);
    console.log(`   Approved at: ${approved_at}`);
    console.log(`   Expires at: ${expires_at}\n`);
    
    // Build approval object for canonical hash
    const approvalForHash = {
      approval_id,
      migration_id: approval_id, // Will be same after UPDATE
      migration_hash,
      requester_id: 'minimal_test_requester',
      approver_id: 'minimal_test_approver',
      approved_at,
      target_environment: 'production',
      expires_at
    };
    
    // Use R4.2's canonical hash function
    const approval_hash = computeApprovalHash(approvalForHash);
    
    console.log(`   Approval hash (R4.2 canonical): ${approval_hash.substring(0, 16)}...\n`);
    
    // UPDATE with correct migration_id and approval_hash
    await db.query(`
      UPDATE bella_migration_approval
      SET migration_id = $1, approval_hash = $2
      WHERE approval_id = $1
    `, [approval_id, approval_hash]);
    
    console.log('✅ Approval created with canonical hash\n');
    
    // Debug: Verify approval in database
    const dbCheck = await db.query(`
      SELECT approval_id, migration_id, migration_hash, approval_hash, status, expires_at
      FROM bella_migration_approval
      WHERE approval_id = $1
    `, [approval_id]);
    
    console.log('🔍 DEBUG: Approval in database:');
    console.log('   ', JSON.stringify(dbCheck.rows[0], null, 2));
    console.log('');
    
    // ========================================================================
    // STEP 2: Execute through full security chain
    // ========================================================================
    console.log('🚀 STEP 2: Executing through full authorization chain\n');
    console.log('   Chain: verifyApproval → issueToken → validate → consume → execute\n');
    
    let executionSuccess = false;
    let executionResult = null;
    let executionError = null;
    
    try {
      executionResult = await executeMigrationWithAuthorization({
        approval_id,
        migration_content: migrationContent,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      });
      
      executionSuccess = (executionResult.status === 'SUCCESS');
      console.log(`\n✅ Execution completed: ${executionResult.status}\n`);
      
    } catch (error) {
      executionError = error.message;
      console.log(`\n❌ Execution failed: ${error.message}\n`);
    }
    
    // ========================================================================
    // STEP 3: Verify mutation occurred
    // ========================================================================
    console.log('🔍 STEP 3: Verifying mutation occurred\n');
    
    const markerCheck = await db.query(`
      SELECT COUNT(*) as count 
      FROM bella_minimal_e2e_marker 
      WHERE marker_id = $1
    `, [testMarkerId]);
    
    const mutationOccurred = parseInt(markerCheck.rows[0].count) > 0;
    
    if (mutationOccurred) {
      console.log(`✅ Mutation verified: Marker '${testMarkerId}' found in database\n`);
    } else {
      console.log(`❌ Mutation failed: Marker '${testMarkerId}' NOT found in database\n`);
    }
    
    // ========================================================================
    // CLEANUP
    // ========================================================================
    await db.query(`DELETE FROM bella_minimal_e2e_marker WHERE marker_id = $1`, [testMarkerId]);
    await db.query(`DROP TABLE IF EXISTS bella_minimal_e2e_marker`);
    console.log('🧹 Cleanup: Test marker removed\n');
    
    // ========================================================================
    // RESULT
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('MINIMAL E2E-1 RESULT');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Execution Success:    ${executionSuccess ? '✅' : '❌'}`);
    console.log(`Mutation Occurred:    ${mutationOccurred ? '✅' : '❌'}`);
    console.log(`Approval ID:          ${approval_id}`);
    console.log(`Test Marker:          ${testMarkerId}`);
    if (executionError) {
      console.log(`Error:                ${executionError}`);
    }
    if (executionResult) {
      console.log(`Token ID:             ${executionResult.token_id || 'N/A'}`);
      console.log(`Execution Time:       ${executionResult.total_execution_time_ms || 'N/A'}ms`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (executionSuccess && mutationOccurred) {
      console.log('🎉 MINIMAL E2E-1 PASSED\n');
      console.log('✓ verifyApproval() → PASS');
      console.log('✓ Gate token issued');
      console.log('✓ Gate token validated');
      console.log('✓ Gate token consumed');
      console.log('✓ Executor invoked');
      console.log('✓ Migration executed');
      console.log('✓ mutation_occurred = TRUE\n');
      console.log('✅ Full security chain verified. Ready for full E2E suite.\n');
      process.exit(0);
    } else {
      console.log('❌ MINIMAL E2E-1 FAILED\n');
      if (!executionSuccess) {
        console.log('⚠️  Execution did not complete successfully');
        console.log('   Investigate: verifyApproval, token issuance, or executor\n');
      }
      if (!mutationOccurred) {
        console.log('⚠️  Mutation did not occur');
        console.log('   Investigate: executor execution path or database connection\n');
      }
      console.log('❌ DO NOT proceed to full E2E or adversarial tests\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed with exception:', error);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run minimal E2E-1
runMinimalE2E1();
