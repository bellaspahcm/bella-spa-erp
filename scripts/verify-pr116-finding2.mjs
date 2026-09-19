#!/usr/bin/env node
/**
 * PR#116 Finding #2 Verification
 * 
 * Checks if bootstrap.ts:40 type assertion is truly FALSE_POSITIVE
 * by verifying actual runtime contract compatibility.
 */

import { createClient } from '@supabase/supabase-js';

console.log('[Finding #2 Verification] Starting...\n');

// 1. Verify caller contract (PlatformBootstrapOptions)
console.log('1. Checking PlatformBootstrapOptions contract:');
console.log('   Expected: SupabaseClient<Record<string, unknown>>');

try {
  // Create client with generic Record type (as per PlatformBootstrapOptions)
  const genericClient = createClient(
    'https://dummy.supabase.co',
    'dummy-key'
  );
  
  console.log('   ✓ Generic client created successfully');
  console.log('   Type:', typeof genericClient);
  console.log('');
} catch (e) {
  console.error('   ✗ Failed to create generic client:', e.message);
  process.exit(1);
}

// 2. Verify callee contract (SupabaseEducationRepository)
console.log('2. Checking SupabaseEducationRepository constructor:');
console.log('   Reading constructor signature...');

import { readFileSync } from 'fs';
const repoPath = 'src/platform/education/repositories/supabase-education.repository.ts';

try {
  const content = readFileSync(repoPath, 'utf-8');
  
  // Extract constructor
  const constructorMatch = content.match(/constructor\s*\([^)]+\)/s);
  if (constructorMatch) {
    console.log('   Found:', constructorMatch[0].replace(/\s+/g, ' ').substring(0, 100));
    
    // Check for Database vs Record<string, unknown>
    if (constructorMatch[0].includes('Database')) {
      console.log('   ⚠ Constructor explicitly requires Database type');
      console.log('   This contradicts commit message claim');
      console.log('');
      console.log('VERDICT: Assertion may be HIDING type unsoundness');
      process.exit(2);
    } else if (constructorMatch[0].includes('Record<string, unknown>')) {
      console.log('   ✓ Constructor accepts Record<string, unknown>');
      console.log('   Types ARE compatible');
      console.log('');
      console.log('VERDICT: Assertion is SAFE (FALSE_POSITIVE confirmed)');
      process.exit(0);
    } else {
      console.log('   ⚠ Constructor type unclear from pattern match');
      console.log('   Manual inspection required');
      process.exit(3);
    }
  } else {
    console.log('   ✗ Constructor not found in expected format');
    process.exit(3);
  }
} catch (e) {
  console.error('   ✗ Failed to read repository:', e.message);
  process.exit(1);
}
