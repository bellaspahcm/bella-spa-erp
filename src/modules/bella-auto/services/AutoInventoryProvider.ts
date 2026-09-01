/**
 * AutoInventoryProvider
 *
 * Provider chuyên biệt cho ngành ô tô. Cung cấp thống kê tồn kho xe
 * theo status, variant, và showroom. Tích hợp với VehicleStatusMachineService
 * để thực hiện nhập/xuất/điều chuyển xe.
 *
 * Kiến trúc: Provider-based, stateless, không truy cập DB trực tiếp
 * ngoài constructor injection của SupabaseClient.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  VehicleStatusMachineService,
  type VehicleStatus,
  type TransitionVehicleInput,
} from './VehicleStatusMachineService';

export interface VehicleInventorySummary {
  totalVehicles: number;
  byStatus: Record<VehicleStatus, number>;
  availableForSale: number; // warehouse + showroom
  allocated: number;
  inTransit: number;
  deliveredThisMonth: number;
}

export interface VehicleInventoryItem {
  id: string;
  vin: string;
  chassisNumber: string | null;
  engineNumber: string | null;
  colorExterior: string;
  colorInterior: string | null;
  modelYear: number;
  listPrice: number;
  costPrice: number;
  status: VehicleStatus;
  locationNote: string | null;
  expectedArrivalDate: string | null;
  actualArrivalDate: string | null;
  variantId: string;
  variantName?: string;
  modelName?: string;
  brandName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddVehicleInput {
  tenantId: string;
  variantId: string;
  vin: string;
  chassisNumber?: string;
  engineNumber?: string;
  colorExterior: string;
  colorInterior?: string;
  modelYear: number;
  listPrice: number;
  costPrice?: number;
  locationNote?: string;
  expectedArrivalDate?: string;
  importDeclarationNumber?: string;
  metadata?: Record<string, unknown>;
}

export const AutoInventoryProvider = {
  /**
   * Lấy tổng quan tồn kho của tenant.
   */
  async getSummary(
    supabase: SupabaseClient,
    tenantId: string
  ): Promise<VehicleInventorySummary> {
    const { data, error } = await supabase
      .from('auto_vehicles')
      .select('status, delivered_at')
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`AutoInventoryProvider.getSummary: ${error.message}`);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const byStatus: Record<VehicleStatus, number> = {
      in_transit: 0,
      warehouse:  0,
      showroom:   0,
      allocated:  0,
      delivered:  0,
      returned:   0,
      scrapped:   0,
    };

    let deliveredThisMonth = 0;

    for (const row of data ?? []) {
      byStatus[row.status as VehicleStatus] = (byStatus[row.status as VehicleStatus] ?? 0) + 1;

      if (
        row.status === 'delivered' &&
        row.delivered_at &&
        row.delivered_at >= startOfMonth
      ) {
        deliveredThisMonth++;
      }
    }

    return {
      totalVehicles:   (data ?? []).length,
      byStatus,
      availableForSale: byStatus.warehouse + byStatus.showroom,
      allocated:        byStatus.allocated,
      inTransit:        byStatus.in_transit,
      deliveredThisMonth,
    };
  },

  /**
   * Danh sách xe có filter và join catalog.
   */
  async listVehicles(
    supabase: SupabaseClient,
    tenantId: string,
    filters?: {
      status?: VehicleStatus;
      variantId?: string;
      search?: string;
    }
  ): Promise<VehicleInventoryItem[]> {
    let query = supabase
      .from('auto_vehicles')
      .select(`
        id, vin, chassis_number, engine_number,
        color_exterior, color_interior, model_year,
        list_price, cost_price, status, location_note,
        expected_arrival_date, actual_arrival_date,
        variant_id, created_at, updated_at,
        auto_variants!inner(name, model_id,
          auto_models!inner(name, brand_id,
            auto_brands!inner(name)
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.variantId) query = query.eq('variant_id', filters.variantId);
    if (filters?.search) {
      query = query.or(
        `vin.ilike.%${filters.search}%,color_exterior.ilike.%${filters.search}%`
      );
    }

    type VehicleRow = {
      id: string;
      vin: string;
      chassis_number: string | null;
      engine_number: string | null;
      color_exterior: string;
      color_interior: string | null;
      model_year: number;
      list_price: number;
      cost_price: number;
      status: string;
      location_note: string | null;
      expected_arrival_date: string | null;
      actual_arrival_date: string | null;
      variant_id: string;
      created_at: string;
      updated_at: string;
      auto_variants: {
        name: string;
        auto_models: {
          name: string;
          auto_brands: {
            name: string;
          };
        };
      };
    };

    const { data, error } = await query.returns<VehicleRow[]>();
    if (error) throw new Error(`AutoInventoryProvider.listVehicles: ${error.message}`);

    return (data ?? []).map((row) => ({
      id:                  row.id,
      vin:                 row.vin,
      chassisNumber:       row.chassis_number,
      engineNumber:        row.engine_number,
      colorExterior:       row.color_exterior,
      colorInterior:       row.color_interior,
      modelYear:           row.model_year,
      listPrice:           Number(row.list_price),
      costPrice:           Number(row.cost_price),
      status:              row.status as VehicleStatus,
      locationNote:        row.location_note,
      expectedArrivalDate: row.expected_arrival_date,
      actualArrivalDate:   row.actual_arrival_date,
      variantId:           row.variant_id,
      variantName:         row.auto_variants?.name,
      modelName:           row.auto_variants?.auto_models?.name,
      brandName:           row.auto_variants?.auto_models?.auto_brands?.name,
      createdAt:           row.created_at,
      updatedAt:           row.updated_at,
    }));
  },

  /**
   * Thêm xe mới vào kho (status khởi đầu = 'in_transit').
   */
  async addVehicle(
    supabase: SupabaseClient,
    input: AddVehicleInput
  ): Promise<{ id: string; vin: string }> {
    const { data, error } = await supabase
      .from('auto_vehicles')
      .insert({
        tenant_id:                input.tenantId,
        variant_id:               input.variantId,
        vin:                      input.vin.toUpperCase(),
        chassis_number:           input.chassisNumber ?? null,
        engine_number:            input.engineNumber ?? null,
        color_exterior:           input.colorExterior,
        color_interior:           input.colorInterior ?? null,
        model_year:               input.modelYear,
        list_price:               input.listPrice,
        cost_price:               input.costPrice ?? 0,
        status:                   'in_transit',
        location_note:            input.locationNote ?? null,
        expected_arrival_date:    input.expectedArrivalDate ?? null,
        import_declaration_number: input.importDeclarationNumber ?? null,
        metadata:                 input.metadata ?? {},
      })
      .select('id, vin')
      .single();

    if (error) throw new Error(`AutoInventoryProvider.addVehicle: ${error.message}`);
    return { id: data.id, vin: data.vin };
  },

  /**
   * Chuyển trạng thái xe — delegate sang VehicleStatusMachineService.
   */
  async transition(
    supabase: SupabaseClient,
    input: TransitionVehicleInput
  ) {
    return VehicleStatusMachineService.transition(supabase, input);
  },

  /**
   * Lấy lịch sử trạng thái của một xe.
   */
  async getStatusHistory(
    supabase: SupabaseClient,
    tenantId: string,
    vehicleId: string
  ) {
    const { data, error } = await supabase
      .from('auto_vehicle_status_logs')
      .select('id, from_status, to_status, reason, created_at, changed_by_user_id')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`AutoInventoryProvider.getStatusHistory: ${error.message}`);
    return data ?? [];
  },
};
