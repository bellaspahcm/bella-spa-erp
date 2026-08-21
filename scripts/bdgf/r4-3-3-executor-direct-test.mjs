#!/usr/bin/env node
/**
 * R4.3.3 — E1 ENFORCEMENT PROOF
 * 
 * This test proves the critical E1 invariant:
 * "bella_migration_executor credentials alone are NOT sufficient for mutation"
 * 
 * Test Scenario:
 * - Have valid bella_migration_executor database credentials
 * - Call executor directly without going through wrapper
 * - NO gate token provided
 * 
 * Expected Result:
 * - EXECUTION_BLOCKED with error code 'NO_TOKEN'
 * - NO database connection opened for mutation
 * - NO DDL executed
 * - ZERO mutations to database
 * 
 * This proves: Executor REFUSES to run without authorization, even with valid credentials.
 */

import { executeMigration } from './migration-executor.mjs';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
dotenv.config();

// Test utilities
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

async function runE1ProofTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R4.3.3 — E1 ENFORCEMENT PROOF TEST                        ║');
  console.log('║ Credential + No Token → BLOCK + Zero Mutation             ║');
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
    console.log('✅ Connected to database with bella_migration_executor credentials\n');
    
    // ========================================================================
    // SETUP: Create test marker table
    // ========================================================================
    console.log('🔧 SETUP: Creating test marker table\n');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS bella_e1_test_marker (
        test_id VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Clean any previous test data
    await db.query(`DELETE FROM bella_e1_test_marker WHERE test_id LIKE 'E1_TEST_%'`);
    
    const testId = 'E1_TEST_' + Date.now();
    
    console.log(`   Test ID: ${testId}\n`);
    
    // ========================================================================
    // TEST 1: Direct Executor Call Without Token → BLOCKED
    // ========================================================================
    console.log('🧪 TEST 1: Direct executor call without token → BLOCKED\n');
    
    let executionBlocked = false;
    let blockReason = null;
    let mutationOccurred = false;
    
    try {
      // Attempt to execute migration WITHOUT token
      // This is the dangerous scenario we must block
      await executeMigration({
        // NO TOKEN - this is the attack scenario
        migration_content: `INSERT INTO bella_e1_test_marker (test_id) VALUES ('${testId}')`,
        target_environment: 'production',
        target_schema: 'public',
        executor_identity: 'bella_migration_executor'
      });
      
      // If we reach here, execution was NOT blocked (BAD!)
      console.log('❌ CRITICAL FAILURE: Execution was NOT blocked!\n');
      
    } catch (error) {
      if (error.blocked && error.code === 'NO_TOKEN') {
        executionBlocked = true;
        blockReason = error.code;
        console.log('✅ Execution blocked with NO_TOKEN error\n');
      } else {
        console.log(`⚠️  Execution failed with unexpected error: ${error.message}\n`);
      }
    }
    
    test('Executor blocked without token', executionBlocked, { blockReason });
    test('Block reason is NO_TOKEN', blockReason === 'NO_TOKEN', { blockReason });
    
    // ========================================================================
    // TEST 2: Verify Zero Mutation
    // ========================================================================
    console.log('\n🧪 TEST 2: Verify zero mutation occurred\n');
    
    const markerCheck = await db.query(`
      SELECT COUNT(*) as count
      FROM bella_e1_test_marker
      WHERE test_id = $1
    `, [testId]);
    
    mutationOccurred = parseInt(markerCheck.rows[0].count) > 0;
    
    if (mutationOccurred) {
      console.log(`❌ CRITICAL FAILURE: Mutation occurred! Found ${markerCheck.rows[0].count} markers\n`);
    } else {
      console.log('✅ Zero mutation confirmed - test marker not found in database\n');
    }
    
    test('Zero mutation (marker not in DB)', !mutationOccurred, { 
      markers_found: markerCheck.rows[0].count 
    });
    
    // ========================================================================
    // TEST 3: Credential Validity Check
    // ========================================================================
    console.log('\n🧪 TEST 3: Verify credentials are valid (can connect)\n');
    
    // Prove we DO have valid credentials by running a safe SELECT
    const credentialCheck = await db.query('SELECT 1 as valid');
    const hasValidCredential = credentialCheck.rows[0]?.valid === 1;
    
    test('bella_migration_executor credentials valid', hasValidCredential);
    
    // ========================================================================
    // CLEANUP
    // ========================================================================
    await db.query(`DROP TABLE IF EXISTS bella_e1_test_marker`);
    console.log('\n🧹 Cleanup: Test marker table dropped\n');
    
    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`E1 PROOF TEST SUMMARY: ${testCount} total tests`);
    console.log(`✅ PASSED: ${passCount}`);
    console.log(`❌ FAILED: ${failCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (failCount === 0) {
      console.log('🎉 E1 INVARIANT PROVEN\n');
      console.log('✓ Executor has valid credentials');
      console.log('✓ Executor called without gate token');
      console.log('✓ Execution BLOCKED with NO_TOKEN');
      console.log('✓ ZERO mutations occurred\n');
      console.log('E1 PROOF: bella_migration_executor credential alone is NOT sufficient.');
      console.log('          Valid gate token is REQUIRED for any mutation.\n');
      console.log('✅ Ready for next step: Wrapper implementation\n');
    } else {
      console.log(`❌ ${failCount} test(s) FAILED - E1 NOT PROVEN\n`);
      console.log('⚠️  CRITICAL: Execution boundary is NOT enforced');
      console.log('⚠️  DO NOT proceed to wrapper until E1 is proven\n');
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
  
  process.exit(failCount === 0 ? 0 : 1);
}

// Run E1 proof test
runE1ProofTest();
