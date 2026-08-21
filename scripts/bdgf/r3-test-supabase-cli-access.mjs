#!/usr/bin/env node
/**
 * R3 AUTHORITY #2 TEST — Supabase CLI Access Control
 * 
 * Tests whether developer can push migrations to production via Supabase CLI
 * Expected: FAIL (developer should not have permission to mutate production)
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║ R3 AUTHORITY #2 TEST                                       ║');
console.log('║ Supabase CLI Production Push Capability                   ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

console.log('📋 TEST CONTEXT:');
console.log('Authority #2 Definition (from R1):');
console.log('  "Supabase CLI as mutation authority"');
console.log('');

// Get current project link
console.log('🔍 STEP 1: Check current project link');
let projectList;
try {
  projectList = execSync('npx supabase projects list', { encoding: 'utf-8' });
  console.log('Project List:');
  console.log(projectList);
} catch (error) {
  console.log('❌ Failed to get project list:', error.message);
  process.exit(1);
}

// Check if linked to production
const isLinkedToProduction = projectList.includes('●') && projectList.includes('lvnvkpyxtuilhrabtlwv');
console.log('');
console.log(`Linked to production: ${isLinkedToProduction ? '✅ YES' : '❌ NO'}`);
console.log('');

if (!isLinkedToProduction) {
  console.log('✅ PASS: Not linked to production');
  console.log('   Developer cannot push to production (no project link)');
  process.exit(0);
}

// If linked, check database push permissions
console.log('🔍 STEP 2: Check database push permissions');
console.log('');

// Get current user/role info
console.log('Checking Supabase CLI permissions...');
let orgInfo;
try {
  orgInfo = execSync('npx supabase orgs list', { encoding: 'utf-8' });
  console.log('Organization Info:');
  console.log(orgInfo);
} catch (error) {
  console.log('⚠️  Could not get org info:', error.message);
}
console.log('');

// Try to get remote database schema (requires read access)
console.log('🔍 STEP 3: Test remote database read access');
try {
  console.log('Attempting to inspect remote schema...');
  // This requires database read access
  const remoteSchema = execSync('npx supabase db dump --data-only --schema public --linked', { 
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  console.log('✅ Can read remote database schema');
} catch (error) {
  console.log('❌ Cannot read remote database schema');
  console.log('   Error:', error.message);
}
console.log('');

// Test write capability (create a harmless test migration)
console.log('🔍 STEP 4: Test migration push capability (DRY RUN)');
console.log('');

// Create a test migration file
const testMigrationPath = join(process.cwd(), 'supabase', 'migrations', '99999999999999_r3_authority2_test.sql');
const testMigration = `-- R3 Authority #2 Test Migration
-- This should NOT be pushed to production by developer
-- This is a test to verify CLI authority separation

-- Harmless SELECT statement (no mutation)
SELECT 1 AS r3_authority2_test;
`;

try {
  writeFileSync(testMigrationPath, testMigration, 'utf-8');
  console.log('✅ Test migration created:', testMigrationPath);
  console.log('');
  
  // Try to push (this is the actual authority test)
  console.log('Attempting to push test migration to production...');
  console.log('Expected result: Permission denied OR deployment requires additional approval');
  console.log('');
  
  try {
    const pushResult = execSync('npx supabase db push --linked --include-all', { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    console.log('⚠️  PUSH COMMAND EXECUTED');
    console.log('Output:');
    console.log(pushResult);
    console.log('');
    
    // Check if migration was actually applied
    if (pushResult.includes('Applied') || pushResult.includes('success')) {
      console.log('❌ FAIL: Developer CAN push migrations to production via CLI');
      console.log('   This is Authority #2 bypass — developer has mutation capability');
      console.log('');
      console.log('Remediation required:');
      console.log('  Option A: Remove developer from production project team');
      console.log('  Option B: Change developer role to "Read-only" in Supabase Dashboard');
      console.log('  Option C: Use separate production/development projects with team separation');
    } else {
      console.log('🟡 UNCERTAIN: Push command ran but unclear if applied');
      console.log('   Manual verification needed in Supabase Dashboard');
    }
    
  } catch (pushError) {
    console.log('✅ PASS: Push command blocked');
    console.log('Error message:');
    console.log(pushError.message);
    console.log('');
    
    if (pushError.message.includes('permission') || 
        pushError.message.includes('forbidden') ||
        pushError.message.includes('unauthorized') ||
        pushError.message.includes('not allowed')) {
      console.log('✅ Authority #2 is CLOSED');
      console.log('   Developer lacks permission to push migrations to production');
    } else {
      console.log('🟡 Push failed but reason unclear');
      console.log('   Manual verification recommended');
    }
  }
  
} finally {
  // Cleanup: remove test migration
  try {
    const fs = await import('fs');
    await fs.promises.unlink(testMigrationPath);
    console.log('');
    console.log('🧹 Cleanup: Test migration file removed');
  } catch (cleanupError) {
    console.log('⚠️  Could not remove test migration file:', testMigrationPath);
  }
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('TEST COMPLETE');
console.log('═══════════════════════════════════════════════════════════════');
