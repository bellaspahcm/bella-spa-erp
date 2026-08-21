#!/usr/bin/env node

/**
 * RLS Tenant Isolation Verification
 * 
 * Week 3 Day 3 Gate A - Step 6
 * 
 * Tests that tenant isolation ACTUALLY works at database level.
 * 
 * SUCCESS CRITERIA:
 * - Positive tests: PASS (tenant can access own data)
 * - Negative tests: PASS (tenant CANNOT access other tenant's data)
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuid } from 'uuid';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setTenantContext(tenantId) {
  const { data, error } = await supabase.rpc('set_config', {
    setting: 'app.current_tenant_id',
    value: tenantId,
    is_local: false,
  });

  if (error) {
    console.error(`❌ Failed to set tenant context: ${error.message}`);
    throw error;
  }
}

async function verifyTenantIsolation() {
  console.log('🔒 RLS TENANT ISOLATION VERIFICATION\n');
  
  const tenantA = 'tenant-A-' + uuid();
  const tenantB = 'tenant-B-' + uuid();
  
  let shipmentAId;
  let shipmentBId;
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // ========================================================================
    // SETUP: Create test data for Tenant A
    // ========================================================================
    console.log('📋 SETUP: Creating test data\n');
    
    await setTenantContext(tenantA);
    console.log(`   Created tenant context: ${tenantA}`);

    const { data: shipmentA, error: errorA } = await supabase
      .from('log_shipments')
      .insert({
        tenant_id: tenantA,
        shipment_number: 'TEST-A-001',
        status: 'draft',
        type: 'standard',
        priority: 'normal',
        origin: { address: 'A Origin', city: 'City A', country: 'US' },
        destination: { address: 'A Dest', city: 'City A2', country: 'US' },
        planned_pickup_date: new Date('2026-08-25T10:00:00Z').toISOString(),
        planned_delivery_date: new Date('2026-08-27T16:00:00Z').toISOString(),
        items: [{ sku: 'ITEM-A', quantity: 1 }],
        created_by: 'user-a',
        last_modified_by: 'user-a',
      })
      .select()
      .single();

    if (errorA) {
      console.error('❌ Failed to create shipment for Tenant A:', errorA.message);
      throw errorA;
    }

    shipmentAId = shipmentA.id;
    console.log(`   ✅ Created shipment for Tenant A: ${shipmentAId}\n`);

    // ========================================================================
    // SETUP: Create test data for Tenant B
    // ========================================================================
    await setTenantContext(tenantB);
    console.log(`   Created tenant context: ${tenantB}`);

    const { data: shipmentB, error: errorB } = await supabase
      .from('log_shipments')
      .insert({
        tenant_id: tenantB,
        shipment_number: 'TEST-B-001',
        status: 'draft',
        type: 'express',
        priority: 'high',
        origin: { address: 'B Origin', city: 'City B', country: 'US' },
        destination: { address: 'B Dest', city: 'City B2', country: 'US' },
        planned_pickup_date: new Date('2026-08-25T11:00:00Z').toISOString(),
        planned_delivery_date: new Date('2026-08-27T17:00:00Z').toISOString(),
        items: [{ sku: 'ITEM-B', quantity: 2 }],
        created_by: 'user-b',
        last_modified_by: 'user-b',
      })
      .select()
      .single();

    if (errorB) {
      console.error('❌ Failed to create shipment for Tenant B:', errorB.message);
      throw errorB;
    }

    shipmentBId = shipmentB.id;
    console.log(`   ✅ Created shipment for Tenant B: ${shipmentBId}\n`);

    console.log('═══════════════════════════════════════════════════════════\n');

    // ========================================================================
    // TEST 1: POSITIVE - Tenant A can read own data
    // ========================================================================
    console.log('TEST 1: POSITIVE - Tenant A can read own data');
    console.log('─────────────────────────────────────────────────────────\n');
    
    await setTenantContext(tenantA);
    console.log(`   Tenant context: ${tenantA}`);
    console.log(`   Attempting to read shipment: ${shipmentAId}\n`);

    const { data: readOwnData, error: readOwnError } = await supabase
      .from('log_shipments')
      .select('*')
      .eq('id', shipmentAId);

    if (readOwnError) {
      console.error(`   ❌ FAIL: Error reading own data: ${readOwnError.message}\n`);
      testsFailed++;
    } else if (!readOwnData || readOwnData.length === 0) {
      console.error('   ❌ FAIL: Tenant A CANNOT read own shipment (RLS too restrictive)\n');
      testsFailed++;
    } else if (readOwnData.length === 1 && readOwnData[0].id === shipmentAId) {
      console.log('   ✅ PASS: Tenant A can read own shipment');
      console.log(`   Shipment: ${readOwnData[0].shipment_number} (${readOwnData[0].status})\n`);
      testsPassed++;
    } else {
      console.error(`   ❌ FAIL: Unexpected result: ${readOwnData.length} rows\n`);
      testsFailed++;
    }

    // ========================================================================
    // TEST 2: NEGATIVE - Tenant A CANNOT read Tenant B's data
    // ========================================================================
    console.log('TEST 2: NEGATIVE - Tenant A CANNOT read Tenant B\'s data');
    console.log('─────────────────────────────────────────────────────────\n');
    
    await setTenantContext(tenantA);
    console.log(`   Tenant context: ${tenantA}`);
    console.log(`   Attempting to read Tenant B's shipment: ${shipmentBId}\n`);

    const { data: readOtherData, error: readOtherError } = await supabase
      .from('log_shipments')
      .select('*')
      .eq('id', shipmentBId);

    if (readOtherError) {
      console.error(`   ❌ FAIL: Unexpected error: ${readOtherError.message}\n`);
      testsFailed++;
    } else if (!readOtherData || readOtherData.length === 0) {
      console.log('   ✅ PASS: Tenant A BLOCKED from reading Tenant B shipment');
      console.log('   RLS returned 0 rows (access denied)\n');
      testsPassed++;
    } else {
      console.error('   ❌ FAIL: RLS BREACH! Tenant A can read Tenant B shipment');
      console.error(`   Returned ${readOtherData.length} row(s)\n`);
      testsFailed++;
    }

    // ========================================================================
    // TEST 3: NEGATIVE - Tenant A CANNOT update Tenant B's data
    // ========================================================================
    console.log('TEST 3: NEGATIVE - Tenant A CANNOT update Tenant B\'s data');
    console.log('─────────────────────────────────────────────────────────\n');
    
    await setTenantContext(tenantA);
    console.log(`   Tenant context: ${tenantA}`);
    console.log(`   Attempting to update Tenant B's shipment: ${shipmentBId}\n`);

    const { error: updateError, count: updateCount } = await supabase
      .from('log_shipments')
      .update({ status: 'cancelled' })
      .eq('id', shipmentBId)
      .select('*', { count: 'exact' });

    // Switch back to Tenant B to verify
    await setTenantContext(tenantB);

    const { data: checkUpdate, error: checkError } = await supabase
      .from('log_shipments')
      .select('status')
      .eq('id', shipmentBId)
      .single();

    if (checkError) {
      console.error(`   ❌ FAIL: Error verifying update: ${checkError.message}\n`);
      testsFailed++;
    } else if (checkUpdate.status === 'draft') {
      console.log('   ✅ PASS: Tenant A BLOCKED from updating Tenant B shipment');
      console.log(`   Status remains: ${checkUpdate.status} (not cancelled)\n`);
      testsPassed++;
    } else {
      console.error('   ❌ FAIL: RLS BREACH! Tenant A updated Tenant B shipment');
      console.error(`   Status changed to: ${checkUpdate.status}\n`);
      testsFailed++;
    }

    // ========================================================================
    // TEST 4: NEGATIVE - Tenant A CANNOT delete Tenant B's data
    // ========================================================================
    console.log('TEST 4: NEGATIVE - Tenant A CANNOT delete Tenant B\'s data');
    console.log('─────────────────────────────────────────────────────────\n');
    
    await setTenantContext(tenantA);
    console.log(`   Tenant context: ${tenantA}`);
    console.log(`   Attempting to delete Tenant B's shipment: ${shipmentBId}\n`);

    const { error: deleteError } = await supabase
      .from('log_shipments')
      .delete()
      .eq('id', shipmentBId);

    // Switch back to Tenant B to verify
    await setTenantContext(tenantB);

    const { data: checkDelete, error: checkDeleteError } = await supabase
      .from('log_shipments')
      .select('*')
      .eq('id', shipmentBId)
      .single();

    if (checkDeleteError && checkDeleteError.code === 'PGRST116') {
      console.error('   ❌ FAIL: RLS BREACH! Tenant A deleted Tenant B shipment\n');
      testsFailed++;
    } else if (checkDelete && checkDelete.id === shipmentBId) {
      console.log('   ✅ PASS: Tenant A BLOCKED from deleting Tenant B shipment');
      console.log(`   Shipment still exists: ${checkDelete.shipment_number}\n`);
      testsPassed++;
    } else {
      console.error(`   ❌ FAIL: Unexpected result\n`);
      testsFailed++;
    }

    // ========================================================================
    // TEST 5: POSITIVE - Tenant B can read own data
    // ========================================================================
    console.log('TEST 5: POSITIVE - Tenant B can read own data');
    console.log('─────────────────────────────────────────────────────────\n');
    
    await setTenantContext(tenantB);
    console.log(`   Tenant context: ${tenantB}`);
    console.log(`   Attempting to read shipment: ${shipmentBId}\n`);

    const { data: readOwnB, error: readOwnErrorB } = await supabase
      .from('log_shipments')
      .select('*')
      .eq('id', shipmentBId);

    if (readOwnErrorB) {
      console.error(`   ❌ FAIL: Error reading own data: ${readOwnErrorB.message}\n`);
      testsFailed++;
    } else if (!readOwnB || readOwnB.length === 0) {
      console.error('   ❌ FAIL: Tenant B CANNOT read own shipment (RLS too restrictive)\n');
      testsFailed++;
    } else if (readOwnB.length === 1 && readOwnB[0].id === shipmentBId) {
      console.log('   ✅ PASS: Tenant B can read own shipment');
      console.log(`   Shipment: ${readOwnB[0].shipment_number} (${readOwnB[0].status})\n`);
      testsPassed++;
    } else {
      console.error(`   ❌ FAIL: Unexpected result: ${readOwnB.length} rows\n`);
      testsFailed++;
    }

    // ========================================================================
    // TEST 6: NEGATIVE - Tenant B CANNOT read Tenant A's data
    // ========================================================================
    console.log('TEST 6: NEGATIVE - Tenant B CANNOT read Tenant A\'s data');
    console.log('─────────────────────────────────────────────────────────\n');
    
    await setTenantContext(tenantB);
    console.log(`   Tenant context: ${tenantB}`);
    console.log(`   Attempting to read Tenant A's shipment: ${shipmentAId}\n`);

    const { data: readOtherB, error: readOtherErrorB } = await supabase
      .from('log_shipments')
      .select('*')
      .eq('id', shipmentAId);

    if (readOtherErrorB) {
      console.error(`   ❌ FAIL: Unexpected error: ${readOtherErrorB.message}\n`);
      testsFailed++;
    } else if (!readOtherB || readOtherB.length === 0) {
      console.log('   ✅ PASS: Tenant B BLOCKED from reading Tenant A shipment');
      console.log('   RLS returned 0 rows (access denied)\n');
      testsPassed++;
    } else {
      console.error('   ❌ FAIL: RLS BREACH! Tenant B can read Tenant A shipment');
      console.error(`   Returned ${readOtherB.length} row(s)\n`);
      testsFailed++;
    }

    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ TEST EXECUTION FAILED\n');
    console.error('Error:', error.message);
    return false;
  } finally {
    // ========================================================================
    // CLEANUP
    // ========================================================================
    console.log('🧹 CLEANUP: Removing test data\n');

    if (shipmentAId) {
      await setTenantContext(tenantA);
      await supabase.from('log_shipments').delete().eq('id', shipmentAId);
      console.log(`   Deleted Tenant A shipment: ${shipmentAId}`);
    }

    if (shipmentBId) {
      await setTenantContext(tenantB);
      await supabase.from('log_shipments').delete().eq('id', shipmentBId);
      console.log(`   Deleted Tenant B shipment: ${shipmentBId}`);
    }

    console.log('\n✅ Cleanup complete\n');
  }

  // ========================================================================
  // RESULTS SUMMARY
  // ========================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RLS ISOLATION TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`   Total tests: ${testsPassed + testsFailed}`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}\n`);

  if (testsFailed === 0) {
    console.log('🎉 ALL RLS ISOLATION TESTS PASSED\n');
    console.log('✅ Tenant isolation is VERIFIED at database level');
    console.log('✅ Cross-tenant access is BLOCKED');
    console.log('✅ RLS policies are functioning correctly\n');
    return true;
  } else {
    console.error('❌ RLS ISOLATION TESTS FAILED\n');
    console.error(`   ${testsFailed} test(s) failed`);
    console.error('   RLS policies may have security vulnerabilities\n');
    return false;
  }
}

console.log('═══════════════════════════════════════════════════════════\n');
console.log('  WEEK 3 DAY 3 — GATE A — STEP 6: RLS ISOLATION VERIFICATION');
console.log('\n═══════════════════════════════════════════════════════════\n');

verifyTenantIsolation().then((success) => {
  if (success) {
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('  STEP 6 COMPLETE — RLS tenant isolation verified');
    console.log('\n═══════════════════════════════════════════════════════════\n');
    process.exit(0);
  } else {
    console.error('═══════════════════════════════════════════════════════════\n');
    console.error('  STEP 6 FAILED — RLS isolation has vulnerabilities');
    console.error('\n═══════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n❌ FATAL ERROR:', error.message);
  process.exit(1);
});
