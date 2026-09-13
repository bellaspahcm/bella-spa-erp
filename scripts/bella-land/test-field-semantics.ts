#!/usr/bin/env tsx

/**
 * Field Semantics Verification - Reservations
 * 
 * Verifies that input values are persisted correctly (no DEFAULT overwrites, no mapping loss)
 * 
 * Scope:
 * 1. deposit_amount - must store exact input, not DEFAULT 0
 * 2. status - must be canonical enum (pending_deposit)
 * 3. customer_id - must match selected customer (NOT NULL)
 * 4. product_id - must match selected apartment
 * 5. tenant_id - must match tenant context
 * 6. expires_at - verify business usage (NULL or calculated)
 * 7. created_by/user_id - verify actor attribution field
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface FieldTest {
  field: string;
  input: any;
  expected: any;
  actual: any;
  passed: boolean;
  notes?: string;
}

async function main() {
  console.log('\n🔬 Bella Land - Field Semantics Verification');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('🎯 GOAL: Verify input values persist correctly (no drift, no overwrites)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const results: FieldTest[] = [];
  let testReservationId: string | null = null;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // SETUP: Get test data
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nSETUP: Get Test Data');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Get tenant with apartments
    const { data: apartments } = await supabase
      .from('real_estate_products')
      .select('tenant_id')
      .limit(1);

    if (!apartments || apartments.length === 0) {
      console.error('❌ No apartments found');
      process.exit(1);
    }

    const tenantId = apartments[0].tenant_id;

    // Get tenant details
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      console.error('❌ Tenant not found');
      process.exit(1);
    }

    console.log(`✅ Tenant: ${tenant.name} (${tenant.id.substring(0, 8)}...)`);

    // Get apartment for this tenant (available for reservation)
    const { data: apartment } = await supabase
      .from('real_estate_products')
      .select('*')
      .eq('tenant_id', tenant.id)
      .in('status', ['available', 'booked']) // Available for new reservations
      .limit(1)
      .single();

    if (!apartment) {
      console.error('❌ No available apartment found');
      process.exit(1);
    }

    console.log(`✅ Apartment: ${apartment.name || apartment.id.substring(0, 8) + '...'}`);

    // Get or create customer
    let { data: customer } = await supabase
      .from('re_customers')
      .select('*')
      .eq('tenant_id', tenant.id)
      .limit(1)
      .single();

    if (!customer) {
      console.log('⚙️  Creating test customer...');
      const { data: newCustomer, error: createError } = await supabase
        .from('re_customers')
        .insert({
          tenant_id: tenant.id,
          name: 'Field Semantics Test Customer',
          phone: '0900000002',
          email: 'field-semantics-test@example.com'
        })
        .select()
        .single();

      if (createError || !newCustomer) {
        console.error('❌ Failed to create customer:', createError?.message);
        process.exit(1);
      }

      customer = newCustomer;
      console.log(`   ✅ Customer created: ${customer.name}`);
    } else {
      console.log(`✅ Customer: ${customer.name} (${customer.id.substring(0, 8)}...)`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST: Create reservation with specific field values
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CREATE: Reservation with Test Values');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const INPUT_VALUES = {
      tenant_id: tenant.id,
      customer_id: customer.id,
      product_id: apartment.id,
      status: 'pending_deposit' as const,
      deposit_amount: 75000000, // 75M VND - specific test value
      notes: 'Field semantics verification test'
      // expires_at: NOT provided (test NULL behavior)
      // created_by/user_id: NOT provided (test actor attribution)
    };

    console.log('\n📝 Input Values:');
    console.log(`   tenant_id:      ${INPUT_VALUES.tenant_id.substring(0, 8)}...`);
    console.log(`   customer_id:    ${INPUT_VALUES.customer_id.substring(0, 8)}...`);
    console.log(`   product_id:     ${INPUT_VALUES.product_id.substring(0, 8)}...`);
    console.log(`   status:         ${INPUT_VALUES.status}`);
    console.log(`   deposit_amount: ${INPUT_VALUES.deposit_amount.toLocaleString()} VND`);
    console.log(`   notes:          ${INPUT_VALUES.notes}`);
    console.log(`   expires_at:     (not provided - test NULL)`);

    const { data: reservation, error: createError } = await supabase
      .from('re_reservations')
      .insert(INPUT_VALUES)
      .select('*')
      .single();

    if (createError || !reservation) {
      console.error('\n❌ Failed to create reservation:', createError?.message);
      process.exit(1);
    }

    testReservationId = reservation.id;
    console.log(`\n✅ Reservation created: ${reservation.id.substring(0, 8)}...`);

    // ─────────────────────────────────────────────────────────────────────────
    // VERIFY: Query back and compare persisted values
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VERIFY: Persisted Field Values');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { data: persisted, error: queryError } = await supabase
      .from('re_reservations')
      .select('*')
      .eq('id', reservation.id)
      .single();

    if (queryError || !persisted) {
      console.error('\n❌ Failed to query persisted reservation:', queryError?.message);
      process.exit(1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Field 1: deposit_amount
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n1️⃣  deposit_amount');
    console.log('   ──────────────────────────────────────────────────────────────────');
    
    const depositInput = INPUT_VALUES.deposit_amount;
    const depositActual = persisted.deposit_amount ? parseFloat(persisted.deposit_amount) : null;
    const depositPassed = depositActual === depositInput;

    results.push({
      field: 'deposit_amount',
      input: depositInput,
      expected: depositInput,
      actual: depositActual,
      passed: depositPassed,
      notes: depositPassed ? 'Exact value persisted' : 'Value lost or overwritten'
    });

    console.log(`   Input:    ${depositInput.toLocaleString()} VND`);
    console.log(`   Expected: ${depositInput.toLocaleString()} VND`);
    console.log(`   Actual:   ${depositActual?.toLocaleString() || 'NULL'} VND`);
    console.log(`   ${depositPassed ? '✅ PASS' : '❌ FAIL'}: ${depositPassed ? 'Exact match' : 'Mismatch'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Field 2: status (canonical enum)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n2️⃣  status (canonical enum)');
    console.log('   ──────────────────────────────────────────────────────────────────');

    const statusInput = INPUT_VALUES.status;
    const statusActual = persisted.status;
    const statusPassed = statusActual === statusInput;

    results.push({
      field: 'status',
      input: statusInput,
      expected: statusInput,
      actual: statusActual,
      passed: statusPassed,
      notes: statusPassed ? 'Canonical enum persisted' : 'Enum mismatch'
    });

    console.log(`   Input:    ${statusInput}`);
    console.log(`   Expected: ${statusInput}`);
    console.log(`   Actual:   ${statusActual || 'NULL'}`);
    console.log(`   ${statusPassed ? '✅ PASS' : '❌ FAIL'}: ${statusPassed ? 'Canonical enum' : 'Wrong enum'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Field 3: customer_id (NOT NULL, exact match)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n3️⃣  customer_id (NOT NULL)');
    console.log('   ──────────────────────────────────────────────────────────────────');

    const customerIdInput = INPUT_VALUES.customer_id;
    const customerIdActual = persisted.customer_id;
    const customerIdPassed = customerIdActual === customerIdInput && customerIdActual !== null;

    results.push({
      field: 'customer_id',
      input: customerIdInput,
      expected: customerIdInput,
      actual: customerIdActual,
      passed: customerIdPassed,
      notes: customerIdPassed ? 'Correct customer, NOT NULL' : 'Customer mismatch or NULL'
    });

    console.log(`   Input:    ${customerIdInput.substring(0, 8)}...`);
    console.log(`   Expected: ${customerIdInput.substring(0, 8)}... (NOT NULL)`);
    console.log(`   Actual:   ${customerIdActual?.substring(0, 8) || 'NULL'}...`);
    console.log(`   ${customerIdPassed ? '✅ PASS' : '❌ FAIL'}: ${customerIdPassed ? 'Correct match' : 'Mismatch'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Field 4: product_id (apartment match)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n4️⃣  product_id (apartment match)');
    console.log('   ──────────────────────────────────────────────────────────────────');

    const productIdInput = INPUT_VALUES.product_id;
    const productIdActual = persisted.product_id;
    const productIdPassed = productIdActual === productIdInput;

    results.push({
      field: 'product_id',
      input: productIdInput,
      expected: productIdInput,
      actual: productIdActual,
      passed: productIdPassed,
      notes: productIdPassed ? 'Correct apartment' : 'Apartment mismatch'
    });

    console.log(`   Input:    ${productIdInput.substring(0, 8)}...`);
    console.log(`   Expected: ${productIdInput.substring(0, 8)}...`);
    console.log(`   Actual:   ${productIdActual?.substring(0, 8) || 'NULL'}...`);
    console.log(`   ${productIdPassed ? '✅ PASS' : '❌ FAIL'}: ${productIdPassed ? 'Correct match' : 'Mismatch'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Field 5: tenant_id (tenant context)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n5️⃣  tenant_id (tenant context)');
    console.log('   ──────────────────────────────────────────────────────────────────');

    const tenantIdInput = INPUT_VALUES.tenant_id;
    const tenantIdActual = persisted.tenant_id;
    const tenantIdPassed = tenantIdActual === tenantIdInput;

    results.push({
      field: 'tenant_id',
      input: tenantIdInput,
      expected: tenantIdInput,
      actual: tenantIdActual,
      passed: tenantIdPassed,
      notes: tenantIdPassed ? 'Correct tenant' : 'Tenant mismatch'
    });

    console.log(`   Input:    ${tenantIdInput.substring(0, 8)}...`);
    console.log(`   Expected: ${tenantIdInput.substring(0, 8)}...`);
    console.log(`   Actual:   ${tenantIdActual?.substring(0, 8) || 'NULL'}...`);
    console.log(`   ${tenantIdPassed ? '✅ PASS' : '❌ FAIL'}: ${tenantIdPassed ? 'Correct match' : 'Mismatch'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Field 6: expires_at (business usage)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n6️⃣  expires_at (business usage)');
    console.log('   ──────────────────────────────────────────────────────────────────');

    const expiresAtActual = persisted.expires_at;
    const expiresAtPassed = true; // Not a blocker - just verify current behavior

    results.push({
      field: 'expires_at',
      input: 'NOT PROVIDED',
      expected: 'NULL or AUTO-CALCULATED',
      actual: expiresAtActual || 'NULL',
      passed: expiresAtPassed,
      notes: expiresAtActual ? 'Auto-calculated by DB/service' : 'NULL (business may not use)'
    });

    console.log(`   Input:    NOT PROVIDED`);
    console.log(`   Expected: NULL or AUTO-CALCULATED`);
    console.log(`   Actual:   ${expiresAtActual || 'NULL'}`);
    console.log(`   ✅ OBSERVED: ${expiresAtActual ? 'Auto-calculated' : 'NULL (unused)'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Field 7: created_by / user_id (actor attribution)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n7️⃣  created_by / user_id (actor attribution)');
    console.log('   ──────────────────────────────────────────────────────────────────');

    const createdByActual = persisted.created_by;
    const userIdActual = persisted.user_id;
    const actorPassed = true; // Not a blocker - just document current state

    results.push({
      field: 'created_by',
      input: 'NOT PROVIDED',
      expected: 'NULL or AUTH CONTEXT',
      actual: createdByActual || 'NULL',
      passed: actorPassed,
      notes: createdByActual ? 'Populated by auth context' : 'NULL (no user context)'
    });

    results.push({
      field: 'user_id',
      input: 'NOT PROVIDED',
      expected: 'NULL (NULLABLE)',
      actual: userIdActual || 'NULL',
      passed: actorPassed,
      notes: userIdActual ? 'Populated (legacy field?)' : 'NULL (expected)'
    });

    console.log(`   created_by: ${createdByActual?.substring(0, 8) || 'NULL'}...`);
    console.log(`   user_id:    ${userIdActual?.substring(0, 8) || 'NULL'}...`);
    console.log(`   ✅ OBSERVED: Actor attribution state documented`);

    // ─────────────────────────────────────────────────────────────────────────
    // Field 8: notes (text field)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n8️⃣  notes (text field)');
    console.log('   ──────────────────────────────────────────────────────────────────');

    const notesInput = INPUT_VALUES.notes;
    const notesActual = persisted.notes;
    const notesPassed = notesActual === notesInput;

    results.push({
      field: 'notes',
      input: notesInput,
      expected: notesInput,
      actual: notesActual || 'NULL',
      passed: notesPassed,
      notes: notesPassed ? 'Text persisted correctly' : 'Text lost or truncated'
    });

    console.log(`   Input:    "${notesInput}"`);
    console.log(`   Expected: "${notesInput}"`);
    console.log(`   Actual:   "${notesActual || 'NULL'}"`);
    console.log(`   ${notesPassed ? '✅ PASS' : '❌ FAIL'}: ${notesPassed ? 'Text match' : 'Mismatch'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CLEANUP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Cleanup test reservation
    const { error: deleteError } = await supabase
      .from('re_reservations')
      .delete()
      .eq('id', testReservationId);

    if (deleteError) {
      console.error('⚠️  Failed to cleanup test reservation:', deleteError.message);
    } else {
      console.log('✅ Test reservation cleaned up');
    }

    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log('📊 FIELD SEMANTICS TEST SUMMARY');
    console.log('══════════════════════════════════════════════════════════════════════');

    const criticalTests = results.filter(r => 
      ['deposit_amount', 'status', 'customer_id', 'product_id', 'tenant_id', 'notes'].includes(r.field)
    );

    const criticalPassed = criticalTests.filter(r => r.passed).length;
    const criticalTotal = criticalTests.length;

    console.log(`\n✅ Critical Tests Passed: ${criticalPassed}/${criticalTotal}`);
    console.log(`❌ Critical Tests Failed: ${criticalTotal - criticalPassed}/${criticalTotal}`);

    console.log('\n─────────────────────────────────────────────────────────────────────');
    console.log('CRITICAL FIELDS:');
    console.log('─────────────────────────────────────────────────────────────────────');

    criticalTests.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${status} ${test.field.padEnd(20)} ${test.notes || ''}`);
    });

    console.log('\n─────────────────────────────────────────────────────────────────────');
    console.log('OBSERVATIONAL (NOT BLOCKERS):');
    console.log('─────────────────────────────────────────────────────────────────────');

    const observationalTests = results.filter(r => 
      ['expires_at', 'created_by', 'user_id'].includes(r.field)
    );

    observationalTests.forEach(test => {
      console.log(`📋 ${test.field.padEnd(20)} ${test.notes || ''}`);
    });

    console.log('\n══════════════════════════════════════════════════════════════════════');

    if (criticalPassed === criticalTotal) {
      console.log('✅ FIELD SEMANTICS: ALL CRITICAL TESTS PASSED');
      console.log('══════════════════════════════════════════════════════════════════════\n');
      process.exit(0);
    } else {
      console.log('❌ FIELD SEMANTICS: CRITICAL FAILURES DETECTED');
      console.log('══════════════════════════════════════════════════════════════════════\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR:', error);
    
    // Attempt cleanup
    if (testReservationId) {
      console.log('\nAttempting cleanup...');
      await supabase
        .from('re_reservations')
        .delete()
        .eq('id', testReservationId);
    }

    process.exit(1);
  }
}

main();
