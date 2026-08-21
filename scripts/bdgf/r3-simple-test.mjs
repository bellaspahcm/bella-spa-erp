#!/usr/bin/env node
/**
 * R3 SIMPLE PERMISSION TEST
 * Quick test to verify role separation works
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function testDeveloperReadOnly() {
  console.log('🧪 TEST 1: Developer (READ-ONLY) Check\n');
  
  const dev = new Client({ connectionString: process.env.DATABASE_URL });
  await dev.connect();
  
  const role = await dev.query('SELECT current_user');
  console.log(`Role: ${role.rows[0].current_user}\n`);
  
  // Test SELECT (should work)
  console.log('Test SELECT...');
  try {
    const result = await dev.query('SELECT COUNT(*) FROM tenants');
    console.log(`✅ SELECT works (${result.rows[0].count} tenants)\n`);
  } catch (err) {
    console.log(`❌ SELECT failed: ${err.message}\n`);
  }
  
  // Test INSERT (should fail)
  console.log('Test INSERT...');
  try {
    await dev.query("INSERT INTO tenants (name) VALUES ('test')");
    console.log('❌ SECURITY ISSUE: INSERT succeeded!\n');
  } catch (err) {
    if (err.message.includes('permission denied')) {
      console.log('✅ INSERT blocked (permission denied)\n');
    } else {
      console.log(`⚠️  INSERT failed but not due to permissions: ${err.message}\n`);
    }
  }
  
  // Test UPDATE (should fail)
  console.log('Test UPDATE...');
  try {
    await dev.query("UPDATE tenants SET name = 'test' WHERE id = (SELECT id FROM tenants LIMIT 1)");
    console.log('❌ SECURITY ISSUE: UPDATE succeeded!\n');
  } catch (err) {
    if (err.message.includes('permission denied')) {
      console.log('✅ UPDATE blocked (permission denied)\n');
    } else {
      console.log(`⚠️  UPDATE failed but not due to permissions: ${err.message}\n`);
    }
  }
  
  // Test DELETE (should fail)
  console.log('Test DELETE...');
  try {
    await dev.query("DELETE FROM tenants WHERE id = (SELECT id FROM tenants LIMIT 1)");
    console.log('❌ SECURITY ISSUE: DELETE succeeded!\n');
  } catch (err) {
    if (err.message.includes('permission denied')) {
      console.log('✅ DELETE blocked (permission denied)\n');
    } else {
      console.log(`⚠️  DELETE failed but not due to permissions: ${err.message}\n`);
    }
  }
  
  await dev.end();
}

async function testExecutorMutation() {
  console.log('🧪 TEST 2: Executor (AUTHORIZED MUTATION) Check\n');
  
  if (!process.env.DATABASE_EXECUTOR_URL) {
    console.log('⚠️  DATABASE_EXECUTOR_URL not configured\n');
    return;
  }
  
  const exec = new Client({ connectionString: process.env.DATABASE_EXECUTOR_URL });
  await exec.connect();
  
  const role = await exec.query('SELECT current_user');
  console.log(`Role: ${role.rows[0].current_user}\n`);
  
  // Test INSERT (should work)
  console.log('Test INSERT...');
  try {
    await exec.query('BEGIN');
    await exec.query("INSERT INTO tenants (name) VALUES ('r3-test')");
    await exec.query('ROLLBACK');
    console.log('✅ INSERT works (rolled back)\n');
  } catch (err) {
    console.log(`❌ INSERT failed: ${err.message}\n`);
  }
  
  // Test CREATE TABLE (should work)
  console.log('Test CREATE TABLE...');
  try {
    await exec.query('BEGIN');
    await exec.query('CREATE TABLE r3_test (id int)');
    await exec.query('ROLLBACK');
    console.log('✅ CREATE TABLE works (rolled back)\n');
  } catch (err) {
    console.log(`❌ CREATE TABLE failed: ${err.message}\n`);
  }
  
  // Test approvals access (should read only)
  console.log('Test approvals table access...');
  try {
    await exec.query('SELECT COUNT(*) FROM migration_governance.approvals');
    console.log('✅ Can SELECT from approvals\n');
  } catch (err) {
    console.log(`❌ Cannot SELECT approvals: ${err.message}\n`);
  }
  
  try {
    await exec.query("INSERT INTO migration_governance.approvals (migration_id, migration_files, environment, requested_by) VALUES ('test', ARRAY['test.sql'], 'test', 'test')");
    console.log('❌ SECURITY ISSUE: Can INSERT approvals (self-authorization possible)!\n');
  } catch (err) {
    if (err.message.includes('permission denied')) {
      console.log('✅ Cannot INSERT approvals (security fix works)\n');
    } else {
      console.log(`⚠️  INSERT approvals failed: ${err.message}\n`);
    }
  }
  
  await exec.end();
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║ R3 SIMPLE PERMISSION TEST                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    await testDeveloperReadOnly();
    await testExecutorMutation();
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║ TEST COMPLETE                                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
