/**
 * Debug Intelligence Layer Queries
 * 
 * This script tests Intelligence queries directly to identify:
 * 1. Empty arrays causing division by zero
 * 2. Failed joins with bookings table
 * 3. Missing materialized views
 * 
 * Usage: node scripts/debug-intelligence.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for full access
);

console.log('🔐 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('🔐 Service key loaded:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('');


// Test with first available tenant
async function getTestTenantId() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name')
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Failed to get tenant:', error);
    return null;
  }

  console.log(`✅ Using tenant: ${data.name} (${data.id})\n`);
  return data.id;
}

// Test 1: Check if revenue table has data
async function testRevenueData(tenantId) {
  console.log('📊 Test 1: Checking revenue table...');
  
  const { data, error, count } = await supabase
    .from('revenue')
    .select('*', { count: 'exact', head: false })
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed')
    .limit(5);

  if (error) {
    console.error('❌ Query error:', error);
    return false;
  }

  console.log(`   Found ${count} confirmed revenue records`);
  if (count === 0) {
    console.log('   ⚠️  NO DATA: This tenant has no confirmed revenue records!');
    console.log('   → This will cause Intelligence queries to return empty results');
    return false;
  }

  console.log(`   ✅ Sample records:`, data.slice(0, 2));
  return true;
}

// Test 2: Check if bookings table has data
async function testBookingsData(tenantId) {
  console.log('\n📊 Test 2: Checking bookings table...');
  
  const { data, error, count } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: false })
    .eq('tenant_id', tenantId)
    .limit(5);

  if (error) {
    console.error('❌ Query error:', error);
    return false;
  }

  console.log(`   Found ${count} booking records`);
  if (count === 0) {
    console.log('   ⚠️  NO DATA: This tenant has no bookings!');
    console.log('   → Customer metrics and operational efficiency will fail');
    return false;
  }

  console.log(`   ✅ Sample records:`, data.slice(0, 2));
  return true;
}

// Test 3: Check session logs with join
async function testSessionLogsJoin(tenantId) {
  console.log('\n📊 Test 3: Checking session_logs with bookings join...');
  
  try {
    const { data, error, count } = await supabase
      .from('session_logs')
      .select(`
        id,
        status,
        rating,
        bookings!inner(tenant_id, id)
      `, { count: 'exact', head: false })
      .eq('bookings.tenant_id', tenantId)
      .eq('status', 'completed')
      .limit(5);

    if (error) {
      console.error('❌ Join error:', error);
      console.log('   → This join is used in Operational Efficiency queries');
      return false;
    }

    console.log(`   Found ${count} completed sessions`);
    if (count === 0) {
      console.log('   ⚠️  NO DATA: No completed sessions found!');
      console.log('   → Operational efficiency metrics will be zero');
      return false;
    }

    console.log(`   ✅ Join successful, sample records:`, data.slice(0, 2));
    return true;
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return false;
  }
}

// Test 4: Check KTV users
async function testKTVUsers(tenantId) {
  console.log('\n📊 Test 4: Checking KTV users...');
  
  const { data, error, count } = await supabase
    .from('users')
    .select('id, full_name, role', { count: 'exact', head: false })
    .eq('tenant_id', tenantId)
    .eq('role', 'ktv')
    .limit(5);

  if (error) {
    console.error('❌ Query error:', error);
    return false;
  }

  console.log(`   Found ${count} KTV users`);
  if (count === 0) {
    console.log('   ⚠️  NO DATA: This tenant has no KTV users!');
    console.log('   → Operational efficiency will show 0% utilization');
    return false;
  }

  console.log(`   ✅ Sample KTVs:`, data.slice(0, 2));
  return true;
}

// Test 5: Check expenses
async function testExpensesData(tenantId) {
  console.log('\n📊 Test 5: Checking expenses table...');
  
  const { data, error, count } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: false })
    .eq('tenant_id', tenantId)
    .in('status', ['approved', 'paid'])
    .limit(5);

  if (error) {
    console.error('❌ Query error:', error);
    return false;
  }

  console.log(`   Found ${count} approved/paid expense records`);
  if (count === 0) {
    console.log('   ⚠️  NO DATA: This tenant has no expenses!');
    console.log('   → Financial health profit margin will be 100%');
  } else {
    console.log(`   ✅ Sample records:`, data.slice(0, 2));
  }

  return true;
}

// Main diagnostic
async function main() {
  console.log('🔍 Intelligence Layer Diagnostic Tool\n');
  console.log('='.repeat(80));

  const tenantId = await getTestTenantId();
  if (!tenantId) {
    console.error('\n❌ Cannot proceed without a tenant ID');
    process.exit(1);
  }

  const results = {
    revenue: await testRevenueData(tenantId),
    bookings: await testBookingsData(tenantId),
    sessionLogs: await testSessionLogsJoin(tenantId),
    ktvUsers: await testKTVUsers(tenantId),
    expenses: await testExpensesData(tenantId),
    pendingRevenue: await testPendingRevenue(tenantId),
  };

  console.log('\n' + '='.repeat(80));
  console.log('📋 DIAGNOSTIC SUMMARY\n');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  console.log(`Tests passed: ${passed}/${total}\n`);

  if (passed === 0) {
    console.log('🚨 CRITICAL: This tenant has NO data for Intelligence Layer!');
    console.log('   → You need to seed demo data or create real transactions first\n');
    console.log('   Recommended actions:');
    console.log('   1. Run demo data seeder: npm run seed:demo');
    console.log('   2. Or create real bookings/revenue manually in the UI');
  } else if (passed < total) {
    console.log('⚠️  WARNING: Some data sources are missing');
    console.log('   → Intelligence metrics will show partial or zero values\n');
    console.log('   Missing data:');
    Object.entries(results).forEach(([key, value]) => {
      if (!value) console.log(`   - ${key}`);
    });
  } else {
    console.log('✅ ALL CHECKS PASSED!');
    console.log('   → Intelligence Layer should work correctly');
    console.log('   → If still getting errors, check API endpoint logs');
  }

  console.log('\n' + '='.repeat(80));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});


// Test 6: Check pending revenue (not confirmed yet)
async function testPendingRevenue(tenantId) {
  console.log('\n📊 Test 6: Checking pending revenue (not confirmed)...');
  
  const { data, error, count } = await supabase
    .from('revenue')
    .select('*', { count: 'exact', head: false })
    .eq('tenant_id', tenantId)
    .limit(10);

  if (error) {
    console.error('❌ Query error:', error);
    return false;
  }

  console.log(`   Found ${count} total revenue records (all statuses)`);
  
  if (count > 0) {
    const byStatus = data.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('   Status breakdown:', byStatus);
    console.log('   ⚠️  You have revenue records but none are confirmed!');
    console.log('   → Update status to "confirmed" to make them visible');
  } else {
    console.log('   ⚠️  NO REVENUE DATA AT ALL!');
    console.log('   → You need to create revenue records first');
  }

  return count > 0;
}
