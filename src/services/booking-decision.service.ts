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
import { CapacityManagementProvider } from '@/lib/decision-engine/providers/booking/capacity-management-provider';
import { AutoAssignmentProvider } from '@/lib/decision-engine/providers/booking/auto-assignment-provider';
import { ConflictDetectionProvider } from '@/lib/decision-engine/providers/booking/conflict-detection-provider';
import type {
  CapacityCheckInput,
  CapacityCheckOutput,
  AutoAssignmentInput,
  AutoAssignmentOutput,
  KtvCandidate,
  ConflictDetectionInput,
  ConflictDetectionOutput,
} from '@/lib/decision-engine/providers/booking/types';

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

// ============================================================================
// PHASE 1+2 INTEGRATION: Capacity Management & Auto-Assignment
// ============================================================================

/**
 * Check booking capacity using Phase 2 Capacity Management Provider
 * 
 * Validates:
 * - Daily booking limits
 * - Time overlaps with existing bookings
 * - Concurrent session limits
 * - Break time requirements
 * - Working hours constraints
 * - Buffer slot availability (VIP vs non-VIP)
 * - Peak hour capacity limits
 * 
 * @param input - Capacity check parameters
 * @returns Capacity availability result with conflicts and alternatives
 * 
 * @example
 * ```typescript
 * const result = await checkBookingCapacity({
 *   tenantId: 'tenant-001',
 *   ktvId: 'ktv-123',
 *   requestedDate: '2026-07-15',
 *   requestedStartTime: '14:00',
 *   requestedEndTime: '15:30',
 *   durationMinutes: 90,
 *   customerTier: 'vip',
 *   serviceType: 'Massage',
 * });
 * 
 * if (!result.available) {
 *   console.log('Conflicts:', result.conflicts);
 *   console.log('Alternatives:', result.alternatives);
 * }
 * ```
 */
export async function checkBookingCapacity(input: {
  tenantId: string;
  ktvId: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  durationMinutes: number;
  customerTier: 'vip' | 'loyal' | 'new';
  serviceType: string;
}): Promise<{
  available: boolean;
  capacityDetails: {
    currentBookings: number;
    maxBookings: number;
    utilizationPercentage: number;
    bufferSlotsUsed: number;
    bufferSlotsAvailable: number;
    isPeakHour: boolean;
  };
  conflicts?: Array<{
    type: string;
    reason: string;
    conflictingBooking?: {
      id: string;
      startTime: string;
      endTime: string;
    };
  }>;
  alternatives?: Array<{
    suggestedDate: string;
    suggestedTime: string;
    reason: string;
  }>;
  executionTime: number;
}> {
  const supabase = await createClient();

  // 1. Fetch KTV capacity configuration
  const { data: ktvProfile } = await supabase
    .from('users')
    .select('id, full_name, position, max_daily_bookings')
    .eq('id', input.ktvId)
    .eq('role', 'ktv')
    .single();

  if (!ktvProfile) {
    throw new Error(`KTV not found: ${input.ktvId}`);
  }

  // 2. Fetch tenant capacity configuration
  const { data: tenantConfig } = await supabase
    .from('tenants')
    .select('id, capacity_config')
    .eq('id', input.tenantId)
    .single();

  const capacityConfig = (tenantConfig?.capacity_config as any) || {};

  // 3. Fetch existing bookings for KTV on requested date
  const { data: existingBookings } = await supabase
    .from('session_logs')
    .select('id, assigned_time, duration_minutes, status')
    .eq('completed_by_ktv_id', input.ktvId)
    .eq('assigned_date', input.requestedDate)
    .in('status', ['pending', 'confirmed', 'in_progress', 'completed']);

  // 4. Map existing bookings to provider format
  const mappedBookings = (existingBookings || []).map(booking => {
    const startTime = booking.assigned_time || '00:00';
    const durationMins = booking.duration_minutes || 90;
    const startHour = parseInt(startTime.split(':')[0] || '0', 10);
    const startMinute = parseInt(startTime.split(':')[1] || '0', 10);
    const endTotalMinutes = startHour * 60 + startMinute + durationMins;
    const endHour = Math.floor(endTotalMinutes / 60);
    const endMinute = endTotalMinutes % 60;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

    return {
      id: booking.id,
      startTime,
      endTime,
      durationMinutes: durationMins,
      status: booking.status as 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled',
    };
  });

  // 5. Build capacity check input
  const capacityInput: CapacityCheckInput = {
    tenantId: input.tenantId,
    ktvId: input.ktvId,
    booking: {
      requestedDate: input.requestedDate,
      requestedStartTime: input.requestedStartTime,
      requestedEndTime: input.requestedEndTime,
      durationMinutes: input.durationMinutes,
      serviceType: input.serviceType,
      customerTier: input.customerTier,
    },
    ktvCapacity: {
      maxDailyBookings: ktvProfile.max_daily_bookings || 8,
      maxConcurrentSessions: 1, // Default: 1 session at a time
      minBreakMinutes: capacityConfig.minBreakMinutes || 15,
      workingHours: {
        start: capacityConfig.workingHoursStart || '08:00',
        end: capacityConfig.workingHoursEnd || '20:00',
      },
      peakHours: capacityConfig.enablePeakHours ? {
        start: capacityConfig.peakHoursStart || '12:00',
        end: capacityConfig.peakHoursEnd || '18:00',
        maxBookings: capacityConfig.peakHoursMaxBookings || 6,
      } : undefined,
    },
    existingBookings: mappedBookings,
    tenantCapacity: {
      bufferPercentage: capacityConfig.bufferPercentage || 10,
      enablePeakHourManagement: capacityConfig.enablePeakHours || false,
      enforceBreakTimes: capacityConfig.enforceBreakTimes !== false, // Default: true
    },
  };

  // 6. Call Capacity Management Provider
  const provider = new CapacityManagementProvider({ debug: false });
  const result: CapacityCheckOutput = await provider.checkCapacity(capacityInput);

  // 7. Map alternatives if available
  const mappedAlternatives = result.alternatives?.map(alt => ({
    suggestedDate: alt.suggestedDate || input.requestedDate,
    suggestedTime: alt.suggestedTime,
    reason: alt.reason,
  }));

  // 8. Return standardized result
  return {
    available: result.available,
    capacityDetails: result.capacityDetails,
    conflicts: result.conflicts,
    alternatives: mappedAlternatives,
    executionTime: result.executionTime,
  };
}

/**
 * Auto-assign optimal KTV using Phase 1 Auto-Assignment Provider
 * 
 * Scoring factors:
 * - Skill matching (25 points)
 * - Availability (20 points)
 * - Workload balance (20 points)
 * - Performance rating (15 points)
 * - Customer preference (10 points)
 * - Specialization match (10 points)
 * 
 * @param input - Assignment parameters
 * @returns Assignment result with assigned KTV and alternatives
 * 
 * @example
 * ```typescript
 * const result = await autoAssignKtv({
 *   tenantId: 'tenant-001',
 *   customerId: 'customer-123',
 *   serviceId: 'service-456',
 *   serviceType: 'Massage',
 *   requestedDate: '2026-07-15',
 *   requestedStartTime: '14:00',
 *   durationMinutes: 90,
 *   customerTier: 'vip',
 *   preferredKtvId: 'ktv-789', // Optional
 * });
 * 
 * if (result.assignedKtvId) {
 *   console.log('Assigned to:', result.assignedKtvName);
 *   console.log('Confidence:', result.confidence);
 * }
 * ```
 */
export async function autoAssignKtv(input: {
  tenantId: string;
  customerId: string;
  serviceId: string;
  serviceType: string;
  requestedDate: string;
  requestedStartTime: string;
  durationMinutes: number;
  customerTier: 'vip' | 'loyal' | 'new';
  preferredKtvId?: string;
}): Promise<{
  assignedKtvId: string | null;
  assignedKtvName?: string;
  confidence: number;
  reason: string;
  alternatives?: Array<{
    ktvId: string;
    ktvName: string;
    score: number;
    reason: string;
  }>;
  executionTime: number;
}> {
  const supabase = await createClient();

  // 1. Fetch available KTV candidates
  const { data: ktvList } = await supabase
    .from('users')
    .select('id, full_name, position, skills, specializations, avg_rating, years_of_service, max_daily_bookings')
    .eq('tenant_id', input.tenantId)
    .eq('role', 'ktv')
    .eq('is_active', true);

  if (!ktvList || ktvList.length === 0) {
    return {
      assignedKtvId: null,
      confidence: 0,
      reason: 'Không có KTV nào khả dụng',
      executionTime: 0,
    };
  }

  // 2. Fetch customer history with KTVs
  const { data: customerHistory } = await supabase
    .from('bookings')
    .select('assigned_ktv_id')
    .eq('customer_id', input.customerId)
    .eq('tenant_id', input.tenantId)
    .not('assigned_ktv_id', 'is', null);

  const ktvHistory: Record<string, number> = {};
  (customerHistory || []).forEach(booking => {
    const ktvId = booking.assigned_ktv_id;
    if (ktvId) {
      ktvHistory[ktvId] = (ktvHistory[ktvId] || 0) + 1;
    }
  });

  // 3. For each KTV, fetch today's workload and check availability
  const candidatesPromises = ktvList.map(async (ktv) => {
    // Count bookings today
    const { data: todayBookings } = await supabase
      .from('session_logs')
      .select('id')
      .eq('completed_by_ktv_id', ktv.id)
      .eq('assigned_date', input.requestedDate)
      .in('status', ['pending', 'confirmed', 'in_progress']);

    const currentWorkload = todayBookings?.length || 0;
    const maxDailyBookings = ktv.max_daily_bookings || 8;

    // Check availability at requested time (simple check: not overloaded)
    const isAvailable = currentWorkload < maxDailyBookings;

    const candidate: KtvCandidate = {
      id: ktv.id,
      name: ktv.full_name || 'Unknown',
      position: ktv.position || 'KTV',
      yearsOfService: ktv.years_of_service || 0,
      skills: (ktv.skills as string[]) || [],
      specializations: (ktv.specializations as string[]) || [],
      avgRating: ktv.avg_rating || 0,
      currentWorkload,
      maxDailyBookings,
      availability: {
        isAvailable,
        nextAvailableSlot: undefined, // TODO: Implement slot calculation
      },
      isPreferredByCustomer: ktv.id === input.preferredKtvId,
      customerBookingCount: ktvHistory[ktv.id] || 0,
    };

    return candidate;
  });

  const candidates = await Promise.all(candidatesPromises);

  // 4. Build assignment input
  const assignmentInput: AutoAssignmentInput = {
    tenantId: input.tenantId,
    booking: {
      customerId: input.customerId,
      serviceId: input.serviceId,
      serviceType: input.serviceType,
      requestedDate: input.requestedDate,
      requestedStartTime: input.requestedStartTime,
      durationMinutes: input.durationMinutes,
    },
    customer: {
      tier: input.customerTier,
      preferredKtvId: input.preferredKtvId,
      ktvHistory,
    },
    constraints: {
      minRating: input.customerTier === 'vip' ? 4.0 : undefined,
    },
  };

  // 5. Call Auto-Assignment Provider
  const provider = new AutoAssignmentProvider({ debug: false });
  const result: AutoAssignmentOutput = await provider.evaluate(assignmentInput, candidates);

  // 6. Get assigned KTV name
  const assignedKtv = result.assignedKtvId
    ? candidates.find(c => c.id === result.assignedKtvId)
    : null;

  // 7. Map alternatives with KTV names
  const mappedAlternatives = result.alternatives?.map(alt => {
    const ktvCandidate = candidates.find(c => c.id === alt.ktvId);
    return {
      ktvId: alt.ktvId,
      ktvName: ktvCandidate?.name || 'Unknown',
      score: alt.score,
      reason: alt.reason,
    };
  });

  // 8. Return standardized result
  return {
    assignedKtvId: result.assignedKtvId,
    assignedKtvName: assignedKtv?.name,
    confidence: result.confidence,
    reason: result.reason,
    alternatives: mappedAlternatives,
    executionTime: result.executionTime,
  };
}

/**
 * Check booking conflicts using Conflict Detection Provider
 * 
 * Detects 5 types of conflicts:
 * - Customer double-booking (blocking)
 * - Room/bed conflicts (blocking)
 * - Equipment conflicts (blocking)
 * - Package sequence violations (blocking)
 * - VIP slot protection (blocking/warning)
 * 
 * @param input - Conflict check parameters
 * @returns Conflict detection result with details and suggestions
 * 
 * @example
 * ```typescript
 * const result = await checkBookingConflicts({
 *   tenantId: 'tenant-001',
 *   customerId: 'customer-123',
 *   ktvId: 'ktv-456',
 *   roomId: 'room-001',
 *   equipmentIds: ['equipment-001'],
 *   packageId: 'package-789',
 *   sessionNumber: 2,
 *   requestedDate: '2026-07-15',
 *   requestedStartTime: '14:00',
 *   requestedEndTime: '15:30',
 *   durationMinutes: 90,
 *   serviceType: 'Massage',
 *   customerTier: 'loyal',
 * });
 * 
 * if (result.hasConflicts) {
 *   const blocking = result.conflicts.filter(c => c.severity === 'blocking');
 *   if (blocking.length > 0) {
 *     console.error('Booking blocked:', blocking[0].message);
 *   }
 * }
 * ```
 */
export async function checkBookingConflicts(input: {
  tenantId: string;
  customerId: string;
  ktvId?: string;
  roomId?: string;
  equipmentIds?: string[];
  packageId?: string;
  sessionNumber?: number;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  durationMinutes: number;
  serviceType: string;
  customerTier: 'vip' | 'loyal' | 'new';
}): Promise<{
  hasConflicts: boolean;
  severity: 'blocking' | 'warning' | 'info';
  conflicts: Array<{
    type: string;
    severity: 'blocking' | 'warning' | 'info';
    message: string;
    resource: {
      type: string;
      id: string;
      name: string;
    };
  }>;
  suggestions: Array<{
    type: string;
    message: string;
    priority: number;
  }>;
  executionTime: number;
}> {
  const supabase = await createClient();

  // 1. Fetch existing customer bookings
  const { data: customerBookings } = await supabase
    .from('session_logs')
    .select('id, assigned_date, assigned_time, duration_minutes, status')
    .eq('tenant_id', input.tenantId)
    .eq('customer_id', input.customerId)
    .eq('assigned_date', input.requestedDate)
    .in('status', ['pending', 'confirmed', 'in_progress']);

  // 2. Fetch existing room bookings (if room specified)
  let roomBookings: any[] = [];
  if (input.roomId) {
    const { data } = await supabase
      .from('booking_resources')
      .select('id, booking_id, assigned_time, duration_minutes, status')
      .eq('tenant_id', input.tenantId)
      .eq('resource_type', 'room')
      .eq('resource_id', input.roomId)
      .eq('assigned_date', input.requestedDate)
      .in('status', ['pending', 'confirmed']);

    roomBookings = data || [];
  }

  // 3. Fetch existing equipment bookings (if equipment specified)
  let equipmentBookings: any[] = [];
  if (input.equipmentIds && input.equipmentIds.length > 0) {
    const { data } = await supabase
      .from('booking_resources')
      .select('id, booking_id, resource_id, assigned_time, duration_minutes, status')
      .eq('tenant_id', input.tenantId)
      .eq('resource_type', 'equipment')
      .in('resource_id', input.equipmentIds)
      .eq('assigned_date', input.requestedDate)
      .in('status', ['pending', 'confirmed']);

    equipmentBookings = data || [];
  }

  // 4. Fetch package sessions (if package specified)
  let packageSessions: any[] = [];
  if (input.packageId) {
    const { data } = await supabase
      .from('session_logs')
      .select('id, session_number, assigned_date, status')
      .eq('tenant_id', input.tenantId)
      .eq('package_id', input.packageId)
      .eq('customer_id', input.customerId)
      .order('session_number', { ascending: true });

    packageSessions = data || [];
  }

  // 5. Fetch VIP slots
  const { data: vipSlots } = await supabase
    .from('vip_slots')
    .select('id, date, start_time, end_time, reserved_for')
    .eq('tenant_id', input.tenantId)
    .eq('date', input.requestedDate);

  // 6. Build Conflict Detection input
  const conflictInput: ConflictDetectionInput = {
    tenantId: input.tenantId,
    booking: {
      customerId: input.customerId,
      ktvId: input.ktvId,
      roomId: input.roomId,
      equipmentIds: input.equipmentIds,
      packageId: input.packageId,
      sessionNumber: input.sessionNumber,
      requestedDate: input.requestedDate,
      requestedStartTime: input.requestedStartTime,
      requestedEndTime: input.requestedEndTime,
      durationMinutes: input.durationMinutes,
      serviceType: input.serviceType,
      customerTier: input.customerTier,
    },
    existingBookings: {
      customerBookings: (customerBookings || []).map(b => ({
        id: b.id,
        customerId: input.customerId,
        startTime: b.assigned_time || '00:00',
        endTime: calculateEndTime(b.assigned_time || '00:00', b.duration_minutes || 90),
        status: b.status as 'confirmed' | 'pending' | 'cancelled',
      })),
      roomBookings: roomBookings.map(b => ({
        id: b.id,
        roomId: input.roomId!,
        startTime: b.assigned_time || '00:00',
        endTime: calculateEndTime(b.assigned_time || '00:00', b.duration_minutes || 90),
        status: b.status as 'confirmed' | 'pending' | 'cancelled',
      })),
      equipmentBookings: equipmentBookings.map(b => ({
        id: b.id,
        equipmentId: b.resource_id,
        startTime: b.assigned_time || '00:00',
        endTime: calculateEndTime(b.assigned_time || '00:00', b.duration_minutes || 90),
        status: b.status as 'confirmed' | 'pending' | 'cancelled',
      })),
      packageSessions: packageSessions.map(s => ({
        packageId: input.packageId!,
        sessionNumber: s.session_number || 0,
        status: s.status as 'completed' | 'pending' | 'cancelled',
        date: s.assigned_date || '',
      })),
      vipSlots: (vipSlots || []).map(slot => ({
        date: slot.date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        reservedFor: slot.reserved_for as 'vip',
      })),
    },
    config: {
      detectCustomerDoubleBooking: true,
      detectRoomConflicts: true,
      detectEquipmentConflicts: true,
      validatePackageSequence: true,
      enforceVipSlotProtection: true,
    },
  };

  // 7. Call Conflict Detection Provider
  const provider = new ConflictDetectionProvider();
  const result: ConflictDetectionOutput = await provider.detectConflicts(conflictInput);

  // 8. Return standardized result
  return {
    hasConflicts: result.hasConflicts,
    severity: result.severity,
    conflicts: result.conflicts.map(c => ({
      type: c.type,
      severity: c.severity,
      message: c.message,
      resource: c.resource,
    })),
    suggestions: result.suggestions.map(s => ({
      type: s.type,
      message: s.message,
      priority: s.priority,
    })),
    executionTime: result.executionTime,
  };
}

/**
 * Helper: Calculate end time from start time and duration
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}
