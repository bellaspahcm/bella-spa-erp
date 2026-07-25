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

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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
  data?: BookingServiceItem | null;
  error?: string;
}

function extractMonthYear(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

async function verifySalaryRecordNotLocked(
  supabase: SupabaseClient,
  ktvId: string | null,
  monthYear: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  if (!ktvId || !monthYear) return { success: true };
  const { data: salaryRecord, error } = await supabase
    .from('salary_records')
    .select('status, is_locked')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    return { success: false, error: 'Không thể kiểm tra trạng thái bảng lương: ' + error.message };
  }

  if (salaryRecord) {
    if (salaryRecord.is_locked) {
      return { success: false, error: 'Không thể điều chỉnh: Bảng lương đã bị khóa (month-end close). Liên hệ kế toán để mở khóa.' };
    }
    if (salaryRecord.status === 'finalized') {
      return { success: false, error: 'Không thể điều chỉnh: Bảng lương đã hoàn tất (finalized) và đã xuất chi. Điều chỉnh sẽ không có hiệu lực.' };
    }
  }

  return { success: true };
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

    // Check if salary record is locked/finalized
    if (input.ktvId) {
      const monthYear = extractMonthYear(input.completedDate);
      const lockCheck = await verifySalaryRecordNotLocked(supabase, input.ktvId, monthYear, input.tenantId);
      if (!lockCheck.success) {
        return { success: false, error: lockCheck.error };
      }
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

    // Trigger salary recalculation
    if (input.ktvId) {
      const monthYear = extractMonthYear(input.completedDate);
      try {
        const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
        await recalculateAndSaveSalaryRecord(supabase, input.ktvId, monthYear, input.tenantId);
      } catch (recalcError) {
        console.error('Error recalculating salary after creating service item:', recalcError);
        // Rollback inserted service item
        if (data?.id) {
          await supabase.from('booking_service_items').delete().eq('id', data.id);
        }
        return { success: false, error: recalcError instanceof Error ? recalcError.message : 'Lỗi tính toán lương' };
      }
    }

    // Revalidate paths
    revalidatePath(`/dashboard/bookings/${input.bookingId}/services`);
    revalidatePath(`/dashboard/bookings/${input.bookingId}`);

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

    // Check old salary lock
    if (existing.ktv_id) {
      const oldMonth = extractMonthYear(existing.completed_date);
      const lockCheck = await verifySalaryRecordNotLocked(supabase, existing.ktv_id, oldMonth, tenantId);
      if (!lockCheck.success) {
        return { success: false, error: lockCheck.error };
      }
    }

    // Check new salary lock
    const newKtvId = updates.ktvId !== undefined ? updates.ktvId : existing.ktv_id;
    const newCompletedDate = updates.completedDate ?? existing.completed_date;
    if (newKtvId) {
      const newMonth = extractMonthYear(newCompletedDate);
      const lockCheck = await verifySalaryRecordNotLocked(supabase, newKtvId, newMonth, tenantId);
      if (!lockCheck.success) {
        return { success: false, error: lockCheck.error };
      }
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

    // Trigger recalculation
    let oldRecalcFailed = false;
    let oldRecalcErrorMsg = '';
    if (existing.ktv_id) {
      const oldMonth = extractMonthYear(existing.completed_date);
      try {
        const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
        await recalculateAndSaveSalaryRecord(supabase, existing.ktv_id, oldMonth, tenantId);
      } catch (err) {
        oldRecalcFailed = true;
        oldRecalcErrorMsg = err instanceof Error ? err.message : 'Lỗi tính toán lương cũ';
      }
    }

    const newMonth = extractMonthYear(newCompletedDate);
    const isDifferentKtvOrMonth = newKtvId !== existing.ktv_id || newMonth !== extractMonthYear(existing.completed_date);

    if (!oldRecalcFailed && newKtvId && isDifferentKtvOrMonth) {
      try {
        const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
        await recalculateAndSaveSalaryRecord(supabase, newKtvId, newMonth, tenantId);
      } catch (err) {
        console.error('Error recalculating new KTV salary:', err);
        // Rollback update
        await updateBookingServiceItem(supabase, id, tenantId, {
          service_name: existing.service_name,
          quantity: existing.quantity,
          unit_price: existing.unit_price,
          subtotal: existing.subtotal,
          ktv_id: existing.ktv_id,
          override_commission_type: existing.override_commission_type,
          override_commission_value: existing.override_commission_value,
          calculated_commission: existing.calculated_commission,
          completed_date: existing.completed_date,
        });
        // Re-recalculate old salary record if it had been updated
        if (existing.ktv_id) {
          const oldMonth = extractMonthYear(existing.completed_date);
          const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
          await recalculateAndSaveSalaryRecord(supabase, existing.ktv_id, oldMonth, tenantId);
        }
        return { success: false, error: err instanceof Error ? err.message : 'Lỗi tính toán lương mới' };
      }
    }

    if (oldRecalcFailed) {
      console.error('Error recalculating old KTV salary:', oldRecalcErrorMsg);
      // Rollback update
      await updateBookingServiceItem(supabase, id, tenantId, {
        service_name: existing.service_name,
        quantity: existing.quantity,
        unit_price: existing.unit_price,
        subtotal: existing.subtotal,
        ktv_id: existing.ktv_id,
        override_commission_type: existing.override_commission_type,
        override_commission_value: existing.override_commission_value,
        calculated_commission: existing.calculated_commission,
        completed_date: existing.completed_date,
      });
      return { success: false, error: oldRecalcErrorMsg };
    }

    // Revalidate paths
    revalidatePath(`/dashboard/bookings/${existing.booking_id}/services`);
    revalidatePath(`/dashboard/bookings/${existing.booking_id}`);

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error in updateServiceItem:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lỗi hệ thống',
    };
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

    if (!existing) {
      return { success: false, error: 'Không tìm thấy dịch vụ' };
    }

    // Check salary lock
    if (existing.ktv_id) {
      const monthYear = extractMonthYear(existing.completed_date);
      const lockCheck = await verifySalaryRecordNotLocked(supabase, existing.ktv_id, monthYear, tenantId);
      if (!lockCheck.success) {
        return { success: false, error: lockCheck.error };
      }
    }

    // Soft delete: update status to 'cancelled'
    // Keep commission intact for audit trail
    const { error } = await updateBookingServiceItem(supabase, id, tenantId, {
      status: 'cancelled',
    });

    if (error) {
      console.error('Error deleting service item:', error);
      return { success: false, error: error.message };
    }

    // Trigger recalculation
    if (existing.ktv_id) {
      const monthYear = extractMonthYear(existing.completed_date);
      try {
        const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
        await recalculateAndSaveSalaryRecord(supabase, existing.ktv_id, monthYear, tenantId);
      } catch (err) {
        console.error('Error recalculating salary after deleting service item:', err);
        // Rollback status to completed
        await updateBookingServiceItem(supabase, id, tenantId, {
          status: 'completed',
        });
        return { success: false, error: err instanceof Error ? err.message : 'Lỗi tính toán lương' };
      }
    }

    // Revalidate paths
    revalidatePath(`/dashboard/bookings/${existing.booking_id}/services`);
    revalidatePath(`/dashboard/bookings/${existing.booking_id}`);

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in deleteServiceItem:', error);
    return { success: false, error: 'Lỗi hệ thống' };
  }
}
