/**
 * Conflict Detection Provider
 * 
 * Detects cross-booking conflicts:
 * - Customer double-booking
 * - Room/bed conflicts
 * - Equipment conflicts
 * - Package sequence violations
 * - VIP slot protection
 * 
 * @module decision-engine/providers/booking
 */

import { RuleReasoner } from '@/lib/decision-engine/rule-reasoner';
import { CONFLICT_DETECTION_RULES } from './rules/conflict-rules';
import type {
  ConflictDetectionInput,
  ConflictDetectionOutput,
  ConflictDetectionKnowledge,
  ConflictDetectionEvaluationOptions,
  ConflictDetail,
  ConflictResolution,
  ConflictType,
} from './types';

/**
 * Conflict Detection Provider
 * 
 * Detects conflicts before booking creation.
 */
export class ConflictDetectionProvider {
  private readonly reasoner: RuleReasoner;

  constructor() {
    this.reasoner = new RuleReasoner();
  }

  /**
   * Detect conflicts for booking request
   * 
   * @param input - Conflict detection input
   * @param options - Evaluation options
   * @returns Conflict detection result
   */
  async detectConflicts(
    input: ConflictDetectionInput,
    options: ConflictDetectionEvaluationOptions = {}
  ): Promise<ConflictDetectionOutput> {
    const startTime = performance.now();

    try {
      // Build knowledge base from input
      const knowledge = this.buildKnowledge(input);

      // Add computed facts
      const enrichedKnowledge = await this.enrichKnowledge(knowledge, input);

      // Evaluate rules
      const ruleResults = await this.reasoner.evaluate(
        enrichedKnowledge,
        CONFLICT_DETECTION_RULES
      );

      // Extract conflicts from triggered rules
      const conflicts = this.extractConflicts(ruleResults, input);

      // Determine overall severity
      const severity = this.determineSeverity(conflicts);

      // Generate resolution suggestions
      const suggestions = this.generateResolutions(conflicts, input);

      // Get matched rule IDs
      const matchedRules = ruleResults
        .filter((r) => r.triggered)
        .map((r) => r.rule.id);

      const executionTime = performance.now() - startTime;

      return {
        hasConflicts: conflicts.length > 0,
        success: conflicts.length === 0,
        conflicts,
        severity,
        suggestions,
        matchedRules,
        executionTime,
        provider: 'ConflictDetectionProvider',
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      console.error('[ConflictDetectionProvider] Error:', error);

      return {
        hasConflicts: false,
        success: false,
        conflicts: [],
        severity: 'info',
        suggestions: [],
        matchedRules: [],
        executionTime,
        provider: 'ConflictDetectionProvider',
      };
    }
  }

  /**
   * Build knowledge base from input
   */
  private buildKnowledge(input: ConflictDetectionInput): ConflictDetectionKnowledge {
    return {
      tenantId: input.tenantId,
      customerId: input.booking.customerId,
      ktvId: input.booking.ktvId,
      roomId: input.booking.roomId,
      equipmentIds: input.booking.equipmentIds || [],
      packageId: input.booking.packageId,
      sessionNumber: input.booking.sessionNumber,
      requestedDate: input.booking.requestedDate,
      requestedStartTime: input.booking.requestedStartTime,
      requestedEndTime: input.booking.requestedEndTime,
      durationMinutes: input.booking.durationMinutes,
      serviceType: input.booking.serviceType,
      'customer.tier': input.booking.customerTier,
      'config.detectCustomerDoubleBooking': input.config.detectCustomerDoubleBooking,
      'config.detectRoomConflicts': input.config.detectRoomConflicts,
      'config.detectEquipmentConflicts': input.config.detectEquipmentConflicts,
      'config.validatePackageSequence': input.config.validatePackageSequence,
      'config.enforceVipSlotProtection': input.config.enforceVipSlotProtection,
    };
  }

  /**
   * Enrich knowledge with computed facts
   */
  private async enrichKnowledge(
    knowledge: ConflictDetectionKnowledge,
    input: ConflictDetectionInput
  ): Promise<ConflictDetectionKnowledge> {
    const enriched = { ...knowledge };

    // Add existing bookings for rule evaluation
    enriched.existingCustomerBookings = input.existingBookings.customerBookings || [];
    enriched.existingRoomBookings = input.existingBookings.roomBookings || [];
    enriched.existingEquipmentBookings = input.existingBookings.equipmentBookings || [];
    enriched.existingPackageSessions = input.existingBookings.packageSessions || [];
    enriched.existingVipSlots = input.existingBookings.vipSlots || [];

    // Check for customer time overlaps
    enriched.hasCustomerTimeOverlap = this.checkCustomerTimeOverlap(input);

    // Check for close bookings (within 30 minutes)
    enriched.hasCloseBookings = this.checkCloseBookings(input);

    // Check for room conflicts
    if (input.booking.roomId) {
      enriched.hasRoomConflict = this.checkRoomConflict(input);
      enriched.hasInsufficientTurnoverTime = this.checkRoomTurnoverTime(input);
    }

    // Check for equipment conflicts
    if (input.booking.equipmentIds && input.booking.equipmentIds.length > 0) {
      enriched.hasEquipmentConflict = this.checkEquipmentConflict(input);
      enriched.isMaintenanceWindow = this.checkMaintenanceWindow(input);
    }

    // Check for package sequence violations
    if (input.booking.packageId) {
      enriched.hasSequenceViolation = this.checkPackageSequence(input);
      enriched.hasInsufficientInterval = this.checkPackageInterval(input);
    }

    // Check for VIP slot protection
    enriched.isVipSlot = this.checkVipSlot(input);
    enriched.isPrimeTimeSlot = this.checkPrimeTimeSlot(input);

    return enriched;
  }

  /**
   * Check if customer has overlapping booking
   */
  private checkCustomerTimeOverlap(input: ConflictDetectionInput): boolean {
    const { requestedStartTime, requestedEndTime } = input.booking;
    const { customerBookings } = input.existingBookings;

    if (!customerBookings || customerBookings.length === 0) return false;

    return customerBookings.some((booking) => {
      if (booking.status === 'cancelled') return false;

      return this.hasTimeOverlap(
        requestedStartTime,
        requestedEndTime,
        booking.startTime,
        booking.endTime
      );
    });
  }

  /**
   * Check if customer has bookings within 30 minutes
   */
  private checkCloseBookings(input: ConflictDetectionInput): boolean {
    const { requestedStartTime, requestedEndTime } = input.booking;
    const { customerBookings } = input.existingBookings;

    if (!customerBookings || customerBookings.length === 0) return false;

    const requestedStart = this.timeToMinutes(requestedStartTime);
    const requestedEnd = this.timeToMinutes(requestedEndTime);

    return customerBookings.some((booking) => {
      if (booking.status === 'cancelled') return false;

      const bookingStart = this.timeToMinutes(booking.startTime);
      const bookingEnd = this.timeToMinutes(booking.endTime);

      // Check if within 30 minutes before or after (but not overlapping)
      const gapBefore = requestedStart - bookingEnd;
      const gapAfter = bookingStart - requestedEnd;

      return (
        (gapBefore > 0 && gapBefore <= 30) ||
        (gapAfter > 0 && gapAfter <= 30)
      );
    });
  }

  /**
   * Check if room has conflict
   */
  private checkRoomConflict(input: ConflictDetectionInput): boolean {
    const { roomId, requestedStartTime, requestedEndTime } = input.booking;
    const { roomBookings } = input.existingBookings;

    if (!roomId || !roomBookings || roomBookings.length === 0) return false;

    return roomBookings.some((booking) => {
      if (booking.roomId !== roomId) return false;
      if (booking.status === 'cancelled') return false;

      return this.hasTimeOverlap(
        requestedStartTime,
        requestedEndTime,
        booking.startTime,
        booking.endTime
      );
    });
  }

  /**
   * Check if room has insufficient turnover time
   */
  private checkRoomTurnoverTime(input: ConflictDetectionInput): boolean {
    const TURNOVER_MINUTES = 15;
    const { roomId, requestedStartTime } = input.booking;
    const { roomBookings } = input.existingBookings;

    if (!roomId || !roomBookings || roomBookings.length === 0) return false;

    const requestedStart = this.timeToMinutes(requestedStartTime);

    return roomBookings.some((booking) => {
      if (booking.roomId !== roomId) return false;
      if (booking.status === 'cancelled') return false;

      const bookingEnd = this.timeToMinutes(booking.endTime);
      const gap = requestedStart - bookingEnd;

      return gap > 0 && gap < TURNOVER_MINUTES;
    });
  }

  /**
   * Check if equipment has conflict
   */
  private checkEquipmentConflict(input: ConflictDetectionInput): boolean {
    const { equipmentIds, requestedStartTime, requestedEndTime } = input.booking;
    const { equipmentBookings } = input.existingBookings;

    if (!equipmentIds || equipmentIds.length === 0) return false;
    if (!equipmentBookings || equipmentBookings.length === 0) return false;

    return equipmentBookings.some((booking) => {
      if (!equipmentIds.includes(booking.equipmentId)) return false;
      if (booking.status === 'cancelled') return false;

      return this.hasTimeOverlap(
        requestedStartTime,
        requestedEndTime,
        booking.startTime,
        booking.endTime
      );
    });
  }

  /**
   * Check if equipment is in maintenance window
   */
  private checkMaintenanceWindow(input: ConflictDetectionInput): boolean {
    // TODO: Implement equipment maintenance schedule check
    // This would query equipment maintenance table
    // For now, return false
    return false;
  }

  /**
   * Check for package sequence violation
   */
  private checkPackageSequence(input: ConflictDetectionInput): boolean {
    const { packageId, sessionNumber } = input.booking;
    const { packageSessions } = input.existingBookings;

    if (!packageId || !sessionNumber) return false;
    if (!packageSessions || packageSessions.length === 0) return false;

    // Get completed sessions
    const completedSessions = packageSessions
      .filter((s) => s.packageId === packageId && s.status === 'completed')
      .map((s) => s.sessionNumber)
      .sort((a, b) => a - b);

    // Check if all previous sessions are completed
    for (let i = 1; i < sessionNumber; i++) {
      if (!completedSessions.includes(i)) {
        return true; // Sequence violation: missing previous session
      }
    }

    return false;
  }

  /**
   * Check for insufficient interval between package sessions
   */
  private checkPackageInterval(input: ConflictDetectionInput): boolean {
    const MIN_INTERVAL_HOURS = 24;
    const { packageId, requestedDate } = input.booking;
    const { packageSessions } = input.existingBookings;

    if (!packageId) return false;
    if (!packageSessions || packageSessions.length === 0) return false;

    // Get last completed session
    const lastSession = packageSessions
      .filter((s) => s.packageId === packageId && s.status === 'completed')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (!lastSession) return false;

    // Calculate hours between last session and requested date
    const lastDate = new Date(lastSession.date);
    const requestedDateObj = new Date(requestedDate);
    const hoursDiff = (requestedDateObj.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

    return hoursDiff < MIN_INTERVAL_HOURS;
  }

  /**
   * Check if slot is VIP-reserved
   */
  private checkVipSlot(input: ConflictDetectionInput): boolean {
    const { requestedDate, requestedStartTime } = input.booking;
    const { vipSlots } = input.existingBookings;

    if (!vipSlots || vipSlots.length === 0) return false;

    return vipSlots.some((slot) => {
      if (slot.date !== requestedDate) return false;
      if (slot.reservedFor !== 'vip') return false;

      const slotStart = this.timeToMinutes(slot.startTime);
      const slotEnd = this.timeToMinutes(slot.endTime);
      const requestedStart = this.timeToMinutes(requestedStartTime);

      return requestedStart >= slotStart && requestedStart < slotEnd;
    });
  }

  /**
   * Check if slot is prime time (morning 8-11, evening 18-20)
   */
  private checkPrimeTimeSlot(input: ConflictDetectionInput): boolean {
    const { requestedStartTime } = input.booking;
    const startMinutes = this.timeToMinutes(requestedStartTime);

    const morningStart = 8 * 60; // 08:00
    const morningEnd = 11 * 60;   // 11:00
    const eveningStart = 18 * 60; // 18:00
    const eveningEnd = 20 * 60;   // 20:00

    return (
      (startMinutes >= morningStart && startMinutes < morningEnd) ||
      (startMinutes >= eveningStart && startMinutes < eveningEnd)
    );
  }

  /**
   * Check if two time ranges overlap
   */
  private hasTimeOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);

    return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
  }

  /**
   * Convert time string (HH:mm) to minutes
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Extract conflicts from rule results
   */
  private extractConflicts(
    ruleResults: Array<{ rule: any; triggered: boolean; event?: any }>,
    input: ConflictDetectionInput
  ): ConflictDetail[] {
    const conflicts: ConflictDetail[] = [];

    for (const result of ruleResults) {
      if (!result.triggered || !result.event) continue;

      const { type, params } = result.event;
      if (type !== 'conflict-detected' && type !== 'conflict-warning') continue;

      const conflict = this.buildConflictDetail(result.rule, params, input);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Build conflict detail from rule and params
   */
  private buildConflictDetail(
    rule: any,
    params: any,
    input: ConflictDetectionInput
  ): ConflictDetail | null {
    const conflictType = params.conflictType as ConflictType;
    const severity = params.severity as 'blocking' | 'warning' | 'info';
    const message = params.message;

    // Find conflicting booking based on conflict type
    const conflictingBooking = this.findConflictingBooking(conflictType, input);
    if (!conflictingBooking) return null;

    // Determine resource details
    const resource = this.getResourceDetails(conflictType, input);

    return {
      type: conflictType,
      severity,
      message,
      resource,
      conflictingBooking,
      rule: rule.id,
      context: {
        ruleDescription: rule.description,
        rulePriority: rule.priority,
      },
    };
  }

  /**
   * Find conflicting booking based on conflict type
   */
  private findConflictingBooking(
    conflictType: ConflictType,
    input: ConflictDetectionInput
  ): any {
    const { requestedStartTime, requestedEndTime } = input.booking;

    switch (conflictType) {
      case 'customer_double_booking':
        return input.existingBookings.customerBookings?.find((b) =>
          this.hasTimeOverlap(requestedStartTime, requestedEndTime, b.startTime, b.endTime)
        );

      case 'room_unavailable':
        return input.existingBookings.roomBookings?.find((b) =>
          b.roomId === input.booking.roomId &&
          this.hasTimeOverlap(requestedStartTime, requestedEndTime, b.startTime, b.endTime)
        );

      case 'equipment_unavailable':
        return input.existingBookings.equipmentBookings?.find((b) =>
          input.booking.equipmentIds?.includes(b.equipmentId) &&
          this.hasTimeOverlap(requestedStartTime, requestedEndTime, b.startTime, b.endTime)
        );

      case 'package_sequence_violation':
        return input.existingBookings.packageSessions?.[0];

      case 'vip_slot_protected':
        return { id: 'vip-slot', date: input.booking.requestedDate, startTime: requestedStartTime, endTime: requestedEndTime, status: 'reserved' };

      default:
        return null;
    }
  }

  /**
   * Get resource details based on conflict type
   */
  private getResourceDetails(
    conflictType: ConflictType,
    input: ConflictDetectionInput
  ): ConflictDetail['resource'] {
    switch (conflictType) {
      case 'customer_double_booking':
        return {
          type: 'customer',
          id: input.booking.customerId,
          name: 'Customer',
        };

      case 'room_unavailable':
        return {
          type: 'room',
          id: input.booking.roomId || '',
          name: `Room ${input.booking.roomId}`,
        };

      case 'equipment_unavailable':
        return {
          type: 'equipment',
          id: input.booking.equipmentIds?.[0] || '',
          name: `Equipment ${input.booking.equipmentIds?.[0]}`,
        };

      case 'package_sequence_violation':
        return {
          type: 'package',
          id: input.booking.packageId || '',
          name: `Package ${input.booking.packageId}`,
        };

      case 'vip_slot_protected':
        return {
          type: 'vip_slot',
          id: 'vip-slot',
          name: 'VIP Slot',
        };

      default:
        return {
          type: 'customer',
          id: input.booking.customerId,
          name: 'Unknown Resource',
        };
    }
  }

  /**
   * Determine overall severity from conflicts
   */
  private determineSeverity(conflicts: ConflictDetail[]): 'blocking' | 'warning' | 'info' {
    if (conflicts.length === 0) return 'info';

    const hasBlocking = conflicts.some((c) => c.severity === 'blocking');
    if (hasBlocking) return 'blocking';

    const hasWarning = conflicts.some((c) => c.severity === 'warning');
    if (hasWarning) return 'warning';

    return 'info';
  }

  /**
   * Generate resolution suggestions
   */
  private generateResolutions(
    conflicts: ConflictDetail[],
    input: ConflictDetectionInput
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      const conflictResolutions = this.generateResolutionsForConflict(conflict, input);
      resolutions.push(...conflictResolutions);
    }

    // Sort by priority (highest first)
    return resolutions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate resolutions for specific conflict
   */
  private generateResolutionsForConflict(
    conflict: ConflictDetail,
    input: ConflictDetectionInput
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    switch (conflict.type) {
      case 'customer_double_booking':
        resolutions.push({
          type: 'reschedule',
          message: 'Đặt lịch vào thời gian khác',
          action: {
            type: 'reschedule',
            parameters: {
              newTime: this.suggestAlternativeTime(input),
            },
          },
          priority: 9,
          automatic: true,
        });
        break;

      case 'room_unavailable':
        resolutions.push({
          type: 'change_resource',
          message: 'Chọn phòng khác',
          action: {
            type: 'change_room',
          },
          priority: 8,
          automatic: false,
        });
        break;

      case 'equipment_unavailable':
        resolutions.push({
          type: 'change_resource',
          message: 'Sử dụng thiết bị thay thế',
          action: {
            type: 'change_equipment',
          },
          priority: 7,
          automatic: false,
        });
        break;

      case 'vip_slot_protected':
        resolutions.push({
          type: 'reschedule',
          message: 'Chọn khung giờ khác (không dành riêng cho VIP)',
          action: {
            type: 'reschedule',
          },
          priority: 6,
          automatic: false,
        });
        break;
    }

    return resolutions;
  }

  /**
   * Suggest alternative time slot
   */
  private suggestAlternativeTime(input: ConflictDetectionInput): string {
    // Simple logic: suggest 2 hours later
    const currentMinutes = this.timeToMinutes(input.booking.requestedStartTime);
    const newMinutes = currentMinutes + 120; // +2 hours
    const hours = Math.floor(newMinutes / 60);
    const minutes = newMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
}
