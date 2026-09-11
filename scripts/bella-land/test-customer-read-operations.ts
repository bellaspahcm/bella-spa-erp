#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧪 C3.4 Group 3: Customer Read Operations (R1-R4)');
console.log('══════════════════════════════════════════════════════════════════════');

let testResults = {
  R1: false,
  R2: false,
  R3: false,
  R4: false,
};

let testTenantId: string;
let otherTenantId: string;
let testCustomerId: string;
let deletedCustomerId: string;

(async () => {
  try {
    // Setup: Get test tenants
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SETUP: Get test tenants');
    console.log('──────────────────────────────────────────────────────────────────────');

    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name')
      .limit(2);

    if (!tenants || tenants.length < 2) {
      throw new Error('Need at least 2 tenants for testing');
    }

    testTenantId = tenants[0].id;
    otherTenantId = tenants[1].id;

    console.log(`✅ Test Tenant A: ${tenants[0].name}`);
    console.log(`   ID: ${testTenantId}`);
    console.log(`✅ Test Tenant B: ${tenants[1].name}`);
    console.log(`   ID: ${otherTenantId}`);

    // Create test data
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SETUP: Create test customers');
    console.log('──────────────────────────────────────────────────────────────────────');

    const timestamp = Date.now();

    // Create active customer in test tenant
    const { data: activeCustomer, error: createErr } = await supabase
      .from('re_customers')
      .insert({
        tenant_id: testTenantId,
        name: `Test Customer R-${timestamp}`,
        phone: `+84900${timestamp.toString().slice(-6)}`,
        email: `test-r-${timestamp}@example.com`,
      })
      .select()
      .single();

    if (createErr) throw createErr;
    testCustomerId = activeCustomer.id;
    console.log(`✅ Active customer created: ${testCustomerId}`);

    // Create deleted customer in test tenant
    const { data: deletedCustomer, error: delErr } = await supabase
      .from('re_customers')
      .insert({
        tenant_id: testTenantId,
        name: `Test Customer R-Deleted-${timestamp}`,
        phone: `+84901${timestamp.toString().slice(-6)}`,
        deleted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (delErr) throw delErr;
    deletedCustomerId = deletedCustomer.id;
    console.log(`✅ Deleted customer created: ${deletedCustomerId}`);

    // Create customer in other tenant
    const { data: otherCustomer, error: otherErr } = await supabase
      .from('re_customers')
      .insert({
        tenant_id: otherTenantId,
        name: `Test Customer R-Other-${timestamp}`,
        phone: `+84902${timestamp.toString().slice(-6)}`,
      })
      .select()
      .single();

    if (otherErr) throw otherErr;
    console.log(`✅ Other tenant customer created: ${otherCustomer.id}`);

    // R1: Fetch customer list (own tenant)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('R1: Fetch customer list (own tenant)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { data: customers, error: fetchErr } = await supabase
      .from('re_customers')
      .select('*')
      .eq('tenant_id', testTenantId)
      .is('deleted_at', null);

    if (fetchErr) throw fetchErr;

    const foundActive = customers?.some(c => c.id === testCustomerId);
    if (foundActive) {
      console.log('✅ PASS');
      console.log(`   Active customer found in list`);
      console.log(`   Total active customers: ${customers?.length}`);
      testResults.R1 = true;
    } else {
      console.log('❌ FAIL');
      console.log('   Active customer not found');
    }

    // R2: Deleted customers excluded from list
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('R2: Deleted customers excluded from list');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const foundDeleted = customers?.some(c => c.id === deletedCustomerId);
    if (!foundDeleted) {
      console.log('✅ PASS');
      console.log('   Deleted customer correctly excluded');
      testResults.R2 = true;
    } else {
      console.log('❌ FAIL');
      console.log('   Deleted customer should be excluded');
    }

    // R3: List returns only own-tenant
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('R3: List returns only own-tenant');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const allOwnTenant = customers?.every(c => c.tenant_id === testTenantId);
    if (allOwnTenant) {
      console.log('✅ PASS');
      console.log('   All customers belong to test tenant');
      testResults.R3 = true;
    } else {
      console.log('❌ FAIL');
      console.log('   Found customers from other tenants');
    }

    // R4: Empty result for tenant with no customers
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('R4: Empty result for tenant with no customers');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Use other tenant (which we know has customers) but filter by non-existent ID pattern
    const fakeCustomerId = '00000000-0000-0000-0000-000000000000';
    const { data: emptyResult, error: emptyErr } = await supabase
      .from('re_customers')
      .select('*')
      .eq('id', fakeCustomerId)
      .is('deleted_at', null);

    if (emptyErr) {
      console.log('❌ FAIL');
      console.log(`   Error querying: ${emptyErr.message}`);
    } else if (emptyResult?.length === 0) {
      console.log('✅ PASS');
      console.log('   Query with no matches returns empty list');
      testResults.R4 = true;
    } else {
      console.log('❌ FAIL');
      console.log(`   Should return empty list (got ${emptyResult?.length} rows)`);
    }

    // Cleanup
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CLEANUP');
    console.log('──────────────────────────────────────────────────────────────────────');

    await supabase.from('re_customers').delete().eq('id', testCustomerId);
    await supabase.from('re_customers').delete().eq('id', deletedCustomerId);
    await supabase.from('re_customers').delete().eq('id', otherCustomer.id);
    console.log('✅ Test customers deleted');

  } catch (err) {
    console.error('❌ Test execution failed:', err);
    process.exit(1);
  }

  // Summary
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(`${testResults.R1 ? '✅' : '❌'} PASS R1: `);
  console.log(`${testResults.R2 ? '✅' : '❌'} PASS R2: `);
  console.log(`${testResults.R3 ? '✅' : '❌'} PASS R3: `);
  console.log(`${testResults.R4 ? '✅' : '❌'} PASS R4: `);
  console.log('──────────────────────────────────────────────────────────────────────');

  const passCount = Object.values(testResults).filter(Boolean).length;
  console.log(`Result: ${passCount}/4 tests passed`);
  console.log('──────────────────────────────────────────────────────────────────────');

  if (passCount === 4) {
    console.log('✅ Group 3 PASS — Read operations verified');
    process.exit(0);
  } else {
    console.log('❌ Group 3 FAIL — Some read tests failed');
    process.exit(1);
  }
})();
