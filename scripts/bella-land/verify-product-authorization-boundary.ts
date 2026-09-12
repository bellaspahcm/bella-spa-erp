/**
 * P5.5 Security Verification: Product Authorization Boundary
 * 
 * Verifies whether new UPDATE policy creates privilege expansion
 * Tests if partner user can UPDATE fields beyond reservation workflow needs
 * 
 * Expected behavior depends on business model:
 * - If partner SHOULD manage full Product: PASS = can UPDATE price/area
 * - If partner SHOULD only affect status via workflow: FAIL = can UPDATE price/area
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗');
  process.exit(1);
}

// Test credentials: partner user (NOT admin/manager)
const PARTNER_EMAIL = 'loadtest-realestate@test.local';
const PARTNER_PASSWORD = 'Test123456!';
const TEST_TENANT_ID = '1a6643da-3806-4793-a301-7a6d60b0d888';

interface TestResult {
  test: string;
  allowed: boolean;
  error?: string;
  interpretation: string;
}

async function main() {
  console.log('🔐 P5.5 Security Verification: Product Authorization Boundary\n');
  console.log('Testing partner user privileges after new UPDATE policy...\n');

  // Authenticate as partner user
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: PARTNER_EMAIL,
    password: PARTNER_PASSWORD,
  });

  if (authError || !authData.user) {
    console.error('❌ Authentication failed:', authError?.message);
    process.exit(1);
  }

  console.log(`✅ Authenticated as: ${authData.user.email}`);
  
  // Verify user role
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', authData.user.id)
    .single();

  if (userError || !userData) {
    console.error('❌ Failed to fetch user data:', userError?.message);
    process.exit(1);
  }

  console.log(`   Role: ${userData.role}`);
  console.log(`   Tenant: ${userData.tenant_id}\n`);

  if (userData.role === 'admin' || userData.role === 'manager') {
    console.error('⚠️  User is admin/manager - cannot test partner privileges');
    process.exit(1);
  }

  // Find a test product in tenant
  const { data: products, error: fetchError } = await supabase
    .from('real_estate_products')
    .select('id, product_code, status, unit_price, area, project_id')
    .eq('tenant_id', TEST_TENANT_ID)
    .limit(1);

  if (fetchError || !products || products.length === 0) {
    console.error('❌ Failed to fetch test product:', fetchError?.message);
    process.exit(1);
  }

  const testProduct = products[0];
  console.log(`📦 Test Product: ${testProduct.product_code}`);
  console.log(`   Current status: ${testProduct.status}`);
  console.log(`   Current price: ${testProduct.unit_price}`);
  console.log(`   Current area: ${testProduct.area}\n`);

  const results: TestResult[] = [];

  // Test 1: UPDATE status (required for reservation workflow)
  console.log('Test 1: UPDATE status field (workflow requirement)...');
  const newStatus = testProduct.status === 'available' ? 'booked' : 'available';
  const { error: statusError } = await supabase
    .from('real_estate_products')
    .update({ status: newStatus as any })
    .eq('id', testProduct.id)
    .eq('tenant_id', TEST_TENANT_ID);

  results.push({
    test: 'UPDATE status',
    allowed: !statusError,
    error: statusError?.message,
    interpretation: !statusError 
      ? '✅ Expected: Partner can update status via workflow'
      : '❌ Unexpected: Partner cannot update status (workflow broken)'
  });

  // Rollback status change
  if (!statusError) {
    await supabase
      .from('real_estate_products')
      .update({ status: testProduct.status as any })
      .eq('id', testProduct.id);
  }

  // Test 2: UPDATE unit_price (sensitive field)
  console.log('Test 2: UPDATE unit_price field (sensitive)...');
  const { error: priceError } = await supabase
    .from('real_estate_products')
    .update({ unit_price: testProduct.unit_price + 1000000 })
    .eq('id', testProduct.id)
    .eq('tenant_id', TEST_TENANT_ID);

  results.push({
    test: 'UPDATE unit_price',
    allowed: !priceError,
    error: priceError?.message,
    interpretation: !priceError
      ? '⚠️  PRIVILEGE EXPANSION: Partner can change pricing'
      : '✅ Expected: Partner cannot change pricing (admin-only)'
  });

  // Rollback price change if succeeded
  if (!priceError) {
    await supabase
      .from('real_estate_products')
      .update({ unit_price: testProduct.unit_price })
      .eq('id', testProduct.id);
  }

  // Test 3: UPDATE area (structural field)
  console.log('Test 3: UPDATE area field (structural)...');
  const { error: areaError } = await supabase
    .from('real_estate_products')
    .update({ area: testProduct.area + 10 })
    .eq('id', testProduct.id)
    .eq('tenant_id', TEST_TENANT_ID);

  results.push({
    test: 'UPDATE area',
    allowed: !areaError,
    error: areaError?.message,
    interpretation: !areaError
      ? '⚠️  PRIVILEGE EXPANSION: Partner can change structural data'
      : '✅ Expected: Partner cannot change structural data (admin-only)'
  });

  // Rollback area change if succeeded
  if (!areaError) {
    await supabase
      .from('real_estate_products')
      .update({ area: testProduct.area })
      .eq('id', testProduct.id);
  }

  // Test 4: UPDATE project_id (critical relationship)
  console.log('Test 4: UPDATE project_id field (critical relationship)...');
  const { error: projectError } = await supabase
    .from('real_estate_products')
    .update({ project_id: testProduct.project_id }) // same value to avoid breaking FK
    .eq('id', testProduct.id)
    .eq('tenant_id', TEST_TENANT_ID);

  results.push({
    test: 'UPDATE project_id',
    allowed: !projectError,
    error: projectError?.message,
    interpretation: !projectError
      ? '⚠️  PRIVILEGE EXPANSION: Partner can change product-project relationship'
      : '✅ Expected: Partner cannot change relationships (admin-only)'
  });

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SECURITY VERIFICATION RESULTS');
  console.log('='.repeat(80) + '\n');

  results.forEach(result => {
    console.log(`${result.test}:`);
    console.log(`  Allowed: ${result.allowed}`);
    if (result.error) console.log(`  Error: ${result.error}`);
    console.log(`  ${result.interpretation}\n`);
  });

  // Determine verdict
  const privilegeExpansion = results.filter(r => 
    r.test !== 'UPDATE status' && r.allowed
  );

  console.log('='.repeat(80));
  console.log('VERDICT:');
  console.log('='.repeat(80) + '\n');

  if (privilegeExpansion.length === 0) {
    console.log('✅ SECURITY BOUNDARY MAINTAINED');
    console.log('   - Partner can UPDATE status (required for workflow)');
    console.log('   - Partner CANNOT UPDATE sensitive fields (price, area, relationships)');
    console.log('   - Policy is sufficiently restrictive\n');
    console.log('👉 P5.5 can proceed to full Browser E2E verification\n');
    process.exit(0);
  } else {
    console.log('❌ PRIVILEGE EXPANSION DETECTED');
    console.log(`   - Partner can UPDATE ${privilegeExpansion.length} sensitive field(s):`);
    privilegeExpansion.forEach(r => console.log(`     • ${r.test}`));
    console.log('\n⚠️  SECURITY RISK: Generic UPDATE policy too permissive');
    console.log('\n🔒 REMEDIATION OPTIONS:');
    console.log('   A. Service-layer authorization (ReservationService uses service role)');
    console.log('   B. Column-level RLS policy (UPDATE only status/owner_name)');
    console.log('   C. RPC function with controlled mutation');
    console.log('\n👉 P5.5 CANNOT be sealed until authorization boundary corrected\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
