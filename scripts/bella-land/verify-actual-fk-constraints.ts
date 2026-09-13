#!/usr/bin/env tsx
/**
 * P5.2 RCA: Verify ACTUAL FK constraints in production database
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 P5.2 RCA: VERIFY ACTUAL FK CONSTRAINTS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Purpose: Check runtime DB schema via empirical test\n');

  // Get existing reservation or create test data
  let { data: reservation } = await supabase
    .from('re_reservations')
    .select('product_id, customer_id, id')
    .is('deleted_at', null)
    .limit(1)
    .single();

  if (!reservation) {
    console.log('Creating test data...\n');

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .single();

    if (!tenant) throw new Error('No tenants found');

    const { data: project } = await supabase
      .from('real_estate_projects')
      .insert({
        tenant_id: tenant.id,
        name: 'FK Test Project',
        code: `FK-${Date.now()}`,
        status: 'active',
      })
      .select()
      .single();

    if (!project) throw new Error('Project creation failed');

    const { data: product } = await supabase
      .from('real_estate_products')
      .insert({
        tenant_id: tenant.id,
        project_id: project.id,
        product_code: `FK-PROD-${Date.now()}`,
        product_type: 'apartment',
        area: 100,
        area_m2: 100,
        unit_price: 1000000000,
        status: 'available',
      })
      .select()
      .single();

    if (!product) throw new Error('Product creation failed');

    const { data: customer } = await supabase
      .from('re_customers')
      .insert({
        tenant_id: tenant.id,
        name: 'FK Test Customer',
        phone: `+84${Date.now().toString().slice(-9)}`,
      })
      .select()
      .single();

    if (!customer) throw new Error('Customer creation failed');

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

    if (!newRes) throw new Error('Reservation creation failed');

    reservation = {
      product_id: product.id,
      customer_id: customer.id,
      id: newRes.id
    };

    console.log('✅ Test data created\n');
  }

  console.log(`Testing with Reservation: ${reservation.id}`);
  console.log(`  Product: ${reservation.product_id}`);
  console.log(`  Customer: ${reservation.customer_id}\n`);

  // TEST 1: Delete Product
  console.log('TEST 1: DELETE Product with active Reservation');
  console.log('─'.repeat(70));

  const { error: prodErr } = await supabase
    .from('real_estate_products')
    .delete()
    .eq('id', reservation.product_id);

  const productBlocked = !!prodErr;

  if (prodErr) {
    if (prodErr.message.includes('foreign') || prodErr.message.includes('violates')) {
      console.log('✅ DELETE BLOCKED by FK constraint');
      console.log(`   ${prodErr.message.substring(0, 100)}...\n`);
    } else {
      console.log(`❌ DELETE failed: ${prodErr.message}\n`);
    }
  } else {
    console.log('🔴 DELETE SUCCEEDED — FK NOT enforced!\n');
  }

  // TEST 2: Delete Customer
  console.log('TEST 2: DELETE Customer with active Reservation');
  console.log('─'.repeat(70));

  const { error: custErr } = await supabase
    .from('re_customers')
    .delete()
    .eq('id', reservation.customer_id);

  const customerBlocked = !!custErr;

  if (custErr) {
    if (custErr.message.includes('foreign') || custErr.message.includes('violates')) {
      console.log('✅ DELETE BLOCKED by FK constraint');
      console.log(`   ${custErr.message.substring(0, 100)}...\n`);
    } else {
      console.log(`❌ DELETE failed: ${custErr.message}\n`);
    }
  } else {
    console.log('🔴 DELETE SUCCEEDED — FK NOT enforced!\n');
  }

  // VERDICT
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 VERIFICATION RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (productBlocked && customerBlocked) {
    console.log('✅ VERDICT: FK RESTRICT constraints ARE enforced');
    console.log('   → I4/I5 test failures need different RCA');
  } else if (!productBlocked && !customerBlocked) {
    console.log('🔴 VERDICT: FK RESTRICT constraints NOT enforced');
    console.log('   → Schema drift confirmed');
    console.log('   → Must apply FK constraints');
  } else {
    console.log('⚠️  VERDICT: Partial enforcement');
    console.log(`   Product: ${productBlocked ? 'BLOCKED' : 'ALLOWED'}`);
    console.log(`   Customer: ${customerBlocked ? 'BLOCKED' : 'ALLOWED'}`);
  }

  console.log('');
}

main().catch(err => {
  console.error('\n❌ Failed:', err.message);
  process.exit(1);
});
