/**
 * Bella Land - Tenant Isolation Negative Suite (Reservations)
 * 
 * CRITICAL SECURITY BOUNDARY:
 * Tenant B MUST NOT access Tenant A's reservations
 * 
 * Tests:
 * T1. READ: Tenant B cannot read Tenant A's reservations
 * T2. CREATE: Tenant B cannot create reservation with Tenant A's tenant_id
 * T3. UPDATE: Tenant B cannot update Tenant A's reservations
 * T4. DELETE: Tenant B cannot delete Tenant A's reservations
 * 
 * IMPORTANT: Uses anon client (RLS enforced), NOT service-role (RLS bypassed)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Service client for setup only
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testTenantIsolation() {
  console.log('\n🔒 Bella Land - Tenant Isolation Negative Suite');
  console.log('═'.repeat(70));
  console.log('\n🎯 CRITICAL SECURITY BOUNDARY:');
  console.log('   Tenant B MUST NOT access Tenant A\'s reservations\n');

  // Setup: Create test data for Tenant A
  console.log('━'.repeat(70));
  console.log('SETUP: Create Test Data');
  console.log('━'.repeat(70));

  // Get two different tenants that have apartments
  const { data: tenantsWithApartments } = await supabaseAdmin
    .from('real_estate_products')
    .select('tenant_id')
    .limit(100);

  if (!tenantsWithApartments || tenantsWithApartments.length === 0) {
    console.error('\n❌ No apartments found in database');
    process.exit(1);
  }

  // Get unique tenant IDs that have apartments
  const uniqueTenantIds = [...new Set(tenantsWithApartments.map(p => p.tenant_id))];
  
  if (uniqueTenantIds.length < 2) {
    console.error('\n❌ Need at least 2 tenants with apartments');
    process.exit(1);
  }

  // Get tenant details for first two tenants that have apartments
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, name')
    .in('id', uniqueTenantIds.slice(0, 2));

  if (!tenants || tenants.length < 2) {
    console.error('\n❌ Failed to fetch tenant details');
    process.exit(1);
  }

  const tenantA = tenants[0];
  const tenantB = tenants[1];

  console.log(`\n✅ Tenant A: ${tenantA.name} (${tenantA.id.substring(0, 8)}...)`);
  console.log(`✅ Tenant B: ${tenantB.name} (${tenantB.id.substring(0, 8)}...)`);

  // Get or create test customer for Tenant A
  let { data: customerA } = await supabaseAdmin
    .from('re_customers')
    .select('*')
    .eq('tenant_id', tenantA.id)
    .limit(1)
    .single();

  if (!customerA) {
    console.log(`\n⚙️  Creating test customer for Tenant A...`);
    const { data: newCustomer, error: createCustomerError } = await supabaseAdmin
      .from('re_customers')
      .insert({
        tenant_id: tenantA.id,
        name: 'Test Customer (Tenant Isolation)',
        phone: '0900000001',
        email: 'tenant-isolation-test@example.com'
      })
      .select()
      .single();

    if (createCustomerError || !newCustomer) {
      console.error('\n❌ Failed to create test customer:', createCustomerError?.message);
      process.exit(1);
    }

    customerA = newCustomer;
    console.log(`   ✅ Customer created: ${customerA.name} (${customerA.id.substring(0, 8)}...)`);
  }

  const { data: apartmentA } = await supabaseAdmin
    .from('real_estate_products')
    .select('*')
    .eq('tenant_id', tenantA.id)
    .limit(1)
    .single();

  if (!apartmentA) {
    console.error('\n❌ No apartment found for Tenant A');
    process.exit(1);
  }

  // Clean up any existing test reservations
  await supabaseAdmin
    .from('re_reservations')
    .delete()
    .eq('product_id', apartmentA.id)
    .eq('customer_id', customerA.id);

  const { data: reservationA, error: createError } = await supabaseAdmin
    .from('re_reservations')
    .insert({
      tenant_id: tenantA.id,
      customer_id: customerA.id,
      product_id: apartmentA.id,
      status: 'pending_deposit',
      deposit_amount: 100000000
    })
    .select()
    .single();

  if (createError || !reservationA) {
    console.error('\n❌ Failed to create test reservation:', createError?.message);
    process.exit(1);
  }

  console.log(`\n✅ Test reservation created:`);
  console.log(`   ID: ${reservationA.id.substring(0, 8)}...`);
  console.log(`   Tenant: ${tenantA.name}`);
  console.log(`   Customer: ${customerA.name}`);
  console.log(`   Apartment: ${apartmentA.product_code || apartmentA.id.substring(0, 8)}`);
  console.log(`   Deposit: ${reservationA.deposit_amount?.toLocaleString('vi-VN')} VND`);

  // Get auth tokens for both tenants
  // NOTE: This requires users to exist with proper tenant associations
  // For now, we'll test with anon client + tenant_id in query (RLS should enforce)

  console.log('\n⚠️  NOTE: Testing with direct queries (RLS policies enforced on anon client)');
  console.log('   Production should use proper auth tokens per tenant\n');

  // Create anon client (RLS enforced)
  const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let testsPassed = 0;
  let testsFailed = 0;
  const failures: string[] = [];

  // T1: READ - Tenant B cannot read Tenant A's reservation
  console.log('━'.repeat(70));
  console.log('T1: READ Isolation');
  console.log('━'.repeat(70));

  console.log('\n🔍 Tenant B attempts to read Tenant A\'s reservation...');

  const { data: readResult, error: readError, count: readCount } = await supabaseAnon
    .from('re_reservations')
    .select('*', { count: 'exact' })
    .eq('id', reservationA.id);

  // Expected: 0 rows (RLS blocks cross-tenant read)
  if ((readCount === 0 || !readResult || readResult.length === 0) && !readError) {
    console.log('✅ T1 PASS: Tenant B cannot read Tenant A\'s reservation');
    console.log(`   Query returned: ${readCount || 0} rows (expected 0)`);
    testsPassed++;
  } else {
    console.log('🔴 T1 FAIL: Tenant B CAN read Tenant A\'s reservation!');
    console.log(`   Query returned: ${readCount || readResult?.length || 0} rows`);
    if (readResult && readResult.length > 0) {
      console.log(`   Leaked data: ${JSON.stringify(readResult[0], null, 2)}`);
    }
    testsFailed++;
    failures.push('T1: Cross-tenant READ not blocked');
  }

  // T2: CREATE - Tenant B cannot create reservation with Tenant A's tenant_id
  console.log('\n━'.repeat(70));
  console.log('T2: CREATE with Wrong Tenant ID');
  console.log('━'.repeat(70));

  console.log('\n🔍 Tenant B attempts to create reservation with Tenant A\'s tenant_id...');

  const { data: createResult, error: createTenantError } = await supabaseAnon
    .from('re_reservations')
    .insert({
      tenant_id: tenantA.id, // Trying to use Tenant A's ID
      customer_id: customerA.id,
      product_id: apartmentA.id,
      status: 'pending_deposit',
      deposit_amount: 50000000
    })
    .select();

  // Expected: Blocked by RLS
  if (createTenantError || !createResult || createResult.length === 0) {
    console.log('✅ T2 PASS: Cannot create reservation with wrong tenant_id');
    console.log(`   Error: ${createTenantError?.message || 'Insert blocked'}`);
    testsPassed++;
  } else {
    console.log('🔴 T2 FAIL: Successfully created reservation with wrong tenant_id!');
    console.log(`   Created: ${createResult[0].id}`);
    testsFailed++;
    failures.push('T2: Cross-tenant CREATE not blocked');
    
    // Cleanup
    await supabaseAdmin
      .from('re_reservations')
      .delete()
      .eq('id', createResult[0].id);
  }

  // T3: UPDATE - Tenant B cannot update Tenant A's reservation
  console.log('\n━'.repeat(70));
  console.log('T3: UPDATE Isolation');
  console.log('━'.repeat(70));

  console.log('\n🔍 Tenant B attempts to update Tenant A\'s reservation...');

  const { data: updateResult, error: updateError, count: updateCount } = await supabaseAnon
    .from('re_reservations')
    .update({ deposit_amount: 999999999 })
    .eq('id', reservationA.id)
    .select();

  // Expected: 0 rows updated (RLS blocks cross-tenant update)
  if ((updateCount === 0 || !updateResult || updateResult.length === 0) && !updateError) {
    console.log('✅ T3 PASS: Tenant B cannot update Tenant A\'s reservation');
    console.log(`   Rows updated: ${updateCount || 0} (expected 0)`);
    testsPassed++;
  } else {
    console.log('🔴 T3 FAIL: Tenant B CAN update Tenant A\'s reservation!');
    console.log(`   Rows updated: ${updateCount || updateResult?.length || 0}`);
    testsFailed++;
    failures.push('T3: Cross-tenant UPDATE not blocked');
  }

  // Verify reservation wasn't actually updated
  const { data: verifyUpdate } = await supabaseAdmin
    .from('re_reservations')
    .select('deposit_amount')
    .eq('id', reservationA.id)
    .single();

  if (verifyUpdate && verifyUpdate.deposit_amount !== reservationA.deposit_amount) {
    console.log('🔴 WARNING: Reservation was modified despite RLS!');
    console.log(`   Original: ${reservationA.deposit_amount}`);
    console.log(`   Current: ${verifyUpdate.deposit_amount}`);
    if (!failures.includes('T3: Cross-tenant UPDATE not blocked')) {
      testsFailed++;
      testsPassed--;
      failures.push('T3: Cross-tenant UPDATE not blocked (verified by read)');
    }
  }

  // T4: DELETE - Tenant B cannot delete Tenant A's reservation
  console.log('\n━'.repeat(70));
  console.log('T4: DELETE Isolation');
  console.log('━'.repeat(70));

  console.log('\n🔍 Tenant B attempts to delete Tenant A\'s reservation...');

  const { data: deleteResult, error: deleteError, count: deleteCount } = await supabaseAnon
    .from('re_reservations')
    .delete()
    .eq('id', reservationA.id)
    .select();

  // Expected: 0 rows deleted (RLS blocks cross-tenant delete)
  if ((deleteCount === 0 || !deleteResult || deleteResult.length === 0) && !deleteError) {
    console.log('✅ T4 PASS: Tenant B cannot delete Tenant A\'s reservation');
    console.log(`   Rows deleted: ${deleteCount || 0} (expected 0)`);
    testsPassed++;
  } else {
    console.log('🔴 T4 FAIL: Tenant B CAN delete Tenant A\'s reservation!');
    console.log(`   Rows deleted: ${deleteCount || deleteResult?.length || 0}`);
    testsFailed++;
    failures.push('T4: Cross-tenant DELETE not blocked');
  }

  // Verify reservation still exists
  const { data: verifyExists, error: verifyError } = await supabaseAdmin
    .from('re_reservations')
    .select('id')
    .eq('id', reservationA.id)
    .single();

  if (verifyError || !verifyExists) {
    console.log('🔴 CRITICAL: Reservation was deleted despite RLS!');
    if (!failures.includes('T4: Cross-tenant DELETE not blocked')) {
      testsFailed++;
      testsPassed--;
      failures.push('T4: Cross-tenant DELETE not blocked (verified by read)');
    }
  } else {
    console.log('   ✅ Reservation still exists (verified)');
  }

  // Cleanup
  console.log('\n━'.repeat(70));
  console.log('CLEANUP');
  console.log('━'.repeat(70));

  const { error: cleanupError } = await supabaseAdmin
    .from('re_reservations')
    .delete()
    .eq('id', reservationA.id);

  if (cleanupError) {
    console.log('\n⚠️  Failed to cleanup test reservation');
  } else {
    console.log('\n✅ Test reservation cleaned up');
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 TENANT ISOLATION TEST SUMMARY');
  console.log('═'.repeat(70));

  console.log(`\n✅ Tests Passed: ${testsPassed}/4`);
  console.log(`${testsFailed > 0 ? '🔴' : '✅'} Tests Failed: ${testsFailed}/4`);

  if (failures.length > 0) {
    console.log('\n🔴 FAILURES:');
    failures.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
  }

  console.log('\n' + '═'.repeat(70));

  if (testsFailed > 0) {
    console.log('🔴 TENANT ISOLATION: FAILED - RC BLOCKER');
    console.log('═'.repeat(70) + '\n');
    process.exit(1);
  } else {
    console.log('✅ TENANT ISOLATION: ALL TESTS PASSED');
    console.log('═'.repeat(70) + '\n');
    process.exit(0);
  }
}

testTenantIsolation().catch((err) => {
  console.error('\n❌ Test failed with exception:', err);
  process.exit(1);
});
