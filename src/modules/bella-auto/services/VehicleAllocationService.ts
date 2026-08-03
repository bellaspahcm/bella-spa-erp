/**
 * VehicleAllocationService
 *
 * Phân bổ số VIN cụ thể vào một hợp đồng đặt cọc.
 * Đảm bảo một VIN chỉ được phân bổ cho một hợp đồng tại một thời điểm.
 * Tích hợp VehicleStatusMachineService để chuyển status → 'allocated'.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { VehicleStatusMachineService } from './VehicleStatusMachineService';

export interface AllocateVehicleInput {
  tenantId: string;
  vehicleId: string;
  contractId: string;        // auto_bookings.id (Phase 4)
  allocatedByUserId?: string;
  reason?: string;
}

export interface DeallocateVehicleInput {
  tenantId: string;
  vehicleId: string;
  reason?: string;
  deallocatedByUserId?: string;
}

export interface AllocationResult {
  success: boolean;
  vehicleId: string;
  contractId: string;
  allocatedAt: string;
}

export const VehicleAllocationService = {
  /**
   * Phân bổ xe cho hợp đồng. Xe phải ở trạng thái 'warehouse' hoặc 'showroom'.
   * Sau khi phân bổ xe chuyển → 'allocated'.
   */
  async allocate(
    supabase: SupabaseClient,
    input: AllocateVehicleInput
  ): Promise<AllocationResult> {
    const { tenantId, vehicleId, contractId, allocatedByUserId, reason } = input;

    // Kiểm tra xe tồn tại và trạng thái hợp lệ
    const { data: vehicle, error: fetchErr } = await supabase
      .from('auto_vehicles')
      .select('id, status, allocated_to_contract_id')
      .eq('id', vehicleId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchErr || !vehicle) {
      throw new Error(`VehicleAllocationService.allocate: Xe không tồn tại (${vehicleId}).`);
    }

    if (vehicle.allocated_to_contract_id) {
      throw new Error(
        `VehicleAllocationService.allocate: Xe đã được phân bổ cho hợp đồng khác (${vehicle.allocated_to_contract_id}).`
      );
    }

    if (!['warehouse', 'showroom'].includes(vehicle.status)) {
      throw new Error(
        `VehicleAllocationService.allocate: Xe phải ở trạng thái 'warehouse' hoặc 'showroom' để phân bổ. ` +
        `Trạng thái hiện tại: ${vehicle.status}`
      );
    }

    // Chuyển trạng thái → allocated
    await VehicleStatusMachineService.transition(supabase, {
      tenantId,
      vehicleId,
      toStatus:             'allocated',
      changedByUserId:      allocatedByUserId,
      allocatedToContractId: contractId,
      reason:               reason ?? `Phân bổ cho hợp đồng ${contractId}`,
      metadata:             { contractId },
    });

    const allocatedAt = new Date().toISOString();

    return {
      success:     true,
      vehicleId,
      contractId,
      allocatedAt,
    };
  },

  /**
   * Hủy phân bổ xe (trả về showroom). Dùng khi hợp đồng bị hủy.
   */
  async deallocate(
    supabase: SupabaseClient,
    input: DeallocateVehicleInput
  ): Promise<{ success: boolean; vehicleId: string }> {
    const { tenantId, vehicleId, reason, deallocatedByUserId } = input;

    const { data: vehicle, error: fetchErr } = await supabase
      .from('auto_vehicles')
      .select('id, status')
      .eq('id', vehicleId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchErr || !vehicle) {
      throw new Error(`VehicleAllocationService.deallocate: Xe không tồn tại (${vehicleId}).`);
    }

    if (vehicle.status !== 'allocated') {
      throw new Error(
        `VehicleAllocationService.deallocate: Xe không ở trạng thái 'allocated' (hiện: ${vehicle.status}).`
      );
    }

    await VehicleStatusMachineService.transition(supabase, {
      tenantId,
      vehicleId,
      toStatus:        'showroom',
      changedByUserId: deallocatedByUserId,
      reason:          reason ?? 'Hủy phân bổ — trả về showroom',
    });

    return { success: true, vehicleId };
  },

  /**
   * Xác nhận bàn giao xe (allocated → delivered).
   */
  async confirmDelivery(
    supabase: SupabaseClient,
    input: {
      tenantId: string;
      vehicleId: string;
      customerId: string;
      deliveryNotes?: string;
      confirmedByUserId?: string;
    }
  ): Promise<{ success: boolean; vehicleId: string; deliveredAt: string }> {
    const { tenantId, vehicleId, customerId, deliveryNotes, confirmedByUserId } = input;

    await VehicleStatusMachineService.transition(supabase, {
      tenantId,
      vehicleId,
      toStatus:              'delivered',
      changedByUserId:       confirmedByUserId,
      deliveredToCustomerId: customerId,
      deliveryNotes,
      reason:                `Bàn giao xe cho khách hàng ${customerId}`,
      metadata:              { customerId },
    });

    return {
      success:     true,
      vehicleId,
      deliveredAt: new Date().toISOString(),
    };
  },

  /**
   * Tìm xe phù hợp để phân bổ cho một yêu cầu (theo variant + màu).
   */
  async findAvailableVehicle(
    supabase: SupabaseClient,
    tenantId: string,
    criteria: {
      variantId: string;
      colorExterior?: string;
      preferredStatus?: 'showroom' | 'warehouse';
    }
  ): Promise<{ id: string; vin: string; status: string } | null> {
    const preferredStatuses = criteria.preferredStatus
      ? [criteria.preferredStatus, criteria.preferredStatus === 'showroom' ? 'warehouse' : 'showroom']
      : ['showroom', 'warehouse'];

    let query = supabase
      .from('auto_vehicles')
      .select('id, vin, status')
      .eq('tenant_id', tenantId)
      .eq('variant_id', criteria.variantId)
      .in('status', preferredStatuses)
      .order('status', { ascending: false }) // showroom trước warehouse
      .limit(1);

    if (criteria.colorExterior) {
      query = query.ilike('color_exterior', `%${criteria.colorExterior}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`VehicleAllocationService.findAvailableVehicle: ${error.message}`);

    return data?.[0] ?? null;
  },
};
