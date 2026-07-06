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

import { makeDecision } from '@/lib/decision-engine/decision-engine';
import { 
  overbookingDetectionPolicy,
  type OverbookingContext 
} from '@/policies/booking/overbooking-detection';
import { recordAuditLog } from '@/services/audit-actions';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckBookingConflictsInput {
  ktvId: string;
  roomId?: string;
  preferredTime: string; // HH:MM
  preferredDate: string; // YYYY-MM-DD
  duration: number; // minutes
  tenantId: string;
  bookingId?: string; // when editing existing booking
}

export interface BookingConflictResult {
  success: boolean;
  canProceed: boolean;
  conflicts: Array<{
    type: 'ktv' | 'room';
    bookingId: string;
    time: string;
    customer?: string;
  }>;
  warnings: string[];
  reason: string;
  decisionId?: string; // for audit trail
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check for booking conflicts using Decision Engine
 * 
 * @returns BookingConflictResult with decision and details
 * 
 * @example
 * ```typescript
 * const result = await checkBookingConflicts({
 *   ktvId: 'ktv-123',
 *   roomId: 'room-1',
 *   preferredTime: '14:00',
 *   preferredDate: '2026-07-06',
 *   duration: 90,
 *   tenantId: 'tenant-123',
 * });
 * 
 * if (!result.canProceed) {
 *   console.log('Conflict:', result.reason);
 *   console.log('Conflicts:', result.conflicts);
 * }
 * ```
 */
export async function checkBookingConflicts(
  input: CheckBookingConflictsInput
): Promise<BookingConflictResult> {
  try {
    // Build decision context
    const context: OverbookingContext = {
      ktvId: input.ktvId,
      roomId: input.roomId,
      preferredTime: input.preferredTime,
      preferredDate: input.preferredDate,
      duration: input.duration,
      tenantId: input.tenantId,
      bookingId: input.bookingId,
    };

    // Make decision
    const decision = await makeDecision({
      decisionType: 'booking.overbooking-check',
      tenantId: input.tenantId,
      context,
      policy: overbookingDetectionPolicy,
      provider: 'RuleProvider',
    });

    // Extract conflicts and warnings from metadata
    const conflicts = decision.metadata?.conflicts || [];
    const warnings: string[] = [];
    const sessionCount = decision.metadata?.sessionCount;

    // Check for soft limit warning
    if (decision.metadata?.isWarning && sessionCount) {
      warnings.push(
        `KTV đã có ${sessionCount} ca trong ngày (khuyến nghị tối đa 8 ca)`
      );
    }

    // Log audit for future analysis
    await recordAuditLog({
      action: 'DECISION',
      table_name: 'bookings',
      record_id: input.bookingId || 'new-booking',
      new_data: {
        decision: decision.decision,
        decisionType: 'overbooking-check',
        confidence: decision.confidence,
        conflictCount: decision.metadata?.conflictCount || 0,
      },
    });

    return {
      success: true,
      canProceed: decision.decision === 'approve',
      conflicts: conflicts.map((c: any) => ({
        type: c.type || 'ktv',
        bookingId: c.bookingId,
        time: c.time,
        customer: c.customer,
      })),
      warnings,
      reason: decision.reason,
      decisionId: decision.decisionId,
      confidence: decision.confidence,
    };
  } catch (error) {
    console.error('[checkBookingConflicts] Unexpected error:', error);
    
    // Fail-open: allow booking if Decision Engine fails
    return {
      success: false,
      canProceed: true, // Allow booking despite error
      conflicts: [],
      warnings: [
        'Không thể kiểm tra xung đột lịch. Hệ thống tạm thời cho phép đặt lịch.',
      ],
      reason: 'Lỗi hệ thống khi kiểm tra xung đột',
      confidence: 0.1,
    };
  }
}

/**
 * Get suggested alternative time slots when conflicts are found
 * 
 * @returns Array of available time slots
 * 
 * @todo Implement in Week 2 (requires more complex logic)
 */
export async function getSuggestedTimeSlots(
  input: CheckBookingConflictsInput
): Promise<string[]> {
  // TODO: Implement smart time slot suggestions
  // 1. Find gaps in KTV schedule
  // 2. Check room availability for those gaps
  // 3. Return top 3 closest available slots
  
  return [];
}
