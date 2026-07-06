/**
 * Booking Decision Actions
 * 
 * Wrappers around Decision Engine for booking-related decisions:
 * - Overbooking detection
 * - Dynamic pricing (Phase B - Week 3-4)
 * - Discount approval (Phase B - Week 5-6)
 * 
 * @phase Phase B - Business Integration
 * @status 🔵 IN PROGRESS
 */

'use server';

import { 
  overbookingDetectionPolicy,
  type OverbookingContext 
} from '@/policies/booking/overbooking-detection';
import { createClient } from '@/lib/supabase-server';

// ─────────────────────────────────────────────────────────────────────────────
// Decision Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check for booking conflicts using Overbooking Detection Policy
 * 
 * Evaluates 4 rules:
 * 1. KTV double-booking (BLOCK)
 * 2. Room double-booking (BLOCK)
 * 3. Soft limit >8 sessions (WARNING)
 * 4. Hard limit ≥10 sessions (BLOCK)
 * 
 * @returns Simplified decision result
 * 
 * @example
 * ```typescript
 * const result = await checkBookingConflicts({
 *   bookingId: 'booking-123',
 *   ktvId: 'ktv-123',
 *   bookingResourceId: 'room-1',
 *   assignedDate: '2026-07-06',
 *   assignedTime: '14:00',
 *   durationMinutes: 90,
 * });
 * 
 * if (result.decision === 'REJECT') {
 *   console.log('Blocked:', result.message);
 * }
 * ```
 */
export async function checkBookingConflicts(input: {
  bookingId: string;
  ktvId: string | null;
  bookingResourceId: string | null;
  assignedDate: string | null;
  assignedTime: string;
  durationMinutes: number;
}): Promise<{
  decision: 'APPROVE' | 'REJECT' | 'APPROVE_WITH_WARNING';
  message: string;
  context?: Record<string, unknown>;
}> {
  try {
    // Get current user for tenant context
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.warn('[checkBookingConflicts] No user session, allowing booking');
      return {
        decision: 'APPROVE',
        message: 'Booking approved (no user session)',
      };
    }

    // Get user profile with tenant_id
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = profile?.tenant_id;

    if (!tenantId) {
      console.warn('[checkBookingConflicts] No tenant context, allowing booking');
      return {
        decision: 'APPROVE',
        message: 'Booking approved (no tenant context)',
      };
    }

    // Skip check if no KTV or date assigned yet
    if (!input.ktvId || !input.assignedDate) {
      return {
        decision: 'APPROVE',
        message: 'Booking approved (no KTV or date assigned yet)',
      };
    }

    // Build policy context
    const context: OverbookingContext = {
      ktvId: input.ktvId,
      roomId: input.bookingResourceId || undefined,
      preferredTime: input.assignedTime,
      preferredDate: input.assignedDate,
      duration: input.durationMinutes,
      tenantId,
      bookingId: input.bookingId,
    };

    // Evaluate policy directly
    const policyResult = await overbookingDetectionPolicy.evaluate(context);

    // Map policy result to simplified decision
    if (policyResult.decision === 'reject') {
      return {
        decision: 'REJECT',
        message: policyResult.reason || 'Không thể tạo lịch hẹn do xung đột',
        context: policyResult.metadata,
      };
    }

    if (policyResult.metadata?.isWarning) {
      return {
        decision: 'APPROVE_WITH_WARNING',
        message: policyResult.reason || 'Cảnh báo: Vượt quá số ca khuyến nghị',
        context: policyResult.metadata,
      };
    }

    return {
      decision: 'APPROVE',
      message: policyResult.reason || 'Không phát hiện xung đột',
      context: policyResult.metadata,
    };
  } catch (error) {
    console.error('[checkBookingConflicts] Unexpected error:', error);
    
    // Fail-open: allow booking if Decision Engine fails
    return {
      decision: 'APPROVE',
      message: 'Booking approved (fail-open on error)',
      context: { error: String(error) },
    };
  }
}
