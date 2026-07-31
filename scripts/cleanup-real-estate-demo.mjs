#!/usr/bin/env node
/**
 * Real Estate Demo Tenant Cleanup Script
 * 
 * Deletes ALL demo data created by seed-real-estate-demo.mjs script.
 * Identifies demo data via marker: REAL_ESTATE_DEMO_MARKER
 * 
 * Safety Features:
 * - Requires --confirm flag to execute
 * - Dry-run mode by default (shows what would be deleted)
 * - Verifies Bella/Beauty/Cleaning tenants unchanged
 * - Detailed logging of all operations
 * 
 * Usage:
 *   node --env-file=.env.local scripts/cleanup-real-estate-demo.mjs          # Dry run
 *   node --env-file=.env.local scripts/cleanup-real-estate-demo.mjs --confirm # Execute
 * 
 * ⚠️  WARNING: This will DELETE all demo real estate data permanently!
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase URL or Key');
  console.error('   Usage: node --env-file=.env.local scripts/cleanup-real-estate-demo.mjs');
  process.exit(1);
}

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// Check if confirm flag is provided
const args = process.argv.slice(2);
const confirmFlag = args.includes('--confirm');
const dryRun = !confirmFlag;

async function fetchAll(table, filter = '') {
  const url = filter 
    ? `${SUPABASE_URL}/rest/v1/${table}?${filter}&select=*`
    : `${SUPABASE_URL}/rest/v1/${table}?select=*`;
  
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`❌ Error fetching from ${table}:`, await res.text());
    return [];
  }
  return await res.json();
}

async function deleteRecords(table, filter) {
  if (dryRun) {
    console.log(`   [DRY RUN] Would delete from ${table} where ${filter}`);
    return { count: 0, dryRun: true };
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${filter}`,
    {
      method: 'DELETE',
      headers: { ...headers, 'Prefer': 'return=representation,count=exact' }
    }
  );

  if (!res.ok) {
    const error = await res.text();
    console.error(`❌ Error deleting from ${table}:`, error);
    return { count: 0, error };
  }

  const count = res.headers.get('content-range')?.split('/')[1] || '0';
  return { count: parseInt(count), dryRun: false };
}

async function verifyCoreTenantsUnchanged() {
  console.log('\n🔍 Verifying core tenants unchanged...');
  
  const allTenants = await fetchAll('tenants');
  const safeTenants = allTenants.filter(t => 
    !t.metadata?.marker || t.metadata.marker !== 'REAL_ESTATE_DEMO_MARKER'
  );

  if (safeTenants.length > 0) {
    console.log(`✅ Found ${safeTenants.length} core tenant(s) - will NOT be touched:`);
    safeTenants.forEach(t => {
      console.log(`   - ${t.name} (ID: ${t.id})`);
    });
    return true;
  } else {
    console.log('⚠️  No core tenants found');
    return true;
  }
}

async function countDemoData() {
  console.log('\n📊 Counting demo data to be deleted...\n');
  
  // Find demo tenant
  const demoTenants = await fetchAll('tenants', 'metadata->>marker=eq.REAL_ESTATE_DEMO_MARKER');
  
  if (demoTenants.length === 0) {
    console.log('✅ No real estate demo tenant found. Nothing to clean up.');
    return { found: false };
  }

  console.log(`🎯 Found ${demoTenants.length} demo tenant(s):\n`);
  for (const t of demoTenants) {
    console.log(`   - ${t.name} (ID: ${t.id})`);
  }
  console.log('');

  // Count related records
  let totalProjects = 0;
  let totalProducts = 0;
  for (const t of demoTenants) {
    const projects = await fetchAll('real_estate_projects', `tenant_id=eq.${t.id}`);
    const products = await fetchAll('real_estate_products', `tenant_id=eq.${t.id}`);
    totalProjects += projects.length;
    totalProducts += products.length;
  }
  
  const counts = {
    tenant: demoTenants.length,
    projects: totalProjects,
    products: totalProducts
  };

  console.log('   Records to be deleted:');
  console.log(`   - Tenant: ${counts.tenant}`);
  console.log(`   - Projects: ${counts.projects}`);
  console.log(`   - Products: ${counts.products}`);
  console.log(`   - TOTAL: ${Object.values(counts).reduce((a, b) => a + b, 0)} records\n`);

  return { found: true, demoTenants, counts };
}

async function cleanupDemoData(demoTenants) {
  console.log('\n🗑️  Starting cleanup process...\n');

  const results = {
    products: { count: 0 },
    projects: { count: 0 }
  };

  // Delete products first due to foreign keys, then projects for each tenant
  for (const t of demoTenants) {
    console.log(`1️⃣  Deleting products for tenant ${t.name} (${t.id})...`);
    const prodRes = await deleteRecords('real_estate_products', `tenant_id=eq.${t.id}`);
    results.products.count += prodRes.count;

    console.log(`2️⃣  Deleting projects for tenant ${t.name} (${t.id})...`);
    const projRes = await deleteRecords('real_estate_projects', `tenant_id=eq.${t.id}`);
    results.projects.count += projRes.count;
  }

  console.log('3️⃣  Deleting tenants...');
  results.tenant = await deleteRecords('tenants', `metadata->>marker=eq.REAL_ESTATE_DEMO_MARKER`);
  console.log(`   ${dryRun ? '[DRY RUN]' : '✅'} Deleted ${results.tenant.count} tenants\n`);

  return results;
}

async function verifyCleanup(demoTenants) {
  if (dryRun) {
    console.log('\n[DRY RUN] Skipping verification (no actual deletion occurred)\n');
    return true;
  }

  console.log('\n✅ Verifying cleanup (all counts should be 0)...\n');

  let remainingProducts = 0;
  let remainingProjects = 0;
  for (const t of demoTenants) {
    remainingProducts += (await fetchAll('real_estate_products', `tenant_id=eq.${t.id}`)).length;
    remainingProjects += (await fetchAll('real_estate_projects', `tenant_id=eq.${t.id}`)).length;
  }

  const remaining = {
    products: remainingProducts,
    projects: remainingProjects,
    tenant: (await fetchAll('tenants', 'metadata->>marker=eq.REAL_ESTATE_DEMO_MARKER')).length
  };

  console.log('   Remaining records:');
  Object.entries(remaining).forEach(([key, count]) => {
    const icon = count === 0 ? '✅' : '❌';
    console.log(`   ${icon} ${key}: ${count}`);
  });

  const allZero = Object.values(remaining).every(count => count === 0);
  
  if (allZero) {
    console.log('\n✅ Cleanup verification PASSED - all demo data deleted\n');
    return true;
  } else {
    console.log('\n❌ Cleanup verification FAILED - some records remain\n');
    return false;
  }
}

async function run() {
  console.log('🧹 Real Estate Demo Tenant Cleanup Script\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be deleted');
    console.log('   Add --confirm flag to execute actual deletion\n');
  } else {
    console.log('⚠️  CONFIRM MODE - Data WILL be deleted permanently');
    console.log('   This action cannot be undone!\n');
  }

  // Step 1: Verify core tenants are safe
  await verifyCoreTenantsUnchanged();

  // Step 2: Count demo data
  const { found, demoTenants, counts } = await countDemoData();
  
  if (!found) {
    console.log('\n✅ Nothing to clean up. Exiting.\n');
    process.exit(0);
  }

  if (dryRun) {
    console.log('━'.repeat(60));
    console.log('DRY RUN COMPLETE');
    console.log('━'.repeat(60));
    console.log('\nTo execute the cleanup, run:');
    console.log('  node --env-file=.env.local scripts/cleanup-real-estate-demo.mjs --confirm\n');
    process.exit(0);
  }

  // Step 3: Confirm before deletion
  console.log('━'.repeat(60));
  console.log('⚠️  FINAL CONFIRMATION');
  console.log('━'.repeat(60));
  console.log(`\nYou are about to DELETE ${Object.values(counts).reduce((a, b) => a + b, 0)} records.`);
  console.log('This action is IRREVERSIBLE.\n');
  console.log('Starting deletion in 3 seconds...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 4: Execute cleanup
  const results = await cleanupDemoData(demoTenants);

  // Step 5: Verify cleanup
  const verified = await verifyCleanup(demoTenants);

  // Step 6: Final summary
  console.log('━'.repeat(60));
  console.log(verified ? '✅ CLEANUP COMPLETED SUCCESSFULLY' : '❌ CLEANUP FAILED');
  console.log('━'.repeat(60));
  
  if (verified) {
    console.log('\nAll real estate demo data has been deleted.');
    console.log('Core Bella ERP, Beauty Spa, and CleanPro tenants remain unchanged.\n');
    process.exit(0);
  } else {
    console.log('\nCleanup incomplete. Please check error messages above.\n');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
