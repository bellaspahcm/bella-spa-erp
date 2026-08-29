/**
 * P1.2: Comprehensive R9 State Machine Tests
 * 
 * Tests ReceiptService state machine implementation:
 * - Valid transitions enforcement
 * - Invalid transition rejection
 * - Terminal state protection
 * - Idempotency behavior
 * - Concurrent update handling
 * 
 * @module platform/logistics/warehouse/__tests__
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ReceiptService } from '../receipt.service';
import {
  CreateReceiptInput,
  SubmitForPutawayInput,
  CompletePutawayInput,
  HoldReceiptInput,
  ReleaseHoldInput,
} from '../receipt.types';

describe('R9: Warehouse Receipt State Machine', () => {
  let supabase: SupabaseClient;
  let service: ReceiptService;
  
  const TENANT_ID = 'test-tenant-' + Date.now();
  const USER_ID = 'test-user-' + Date.now();
  
  let vendorId: string;
  let skuId: string;
  let binId: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    service = new ReceiptService(supabase, TENANT_ID, USER_ID);

    // Create test fixtures
    const { data: vendor } = await supabase
      .from('logistics_warehouse_vendors')
      .insert({
        tenant_id: TENANT_ID,
        vendor_code: 'VENDOR-TEST-' + Date.now(),
        vendor_name: 'Test Vendor',
      })
      .select()
      .single();
    vendorId = vendor!.id;

    const { data: sku } = await supabase
      .from('logistics_warehouse_skus')
      .insert({
        tenant_id: TENANT_ID,
        sku_code: 'SKU-TEST-' + Date.now(),
        description: 'Test SKU',
        uom: 'EA',
        unit_cost: 10.00,
        status: 'active',
      })
      .select()
      .single();
    skuId = sku!.id;

    const { data: bin } = await supabase
      .from('logistics_warehouse_bins')
      .insert({
        tenant_id: TENANT_ID,
        bin_code: 'BIN-TEST-' + Date.now(),
        warehouse_id: 'WH-001',
        zone_id: 'ZONE-A',
        max_capacity: 1000,
        status: 'active',
      })
      .select()
      .single();
    binId = bin!.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('logistics_warehouse_bins').delete().eq('tenant_id', TENANT_ID);
    await supabase.from('logistics_warehouse_skus').delete().eq('tenant_id', TENANT_ID);
    await supabase.from('logistics_warehouse_vendors').delete().eq('tenant_id', TENANT_ID);
  });

  describe('AC9.1: Valid State Transitions', () => {
    it('should allow valid transition: pending_putaway → putaway_in_progress', async () => {
      // Create receipt in pending_putaway
      const createInput: CreateReceiptInput = {
        tenant_id: TENANT_ID,
        po_number: 'PO-VALID-1-' + Date.now(),
        vendor_id: vendorId,
        received_date: new Date(),
        line_items: [{
          sku_id: skuId,
          expected_quantity: 100,
          actual_quantity: 100,
          uom: 'EA',
          target_bin_id: binId,
        }],
      };

      const createResult = await service.createReceipt(createInput);
      expect(createResult.success).toBe(true);
      expect(createResult.data?.receipt.status).toBe('pending_putaway');

      const receiptId = createResult.data!.receipt.id;

      // Submit for putaway
      const submitInput: SubmitForPutawayInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        submitted_by: USER_ID,
      };

      const submitResult = await service.submitForPutaway(submitInput);
      expect(submitResult.success).toBe(true);
      expect(submitResult.data?.receipt.status).toBe('putaway_in_progress');
      expect(submitResult.data?.receipt.submitted_at).toBeDefined();
      expect(submitResult.data?.receipt.submitted_by).toBe(USER_ID);

      // Cleanup
      await supabase.from('logistics_warehouse_receipt_line_items').delete().eq('receipt_id', receiptId);
      await supabase.from('logistics_warehouse_receipts').delete().eq('id', receiptId);
    });

    it('should allow valid transition: putaway_in_progress → completed', async () => {
      // Create receipt in putaway_in_progress
      const { data: receipt } = await supabase
        .from('logistics_warehouse_receipts')
        .insert({
          tenant_id: TENANT_ID,
          po_number: 'PO-VALID-2-' + Date.now(),
          vendor_id: vendorId,
          received_date: new Date().toISOString().split('T')[0],
          status: 'putaway_in_progress',
          submitted_at: new Date().toISOString(),
          submitted_by: USER_ID,
        })
        .select()
        .single();

      const receiptId = receipt!.id;

      // Add line item
      await supabase.from('logistics_warehouse_receipt_line_items').insert({
        receipt_id: receiptId,
        tenant_id: TENANT_ID,
        sku_id: skuId,
        expected_quantity: 50,
        actual_quantity: 50,
        uom: 'EA',
        target_bin_id: binId,
        discrepancy_status: 'match',
      });

      // Complete putaway
      const completeInput: CompletePutawayInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        completed_by: USER_ID,
      };

      const completeResult = await service.completePutaway(completeInput);
      expect(completeResult.success).toBe(true);
      expect(completeResult.data?.receipt.status).toBe('completed');
      expect(completeResult.data?.receipt.completed_at).toBeDefined();
      expect(completeResult.data?.receipt.completed_by).toBe(USER_ID);

      // Cleanup
      await supabase.from('logistics_warehouse_inventory_on_hand').delete().eq('tenant_id', TENANT_ID);
      await supabase.from('logistics_warehouse_receipt_line_items').delete().eq('receipt_id', receiptId);
      await supabase.from('logistics_warehouse_receipts').delete().eq('id', receiptId);
    });

    it('should allow valid transition: pending_putaway → on_hold → pending_putaway', async () => {
      // Create receipt
      const { data: receipt } = await supabase
        .from('logistics_warehouse_receipts')
        .insert({
          tenant_id: TENANT_ID,
          po_number: 'PO-VALID-3-' + Date.now(),
          vendor_id: vendorId,
          received_date: new Date().toISOString().split('T')[0],
          status: 'pending_putaway',
        })
        .select()
        .single();

      const receiptId = receipt!.id;

      // Hold receipt
      const holdInput: HoldReceiptInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        held_by: USER_ID,
        hold_reason: 'quality_issue',
      };

      const holdResult = await service.holdReceipt(holdInput);
      expect(holdResult.success).toBe(true);
      expect(holdResult.data?.receipt.status).toBe('on_hold');
      expect(holdResult.data?.receipt.held_at).toBeDefined();
      expect(holdResult.data?.receipt.hold_reason).toBe('quality_issue');

      // Release hold
      const releaseInput: ReleaseHoldInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        released_by: USER_ID,
      };

      const releaseResult = await service.releaseHold(releaseInput);
      expect(releaseResult.success).toBe(true);
      expect(releaseResult.data?.receipt.status).toBe('pending_putaway');
      expect(releaseResult.data?.receipt.held_at).toBeNull();
      expect(releaseResult.data?.receipt.hold_reason).toBeNull();

      // Cleanup
      await supabase.from('logistics_warehouse_receipts').delete().eq('id', receiptId);
    });
  });

  describe('AC9.1: Invalid State Transitions', () => {
    it('should reject transition: pending_putaway → completed (skip putaway_in_progress)', async () => {
      // Create receipt in pending_putaway
      const { data: receipt } = await supabase
        .from('logistics_warehouse_receipts')
        .insert({
          tenant_id: TENANT_ID,
          po_number: 'PO-INVALID-1-' + Date.now(),
          vendor_id: vendorId,
          received_date: new Date().toISOString().split('T')[0],
          status: 'pending_putaway',
        })
        .select()
        .single();

      const receiptId = receipt!.id;

      // Try to complete directly (invalid)
      const completeInput: CompletePutawayInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        completed_by: USER_ID,
      };

      const completeResult = await service.completePutaway(completeInput);
      expect(completeResult.success).toBe(false);
      expect(completeResult.error?.code).toBe('INVALID_STATE_TRANSITION');

      // Verify status unchanged
      const { data: verify } = await supabase
        .from('logistics_warehouse_receipts')
        .select('status')
        .eq('id', receiptId)
        .single();
      expect(verify!.status).toBe('pending_putaway');

      // Cleanup
      await supabase.from('logistics_warehouse_receipts').delete().eq('id', receiptId);
    });

    it('should reject transition: completed → putaway_in_progress (terminal state)', async () => {
      // Create receipt in completed state
      const { data: receipt } = await supabase
        .from('logistics_warehouse_receipts')
        .insert({
          tenant_id: TENANT_ID,
          po_number: 'PO-INVALID-2-' + Date.now(),
          vendor_id: vendorId,
          received_date: new Date().toISOString().split('T')[0],
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: USER_ID,
        })
        .select()
        .single();

      const receiptId = receipt!.id;

      // Try to submit for putaway (invalid - terminal state)
      const submitInput: SubmitForPutawayInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        submitted_by: USER_ID,
      };

      const submitResult = await service.submitForPutaway(submitInput);
      expect(submitResult.success).toBe(false);
      expect(submitResult.error?.code).toBe('INVALID_STATE_TRANSITION');

      // Verify status unchanged (terminal)
      const { data: verify } = await supabase
        .from('logistics_warehouse_receipts')
        .select('status')
        .eq('id', receiptId)
        .single();
      expect(verify!.status).toBe('completed');

      // Cleanup
      await supabase.from('logistics_warehouse_receipts').delete().eq('id', receiptId);
    });

    it('should reject transition: completed → on_hold (terminal state)', async () => {
      // Create receipt in completed state
      const { data: receipt } = await supabase
        .from('logistics_warehouse_receipts')
        .insert({
          tenant_id: TENANT_ID,
          po_number: 'PO-INVALID-3-' + Date.now(),
          vendor_id: vendorId,
          received_date: new Date().toISOString().split('T')[0],
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: USER_ID,
        })
        .select()
        .single();

      const receiptId = receipt!.id;

      // Try to hold completed receipt (invalid)
      const holdInput: HoldReceiptInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        held_by: USER_ID,
        hold_reason: 'quality_issue',
      };

      const holdResult = await service.holdReceipt(holdInput);
      expect(holdResult.success).toBe(false);
      expect(holdResult.error?.code).toBe('INVALID_STATE_TRANSITION');

      // Verify status unchanged
      const { data: verify } = await supabase
        .from('logistics_warehouse_receipts')
        .select('status')
        .eq('id', receiptId)
        .single();
      expect(verify!.status).toBe('completed');

      // Cleanup
      await supabase.from('logistics_warehouse_receipts').delete().eq('id', receiptId);
    });
  });

  describe('AC9.3: Idempotency', () => {
    it('should be idempotent when completing already-completed receipt', async () => {
      // Create receipt in completed state
      const completedAt = new Date().toISOString();
      const { data: receipt } = await supabase
        .from('logistics_warehouse_receipts')
        .insert({
          tenant_id: TENANT_ID,
          po_number: 'PO-IDEM-1-' + Date.now(),
          vendor_id: vendorId,
          received_date: new Date().toISOString().split('T')[0],
          status: 'completed',
          completed_at: completedAt,
          completed_by: USER_ID,
        })
        .select()
        .single();

      const receiptId = receipt!.id;

      // Try to complete again
      const completeInput: CompletePutawayInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        completed_by: USER_ID,
      };

      const completeResult = await service.completePutaway(completeInput);
      
      // Idempotent: should either succeed with unchanged state or reject gracefully
      if (completeResult.success) {
        expect(completeResult.data?.receipt.status).toBe('completed');
        expect(completeResult.data?.receipt.completed_at).toBe(completedAt);
      } else {
        expect(completeResult.error?.code).toBe('INVALID_STATE_TRANSITION');
      }

      // Verify completed_at timestamp unchanged
      const { data: verify } = await supabase
        .from('logistics_warehouse_receipts')
        .select('status, completed_at')
        .eq('id', receiptId)
        .single();
      
      expect(verify!.status).toBe('completed');
      expect(verify!.completed_at).toBe(completedAt);

      // Cleanup
      await supabase.from('logistics_warehouse_receipts').delete().eq('id', receiptId);
    });
  });

  describe('AC9.4: Optimistic Locking', () => {
    it('should use optimistic locking to prevent concurrent state changes', async () => {
      // Create receipt
      const { data: receipt } = await supabase
        .from('logistics_warehouse_receipts')
        .insert({
          tenant_id: TENANT_ID,
          po_number: 'PO-LOCK-1-' + Date.now(),
          vendor_id: vendorId,
          received_date: new Date().toISOString().split('T')[0],
          status: 'pending_putaway',
        })
        .select()
        .single();

      const receiptId = receipt!.id;

      // Add line item with bin assigned
      await supabase.from('logistics_warehouse_receipt_line_items').insert({
        receipt_id: receiptId,
        tenant_id: TENANT_ID,
        sku_id: skuId,
        expected_quantity: 100,
        actual_quantity: 100,
        uom: 'EA',
        target_bin_id: binId,
        discrepancy_status: 'match',
      });

      // Simulate concurrent update: manually change status
      await supabase
        .from('logistics_warehouse_receipts')
        .update({ status: 'on_hold' })
        .eq('id', receiptId);

      // Try to submit for putaway (should fail - optimistic lock)
      const submitInput: SubmitForPutawayInput = {
        tenant_id: TENANT_ID,
        receipt_id: receiptId,
        submitted_by: USER_ID,
      };

      const submitResult = await service.submitForPutaway(submitInput);
      expect(submitResult.success).toBe(false);
      expect(submitResult.error?.code).toBe('INVALID_STATE_TRANSITION');

      // Cleanup
      await supabase.from('logistics_warehouse_receipt_line_items').delete().eq('receipt_id', receiptId);
      await supabase.from('logistics_warehouse_receipts').delete().eq('id', receiptId);
    });
  });

  describe('Terminal State Protection', () => {
    it('should protect completed state from any transition', async () => {
      // Create completed receipt
      const { data: receipt } = await supabase
        .from('logistics_warehouse_receipts')
        .insert({
          tenant_id: TENANT_ID,
          po_number: 'PO-TERM-1-' + Date.now(),
          vendor_id: vendorId,
          received_date: new Date().toISOString().split('T')[0],
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: USER_ID,
        })
        .select()
        .single();

      const receiptId = receipt!.id;

      // Verify isValidTransition rejects all transitions from completed
      const service2 = new ReceiptService(supabase, TENANT_ID, USER_ID);
      
      // Access private method via any cast for testing
      const isValidTransition = (service2 as any).isValidTransition.bind(service2);

      expect(isValidTransition('completed', 'pending_putaway').valid).toBe(false);
      expect(isValidTransition('completed', 'putaway_in_progress').valid).toBe(false);
      expect(isValidTransition('completed', 'on_hold').valid).toBe(false);
      expect(isValidTransition('completed', 'completed').valid).toBe(true); // idempotent

      // Cleanup
      await supabase.from('logistics_warehouse_receipts').delete().eq('id', receiptId);
    });
  });
});
