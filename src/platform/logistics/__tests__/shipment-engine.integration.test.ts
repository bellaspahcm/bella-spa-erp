/**
 * Shipment Engine Integration Tests
 * 
 * Week 3 Day 3 Gate A - Step 5
 * 
 * Tests with REAL Supabase database (not mocks)
 * Verifies:
 * - Database operations work end-to-end
 * - RLS policies enforced
 * - Tenant isolation working
 * - Contract compliance in real environment
 */

// Using Jest (not Vitest)
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ShipmentEngineService } from '../engines/shipment-engine';
import { v4 as uuid } from 'uuid';

describe('Shipment Engine Integration Tests', () => {
  let supabase: SupabaseClient;
  let engine: ShipmentEngineService;
  let testTenantId: string;
  let testShipmentId: string;

  beforeAll(async () => {
    // Initialize real Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials in environment');
    }

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    engine = new ShipmentEngineService(supabase);
    testTenantId = 'test-tenant-' + uuid();

    // Set tenant context for RLS
    await supabase.rpc('set_config', {
      setting: 'app.current_tenant_id',
      value: testTenantId,
      is_local: false,
    });

    console.log(`\n🧪 Integration test initialized with tenant: ${testTenantId}\n`);
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    if (testShipmentId) {
      await supabase
        .from('log_shipments')
        .delete()
        .eq('id', testShipmentId);
    }

    // Delete all test tenant data
    await supabase
      .from('log_shipments')
      .delete()
      .eq('tenant_id', testTenantId);

    console.log('\n🧹 Test cleanup complete\n');
  });

  // ==========================================================================
  // TEST 1: Create shipment → verify in DB
  // ==========================================================================
  test('1. Create shipment → verify in database', async () => {
    const requestId = uuid();
    const shipmentNumber = 'SHIP-INT-001';

    const result = await engine.createShipment({
      requestId,
      tenantId: testTenantId,
      shipmentNumber,
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
      plannedPickupDate: new Date('2026-08-25T10:00:00Z').toISOString(),
      plannedDeliveryDate: new Date('2026-08-27T16:00:00Z').toISOString(),
      items: [
        {
          sku: 'ITEM-001',
          description: 'Test Item',
          quantity: 2,
          weight: { value: 5, unit: 'kg' },
          dimensions: { length: 10, width: 10, height: 10, unit: 'cm' },
        },
      ],
      createdBy: 'test-user-' + uuid(),
    });

    // Verify engine result
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.shipment).toBeDefined();
    expect(result.data?.shipment.shipmentNumber).toBe(shipmentNumber);
    expect(result.data?.shipment.status).toBe('draft');

    testShipmentId = result.data!.shipment.id;

    // Verify in database
    const { data: dbShipment, error } = await supabase
      .from('log_shipments')
      .select('*')
      .eq('id', testShipmentId)
      .single();

    expect(error).toBeNull();
    expect(dbShipment).toBeDefined();
    expect(dbShipment.shipment_number).toBe(shipmentNumber);
    expect(dbShipment.status).toBe('draft');
    expect(dbShipment.tenant_id).toBe(testTenantId);
    expect(dbShipment.type).toBe('standard');
    expect(dbShipment.priority).toBe('normal');
  });

  // ==========================================================================
  // TEST 2: Create tracking event → verify in DB
  // ==========================================================================
  test('2. Create tracking event → verify in database', async () => {
    // Tracking event should have been created automatically on shipment creation
    const { data: events, error } = await supabase
      .from('log_tracking_events')
      .select('*')
      .eq('shipment_id', testShipmentId)
      .order('timestamp', { ascending: true });

    expect(error).toBeNull();
    expect(events).toBeDefined();
    expect(events!.length).toBeGreaterThan(0);

    const firstEvent = events![0];
    expect(firstEvent.event_type).toBe('created');
    expect(firstEvent.status).toBe('draft');
    expect(firstEvent.shipment_id).toBe(testShipmentId);
  });

  // ==========================================================================
  // TEST 3: Update status → verify both tables
  // ==========================================================================
  test('3. Update status → verify shipment and tracking event', async () => {
    const result = await engine.updateShipmentStatus({
      requestId: uuid(),
      tenantId: testTenantId,
      shipmentId: testShipmentId,
      newStatus: 'pending-pickup',
      performedBy: 'test-user-' + uuid(),
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.shipment.status).toBe('pending-pickup');

    // Verify shipment updated in DB
    const { data: shipment, error: shipmentError } = await supabase
      .from('log_shipments')
      .select('status')
      .eq('id', testShipmentId)
      .single();

    expect(shipmentError).toBeNull();
    expect(shipment!.status).toBe('pending-pickup');

    // Verify tracking event created
    const { data: events, error: eventsError } = await supabase
      .from('log_tracking_events')
      .select('*')
      .eq('shipment_id', testShipmentId)
      .order('timestamp', { ascending: false })
      .limit(1);

    expect(eventsError).toBeNull();
    expect(events).toBeDefined();
    expect(events![0].status).toBe('pending-pickup');
    expect(events![0].event_type).toBe('pickup-scheduled');
  });

  // ==========================================================================
  // TEST 4: Assign carrier → verify update
  // ==========================================================================
  test('4. Assign carrier → verify database update', async () => {
    const carrierId = 'carrier-' + uuid();

    const result = await engine.assignCarrier({
      requestId: uuid(),
      tenantId: testTenantId,
      shipmentId: testShipmentId,
      carrierId,
      assignedBy: 'test-user-' + uuid(),
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.shipment.carrierId).toBe(carrierId);

    // Verify in database
    const { data, error } = await supabase
      .from('log_shipments')
      .select('carrier_id')
      .eq('id', testShipmentId)
      .single();

    expect(error).toBeNull();
    expect(data!.carrier_id).toBe(carrierId);
  });

  // ==========================================================================
  // TEST 5: Track shipment → verify full history
  // ==========================================================================
  test('5. Track shipment → verify chronological history', async () => {
    const result = await engine.trackShipment({
      tenantId: testTenantId,
      shipmentId: testShipmentId,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.trackingHistory).toBeDefined();
    expect(result.data!.trackingHistory.length).toBeGreaterThan(0);

    // Verify chronological order
    const events = result.data!.trackingHistory;
    for (let i = 1; i < events.length; i++) {
      const prev = new Date(events[i - 1].timestamp);
      const curr = new Date(events[i].timestamp);
      expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
    }

    // Verify first event is 'created'
    expect(events[0].eventType).toBe('created');

    // Verify last event is 'pickup-scheduled' (from test 3)
    const lastEvent = events[events.length - 1];
    expect(lastEvent.eventType).toBe('pickup-scheduled');
    expect(lastEvent.status).toBe('pending-pickup');
  });

  // ==========================================================================
  // TEST 6: Idempotency → duplicate request
  // ==========================================================================
  test('6. Idempotency → duplicate request returns same shipment', async () => {
    const requestId = uuid();
    const shipmentNumber = 'SHIP-INT-IDEM-001';

    // First request
    const result1 = await engine.createShipment({
      requestId,
      tenantId: testTenantId,
      shipmentNumber,
      type: 'express',
      priority: 'high',
      origin: {
        address: '789 Test St',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98101',
        country: 'US',
      },
      destination: {
        address: '321 Test Ave',
        city: 'Portland',
        state: 'OR',
        postalCode: '97201',
        country: 'US',
      },
      plannedPickupDate: new Date('2026-08-26T09:00:00Z').toISOString(),
      plannedDeliveryDate: new Date('2026-08-28T17:00:00Z').toISOString(),
      items: [
        {
          sku: 'ITEM-IDEM-001',
          description: 'Idempotency Test Item',
          quantity: 1,
          weight: { value: 3, unit: 'kg' },
        },
      ],
      createdBy: 'test-user-' + uuid(),
    });

    expect(result1.success).toBe(true);
    const shipmentId1 = result1.data!.shipment.id;

    // Second request with SAME requestId
    const result2 = await engine.createShipment({
      requestId, // Same requestId
      tenantId: testTenantId,
      shipmentNumber,
      type: 'express',
      priority: 'high',
      origin: {
        address: '789 Test St',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98101',
        country: 'US',
      },
      destination: {
        address: '321 Test Ave',
        city: 'Portland',
        state: 'OR',
        postalCode: '97201',
        country: 'US',
      },
      plannedPickupDate: new Date('2026-08-26T09:00:00Z').toISOString(),
      plannedDeliveryDate: new Date('2026-08-28T17:00:00Z').toISOString(),
      items: [
        {
          sku: 'ITEM-IDEM-001',
          description: 'Idempotency Test Item',
          quantity: 1,
          weight: { value: 3, unit: 'kg' },
        },
      ],
      createdBy: 'test-user-' + uuid(),
    });

    expect(result2.success).toBe(true);
    const shipmentId2 = result2.data!.shipment.id;

    // Should return same shipment ID
    expect(shipmentId1).toBe(shipmentId2);

    // Verify only one shipment exists in database
    const { data: shipments, error } = await supabase
      .from('log_shipments')
      .select('*')
      .eq('shipment_number', shipmentNumber)
      .eq('tenant_id', testTenantId);

    expect(error).toBeNull();
    expect(shipments).toBeDefined();
    expect(shipments!.length).toBe(1);

    // Cleanup
    await supabase
      .from('log_shipments')
      .delete()
      .eq('id', shipmentId1);
  });

  // ==========================================================================
  // TEST 7: Tenant isolation (positive) → own data accessible
  // ==========================================================================
  test('7. Tenant isolation (positive) → can access own data', async () => {
    // Set tenant context
    await supabase.rpc('set_config', {
      setting: 'app.current_tenant_id',
      value: testTenantId,
      is_local: false,
    });

    // Query own shipments
    const { data, error } = await supabase
      .from('log_shipments')
      .select('*')
      .eq('tenant_id', testTenantId);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBeGreaterThan(0);

    // Verify all shipments belong to this tenant
    data!.forEach((shipment) => {
      expect(shipment.tenant_id).toBe(testTenantId);
    });
  });

  // ==========================================================================
  // TEST 8: Tenant isolation (negative) → blocked cross-tenant
  // ==========================================================================
  test('8. Tenant isolation (negative) → CANNOT access other tenant data', async () => {
    // Create shipment for Tenant B
    const tenantB = 'test-tenant-B-' + uuid();

    await supabase.rpc('set_config', {
      setting: 'app.current_tenant_id',
      value: tenantB,
      is_local: false,
    });

    const { data: shipmentB, error: createError } = await supabase
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
        created_by: 'user-b',
        last_modified_by: 'user-b',
      })
      .select()
      .single();

    expect(createError).toBeNull();
    expect(shipmentB).toBeDefined();

    const shipmentBId = shipmentB!.id;

    // Switch to Tenant A (original test tenant)
    await supabase.rpc('set_config', {
      setting: 'app.current_tenant_id',
      value: testTenantId,
      is_local: false,
    });

    // Try to read Tenant B's shipment
    const { data: blockedData, error: blockedError } = await supabase
      .from('log_shipments')
      .select('*')
      .eq('id', shipmentBId);

    // RLS should return 0 rows (not an error, but empty result)
    expect(blockedError).toBeNull();
    expect(blockedData).toBeDefined();
    expect(blockedData!.length).toBe(0); // RLS blocked access

    // Try to update Tenant B's shipment
    const { error: updateError } = await supabase
      .from('log_shipments')
      .update({ status: 'cancelled' })
      .eq('id', shipmentBId);

    // Update should succeed but affect 0 rows
    expect(updateError).toBeNull();

    // Verify shipment was NOT updated (still in original state)
    await supabase.rpc('set_config', {
      setting: 'app.current_tenant_id',
      value: tenantB,
      is_local: false,
    });

    const { data: checkUpdate, error: checkError } = await supabase
      .from('log_shipments')
      .select('status')
      .eq('id', shipmentBId)
      .single();

    expect(checkError).toBeNull();
    expect(checkUpdate!.status).toBe('draft'); // Still draft, not cancelled

    // Cleanup
    await supabase
      .from('log_shipments')
      .delete()
      .eq('id', shipmentBId);

    // Restore original tenant context
    await supabase.rpc('set_config', {
      setting: 'app.current_tenant_id',
      value: testTenantId,
      is_local: false,
    });
  });
});
