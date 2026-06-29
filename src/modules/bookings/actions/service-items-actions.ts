'use server';

/**
 * Service Items Server Actions
 * 
 * CRUD operations for booking_service_items table
 * Includes commission calculation on create/update
 */

import { createClient } from '@/lib/supabase-server';
import { calculateServiceCommission } from '@/lib/business-rules/commission';
import { revalidatePath } from 'next/cache';
import {
  insertBookingServiceItem,
  getBookingServiceItem,
  updateBookingServiceItem,
  queryTenantCommissionConfig,
} from '@/lib/supabase-commission-queries';
import type { BookingServiceItem } from '@/types/commission-types';

export interface ServiceItemInput {
  bookingId: string;
  tenantId: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  ktvId: string | null;
  completedDate: string;
  overrideType: 'fixed' | 'percentage' | null;
  overrideValue: number | null;
}

export interface ServiceItemResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Create a new service item with commission calculation
 */
export async function createServiceItem(input: ServiceItemInput): Promise<ServiceItemResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate input
    if (!input.serviceName || input.quantity <= 0 || input.unitPrice < 0) {
      return { success: false, error: 'Dữ liệu không hợp lệ' };
    }

    // Calculate subtotal
    const subtotal = input.quantity * input.unitPrice;

    // Get tenant commission config
    const { data: commissionConfig } = await queryTenantCommissionConfig(supabase, input.tenantId);

    // Calculate commission
    const calculatedCommission = calculateServiceCommission({
      subtotal,
      overrideType: input.overrideType || undefined,
      overrideValue: input.overrideValue || undefined,
      defaultType: commissionConfig?.service_commission_default?.type,
      defaultValue: commissionConfig?.service_commission_default?.value,
    });

    // Insert service item
    const { data, error } = await insertBookingServiceItem(supabase, {
      booking_id: input.bookingId,
      tenant_id: input.tenantId,
      ktv_id: input.ktvId,
      service_name: input.serviceName,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      subtotal,
      override_commission_type: input.overrideType,
      override_commission_value: input.overrideValue,
      calculated_commission: calculatedCommission,
      status: 'completed',
      completed_date: input.completedDate,
    });

    if (error) {
      console.error('Error creating service item:', error);
      return { success: false, error: error.message };
    }

    // Revalidate paths
    revalidatePath(`/dashboard/bookings/${input.bookingId}/services`);
    revalidatePath(`/dashboard/bookings/${input.bookingId}`);

    // TODO: Trigger salary recalculation if needed (future task)

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error in createServiceItem:', error);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}

/**
 * Update an existing service item
 */
export async function updateServiceItem(
  id: string,
  tenantId: string,
  updates: Partial<ServiceItemInput>
): Promise<ServiceItemResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get existing service item
    const { data: existing, error: fetchError } = await getBookingServiceItem(supabase, id, tenantId);

    if (fetchError || !existing) {
      return { success: false, error: 'Không tìm thấy dịch vụ' };
    }

    // Merge updates
    const updatedQuantity = updates.quantity ?? existing.quantity;
    const updatedUnitPrice = updates.unitPrice ?? existing.unit_price;
    const updatedSubtotal = updatedQuantity * updatedUnitPrice;

    // Get tenant commission config
    const { data: commissionConfig } = await queryTenantCommissionConfig(supabase, tenantId);

    // Recalculate commission
    const calculatedCommission = calculateServiceCommission({
      subtotal: updatedSubtotal,
      overrideType: updates.overrideType ?? existing.override_commission_type ?? undefined,
      overrideValue: updates.overrideValue ?? existing.override_commission_value ?? undefined,
      defaultType: commissionConfig?.service_commission_default?.type,
      defaultValue: commissionConfig?.service_commission_default?.value,
    });

    // Update service item
    const { data, error } = await updateBookingServiceItem(supabase, id, tenantId, {
      service_name: updates.serviceName ?? existing.service_name,
      quantity: updatedQuantity,
      unit_price: updatedUnitPrice,
      subtotal: updatedSubtotal,
      ktv_id: updates.ktvId ?? existing.ktv_id,
      override_commission_type: updates.overrideType ?? existing.override_commission_type,
      override_commission_value: updates.overrideValue ?? existing.override_commission_value,
      calculated_commission: calculatedCommission,
      completed_date: updates.completedDate ?? existing.completed_date,
    });

    if (error) {
      console.error('Error updating service item:', error);
      return { success: false, error: error.message };
    }

    // Revalidate paths
    revalidatePath(`/dashboard/bookings/${existing.booking_id}/services`);
    revalidatePath(`/dashboard/bookings/${existing.booking_id}`);

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error in updateServiceItem:', error);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}

/**
 * Delete a service item (soft delete by setting status to 'cancelled')
 */
export async function deleteServiceItem(id: string, tenantId: string): Promise<ServiceItemResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get service item to get booking_id for revalidation
    const { data: existing } = await getBookingServiceItem(supabase, id, tenantId);

    // Soft delete: update status to 'cancelled'
    // Keep commission intact for audit trail
    const { error } = await updateBookingServiceItem(supabase, id, tenantId, {
      status: 'cancelled',
    });

    if (error) {
      console.error('Error deleting service item:', error);
      return { success: false, error: error.message };
    }

    // Revalidate paths
    if (existing) {
      revalidatePath(`/dashboard/bookings/${existing.booking_id}/services`);
      revalidatePath(`/dashboard/bookings/${existing.booking_id}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in deleteServiceItem:', error);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}
