/**
 * P1.3: R13-R15 Service Path Verification Tests
 * 
 * Rewrites R13-R15 tests to use actual ReceiptService methods
 * instead of direct database manipulation.
 * 
 * Tests:
 * - R13: createBulkMovements via service
 * - R14: getInventoryValue via service
 * - R15: checkBinCapacity via service
 * 
 * @module platform/logistics/warehouse/__tests__
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ReceiptService } from '../receipt.service';
import {
  BulkInventoryMovementInput,
  GetInventoryValueInput,
  CheckBinCapacityInput,
} from '../receipt.types';

describe('R13-R15: Service Path Verification', () => {
  let supabase: SupabaseClient;
  let service: ReceiptService;
  
  const TENANT_ID = 'test-tenant-' + Date.now();
  const USER_ID = 'test-user-' + Date.now();
  
  let sku1Id: string;
  let sku2Id: string;
  let bin1Id: string;
  let bin2Id: string;
  let bin3Id: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    service = new ReceiptService(supabase, TENANT_ID, USER_ID);

    // Create test SKUs
    const { data: sku1 } = await supabase
      .from('logistics_warehouse_skus')
      .insert({
        tenant_id: TENANT_ID,
        sku_code: 'SKU-SVC-' + Date.now() + '-1',
        description: 'Service Path Test SKU 1',
        uom: 'EA',
        unit_cost: 12.50,
        status: 'active',
      })
      .select()
      .single();
    sku1Id = sku1!.id;

    const { data: sku2 } = await supabase
      .from('logistics_warehouse_skus')
      .insert({
        tenant_id: TENANT_ID,
        sku_code: 'SKU-SVC-' + Date.now() + '-2',
        description: 'Service Path Test SKU 2',
        uom: 'EA',
        unit_cost: 25.99,
        status: 'active',
      })
      .select()
      .single();
    sku2Id = sku2!.id;

    // Create test bins
    const { data: bin1 } = await supabase
      .from('logistics_warehouse_bins')
      .insert({
        tenant_id: TENANT_ID,
        bin_code: 'BIN-SVC-' + Date.now() + '-1',
        warehouse_id: 'WH-001',
        zone_id: 'ZONE-A',
        max_capacity: 1000,
        status: 'active',
      })
      .select()
      .single();
    bin1Id = bin1!.id;

    const { data: bin2 } = await supabase
      .from('logistics_warehouse_bins')
      .insert({
        tenant_id: TENANT_ID,
        bin_code: 'BIN-SVC-' + Date.now() + '-2',
        warehouse_id: 'WH-001',
        zone_id: 'ZONE-A',
        max_capacity: 500,
        status: 'active',
      })
      .select()
      .single();
    bin2Id = bin2!.id;

    const { data: bin3 } = await supabase
      .from('logistics_warehouse_bins')
      .insert({
        tenant_id: TENANT_ID,
        bin_code: 'BIN-SVC-' + Date.now() + '-3',
        warehouse_id: 'WH-001',
        zone_id: 'ZONE-B',
        max_capacity: 2000,
        status: 'active',
      })
      .select()
      .single();
    bin3Id = bin3!.id;

    // Create initial inventory
    await supabase.from('logistics_warehouse_inventory_on_hand').insert([
      {
        tenant_id: TENANT_ID,
        sku_id: sku1Id,
        bin_id: bin1Id,
        quantity: 100,
      },
      {
        tenant_id: TENANT_ID,
        sku_id: sku1Id,
        bin_id: bin2Id,
        quantity: 50,
      },
      {
        tenant_id: TENANT_ID,
        sku_id: sku2Id,
        bin_id: bin1Id,
        quantity: 200,
      },
      {
        tenant_id: TENANT_ID,
        sku_id: sku2Id,
        bin_id: bin3Id,
        quantity: 75,
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup
    await supabase.from('logistics_warehouse_movements').delete().eq('tenant_id', TENANT_ID);
    await supabase.from('logistics_warehouse_inventory_on_hand').delete().eq('tenant_id', TENANT_ID);
    await supabase.from('logistics_warehouse_bins').delete().eq('tenant_id', TENANT_ID);
    await supabase.from('logistics_warehouse_skus').delete().eq('tenant_id', TENANT_ID);
  });

  describe('R13: Bulk Inventory Movements (Service Path)', () => {
    it('should create bulk cycle count adjustments via service', async () => {
      const input: BulkInventoryMovementInput = {
        tenant_id: TENANT_ID,
        movement_type: 'cycle_count_adjustment',
        movements: [
          {
            sku_id: sku1Id,
            to_bin_id: bin1Id,
            quantity: 5, // Adjustment delta
            reason: 'Cycle count - found 5 extra units',
          },
          {
            sku_id: sku2Id,
            to_bin_id: bin1Id,
            quantity: -10, // Adjustment delta (shrinkage)
            reason: 'Cycle count - 10 units missing',
          },
        ],
        approved_by: USER_ID,
      };

      const result = await service.createBulkMovements(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.movement_count).toBe(2);
      expect(result.data!.movements).toHaveLength(2);
      expect(result.data!.batch_id).toBeDefined();

      // Verify all movements have same batch_id
      const batchId = result.data!.batch_id;
      result.data!.movements.forEach(m => {
        expect(m.batch_id).toBe(batchId);
        expect(m.movement_type).toBe('cycle_count_adjustment');
        expect(m.approved_by).toBe(USER_ID);
      });

      // Verify inventory updated
      const { data: sku1Inv } = await supabase
        .from('logistics_warehouse_inventory_on_hand')
        .select('quantity')
        .eq('tenant_id', TENANT_ID)
        .eq('sku_id', sku1Id)
        .eq('bin_id', bin1Id)
        .single();
      
      expect(parseFloat(sku1Inv!.quantity)).toBe(105); // 100 + 5

      const { data: sku2Inv } = await supabase
        .from('logistics_warehouse_inventory_on_hand')
        .select('quantity')
        .eq('tenant_id', TENANT_ID)
        .eq('sku_id', sku2Id)
        .eq('bin_id', bin1Id)
        .single();
      
      expect(parseFloat(sku2Inv!.quantity)).toBe(190); // 200 - 10
    });

    it('should create inter-bin transfers via service', async () => {
      const input: BulkInventoryMovementInput = {
        tenant_id: TENANT_ID,
        movement_type: 'inter_bin_transfer',
        movements: [
          {
            sku_id: sku1Id,
            from_bin_id: bin1Id,
            to_bin_id: bin3Id,
            quantity: 20,
            reason: 'Rebalancing inventory',
          },
        ],
        approved_by: USER_ID,
      };

      const result = await service.createBulkMovements(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.movement_count).toBe(1);
      expect(result.data!.movements[0].from_bin_id).toBe(bin1Id);
      expect(result.data!.movements[0].to_bin_id).toBe(bin3Id);

      // Verify inventory transferred
      const { data: fromBin } = await supabase
        .from('logistics_warehouse_inventory_on_hand')
        .select('quantity')
        .eq('tenant_id', TENANT_ID)
        .eq('sku_id', sku1Id)
        .eq('bin_id', bin1Id)
        .single();
      
      expect(parseFloat(fromBin!.quantity)).toBe(85); // 105 - 20

      const { data: toBin } = await supabase
        .from('logistics_warehouse_inventory_on_hand')
        .select('quantity')
        .eq('tenant_id', TENANT_ID)
        .eq('sku_id', sku1Id)
        .eq('bin_id', bin3Id)
        .maybeSingle();
      
      expect(toBin).toBeDefined();
      expect(parseFloat(toBin!.quantity)).toBe(20);
    });

    it('should enforce atomicity - all movements or none', async () => {
      const input: BulkInventoryMovementInput = {
        tenant_id: TENANT_ID,
        movement_type: 'cycle_count_adjustment',
        movements: [
          {
            sku_id: sku1Id,
            to_bin_id: bin1Id,
            quantity: 10,
          },
          {
            sku_id: 'invalid-sku-id', // This will fail
            to_bin_id: bin1Id,
            quantity: 5,
          },
        ],
        approved_by: USER_ID,
      };

      const result = await service.createBulkMovements(input);

      // Should fail due to invalid SKU
      expect(result.success).toBe(false);

      // Verify no partial updates (atomicity)
      const { data: verify } = await supabase
        .from('logistics_warehouse_movements')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .eq('sku_id', sku1Id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Last movement should be from previous test, not this one
      if (verify) {
        expect(verify.quantity).not.toBe(10);
      }
    });
  });

  describe('R14: Inventory Value Aggregation (Service Path)', () => {
    it('should calculate inventory value via service', async () => {
      const input: GetInventoryValueInput = {
        tenant_id: TENANT_ID,
      };

      const result = await service.getInventoryValue(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.items).toBeDefined();
      expect(result.data!.items.length).toBeGreaterThan(0);

      // Find SKU1 and SKU2
      const sku1Item = result.data!.items.find(i => i.sku_id === sku1Id);
      const sku2Item = result.data!.items.find(i => i.sku_id === sku2Id);

      expect(sku1Item).toBeDefined();
      expect(sku2Item).toBeDefined();

      // Verify SKU1: ~165 units (85 in bin1, 50 in bin2, 20 in bin3) × $12.50
      expect(sku1Item!.unit_cost).toBe(12.50);
      expect(sku1Item!.on_hand_quantity).toBeGreaterThan(150);
      expect(sku1Item!.total_value).toBeGreaterThan(1800);

      // Verify SKU2: ~265 units (190 in bin1, 75 in bin3) × $25.99
      expect(sku2Item!.unit_cost).toBe(25.99);
      expect(sku2Item!.on_hand_quantity).toBeGreaterThan(260);
      expect(sku2Item!.total_value).toBeGreaterThan(6700);

      // Verify total_value aggregation
      const expectedTotal = result.data!.items.reduce((sum, i) => sum + i.total_value, 0);
      expect(result.data!.total_value).toBeCloseTo(expectedTotal, 2);
    });

    it('should aggregate across bins correctly', async () => {
      const input: GetInventoryValueInput = {
        tenant_id: TENANT_ID,
      };

      const result = await service.getInventoryValue(input);
      
      expect(result.success).toBe(true);

      const sku1Item = result.data!.items.find(i => i.sku_id === sku1Id);
      
      // SKU1 is spread across 3 bins, verify aggregation
      const { data: binInventory } = await supabase
        .from('logistics_warehouse_inventory_on_hand')
        .select('quantity')
        .eq('tenant_id', TENANT_ID)
        .eq('sku_id', sku1Id);

      const manualTotal = binInventory!.reduce((sum, b) => sum + parseFloat(b.quantity), 0);
      
      expect(sku1Item!.on_hand_quantity).toBe(manualTotal);
    });

    it('should maintain decimal precision in value calculations', async () => {
      const input: GetInventoryValueInput = {
        tenant_id: TENANT_ID,
      };

      const result = await service.getInventoryValue(input);
      
      expect(result.success).toBe(true);

      const sku2Item = result.data!.items.find(i => i.sku_id === sku2Id);
      
      // Verify: quantity × $25.99 with DECIMAL precision
      const expectedValue = sku2Item!.on_hand_quantity * 25.99;
      const diff = Math.abs(sku2Item!.total_value - expectedValue);
      
      expect(diff).toBeLessThan(0.01); // Within 1 cent precision
    });
  });

  describe('R15: Bin Capacity Check (Service Path)', () => {
    it('should accept quantity within capacity via service', async () => {
      // Bin2 has max_capacity=500, current ~50 units, available ~450
      const input: CheckBinCapacityInput = {
        tenant_id: TENANT_ID,
        bin_id: bin2Id,
        additional_quantity: 300,
      };

      const result = await service.checkBinCapacity(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.is_valid).toBe(true);
      expect(result.data!.max_capacity).toBe(500);
      expect(result.data!.current_quantity).toBeCloseTo(50, 0);
      expect(result.data!.available_capacity).toBeGreaterThan(400);
      expect(result.data!.error_message).toBeUndefined();
    });

    it('should reject quantity exceeding capacity via service', async () => {
      // Bin2 has ~450 available, try to add 500
      const input: CheckBinCapacityInput = {
        tenant_id: TENANT_ID,
        bin_id: bin2Id,
        additional_quantity: 500,
      };

      const result = await service.checkBinCapacity(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.is_valid).toBe(false);
      expect(result.data!.error_message).toBeDefined();
      expect(result.data!.error_message).toContain('capacity');
    });

    it('should accept exact capacity boundary via service', async () => {
      // Calculate exact available capacity
      const { data: binData } = await supabase
        .from('logistics_warehouse_bins')
        .select('max_capacity')
        .eq('id', bin2Id)
        .single();

      const { data: invData } = await supabase
        .from('logistics_warehouse_inventory_on_hand')
        .select('quantity')
        .eq('bin_id', bin2Id)
        .eq('tenant_id', TENANT_ID);

      const currentQty = invData!.reduce((sum, i) => sum + parseFloat(i.quantity), 0);
      const available = parseFloat(binData!.max_capacity) - currentQty;

      const input: CheckBinCapacityInput = {
        tenant_id: TENANT_ID,
        bin_id: bin2Id,
        additional_quantity: available,
      };

      const result = await service.checkBinCapacity(input);

      expect(result.success).toBe(true);
      expect(result.data!.is_valid).toBe(true);
    });

    it('should handle empty bin correctly via service', async () => {
      // Create empty bin
      const { data: emptyBin } = await supabase
        .from('logistics_warehouse_bins')
        .insert({
          tenant_id: TENANT_ID,
          bin_code: 'BIN-EMPTY-' + Date.now(),
          warehouse_id: 'WH-001',
          zone_id: 'ZONE-C',
          max_capacity: 800,
          status: 'active',
        })
        .select()
        .single();

      const input: CheckBinCapacityInput = {
        tenant_id: TENANT_ID,
        bin_id: emptyBin!.id,
        additional_quantity: 800,
      };

      const result = await service.checkBinCapacity(input);

      expect(result.success).toBe(true);
      expect(result.data!.current_quantity).toBe(0);
      expect(result.data!.available_capacity).toBe(800);
      expect(result.data!.is_valid).toBe(true);

      // Cleanup
      await supabase.from('logistics_warehouse_bins').delete().eq('id', emptyBin!.id);
    });
  });

  describe('Service Error Handling', () => {
    it('should reject tenant mismatch in bulk movements', async () => {
      const input: BulkInventoryMovementInput = {
        tenant_id: 'wrong-tenant-id',
        movement_type: 'cycle_count_adjustment',
        movements: [{ sku_id: sku1Id, to_bin_id: bin1Id, quantity: 10 }],
        approved_by: USER_ID,
      };

      const result = await service.createBulkMovements(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TENANT_MISMATCH');
    });

    it('should reject tenant mismatch in inventory value', async () => {
      const input: GetInventoryValueInput = {
        tenant_id: 'wrong-tenant-id',
      };

      const result = await service.getInventoryValue(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TENANT_MISMATCH');
    });

    it('should reject tenant mismatch in capacity check', async () => {
      const input: CheckBinCapacityInput = {
        tenant_id: 'wrong-tenant-id',
        bin_id: bin1Id,
        additional_quantity: 100,
      };

      const result = await service.checkBinCapacity(input);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TENANT_MISMATCH');
    });
  });
});
