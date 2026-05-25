/**
 * Apply SQL fix bằng cách dùng Supabase Management API.
 * Vì Supabase không expose execute_sql RPC, cần dùng pg trực tiếp.
 * Script này hướng dẫn cách paste SQL fix vào dashboard.
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

// Test ngay xem function đã fix chưa (sau khi user apply SQL)
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: tenants } = await admin.from('tenants').select('id, name').limit(1);
const tenantId = tenants?.[0]?.id;
const today = new Date().toISOString().slice(0, 10);
const monthStart = today.slice(0, 8) + '01';

console.log('🧪 Testing get_reconciliation_report via service role...');
console.log('   Tenant:', tenants?.[0]?.name);
console.log('   Period:', monthStart, '→', today);

const { data, error } = await admin.rpc('get_reconciliation_report', {
  p_tenant_id: tenantId,
  p_from_date: monthStart,
  p_to_date: today,
});

if (error) {
  if (error.code === 'P0001' && error.message?.includes('Unauthorized')) {
    console.log('\n❌ Function vẫn còn check is_admin() — chưa apply fix.');
    console.log('\n📋 Paste file scratch/fix_reconciliation_auth.sql vào Supabase SQL Editor → Run');
  } else {
    console.error('\n❌ Error:', JSON.stringify(error, null, 2));
  }
  process.exit(1);
} else {
  console.log('\n✅ SUCCESS! Function returned', data?.length || 0, 'rows:');
  console.log(JSON.stringify(data, null, 2));
  console.log('\n🎉 Reconciliation function hoạt động — UI sẽ load OK.');
}
