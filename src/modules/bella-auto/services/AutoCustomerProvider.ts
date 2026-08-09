/**
 * AutoCustomerProvider
 *
 * Provider thực hiện việc đọc, tổng hợp hồ sơ mở rộng (Customer 360) 
 * phục vụ cho ngành công nghiệp Automotive.
 * Cho phép thiết lập thông tin sở thích, quản lý xe đang sở hữu và lịch sử sở hữu.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AutoCustomerProfile {
  customerId: string;
  preferredBrands: string[];
  preferredSegments: string[];
  budgetRange: string | null;
  purchasingPurpose: string | null;
  totalVehiclesOwned: number;
  totalValueSpent: number;
  metadata?: Record<string, unknown>;
}

export interface OwnedVehicle {
  ownerRecordId: string;
  vehicleId: string;
  vin: string;
  colorExterior: string;
  modelYear: number;
  variantName?: string;
  modelName?: string;
  brandName?: string;
  ownershipType: string;
  licensePlate: string | null;
  registrationDate: string | null;
  isActive: boolean;
  transferredAt: string | null;
}

export const AutoCustomerProvider = {
  /**
   * Lấy hồ sơ 360 độ mở rộng của Khách hàng, bao gồm sở thích và danh sách xe sở hữu.
   */
  async getProfile(
    supabase: SupabaseClient,
    tenantId: string,
    customerId: string
  ): Promise<{ profile: AutoCustomerProfile | null; ownedVehicles: OwnedVehicle[] }> {
    
    // 1. Đọc profile mở rộng
    const { data: profileData, error: profileErr } = await supabase
      .from('auto_customer_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (profileErr) {
      throw new Error(`AutoCustomerProvider.getProfile: ${profileErr.message}`);
    }

    // 2. Đọc danh sách xe sở hữu
    const { data: ownersData, error: ownersErr } = await supabase
      .from('auto_vehicle_owners')
      .select(`
        id, ownership_type, license_plate, registration_date, is_active, transferred_at,
        auto_vehicles!inner(
          id, vin, color_exterior, model_year,
          auto_variants!inner(
            name,
            auto_models!inner(
              name,
              auto_brands!inner(name)
            )
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId);

    if (ownersErr) {
      throw new Error(`AutoCustomerProvider.getOwnedVehicles: ${ownersErr.message}`);
    }

    const profile: AutoCustomerProfile | null = profileData ? {
      customerId:         profileData.customer_id,
      preferredBrands:    profileData.preferred_brands ?? [],
      preferredSegments:  profileData.preferred_segments ?? [],
      budgetRange:        profileData.budget_range,
      purchasingPurpose:  profileData.purchasing_purpose,
      totalVehiclesOwned: profileData.total_vehicles_owned,
      totalValueSpent:    Number(profileData.total_value_spent),
      metadata:           profileData.metadata,
    } : null;

    const ownedVehicles: OwnedVehicle[] = (ownersData ?? []).map((row: Record<string, unknown>) => ({
      ownerRecordId:    row.id,
      vehicleId:        row.auto_vehicles.id,
      vin:              row.auto_vehicles.vin,
      colorExterior:    row.auto_vehicles.color_exterior,
      modelYear:        row.auto_vehicles.model_year,
      variantName:      row.auto_vehicles.auto_variants?.name,
      modelName:        row.auto_vehicles.auto_variants?.auto_models?.name,
      brandName:        row.auto_vehicles.auto_variants?.auto_models?.auto_brands?.name,
      ownershipType:    row.ownership_type,
      licensePlate:     row.license_plate,
      registrationDate: row.registration_date,
      isActive:         row.is_active,
      transferredAt:    row.transferred_at,
    }));

    return { profile, ownedVehicles };
  },

  /**
   * Lưu hoặc Cập nhật profile Automotive của Khách hàng
   */
  async upsertProfile(
    supabase: SupabaseClient,
    tenantId: string,
    profile: Omit<AutoCustomerProfile, 'totalVehiclesOwned' | 'totalValueSpent'>
  ): Promise<void> {
    const { error } = await supabase
      .from('auto_customer_profiles')
      .upsert({
        tenant_id:          tenantId,
        customer_id:        profile.customerId,
        preferred_brands:   profile.preferredBrands,
        preferred_segments: profile.preferredSegments,
        budget_range:       profile.budgetRange,
        purchasing_purpose: profile.purchasingPurpose,
        metadata:           profile.metadata ?? {},
        updated_at:         new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,customer_id'
      });

    if (error) {
      throw new Error(`AutoCustomerProvider.upsertProfile: ${error.message}`);
    }
  },

  /**
   * Thêm quyền sở hữu xe cho khách hàng (Liên kết khách hàng - xe)
   */
  async addVehicleOwner(
    supabase: SupabaseClient,
    input: {
      tenantId: string;
      customerId: string;
      vehicleId: string;
      ownershipType?: string;
      licensePlate?: string;
      registrationDate?: string;
    }
  ): Promise<string> {
    const { data, error } = await supabase
      .from('auto_vehicle_owners')
      .insert({
        tenant_id:         input.tenantId,
        customer_id:       input.customerId,
        vehicle_id:        input.vehicleId,
        ownership_type:    input.ownershipType ?? 'primary',
        license_plate:     input.licensePlate ?? null,
        registration_date: input.registrationDate ?? null,
        is_active:         true,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`AutoCustomerProvider.addVehicleOwner: ${error.message}`);
    }

    // Trigger cập nhật thống kê hồ sơ khách hàng
    await this.recalculateProfileAggregates(supabase, input.tenantId, input.customerId);

    return data.id;
  },

  /**
   * Chuyển nhượng sở hữu xe (đánh dấu sở hữu không còn hoạt động nữa)
   */
  async transferOwnership(
    supabase: SupabaseClient,
    tenantId: string,
    ownerRecordId: string,
    notes?: string
  ): Promise<void> {
    // Tìm thông tin sở hữu cũ
    const { data: record, error: findErr } = await supabase
      .from('auto_vehicle_owners')
      .select('customer_id')
      .eq('id', ownerRecordId)
      .eq('tenant_id', tenantId)
      .single();

    if (findErr || !record) {
      throw new Error(`AutoCustomerProvider.transferOwnership: Không tìm thấy bản ghi sở hữu.`);
    }

    const { error } = await supabase
      .from('auto_vehicle_owners')
      .update({
        is_active:      false,
        transferred_at: new Date().toISOString(),
        transfer_notes: notes ?? 'Đã chuyển nhượng',
        updated_at:     new Date().toISOString(),
      })
      .eq('id', ownerRecordId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`AutoCustomerProvider.transferOwnership: ${error.message}`);
    }

    // Tính lại aggregates cho khách hàng cũ
    await this.recalculateProfileAggregates(supabase, tenantId, record.customer_id);
  },

  /**
   * Tự động tính toán lại aggregates trong auto_customer_profiles (Atomic helper)
   */
  async recalculateProfileAggregates(
    supabase: SupabaseClient,
    tenantId: string,
    customerId: string
  ): Promise<void> {
    // 1. Tính tổng số xe đang hoạt động
    const { count, error: countErr } = await supabase
      .from('auto_vehicle_owners')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('is_active', true);

    if (countErr) return;

    // 2. Tính tổng tiền chi (ví dụ lấy từ list_price các xe sở hữu)
    const { data: priceData, error: priceErr } = await supabase
      .from('auto_vehicle_owners')
      .select(`
        auto_vehicles (list_price)
      `)
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('is_active', true);

    if (priceErr) return;

    const totalValueSpent = (priceData ?? []).reduce((acc: number, row: Record<string, unknown>) => {
      return acc + (Number(row.auto_vehicles?.list_price) || 0);
    }, 0);

    // 3. Upsert vào bảng profiles
    await supabase
      .from('auto_customer_profiles')
      .upsert({
        tenant_id:             tenantId,
        customer_id:           customerId,
        total_vehicles_owned:  count ?? 0,
        total_value_spent:     totalValueSpent,
        updated_at:            new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,customer_id'
      });
  }
};
