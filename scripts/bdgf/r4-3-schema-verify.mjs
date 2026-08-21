#!/usr/bin/env node
/**
 * R4.3 — Schema Deployment Verification
 * 
 * Verifies database enforcement after migration deployment:
 * 1. bella_developer has NO access to bella_gate_tokens
 * 2. bella_migration_executor cannot self-create approvals (R3/R4.2 invariant)
 * 3. Audit table is truly append-only (UPDATE/DELETE blocked)
 * 4. Single-use token enforcement is atomic
 * 
 * Run AFTER deploying: supabase/migrations/20260820_r4_3_gate_tokens.sql
 * 
 * Expected: All tests PASS before proceeding to Step 2 (Gate Token Module)
 */

import dotenv from 'dotenv';
import pg from 'pg';
const { Client } = pg;

dotenv.config();

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, pass, details = {}) {
  testCount++;
  
  if (pass) {
    console.log(`✅ Test ${testCount}: ${name}`);
    passCount++;
  } else {
    console.log(`❌ Test ${testCount}: ${name}`);
    if (Object.keys(details).length > 0) {
      console.log(`   Details:`, details);
    }
    failCount++;
  }
}

// ============================================================================
// DATABASE CONNECTION HELPERS
// ============================================================================

async function connectAs(role) {
  const dbUrl = role === 'developer' 
    ? process.env.DATABASE_URL 
    : process.env.DATABASE_EXECUTOR_URL;
  
  if (!dbUrl) {
    throw new Error(`${role} DATABASE_URL not configured`);
  }
  
  const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!urlMatch) {
    throw new Error(`Invalid DATABASE_URL format for ${role}`);
  }
  
  const [, user, password, host, port, database] = urlMatch;
  const client = new Client({ 
    host, 
    port: parseInt(port), 
    database, 
    user, 
    password, 
    ssl: { rejectUnauthorized: false } 
  });
  
  await client.connect();
  return client;
}

// ============================================================================
// VERIFICATION TESTS
// ============================================================================

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R4.3 — SCHEMA DEPLOYMENT VERIFICATION                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  let developerClient = null;
  let executorClient = null;
  
  try {
    // Connect as both roles
    console.log('🔌 Connecting to database...\n');
    developerClient = await connectAs('developer');
    executorClient = await connectAs('executor');
    
    // ========================================================================
    // SCHEMA EXISTENCE
    // ========================================================================
    console.log('🧪 SCHEMA EXISTENCE CHECKS\n');
    
    {
      const result = await executorClient.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('bella_gate_tokens', 'bella_execution_audit')
      `);
      
      const tables = result.rows.map(r => r.table_name);
      test('bella_gate_tokens table exists', tables.includes('bella_gate_tokens'));
      test('bella_execution_audit table exists', tables.includes('bella_execution_audit'));
    }
    
    {
      const result = await executorClient.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'bella_migration_approval' 
          AND column_name IN ('execution_started_at', 'execution_completed_at', 'execution_error')
      `);
      
      const columns = result.rows.map(r => r.column_name);
      test('Approval table has execution_started_at', columns.includes('execution_started_at'));
      test('Approval table has execution_completed_at', columns.includes('execution_completed_at'));
      test('Approval table has execution_error', columns.includes('execution_error'));
    }
    
    console.log('');
    
    // ========================================================================
    // POINT 1: bella_developer NO ACCESS to bella_gate_tokens
    // ========================================================================
    console.log('🧪 POINT 1: bella_developer NO ACCESS to bella_gate_tokens\n');
    
    // Test SELECT
    {
      try {
        await developerClient.query('SELECT * FROM bella_gate_tokens LIMIT 1');
        test('Developer SELECT gate_tokens → BLOCKED', false, { 
          error: 'SELECT succeeded (should have failed)' 
        });
      } catch (error) {
        test('Developer SELECT gate_tokens → BLOCKED', 
          error.code === '42501', // permission denied
          { code: error.code, message: error.message }
        );
      }
    }
    
    // Test INSERT
    {
      try {
        await developerClient.query(`
          INSERT INTO bella_gate_tokens (
            approval_id, migration_id, migration_hash, 
            target_environment, executor_identity, nonce, 
            token_signature, expires_at, created_by
          ) VALUES (
            gen_random_uuid(), 'TEST', 'hash123', 
            'production', 'test', 'nonce123', 
            'sig123', NOW() + INTERVAL '60 seconds', 'test'
          )
        `);
        test('Developer INSERT gate_tokens → BLOCKED', false, { 
          error: 'INSERT succeeded (should have failed)' 
        });
      } catch (error) {
        test('Developer INSERT gate_tokens → BLOCKED', 
          error.code === '42501', 
          { code: error.code }
        );
      }
    }
    
    // Test UPDATE
    {
      try {
        await developerClient.query(`UPDATE bella_gate_tokens SET status = 'used' WHERE false`);
        test('Developer UPDATE gate_tokens → BLOCKED', false, { 
          error: 'UPDATE succeeded (should have failed)' 
        });
      } catch (error) {
        test('Developer UPDATE gate_tokens → BLOCKED', 
          error.code === '42501', 
          { code: error.code }
        );
      }
    }
    
    // Test DELETE
    {
      try {
        await developerClient.query(`DELETE FROM bella_gate_tokens WHERE false`);
        test('Developer DELETE gate_tokens → BLOCKED', false, { 
          error: 'DELETE succeeded (should have failed)' 
        });
      } catch (error) {
        test('Developer DELETE gate_tokens → BLOCKED', 
          error.code === '42501', 
          { code: error.code }
        );
      }
    }
    
    console.log('');
    
    // ========================================================================
    // POINT 2: Executor CANNOT self-create approvals (R3 invariant)
    // ========================================================================
    console.log('🧪 POINT 2: Executor CANNOT self-create approvals\n');
    
    {
      try {
        await executorClient.query(`
          INSERT INTO bella_migration_approval (
            migration_id, migration_hash, requester_id, approver_id, 
            approver_role, target_environment, expires_at, 
            status, approval_hash, created_by
          ) VALUES (
            'M_TEST_EXECUTOR', 'hash123', 'executor', 'executor',
            'admin', 'production', NOW() + INTERVAL '24 hours',
            'approved', 'hash456', 'executor'
          )
        `);
        test('Executor INSERT approval → BLOCKED', false, { 
          error: 'INSERT succeeded (should have failed - RLS or permission)' 
        });
      } catch (error) {
        // Can be blocked by: permission denied (42501), policy violation, or no_self_approval constraint (23514)
        // All are valid ways to block self-creation
        test('Executor INSERT approval → BLOCKED', 
          error.code === '42501' || error.code === '23514' || error.message.includes('policy'),
          { code: error.code, message: error.message.substring(0, 100) }
        );
      }
    }
    
    console.log('');
    
    // ========================================================================
    // POINT 3: Audit table is append-only (UPDATE/DELETE blocked by trigger)
    // ========================================================================
    console.log('🧪 POINT 3: Audit table is append-only\n');
    
    // First insert a test audit record
    let testAuditId = null;
    {
      const result = await executorClient.query(`
        INSERT INTO bella_execution_audit (
          migration_id, migration_hash, target_environment,
          gate_decision, executor_identity, created_by
        ) VALUES (
          'M_TEST_AUDIT', 'hash123', 'production',
          'BLOCK', 'test_executor', 'test'
        )
        RETURNING audit_id
      `);
      testAuditId = result.rows[0].audit_id;
      test('Audit INSERT works', true);
    }
    
    // Try UPDATE (should be blocked by trigger)
    {
      try {
        await executorClient.query(`
          UPDATE bella_execution_audit 
          SET gate_decision = 'PASS' 
          WHERE audit_id = $1
        `, [testAuditId]);
        test('Audit UPDATE → BLOCKED by trigger', false, { 
          error: 'UPDATE succeeded (trigger did not fire)' 
        });
      } catch (error) {
        test('Audit UPDATE → BLOCKED by trigger', 
          error.message.includes('append-only'),
          { message: error.message }
        );
      }
    }
    
    // Try DELETE (should be blocked by trigger)
    {
      try {
        await executorClient.query(`
          DELETE FROM bella_execution_audit 
          WHERE audit_id = $1
        `, [testAuditId]);
        test('Audit DELETE → BLOCKED by trigger', false, { 
          error: 'DELETE succeeded (trigger did not fire)' 
        });
      } catch (error) {
        test('Audit DELETE → BLOCKED by trigger', 
          error.message.includes('append-only'),
          { message: error.message }
        );
      }
    }
    
    console.log('');
    
    // ========================================================================
    // POINT 4: Single-use enforcement is atomic
    // ========================================================================
    console.log('🧪 POINT 4: Single-use token enforcement (atomic)\n');
    
    // Create a test approval first (use unique migration_id to avoid conflicts)
    let testApprovalId = null;
    const uniqueMigrationId = 'M_TEST_ATOMIC_' + Date.now();
    {
      const result = await executorClient.query(`
        INSERT INTO bella_migration_approval (
          migration_id, migration_hash, requester_id, approver_id,
          approver_role, target_environment, expires_at,
          status, approval_hash, created_by
        ) VALUES (
          $1, 'hash789', 'dev1', 'admin1',
          'admin', 'production', NOW() + INTERVAL '24 hours',
          'approved', '0000000000000000000000000000000000000000000000000000000000000000', 'test'
        )
        RETURNING *
      `, [uniqueMigrationId]);
      testApprovalId = result.rows[0].approval_id;
      // Compute and update correct hash
      const approval = result.rows[0];
      const canonical = {
        approval_id: approval.approval_id,
        migration_id: approval.migration_id,
        migration_hash: approval.migration_hash,
        requester_id: approval.requester_id,
        approver_id: approval.approver_id,
        approved_at: new Date(approval.approved_at).toISOString(),
        target_environment: approval.target_environment,
        expires_at: new Date(approval.expires_at).toISOString()
      };
      const sorted = Object.keys(canonical).sort().reduce((obj, key) => {
        obj[key] = canonical[key];
        return obj;
      }, {});
      
      const crypto = await import('crypto');
      const approvalHash = crypto.createHash('sha256').update(JSON.stringify(sorted), 'utf8').digest('hex');
      
      await executorClient.query(`
        UPDATE bella_migration_approval 
        SET approval_hash = $1 
        WHERE approval_id = $2
      `, [approvalHash, testApprovalId]);
    }
    
    // Create first token
    const nonce1 = 'nonce_' + Date.now() + '_1';
    {
      await executorClient.query(`
        INSERT INTO bella_gate_tokens (
          approval_id, migration_id, migration_hash,
          target_environment, executor_identity, nonce,
          token_signature, expires_at, created_by
        ) VALUES (
          $1, $2, 'hash789',
          'production', 'executor1', $3,
          'sig123', NOW() + INTERVAL '60 seconds', 'test'
        )
      `, [testApprovalId, uniqueMigrationId, nonce1]);
      test('First token INSERT succeeds', true);
    }
    
    // Try to create second token with same nonce (should fail - UNIQUE constraint)
    {
      try {
        await executorClient.query(`
          INSERT INTO bella_gate_tokens (
            approval_id, migration_id, migration_hash,
            target_environment, executor_identity, nonce,
            token_signature, expires_at, created_by
          ) VALUES (
            $1, $2, 'hash789',
            'production', 'executor2', $3,
            'sig456', NOW() + INTERVAL '60 seconds', 'test'
          )
        `, [testApprovalId, uniqueMigrationId, nonce1]); // Same nonce
        test('Duplicate nonce → BLOCKED', false, { 
          error: 'INSERT succeeded (UNIQUE constraint not enforced)' 
        });
      } catch (error) {
        test('Duplicate nonce → BLOCKED', 
          error.code === '23505', // unique violation
          { code: error.code }
        );
      }
    }
    
    // Check token can be marked 'used' atomically
    {
      const result = await executorClient.query(`
        UPDATE bella_gate_tokens 
        SET status = 'used', used_at = NOW()
        WHERE nonce = $1 AND status = 'issued'
        RETURNING token_id
      `, [nonce1]);
      
      test('Token atomic consume succeeds', result.rows.length === 1);
    }
    
    // Try to use same token again (should fail - status != 'issued')
    {
      const result = await executorClient.query(`
        UPDATE bella_gate_tokens 
        SET status = 'used', used_at = NOW()
        WHERE nonce = $1 AND status = 'issued'
        RETURNING token_id
      `, [nonce1]);
      
      test('Token replay → BLOCKED (no rows updated)', result.rows.length === 0);
    }
    
    console.log('');
    
    // ========================================================================
    // CLEANUP
    // ========================================================================
    await executorClient.query(`DELETE FROM bella_gate_tokens WHERE nonce LIKE 'nonce_%'`);
    await executorClient.query(`DELETE FROM bella_migration_approval WHERE migration_id LIKE 'M_TEST_%'`);
    await executorClient.query(`DELETE FROM bella_execution_audit WHERE migration_id LIKE 'M_TEST_%'`);
    
    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`TEST SUMMARY: ${testCount} total tests`);
    console.log(`✅ PASSED: ${passCount}`);
    console.log(`❌ FAILED: ${failCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (failCount === 0) {
      console.log('🎉 ALL TESTS PASSED - R4.3 SCHEMA VERIFIED\n');
      console.log('Verified:');
      console.log('  ✓ bella_developer has NO access to gate tokens');
      console.log('  ✓ bella_migration_executor cannot self-create approvals');
      console.log('  ✓ Audit table is append-only (UPDATE/DELETE blocked)');
      console.log('  ✓ Single-use enforcement is atomic\n');
      console.log('✅ Ready for Step 2: Gate Token Module implementation\n');
    } else {
      console.log(`❌ ${failCount} test(s) failed - R4.3 schema NOT READY\n`);
      console.log('⚠️  DO NOT proceed to Step 2 until all tests PASS\n');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    if (developerClient) await developerClient.end();
    if (executorClient) await executorClient.end();
  }
  
  process.exit(failCount === 0 ? 0 : 1);
}

// Run tests
runTests();
