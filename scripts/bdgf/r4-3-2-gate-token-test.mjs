#!/usr/bin/env node
/**
 * R4.3.2 — Gate Token Adversarial Test Suite
 * 
 * Tests token issuance, validation, and consumption with attack scenarios:
 * 1. Valid token → PASS
 * 2. Forged signature → BLOCK
 * 3. Modified approval_id → BLOCK
 * 4. Modified migration_hash → BLOCK
 * 5. Modified environment → BLOCK
 * 6. Modified schema → BLOCK
 * 7. Modified executor_identity → BLOCK
 * 8. Expired token → BLOCK
 * 9. Replay token (double consume) → BLOCK
 * 10. Wrong nonce → BLOCK
 * 11. Missing token → BLOCK
 * 12. Concurrent double-consume → only 1 PASS
 * 
 * Expected: 15-16 tests PASS (1 valid + 12-13 block tests + 2 concurrent tests)
 */

import { issueGateToken, validateGateToken, consumeGateToken, verifyTokenBinding } from './gate-token.mjs';
import { computeHash } from './r4-verify-approval.mjs';
import dotenv from 'dotenv';
import pg from 'pg';
import crypto from 'crypto';

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
      console.log(`   Details:`, JSON.stringify(details, null, 2));
    }
    failCount++;
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R4.3.2 — GATE TOKEN ADVERSARIAL TEST SUITE                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const dbUrl = process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not configured');
    process.exit(1);
  }
  
  // Check signing key configured
  if (!process.env.GATE_SIGNING_KEY && !process.env.GATE_SIGNING_KEY_FROM_SECRETS_MANAGER) {
    console.error('❌ GATE_SIGNING_KEY not configured in .env');
    console.error('   Add: GATE_SIGNING_KEY=your-secret-key-here');
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
    console.log('✅ Connected to database\n');
    
    // Cleanup old test data
    await db.query(`DELETE FROM bella_gate_tokens WHERE migration_id LIKE 'M_TOKEN_TEST_%'`);
    await db.query(`DELETE FROM bella_migration_approval WHERE migration_id LIKE 'M_TOKEN_TEST_%'`);
    
    // ========================================================================
    // SETUP: Create valid approval for testing
    // ========================================================================
    console.log('🔧 SETUP: Creating test approval\n');
    
    const migrationContent = 'SELECT 1;';
    const migrationHash = computeHash(migrationContent);
    const migrationId = 'M_TOKEN_TEST_' + Date.now();
    
    // Create approval
    const approvalResult = await db.query(`
      INSERT INTO bella_migration_approval (
        migration_id, migration_hash, requester_id, approver_id,
        approver_role, target_environment, target_schema, expires_at,
        status, approval_hash, created_by
      ) VALUES (
        $1, $2, 'dev1', 'admin1',
        'admin', 'production', 'public', NOW() + INTERVAL '24 hours',
        'approved', '0000000000000000000000000000000000000000000000000000000000000000', 'test'
      )
      RETURNING *
    `, [migrationId, migrationHash]);
    
    const approval = approvalResult.rows[0];
    
    // Compute correct approval hash
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
    const approvalHash = crypto.createHash('sha256').update(JSON.stringify(sorted), 'utf8').digest('hex');
    
    await db.query(`
      UPDATE bella_migration_approval
      SET approval_hash = $1
      WHERE approval_id = $2
    `, [approvalHash, approval.approval_id]);
    
    console.log(`✅ Test approval created: ${migrationId}\n`);
    
    // ========================================================================
    // TEST 1: Valid token → PASS
    // ========================================================================
    console.log('🧪 TEST 1: Valid token → PASS\n');
    {
      const token = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId,
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db);
      
      test('Token issued successfully', !!token.token_id);
      
      const executionContext = {
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      };
      
      const result = await verifyTokenBinding(token, executionContext, db);
      
      test('Valid token → PASS', result.decision === 'PASS', result.evidence);
    }
    console.log('');
    
    // ========================================================================
    // TEST 2: Forged signature → BLOCK
    // ========================================================================
    console.log('🧪 TEST 2: Forged signature → BLOCK\n');
    {
      const token = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId + '_FORGED',
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db);
      
      // Tamper with signature
      token.signature = 'forged_signature_0000000000000000000000000000000000000000000000000000000';
      
      const executionContext = {
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      };
      
      const result = await validateGateToken(token, executionContext, db);
      
      test('Forged signature → BLOCK', !result.valid, result);
    }
    console.log('');
    
    // ========================================================================
    // TEST 3: Modified approval_id → BLOCK
    // ========================================================================
    console.log('🧪 TEST 3: Modified approval_id → BLOCK\n');
    {
      const token = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId + '_APPROVAL',
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db);
      
      // Tamper with approval_id
      token.payload.approval_id = crypto.randomUUID();
      
      const executionContext = {
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      };
      
      const result = await validateGateToken(token, executionContext, db);
      
      test('Modified approval_id → BLOCK', !result.valid, result);
    }
    console.log('');
    
    // ========================================================================
    // TEST 4: Modified migration_hash → BLOCK
    // ========================================================================
    console.log('🧪 TEST 4: Modified migration_hash → BLOCK\n');
    {
      const token = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId + '_HASH',
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db);
      
      const executionContext = {
        migration_hash: computeHash('MALICIOUS SQL; DROP TABLE users;'),
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      };
      
      const result = await validateGateToken(token, executionContext, db);
      
      test('Modified migration_hash → BLOCK', !result.valid, result);
    }
    console.log('');
    
    // ========================================================================
    // TEST 5: Modified environment → BLOCK
    // ========================================================================
    console.log('🧪 TEST 5: Modified environment → BLOCK\n');
    {
      const token = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId + '_ENV',
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db);
      
      const executionContext = {
        migration_hash: migrationHash,
        target_environment: 'staging',  // Different from token
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      };
      
      const result = await validateGateToken(token, executionContext, db);
      
      test('Modified environment → BLOCK', !result.valid, result);
    }
    console.log('');
    
    // ========================================================================
    // TEST 6: Modified schema → BLOCK
    // ========================================================================
    console.log('🧪 TEST 6: Modified schema → BLOCK\n');
    {
      const token = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId + '_SCHEMA',
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db);
      
      const executionContext = {
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'private',  // Different from token
        executor_identity: 'bella_migration_executor'
      };
      
      const result = await validateGateToken(token, executionContext, db);
      
      test('Modified schema → BLOCK', !result.valid, result);
    }
    console.log('');
    
    // ========================================================================
    // TEST 7: Modified executor_identity → BLOCK
    // ========================================================================
    console.log('🧪 TEST 7: Modified executor_identity → BLOCK\n');
    {
      const token = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId + '_EXECUTOR',
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db);
      
      const executionContext = {
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'malicious_executor'  // Different from token
      };
      
      const result = await validateGateToken(token, executionContext, db);
      
      test('Modified executor_identity → BLOCK', !result.valid, result);
    }
    console.log('');
    
    // ========================================================================
    // TEST 8: Expired token → BLOCK
    // ========================================================================
    console.log('🧪 TEST 8: Expired token → BLOCK\n');
    {
      // Create token with short TTL for testing (2 seconds)
      const token = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId + '_EXPIRED',
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db, 2); // Custom 2-second TTL for test
      
      console.log(`   ⏱️  Waiting 3 seconds for token to expire...`);
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const executionContext = {
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      };
      
      // Now validate - should fail because token is expired
      const result = await validateGateToken(token, executionContext, db);
      
      test('Expired token → BLOCK', !result.valid && result.reason === 'TOKEN_EXPIRED', result);
    }
    console.log('');
    
    // ========================================================================
    // TEST 9: Token not in database → BLOCK
    // ========================================================================
    console.log('🧪 TEST 9: Token not in database → BLOCK\n');
    {
      const fakeToken = {
        payload: {
          approval_id: approval.approval_id,
          migration_id: migrationId + '_MISSING',
          migration_hash: migrationHash,
          target_environment: 'production',
          target_schema: 'public',
          executor_identity: 'bella_migration_executor',
          execution_attempt_id: crypto.randomUUID(),
          nonce: 'nonexistent_nonce_' + crypto.randomBytes(32).toString('hex'),
          issued_at: Math.floor(Date.now() / 1000),
          expires_at: Math.floor(Date.now() / 1000) + 60
        },
        signature: 'fake_signature'
      };
      
      const executionContext = {
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      };
      
      const result = await validateGateToken(fakeToken, executionContext, db);
      
      test('Token not in database → BLOCK', !result.valid, result);
    }
    console.log('');
    
    // ========================================================================
    // TEST 10: Replay token after consume → BLOCK
    // ========================================================================
    console.log('🧪 TEST 10: Replay token after consume → BLOCK\n');
    {
      const token = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId + '_REPLAY',
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db);
      
      const executionContext = {
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      };
      
      // First use
      const firstUse = await verifyTokenBinding(token, executionContext, db);
      test('First use → PASS', firstUse.decision === 'PASS');
      
      // Consume token
      await consumeGateToken(token.payload.nonce, db);
      
      // Second use (replay)
      const secondUse = await validateGateToken(token, executionContext, db);
      test('Replay after consume → BLOCK', !secondUse.valid && (secondUse.reason === 'TOKEN_CONSUMED' || secondUse.reason === 'TOKEN_ALREADY_USED'), secondUse);
    }
    console.log('');
    
    // ========================================================================
    // TEST 11: execution_attempt_id mismatch → BLOCK
    // ========================================================================
    console.log('🧪 TEST 11: execution_attempt_id mismatch → BLOCK\n');
    {
      const token = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId + '_ATTEMPT',
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db);
      
      // Tamper with execution_attempt_id
      token.payload.execution_attempt_id = crypto.randomUUID();
      
      const executionContext = {
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      };
      
      const result = await validateGateToken(token, executionContext, db);
      
      test('Modified execution_attempt_id → BLOCK', !result.valid, result);
    }
    console.log('');
    
    // ========================================================================
    // TEST 12: Nonce reuse → BLOCK
    // ========================================================================
    console.log('🧪 TEST 12: Nonce reuse → BLOCK\n');
    {
      const token1 = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId + '_NONCE1',
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db);
      
      // Try to reuse nonce (should fail at database level)
      let nonceReuseFailed = false;
      try {
        await db.query(`
          INSERT INTO bella_gate_tokens (
            approval_id, migration_id, migration_hash,
            target_environment, target_schema, executor_identity,
            execution_attempt_id, nonce, issued_at, expires_at,
            status, token_signature, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + INTERVAL '60 seconds', 'issued', $9, $10
          )
        `, [
          approval.approval_id,
          migrationId + '_NONCE2',
          migrationHash,
          'production',
          'public',
          'bella_migration_executor',
          crypto.randomUUID(),
          token1.payload.nonce,  // Reuse nonce - should fail
          'fake_signature',
          'bella_migration_executor' // created_by
        ]);
      } catch (error) {
        nonceReuseFailed = error.code === '23505'; // Unique constraint violation
        if (!nonceReuseFailed) {
          console.log(`   ⚠️  Unexpected error code: ${error.code}, message: ${error.message}`);
        }
      }
      
      test('Nonce reuse → BLOCK at database', nonceReuseFailed);
    }
    console.log('');
    
    // ========================================================================
    // TEST 13: Concurrent double-consume → only 1 PASS
    // ========================================================================
    console.log('🧪 TEST 13: Concurrent double-consume → only 1 PASS\n');
    {
      const token = await issueGateToken({
        approval_id: approval.approval_id,
        migration_id: migrationId + '_CONCURRENT',
        migration_hash: migrationHash,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      }, db);
      
      // Simulate concurrent consume attempts
      const consume1Promise = consumeGateToken(token.payload.nonce, db);
      const consume2Promise = consumeGateToken(token.payload.nonce, db);
      
      const [consume1, consume2] = await Promise.all([consume1Promise, consume2Promise]);
      
      const oneSucceeded = (consume1.consumed && !consume2.consumed) || (!consume1.consumed && consume2.consumed);
      const bothFailed = !consume1.consumed && !consume2.consumed;
      const bothSucceeded = consume1.consumed && consume2.consumed;
      
      test('Concurrent consume: at most 1 succeeds', !bothSucceeded);
      test('Concurrent consume: exactly 1 or 0 (no both)', oneSucceeded || bothFailed);
      
      // Verify database state: should have at most 1 consumed token
      const dbCheck = await db.query(`
        SELECT COUNT(*) as count
        FROM bella_gate_tokens
        WHERE nonce = $1 AND status = 'consumed'
      `, [token.payload.nonce]);
      
      test('Database: at most 1 consumed record', parseInt(dbCheck.rows[0].count) <= 1);
    }
    console.log('');
    
    // ========================================================================
    // CLEANUP
    // ========================================================================
    await db.query(`DELETE FROM bella_gate_tokens WHERE migration_id LIKE 'M_TOKEN_TEST_%'`);
    await db.query(`DELETE FROM bella_migration_approval WHERE migration_id LIKE 'M_TOKEN_TEST_%'`);
    
    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`TEST SUMMARY: ${testCount} total tests`);
    console.log(`✅ PASSED: ${passCount}`);
    console.log(`❌ FAILED: ${failCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (failCount === 0) {
      console.log('🎉 ALL TESTS PASSED - R4.3.2 GATE TOKEN VERIFIED\n');
      console.log('Attack scenarios blocked:');
      console.log('  ✓ Forged signature');
      console.log('  ✓ Modified approval_id');
      console.log('  ✓ Modified migration_hash');
      console.log('  ✓ Modified environment');
      console.log('  ✓ Modified schema');
      console.log('  ✓ Modified executor_identity');
      console.log('  ✓ Expired token');
      console.log('  ✓ Token not in database');
      console.log('  ✓ Replay attack (double consume)');
      console.log('  ✓ execution_attempt_id mismatch');
      console.log('  ✓ Nonce reuse');
      console.log('  ✓ Concurrent double-consume (atomic)\n');
      console.log('✅ Ready for R4.3.3: Execution Wrapper\n');
    } else {
      console.log(`❌ ${failCount} test(s) failed - R4.3.2 NOT READY\n`);
      console.log('⚠️  BLOCKER: Gate Token Module has security vulnerabilities\n');
      console.log('ACTION REQUIRED: Fix implementation before proceeding to R4.3.3\n');
    }
    
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
