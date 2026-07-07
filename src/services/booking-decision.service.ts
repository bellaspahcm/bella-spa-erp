/**
 * Booking Decision Service
 * 
 * Integrates Decision Engine into booking capacity check workflow.
 * Provides automated recommendations on booking availability.
 * 
 * Sprint 3: Validate Policy Model
 * Goal: Prove knowledge-as-dictionary pattern works for resource constraints
 */

import { RuleReasoner } from '@/lib/decision-engine/RuleReasoner';
import { bookingCapacityPolicyV1 } from '@/lib/decision-engine/policies/booking-capacity-v1';
import type { Knowledge, DecisionResult } from '@/lib/decision-engine/types';
import { createClient } from '@/lib/supabase-server';

/**
 * Build knowledge from booking request for decision engine.
 * 
 * Knowledge = Record<string, unknown> (flat dictionary, no typed interface)
 * Service layer xử lý business logic (time overlap, resource checking),
 * chỉ pass kết quả boolean/number vào knowledge.
 */
export async function buildBookingKnowledge(bookingRequest: {
  bookingId: string;
  requestedDate: string;
  requestedTime: string;
  ktvId?: string | null;
  tenantId: string;
}): Promise<Knowledge> {
  const supabase = await createClient();
  
  // 1. Get booking data
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, completed_sessions, total_sessions, status, assigned_ktv_id')
    .eq('id', bookingRequest.bookingId)
    .single();
  
  if (!booking) {
    // Booking not found → return knowledge indicating not active
    return {
      'booking.remainingSessions': 0,
      'booking.isActive': false,
      'ktv.hasConcurrentSession': false,
      'resource.roomAvailable': false,
      'resource.equipmentAvailable': false,
      'time.hasConflict': false
    };
  }
  
  // 2. Calculate remaining sessions
  const remainingSessions = (booking.total_sessions || 0) - (booking.completed_sessions || 0);
  const isActive = booking.status === 'active' || booking.status === 'in_care';
  
  // 3. Check if KTV has concurrent session
  const ktvId = bookingRequest.ktvId || booking.assigned_ktv_id;
  let hasConcurrentSession = false;
  
  if (ktvId) {
    const { data: concurrentSessions } = await supabase
      .from('session_logs')
      .select('id, assigned_date, assigned_time, status')
      .eq('completed_by_ktv_id', ktvId)
      .eq('assigned_date', bookingRequest.requestedDate)
      .in('status', ['pending', 'confirmed', 'in_progress']);
    
    if (concurrentSessions && concurrentSessions.length > 0) {
      // Check time overlap (simple check: same date + time within 2 hours)
      hasConcurrentSession = concurrentSessions.some(session => {
        const sessionTime = session.assigned_time || '';
        const requestedTimeHour = parseInt(bookingRequest.requestedTime.split(':')[0] || '0', 10);
        const sessionTimeHour = parseInt(sessionTime.split(':')[0] || '0', 10);
        
        // Consider conflict if within 2 hours
        return Math.abs(requestedTimeHour - sessionTimeHour) < 2;
      });
    }
  }
  
  // 4. Check resource availability (simplified: assume room/equipment available unless booked)
  // In real implementation, query booking_resources table
  // For Sprint 3 validation, use simplified logic
  const { data: resourceBookings } = await supabase
    .from('booking_resources')
    .select('id, resource_type, is_available')
    .eq('booking_id', bookingRequest.bookingId)
    .limit(1);
  
  const roomAvailable = resourceBookings?.[0]?.is_available !== false;
  const equipmentAvailable = true; // Simplified for Sprint 3
  
  // 5. Check time slot conflicts (other bookings at same time)
  const { data: timeConflicts } = await supabase
    .from('session_logs')
    .select('id')
    .eq('assigned_date', bookingRequest.requestedDate)
    .eq('assigned_time', bookingRequest.requestedTime)
    .eq('tenant_id', bookingRequest.tenantId)
    .in('status', ['pending', 'confirmed'])
    .neq('booking_id', bookingRequest.bookingId)
    .limit(10);
  
  // If >5 concurrent sessions at same time → consider conflict
  const hasTimeConflict = (timeConflicts?.length || 0) > 5;
  
  // Build knowledge object (flat dictionary, no nesting)
  return {
    // Booking knowledge
    'booking.id': booking.id,
    'booking.remainingSessions': remainingSessions,
    'booking.completedSessions': booking.completed_sessions || 0,
    'booking.totalSessions': booking.total_sessions || 0,
    'booking.isActive': isActive,
    'booking.status': booking.status || 'unknown',
    
    // KTV knowledge
    'ktv.id': ktvId || 'unassigned',
    'ktv.hasConcurrentSession': hasConcurrentSession,
    
    // Resource knowledge
    'resource.roomAvailable': roomAvailable,
    'resource.equipmentAvailable': equipmentAvailable,
    
    // Time knowledge
    'time.requestedDate': bookingRequest.requestedDate,
    'time.requestedTime': bookingRequest.requestedTime,
    'time.hasConflict': hasTimeConflict,
    'time.concurrentSessionCount': timeConflicts?.length || 0
  };
}

/**
 * Evaluate booking request using Decision Engine.
 * Returns automated recommendation.
 */
export async function evaluateBookingRequest(bookingRequest: {
  bookingId: string;
  requestedDate: string;
  requestedTime: string;
  ktvId?: string | null;
  tenantId: string;
}): Promise<{
  decision: DecisionResult;
  knowledge: Knowledge;
  executionTimeMs: number;
}> {
  const startTime = performance.now();
  
  // 1. Build knowledge (service layer handles business logic)
  const knowledge = await buildBookingKnowledge(bookingRequest);
  
  // 2. Initialize reasoner (same engine, different policy)
  const reasoner = new RuleReasoner({
    debug: process.env.NODE_ENV !== 'production'
  });
  
  // 3. Evaluate decision (RuleReasoner unchanged)
  const decision = reasoner.evaluate(bookingCapacityPolicyV1, knowledge);
  
  const executionTimeMs = performance.now() - startTime;
  
  // 4. Log structured telemetry for observability
  console.log('[DecisionEngine]', JSON.stringify({
    timestamp: new Date().toISOString(),
    policy: bookingCapacityPolicyV1.id,
    policyVersion: bookingCapacityPolicyV1.version,
    outcome: decision.outcome,
    reason: decision.explanation,
    bookingId: bookingRequest.bookingId,
    requestedDate: bookingRequest.requestedDate,
    requestedTime: bookingRequest.requestedTime,
    durationMs: Math.round(executionTimeMs),
    knowledge: {
      remainingSessions: knowledge['booking.remainingSessions'],
      isActive: knowledge['booking.isActive'],
      ktvConcurrent: knowledge['ktv.hasConcurrentSession'],
      resourceAvailable: knowledge['resource.roomAvailable'],
      timeConflict: knowledge['time.hasConflict']
    }
  }));
  
  return {
    decision,
    knowledge,
    executionTimeMs
  };
}

/**
 * Get human-readable decision message for UI.
 */
export function getBookingDecisionMessage(decision: DecisionResult): {
  title: string;
  description: string;
  color: 'green' | 'red' | 'yellow';
} {
  switch (decision.outcome) {
    case 'BOOKABLE':
      return {
        title: '✅ Có thể đặt lịch',
        description: decision.explanation || 'Session này có thể được đặt lịch',
        color: 'green'
      };
    case 'FULL':
      return {
        title: '❌ Không thể đặt',
        description: decision.explanation || 'Không thể đặt session này do hết capacity hoặc xung đột',
        color: 'red'
      };
    case 'ESCALATE':
      return {
        title: '⚠️ Cần xem xét',
        description: decision.explanation || 'Cần quản lý xem xét và xác nhận',
        color: 'yellow'
      };
    default:
      return {
        title: '⚠️ Không xác định',
        description: 'Không thể đưa ra khuyến nghị tự động',
        color: 'yellow'
      };
  }
}
