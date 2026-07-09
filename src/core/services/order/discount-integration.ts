/**
 * Discount Integration Layer
 * 
 * Integrates Discount Provider with booking creation flow.
 * Provides server-side discount calculation and enforcement.
 * 
 * **Security:** Prevents client-side discount manipulation by calculating
 * discount on server based on customer tier and eligibility rules.
 * 
 * @module core/services/order
 */

import { DiscountProvider } from '@/lib/decision-engine/providers/discount';
import type { DiscountDecisionInput } from '@/lib/decision-engine/providers/discount';

/**
 * Calculate server-side discount for booking
 * 
 * Replaces client-submitted discount with server-calculated discount
 * based on customer eligibility rules.
 * 
 * **Process:**
 * 1. Fetch customer info (spending, booking history)
 * 2. Call Discount Provider
 * 3. Return calculated discount percentage
 * 4. Caller uses this to override client input
 * 
 * @param params - Discount calculation parameters
 * @returns Calculated discount percentage (0-100)
 * 
 * @example
 * ```typescript
 * const discountPercent = await calculateServerDiscount({
 *   tenantId: 'bella-spa-vn',
 *   customerId: 'cust-123',
 *   totalAmount: 10000000,
 *   serviceCount: 3,
 * });
 * 
 * // Use server-calculated discount (ignore client input)
 * payload.discount_percent = discountPercent;
 * ```
 */
export async function calculateServerDiscount(params: {
  tenantId: string;
  customerId: string;
  totalAmount: number;
  serviceCount?: number;
  referralCode?: string;
  campaignCode?: string;
  campaignStartDate?: string;
  campaignEndDate?: string;
}): Promise<number> {
  try {
    // Import dependencies dynamically to avoid circular deps
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();

    // Fetch customer info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, status, dob_expected')
      .eq('id', params.customerId)
      .single();

    if (customerError || !customer) {
      console.error('[calculateServerDiscount] Failed to fetch customer:', customerError);
      return 0; // Fallback: no discount
    }

    // Calculate lifetime spending
    const { data: revenues } = await supabase
      .from('revenue')
      .select('amount')
      .eq('tenant_id', params.tenantId)
      .in('status', ['confirmed', 'pending']) // Only count confirmed/pending revenue
      .order('received_date', { ascending: false });

    const totalSpending = revenues?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;

    // Count completed bookings
    const { count: completedBookingsCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', params.customerId)
      .eq('tenant_id', params.tenantId)
      .eq('status', 'completed');

    // Count total bookings (for first booking check)
    const { count: totalBookingsCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', params.customerId)
      .eq('tenant_id', params.tenantId);

    // Extract birthday month
    let birthdayMonth: number | undefined;
    if (customer.dob_expected) {
      const dob = new Date(customer.dob_expected);
      if (!isNaN(dob.getTime())) {
        birthdayMonth = dob.getMonth() + 1; // 1-12
      }
    }

    // Build discount decision input
    const discountInput: DiscountDecisionInput = {
      tenantId: params.tenantId,
      totalAmount: params.totalAmount,
      customer: {
        id: customer.id,
        status: customer.status,
        totalSpending,
        completedBookingsCount: completedBookingsCount || 0,
        isFirstBooking: (totalBookingsCount || 0) === 0,
        birthdayMonth,
      },
      purchase: {
        serviceCount: params.serviceCount,
        referralCode: params.referralCode,
      },
    };

    // Add campaign if provided
    if (params.campaignCode && params.campaignStartDate && params.campaignEndDate) {
      discountInput.campaign = {
        code: params.campaignCode,
        startDate: params.campaignStartDate,
        endDate: params.campaignEndDate,
      };
    }

    // Evaluate discount using Discount Provider
    const provider = new DiscountProvider();
    const result = await provider.evaluate(discountInput);

    console.log(
      `[calculateServerDiscount] Customer ${params.customerId}: ${result.customerTier} tier → ${result.discountPercent}% discount (${result.reason})`
    );

    return result.discountPercent;
  } catch (error) {
    console.error('[calculateServerDiscount] Unexpected error:', error);
    return 0; // Fallback: no discount on error
  }
}

/**
 * Get discount preview for client UI
 * 
 * Returns discount eligibility without creating a booking.
 * Used for real-time discount preview in booking form.
 * 
 * @param params - Preview parameters
 * @returns Discount decision output
 * 
 * @example
 * ```typescript
 * // API route: GET /api/bookings/discount-preview
 * const preview = await getDiscountPreview({
 *   tenantId: 'bella-spa-vn',
 *   customerId: 'cust-123',
 *   totalAmount: 10000000,
 * });
 * 
 * return NextResponse.json({
 *   eligible: preview.eligible,
 *   discountPercent: preview.discountPercent,
 *   finalAmount: preview.finalAmount,
 *   reason: preview.reason,
 * });
 * ```
 */
export async function getDiscountPreview(params: {
  tenantId: string;
  customerId: string;
  totalAmount: number;
  serviceCount?: number;
  referralCode?: string;
  campaignCode?: string;
}) {
  const discountPercent = await calculateServerDiscount(params);

  const discountAmount = Math.round((params.totalAmount * discountPercent) / 100);
  const finalAmount = params.totalAmount - discountAmount;

  return {
    eligible: discountPercent > 0,
    discountPercent,
    discountAmount,
    finalAmount,
    reason: discountPercent > 0 ? 'Discount applied' : 'No discount available',
  };
}
