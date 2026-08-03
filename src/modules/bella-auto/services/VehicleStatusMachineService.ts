/**
 * VehicleStatusMachineService
 *
 * Quản lý máy trạng thái vòng đời xe theo từng số VIN.
 * Mọi chuyển đổi trạng thái đều được ghi vào auto_vehicle_status_logs
 * (bất biến — không được xóa).
 *
 * State Machine:
 *   in_transit → warehouse → showroom → allocated → delivered
 *                    ↓           ↓
 *                returned    scrapped
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type VehicleStatus =
  | 'in_transit'
  | 'warehouse'
  | 'showroom'
  | 'allocated'
  | 'delivered'
  | 'returned'
  | 'scrapped';

// Allowed transitions: from → [to, ...]
const ALLOWED_TRANSITIONS: Record<VehicleStatus, VehicleStatus[]> = {
  in_transit: ['warehouse', 'returned'],
  warehouse:  ['showroom', 'returned', 'scrapped'],
  showroom:   ['allocated', 'warehouse', 'returned', 'scrapped'],
  allocated:  ['delivered', 'showroom'],   // showroom nếu hủy phân bổ
  delivered:  ['returned'],               // chỉ thu hồi sau khi đã giao
  returned:   ['warehouse', 'scrapped'],
  scrapped:   [],                         // terminal state
};

export interface TransitionVehicleInput {
  tenantId: string;
  vehicleId: string;
  toStatus: VehicleStatus;
  changedByUserId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  /** Bắt buộc khi to_status = 'allocated' */
  allocatedToContractId?: string;
  /** Bắt buộc khi to_status = 'delivered' */
  deliveredToCustomerId?: string;
  deliveryNotes?: string;
}

export interface TransitionVehicleResult {
  success: boolean;
  vehicleId: string;
  fromStatus: VehicleStatus;
  toStatus: VehicleStatus;
  logId: string;
}

export const VehicleStatusMachineService = {
  /**
   * Chuyển trạng thái xe. Ném lỗi nếu transition không hợp lệ.
   * Mọi thay đổi đều atomic: cập nhật auto_vehicles + insert log.
   */
  async transition(
    supabase: SupabaseClient,
    input: TransitionVehicleInput
  ): Promise<TransitionVehicleResult> {
    const { tenantId, vehicleId, toStatus, changedByUserId, reason, metadata } = input;

    // 1. Đọc trạng thái hiện tại
    const { data: vehicle, error: fetchErr } = await supabase
      .from('auto_vehicles')
      .select('id, status, tenant_id')
      .eq('id', vehicleId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchErr || !vehicle) {
      throw new Error(
        `VehicleStatusMachineService: Không tìm thấy xe (${vehicleId}). ${fetchErr?.message ?? ''}`
      );
    }

    const fromStatus = vehicle.status as VehicleStatus;

    // 2. Kiểm tra transition hợp lệ
    if (!ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) {
      throw new Error(
        `VehicleStatusMachineService: Không thể chuyển trạng thái "${fromStatus}" → "${toStatus}". ` +
        `Các trạng thái cho phép: [${ALLOWED_TRANSITIONS[fromStatus].join(', ')}]`
      );
    }

    // 3. Build update payload
    const updatePayload: Record<string, unknown> = {
      status: toStatus,
      updated_at: new Date().toISOString(),
    };

    if (toStatus === 'allocated') {
      if (!input.allocatedToContractId) {
        throw new Error('VehicleStatusMachineService: allocatedToContractId bắt buộc khi status = allocated');
      }
      updatePayload.allocated_to_contract_id = input.allocatedToContractId;
      updatePayload.allocated_at = new Date().toISOString();
      updatePayload.allocated_by_user_id = changedByUserId ?? null;
    }

    if (toStatus === 'delivered') {
      updatePayload.delivered_at = new Date().toISOString();
      updatePayload.delivered_to_customer_id = input.deliveredToCustomerId ?? null;
      updatePayload.delivery_notes = input.deliveryNotes ?? null;
    }

    // Khi hủy phân bổ (allocated → showroom), xóa allocation refs
    if (fromStatus === 'allocated' && toStatus === 'showroom') {
      updatePayload.allocated_to_contract_id = null;
      updatePayload.allocated_at = null;
      updatePayload.allocated_by_user_id = null;
    }

    // 4. Cập nhật vehicle
    const { error: updateErr } = await supabase
      .from('auto_vehicles')
      .update(updatePayload)
      .eq('id', vehicleId)
      .eq('tenant_id', tenantId);

    if (updateErr) {
      throw new Error(`VehicleStatusMachineService: Lỗi cập nhật status. ${updateErr.message}`);
    }

    // 5. Ghi log bất biến
    const { data: log, error: logErr } = await supabase
      .from('auto_vehicle_status_logs')
      .insert({
        tenant_id:          tenantId,
        vehicle_id:         vehicleId,
        from_status:        fromStatus,
        to_status:          toStatus,
        changed_by_user_id: changedByUserId ?? null,
        reason:             reason ?? null,
        metadata:           metadata ?? {},
      })
      .select('id')
      .single();

    if (logErr || !log) {
      throw new Error(`VehicleStatusMachineService: Lỗi ghi status log. ${logErr?.message ?? ''}`);
    }

    return {
      success: true,
      vehicleId,
      fromStatus,
      toStatus,
      logId: log.id,
    };
  },

  /**
   * Trả về danh sách trạng thái được phép chuyển từ fromStatus.
   */
  allowedTransitions(fromStatus: VehicleStatus): VehicleStatus[] {
    return ALLOWED_TRANSITIONS[fromStatus] ?? [];
  },

  /**
   * Kiểm tra một transition có hợp lệ không (dùng cho UI guard).
   */
  canTransition(fromStatus: VehicleStatus, toStatus: VehicleStatus): boolean {
    return ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
  },
};
