/**
 * AutoCustomerProvider
 *
 * Provider thực hiện việc đọc, tổng hợp hồ sơ mở rộng (Customer 360) 
 * phục vụ cho ngành công nghiệp Automotive.
 * Cho phép thiết lập thông tin sở thích, quản lý xe đang sở hữu và lịch sử sở hữu.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';

type VehicleRow = Database['public']['Tables']['auto_vehicles']['Row'];
type VariantRow = Database['public']['Tables']['auto_variants']['Row'];
type ModelRow = Database['public']['Tables']['auto_models']['Row'];
type BrandRow = Database['public']['Tables']['auto_brands']['Row'];

export interface AutoCustomerProfile {
  customerId: string;
  preferredBrands: string[];
  preferredSegments: string[];
  budgetRange: string | null;
  purchasingPurpose: string | null;
  totalVehiclesOwned: number;
  totalValueSpent: number;
  metadata?: Json;
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
    supabase: SupabaseClient<Database>,
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
      .select('id, vehicle_id, ownership_type, license_plate, registration_date, is_active, transferred_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId);

    if (ownersErr) {
      throw new Error(`AutoCustomerProvider.getOwnedVehicles: ${ownersErr.message}`);
    }

    const vehicleIds = [...new Set((ownersData ?? []).map(row => row.vehicle_id))];
    const { data: vehiclesData, error: vehiclesErr } = vehicleIds.length > 0
      ? await supabase
        .from('auto_vehicles')
        .select('id, vin, color_exterior, model_year, variant_id')
        .eq('tenant_id', tenantId)
        .in('id', vehicleIds)
      : { data: [] as Pick<VehicleRow, 'id' | 'vin' | 'color_exterior' | 'model_year' | 'variant_id'>[], error: null };

    if (vehiclesErr) {
      throw new Error(`AutoCustomerProvider.getOwnedVehicles: ${vehiclesErr.message}`);
    }

    const variantIds = [...new Set((vehiclesData ?? []).map(row => row.variant_id))];
    const { data: variantsData, error: variantsErr } = variantIds.length > 0
      ? await supabase
        .from('auto_variants')
        .select('id, name, model_id')
        .eq('tenant_id', tenantId)
        .in('id', variantIds)
      : { data: [] as Pick<VariantRow, 'id' | 'name' | 'model_id'>[], error: null };

    if (variantsErr) {
      throw new Error(`AutoCustomerProvider.getOwnedVehicles: ${variantsErr.message}`);
    }

    const modelIds = [...new Set((variantsData ?? []).map(row => row.model_id))];
    const { data: modelsData, error: modelsErr } = modelIds.length > 0
      ? await supabase
        .from('auto_models')
        .select('id, name, brand_id')
        .eq('tenant_id', tenantId)
        .in('id', modelIds)
      : { data: [] as Pick<ModelRow, 'id' | 'name' | 'brand_id'>[], error: null };

    if (modelsErr) {
      throw new Error(`AutoCustomerProvider.getOwnedVehicles: ${modelsErr.message}`);
    }

    const brandIds = [...new Set((modelsData ?? []).map(row => row.brand_id))];
    const { data: brandsData, error: brandsErr } = brandIds.length > 0
      ? await supabase
        .from('auto_brands')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .in('id', brandIds)
      : { data: [] as Pick<BrandRow, 'id' | 'name'>[], error: null };

    if (brandsErr) {
      throw new Error(`AutoCustomerProvider.getOwnedVehicles: ${brandsErr.message}`);
    }

    const vehiclesById = new Map((vehiclesData ?? []).map(vehicle => [vehicle.id, vehicle]));
    const variantsById = new Map((variantsData ?? []).map(variant => [variant.id, variant]));
    const modelsById = new Map((modelsData ?? []).map(model => [model.id, model]));
    const brandsById = new Map((brandsData ?? []).map(brand => [brand.id, brand]));

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

    const ownedVehicles: OwnedVehicle[] = (ownersData ?? []).flatMap(row => {
      const vehicle = vehiclesById.get(row.vehicle_id);
      if (!vehicle) return [];

      const variant = variantsById.get(vehicle.variant_id);
      const model = variant ? modelsById.get(variant.model_id) : undefined;
      const brand = model ? brandsById.get(model.brand_id) : undefined;

      return [{
        ownerRecordId:    row.id,
        vehicleId:        vehicle.id,
        vin:              vehicle.vin,
        colorExterior:    vehicle.color_exterior,
        modelYear:        vehicle.model_year,
        variantName:      variant?.name,
        modelName:        model?.name,
        brandName:        brand?.name,
        ownershipType:    row.ownership_type,
        licensePlate:     row.license_plate,
        registrationDate: row.registration_date,
        isActive:         row.is_active,
        transferredAt:    row.transferred_at,
      }];
    });

    return { profile, ownedVehicles };
  },

  /**
   * Lưu hoặc Cập nhật profile Automotive của Khách hàng
   */
  async upsertProfile(
    supabase: SupabaseClient<Database>,
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
    supabase: SupabaseClient<Database>,
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
    supabase: SupabaseClient<Database>,
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
    supabase: SupabaseClient<Database>,
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
    const { data: activeOwners, error: activeOwnersErr } = await supabase
      .from('auto_vehicle_owners')
      .select('vehicle_id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('is_active', true);

    if (activeOwnersErr) return;

    const activeVehicleIds = [...new Set((activeOwners ?? []).map(row => row.vehicle_id))];
    const { data: priceData, error: priceErr } = activeVehicleIds.length > 0
      ? await supabase
        .from('auto_vehicles')
        .select('list_price')
        .eq('tenant_id', tenantId)
        .in('id', activeVehicleIds)
      : { data: [] as Pick<VehicleRow, 'list_price'>[], error: null };

    if (priceErr) return;

    const totalValueSpent = (priceData ?? []).reduce((acc: number, row) => (
      acc + Number(row.list_price)
    ), 0);

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
