'use server';

/**
 * Booking Service Items Creation Helper
 * 
 * Handles creation of service items with commission calculation when booking is created.
 * Part of Commission System (Task 12)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { calculateServiceCommission } from '@/lib/business-rules/commission';

type BookingRow = Database['public']['Tables']['bookings']['Row'];

// Manual type definition for booking_service_items since it might not be in generated types yet
interface ServiceItemInsert {
  id?: string;
  booking_id: string;
  tenant_id: string;
  service_name: string;
  package_id?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  ktv_id?: string | null;
  override_commission_type?: 'fixed' | 'percentage' | null;
  override_commission_value?: number | null;
  calculated_commission: number;
  completed_date?: string | null;
  status: 'completed' | 'pending' | 'cancelled';
  created_at?: string;
  updated_at?: string;
}

interface ServiceItemInput {
  serviceName: string;
  packageId?: string;
  quantity: number;
  unitPrice: number;
  ktvId?: string | null;
  overrideType?: 'fixed' | 'percentage' | null;
  overrideValue?: number | null;
}

interface CreateServiceItemsInput {
  supabase: SupabaseClient<Database>;
  booking: BookingRow;
  serviceItems?: ServiceItemInput[];
  tenantId: string;
  commissionDefaults?: {
    type: 'fixed' | 'percentage';
    value: number;
  };
}

interface CreateServiceItemsResult {
  success: boolean;
  count?: number;
  totalCommission?: number;
  error?: string;
}

/**
 * Creates service items for a booking with commission calculation.
 * 
 * This function is called after booking creation to add detailed service items
 * that contribute to commission calculations in the salary system.
 * 
 * @param input - Service items creation parameters
 * @returns Success result with count and total commission, or error
 * 
 * @remarks
 * **Commission Calculation Priority:**
 * 1. Override commission (if specified per item)
 * 2. Tenant default commission (from tenant config)
 * 3. System default (150,000 VND fixed)
 * 
 * **Status Logic:**
 * - If booking status is 'completed': service items status = 'completed'
 * - Otherwise: service items status = 'pending'
 * 
 * **Completed Date Logic:**
 * - If booking has end_date: use end_date
 * - If booking has start_date: use start_date
 * - Otherwise: null (will be set when service completed)
 * 
 * **KTV Assignment:**
 * - Uses item-level ktvId if provided
 * - Falls back to booking-level assigned_ktv_id
 * - Can be null (assigned later)
 * 
 * **Module Isolation:**
 * - Only creates service items for beauty_spa module bookings
 * - Other modules (babycare) skip this step
 * 
 * @example
 * ```typescript
 * const result = await createBookingServiceItems({
 *   supabase,
 *   booking,
 *   serviceItems: [
 *     {
 *       serviceName: 'Gội Massage',
 *       quantity: 1,
 *       unitPrice: 200000,
 *       overrideType: 'percentage',
 *       overrideValue: 20
 *     }
 *   ],
 *   tenantId,
 *   commissionDefaults: { type: 'fixed', value: 150000 }
 * });
 * 
 * if (result.success) {
 *   console.log(`Created ${result.count} service items`);
 *   console.log(`Total commission: ${result.totalCommission}đ`);
 * } else {
 *   console.error(`Failed: ${result.error}`);
 * }
 * ```
 */
export async function createBookingServiceItems(
  input: CreateServiceItemsInput
): Promise<CreateServiceItemsResult> {
  const { supabase, booking, serviceItems, tenantId, commissionDefaults } = input;

  // Skip if no service items provided (optional feature)
  if (!serviceItems || serviceItems.length === 0) {
    return { success: true, count: 0, totalCommission: 0 };
  }

  try {
    // Default commission config (system fallback)
    const defaultCommission = commissionDefaults || {
      type: 'fixed' as const,
      value: 150000,
    };

    // Determine status based on booking status
    const itemStatus = booking.status === 'completed' ? 'completed' : 'pending';

    // Determine completed date
    const completedDate =
      booking.end_date || booking.start_date || null;

    // Calculate commission and build insert payloads
    const insertPayloads: ServiceItemInsert[] = [];
    let totalCommission = 0;

    for (const item of serviceItems) {
      const subtotal = item.quantity * item.unitPrice;

      // Calculate commission using business logic
      const calculatedCommission = calculateServiceCommission({
        subtotal,
        overrideType: item.overrideType || null,
        overrideValue: item.overrideValue || null,
        defaultType: defaultCommission.type,
        defaultValue: defaultCommission.value,
      });

      totalCommission += calculatedCommission;

      // Build insert payload
      const payload: ServiceItemInsert = {
        booking_id: booking.id,
        tenant_id: tenantId,
        ktv_id: item.ktvId || booking.assigned_ktv_id || null,
        service_name: item.serviceName,
        package_id: item.packageId || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal,
        override_commission_type: item.overrideType || null,
        override_commission_value: item.overrideValue || null,
        calculated_commission: calculatedCommission,
        status: itemStatus,
        completed_date: completedDate,
      };

      insertPayloads.push(payload);
    }

    // Insert all service items in one query
    const { error: insertError } = await supabase
      .from('booking_service_items')
      .insert(insertPayloads);

    if (insertError) {
      console.error('[createBookingServiceItems] Insert failed:', insertError);
      return {
        success: false,
        error: `Không thể lưu dịch vụ: ${insertError.message}`,
      };
    }

    return {
      success: true,
      count: insertPayloads.length,
      totalCommission,
    };
  } catch (error) {
    console.error('[createBookingServiceItems] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lỗi hệ thống khi lưu dịch vụ',
    };
  }
}
