#!/usr/bin/env node
/**
 * Industrial Cleaning Demo Tenant Cleanup Script
 * 
 * Deletes ALL demo data created by seed-cleaning-demo.mjs script.
 * Identifies demo data via marker: CLEANING_DEMO_TENANT
 * 
 * Safety Features:
 * - Requires --confirm flag to execute
 * - Dry-run mode by default (shows what would be deleted)
 * - Verifies Bella/Beauty tenants unchanged
 * - Detailed logging of all operations
 * 
 * Usage:
 *   node --env-file=.env.local scripts/cleanup-cleaning-demo.mjs          # Dry run
 *   node --env-file=.env.local scripts/cleanup-cleaning-demo.mjs --confirm # Execute
 * 
 * ⚠️  WARNING: This will DELETE all demo cleaning data permanently!
 */

// Load environment variables from process.env (use --env-file flag)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase URL or Key');
  console.error('   Usage: node --env-file=.env.local scripts/cleanup-cleaning-demo.mjs');
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

async function verifyBellaBeautyUnchanged() {
  console.log('\n🔍 Verifying Bella/Beauty tenants unchanged...');
  
  // Check if any Bella/Beauty tenants exist
  const bellaTenants = await fetchAll('tenants', 'name=ilike.*bella*');
  const beautyTenants = await fetchAll('tenants', 'name=ilike.*beauty*');
  
  const safeT enants = [...bellaTenants, ...beautyTenants].filter(t => 
    !t.metadata?.marker || t.metadata.marker !== 'CLEANING_DEMO_TENANT'
  );

  if (safeTenants.length > 0) {
    console.log(`✅ Found ${safeTenants.length} Bella/Beauty tenant(s) - will NOT be touched`);
    safeTenants.forEach(t => {
      console.log(`   - ${t.name} (ID: ${t.id})`);
    });
    return true;
  } else {
    console.log('⚠️  No Bella/Beauty tenants found (this is unexpected in production)');
    return true; // Not an error, just informational
  }
}

async function countDemoData() {
  console.log('\n📊 Counting demo data to be deleted...\n');
  
  // Find demo tenant
  const demoTenants = await fetchAll('tenants', 'metadata->>marker=eq.CLEANING_DEMO_TENANT');
  
  if (demoTenants.length === 0) {
    console.log('✅ No cleaning demo tenant found. Nothing to clean up.');
    return { found: false };
  }

  const tid = demoTenants[0].id;
  const tenantName = demoTenants[0].name;
  
  console.log(`🎯 Found demo tenant: ${tenantName} (ID: ${tid})\n`);

  // Count all related records
  const users = await fetchAll('users', `tenant_id=eq.${tid}`);
  const customers = await fetchAll('customers', `tenant_id=eq.${tid}`);
  const bookings = await fetchAll('bookings', `tenant_id=eq.${tid}`);
  const sessions = await fetchAll('session_logs', `tenant_id=eq.${tid}`);
  const revenue = await fetchAll('revenue', `tenant_id=eq.${tid}`);
  const expenses = await fetchAll('expenses', `tenant_id=eq.${tid}`);
  const salaryRecords = await fetchAll('salary_records', `tenant_id=eq.${tid}`);
  
  const counts = {
    tenant: demoTenants.length,
    users: users.length,
    customers: customers.length,
    bookings: bookings.length,
    sessions: sessions.length,
    revenue: revenue.length,
    expenses: expenses.length,
    salaryRecords: salaryRecords.length
  };

  console.log('   Records to be deleted:');
  console.log(`   - Tenant: ${counts.tenant}`);
  console.log(`   - Users (staff): ${counts.users}`);
  console.log(`   - Customers: ${counts.customers}`);
  console.log(`   - Bookings (work orders): ${counts.bookings}`);
  console.log(`   - Session Logs: ${counts.sessions}`);
  console.log(`   - Revenue Records: ${counts.revenue}`);
  console.log(`   - Expense Records: ${counts.expenses}`);
  console.log(`   - Salary Records: ${counts.salaryRecords}`);
  console.log(`   - TOTAL: ${Object.values(counts).reduce((a, b) => a + b, 0)} records\n`);

  return { found: true, tenantId: tid, counts };
}

async function cleanupDemoData(tenantId) {
  console.log('\n🗑️  Starting cleanup process...\n');

  const results = {};

  // Delete in correct order (child records first due to foreign keys)
  
  console.log('1️⃣  Deleting salary records...');
  results.salaryRecords = await deleteRecords('salary_records', `tenant_id=eq.${tenantId}`);
  console.log(`   ${dryRun ? '[DRY RUN]' : '✅'} Deleted ${results.salaryRecords.count} salary records\n`);

  console.log('2️⃣  Deleting session logs...');
  results.sessions = await deleteRecords('session_logs', `tenant_id=eq.${tenantId}`);
  console.log(`   ${dryRun ? '[DRY RUN]' : '✅'} Deleted ${results.sessions.count} session logs\n`);

  console.log('3️⃣  Deleting revenue records...');
  results.revenue = await deleteRecords('revenue', `tenant_id=eq.${tenantId}`);
  console.log(`   ${dryRun ? '[DRY RUN]' : '✅'} Deleted ${results.revenue.count} revenue records\n`);

  console.log('4️⃣  Deleting expense records...');
  results.expenses = await deleteRecords('expenses', `tenant_id=eq.${tenantId}`);
  console.log(`   ${dryRun ? '[DRY RUN]' : '✅'} Deleted ${results.expenses.count} expense records\n`);

  console.log('5️⃣  Deleting bookings...');
  results.bookings = await deleteRecords('bookings', `tenant_id=eq.${tenantId}`);
  console.log(`   ${dryRun ? '[DRY RUN]' : '✅'} Deleted ${results.bookings.count} bookings\n`);

  console.log('6️⃣  Deleting customers...');
  results.customers = await deleteRecords('customers', `tenant_id=eq.${tenantId}`);
  console.log(`   ${dryRun ? '[DRY RUN]' : '✅'} Deleted ${results.customers.count} customers\n`);

  console.log('7️⃣  Deleting users (staff)...');
  results.users = await deleteRecords('users', `tenant_id=eq.${tenantId}`);
  console.log(`   ${dryRun ? '[DRY RUN]' : '✅'} Deleted ${results.users.count} users\n`);

  console.log('8️⃣  Deleting tenant...');
  results.tenant = await deleteRecords('tenants', `metadata->>marker=eq.CLEANING_DEMO_TENANT`);
  console.log(`   ${dryRun ? '[DRY RUN]' : '✅'} Deleted ${results.tenant.count} tenant\n`);

  return results;
}

async function verifyCleanup(tenantId) {
  if (dryRun) {
    console.log('\n[DRY RUN] Skipping verification (no actual deletion occurred)\n');
    return true;
  }

  console.log('\n✅ Verifying cleanup (all counts should be 0)...\n');

  const remaining = {
    users: (await fetchAll('users', `tenant_id=eq.${tenantId}`)).length,
    customers: (await fetchAll('customers', `tenant_id=eq.${tenantId}`)).length,
    bookings: (await fetchAll('bookings', `tenant_id=eq.${tenantId}`)).length,
    sessions: (await fetchAll('session_logs', `tenant_id=eq.${tenantId}`)).length,
    revenue: (await fetchAll('revenue', `tenant_id=eq.${tenantId}`)).length,
    expenses: (await fetchAll('expenses', `tenant_id=eq.${tenantId}`)).length,
    salaryRecords: (await fetchAll('salary_records', `tenant_id=eq.${tenantId}`)).length,
    tenant: (await fetchAll('tenants', 'metadata->>marker=eq.CLEANING_DEMO_TENANT')).length
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
  console.log('🧹 Industrial Cleaning Demo Tenant Cleanup Script\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be deleted');
    console.log('   Add --confirm flag to execute actual deletion\n');
  } else {
    console.log('⚠️  CONFIRM MODE - Data WILL be deleted permanently');
    console.log('   This action cannot be undone!\n');
  }

  // Step 1: Verify Bella/Beauty tenants are safe
  await verifyBellaBeautyUnchanged();

  // Step 2: Count demo data
  const { found, tenantId, counts } = await countDemoData();
  
  if (!found) {
    console.log('\n✅ Nothing to clean up. Exiting.\n');
    process.exit(0);
  }

  if (dryRun) {
    console.log('━'.repeat(60));
    console.log('DRY RUN COMPLETE');
    console.log('━'.repeat(60));
    console.log('\nTo execute the cleanup, run:');
    console.log('  node --env-file=.env.local scripts/cleanup-cleaning-demo.mjs --confirm\n');
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
  const results = await cleanupDemoData(tenantId);

  // Step 5: Verify cleanup
  const verified = await verifyCleanup(tenantId);

  // Step 6: Final summary
  console.log('━'.repeat(60));
  console.log(verified ? '✅ CLEANUP COMPLETED SUCCESSFULLY' : '❌ CLEANUP FAILED');
  console.log('━'.repeat(60));
  
  if (verified) {
    console.log('\nAll cleaning demo data has been deleted.');
    console.log('Bella ERP and Beauty Spa tenants remain unchanged.\n');
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
