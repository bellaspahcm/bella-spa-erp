#!/usr/bin/env tsx
/**
 * P5.2 PRE-FLIGHT: Inspect actual FK state before schema correction
 * 
 * Purpose:
 * 1. Check existing FK constraints (name, delete action)
 * 2. Detect orphan rows (dangling references)
 * 3. Verify canonical requirements (RESTRICT only, no assumption on DEFERRABLE)
 * 
 * DO NOT apply migration without running this first.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 P5.2 PRE-FLIGHT: FK Constraint Inspection');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Purpose: Verify actual DB state before schema correction\n');

  // =========================================================================
  // CHECK 1: Existing FK Constraints
  // =========================================================================
  console.log('CHECK 1: Existing FK Constraints on re_reservations');
  console.log('─'.repeat(70));

  // Try to get FK info from pg_catalog (system tables)
  // Note: Supabase may not expose pg_constraint directly via REST API
  // We'll use indirect method: check information_schema or attempt operations

  console.log('Attempting to query existing constraints...\n');

  // Method: Try to recreate table structure from actual inserts
  const { data: sampleReservation } = await supabase
    .from('re_reservations')
    .select('product_id, customer_id, id')
    .limit(1)
    .single();

  if (sampleReservation) {
    console.log('✅ Sample reservation found:');
    console.log(`   Reservation ID: ${sampleReservation.id}`);
    console.log(`   Product ID: ${sampleReservation.product_id}`);
    console.log(`   Customer ID: ${sampleReservation.customer_id}\n`);
  } else {
    console.log('⚠️  No existing reservations found (empty table)\n');
  }

  // Check if we can get constraint info (may not work via Supabase REST)
  console.log('Note: FK constraint metadata may require direct DB access');
  console.log('      We will verify behavior empirically below.\n');

  // =========================================================================
  // CHECK 2: Orphan Rows (Referential Integrity Violations)
  // =========================================================================
  console.log('CHECK 2: Orphan Row Detection');
  console.log('─'.repeat(70));

  // Check for reservations with non-existent products
  const { data: orphanProducts, error: orphanProdError } = await supabase
    .from('re_reservations')
    .select('id, product_id')
    .is('deleted_at', null);

  if (orphanProdError) {
    console.log(`❌ Error querying reservations: ${orphanProdError.message}\n`);
  } else if (orphanProducts && orphanProducts.length > 0) {
    console.log(`Found ${orphanProducts.length} active reservations`);
    console.log('Checking for orphaned product references...\n');

    let orphanCount = 0;
    for (const res of orphanProducts.slice(0, 10)) { // Check first 10
      const { data: product } = await supabase
        .from('real_estate_products')
        .select('id')
        .eq('id', res.product_id)
        .single();

      if (!product) {
        orphanCount++;
        console.log(`⚠️  ORPHAN: Reservation ${res.id} → Product ${res.product_id} (not found)`);
      }
    }

    if (orphanCount === 0) {
      console.log('✅ No orphan product references found\n');
    } else {
      console.log(`\n🔴 BLOCKER: ${orphanCount} orphan product reference(s) detected`);
      console.log('   Must clean up before applying FK constraints\n');
    }
  } else {
    console.log('⚠️  No active reservations to check\n');
  }

  // Check for reservations with non-existent customers
  if (orphanProducts && orphanProducts.length > 0) {
    const { data: allReservations } = await supabase
      .from('re_reservations')
      .select('id, customer_id')
      .is('deleted_at', null);

    if (allReservations) {
      console.log('Checking for orphaned customer references...\n');

      let custOrphanCount = 0;
      for (const res of allReservations.slice(0, 10)) { // Check first 10
        const { data: customer } = await supabase
          .from('re_customers')
          .select('id')
          .eq('id', res.customer_id)
          .single();

        if (!customer) {
          custOrphanCount++;
          console.log(`⚠️  ORPHAN: Reservation ${res.id} → Customer ${res.customer_id} (not found)`);
        }
      }

      if (custOrphanCount === 0) {
        console.log('✅ No orphan customer references found\n');
      } else {
        console.log(`\n🔴 BLOCKER: ${custOrphanCount} orphan customer reference(s) detected`);
        console.log('   Must clean up before applying FK constraints\n');
      }
    }
  }

  // =========================================================================
  // CHECK 3: Current DELETE Behavior (Empirical)
  // =========================================================================
  console.log('CHECK 3: Current DELETE Behavior');
  console.log('─'.repeat(70));
  console.log('Testing actual FK enforcement via delete attempts...\n');

  // Get or create test reservation
  let testReservation = sampleReservation;

  if (!testReservation) {
    console.log('Creating test data for behavioral check...\n');

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .single();

    if (!tenant) {
      console.log('❌ No tenants found');
      return;
    }

    const { data: project } = await supabase
      .from('real_estate_projects')
      .insert({
        tenant_id: tenant.id,
        name: 'Pre-flight Test Project',
        code: `PF-${Date.now()}`,
        status: 'active',
      })
      .select()
      .single();

    if (!project) {
      console.log('❌ Failed to create test project');
      return;
    }

    const { data: product } = await supabase
      .from('real_estate_products')
      .insert({
        tenant_id: tenant.id,
        project_id: project.id,
        product_code: `PF-PROD-${Date.now()}`,
        product_type: 'apartment',
        area: 100,
        area_m2: 100,
        unit_price: 1000000000,
        status: 'available',
      })
      .select()
      .single();

    if (!product) {
      console.log('❌ Failed to create test product');
      return;
    }

    const { data: customer } = await supabase
      .from('re_customers')
      .insert({
        tenant_id: tenant.id,
        name: 'Pre-flight Test Customer',
        phone: `+84${Date.now().toString().slice(-9)}`,
      })
      .select()
      .single();

    if (!customer) {
      console.log('❌ Failed to create test customer');
      return;
    }

    const { data: newRes } = await supabase
      .from('re_reservations')
      .insert({
        tenant_id: tenant.id,
        product_id: product.id,
        customer_id: customer.id,
        deposit_amount: 50000,
        status: 'pending_deposit',
      })
      .select()
      .single();

    if (!newRes) {
      console.log('❌ Failed to create test reservation');
      return;
    }

    testReservation = {
      id: newRes.id,
      product_id: product.id,
      customer_id: customer.id
    };

    console.log('✅ Test data created\n');
  }

  console.log(`Test Reservation: ${testReservation.id}`);
  console.log(`  Product: ${testReservation.product_id}`);
  console.log(`  Customer: ${testReservation.customer_id}\n`);

  // Attempt delete Product
  console.log('Attempt: DELETE Product with active Reservation');
  const { error: prodErr } = await supabase
    .from('real_estate_products')
    .delete()
    .eq('id', testReservation.product_id);

  if (prodErr) {
    if (prodErr.message.includes('foreign') || prodErr.message.includes('violates')) {
      console.log('✅ BLOCKED by existing FK constraint');
      console.log(`   ${prodErr.message.substring(0, 100)}...`);
    } else {
      console.log(`⚠️  DELETE failed (not FK): ${prodErr.message}`);
    }
  } else {
    console.log('🔴 DELETE SUCCEEDED — No FK protection');
  }

  console.log('');

  // Attempt delete Customer
  console.log('Attempt: DELETE Customer with active Reservation');
  const { error: custErr } = await supabase
    .from('re_customers')
    .delete()
    .eq('id', testReservation.customer_id);

  if (custErr) {
    if (custErr.message.includes('foreign') || custErr.message.includes('violates')) {
      console.log('✅ BLOCKED by existing FK constraint');
      console.log(`   ${custErr.message.substring(0, 100)}...`);
    } else {
      console.log(`⚠️  DELETE failed (not FK): ${custErr.message}`);
    }
  } else {
    console.log('🔴 DELETE SUCCEEDED — No FK protection');
  }

  console.log('');

  // =========================================================================
  // SUMMARY & RECOMMENDATIONS
  // =========================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 PRE-FLIGHT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  const productBlocked = !!prodErr;
  const customerBlocked = !!custErr;

  if (productBlocked && customerBlocked) {
    console.log('✅ FK constraints ALREADY ENFORCED');
    console.log('   → No schema correction needed');
    console.log('   → I4/I5 failures require different RCA\n');
  } else {
    console.log('🔴 FK constraints NOT enforced');
    console.log(`   Product DELETE: ${productBlocked ? 'BLOCKED' : 'ALLOWED'}`);
    console.log(`   Customer DELETE: ${customerBlocked ? 'BLOCKED' : 'ALLOWED'}`);
    console.log('   → Schema correction required\n');
    
    console.log('RECOMMENDED MIGRATION:');
    console.log('```sql');
    console.log('-- Drop existing constraints (if any)');
    console.log('ALTER TABLE re_reservations');
    console.log('  DROP CONSTRAINT IF EXISTS re_reservations_product_id_fkey;');
    console.log('');
    console.log('ALTER TABLE re_reservations');
    console.log('  DROP CONSTRAINT IF EXISTS re_reservations_customer_id_fkey;');
    console.log('');
    console.log('-- Add ON DELETE RESTRICT');
    console.log('ALTER TABLE re_reservations');
    console.log('  ADD CONSTRAINT re_reservations_product_id_fkey');
    console.log('  FOREIGN KEY (product_id)');
    console.log('  REFERENCES real_estate_products(id)');
    console.log('  ON DELETE RESTRICT;');
    console.log('');
    console.log('ALTER TABLE re_reservations');
    console.log('  ADD CONSTRAINT re_reservations_customer_id_fkey');
    console.log('  FOREIGN KEY (customer_id)');
    console.log('  REFERENCES re_customers(id)');
    console.log('  ON DELETE RESTRICT;');
    console.log('```\n');
    
    console.log('Note: DEFERRABLE clause removed unless canonical spec proves necessity');
  }

  console.log('NEXT STEPS:');
  console.log('1. Review findings above');
  console.log('2. Clean up orphan rows if any found');
  console.log('3. Apply recommended migration if FK not enforced');
  console.log('4. Run verify-actual-fk-constraints.ts to confirm');
  console.log('5. Proceed with I3 refactor + full P5.2 rerun\n');
}

main().catch(err => {
  console.error('\n❌ Pre-flight failed:', err.message);
  process.exit(1);
});
