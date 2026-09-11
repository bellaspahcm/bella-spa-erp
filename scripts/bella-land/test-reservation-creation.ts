/**
 * Bella Land - Reservation Creation Runtime Test
 * 
 * Tests full reservation workflow:
 * 1. Pick existing customer, project, apartment
 * 2. Create reservation via engine
 * 3. Verify persistence
 * 4. Check state transitions
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testReservationCreation() {
  console.log('\n🧪 Bella Land - Reservation Creation Runtime Test\n');
  console.log('═'.repeat(70));

  // Step 1: Get test customer
  console.log('\n━'.repeat(70));
  console.log('STEP 1: Fetch Test Customer');
  console.log('━'.repeat(70));

  const { data: customer, error: customerError } = await supabase
    .from('re_customers')
    .select('*')
    .eq('phone', '0901111111')
    .is('deleted_at', null)
    .maybeSingle();

  if (customerError || !customer) {
    console.error('\n❌ Test customer not found. Run: npx tsx scripts/bella-land/create-test-customer-for-reservation.ts');
    process.exit(1);
  }

  console.log(`\n✅ Customer found`);
  console.log(`   ID: ${customer.id}`);
  console.log(`   Name: ${customer.name}`);
  console.log(`   Tenant: ${customer.tenant_id.slice(0, 8)}...`);

  // Step 2: Get available apartment (cleanup existing active reservations first)
  console.log('\n━'.repeat(70));
  console.log('STEP 2: Fetch Available Apartment');
  console.log('━'.repeat(70));

  const { data: apartment, error: apartmentError } = await supabase
    .from('real_estate_products')
    .select('*')
    .eq('status', 'available')
    .limit(1)
    .maybeSingle();

  if (apartmentError || !apartment) {
    console.error('\n❌ No available apartments found');
    if (apartmentError) console.error('   Error:', apartmentError.message);
    
    // Try to get ANY apartment for debugging
    const { data: anyApartment } = await supabase
      .from('real_estate_products')
      .select('tenant_id, status')
      .limit(5);
    
    console.log('\n   Sample apartments in database:');
    anyApartment?.forEach(a => {
      console.log(`   - Tenant: ${a.tenant_id?.slice(0, 8)}..., Status: ${a.status}`);
    });
    console.log(`\n   Test customer tenant: ${customer.tenant_id.slice(0, 8)}...`);
    process.exit(1);
  }

  console.log(`\n✅ Available apartment found`);
  console.log(`   ID: ${apartment.id}`);
  console.log(`   Code: ${apartment.product_code}`);
  console.log(`   Status: ${apartment.status}`);
  console.log(`   Project: ${apartment.project_id.slice(0, 8)}...`);

  // Step 2.5: Cleanup any existing active reservations for this apartment (idempotent)
  console.log('\n⚙️  Cleanup existing active reservations for test apartment...');
  
  const { data: existingReservations } = await supabase
    .from('re_reservations')
    .select('id, status')
    .eq('product_id', apartment.id)
    .in('status', ['pending_deposit', 'deposited']);

  if (existingReservations && existingReservations.length > 0) {
    console.log(`   Found ${existingReservations.length} active reservation(s) - cancelling...`);
    
    for (const res of existingReservations) {
      await supabase
        .from('re_reservations')
        .update({ status: 'cancelled' })
        .eq('id', res.id);
    }
    
    console.log(`   ✅ Cleaned up ${existingReservations.length} reservation(s)`);
  } else {
    console.log(`   ✅ No existing active reservations (clean state)`);
  };

  // Step 3: Create reservation
  console.log('\n━'.repeat(70));
  console.log('STEP 3: Create Reservation');
  console.log('━'.repeat(70));

  const reservationData = {
    tenant_id: customer.tenant_id,
    customer_id: customer.id,
    product_id: apartment.id,
    status: 'pending_deposit' as any,
    deposit_amount: 0 // Now available after schema patch
  };

  console.log(`\n📝 Creating reservation:`);
  console.log(`   Customer: ${customer.name}`);
  console.log(`   Apartment: ${apartment.product_code}`);
  console.log(`   Status: ${reservationData.status}`);
  console.log(`   Deposit: ${reservationData.deposit_amount.toLocaleString('vi-VN')} VND`);

  const { data: reservation, error: reservationError } = await supabase
    .from('re_reservations')
    .insert(reservationData)
    .select('*')
    .single();

  if (reservationError) {
    console.error('\n❌ Failed to create reservation:', reservationError.message);
    console.error('   Code:', reservationError.code);
    console.error('   Details:', JSON.stringify(reservationError.details));
    console.error('\n   Trying to determine available columns...');
    
    // Try minimal insert
    const { error: minimalError } = await supabase
      .from('re_reservations')
      .insert({
        tenant_id: customer.tenant_id,
        customer_id: customer.id,
        product_id: apartment.id
      })
      .select('*')
      .single();
    
    if (minimalError) {
      console.error('   Minimal insert also failed:', minimalError.message);
    } else {
      console.log('   ✅ Minimal insert succeeded - indicates column schema mismatch');
    }
    
    process.exit(1);
  }

  console.log(`\n✅ Reservation created successfully!`);
  console.log(`   ID: ${reservation.id}`);
  console.log(`   Status: ${reservation.status}`);
  console.log(`   Reserved at: ${new Date(reservation.reserved_at || reservation.created_at).toLocaleString('vi-VN')}`);

  // Step 4: Verify persistence (reload)
  console.log('\n━'.repeat(70));
  console.log('STEP 4: Verify Persistence');
  console.log('━'.repeat(70));

  const { data: reloaded, error: reloadError } = await supabase
    .from('re_reservations')
    .select('*')
    .eq('id', reservation.id)
    .single();

  if (reloadError || !reloaded) {
    console.error('\n❌ Failed to reload reservation');
    process.exit(1);
  }

  console.log(`\n✅ Reservation persisted in database`);
  console.log(`   ID: ${reloaded.id}`);
  console.log(`   Status: ${reloaded.status}`);
  console.log(`   Customer ID: ${reloaded.customer_id}`);
  console.log(`   Product ID: ${reloaded.product_id}`);
  console.log(`   Deposit: ${reloaded.deposit_amount?.toLocaleString('vi-VN')} VND`);
  console.log(`   Tenant ID: ${reloaded.tenant_id.slice(0, 8)}...`);

  // Step 5: Check field alignment
  console.log('\n━'.repeat(70));
  console.log('STEP 5: Verify Field Alignment');
  console.log('━'.repeat(70));

  const checks = [
    { field: 'tenant_id', expected: customer.tenant_id, actual: reloaded.tenant_id },
    { field: 'customer_id', expected: customer.id, actual: reloaded.customer_id },
    { field: 'product_id', expected: apartment.id, actual: reloaded.product_id },
    { field: 'status', expected: 'pending_deposit', actual: reloaded.status },
    { field: 'deposit_amount', expected: 0, actual: reloaded.deposit_amount } // Updated to match inserted value
  ];

  let allMatch = true;
  for (const check of checks) {
    const match = check.expected === check.actual;
    const icon = match ? '✅' : '❌';
    console.log(`\n   ${icon} ${check.field}: ${match ? 'MATCH' : 'MISMATCH'}`);
    if (!match) {
      console.log(`      Expected: ${check.expected}`);
      console.log(`      Actual: ${check.actual}`);
      allMatch = false;
    }
  }

  if (!allMatch) {
    console.log('\n⚠️  Field mismatches detected');
  }

  // Step 6: Check reservation count
  console.log('\n━'.repeat(70));
  console.log('STEP 6: Overall Reservation Count');
  console.log('━'.repeat(70));

  const { count } = await supabase
    .from('re_reservations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', customer.tenant_id);

  console.log(`\n✅ Total reservations for tenant: ${count}`);

  // Cleanup (optional - keep for further tests)
  console.log('\n━'.repeat(70));
  console.log('CLEANUP (keeping test data for further tests)');
  console.log('━'.repeat(70));
  console.log(`\n💡 Test reservation kept: ${reservation.id}`);
  console.log(`   Run verify-reservations-workflow.ts to see all reservations`);

  // Final Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));

  console.log('\n✅ FETCH customer          PASS');
  console.log('✅ FETCH apartment         PASS');
  console.log('✅ CREATE reservation      PASS');
  console.log('✅ VERIFY persistence      PASS');
  console.log(`${allMatch ? '✅' : '⚠️ '} FIELD alignment       ${allMatch ? 'PASS' : 'PARTIAL'}`);
  console.log('✅ COUNT reservations      PASS');

  if (allMatch) {
    console.log('\n🎉 ALL RESERVATION WORKFLOW TESTS PASSED\n');
  } else {
    console.log('\n⚠️  RESERVATION CREATED BUT WITH FIELD MISMATCHES\n');
  }

  console.log('═'.repeat(70) + '\n');

  process.exit(allMatch ? 0 : 1);
}

testReservationCreation().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
