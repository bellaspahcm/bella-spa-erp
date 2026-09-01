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
  constructor() {
    // No reasoner needed - detect conflicts directly
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
      // Enrich knowledge with computed facts
      const enriched = await this.enrichKnowledge(input);

      // Detect all conflicts manually
      const conflicts = this.detectAllConflicts(enriched, input);

      // Determine overall severity
      const severity = this.determineSeverity(conflicts);

      // Generate resolution suggestions
      const suggestions = this.generateResolutions(conflicts, input);

      // Get matched rule IDs from conflicts
      const matchedRules = this.buildMatchedRules(conflicts);

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
   * Enrich knowledge with computed facts
   */
  private async enrichKnowledge(
    input: ConflictDetectionInput
  ): Promise<ConflictDetectionInput> {
    // Just return input with computed checks
    return input;
  }

  /**
   * Detect all conflicts based on enriched data
   */
  private detectAllConflicts(
    enriched: ConflictDetectionInput,
    input: ConflictDetectionInput
  ): ConflictDetail[] {
    const conflicts: ConflictDetail[] = [];

    // Check customer double-booking (Rule 200)
    if (input.config.detectCustomerDoubleBooking) {
      if (this.checkCustomerTimeOverlap(input)) {
        conflicts.push({
          type: 'customer_double_booking',
          severity: 'blocking',
          message: 'Customer đã có lịch hẹn trùng thời gian',
          resource: {
            type: 'customer',
            id: input.booking.customerId,
            name: 'Customer',
          },
          conflictingBooking: this.findCustomerConflictingBooking(input),
          rule: 'conflict-200-customer-double-booking',
          context: {
            ruleDescription: 'Customer must not have overlapping bookings at the same time',
            rulePriority: 200,
          },
        });
      }

      // Check close bookings (Rule 201)
      if (this.checkCloseBookings(input)) {
        conflicts.push({
          type: 'customer_double_booking',
          severity: 'warning',
          message: 'Customer có lịch hẹn gần nhau (trong vòng 30 phút)',
          resource: {
            type: 'customer',
            id: input.booking.customerId,
            name: 'Customer',
          },
          conflictingBooking: this.findCustomerConflictingBooking(input),
          rule: 'conflict-201-customer-close-bookings',
          context: {
            ruleDescription: 'Warn if customer has bookings within 30 minutes of each other',
            rulePriority: 201,
          },
        });
      }
    }

    // Check room conflicts (Rule 210-211)
    if (input.config.detectRoomConflicts && input.booking.roomId) {
      if (this.checkRoomConflict(input)) {
        conflicts.push({
          type: 'room_unavailable',
          severity: 'blocking',
          message: 'Phòng/giường đã được đặt cho khung giờ này',
          resource: {
            type: 'room',
            id: input.booking.roomId,
            name: `Room ${input.booking.roomId}`,
          },
          conflictingBooking: this.findRoomConflictingBooking(input),
          rule: 'conflict-210-room-double-booking',
          context: {
            ruleDescription: 'Room/bed must be available at requested time',
            rulePriority: 210,
          },
        });
      }

      if (this.checkRoomTurnoverTime(input)) {
        conflicts.push({
          type: 'room_unavailable',
          severity: 'warning',
          message: 'Phòng cần thời gian dọn dẹp (15 phút) trước lịch hẹn tiếp theo',
          resource: {
            type: 'room',
            id: input.booking.roomId,
            name: `Room ${input.booking.roomId}`,
          },
          conflictingBooking: this.findRoomConflictingBooking(input),
          rule: 'conflict-211-room-turnover-time',
          context: {
            ruleDescription: 'Room requires 15-minute turnover time between bookings',
            rulePriority: 211,
          },
        });
      }
    }

    // Check equipment conflicts (Rule 220-221)
    if (input.config.detectEquipmentConflicts && input.booking.equipmentIds && input.booking.equipmentIds.length > 0) {
      if (this.checkEquipmentConflict(input)) {
        conflicts.push({
          type: 'equipment_unavailable',
          severity: 'blocking',
          message: 'Thiết bị chuyên dụng đã được sử dụng cho khung giờ này',
          resource: {
            type: 'equipment',
            id: input.booking.equipmentIds[0],
            name: `Equipment ${input.booking.equipmentIds[0]}`,
          },
          conflictingBooking: this.findEquipmentConflictingBooking(input),
          rule: 'conflict-220-equipment-unavailable',
          context: {
            ruleDescription: 'Specialized equipment must not be in use at requested time',
            rulePriority: 220,
          },
        });
      }
    }

    // Check package sequence (Rule 230-231)
    if (input.config.validatePackageSequence && input.booking.packageId) {
      if (this.checkPackageSequence(input)) {
        conflicts.push({
          type: 'package_sequence_violation',
          severity: 'blocking',
          message: 'Phải hoàn thành các ca trước mới được đặt ca này',
          resource: {
            type: 'package',
            id: input.booking.packageId,
            name: `Package ${input.booking.packageId}`,
          },
          conflictingBooking: this.findPackageConflictingSession(input),
          rule: 'conflict-230-package-sequence-violation',
          context: {
            ruleDescription: 'Package sessions must be completed in order (session 1 before 2, etc.)',
            rulePriority: 230,
          },
        });
      }

      if (this.checkPackageInterval(input)) {
        conflicts.push({
          type: 'package_sequence_violation',
          severity: 'warning',
          message: 'Nên cách ít nhất 24 giờ giữa các ca trong gói',
          resource: {
            type: 'package',
            id: input.booking.packageId,
            name: `Package ${input.booking.packageId}`,
          },
          conflictingBooking: this.findPackageConflictingSession(input),
          rule: 'conflict-231-package-min-interval',
          context: {
            ruleDescription: 'Minimum 24 hours required between package sessions',
            rulePriority: 231,
          },
        });
      }
    }

    // Check VIP slot protection (Rule 240-241)
    if (input.config.enforceVipSlotProtection) {
      if (input.booking.customerTier !== 'vip' && this.checkVipSlot(input)) {
        conflicts.push({
          type: 'vip_slot_protected',
          severity: 'blocking',
          message: 'Khung giờ này dành riêng cho khách hàng VIP',
          resource: {
            type: 'vip_slot',
            id: 'vip-slot',
            name: 'VIP Slot',
          },
          conflictingBooking: { id: 'vip-slot', date: input.booking.requestedDate, startTime: input.booking.requestedStartTime, endTime: input.booking.requestedEndTime, status: 'reserved' },
          rule: 'conflict-240-vip-slot-protected',
          context: {
            ruleDescription: 'Certain time slots are reserved for VIP customers only',
            rulePriority: 240,
          },
        });
      }

      if (input.booking.customerTier === 'new' && this.checkPrimeTimeSlot(input)) {
        conflicts.push({
          type: 'vip_slot_protected',
          severity: 'warning',
          message: 'Khung giờ vàng này ưu tiên cho khách hàng VIP và Loyal',
          resource: {
            type: 'vip_slot',
            id: 'prime-time',
            name: 'Prime Time Slot',
          },
          conflictingBooking: { id: 'prime-time', date: input.booking.requestedDate, startTime: input.booking.requestedStartTime, endTime: input.booking.requestedEndTime, status: 'reserved' },
          rule: 'conflict-241-prime-time-vip-priority',
          context: {
            ruleDescription: 'VIP customers get priority for prime time slots',
            rulePriority: 241,
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * Build matched rule IDs from conflicts
   */
  private buildMatchedRules(conflicts: ConflictDetail[]): string[] {
    return conflicts.map(c => c.rule);
  }

  /**
   * Find customer conflicting booking
   */
  private findCustomerConflictingBooking(input: ConflictDetectionInput): { id: string; date: string; startTime: string; endTime: string; status: string } {
    const { requestedStartTime, requestedEndTime } = input.booking;
    return input.existingBookings.customerBookings?.find((b) =>
      this.hasTimeOverlap(requestedStartTime, requestedEndTime, b.startTime, b.endTime)
    ) ?? this.requestedSlotFallback(input);
  }

  /**
   * Find room conflicting booking
   */
  private findRoomConflictingBooking(input: ConflictDetectionInput): { id: string; date: string; startTime: string; endTime: string; status: string } {
    const { roomId, requestedStartTime, requestedEndTime } = input.booking;
    const found = input.existingBookings.roomBookings?.find((b) =>
      b.roomId === roomId &&
      this.hasTimeOverlap(requestedStartTime, requestedEndTime, b.startTime, b.endTime)
    );
    if (!found) return this.requestedSlotFallback(input);
    return {
      id: found.id,
      date: found.date,
      startTime: found.startTime,
      endTime: found.endTime,
      status: found.status,
    };
  }

  /**
   * Find equipment conflicting booking
   */
  private findEquipmentConflictingBooking(input: ConflictDetectionInput): { id: string; date: string; startTime: string; endTime: string; status: string } {
    const { equipmentIds, requestedStartTime, requestedEndTime } = input.booking;
    const found = input.existingBookings.equipmentBookings?.find((b) =>
      equipmentIds?.includes(b.equipmentId) &&
      this.hasTimeOverlap(requestedStartTime, requestedEndTime, b.startTime, b.endTime)
    );
    if (!found) return this.requestedSlotFallback(input);
    return {
      id: found.id,
      date: found.date,
      startTime: found.startTime,
      endTime: found.endTime,
      status: found.status,
    };
  }

  /**
   * Find package conflicting session
   */
  private findPackageConflictingSession(input: ConflictDetectionInput): { id: string; date: string; startTime: string; endTime: string; status: string } {
    const session = input.existingBookings.packageSessions?.[0];
    if (!session) return this.requestedSlotFallback(input);
    return {
      id: session.id,
      date: session.date,
      startTime: '00:00',
      endTime: '23:59',
      status: session.status,
    };
  }

  private requestedSlotFallback(input: ConflictDetectionInput): { id: string; date: string; startTime: string; endTime: string; status: string } {
    return {
      id: `requested-${input.booking.customerId}-${input.booking.requestedDate}-${input.booking.requestedStartTime}`,
      date: input.booking.requestedDate,
      startTime: input.booking.requestedStartTime,
      endTime: input.booking.requestedEndTime,
      status: 'requested',
    };
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
      // Gap LESS THAN 30 minutes (not equal to 30)
      const gapBefore = requestedStart - bookingEnd;
      const gapAfter = bookingStart - requestedEnd;

      return (
        (gapBefore > 0 && gapBefore < 30) ||
        (gapAfter > 0 && gapAfter < 30)
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
