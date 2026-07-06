/**
 * Overbooking Detection Policy
 * 
 * Prevents double-booking of KTVs and rooms by checking for schedule conflicts.
 * 
 * Rules:
 * 1. No KTV double-booking (same time slot)
 * 2. No room double-booking (same time slot)
 * 3. Soft limit warning (KTV > 8 sessions/day)
 * 4. Hard limit block (KTV > 10 sessions/day)
 * 
 * Expected Volume: 500-1,000 decisions/day
 * Target Latency: < 20ms
 * 
 * @phase Phase B - Week 1
 * @status 🔵 IN PROGRESS
 */

import type { Policy } from '@/lib/decision-engine/types';
import { createClient } from '@/lib/supabase-server';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OverbookingContext {
  ktvId: string;
  roomId?: string;
  preferredTime: string; // HH:MM format
  preferredDate: string; // YYYY-MM-DD format
  duration: number; // in minutes
  tenantId: string;
  bookingId?: string; // exclude self when editing existing booking
}

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface Conflict {
  type: 'ktv' | 'room';
  conflictingBookingId: string;
  conflictingTime: string;
  conflictingCustomer?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate end time given start time and duration
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

/**
 * Check if two time slots overlap
 */
function timeSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  const start1 = slot1.startTime;
  const end1 = slot1.endTime;
  const start2 = slot2.startTime;
  const end2 = slot2.endTime;

  // Convert HH:MM to minutes for easier comparison
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);

  // Slots overlap if: start1 < end2 AND start2 < end1
  return s1 < e2 && s2 < e1;
}

/**
 * Check for KTV conflicts on given date
 */
async function checkKTVConflicts(
  ktvId: string,
  date: string,
  time: string,
  duration: number,
  tenantId: string,
  excludeBookingId?: string
): Promise<Conflict[]> {
  const supabase = await createClient();
  
  const endTime = calculateEndTime(time, duration);
  const requestedSlot: TimeSlot = { startTime: time, endTime };

  // Query all bookings for this KTV on this date
  let query = supabase
    .from('bookings')
    .select('id, preferred_time, duration, customer_id, customers(name_mother)')
    .eq('assigned_ktv_id', ktvId)
    .eq('preferred_date', date)
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed', 'in_progress']); // only check active bookings

  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId);
  }

  const { data: existingBookings, error } = await query;

  if (error) {
    console.error('[overbooking-detection] Error querying KTV bookings:', error);
    throw new Error(`Failed to check KTV conflicts: ${error.message}`);
  }

  const conflicts: Conflict[] = [];

  for (const booking of existingBookings || []) {
    const bookingEndTime = calculateEndTime(booking.preferred_time, booking.duration);
    const bookingSlot: TimeSlot = {
      startTime: booking.preferred_time,
      endTime: bookingEndTime,
    };

    if (timeSlotsOverlap(requestedSlot, bookingSlot)) {
      conflicts.push({
        type: 'ktv',
        conflictingBookingId: booking.id,
        conflictingTime: booking.preferred_time,
        conflictingCustomer: booking.customers?.name_mother,
      });
    }
  }

  return conflicts;
}

/**
 * Check for room conflicts on given date
 */
async function checkRoomConflicts(
  roomId: string,
  date: string,
  time: string,
  duration: number,
  tenantId: string,
  excludeBookingId?: string
): Promise<Conflict[]> {
  const supabase = await createClient();
  
  const endTime = calculateEndTime(time, duration);
  const requestedSlot: TimeSlot = { startTime: time, endTime };

  // Query all bookings for this room on this date
  let query = supabase
    .from('bookings')
    .select('id, preferred_time, duration, customer_id, customers(name_mother)')
    .eq('room_id', roomId)
    .eq('preferred_date', date)
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed', 'in_progress']);

  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId);
  }

  const { data: existingBookings, error } = await query;

  if (error) {
    console.error('[overbooking-detection] Error querying room bookings:', error);
    throw new Error(`Failed to check room conflicts: ${error.message}`);
  }

  const conflicts: Conflict[] = [];

  for (const booking of existingBookings || []) {
    const bookingEndTime = calculateEndTime(booking.preferred_time, booking.duration);
    const bookingSlot: TimeSlot = {
      startTime: booking.preferred_time,
      endTime: bookingEndTime,
    };

    if (timeSlotsOverlap(requestedSlot, bookingSlot)) {
      conflicts.push({
        type: 'room',
        conflictingBookingId: booking.id,
        conflictingTime: booking.preferred_time,
        conflictingCustomer: booking.customers?.name_mother,
      });
    }
  }

  return conflicts;
}

/**
 * Count KTV sessions on given date
 */
async function countKTVSessionsOnDate(
  ktvId: string,
  date: string,
  tenantId: string
): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_ktv_id', ktvId)
    .eq('preferred_date', date)
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed', 'in_progress']);

  if (error) {
    console.error('[overbooking-detection] Error counting KTV sessions:', error);
    return 0; // Return 0 on error to allow booking (fail-open)
  }

  return count || 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy Definition
// ─────────────────────────────────────────────────────────────────────────────

export const overbookingDetectionPolicy: Policy<OverbookingContext> = {
  id: 'booking.overbooking-detection',
  name: 'Overbooking Detection Policy',
  domain: 'booking',
  category: 'validation',
  version: '1.0.0',
  description: 'Prevent KTV and room double-bookings with smart conflict detection',
  
  rules: [
    // ─────────────────────────────────────────────────────────────────────────
    // Rule 1: No KTV Double Booking (Priority 100 - Critical)
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'no-ktv-double-booking',
      name: 'No KTV Double Booking',
      description: 'KTV cannot be booked in overlapping time slots',
      priority: 100,
      conditions: {
        ktvId: { exists: true },
        preferredTime: { exists: true },
        preferredDate: { exists: true },
        duration: { exists: true, min: 30 }, // minimum 30 minutes
        tenantId: { exists: true },
      },
      action: async (context: OverbookingContext) => {
        try {
          const conflicts = await checkKTVConflicts(
            context.ktvId,
            context.preferredDate,
            context.preferredTime,
            context.duration,
            context.tenantId,
            context.bookingId
          );

          if (conflicts.length === 0) {
            return {
              decision: 'approve',
              reason: 'No KTV schedule conflicts detected',
              confidence: 1.0,
              metadata: {
                ruleId: 'no-ktv-double-booking',
                conflictCount: 0,
              },
            };
          }

          // Found conflicts - reject booking
          const conflictDetails = conflicts.map(c => 
            `${c.conflictingTime} (Customer: ${c.conflictingCustomer || 'N/A'})`
          ).join(', ');

          return {
            decision: 'reject',
            reason: `KTV đã có lịch trùng tại: ${conflictDetails}`,
            confidence: 1.0,
            metadata: {
              ruleId: 'no-ktv-double-booking',
              conflictCount: conflicts.length,
              conflicts: conflicts.map(c => ({
                bookingId: c.conflictingBookingId,
                time: c.conflictingTime,
                customer: c.conflictingCustomer,
              })),
            },
          };
        } catch (error) {
          console.error('[no-ktv-double-booking] Rule execution error:', error);
          // Fail-open: allow booking if conflict check fails (avoid blocking legitimate bookings)
          return {
            decision: 'approve',
            reason: 'Không thể kiểm tra xung đột lịch (hệ thống đang bảo trì), cho phép đặt lịch',
            confidence: 0.3,
            metadata: {
              ruleId: 'no-ktv-double-booking',
              error: (error as Error).message,
              failOpen: true,
            },
          };
        }
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Rule 2: No Room Double Booking (Priority 95)
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'no-room-double-booking',
      name: 'No Room Double Booking',
      description: 'Room cannot be booked in overlapping time slots',
      priority: 95,
      conditions: {
        roomId: { exists: true },
        preferredTime: { exists: true },
        preferredDate: { exists: true },
        duration: { exists: true },
        tenantId: { exists: true },
      },
      action: async (context: OverbookingContext) => {
        if (!context.roomId) {
          // No room specified, skip this rule
          return {
            decision: 'approve',
            reason: 'No room specified, skip room conflict check',
            confidence: 1.0,
            metadata: { ruleId: 'no-room-double-booking', skipped: true },
          };
        }

        try {
          const conflicts = await checkRoomConflicts(
            context.roomId,
            context.preferredDate,
            context.preferredTime,
            context.duration,
            context.tenantId,
            context.bookingId
          );

          if (conflicts.length === 0) {
            return {
              decision: 'approve',
              reason: 'No room schedule conflicts detected',
              confidence: 1.0,
              metadata: {
                ruleId: 'no-room-double-booking',
                conflictCount: 0,
              },
            };
          }

          // Found conflicts - reject booking
          const conflictDetails = conflicts.map(c => 
            `${c.conflictingTime} (Customer: ${c.conflictingCustomer || 'N/A'})`
          ).join(', ');

          return {
            decision: 'reject',
            reason: `Phòng đã có lịch trùng tại: ${conflictDetails}`,
            confidence: 1.0,
            metadata: {
              ruleId: 'no-room-double-booking',
              conflictCount: conflicts.length,
              conflicts: conflicts.map(c => ({
                bookingId: c.conflictingBookingId,
                time: c.conflictingTime,
                customer: c.conflictingCustomer,
              })),
            },
          };
        } catch (error) {
          console.error('[no-room-double-booking] Rule execution error:', error);
          return {
            decision: 'approve',
            reason: 'Không thể kiểm tra xung đột phòng (hệ thống đang bảo trì), cho phép đặt lịch',
            confidence: 0.3,
            metadata: {
              ruleId: 'no-room-double-booking',
              error: (error as Error).message,
              failOpen: true,
            },
          };
        }
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Rule 3: Soft Limit Warning (Priority 50 - Advisory)
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'ktv-daily-session-soft-limit',
      name: 'KTV Daily Session Soft Limit',
      description: 'Warn when KTV has more than 8 sessions in a day',
      priority: 50,
      conditions: {
        ktvId: { exists: true },
        preferredDate: { exists: true },
        tenantId: { exists: true },
      },
      action: async (context: OverbookingContext) => {
        try {
          const sessionCount = await countKTVSessionsOnDate(
            context.ktvId,
            context.preferredDate,
            context.tenantId
          );

          if (sessionCount >= 8 && sessionCount < 10) {
            return {
              decision: 'approve', // Still approve, but with warning
              reason: `⚠️ Warning: KTV đã có ${sessionCount} ca trong ngày (soft limit: 8 ca)`,
              confidence: 0.8,
              metadata: {
                ruleId: 'ktv-daily-session-soft-limit',
                sessionCount,
                softLimit: 8,
                isWarning: true,
              },
            };
          }

          return {
            decision: 'approve',
            reason: `KTV có ${sessionCount} ca trong ngày (trong giới hạn)`,
            confidence: 1.0,
            metadata: {
              ruleId: 'ktv-daily-session-soft-limit',
              sessionCount,
            },
          };
        } catch (error) {
          console.error('[ktv-daily-session-soft-limit] Rule execution error:', error);
          return {
            decision: 'approve',
            reason: 'Không thể kiểm tra số ca trong ngày',
            confidence: 0.5,
            metadata: {
              ruleId: 'ktv-daily-session-soft-limit',
              error: (error as Error).message,
            },
          };
        }
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Rule 4: Hard Limit Block (Priority 90 - Critical)
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'ktv-daily-session-hard-limit',
      name: 'KTV Daily Session Hard Limit',
      description: 'Block when KTV has 10 or more sessions in a day',
      priority: 90,
      conditions: {
        ktvId: { exists: true },
        preferredDate: { exists: true },
        tenantId: { exists: true },
      },
      action: async (context: OverbookingContext) => {
        try {
          const sessionCount = await countKTVSessionsOnDate(
            context.ktvId,
            context.preferredDate,
            context.tenantId
          );

          if (sessionCount >= 10) {
            return {
              decision: 'reject',
              reason: `🚫 KTV đã đạt giới hạn tối đa ${sessionCount}/10 ca trong ngày`,
              confidence: 1.0,
              metadata: {
                ruleId: 'ktv-daily-session-hard-limit',
                sessionCount,
                hardLimit: 10,
              },
            };
          }

          return {
            decision: 'approve',
            reason: `KTV có ${sessionCount} ca trong ngày (dưới giới hạn 10 ca)`,
            confidence: 1.0,
            metadata: {
              ruleId: 'ktv-daily-session-hard-limit',
              sessionCount,
            },
          };
        } catch (error) {
          console.error('[ktv-daily-session-hard-limit] Rule execution error:', error);
          return {
            decision: 'approve',
            reason: 'Không thể kiểm tra giới hạn ca trong ngày',
            confidence: 0.3,
            metadata: {
              ruleId: 'ktv-daily-session-hard-limit',
              error: (error as Error).message,
              failOpen: true,
            },
          };
        }
      },
    },
  ],
};
