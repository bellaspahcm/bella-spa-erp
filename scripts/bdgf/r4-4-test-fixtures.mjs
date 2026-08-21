#!/usr/bin/env node
/**
 * R4.4.1 — TEST FIXTURES HELPER
 * 
 * Creates real R4.3 tokens and test data for R4.4 monitoring tests.
 * Uses actual issueGateToken() to avoid "Input buffers must have the same byte length" errors.
 * 
 * Problem: Tests 3,4,8 used simplified token objects like:
 *   { payload: {...}, signature: 'sig' }
 * 
 * Solution: Use real R4.3.2 token issuance:
 *   await issueGateToken({ ... }, db) → real HMAC-SHA256 signature
 */

import { issueGateToken } from './gate-token.mjs';
import crypto from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Create test approval in database
 */
export async function createTestApproval(db, params = {}) {
  const approval_id = params.approval_id || crypto.randomUUID();
  const migration_id = params.migration_id || crypto.randomUUID();
  const migration_hash = params.migration_hash || crypto.createHash('sha256').update('test').digest('hex');
  const target_environment = params.target_environment || 'production';
  const target_schema = params.target_schema || 'public';
  const requester_id = params.requester_id || 'test_developer';
  const approver_id = params.approver_id || 'test_admin';
  const approver_role = params.approver_role || 'admin';
  const expires_at = params.expires_at || new Date(Date.now() + 3600 * 1000); // 1 hour from now
  const approval_hash = crypto.createHash('sha256').update(JSON.stringify({
    migration_id,
    migration_hash,
    target_environment
  })).digest('hex');
  
  await db.query(`
    INSERT INTO bella_migration_approval (
      approval_id,
      migration_id,
      migration_hash,
      requester_id,
      approver_id,
      approver_role,
      target_environment,
      target_schema,
      expires_at,
      status,
      approval_hash,
      created_by,
      created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved', $10, $4, NOW()
    )
    ON CONFLICT (approval_id) DO NOTHING
  `, [
    approval_id, migration_id, migration_hash, requester_id, approver_id, 
    approver_role, target_environment, target_schema, expires_at, approval_hash
  ]);
  
  return {
    approval_id,
    migration_id,
    migration_hash,
    target_environment,
    target_schema
  };
}

/**
 * Compute migration content hash
 */
export function computeMigrationHash(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// ============================================================================
// TOKEN FIXTURES
// ============================================================================

/**
 * Create real token using R4.3.2 issueGateToken()
 * 
 * Returns token with proper HMAC-SHA256 signature
 */
export async function createRealToken(db, params = {}) {
  const migration_content = params.migration_content || 'SELECT 1';
  const migration_hash = computeMigrationHash(migration_content);
  
  // Create approval first
  const approval = await createTestApproval(db, {
    migration_hash,
    target_environment: params.target_environment || 'production',
    target_schema: params.target_schema || 'public'
  });
  
  // Issue real token
  const token = await issueGateToken({
    approval_id: approval.approval_id,
    migration_id: approval.migration_id,
    migration_hash,
    target_environment: approval.target_environment,
    target_schema: approval.target_schema,
    executor_identity: params.executor_identity || 'bella_migration_executor'
  }, db, params.customTTL);
  
  return {
    token,
    approval,
    migration_content
  };
}

/**
 * Create token for replay attack test
 * 
 * Issues real token, then marks it as 'used' in database
 */
export async function createUsedToken(db, params = {}) {
  const { token, approval, migration_content } = await createRealToken(db, params);
  
  // Mark token as already used
  await db.query(`
    UPDATE bella_gate_tokens
    SET status = 'used',
        used_at = NOW()
    WHERE token_id = $1
  `, [token.token_id]);
  
  return {
    token,
    approval,
    migration_content,
    used: true
  };
}

/**
 * Create token for binding mismatch test
 * 
 * Issues token for migration A, returns different migration B for execution
 */
export async function createMismatchedToken(db, params = {}) {
  const migrationA = params.migrationA || 'SELECT 1';
  const migrationB = params.migrationB || 'SELECT 2';
  
  // Create token bound to migration A
  const { token, approval } = await createRealToken(db, {
    migration_content: migrationA,
    ...params
  });
  
  return {
    token,
    approval,
    tokenBoundTo: migrationA,
    executeWith: migrationB // This should cause binding_mismatch
  };
}

/**
 * Create expired token
 * 
 * Issues token with -1 second TTL (already expired)
 */
export async function createExpiredToken(db, params = {}) {
  const { token, approval, migration_content } = await createRealToken(db, {
    customTTL: -1, // Expired immediately
    ...params
  });
  
  // Wait a moment to ensure expiry
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    token,
    approval,
    migration_content,
    expired: true
  };
}

/**
 * Create token for execution failure test
 * 
 * Valid token, but migration content is invalid SQL
 */
export async function createTokenForInvalidSQL(db, params = {}) {
  const invalidSQL = params.invalidSQL || 'CREATE TABL syntax_error (id INT)';
  
  const { token, approval } = await createRealToken(db, {
    migration_content: invalidSQL,
    ...params
  });
  
  return {
    token,
    approval,
    migration_content: invalidSQL,
    expectExecutionFailure: true
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Clean test data from database
 */
export async function cleanupTestData(db) {
  await db.query(`DELETE FROM bella_gate_tokens WHERE created_by = 'bella_migration_executor'`);
  await db.query(`DELETE FROM bella_migration_approval WHERE requester_id = 'test_developer'`);
  await db.query(`DELETE FROM bella_security_incidents`);
}

// ============================================================================
// TEST HELPER
// ============================================================================

/**
 * Get database connection for tests
 */
export async function getTestDB() {
  const dbUrl = process.env.DATABASE_EXECUTOR_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_EXECUTOR_URL not configured');
  }
  
  const db = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  await db.connect();
  return db;
}

// ============================================================================
// VERIFICATION
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R4.4.1 — TEST FIXTURES VERIFICATION                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const db = await getTestDB();
  
  try {
    console.log('🧹 Cleaning up old test data...\n');
    await cleanupTestData(db);
    
    // Test 1: Real token
    console.log('Test 1: Creating real token with HMAC signature...');
    const real = await createRealToken(db);
    console.log(`✅ Token ID: ${real.token.token_id}`);
    console.log(`   Signature: ${real.token.signature.substring(0, 16)}...`);
    console.log(`   Approval: ${real.approval.approval_id}\n`);
    
    // Test 2: Used token
    console.log('Test 2: Creating used token for replay test...');
    const used = await createUsedToken(db);
    console.log(`✅ Token ID: ${used.token.token_id}`);
    console.log(`   Status: used (marked in DB)`);
    console.log(`   Token used: ${used.used}\n`);
    
    // Test 3: Mismatched token
    console.log('Test 3: Creating mismatched token for binding test...');
    const mismatch = await createMismatchedToken(db, {
      migrationA: 'SELECT 1',
      migrationB: 'SELECT 2'
    });
    console.log(`✅ Token bound to: "${mismatch.tokenBoundTo}"`);
    console.log(`   Will execute: "${mismatch.executeWith}"`);
    console.log(`   Expected: binding_mismatch\n`);
    
    // Test 4: Expired token
    console.log('Test 4: Creating expired token...');
    const expired = await createExpiredToken(db);
    console.log(`✅ Token ID: ${expired.token.token_id}`);
    console.log(`   Expired: ${expired.expired}`);
    console.log(`   Expires at: ${expired.token.payload.expires_at}\n`);
    
    // Test 5: Invalid SQL token
    console.log('Test 5: Creating token for invalid SQL...');
    const invalid = await createTokenForInvalidSQL(db);
    console.log(`✅ Token ID: ${invalid.token.token_id}`);
    console.log(`   Migration: "${invalid.migration_content}"`);
    console.log(`   Expected: execution_failure\n`);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ALL FIXTURES CREATED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('Fixture Summary:');
    console.log(`  ✅ Real token with HMAC-SHA256 signature`);
    console.log(`  ✅ Used token for replay attack test`);
    console.log(`  ✅ Mismatched token for binding test`);
    console.log(`  ✅ Expired token for expiry test`);
    console.log(`  ✅ Token for execution failure test\n`);
    
    console.log('Next: Run r4-4-1-retest-fixtures.mjs to verify detections\n');
    
  } catch (error) {
    console.error(`\n❌ Fixture creation failed: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.end();
  }
}
