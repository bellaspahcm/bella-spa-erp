#!/usr/bin/env node
/**
 * Industrial Cleaning Enhanced Demo Tenant Cleanup Script V2
 * 
 * Safely removes demo tenant created by seed-cleaning-demo-v2.mjs
 * 
 * Usage:
 *   node --env-file=.env.local scripts/cleanup-cleaning-demo-v2.mjs [--confirm]
 * 
 * Default: Dry-run mode (shows what will be deleted)
 * --confirm: Actually perform deletion
 * 
 * Marker: CLEANING_DEMO_TENANT_V2
 */

const DRY_RUN = !process.argv.includes('--confirm');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase URL or Key');
  console.error('   Usage: node --env-file=.env.local scripts/cleanup-cleaning-demo-v2.mjs [--confirm]');
  process.exit(1);
}

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchAll(table, filter = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}&select=*`;
  const res = await fetch(url, { headers });
  return await res.json();
}

async function deleteRecords(table, ids) {
  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would delete ${ids.length} records from ${table}`);
    return ids.length;
  }

  if (ids.length === 0) return 0;

  const url = `${SUPABASE_URL}/rest/v1/${table}?id=in.(${ids.join(',')})`;
  const res = await fetch(url, { method: 'DELETE', headers });
  
  if (!res.ok) {
    console.error(`   ❌ Error deleting from ${table}:`, await res.text());
    return 0;
  }
  
  return ids.length;
}

async function run() {
  console.log('🧹 Industrial Cleaning Enhanced Demo Cleanup V2\n');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No data will be deleted');
    console.log('   Run with --confirm flag to actually delete data\n');
  } else {
    console.log('⚠️  CONFIRM MODE - Data will be permanently deleted!\n');
  }

  // 1. Find demo tenant
  console.log('📋 Step 1: Finding demo tenant...');
  const tenants = await fetchAll('tenants', 'name=eq.CleanPro%20Industrial%20Services%20V2%20%5BDEMO%5D');
  
  if (tenants.length === 0) {
    console.log('✅ No demo tenant found. Nothing to clean up.\n');
    return;
  }

  const tenant = tenants[0];
  const tid = tenant.id;
  console.log(`   Found: ${tenant.name} (ID: ${tid})\n`);

  let totalDeleted = 0;

  // 2. Delete session logs
  console.log('📋 Step 2: Deleting session logs...');
  const sessions = await fetchAll('session_logs', `tenant_id=eq.${tid}`);
  totalDeleted += await deleteRecords('session_logs', sessions.map(s => s.id));
  console.log(`   ✓ ${sessions.length} session logs\n`);

  // 3. Delete revenue
  console.log('📋 Step 3: Deleting revenue records...');
  const revenue = await fetchAll('revenue', `tenant_id=eq.${tid}`);
  totalDeleted += await deleteRecords('revenue', revenue.map(r => r.id));
  console.log(`   ✓ ${revenue.length} revenue records\n`);

  // 4. Delete expenses
  console.log('📋 Step 4: Deleting expenses...');
  const expenses = await fetchAll('expenses', `tenant_id=eq.${tid}`);
  totalDeleted += await deleteRecords('expenses', expenses.map(e => e.id));
  console.log(`   ✓ ${expenses.length} expenses\n`);

  // 5. Delete bookings
  console.log('📋 Step 5: Deleting bookings...');
  const bookings = await fetchAll('bookings', `tenant_id=eq.${tid}`);
  totalDeleted += await deleteRecords('bookings', bookings.map(b => b.id));
  console.log(`   ✓ ${bookings.length} bookings\n`);

  // 6. Delete customers
  console.log('📋 Step 6: Deleting customers...');
  const customers = await fetchAll('customers', `tenant_id=eq.${tid}`);
  totalDeleted += await deleteRecords('customers', customers.map(c => c.id));
  console.log(`   ✓ ${customers.length} customers\n`);

  // 7. Delete users (staff)
  console.log('📋 Step 7: Deleting users (staff)...');
  const users = await fetchAll('users', `tenant_id=eq.${tid}`);
  totalDeleted += await deleteRecords('users', users.map(u => u.id));
  console.log(`   ✓ ${users.length} users\n`);

  // 8. Delete tenant
  console.log('📋 Step 8: Deleting tenant...');
  totalDeleted += await deleteRecords('tenants', [tid]);
  console.log(`   ✓ ${tenant.name}\n`);

  // 9. Summary
  if (DRY_RUN) {
    console.log(`📊 Summary (DRY RUN):`);
    console.log(`   Would delete ${totalDeleted} total records across 8 tables\n`);
    console.log(`💡 To actually delete, run: node --env-file=.env.local scripts/cleanup-cleaning-demo-v2.mjs --confirm\n`);
  } else {
    console.log(`✅ Cleanup Complete!`);
    console.log(`   Deleted ${totalDeleted} total records\n`);
  }
}

run().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
