#!/usr/bin/env node
/**
 * R3 STEP 1: TEST DATABASE CONNECTION
 * Tests that passwords are set correctly
 */

import pkg from 'pg';
const { Client } = pkg;
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function testConnection(roleName, connectionString) {
  console.log(`\n🔍 Testing ${roleName} connection...`);
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    const result = await client.query('SELECT current_user, current_database()');
    const { current_user, current_database } = result.rows[0];
    
    console.log(`✅ SUCCESS: Connected as '${current_user}' to database '${current_database}'`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    return false;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('R3 STEP 1: TEST DATABASE CONNECTIONS');
  console.log('='.repeat(70));
  
  console.log('\n📋 You need:');
  console.log('  1. Database host, port, database name');
  console.log('  2. Passwords you set for bella_developer and bella_migration_executor');
  console.log('  3. These will be tested but NOT saved to files');
  
  // Get connection details
  const host = await prompt('\n🔸 Database host (e.g., db.project.supabase.co): ');
  const port = await prompt('🔸 Database port (default 5432): ') || '5432';
  const database = await prompt('🔸 Database name (default postgres): ') || 'postgres';
  
  // Test bella_developer
  console.log('\n' + '-'.repeat(70));
  console.log('TEST 1: bella_developer (READ-ONLY role)');
  console.log('-'.repeat(70));
  const devPassword = await prompt('🔸 Enter bella_developer password: ');
  const devConnString = `postgresql://bella_developer:${devPassword}@${host}:${port}/${database}`;
  const devSuccess = await testConnection('bella_developer', devConnString);
  
  // Test bella_migration_executor
  console.log('\n' + '-'.repeat(70));
  console.log('TEST 2: bella_migration_executor (AUTHORIZED MUTATION role)');
  console.log('-'.repeat(70));
  const execPassword = await prompt('🔸 Enter bella_migration_executor password: ');
  const execConnString = `postgresql://bella_migration_executor:${execPassword}@${host}:${port}/${database}`;
  const execSuccess = await testConnection('bella_migration_executor', execConnString);
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('STEP 1 RESULTS');
  console.log('='.repeat(70));
  console.log(`bella_developer connection: ${devSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`bella_migration_executor connection: ${execSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  if (devSuccess && execSuccess) {
    console.log('\n🎉 STEP 1 COMPLETE: Both roles can authenticate');
    console.log('\n📝 Next: Update your .env file with these connection strings');
    console.log('\nDATABASE_URL (developer READ-ONLY):');
    console.log(`postgresql://bella_developer:<password>@${host}:${port}/${database}`);
    console.log('\nDATABASE_EXECUTOR_URL (executor MUTATION):');
    console.log(`postgresql://bella_migration_executor:<password>@${host}:${port}/${database}`);
  } else {
    console.log('\n❌ STEP 1 INCOMPLETE: Fix connection issues before proceeding');
  }
  
  rl.close();
}

main().catch(console.error);
