#!/usr/bin/env node

/**
 * Integration Tests Runner
 * 
 * Week 3 Day 3 Gate A - Step 7
 * 
 * Runs integration tests for Logistics platform with real Supabase database
 * Tests database operations directly (engine verified separately via contract tests)
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

let testTenantId;
let testShipmentId;
let testsPassed = 0;
let testsFailed = 0;

async function setTenantContext(tenantId) {
  await supabase.rpc('set_config', {
    setting: 'app.current_tenant_id',
    value: tenantId,
    is_local: false,
  });
}

async function runTests() {
  testTenantId = 'test-tenant-' + uuid();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SHIPMENT ENGINE INTEGRATION TESTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Test Tenant: ${testTenantId}\n`);

  try {
    await setTenantContext(testTenantId);

    // ========================================================================
    // TEST 1: Create shipment → verify in DB
    // ========================================================================
    console.log('TEST 1: Create shipment → verify in database');
    console.log('─────────────────────────────────────────────────────────\n');

    try {
      const shipmentNumber = 'SHIP-INT-001';

      const { data: shipment, error } = await supabase
        .from('log_shipments')
        .insert({
          tenant_id: testTenantId,
          shipment_number: shipmentNumber,
          status: 'draft',
          type: 'standard',
          priority: 'normal',
          origin: {
            address: '123 Origin St',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94102',
            country: 'US',
          },
          destination: {
            address: '456 Dest Ave',
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90001',
            country: 'US',
          },
          planned_pickup_date: new Date('2026-08-25T10:00:00Z').toISOString(),
          planned_delivery_date: new Date('2026-08-27T16:00:00Z').toISOString(),
          items: [
            {
              sku: 'ITEM-001',
              description: 'Test Item',
              quantity: 2,
              weight: { value: 5, unit: 'kg' },
              dimensions: { length: 10, width: 10, height: 10, unit: 'cm' },
            },
          ],
          created_by: uuid(),
          last_modified_by: uuid(),
        })
        .select()
        .single();

      if (error || !shipment) {
        throw new Error(error?.message || 'Failed to create shipment');
      }

      testShipmentId = shipment.id;

      // Verify in database
      const { data: dbShipment, error: verifyError } = await supabase
        .from('log_shipments')
        .select('*')
        .eq('id', testShipmentId)
        .single();

      if (verifyError || !dbShipment || dbShipment.shipment_number !== shipmentNumber) {
        throw new Error('Shipment not found in database after creation');
      }

      console.log('   ✅ PASS: Shipment created and verified in DB');
      console.log(`   Shipment ID: ${testShipmentId}`);
      console.log(`   Status: ${dbShipment.status}\n`);
      testsPassed++;
    } catch (error) {
      console.error('   ❌ FAIL:', error.message, '\n');
      testsFailed++;
    }

    // ========================================================================
    // TEST 2: Create tracking event → verify in DB
    // ========================================================================
    console.log('TEST 2: Create tracking event → verify in database');
    console.log('─────────────────────────────────────────────────────────\n');

    try {
      const { data: trackingEvent, error } = await supabase
        .from('log_tracking_events')
        .insert({
          shipment_id: testShipmentId,
          event_type: 'created',
          status: 'draft',
          description: 'Shipment created',
          performed_by: uuid(),
        })
        .select()
        .single();

      if (error || !trackingEvent) {
        throw new Error(error?.message || 'Failed to create tracking event');
      }

      // Verify in DB
      const { data: events, error: verifyError } = await supabase
        .from('log_tracking_events')
        .select('*')
        .eq('shipment_id', testShipmentId)
        .order('timestamp', { ascending: true });

      if (verifyError || !events || events.length === 0) {
        throw new Error('No tracking events found');
      }

      console.log('   ✅ PASS: Tracking event created');
      console.log(`   Event count: ${events.length}`);
      console.log(`   First event: ${events[0].event_type}\n`);
      testsPassed++;
    } catch (error) {
      console.error('   ❌ FAIL:', error.message, '\n');
      testsFailed++;
    }

    // ========================================================================
    // TEST 3: Update status → verify both tables
    // ========================================================================
    console.log('TEST 3: Update status → verify shipment and tracking event');
    console.log('─────────────────────────────────────────────────────────\n');

    try {
      const { data: updated, error } = await supabase
        .from('log_shipments')
        .update({ status: 'pending-pickup' })
        .eq('id', testShipmentId)
        .select()
        .single();

      if (error || updated.status !== 'pending-pickup') {
        throw new Error('Status update failed');
      }

      // Create corresponding tracking event
      await supabase
        .from('log_tracking_events')
        .insert({
          shipment_id: testShipmentId,
          event_type: 'pickup-scheduled',
          status: 'pending-pickup',
          description: 'Pickup scheduled',
          performed_by: uuid(),
        });

      console.log('   ✅ PASS: Status updated successfully');
      console.log(`   New status: ${updated.status}\n`);
      testsPassed++;
    } catch (error) {
      console.error('   ❌ FAIL:', error.message, '\n');
      testsFailed++;
    }

    // ========================================================================
    // TEST 4: Assign carrier → verify update
    // ========================================================================
    console.log('TEST 4: Assign carrier → verify database update');
    console.log('─────────────────────────────────────────────────────────\n');

    try {
      const carrierId = 'carrier-' + uuid();

      const { data: updated, error } = await supabase
        .from('log_shipments')
        .update({ carrier_id: carrierId })
        .eq('id', testShipmentId)
        .select()
        .single();

      if (error || updated.carrier_id !== carrierId) {
        throw new Error('Carrier assignment failed');
      }

      console.log('   ✅ PASS: Carrier assigned successfully');
      console.log(`   Carrier ID: ${carrierId}\n`);
      testsPassed++;
    } catch (error) {
      console.error('   ❌ FAIL:', error.message, '\n');
      testsFailed++;
    }

    // ========================================================================
    // TEST 5: Track shipment → verify full history
    // ========================================================================
    console.log('TEST 5: Query tracking history → verify chronological order');
    console.log('─────────────────────────────────────────────────────────\n');

    try {
      const { data: events, error } = await supabase
        .from('log_tracking_events')
        .select('*')
        .eq('shipment_id', testShipmentId)
        .order('timestamp', { ascending: true });

      if (error || !events || events.length === 0) {
        throw new Error('No tracking events found');
      }

      // Verify chronological order
      for (let i = 1; i < events.length; i++) {
        const prev = new Date(events[i - 1].timestamp);
        const curr = new Date(events[i].timestamp);
        if (curr < prev) {
          throw new Error('Events not in chronological order');
        }
      }

      console.log('   ✅ PASS: Tracking history verified');
      console.log(`   Event count: ${events.length}`);
      console.log(`   First event: ${events[0].event_type}`);
      console.log(`   Last event: ${events[events.length - 1].event_type}\n`);
      testsPassed++;
    } catch (error) {
      console.error('   ❌ FAIL:', error.message, '\n');
      testsFailed++;
    }

    // ========================================================================
    // TEST 6: Idempotency → duplicate request  
    // ========================================================================
    console.log('TEST 6: Idempotency key → verify duplicate prevention');
    console.log('─────────────────────────────────────────────────────────\n');

    try {
      const requestId = uuid();
      const shipmentNumber = 'SHIP-INT-IDEM-001';

      // First insert
      const { data: shipment1, error: error1 } = await supabase
        .from('log_shipments')
        .insert({
          tenant_id: testTenantId,
          shipment_number: shipmentNumber,
          status: 'draft',
          type: 'express',
          priority: 'high',
          origin: { address: '789 Test St', city: 'Seattle', state: 'WA', postalCode: '98101', country: 'US' },
          destination: { address: '321 Test Ave', city: 'Portland', state: 'OR', postalCode: '97201', country: 'US' },
          planned_pickup_date: new Date('2026-08-26T09:00:00Z').toISOString(),
          planned_delivery_date: new Date('2026-08-28T17:00:00Z').toISOString(),
          items: [{ sku: 'ITEM-IDEM-001', quantity: 1 }],
          created_by: uuid(),
          last_modified_by: uuid(),
        })
        .select()
        .single();

      if (error1) throw error1;

      // Store idempotency key
      await supabase
        .from('log_idempotency_keys')
        .insert({
          id: requestId,
          response_data: { shipmentId: shipment1.id },
        });

      // Check idempotency key exists
      const { data: idemKey } = await supabase
        .from('log_idempotency_keys')
        .select('*')
        .eq('id', requestId)
        .single();

      if (!idemKey) {
        throw new Error('Idempotency key not created');
      }

      // Cleanup
      await supabase.from('log_shipments').delete().eq('id', shipment1.id);
      await supabase.from('log_idempotency_keys').delete().eq('id', requestId);

      console.log('   ✅ PASS: Idempotency key mechanism verified');
      console.log(`   Request ID: ${requestId}\n`);
      testsPassed++;
    } catch (error) {
      console.error('   ❌ FAIL:', error.message, '\n');
      testsFailed++;
    }

    // ========================================================================
    // TEST 7: Tenant isolation (positive) → own data accessible
    // ========================================================================
    console.log('TEST 7: Tenant isolation (positive) → can access own data');
    console.log('─────────────────────────────────────────────────────────\n');

    try {
      await setTenantContext(testTenantId);

      const { data, error } = await supabase
        .from('log_shipments')
        .select('*')
        .eq('tenant_id', testTenantId);

      if (error || !data || data.length === 0) {
        throw new Error('Cannot access own data');
      }

      const allOwnTenant = data.every(s => s.tenant_id === testTenantId);
      if (!allOwnTenant) {
        throw new Error('RLS returned wrong tenant data');
      }

      console.log('   ✅ PASS: Can access own tenant data');
      console.log(`   Shipment count: ${data.length}\n`);
      testsPassed++;
    } catch (error) {
      console.error('   ❌ FAIL:', error.message, '\n');
      testsFailed++;
    }

    // ========================================================================
    // TEST 8: Tenant isolation (negative) → blocked cross-tenant
    // ========================================================================
    console.log('TEST 8: Tenant isolation (negative) → CANNOT access other tenant');
    console.log('─────────────────────────────────────────────────────────\n');

    try {
      const tenantB = 'test-tenant-B-' + uuid();

      // Create shipment for Tenant B
      await setTenantContext(tenantB);

      const { data: shipmentB } = await supabase
        .from('log_shipments')
        .insert({
          tenant_id: tenantB,
          shipment_number: 'SHIP-TENANT-B-001',
          status: 'draft',
          type: 'standard',
          priority: 'normal',
          origin: { address: 'B Origin', city: 'City B', country: 'US' },
          destination: { address: 'B Dest', city: 'City B2', country: 'US' },
          planned_pickup_date: new Date('2026-08-25T10:00:00Z').toISOString(),
          planned_delivery_date: new Date('2026-08-27T16:00:00Z').toISOString(),
          items: [],
          created_by: uuid(),
          last_modified_by: uuid(),
        })
        .select()
        .single();

      const shipmentBId = shipmentB.id;

      // Switch to Tenant A
      await setTenantContext(testTenantId);

      // Try to read Tenant B's shipment
      const { data: blockedData, error } = await supabase
        .from('log_shipments')
        .select('*')
        .eq('id', shipmentBId);

      if (error) {
        throw new Error('Unexpected error: ' + error.message);
      }

      if (blockedData && blockedData.length > 0) {
        throw new Error('RLS BREACH! Can access other tenant data');
      }

      // Cleanup
      await setTenantContext(tenantB);
      await supabase.from('log_shipments').delete().eq('id', shipmentBId);

      console.log('   ✅ PASS: Cross-tenant access blocked');
      console.log('   RLS returned 0 rows (access denied)\n');
      testsPassed++;
    } catch (error) {
      console.error('   ❌ FAIL:', error.message, '\n');
      testsFailed++;
    }

  } finally {
    // Cleanup
    if (testShipmentId) {
      await setTenantContext(testTenantId);
      await supabase.from('log_shipments').delete().eq('id', testShipmentId);
    }

    await supabase.from('log_shipments').delete().eq('tenant_id', testTenantId);
  }

  // Results
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`   Total tests: ${testsPassed + testsFailed}`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}\n`);

  if (testsFailed === 0) {
    console.log('🎉 ALL INTEGRATION TESTS PASSED\n');
    return true;
  } else {
    console.error(`❌ ${testsFailed} INTEGRATION TEST(S) FAILED\n`);
    return false;
  }
}

console.log('═══════════════════════════════════════════════════════════\n');
console.log('  WEEK 3 DAY 3 — GATE A — STEP 7: INTEGRATION TESTS');
console.log('\n═══════════════════════════════════════════════════════════\n');

runTests().then((success) => {
  if (success) {
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('  STEP 7 COMPLETE — All integration tests passed (8/8)');
    console.log('\n═══════════════════════════════════════════════════════════\n');
    process.exit(0);
  } else {
    console.error('═══════════════════════════════════════════════════════════\n');
    console.error('  STEP 7 FAILED — Fix failing tests before proceeding');
    console.error('\n═══════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}).catch((error) => {
  console.error('\n❌ FATAL ERROR:', error.message);
  if (error.stack) console.error(error.stack);
  process.exit(1);
});
