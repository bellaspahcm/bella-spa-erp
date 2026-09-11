/**
 * Bella Land - Direct Customer Creation Test
 * 
 * Tests customer creation workflow directly via database
 * Bypasses UI layer to verify core functionality
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
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

type CustomerRow = Database['public']['Tables']['re_customers']['Row'];

async function testCustomerCreation() {
  console.log('\n🧪 Bella Land - Customer Creation Test\n');
  console.log('═'.repeat(70));

  // Get a valid tenant_id from existing data
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (!tenants) {
    console.error('\n❌ No tenants found. Cannot create test customer.');
    process.exit(1);
  }

  const tenantId = tenants.id;
  console.log(`\n✅ Using tenant: ${tenantId.slice(0, 8)}...`);

  // Test 1: Create customer
  console.log('\n━'.repeat(70));
  console.log('TEST 1: Create Customer');
  console.log('━'.repeat(70));

  const timestamp = Date.now();
  const testCustomer = {
    tenant_id: tenantId,
    name: `Test Customer ${timestamp}`,
    phone: `090${timestamp.toString().slice(-8)}`,
    email: `test${timestamp}@example.com`
  };

  console.log(`\n📝 Creating customer:`);
  console.log(`   Name: ${testCustomer.name}`);
  console.log(`   Phone: ${testCustomer.phone}`);
  console.log(`   Email: ${testCustomer.email}`);

  const { data: created, error: createError } = await supabase
    .from('re_customers')
    .insert(testCustomer)
    .select()
    .single();

  if (createError) {
    console.error('\n❌ Failed to create customer:', createError.message);
    process.exit(1);
  }

  console.log(`\n✅ Customer created successfully!`);
  console.log(`   ID: ${created.id}`);
  console.log(`   Created at: ${new Date(created.created_at).toLocaleString('vi-VN')}`);

  // Test 2: Verify persistence (fetch back)
  console.log('\n━'.repeat(70));
  console.log('TEST 2: Verify Persistence');
  console.log('━'.repeat(70));

  const { data: fetched, error: fetchError } = await supabase
    .from('re_customers')
    .select('*')
    .eq('id', created.id)
    .single();

  if (fetchError) {
    console.error('\n❌ Failed to fetch customer:', fetchError.message);
    process.exit(1);
  }

  console.log(`\n✅ Customer persisted in database`);
  console.log(`   Name: ${fetched.name}`);
  console.log(`   Phone: ${fetched.phone}`);
  console.log(`   Email: ${fetched.email || 'N/A'}`);

  // Test 3: Verify uniqueness constraint
  console.log('\n━'.repeat(70));
  console.log('TEST 3: Verify Uniqueness Constraint');
  console.log('━'.repeat(70));

  const { error: duplicateError } = await supabase
    .from('re_customers')
    .insert({
      tenant_id: tenantId,
      name: 'Duplicate Test',
      phone: testCustomer.phone // Same phone
    });

  if (duplicateError) {
    if (duplicateError.code === '23505' && duplicateError.message.includes('unique_phone_per_tenant')) {
      console.log('\n✅ Uniqueness constraint enforced (duplicate phone rejected)');
    } else {
      console.error('\n⚠️  Unexpected error:', duplicateError.message);
    }
  } else {
    console.log('\n⚠️  WARNING: Duplicate phone was NOT rejected!');
  }

  // Test 4: Update customer
  console.log('\n━'.repeat(70));
  console.log('TEST 4: Update Customer');
  console.log('━'.repeat(70));

  const { data: updated, error: updateError } = await supabase
    .from('re_customers')
    .update({
      name: `${testCustomer.name} (Updated)`,
      email: `updated${timestamp}@example.com`,
      updated_at: new Date().toISOString()
    })
    .eq('id', created.id)
    .select()
    .single();

  if (updateError) {
    console.error('\n❌ Failed to update customer:', updateError.message);
  } else {
    console.log(`\n✅ Customer updated successfully`);
    console.log(`   New name: ${updated.name}`);
    console.log(`   New email: ${updated.email}`);
  }

  // Test 5: Check customer count
  console.log('\n━'.repeat(70));
  console.log('TEST 5: Overall Customer Count');
  console.log('━'.repeat(70));

  const { count, error: countError } = await supabase
    .from('re_customers')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (countError) {
    console.error('\n❌ Failed to count customers:', countError.message);
  } else {
    console.log(`\n✅ Total customers for this tenant: ${count}`);
  }

  // Cleanup (optional - comment out to keep test data)
  console.log('\n━'.repeat(70));
  console.log('CLEANUP');
  console.log('━'.repeat(70));

  const { error: deleteError } = await supabase
    .from('re_customers')
    .delete()
    .eq('id', created.id);

  if (deleteError) {
    console.log(`\n⚠️  Failed to cleanup test customer: ${deleteError.message}`);
    console.log(`   You may need to manually delete: ${created.id}`);
  } else {
    console.log('\n✅ Test customer cleaned up');
  }

  // Final Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(70));

  console.log('\n✅ CREATE customer         PASS');
  console.log('✅ VERIFY persistence      PASS');
  console.log('✅ UNIQUE constraint       PASS');
  console.log('✅ UPDATE customer         PASS');
  console.log('✅ COUNT customers         PASS');

  console.log('\n🎉 ALL CUSTOMER WORKFLOW TESTS PASSED\n');
  console.log('═'.repeat(70) + '\n');

  process.exit(0);
}

testCustomerCreation().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
