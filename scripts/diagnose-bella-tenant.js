/**
 * Diagnose Bella Baby Care Tenant - READ ONLY
 * 
 * This script ONLY reads data, does NOT modify anything.
 * Checks why Intelligence Layer returns errors for production tenant.
 * 
 * Usage: node scripts/diagnose-bella-tenant.js
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
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Bella Baby Care Tenant Diagnostic (READ ONLY)\n');
console.log('='.repeat(80));

// Find Bella Baby Care tenant (not test tenant)
async function findBellaTenant() {
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name')
    .neq('id', '11111111-1111-1111-1111-111111111111') // Skip test tenant
    .limit(10);

  if (error) {
    console.error('❌ Failed to get tenants:', error);
    return null;
  }

  console.log('📋 Available tenants:\n');
  tenants.forEach((t, idx) => {
    console.log(`   ${idx + 1}. ${t.name} - ${t.id}`);
  });

  // Assume first non-test tenant is Bella
  const bella = tenants[0];
  console.log(`\n✅ Using: ${bella.name} (${bella.id})\n`);
  return bella.id;
}

async function checkRevenueWithDetails(tenantId) {
  console.log('📊 REVENUE CHECK (last 30 days)\n');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  // Get all revenue records
  const { data: allRevenue, error: allError } = await supabase
    .from('revenue')
    .select('status, amount, revenue_type, received_date')
    .eq('tenant_id', tenantId)
    .gte('received_date', dateStr)
    .order('received_date', { ascending: false });

  if (allError) {
    console.error('❌ Query error:', allError);
    return;
  }

  console.log(`   Total revenue records: ${allRevenue.length}`);

  if (allRevenue.length === 0) {
    console.log('   🚨 NO REVENUE RECORDS in last 30 days!\n');
    return;
  }

  // Group by status
  const byStatus = allRevenue.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || []).concat(r);
    return acc;
  }, {});

  console.log('\n   By status:');
  Object.entries(byStatus).forEach(([status, records]) => {
    const total = records.reduce((sum, r) => sum + Number(r.amount), 0);
    console.log(`   - ${status}: ${records.length} records (${total.toLocaleString('vi-VN')} VND)`);
  });

  // Check confirmed revenue (what Intelligence Layer uses)
  const confirmedRevenue = allRevenue.filter(r => r.status === 'confirmed');
  const confirmedTotal = confirmedRevenue.reduce((sum, r) => sum + Number(r.amount), 0);

  console.log(`\n   ✅ Confirmed revenue (Intelligence uses this):`);
  console.log(`      Count: ${confirmedRevenue.length}`);
  console.log(`      Total: ${confirmedTotal.toLocaleString('vi-VN')} VND`);

  if (confirmedRevenue.length === 0) {
    console.log('\n   🚨 PROBLEM: NO CONFIRMED REVENUE!');
    console.log('   → Intelligence Layer will fail because it only counts confirmed revenue');
    console.log('   → Solution: Change status from "pending" to "confirmed" for real revenue\n');
  }
}

async function checkBookings(tenantId) {
  console.log('📊 BOOKINGS CHECK\n');

  const { data, error } = await supabase
    .from('bookings')
    .select('status, deposit_amount, full_price')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('❌ Query error:', error);
    return;
  }

  console.log(`   Total bookings: ${data.length}`);

  if (data.length === 0) {
    console.log('   🚨 NO BOOKINGS!\n');
    return;
  }

  const byStatus = data.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  console.log('   By status:', byStatus);

  const totalDeposits = data.reduce((sum, b) => sum + Number(b.deposit_amount || 0), 0);
  const totalValue = data.reduce((sum, b) => sum + Number(b.full_price || 0), 0);

  console.log(`   Total deposits collected: ${totalDeposits.toLocaleString('vi-VN')} VND`);
  console.log(`   Total contract value: ${totalValue.toLocaleString('vi-VN')} VND\n`);
}

async function checkSessions(tenantId) {
  console.log('📊 SESSIONS CHECK\n');

  const { data, error } = await supabase
    .from('session_logs')
    .select(`
      id,
      status,
      rating,
      bookings!inner(tenant_id)
    `)
    .eq('bookings.tenant_id', tenantId);

  if (error) {
    console.error('❌ Query error:', error);
    return;
  }

  console.log(`   Total sessions: ${data.length}`);

  if (data.length === 0) {
    console.log('   🚨 NO SESSIONS!\n');
    return;
  }

  const byStatus = data.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  console.log('   By status:', byStatus);

  const completedWithRating = data.filter(s => s.status === 'completed' && s.rating > 0);
  const avgRating = completedWithRating.length > 0
    ? completedWithRating.reduce((sum, s) => sum + s.rating, 0) / completedWithRating.length
    : 0;

  console.log(`   Completed sessions with ratings: ${completedWithRating.length}`);
  console.log(`   Average rating: ${avgRating.toFixed(2)} ⭐\n`);
}

async function checkAccountingOutbox(tenantId) {
  console.log('📊 ACCOUNTING OUTBOX CHECK\n');

  const { data, error } = await supabase
    .from('accounting_outbox')
    .select('event_type, status')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('❌ Query error:', error);
    return;
  }

  console.log(`   Total pending events (last 100): ${data.length}`);

  if (data.length === 0) {
    console.log('   ✅ Outbox is empty (all events processed)\n');
    return;
  }

  const byStatus = data.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  console.log('   By status:', byStatus);

  if (byStatus.pending > 0) {
    console.log(`\n   ⚠️  ${byStatus.pending} events pending processing!`);
    console.log('   → These may need to be processed to create revenue records');
    console.log('   → Run: POST /api/admin/accounting/process-outbox\n');
  }
}

async function main() {
  const tenantId = await findBellaTenant();
  if (!tenantId) {
    console.error('Cannot find tenant');
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('\n');

  await checkRevenueWithDetails(tenantId);
  await checkBookings(tenantId);
  await checkSessions(tenantId);
  await checkAccountingOutbox(tenantId);

  console.log('='.repeat(80));
  console.log('✅ Diagnostic complete (NO DATA WAS MODIFIED)');
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
