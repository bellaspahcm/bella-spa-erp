/**
 * P1.4: Full Warehouse Workflow Integration Test
 * 
 * End-to-end test covering complete receipt workflow:
 * 1. Create Receipt (R1)
 * 2. Submit for Putaway (R6) - with R3 location validation
 * 3. Complete Putaway (R7) - with inventory update
 * 4. Verify final state and inventory
 * 
 * Also tests:
 * - Hold/Release workflow (R8)
 * - State machine validation (R9)
 * - Inventory movements tracking
 * - Event publishing (P0.5)
 * 
 * @module platform/logistics/warehouse/__tests__
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ReceiptService } from '../receipt.service';
import { WarehouseEngine } from '../../engines/warehouse-engine';
import {
  CreateReceiptInput,
  SubmitForPutawayInput,
  CompletePutawayInput,
  HoldReceiptInput,
  ReleaseHoldInput,
} from '../receipt.types';

describe('Warehouse Workflow Integration', () => {
  let supabase: SupabaseClient;
  let service: ReceiptService;
  let engine: WarehouseEngine;
  
  const TENANT_ID = 'integration-test-' + Date.now();
  const USER_ID = 'user-' + Date.now();
  
  let vendorId: string;
  let sku1Id: string;
  let sku2Id: string;
  let bin1Id: string;
  let bin2Id: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    service = new ReceiptService(supabase, TENANT_ID, USER_ID);
    engine = new WarehouseEngine(supabase, TENANT_ID, USER_ID);

    // Create test fixtures
    const { data: vendor } = await supabase
      .from('logistics_warehouse_vendors')
      .insert({
        tenant_id: TENANT_ID,
        vendor_code: 'VENDOR-INT-' + Date.now(),
        vendor_name: 'Integration Test Vendor',
      })
      .select()
      .single();
    vendorId = vendor!.id;

    const { data: sku1 } = await supabase
      .from('logistics_warehouse_skus')
      .insert({
        tenant_id: TENANT_ID,
        sku_code: 'SKU-INT-' + Date.now() + '-1',
        description: 'Integration Test SKU 1',
        uom: 'EA',
        unit_cost: 15.00,
        status: 'active',
      })
      .select()
      .single();
    sku1Id = sku1!.id;

    const { data: sku2 } = await supabase
      .from('logistics_warehouse_skus')
      .insert({
        tenant_id: TENANT_ID,
        sku_code: 'SKU-INT-' + Date.now() + '-2',
        description: 'Integration Test SKU 2',
        uom: 'CS',
        unit_cost: 45.50,
        status: 'active',
      })
      .select()
      .single();
    sku2Id = sku2!.id;

    const { data: bin1 } = await supabase
      .from('logistics_warehouse_bins')
      .insert({
        tenant_id: TENANT_ID,
        bin_code: 'BIN-INT-' + Date.now() + '-1',
        warehouse_id: 'WH-MAIN',
        zone_id: 'RECEIVING',
        max_capacity: 5000,
        status: 'active',
      })
      .select()
      .single();
    bin1Id = bin1!.id;

    const { data: bin2 } = await supabase
      .from('logistics_warehouse_bins')
      .insert({
        tenant_id: TENANT_ID,
        bin_code: 'BIN-INT-' + Date.now() + '-2',
        warehouse_id: 'WH-MAIN',
        zone_id: 'STORAGE',
        max_capacity: 10000,
        status: 'active',
      })
      .select()
      .single();
    bin2Id = bin2!.id;
  });

  afterAll(async () => {
    // Cleanup in reverse order of dependencies
    await supabase.from('logistics_warehouse_movements').delete().eq('tenant_id', TENANT_ID);
    await supabase.from('logistics_warehouse_inventory_on_hand').delete().eq('tenant_id', TENANT_ID);
    await supabase.from('logistics_warehouse_receipt_line_items').delete().eq('tenant_id', TENANT_ID);
    await supabase.from('logistics_warehouse_receipts').delete().eq('tenant_id', TENANT_ID);
    await supabase.from('logistics_warehouse_bins').delete().eq('tenant_id', TENANT_ID);
    await supabase.from('logistics_warehouse_skus').delete().eq('tenant_id', TENANT_ID);
    await supabase.from('logistics_warehouse_vendors').delete().eq('tenant_id', TENANT_ID);
  });

  describe('Happy Path: Complete Receipt Workflow', () => {
    it('should execute full workflow: create → submit → complete', async () => {
      // ============================================================
      // STEP 1: Create Receipt (R1)
      // ============================================================
      const createInput: CreateReceiptInput = {
        tenant_id: TENANT_ID,
        po_number: 'PO-HAPPY-' + Date.now(),
        vendor_id: vendorId,
        received_date: new Date(),
        receiver_notes: 'Integration test - happy path',
        line_items: [
          {
            sku_id: sku1Id,
            expected_quantity: 100,
            actual_quantity: 100,
            uom: 'EA',
            target_bin_id: bin1Id,
          },
          {
            sku_id: sku2Id,
            expected_quantity: 50,
            actual_quantity: 48, // 2 unit shortage
            uom: 'CS',
            target_bin_id: bin2Id,
          },
        ],
      };

      console.log('\n📦 STEP 1: Creating receipt...');
      const createResult = await engine.createReceipt(createInput);

      expect(createResult.success).toBe(true);
      expect(createResult.data).toBeDefined();
      
      const receipt = createResult.data!.receipt;
      const lineItems = createResult.data!.line_items;
      const discrepancies = createResult.data!.discrepancies;

      expect(receipt.status).toBe('pending_putaway');
      expect(receipt.tenant_id).toBe(TENANT_ID);
      expect(lineItems).toHaveLength(2);
      expect(discrepancies).toHaveLength(1); // Only SKU2 has discrepancy

      console.log(`   ✓ Receipt created: ${receipt.id}`);
      console.log(`   ✓ Status: ${receipt.status}`);
      console.log(`   ✓ Line items: ${lineItems.length}`);
      console.log(`   ✓ Discrepancies: ${discrepancies.length}`);

      const receiptId = receipt.id;

      // Verify discrepancy calculation
      const sku2LineItem = lineItems.find(li => li.sku_id === sku2Id);
      expect(sku2LineItem).toBeDefined();
      expect(sku2LineItem!.expected_quantity).toBe(50);
      expect(sku2LineItem!.actual_quantity).toBe(48);
      expect(sku2LineItem!.discrepancy).toBe(-2);
      expect(sku2LineItem!.discrepancy_status).toBe('short');

      // ============================================================
      // STEP 2: Submit for Putaway (R6) with R3 validation
      // ============================================================
      console.log('\n📋 STEP 2: Submitting for putaway...');
      
      const submitInput: SubmitForPutawayInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        submitted_by: USER_ID,
      };

      const submitResult = await engine.submitForPutaway(submitInput);

      expect(submitResult.success).toBe(true);
      expect(submitResult.data).toBeDefined();
      expect(submitResult.data!.receipt.status).toBe('putaway_in_progress');
      expect(submitResult.data!.receipt.submitted_at).toBeDefined();
      expect(submitResult.data!.receipt.submitted_by).toBe(USER_ID);

      console.log(`   ✓ Status transition: pending_putaway → putaway_in_progress`);
      console.log(`   ✓ Submitted at: ${submitResult.data!.receipt.submitted_at}`);
      console.log(`   ✓ R3 location validation passed`);

      // ============================================================
      // STEP 3: Complete Putaway (R7) with inventory update
      // ============================================================
      console.log('\n✅ STEP 3: Completing putaway...');

      const completeInput: CompletePutawayInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        completed_by: USER_ID,
      };

      const completeResult = await engine.completePutaway(completeInput);

      expect(completeResult.success).toBe(true);
      expect(completeResult.data).toBeDefined();
      expect(completeResult.data!.receipt.status).toBe('completed');
      expect(completeResult.data!.receipt.completed_at).toBeDefined();
      expect(completeResult.data!.receipt.completed_by).toBe(USER_ID);
      expect(completeResult.data!.inventory_movements).toHaveLength(2);

      console.log(`   ✓ Status transition: putaway_in_progress → completed (terminal)`);
      console.log(`   ✓ Completed at: ${completeResult.data!.receipt.completed_at}`);
      console.log(`   ✓ Inventory movements: ${completeResult.data!.inventory_movements.length}`);

      // ============================================================
      // STEP 4: Verify Inventory Updated
      // ============================================================
      console.log('\n🔍 STEP 4: Verifying inventory...');

      const { data: sku1Inventory } = await supabase
        .from('logistics_warehouse_inventory_on_hand')
        .select('quantity')
        .eq('tenant_id', TENANT_ID)
        .eq('sku_id', sku1Id)
        .eq('bin_id', bin1Id)
        .single();

      expect(sku1Inventory).toBeDefined();
      expect(parseFloat(sku1Inventory!.quantity)).toBe(100);

      const { data: sku2Inventory } = await supabase
        .from('logistics_warehouse_inventory_on_hand')
        .select('quantity')
        .eq('tenant_id', TENANT_ID)
        .eq('sku_id', sku2Id)
        .eq('bin_id', bin2Id)
        .single();

      expect(sku2Inventory).toBeDefined();
      expect(parseFloat(sku2Inventory!.quantity)).toBe(48); // Actual received, not expected

      console.log(`   ✓ SKU1 inventory: ${sku1Inventory!.quantity} in ${bin1Id.substring(0, 8)}...`);
      console.log(`   ✓ SKU2 inventory: ${sku2Inventory!.quantity} in ${bin2Id.substring(0, 8)}...`);

      // ============================================================
      // STEP 5: Verify Terminal State Protection
      // ============================================================
      console.log('\n🔒 STEP 5: Verifying terminal state protection...');

      // Try to submit again (should fail - terminal state)
      const retrySubmit = await engine.submitForPutaway(submitInput);
      expect(retrySubmit.success).toBe(false);
      expect(retrySubmit.error?.code).toBe('INVALID_STATE_TRANSITION');

      console.log(`   ✓ Cannot transition from completed (terminal state)`);

      // ============================================================
      // SUMMARY
      // ============================================================
      console.log('\n🎉 WORKFLOW COMPLETE');
      console.log('   Receipt lifecycle:');
      console.log('     1. Created → pending_putaway');
      console.log('     2. Submitted → putaway_in_progress');
      console.log('     3. Completed → completed (terminal)');
      console.log('   Inventory updated: 2 SKUs across 2 bins');
      console.log('   State machine: protected\n');
    });
  });

  describe('Hold/Release Workflow', () => {
    it('should execute hold → release → complete workflow', async () => {
      // Create receipt
      const createInput: CreateReceiptInput = {
        tenant_id: TENANT_ID,
        po_number: 'PO-HOLD-' + Date.now(),
        vendor_id: vendorId,
        received_date: new Date(),
        line_items: [
          {
            sku_id: sku1Id,
            expected_quantity: 75,
            actual_quantity: 75,
            uom: 'EA',
            target_bin_id: bin1Id,
          },
        ],
      };

      const createResult = await engine.createReceipt(createInput);
      expect(createResult.success).toBe(true);
      
      const receiptId = createResult.data!.receipt.id;

      console.log('\n⏸️  HOLD/RELEASE WORKFLOW');
      console.log(`   Receipt: ${receiptId.substring(0, 8)}...`);

      // Hold receipt
      const holdInput: HoldReceiptInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        held_by: USER_ID,
        hold_reason: 'quality_issue',
        notes: 'Found damaged packaging - quality inspection required',
      };

      const holdResult = await engine.holdReceipt(holdInput);
      expect(holdResult.success).toBe(true);
      expect(holdResult.data!.receipt.status).toBe('on_hold');
      expect(holdResult.data!.receipt.hold_reason).toBe('quality_issue');

      console.log('   ✓ Held: pending_putaway → on_hold');

      // Release hold
      const releaseInput: ReleaseHoldInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        released_by: USER_ID,
        notes: 'Quality inspection passed',
      };

      const releaseResult = await engine.releaseHold(releaseInput);
      expect(releaseResult.success).toBe(true);
      expect(releaseResult.data!.receipt.status).toBe('pending_putaway');
      expect(releaseResult.data!.receipt.held_at).toBeNull();

      console.log('   ✓ Released: on_hold → pending_putaway');

      // Continue normal workflow
      const submitResult = await engine.submitForPutaway({
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        submitted_by: USER_ID,
      });
      expect(submitResult.success).toBe(true);

      const completeResult = await engine.completePutaway({
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        completed_by: USER_ID,
      });
      expect(completeResult.success).toBe(true);
      expect(completeResult.data!.receipt.status).toBe('completed');

      console.log('   ✓ Completed: putaway_in_progress → completed');
      console.log('   Workflow: pending → hold → release → submit → complete ✓\n');
    });
  });

  describe('Error Scenarios', () => {
    it('should reject submitForPutaway without target bins', async () => {
      // Create receipt without target_bin_id
      const { data: receipt } = await supabase
        .from('logistics_warehouse_receipts')
        .insert({
          tenant_id: TENANT_ID,
          po_number: 'PO-NOBIN-' + Date.now(),
          vendor_id: vendorId,
          received_date: new Date().toISOString().split('T')[0],
          status: 'pending_putaway',
        })
        .select()
        .single();

      await supabase.from('logistics_warehouse_receipt_line_items').insert({
        receipt_id: receipt!.id,
        tenant_id: TENANT_ID,
        sku_id: sku1Id,
        expected_quantity: 100,
        actual_quantity: 100,
        uom: 'EA',
        target_bin_id: null, // Missing!
        discrepancy_status: 'match',
      });

      const submitResult = await engine.submitForPutaway({
        tenant_id: TENANT_ID,
        receipt_id: receipt!.id,
        submitted_by: USER_ID,
      });

      expect(submitResult.success).toBe(false);
      expect(submitResult.error?.code).toBe('VALIDATION_FAILED');
      expect(submitResult.error?.message).toContain('target bin');

      // Cleanup
      await supabase.from('logistics_warehouse_receipt_line_items').delete().eq('receipt_id', receipt!.id);
      await supabase.from('logistics_warehouse_receipts').delete().eq('id', receipt!.id);
    });

    it('should reject completePutaway from wrong state', async () => {
      // Create receipt in pending_putaway
      const { data: receipt } = await supabase
        .from('logistics_warehouse_receipts')
        .insert({
          tenant_id: TENANT_ID,
          po_number: 'PO-WRONGSTATE-' + Date.now(),
          vendor_id: vendorId,
          received_date: new Date().toISOString().split('T')[0],
          status: 'pending_putaway',
        })
        .select()
        .single();

      // Try to complete without submitting first
      const completeResult = await engine.completePutaway({
        tenant_id: TENANT_ID,
        receipt_id: receipt!.id,
        completed_by: USER_ID,
      });

      expect(completeResult.success).toBe(false);
      expect(completeResult.error?.code).toBe('INVALID_STATE_TRANSITION');

      // Cleanup
      await supabase.from('logistics_warehouse_receipts').delete().eq('id', receipt!.id);
    });

    it('should reject cross-tenant access', async () => {
      const createInput: CreateReceiptInput = {
        tenant_id: TENANT_ID,
        po_number: 'PO-TENANT-' + Date.now(),
        vendor_id: vendorId,
        received_date: new Date(),
        line_items: [
          {
            sku_id: sku1Id,
            expected_quantity: 10,
            actual_quantity: 10,
            uom: 'EA',
            target_bin_id: bin1Id,
          },
        ],
      };

      const createResult = await engine.createReceipt(createInput);
      expect(createResult.success).toBe(true);

      const receiptId = createResult.data!.receipt.id;

      // Try to access with different tenant service
      const wrongTenantService = new ReceiptService(supabase, 'wrong-tenant-id', USER_ID);
      const wrongEngine = new WarehouseEngine(supabase, 'wrong-tenant-id', USER_ID);

      const getResult = await wrongEngine.getReceipt({
        tenant_id: 'wrong-tenant-id',
        receipt_id: receiptId,
      });

      expect(getResult.success).toBe(false);
      // Either TENANT_MISMATCH or NOT_FOUND (RLS blocks cross-tenant)
      expect(['TENANT_MISMATCH', 'NOT_FOUND']).toContain(getResult.error?.code);
    });
  });

  describe('Health Check', () => {
    it('should report healthy status', async () => {
      const health = await engine.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
      expect(health.checks.database).toBe('ok');
      expect(health.checks.eventBus).toBe('ok');
    });
  });

  describe('Multi-Receipt Workflow', () => {
    it('should handle multiple concurrent receipts independently', async () => {
      // Create 3 receipts concurrently
      const receipts = await Promise.all([1, 2, 3].map(async (i) => {
        const result = await engine.createReceipt({
          tenant_id: TENANT_ID,
          po_number: `PO-MULTI-${Date.now()}-${i}`,
          vendor_id: vendorId,
          received_date: new Date(),
          line_items: [
            {
              sku_id: sku1Id,
              expected_quantity: 10 * i,
              actual_quantity: 10 * i,
              uom: 'EA',
              target_bin_id: bin1Id,
            },
          ],
        });
        return result.data!.receipt.id;
      }));

      expect(receipts).toHaveLength(3);
      console.log(`\n   Created ${receipts.length} receipts concurrently`);

      // Complete each independently
      for (const receiptId of receipts) {
        await engine.submitForPutaway({
          tenant_id: TENANT_ID,
          receipt_id: receiptId,
          submitted_by: USER_ID,
        });

        const completeResult = await engine.completePutaway({
          tenant_id: TENANT_ID,
          receipt_id: receiptId,
          completed_by: USER_ID,
        });

        expect(completeResult.success).toBe(true);
      }

      // Verify all completed
      const { data: completedReceipts } = await supabase
        .from('logistics_warehouse_receipts')
        .select('id, status')
        .in('id', receipts)
        .eq('tenant_id', TENANT_ID);

      expect(completedReceipts).toHaveLength(3);
      completedReceipts!.forEach(r => {
        expect(r.status).toBe('completed');
      });

      console.log(`   ✓ All ${receipts.length} receipts completed independently\n`);
    });
  });
});
