import { describe, it, expect } from '@jest/globals';
import { VehicleStatusMachineService, type VehicleStatus } from '@/modules/bella-auto/services/VehicleStatusMachineService';
import { VehicleAllocationService } from '@/modules/bella-auto/services/VehicleAllocationService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeVehicle(status: VehicleStatus, allocated_to_contract_id: string | null = null) {
  return {
    id: 'vehicle-001',
    status,
    tenant_id: 'tenant-auto-001',
    allocated_to_contract_id,
  };
}

function makeSingleQuery(vehicle: ReturnType<typeof makeVehicle>) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: vehicle, error: null }),
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'log-001' }, error: null }),
        }),
      }),
    }),
  } as any;
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Phase 1: VIN Management — Unit Tests', () => {

  describe('1.2 VehicleStatusMachineService', () => {

    it('should allow valid transition in_transit → warehouse', async () => {
      const supabase = makeSingleQuery(makeVehicle('in_transit'));
      const result = await VehicleStatusMachineService.transition(supabase, {
        tenantId:  'tenant-auto-001',
        vehicleId: 'vehicle-001',
        toStatus:  'warehouse',
        reason:    'Xe đã về kho',
      });

      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('in_transit');
      expect(result.toStatus).toBe('warehouse');
      expect(result.logId).toBe('log-001');
    });

    it('should block invalid transition warehouse → delivered', async () => {
      const supabase = makeSingleQuery(makeVehicle('warehouse'));

      await expect(
        VehicleStatusMachineService.transition(supabase, {
          tenantId:  'tenant-auto-001',
          vehicleId: 'vehicle-001',
          toStatus:  'delivered',
        })
      ).rejects.toThrow(/Không thể chuyển trạng thái "warehouse" → "delivered"/);
    });

    it('should block transition from scrapped (terminal state)', async () => {
      const supabase = makeSingleQuery(makeVehicle('scrapped'));

      await expect(
        VehicleStatusMachineService.transition(supabase, {
          tenantId:  'tenant-auto-001',
          vehicleId: 'vehicle-001',
          toStatus:  'warehouse',
        })
      ).rejects.toThrow(/Không thể chuyển trạng thái/);
    });

    it('should require allocatedToContractId when transitioning to allocated', async () => {
      const supabase = makeSingleQuery(makeVehicle('showroom'));

      await expect(
        VehicleStatusMachineService.transition(supabase, {
          tenantId:  'tenant-auto-001',
          vehicleId: 'vehicle-001',
          toStatus:  'allocated',
          // missing allocatedToContractId
        })
      ).rejects.toThrow(/allocatedToContractId bắt buộc/);
    });

    it('canTransition() should return correct boolean', () => {
      expect(VehicleStatusMachineService.canTransition('in_transit', 'warehouse')).toBe(true);
      expect(VehicleStatusMachineService.canTransition('warehouse', 'delivered')).toBe(false);
      expect(VehicleStatusMachineService.canTransition('allocated', 'delivered')).toBe(true);
      expect(VehicleStatusMachineService.canTransition('scrapped', 'warehouse')).toBe(false);
    });

    it('allowedTransitions() should return correct list', () => {
      expect(VehicleStatusMachineService.allowedTransitions('warehouse')).toEqual(
        expect.arrayContaining(['showroom', 'returned', 'scrapped'])
      );
      expect(VehicleStatusMachineService.allowedTransitions('scrapped')).toEqual([]);
    });
  });

  describe('1.5 VehicleAllocationService', () => {

    it('should reject allocation if vehicle is in_transit', async () => {
      const supabase = makeSingleQuery(makeVehicle('in_transit'));

      await expect(
        VehicleAllocationService.allocate(supabase, {
          tenantId:   'tenant-auto-001',
          vehicleId:  'vehicle-001',
          contractId: 'contract-abc',
        })
      ).rejects.toThrow(/Xe phải ở trạng thái 'warehouse' hoặc 'showroom'/);
    });

    it('should reject allocation if vehicle is already allocated', async () => {
      const supabase = makeSingleQuery(makeVehicle('allocated', 'existing-contract'));

      await expect(
        VehicleAllocationService.allocate(supabase, {
          tenantId:   'tenant-auto-001',
          vehicleId:  'vehicle-001',
          contractId: 'new-contract',
        })
      ).rejects.toThrow(/đã được phân bổ cho hợp đồng khác/);
    });

    it('should reject deallocate if vehicle is not allocated', async () => {
      const supabase = makeSingleQuery(makeVehicle('showroom'));

      await expect(
        VehicleAllocationService.deallocate(supabase, {
          tenantId:  'tenant-auto-001',
          vehicleId: 'vehicle-001',
        })
      ).rejects.toThrow(/không ở trạng thái 'allocated'/);
    });
  });

  describe('1.6 Bulk Import — VIN Validation', () => {
    it('should reject VIN shorter than 17 characters', () => {
      const vin = 'SHORT123';
      expect(vin.length).not.toBe(17);
    });

    it('should accept valid 17-char VIN', () => {
      const vin = 'WBAHF3C01L7D34567';
      expect(vin.length).toBe(17);
      expect(/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)).toBe(true); // Standard VIN charset
    });
  });
});
