/**
 * Diagnostic script — test get_reconciliation_report function trực tiếp
 * qua service role key. Bypass mọi GRANT/RLS/session.
 *
 * Run: node scratch/debug_reconciliation.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env vars from .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim();
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔧 Config:');
console.log('  URL:', url);
console.log('  Service key prefix:', serviceKey.slice(0, 20) + '...');
console.log('  Anon key prefix:', anonKey.slice(0, 20) + '...');
console.log();

// ────────────────────────────────────────────────────────────────────────
// TEST 1: Service role call (should always work — bypasses all permissions)
// ────────────────────────────────────────────────────────────────────────
console.log('━━━ TEST 1: Service Role RPC ━━━');
const adminClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// First get a tenant ID
const { data: tenants, error: tenantErr } = await adminClient
  .from('tenants').select('id, name').limit(1);

if (tenantErr) {
  console.error('❌ Cannot fetch tenants:', JSON.stringify(tenantErr, null, 2));
  process.exit(1);
}
console.log('✓ Found tenant:', tenants[0].name, tenants[0].id);

const tenantId = tenants[0].id;
const today = new Date().toISOString().slice(0, 10);
const monthStart = today.slice(0, 8) + '01';

const { data: rpcData, error: rpcErr } = await adminClient.rpc('get_reconciliation_report', {
  p_tenant_id: tenantId,
  p_from_date: monthStart,
  p_to_date: today,
});

if (rpcErr) {
  console.error('❌ Service role RPC FAILED:');
  console.error(JSON.stringify({
    message: rpcErr.message,
    code: rpcErr.code,
    details: rpcErr.details,
    hint: rpcErr.hint,
  }, null, 2));
} else {
  console.log('✅ Service role RPC SUCCESS!');
  console.log('   Rows returned:', rpcData?.length || 0);
  if (rpcData?.length > 0) {
    console.log('   Sample row:', JSON.stringify(rpcData[0], null, 2));
  }
}

// ────────────────────────────────────────────────────────────────────────
// TEST 2: Anon role call (no auth session)
// ────────────────────────────────────────────────────────────────────────
console.log('\n━━━ TEST 2: Anon Role RPC (no session) ━━━');
const anonClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: anonData, error: anonErr } = await anonClient.rpc('get_reconciliation_report', {
  p_tenant_id: tenantId,
  p_from_date: monthStart,
  p_to_date: today,
});

if (anonErr) {
  console.error('❌ Anon RPC failed (expected if no GRANT to anon):');
  console.error(JSON.stringify({
    message: anonErr.message,
    code: anonErr.code,
    details: anonErr.details,
    hint: anonErr.hint,
  }, null, 2));
} else {
  console.log('✅ Anon RPC returned:', anonData?.length || 0, 'rows');
}

// ────────────────────────────────────────────────────────────────────────
// DIAGNOSIS
// ────────────────────────────────────────────────────────────────────────
console.log('\n━━━ DIAGNOSIS ━━━');
if (!rpcErr) {
  console.log('✅ Function works perfectly via service role.');
  console.log('   Issue: Next.js Server Component dùng anon key + cookie session');
  console.log('         có thể session cookie không valid → role = anon → 42883');
  console.log();
  console.log('   FIX: Sửa server action getReconciliationReport dùng admin client');
  console.log('        (service role) thay vì user-session client.');
} else if (rpcErr.code === '42883') {
  console.log('❌ Function literally không thấy via Supabase API.');
  console.log('   Có thể: PostgREST cache cứng đầu — cần restart project sâu hơn');
  console.log('   hoặc function tạo trong schema khác public.');
} else if (rpcErr.code === 'P0001') {
  console.log('⚠️ Function được tìm thấy nhưng auth check bên trong reject.');
  console.log('   Service role bypass GRANT nhưng is_admin() vẫn check auth.uid()');
  console.log('   → cần điều chỉnh function bỏ check khi service role gọi.');
}
