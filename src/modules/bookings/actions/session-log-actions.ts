'use server';

/**
 * Session Log Server Actions
 * 
 * Booking creation with integrated Decision Engine validation:
 * - Phase 2: Capacity Management (conflict detection)
 * - Phase 1: Auto-Assignment (optimal KTV selection)
 * 
 * Features:
 * - Real-time capacity check before creation
 * - Automated KTV assignment with scoring
 * - Manager override capability (skip validation)
 * - Comprehensive error handling
 * - Audit logging for observability
 * 
 * @module bookings/actions
 */

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import {
  checkBookingCapacity,
  autoAssignKtv,
  checkBookingConflicts,
} from '@/services/booking-decision.service';
import { DecisionEngineContext } from '@/lib/decision-engine/DecisionEngineContext';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateBookingInput {
  /** Booking ID (parent booking) */
  bookingId: string;
  
  /** Assigned date (YYYY-MM-DD) */
  assignedDate: string;
  
  /** Assigned time (HH:mm) */
  assignedTime: string;
  
  /** Assigned KTV ID (optional - will auto-assign if not provided) */
  assignedKtvId?: string;
  
  /** Customer ID */
  customerId: string;
  
  /** Service type (for auto-assignment matching) */
  serviceType: string;
  
  /** Duration in minutes */
  durationMinutes: number;
  
  /** Customer tier (vip/loyal/new) */
  customerTier: 'vip' | 'loyal' | 'new';
  
  /** Tenant ID */
  tenantId: string;
  
  /** Service/Package ID (for auto-assignment) */
  serviceId?: string;
  
  /** Room ID (for conflict detection) */
  roomId?: string;
  
  /** Equipment IDs (for conflict detection) */
  equipmentIds?: string[];
  
  /** Package ID (for sequence validation) */
  packageId?: string;
  
  /** Session number (for package sequence validation) */
  sessionNumber?: number;
  
  /** Skip capacity check (manager override) */
  skipCapacityCheck?: boolean;
  
  /** Skip conflict check (manager override) */
  skipConflictCheck?: boolean;
  
  /** Skip auto-assignment (KTV manually selected) */
  skipAutoAssignment?: boolean;
  
  /** Additional notes */
  notes?: string;
}

export interface CreateBookingResult {
  /** Was creation successful? */
  success: boolean;
  
  /** Created session log ID */
  sessionId?: string;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Capacity conflicts (if validation failed) */
  conflicts?: Array<{
    type: string;
    severity?: 'blocking' | 'warning' | 'info';
    reason?: string;
    message?: string;
    conflictingBooking?: {
      id: string;
      startTime: string;
      endTime: string;
    };
  }>;
  
  /** Resolution suggestions (if conflicts detected) */
  suggestions?: Array<{
    type: string;
    message: string;
    priority?: number;
  }>;
  
  /** Alternative time suggestions (if conflicts detected) */
  alternatives?: Array<{
    suggestedDate: string;
    suggestedTime: string;
    reason: string;
  }>;
  
  /** Auto-assignment result (if KTV was auto-assigned) */
  autoAssignment?: {
    assignedKtvId: string;
    assignedKtvName: string;
    confidence: number;
    reason: string;
  };
}

// ============================================================================
// MAIN ACTION
// ============================================================================

/**
 * Create booking session log with integrated Decision Engine validation
 * 
 * Process:
 * 1. Validate input
 * 2. Check capacity (unless skipped)
 * 3. Auto-assign KTV (if not provided and not skipped)
 * 4. Create session log in database
 * 5. Revalidate cache paths
 * 6. Return result with audit data
 * 
 * @param input - Booking creation parameters
 * @returns Creation result with session ID or conflicts
 * 
 * @example
 * ```typescript
 * const result = await createBookingWithValidation({
 *   bookingId: 'booking-123',
 *   assignedDate: '2026-07-15',
 *   assignedTime: '14:00',
 *   customerId: 'customer-456',
 *   serviceType: 'Massage',
 *   durationMinutes: 90,
 *   customerTier: 'vip',
 *   tenantId: 'tenant-001',
 * });
 * 
 * if (!result.success) {
 *   console.log('Conflicts:', result.conflicts);
 *   console.log('Alternatives:', result.alternatives);
 * }
 * ```
 */
export async function createBookingWithValidation(
  input: CreateBookingInput
): Promise<CreateBookingResult> {
  const startTime = performance.now();

  try {
    // Step 1: Validate input
    const validationError = validateInput(input);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Step 2: Initialize Supabase client
    const supabase = await createClient();

    // Get current user for audit
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized - User not authenticated' };
    }

    // Step 3: Verify booking exists and belongs to tenant
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, tenant_id, customer_id, status')
      .eq('id', input.bookingId)
      .single();

    if (bookingError || !booking) {
      return { success: false, error: 'Booking không tồn tại' };
    }

    if (booking.tenant_id !== input.tenantId) {
      return { success: false, error: 'Booking không thuộc chi nhánh này' };
    }

    // Step 4: Capacity Check (unless skipped)
    let finalKtvId = input.assignedKtvId;
    let autoAssignmentResult: CreateBookingResult['autoAssignment'];

    if (!input.skipCapacityCheck && finalKtvId) {
      // Calculate end time
      const startHour = parseInt(input.assignedTime.split(':')[0] || '0', 10);
      const startMinute = parseInt(input.assignedTime.split(':')[1] || '0', 10);
      const endTotalMinutes = startHour * 60 + startMinute + input.durationMinutes;
      const endHour = Math.floor(endTotalMinutes / 60);
      const endMinute = endTotalMinutes % 60;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      console.log('[CreateBooking] Checking capacity...', {
        bookingId: input.bookingId,
        ktvId: finalKtvId,
        date: input.assignedDate,
        time: `${input.assignedTime} - ${endTime}`,
      });

      // Create DecisionEngineContext for capacity check
      const capacityContext = DecisionEngineContext.create({
        providerType: 'capacity_management',
        operation: 'checkBookingCapacity',
        tenantId: input.tenantId,
        context: {
          entityId: input.bookingId,
          customerId: input.customerId,
          ktvId: finalKtvId,
        },
      });

      const capacityResult = await capacityContext.executeWithOutcome(
        () => checkBookingCapacity({
          tenantId: input.tenantId,
          ktvId: finalKtvId as string,
          requestedDate: input.assignedDate,
          requestedStartTime: input.assignedTime,
          requestedEndTime: endTime,
          durationMinutes: input.durationMinutes,
          customerTier: input.customerTier,
          serviceType: input.serviceType,
        }),
        (result: Awaited<ReturnType<typeof checkBookingCapacity>>) => ({
          success: result.available,
          outcome: result.available ? 'available' : 'full',
          metadata: {
            utilization_percent: result.capacityDetails.utilizationPercentage,
            buffer_used_percent: (result.capacityDetails.bufferSlotsUsed / (result.capacityDetails.bufferSlotsAvailable || 1)) * 100,
            conflicts_count: result.conflicts?.length || 0,
          },
        })
      );

      // If capacity not available, return conflicts
      if (!capacityResult.available) {
        console.log('[CreateBooking] Capacity check failed', {
          conflicts: capacityResult.conflicts?.length,
          alternatives: capacityResult.alternatives?.length,
        });

        return {
          success: false,
          error: 'Không thể tạo lịch hẹn do xung đột',
          conflicts: capacityResult.conflicts,
          alternatives: capacityResult.alternatives,
        };
      }

      console.log('[CreateBooking] Capacity check passed', {
        utilization: capacityResult.capacityDetails.utilizationPercentage,
        bufferUsed: capacityResult.capacityDetails.bufferSlotsUsed,
      });
    }

    // Step 4.5: Conflict Detection (unless skipped)
    if (!input.skipConflictCheck && finalKtvId) {
      // Calculate end time
      const startHour = parseInt(input.assignedTime.split(':')[0] || '0', 10);
      const startMinute = parseInt(input.assignedTime.split(':')[1] || '0', 10);
      const endTotalMinutes = startHour * 60 + startMinute + input.durationMinutes;
      const endHour = Math.floor(endTotalMinutes / 60);
      const endMinute = endTotalMinutes % 60;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      console.log('[CreateBooking] Checking conflicts...', {
        bookingId: input.bookingId,
        customerId: input.customerId,
        ktvId: finalKtvId,
        date: input.assignedDate,
        time: `${input.assignedTime} - ${endTime}`,
      });

      // Create DecisionEngineContext for conflict check
      const conflictContext = DecisionEngineContext.create({
        providerType: 'conflict_detection',
        operation: 'checkBookingConflicts',
        tenantId: input.tenantId,
        context: {
          entityId: input.bookingId,
          customerId: input.customerId,
          ktvId: finalKtvId,
        },
      });

      const conflictResult = await conflictContext.executeWithOutcome(
        () => checkBookingConflicts({
          tenantId: input.tenantId,
          customerId: input.customerId,
          ktvId: finalKtvId as string,
          roomId: input.roomId,
          equipmentIds: input.equipmentIds,
          packageId: input.packageId,
          sessionNumber: input.sessionNumber,
          requestedDate: input.assignedDate,
          requestedStartTime: input.assignedTime,
          requestedEndTime: endTime,
          durationMinutes: input.durationMinutes,
          serviceType: input.serviceType,
          customerTier: input.customerTier,
        }),
        (result: Awaited<ReturnType<typeof checkBookingConflicts>>) => {
          const blockingConflicts = result.conflicts.filter((c: { severity: string }) => c.severity === 'blocking');
          const warningConflicts = result.conflicts.filter((c: { severity: string }) => c.severity === 'warning');
          return {
            success: blockingConflicts.length === 0,
            outcome: blockingConflicts.length > 0 ? 'conflict_blocked' : 
                     warningConflicts.length > 0 ? 'conflict_warning' : 'no_conflict',
            metadata: {
              conflicts_count: result.conflicts.length,
              blocking_count: blockingConflicts.length,
              warning_count: warningConflicts.length,
              severity: blockingConflicts.length > 0 ? 'blocking' : 
                       warningConflicts.length > 0 ? 'warning' : 'none',
              conflicts: result.conflicts.map((c: { type: string; severity: string; message: string }) => ({
                type: c.type,
                severity: c.severity,
                message: c.message,
              })),
            },
          };
        }
      );

      // If blocking conflicts found, return error
      const blockingConflicts = conflictResult.conflicts.filter(c => c.severity === 'blocking');
      if (blockingConflicts.length > 0) {
        console.log('[CreateBooking] Conflict check failed', {
          blockingConflicts: blockingConflicts.length,
          warningConflicts: conflictResult.conflicts.filter(c => c.severity === 'warning').length,
        });

        return {
          success: false,
          error: 'Không thể tạo lịch hẹn do xung đột',
          conflicts: conflictResult.conflicts.map(c => ({
            type: c.type,
            severity: c.severity,
            message: c.message,
          })),
          suggestions: conflictResult.suggestions,
        };
      }

      // Log warning conflicts but allow booking
      const warningConflicts = conflictResult.conflicts.filter(c => c.severity === 'warning');
      if (warningConflicts.length > 0) {
        console.log('[CreateBooking] Warning conflicts detected (allowing booking)', {
          warnings: warningConflicts.map(c => c.message),
        });
      }

      console.log('[CreateBooking] Conflict check passed', {
        executionTime: conflictResult.executionTime,
      });
    }

    // Step 5: Auto-assign KTV (if not provided and not skipped)
    if (!finalKtvId && !input.skipAutoAssignment) {
      console.log('[CreateBooking] Auto-assigning KTV...', {
        bookingId: input.bookingId,
        serviceType: input.serviceType,
        customerTier: input.customerTier,
      });

      // Create DecisionEngineContext for auto-assignment
      const assignmentContext = DecisionEngineContext.create({
        providerType: 'auto_assignment',
        operation: 'autoAssignKtv',
        tenantId: input.tenantId,
        context: {
          entityId: input.bookingId,
          customerId: input.customerId,
        },
      });

      const assignmentResult = await assignmentContext.executeWithOutcome(
        () => autoAssignKtv({
          tenantId: input.tenantId,
          customerId: input.customerId,
          serviceId: input.serviceId || 'unknown',
          serviceType: input.serviceType,
          requestedDate: input.assignedDate,
          requestedStartTime: input.assignedTime,
          durationMinutes: input.durationMinutes,
          customerTier: input.customerTier,
        }),
        (result: Awaited<ReturnType<typeof autoAssignKtv>>) => ({
          success: !!result.assignedKtvId,
          outcome: result.assignedKtvId ? 'assigned' : 'no_ktv_found',
          metadata: {
            confidence: result.confidence,
            reason: result.reason,
            assigned_ktv_id: result.assignedKtvId,
            assigned_ktv_name: result.assignedKtvName,
          },
        })
      );

      if (!assignmentResult.assignedKtvId) {
        console.log('[CreateBooking] Auto-assignment failed', {
          reason: assignmentResult.reason,
        });

        return {
          success: false,
          error: `Không tìm thấy KTV phù hợp: ${assignmentResult.reason}`,
        };
      }

      finalKtvId = assignmentResult.assignedKtvId;
      autoAssignmentResult = {
        assignedKtvId: assignmentResult.assignedKtvId,
        assignedKtvName: assignmentResult.assignedKtvName || 'Unknown',
        confidence: assignmentResult.confidence,
        reason: assignmentResult.reason,
      };

      console.log('[CreateBooking] KTV auto-assigned', {
        ktvId: finalKtvId,
        ktvName: assignmentResult.assignedKtvName,
        confidence: assignmentResult.confidence,
      });
    }

    // Step 6: Create session log
    const { data: sessionLog, error: createError } = await supabase
      .from('session_logs')
      .insert({
        booking_id: input.bookingId,
        tenant_id: input.tenantId,
        assigned_date: input.assignedDate,
        assigned_time: input.assignedTime,
        completed_by_ktv_id: finalKtvId || null,
        status: 'pending',
        notes: input.notes || null,
        session_number: input.sessionNumber || 1,
      })
      .select('id')
      .single();

    if (createError || !sessionLog) {
      console.error('[CreateBooking] Database insert failed', createError);
      return {
        success: false,
        error: `Không thể tạo session log: ${createError?.message || 'Unknown error'}`,
      };
    }

    // Step 7: Revalidate cache paths
    revalidatePath('/dashboard/bookings');
    revalidatePath(`/dashboard/bookings/${input.bookingId}`);

    // Step 8: Log audit event
    const executionTime = Math.round(performance.now() - startTime);
    console.log('[CreateBooking] Success', {
      sessionId: sessionLog.id,
      bookingId: input.bookingId,
      ktvId: finalKtvId,
      autoAssigned: !!autoAssignmentResult,
      executionTimeMs: executionTime,
    });

    // Step 9: Return success result
    return {
      success: true,
      sessionId: sessionLog.id,
      autoAssignment: autoAssignmentResult,
    };
  } catch (error) {
    console.error('[CreateBooking] Unexpected error', error);
    return {
      success: false,
      error: `Lỗi hệ thống: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate input parameters
 * @private
 */
function validateInput(input: CreateBookingInput): string | null {
  if (!input.bookingId) {
    return 'bookingId is required';
  }

  if (!input.assignedDate) {
    return 'assignedDate is required';
  }

  if (!input.assignedTime) {
    return 'assignedTime is required';
  }

  if (!input.customerId) {
    return 'customerId is required';
  }

  if (!input.serviceType) {
    return 'serviceType is required';
  }

  if (!input.durationMinutes || input.durationMinutes <= 0) {
    return 'durationMinutes must be positive';
  }

  if (!input.customerTier) {
    return 'customerTier is required';
  }

  if (!input.tenantId) {
    return 'tenantId is required';
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(input.assignedDate)) {
    return 'assignedDate must be in YYYY-MM-DD format';
  }

  // Validate time format (HH:mm)
  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(input.assignedTime)) {
    return 'assignedTime must be in HH:mm format';
  }

  return null;
}

/**
 * Update existing session log (for rescheduling)
 * 
 * @param sessionId - Session log ID to update
 * @param updates - Fields to update
 * @returns Update result
 */
export async function updateSessionLog(
  sessionId: string,
  tenantId: string,
  updates: {
    assignedDate?: string;
    assignedTime?: string;
    assignedKtvId?: string;
    durationMinutes?: number;
    status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Update session log
    const { error: updateError } = await supabase
      .from('session_logs')
      .update({
        assigned_date: updates.assignedDate,
        assigned_time: updates.assignedTime,
        completed_by_ktv_id: updates.assignedKtvId,
        status: updates.status,
        notes: updates.notes,
      })
      .eq('id', sessionId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[UpdateSessionLog] Update failed', updateError);
      return { success: false, error: updateError.message };
    }

    // Revalidate paths
    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('[UpdateSessionLog] Unexpected error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete session log
 * 
 * @param sessionId - Session log ID to delete
 * @param tenantId - Tenant ID for security check
 * @returns Delete result
 */
export async function deleteSessionLog(
  sessionId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Delete session log
    const { error: deleteError } = await supabase
      .from('session_logs')
      .delete()
      .eq('id', sessionId)
      .eq('tenant_id', tenantId);

    if (deleteError) {
      console.error('[DeleteSessionLog] Delete failed', deleteError);
      return { success: false, error: deleteError.message };
    }

    // Revalidate paths
    revalidatePath('/dashboard/bookings');

    return { success: true };
  } catch (error) {
    console.error('[DeleteSessionLog] Unexpected error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
