#!/usr/bin/env node
/**
 * R4.2 — Approval Gate Test Suite
 * 
 * Tests all 12 scenarios from R4.1 contract:
 * - 11 negative tests (must BLOCK)
 * - 1 positive test (must PASS)
 * 
 * Contract: docs/architecture/R4_APPROVAL_CONTRACT_SPECIFICATION.md v1.0.0
 */

import { verifyApproval, computeHash } from './r4-verify-approval.mjs';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, expected, actual, evidence = {}) {
  testCount++;
  const pass = expected === actual;
  
  if (pass) {
    console.log(`✅ Test ${testCount}: ${name}`);
    passCount++;
  } else {
    console.log(`❌ Test ${testCount}: ${name}`);
    console.log(`   Expected: ${expected}`);
    console.log(`   Actual: ${actual}`);
    if (Object.keys(evidence).length > 0) {
      console.log(`   Evidence:`, JSON.stringify(evidence, null, 2));
    }
    failCount++;
  }
}

// ============================================================================
// TEST SETUP
// ============================================================================

async function setupApproval(db, overrides = {}) {
  const defaultApproval = {
    migration_id: 'M_TEST_001',
    migration_hash: computeHash('SELECT 1;'), // Default migration
    requester_id: 'user_requester',
    approver_id: 'user_approver',
    approver_role: 'admin',
    target_environment: 'production',
    target_schema: null,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
    status: 'approved',
    created_by: 'user_requester',
    ...overrides
  };
  
  // Insert approval with placeholder hash (will be replaced)
  const result = await db.query(`
    INSERT INTO bella_migration_approval (
      migration_id, migration_hash, requester_id, approver_id, approver_role,
      target_environment, target_schema, expires_at, valid_from, valid_until,
      status, approval_hash, created_by, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *
  `, [
    defaultApproval.migration_id,
    defaultApproval.migration_hash,
    defaultApproval.requester_id,
    defaultApproval.approver_id,
    defaultApproval.approver_role,
    defaultApproval.target_environment,
    defaultApproval.target_schema,
    defaultApproval.expires_at,
    defaultApproval.valid_from || null,
    defaultApproval.valid_until || null,
    defaultApproval.status,
    '0000000000000000000000000000000000000000000000000000000000000000', // Placeholder
    defaultApproval.created_by,
    defaultApproval.notes || 'Test approval'
  ]);
  
  const inserted = result.rows[0];
  
  // Now compute approval hash using ACTUAL database values
  const canonical = {
    approval_id: inserted.approval_id,
    migration_id: inserted.migration_id,
    migration_hash: inserted.migration_hash,
    requester_id: inserted.requester_id,
    approver_id: inserted.approver_id,
    approved_at: new Date(inserted.approved_at).toISOString(),
    target_environment: inserted.target_environment,
    expires_at: new Date(inserted.expires_at).toISOString()
  };
  
  const sorted = Object.keys(canonical).sort().reduce((obj, key) => {
    obj[key] = canonical[key];
    return obj;
  }, {});
  
  const approvalHash = computeHash(JSON.stringify(sorted));
  
  // Update with correct hash
  const updateResult = await db.query(`
    UPDATE bella_migration_approval
    SET approval_hash = $1
    WHERE approval_id = $2
    RETURNING *
  `, [approvalHash, inserted.approval_id]);
  
  return updateResult.rows[0];
}

async function cleanupApprovals(db) {
  await db.query(`DELETE FROM bella_migration_approval WHERE migration_id LIKE 'M_TEST_%'`);
}

// ============================================================================
// TEST SUITE
// ============================================================================

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R4.2 — APPROVAL GATE TEST SUITE                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Database connection - use executor for mutation tests
  const dbUrl = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not configured');
    process.exit(1);
  }
  
  const pg = await import('pg');
  const { Client } = pg.default;
  
  const dbUrlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!dbUrlMatch) {
    console.error('❌ Invalid DATABASE_URL format');
    process.exit(1);
  }
  
  const [, user, password, host, port, database] = dbUrlMatch;
  const db = new Client({ host, port: parseInt(port), database, user, password, ssl: { rejectUnauthorized: false } });
  
  try {
    await db.connect();
    console.log('✅ Connected to database\n');
    
    // Cleanup before tests
    await cleanupApprovals(db);
    
    // ========================================================================
    // TEST 1: No approval exists → BLOCK
    // ========================================================================
    console.log('🧪 TEST 1: No Approval Found');
    {
      const result = await verifyApproval({
        migration_id: 'M_TEST_NONEXISTENT',
        migration_content: 'SELECT 1;',
        execution_environment: 'production'
      });
      
      test('No approval → BLOCK', 'BLOCK', result.decision, result.evidence);
      test('Reason: NO_APPROVAL_FOUND', 'NO_APPROVAL_FOUND', result.reason);
    }
    console.log('');
    
    // ========================================================================
    // TEST 2: Self-approval → BLOCK (I0)
    // ========================================================================
    console.log('🧪 TEST 2: Self-Approval Forbidden (I0)');
    {
      try {
        await setupApproval(db, {
          migration_id: 'M_TEST_SELF',
          requester_id: 'user_same',
          approver_id: 'user_same' // SAME USER
        });
        
        // If INSERT succeeded, test with verifyApproval
        const result = await verifyApproval({
          migration_id: 'M_TEST_SELF',
          migration_content: 'SELECT 1;',
          execution_environment: 'production'
        });
        
        test('Self-approval → BLOCK', 'BLOCK', result.decision, result.evidence);
        test('Reason: SELF_APPROVAL_FORBIDDEN', 'SELF_APPROVAL_FORBIDDEN', result.reason);
      } catch (error) {
        // Database constraint blocked it - this is CORRECT behavior
        if (error.code === '23514' && error.constraint === 'no_self_approval') {
          test('Self-approval → BLOCK (DB constraint)', 'PASS', 'PASS');
          test('Constraint enforced: no_self_approval', true, true);
        } else {
          throw error; // Unexpected error
        }
      }
    }
    console.log('');
    
    // ========================================================================
    // TEST 3: Migration hash mismatch → BLOCK (I1)
    // ========================================================================
    console.log('🧪 TEST 3: Migration Hash Mismatch (I1)');
    {
      await setupApproval(db, {
        migration_id: 'M_TEST_HASH',
        migration_hash: computeHash('SELECT 1;')
      });
      
      const result = await verifyApproval({
        migration_id: 'M_TEST_HASH',
        migration_content: 'SELECT 2;', // DIFFERENT content
        execution_environment: 'production'
      });
      
      test('Hash mismatch → BLOCK', 'BLOCK', result.decision, result.evidence);
      test('Reason: MIGRATION_HASH_MISMATCH', 'MIGRATION_HASH_MISMATCH', result.reason);
    }
    console.log('');
    
    // ========================================================================
    // TEST 4: Wrong environment → BLOCK (I2, I5)
    // ========================================================================
    console.log('🧪 TEST 4: Environment Mismatch (I2, I5)');
    {
      await setupApproval(db, {
        migration_id: 'M_TEST_ENV',
        target_environment: 'staging' // Approved for staging
      });
      
      const result = await verifyApproval({
        migration_id: 'M_TEST_ENV',
        migration_content: 'SELECT 1;',
        execution_environment: 'production' // Trying to execute in production
      });
      
      test('Wrong environment → BLOCK', 'BLOCK', result.decision, result.evidence);
      test('Reason: ENVIRONMENT_MISMATCH', 'ENVIRONMENT_MISMATCH', result.reason);
    }
    console.log('');
    
    // ========================================================================
    // TEST 5: Wrong schema → BLOCK (I2)
    // ========================================================================
    console.log('🧪 TEST 5: Schema Mismatch (I2)');
    {
      await setupApproval(db, {
        migration_id: 'M_TEST_SCHEMA',
        target_schema: 'schema_a'
      });
      
      const result = await verifyApproval({
        migration_id: 'M_TEST_SCHEMA',
        migration_content: 'SELECT 1;',
        execution_environment: 'production',
        execution_schema: 'schema_b' // DIFFERENT schema
      });
      
      test('Wrong schema → BLOCK', 'BLOCK', result.decision, result.evidence);
      test('Reason: SCHEMA_MISMATCH', 'SCHEMA_MISMATCH', result.reason);
    }
    console.log('');
    
    // ========================================================================
    // TEST 6: Approval expired → BLOCK (I4)
    // ========================================================================
    console.log('🧪 TEST 6: Approval Expired (I4)');
    {
      await setupApproval(db, {
        migration_id: 'M_TEST_EXPIRED',
        expires_at: new Date(Date.now() - 1000) // Expired 1 second ago
      });
      
      const result = await verifyApproval({
        migration_id: 'M_TEST_EXPIRED',
        migration_content: 'SELECT 1;',
        execution_environment: 'production'
      });
      
      test('Expired approval → BLOCK', 'BLOCK', result.decision, result.evidence);
      test('Reason: APPROVAL_EXPIRED', 'APPROVAL_EXPIRED', result.reason);
    }
    console.log('');
    
    // ========================================================================
    // TEST 7: Not yet valid → BLOCK (I4)
    // ========================================================================
    console.log('🧪 TEST 7: Approval Not Yet Valid (I4)');
    {
      await setupApproval(db, {
        migration_id: 'M_TEST_FUTURE',
        valid_from: new Date(Date.now() + 60 * 60 * 1000) // Valid from 1 hour in future
      });
      
      const result = await verifyApproval({
        migration_id: 'M_TEST_FUTURE',
        migration_content: 'SELECT 1;',
        execution_environment: 'production'
      });
      
      test('Not yet valid → BLOCK', 'BLOCK', result.decision, result.evidence);
      test('Reason: APPROVAL_NOT_YET_VALID', 'APPROVAL_NOT_YET_VALID', result.reason);
    }
    console.log('');
    
    // ========================================================================
    // TEST 8: Already used → BLOCK (I3)
    // ========================================================================
    console.log('🧪 TEST 8: Approval Already Used (I3 - Replay Protection)');
    {
      const approval = await setupApproval(db, {
        migration_id: 'M_TEST_REPLAY'
      });
      
      // First use - should PASS
      const firstUse = await verifyApproval({
        migration_id: 'M_TEST_REPLAY',
        migration_content: 'SELECT 1;',
        execution_environment: 'production'
      });
      
      test('First use → PASS', 'PASS', firstUse.decision);
      
      // Second use - should BLOCK (replay)
      const secondUse = await verifyApproval({
        migration_id: 'M_TEST_REPLAY',
        migration_content: 'SELECT 1;',
        execution_environment: 'production'
      });
      
      test('Replay attempt → BLOCK', 'BLOCK', secondUse.decision, secondUse.evidence);
      test('Reason: NO_APPROVAL_FOUND or ALREADY_USED', 
        secondUse.reason === 'NO_APPROVAL_FOUND' || secondUse.reason === 'APPROVAL_ALREADY_USED',
        true);
    }
    console.log('');
    
    // ========================================================================
    // TEST 9: Unauthorized approver → BLOCK (I6)
    // ========================================================================
    console.log('🧪 TEST 9: Unauthorized Approver (I6)');
    {
      await setupApproval(db, {
        migration_id: 'M_TEST_UNAUTH',
        approver_role: 'tech_lead', // tech_lead NOT authorized for production
        target_environment: 'production'
      });
      
      const result = await verifyApproval({
        migration_id: 'M_TEST_UNAUTH',
        migration_content: 'SELECT 1;',
        execution_environment: 'production'
      });
      
      test('Unauthorized approver → BLOCK', 'BLOCK', result.decision, result.evidence);
      test('Reason: UNAUTHORIZED_APPROVER', 'UNAUTHORIZED_APPROVER', result.reason);
    }
    console.log('');
    
    // ========================================================================
    // TEST 10: Approval tampered → BLOCK (I7)
    // ========================================================================
    console.log('🧪 TEST 10: Approval Tampered (I7)');
    {
      const approval = await setupApproval(db, {
        migration_id: 'M_TEST_TAMPER'
      });
      
      // Tamper with approval hash
      await db.query(`
        UPDATE bella_migration_approval
        SET approval_hash = 'tampered_hash_0000000000000000000000000000000000000000000000'
        WHERE approval_id = $1
      `, [approval.approval_id]);
      
      const result = await verifyApproval({
        migration_id: 'M_TEST_TAMPER',
        migration_content: 'SELECT 1;',
        execution_environment: 'production'
      });
      
      test('Tampered approval → BLOCK', 'BLOCK', result.decision, result.evidence);
      test('Reason: APPROVAL_TAMPERED', 'APPROVAL_TAMPERED', result.reason);
    }
    console.log('');
    
    // ========================================================================
    // TEST 11: Approval revoked → BLOCK
    // ========================================================================
    console.log('🧪 TEST 11: Approval Revoked');
    {
      await setupApproval(db, {
        migration_id: 'M_TEST_REVOKED',
        status: 'revoked' // Revoked status
      });
      
      const result = await verifyApproval({
        migration_id: 'M_TEST_REVOKED',
        migration_content: 'SELECT 1;',
        execution_environment: 'production'
      });
      
      test('Revoked approval → BLOCK', 'BLOCK', result.decision, result.evidence);
      test('Reason: NO_APPROVAL_FOUND', 'NO_APPROVAL_FOUND', result.reason);
    }
    console.log('');
    
    // ========================================================================
    // TEST 12: Valid approval → PASS ✅
    // ========================================================================
    console.log('🧪 TEST 12: Valid Approval → PASS');
    {
      await setupApproval(db, {
        migration_id: 'M_TEST_VALID',
        requester_id: 'user_dev',
        approver_id: 'user_admin',
        approver_role: 'admin',
        target_environment: 'production'
      });
      
      const result = await verifyApproval({
        migration_id: 'M_TEST_VALID',
        migration_content: 'SELECT 1;',
        execution_environment: 'production'
      });
      
      test('Valid approval → PASS', 'PASS', result.decision, result.evidence);
      test('Evidence includes all invariants', 
        result.evidence.invariants_verified && result.evidence.invariants_verified.length === 8,
        true);
    }
    console.log('');
    
    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`TEST SUMMARY: ${testCount} total tests`);
    console.log(`✅ PASSED: ${passCount}`);
    console.log(`❌ FAILED: ${failCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (failCount === 0) {
      console.log('🎉 ALL TESTS PASSED - R4.2 APPROVAL GATE VERIFIED\n');
      console.log('Invariants tested:');
      console.log('  I0: No Self-Approval');
      console.log('  I1: Migration Binding');
      console.log('  I2: Scope Binding');
      console.log('  I3: Single-Use (Replay Protection)');
      console.log('  I4: Time Validity');
      console.log('  I5: Environment Match');
      console.log('  I6: Approver Authority');
      console.log('  I7: Integrity\n');
    } else {
      console.log(`❌ ${failCount} test(s) failed - R4.2 NOT READY\n`);
    }
    
    // Cleanup after tests
    await cleanupApprovals(db);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
  
  process.exit(failCount === 0 ? 0 : 1);
}

// Run tests
runTests();
