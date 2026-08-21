#!/usr/bin/env node
/**
 * R3 STEP 4 — SECURITY FIX VERIFICATION
 * Test that bella_migration_executor CANNOT modify approvals table
 * (prevents self-authorization bypass)
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function testExecutorApprovalBlock() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ R3 SECURITY FIX VERIFICATION                                                   ║');
  console.log('║ Test: Executor CANNOT modify approvals (prevents self-authorization)          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  if (!process.env.DATABASE_EXECUTOR_URL) {
    console.log('❌ BLOCKED: DATABASE_EXECUTOR_URL not configured');
    console.log('   Cannot test executor security fix without executor credentials\n');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_EXECUTOR_URL });

  try {
    await client.connect();
    
    const roleResult = await client.query('SELECT current_user');
    const currentRole = roleResult.rows[0].current_user;
    console.log(`Current role: ${currentRole}\n`);

    if (currentRole !== 'bella_migration_executor') {
      console.log(`⚠️  WARNING: Expected bella_migration_executor, got ${currentRole}\n`);
    }

    let allTestsPassed = true;

    // ========================================================================
    // TEST 1: Executor CANNOT INSERT approvals
    // ========================================================================
    console.log('TEST 1: Executor attempts to INSERT approval (self-authorization bypass)');
    try {
      await client.query(`
        INSERT INTO migration_governance.approvals 
          (migration_id, migration_files, environment, requested_by)
        VALUES 
          ('bypass-test', ARRAY['bypass.sql'], 'production', 'hacker')
      `);
      
      // If we get here, INSERT succeeded (SECURITY VULNERABILITY!)
      console.log('❌ FAIL: Executor can INSERT approvals');
      console.log('   🚨 CRITICAL: Self-authorization bypass exists!');
      console.log('   Executor can create fake approvals and bypass R2\n');
      allTestsPassed = false;
      
    } catch (error) {
      if (error.message.includes('permission denied')) {
        console.log('✅ PASS: Executor cannot INSERT approvals');
        console.log(`   Error: ${error.message}`);
        console.log('   Security fix verified: Self-authorization prevented\n');
      } else {
        console.log(`⚠️  UNEXPECTED: ${error.message}\n`);
        allTestsPassed = false;
      }
    }

    // ========================================================================
    // TEST 2: Executor CANNOT UPDATE approvals
    // ========================================================================
    console.log('TEST 2: Executor attempts to UPDATE approval (modify existing approval)');
    try {
      await client.query(`
        UPDATE migration_governance.approvals
        SET status = 'approved'
        WHERE id = (SELECT id FROM migration_governance.approvals LIMIT 1)
      `);
      
      // If we get here, UPDATE succeeded (SECURITY VULNERABILITY!)
      console.log('❌ FAIL: Executor can UPDATE approvals');
      console.log('   🚨 CRITICAL: Approval manipulation exists!');
      console.log('   Executor can change approval status\n');
      allTestsPassed = false;
      
    } catch (error) {
      if (error.message.includes('permission denied')) {
        console.log('✅ PASS: Executor cannot UPDATE approvals');
        console.log(`   Error: ${error.message}`);
        console.log('   Security fix verified: Approval manipulation prevented\n');
      } else {
        console.log(`⚠️  UNEXPECTED: ${error.message}\n`);
        allTestsPassed = false;
      }
    }

    // ========================================================================
    // TEST 3: Executor CANNOT DELETE approvals
    // ========================================================================
    console.log('TEST 3: Executor attempts to DELETE approval (evidence destruction)');
    try {
      await client.query(`
        DELETE FROM migration_governance.approvals
        WHERE id = (SELECT id FROM migration_governance.approvals LIMIT 1)
      `);
      
      // If we get here, DELETE succeeded (SECURITY VULNERABILITY!)
      console.log('❌ FAIL: Executor can DELETE approvals');
      console.log('   🚨 CRITICAL: Evidence destruction possible!');
      console.log('   Executor can remove approval records\n');
      allTestsPassed = false;
      
    } catch (error) {
      if (error.message.includes('permission denied')) {
        console.log('✅ PASS: Executor cannot DELETE approvals');
        console.log(`   Error: ${error.message}`);
        console.log('   Security fix verified: Evidence destruction prevented\n');
      } else {
        console.log(`⚠️  UNEXPECTED: ${error.message}\n`);
        allTestsPassed = false;
      }
    }

    // ========================================================================
    // TEST 4: Executor CAN SELECT approvals (needs to read for verification)
    // ========================================================================
    console.log('TEST 4: Executor attempts to SELECT approvals (legitimate use case)');
    try {
      const result = await client.query('SELECT COUNT(*) FROM migration_governance.approvals');
      const count = result.rows[0].count;
      
      console.log(`✅ PASS: Executor can SELECT approvals (count: ${count})`);
      console.log('   Executor needs read access to verify Human GO\n');
      
    } catch (error) {
      console.log(`❌ FAIL: Executor cannot SELECT approvals: ${error.message}`);
      console.log('   🚨 PROBLEM: Executor needs SELECT to integrate with R2\n');
      allTestsPassed = false;
    }

    // ========================================================================
    // RESULTS
    // ========================================================================
    console.log('═'.repeat(80));
    
    if (allTestsPassed) {
      console.log('✅ R3 SECURITY FIX: VERIFIED');
      console.log('\nSeparation of Authority achieved:');
      console.log('  - Human: Decides (creates approvals)');
      console.log('  - R2: Verifies (validates approvals)');
      console.log('  - Executor: Executes (reads approvals, performs mutations)');
      console.log('  - Executor CANNOT: Create/modify/delete approvals (self-authorize)');
      console.log('\n"Người thực thi không được tự quyết định quyền được thực thi" ✅');
      process.exit(0);
    } else {
      console.log('❌ R3 SECURITY FIX: FAILED');
      console.log('\nCritical security gap detected!');
      console.log('Review migration 20260820120000_fix_executor_privileges.sql');
      console.log('Expected: REVOKE INSERT, UPDATE, DELETE ON approvals FROM executor');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Connection error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testExecutorApprovalBlock();
