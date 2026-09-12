/**
 * Bella Land - Reservation Concurrency Test
 * 
 * CRITICAL INVARIANT:
 * ONE APARTMENT → AT MOST ONE ACTIVE RESERVATION
 * 
 * Tests that two concurrent reservation attempts for the same apartment
 * result in exactly ONE success, not two.
 * 
 * If both succeed: 🔴 RC BLOCKER (double reservation possible)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ReservationPayload {
  tenant_id: string;
  customer_id: string;
  product_id: string;
  status: string;
  deposit_amount: number;
}

async function testConcurrentReservations() {
  console.log('\n🧪 Bella Land - Reservation Concurrency Test');
  console.log('═'.repeat(70));
  console.log('\n🎯 CRITICAL INVARIANT:');
  console.log('   ONE APARTMENT → AT MOST ONE ACTIVE RESERVATION\n');
  
  // Step 1: Get test customer
  console.log('━'.repeat(70));
  console.log('STEP 1: Fetch Test Customer');
  console.log('━'.repeat(70));

  const { data: customer, error: customerError } = await supabase
    .from('re_customers')
    .select('*')
    .eq('name', 'Reservation Test Customer')
    .single();

  if (customerError || !customer) {
    console.error('\n❌ Test customer not found');
    console.log('   Run: npx tsx scripts/bella-land/create-test-customer-for-reservation.ts');
    process.exit(1);
  }

  console.log(`\n✅ Customer found: ${customer.name}`);

  // Step 2: Get SECOND customer (for concurrent attempt)
  console.log('\n━'.repeat(70));
  console.log('STEP 2: Create Second Test Customer');
  console.log('━'.repeat(70));

  const { data: customer2, error: customer2Error } = await supabase
    .from('re_customers')
    .insert({
      tenant_id: customer.tenant_id,
      name: 'Concurrent Test Customer',
      phone: `+84${Date.now().toString().slice(-9)}`, // Unique phone
      email: `concurrent-${Date.now()}@test.com`,
      created_by: customer.tenant_id,
      updated_by: customer.tenant_id
    })
    .select()
    .single();

  if (customer2Error || !customer2) {
    console.error('\n❌ Failed to create second customer:', customer2Error?.message);
    process.exit(1);
  }

  console.log(`\n✅ Second customer created: ${customer2.name}`);

  // Step 3: Get any apartment (will clean up its reservations)
  console.log('\n━'.repeat(70));
  console.log('STEP 3: Fetch Test Apartment');
  console.log('━'.repeat(70));

  const { data: fetchedApartment, error: apartmentError } = await supabase
    .from('real_estate_products')
    .select('*')
    .eq('tenant_id', customer.tenant_id)
    .limit(1)
    .maybeSingle(); // Use maybeSingle to handle 0 or 1 result
  
  if (apartmentError) {
    console.error('\n❌ Error fetching apartment:', apartmentError.message);
    process.exit(1);
  }

  let apartment = fetchedApartment;

  if (!apartment) {
    // Try getting ANY apartment and note tenant mismatch
    const { data: anyApartment } = await supabase
      .from('real_estate_products')
      .select('*')
      .limit(1)
      .single();
    
    if (anyApartment) {
      console.log(`\n⚠️  No apartments for customer's tenant`);
      console.log(`   Customer tenant: ${customer.tenant_id.substring(0, 8)}...`);
      console.log(`   Using apartment from tenant: ${anyApartment.tenant_id.substring(0, 8)}...`);
      console.log(`   (This is OK for concurrency test)\n`);
      
      apartment = anyApartment;
    } else {
      console.error('\n❌ No apartments found in database at all');
      process.exit(1);
    }
  }

  console.log(`\n✅ Test apartment: ${apartment.apartment_code || apartment.id.substring(0, 8)}`);
  console.log(`   ID: ${apartment.id}`);

  // Step 4: Check current reservation count for this apartment
  console.log('\n━'.repeat(70));
  console.log('STEP 4: Check Current Reservation State');
  console.log('━'.repeat(70));

  const { count: beforeCount, error: countError } = await supabase
    .from('re_reservations')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', apartment.id)
    .eq('tenant_id', customer.tenant_id)
    .in('status', ['pending_deposit', 'deposited']); // Active statuses

  if (countError) {
    console.error('\n❌ Failed to count reservations:', countError.message);
    process.exit(1);
  }

  console.log(`\n📊 Active reservations for apartment BEFORE test: ${beforeCount}`);

  if (beforeCount && beforeCount > 0) {
    console.log('\n⚠️  Apartment already has active reservations');
    console.log('   Cleaning up before test...');

    const { error: deleteError } = await supabase
      .from('re_reservations')
      .delete()
      .eq('product_id', apartment.id)
      .eq('tenant_id', customer.tenant_id);

    if (deleteError) {
      console.error('\n❌ Failed to clean up:', deleteError.message);
      process.exit(1);
    }

    console.log('   ✅ Cleanup complete');
  }

  // Step 5: Prepare concurrent payloads
  console.log('\n━'.repeat(70));
  console.log('STEP 5: Prepare Concurrent Reservation Attempts');
  console.log('━'.repeat(70));

  const payload1: ReservationPayload = {
    tenant_id: customer.tenant_id,
    customer_id: customer.id,
    product_id: apartment.id,
    status: 'pending_deposit',
    deposit_amount: 50000000
  };

  const payload2: ReservationPayload = {
    tenant_id: customer.tenant_id,
    customer_id: customer2.id, // Different customer
    product_id: apartment.id,   // SAME apartment
    status: 'pending_deposit',
    deposit_amount: 60000000    // Different deposit
  };

  console.log('\n📝 Sales A (Customer 1):');
  console.log(`   Customer: ${customer.name}`);
  console.log(`   Apartment: ${apartment.apartment_code || apartment.id.substring(0, 8)}`);
  console.log(`   Deposit: ${payload1.deposit_amount.toLocaleString('vi-VN')} VND`);

  console.log('\n📝 Sales B (Customer 2):');
  console.log(`   Customer: ${customer2.name}`);
  console.log(`   Apartment: ${apartment.apartment_code || apartment.id.substring(0, 8)} (SAME!)`);
  console.log(`   Deposit: ${payload2.deposit_amount.toLocaleString('vi-VN')} VND`);

  // Step 6: Execute concurrent reservations
  console.log('\n━'.repeat(70));
  console.log('STEP 6: Execute Concurrent Reservations');
  console.log('━'.repeat(70));

  console.log('\n🏃 Running CONCURRENT reservation attempts...\n');

  const startTime = Date.now();

  // Launch both requests simultaneously
  const [result1, result2] = await Promise.allSettled([
    supabase.from('re_reservations').insert(payload1).select().single(),
    supabase.from('re_reservations').insert(payload2).select().single()
  ]);

  const duration = Date.now() - startTime;

  console.log(`⏱️  Both attempts completed in ${duration}ms\n`);

  // Step 7: Analyze results
  console.log('━'.repeat(70));
  console.log('STEP 7: Analyze Results');
  console.log('━'.repeat(70));

  const success1 = result1.status === 'fulfilled' && !result1.value.error;
  const success2 = result2.status === 'fulfilled' && !result2.value.error;

  console.log('\n📊 Individual Results:');
  console.log(`   Sales A: ${success1 ? '✅ SUCCESS' : '❌ FAILED'}`);
  if (!success1 && result1.status === 'fulfilled') {
    console.log(`      Error: ${result1.value.error?.message || 'Unknown'}`);
    console.log(`      Code: ${result1.value.error?.code || 'N/A'}`);
  }

  console.log(`   Sales B: ${success2 ? '✅ SUCCESS' : '❌ FAILED'}`);
  if (!success2 && result2.status === 'fulfilled') {
    console.log(`      Error: ${result2.value.error?.message || 'Unknown'}`);
    console.log(`      Code: ${result2.value.error?.code || 'N/A'}`);
  }

  // Step 8: Query final database state
  console.log('\n━'.repeat(70));
  console.log('STEP 8: Verify Database State (Ground Truth)');
  console.log('━'.repeat(70));

  const { data: reservations, count: afterCount, error: finalError } = await supabase
    .from('re_reservations')
    .select('*', { count: 'exact' })
    .eq('product_id', apartment.id)
    .eq('tenant_id', customer.tenant_id)
    .in('status', ['pending_deposit', 'deposited']);

  if (finalError) {
    console.error('\n❌ Failed to query final state:', finalError.message);
    process.exit(1);
  }

  console.log(`\n📊 Active reservations for apartment AFTER test: ${afterCount}`);

  if (reservations && reservations.length > 0) {
    console.log('\n   Reservation details:');
    reservations.forEach((r, i) => {
      console.log(`   ${i + 1}. ID: ${r.id.substring(0, 8)}...`);
      console.log(`      Customer: ${r.customer_id.substring(0, 8)}...`);
      console.log(`      Deposit: ${r.deposit_amount?.toLocaleString('vi-VN') || 0} VND`);
      console.log(`      Created: ${new Date(r.created_at).toLocaleString('vi-VN')}`);
    });
  }

  // Step 9: Verdict
  console.log('\n' + '═'.repeat(70));
  console.log('📊 CONCURRENCY TEST VERDICT');
  console.log('═'.repeat(70));

  const successCount = (success1 ? 1 : 0) + (success2 ? 1 : 0);

  console.log(`\n🎯 Expected: Exactly ONE success`);
  console.log(`   Actual: ${successCount} success(es)`);
  console.log(`   DB State: ${afterCount} active reservation(s)\n`);

  let testPassed = false;
  let blocker = false;

  if (afterCount === 1 && successCount <= 1) {
    console.log('✅ INVARIANT MAINTAINED');
    console.log('   ✅ Exactly ONE reservation in database');
    console.log('   ✅ No double-reservation occurred');
    console.log('   ✅ Concurrency safety verified\n');
    testPassed = true;
  } else if (afterCount === 0) {
    console.log('⚠️  BOTH FAILED');
    console.log('   ⚠️  Zero reservations created');
    console.log('   ⚠️  May indicate overly strict constraint');
    console.log('   ⚠️  OR both hit same validation error\n');
    testPassed = false;
  } else if (afterCount && afterCount > 1) {
    console.log('🔴 INVARIANT VIOLATED — RC BLOCKER');
    console.log('   🔴 MULTIPLE reservations for ONE apartment');
    console.log('   🔴 DOUBLE-RESERVATION POSSIBLE');
    console.log('   🔴 Business logic failure\n');
    blocker = true;
    testPassed = false;
  } else {
    console.log('⚠️  UNEXPECTED STATE');
    console.log(`   Response success: ${successCount}`);
    console.log(`   DB reservations: ${afterCount}`);
    console.log('   Investigate mismatch\n');
    testPassed = false;
  }

  // Step 10: Recommendations
  if (blocker) {
    console.log('━'.repeat(70));
    console.log('🔧 REQUIRED FIX');
    console.log('━'.repeat(70));
    console.log('\nOptions to prevent double-reservation:');
    console.log('\n1. UNIQUE partial index (recommended):');
    console.log('   CREATE UNIQUE INDEX idx_one_active_reservation_per_apartment');
    console.log('   ON re_reservations (product_id, tenant_id)');
    console.log("   WHERE status IN ('pending_deposit', 'deposited');");
    console.log('\n2. DB trigger/function:');
    console.log('   Before INSERT, check no active reservations exist');
    console.log('   RAISE exception if conflict');
    console.log('\n3. Optimistic locking:');
    console.log('   Version field on apartment');
    console.log('   Update version when reserving');
    console.log('   Second attempt sees stale version');
    console.log('\n4. Application-level lock (NOT recommended):');
    console.log('   SELECT FOR UPDATE');
    console.log('   Prone to race conditions');
    console.log('\n⚠️  Option 1 (partial unique index) is safest and most performant');
  }

  // Cleanup
  console.log('\n━'.repeat(70));
  console.log('CLEANUP');
  console.log('━'.repeat(70));

  if (reservations && reservations.length > 0) {
    const { error: cleanupError } = await supabase
      .from('re_reservations')
      .delete()
      .eq('product_id', apartment.id)
      .eq('tenant_id', customer.tenant_id);

    if (cleanupError) {
      console.log('\n⚠️  Failed to cleanup test reservations');
    } else {
      console.log(`\n✅ Cleaned up ${reservations.length} test reservation(s)`);
    }
  }

  const { error: cleanup2Error } = await supabase
    .from('re_customers')
    .delete()
    .eq('id', customer2.id);

  if (!cleanup2Error) {
    console.log('✅ Cleaned up second test customer');
  }

  console.log('\n' + '═'.repeat(70));

  if (blocker) {
    console.log('🔴 CONCURRENCY TEST: FAILED (RC BLOCKER)');
    console.log('═'.repeat(70) + '\n');
    process.exit(1);
  } else if (testPassed) {
    console.log('✅ CONCURRENCY TEST: PASSED');
    console.log('═'.repeat(70) + '\n');
    process.exit(0);
  } else {
    console.log('⚠️  CONCURRENCY TEST: INCONCLUSIVE');
    console.log('═'.repeat(70) + '\n');
    process.exit(1);
  }
}

testConcurrentReservations().catch((err) => {
  console.error('\n❌ Test failed with exception:', err);
  process.exit(1);
});
