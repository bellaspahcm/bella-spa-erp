/**
 * CLEANUP: Remove Demo KTVs from Bella Spa (Production Tenant)
 * 
 * PROBLEM: Demo KTVs were accidentally created in Bella Spa instead of Test Beauty Spa
 * IMPACT: Polluted production data with test users
 * SOLUTION: Delete all KTVs matching demo patterns from Bella Spa only
 * 
 * SAFETY:
 * - Only affects Bella Spa tenant (production)
 * - Does NOT touch Test Beauty Spa
 * - Dry-run mode by default (set DRY_RUN=false to execute)
 * - Shows preview before deletion
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default: true (safe mode)

// Bella Spa tenant ID (production - needs cleanup)
const BELLA_SPA_TENANT_ID = '0e66365b-42b0-420e-acca-f7d7692e125e'; // ✅ From create-admin.js

// Demo KTV patterns to remove
const DEMO_PATTERNS = [
  'KTV Demo%',
  'Demo Facial%',
  'Demo Body%',
  'Employee High Balance%',
  'Gate2 Test%',
  '%@test.bellaspa.local' // Email pattern
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🧹 Cleaning up Demo KTVs from Bella Spa...\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (safe preview)' : '⚠️  EXECUTE (will delete)'}`);
  console.log(`Tenant: Bella Spa (${BELLA_SPA_TENANT_ID})\n`);
  
  if (DRY_RUN) {
    console.log('💡 Set DRY_RUN=false to execute deletion\n');
  }
  
  // Step 1: Find demo KTVs in Bella Spa
  console.log('Step 1: Find demo KTVs...');
  
  let query = supabase
    .from('users')
    .select('id, email, full_name, role, created_at')
    .eq('tenant_id', BELLA_SPA_TENANT_ID);
  
  // Build OR condition for all patterns
  const orConditions = DEMO_PATTERNS.map(pattern => {
    if (pattern.includes('@')) {
      return `email.like.${pattern}`;
    }
    return `full_name.like.${pattern}`;
  }).join(',');
  
  query = query.or(orConditions);
  
  const { data: demoKTVs, error } = await query;
  
  if (error) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  }
  
  if (!demoKTVs || demoKTVs.length === 0) {
    console.log('✅ No demo KTVs found in Bella Spa (already clean!)');
    process.exit(0);
  }
  
  console.log(`Found ${demoKTVs.length} demo KTVs:\n`);
  
  // Display found KTVs
  demoKTVs.forEach((ktv, index) => {
    console.log(`  ${index + 1}. ${ktv.full_name}`);
    console.log(`     Email: ${ktv.email}`);
    console.log(`     Role: ${ktv.role}`);
    console.log(`     Created: ${new Date(ktv.created_at).toLocaleString('vi-VN')}`);
    console.log(`     ID: ${ktv.id}\n`);
  });
  
  if (DRY_RUN) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 DRY RUN: No changes made');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('To execute deletion, run:');
    console.log('  DRY_RUN=false node scripts/cleanup-demo-ktvs-from-bella-spa.js');
    console.log('');
    process.exit(0);
  }
  
  // Step 2: Confirm deletion (only in execute mode)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  WARNING: About to DELETE these users!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Press Ctrl+C to cancel...');
  console.log('Waiting 5 seconds...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Step 3: Delete demo KTVs
  console.log('Step 2: Deleting demo KTVs...');
  
  const ktvIds = demoKTVs.map(ktv => ktv.id);
  
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .in('id', ktvIds);
  
  if (deleteError) {
    console.error('❌ Deletion failed:', deleteError.message);
    process.exit(1);
  }
  
  console.log(`✅ Deleted ${ktvIds.length} demo KTVs\n`);
  
  // Step 4: Verify cleanup
  console.log('Step 3: Verify cleanup...');
  
  const { data: remaining, error: verifyError } = await supabase
    .from('users')
    .select('id')
    .eq('tenant_id', BELLA_SPA_TENANT_ID)
    .or(orConditions);
  
  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
    process.exit(1);
  }
  
  if (remaining && remaining.length > 0) {
    console.error(`⚠️  Warning: ${remaining.length} demo KTVs still remain`);
    process.exit(1);
  }
  
  console.log('✅ Bella Spa is now clean (0 demo KTVs)\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Cleanup complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Summary:');
  console.log(`  Deleted: ${ktvIds.length} demo KTVs`);
  console.log(`  Remaining: 0`);
  console.log(`  Tenant: Bella Spa (production)`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Verify Bella Spa UI shows only real KTVs');
  console.log('  2. Update demo data creation to use Test Beauty Spa only');
  console.log('  3. Add validation in seeding scripts to prevent this');
  console.log('');
}

main().catch(error => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});

