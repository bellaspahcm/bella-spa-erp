/**
 * Capacity Management Provider
 * 
 * Phase 2 of Booking Engine - Real-time capacity tracking and overbooking prevention.
 * 
 * Features:
 * - Daily capacity limits (prevent burnout)
 * - Time overlap detection (prevent double-booking)
 * - Concurrent session limits (physical constraint)
 * - Break time enforcement (quality & compliance)
 * - Working hours validation (operating constraints)
 * - Buffer slot management (VIP priority)
 * - Peak hour management (demand optimization)
 * 
 * Architecture Compliance:
 * - ✅ Provider-based (follows Platform pattern)
 * - ✅ Stateless (no instance state)
 * - ✅ Business logic in Provider (not Engine)
 * - ✅ Returns standard result format
 * - ✅ Fully auditable via observability
 * 
 * @module decision-engine/providers/booking
 */

import { RuleReasoner } from '../../RuleReasoner';
import type { Policy, Knowledge } from '../../types';
import { capacityRules } from './rules/capacity-rules';
import type {
  CapacityCheckInput,
  CapacityCheckOutput,
  CapacityKnowledge,
  CapacityEvaluationOptions,
  CapacitySnapshot,
} from './types';

/**
 * Capacity Management Provider
 * 
 * Evaluates capacity availability and prevents overbooking.
 * Uses rule-based decision logic with multiple capacity checks.
 * 
 * Process:
 * 1. Validate input (required fields)
 * 2. Calculate current capacity state
 * 3. Check time overlaps
 * 4. Check concurrent sessions
 * 5. Check break times
 * 6. Evaluate rules (daily limit, buffer, peak hour)
 * 7. Generate alternatives if not available
 * 8. Return capacity decision
 */
export class CapacityManagementProvider {
  private readonly reasoner: RuleReasoner;
  private readonly policy: Policy;

  constructor(options?: { debug?: boolean }) {
    this.reasoner = new RuleReasoner({ debug: options?.debug });
    
    // Create policy from capacity rules
    this.policy = {
      id: 'booking-capacity-policy',
      version: '1.0.0',
      name: 'Capacity Management Policy',
      description: 'Evaluates capacity availability and prevents overbooking',
      rules: capacityRules
        .filter(r => r.enabled)
        .map(rule => ({
          id: rule.id,
          priority: rule.priority,
          conditions: this.convertConditionToReasoner(rule.condition),
          action: {
            outcome: typeof rule.action === 'function'
              ? 'APPROVE'
              : rule.action.type === 'reject' ? 'REJECT' : 
                rule.action.type === 'modify' ? 'ESCALATE' : 'APPROVE',
            reason: rule.name,
            metadata: typeof rule.action === 'function' ? undefined : rule.action.data,
          },
        })),
    };
  }

  /**
   * Check capacity for booking request
   * 
   * @param input - Capacity check input
   * @param options - Evaluation options
   * @returns Capacity check output
   */
  async checkCapacity(
    input: CapacityCheckInput,
    options?: CapacityEvaluationOptions
  ): Promise<CapacityCheckOutput> {
    const startTime = performance.now();

    // Step 1: Validate input
    this.validateInput(input);

    // Step 2: Calculate capacity state
    const capacityState = this.calculateCapacityState(input);

    // Step 3: Check conflicts
    const conflicts = this.detectConflicts(input, capacityState);

    // Step 4: Enrich knowledge for rule evaluation
    const knowledge = this.enrichKnowledge(input, capacityState, conflicts);

    // Step 5: Evaluate rules (rules primarily for logging/audit, conflicts are primary check)
    const ruleResult = this.reasoner.evaluate(this.policy, knowledge as Knowledge);

    // Step 6: Determine availability (conflicts are the source of truth)
    const available = conflicts.length === 0;

    // Step 7: Generate alternatives if not available
    const alternatives = !available && !options?.checkOnly
      ? this.generateAlternatives(input, capacityState, conflicts)
      : undefined;

    // Step 8: Calculate execution time
    const endTime = performance.now();
    const executionTime = Number((endTime - startTime).toFixed(2));

    // Step 9: Build result (map conflict types to rule IDs)
    const matchedRules = available ? [] : this.buildMatchedRules(conflicts);

    return {
      available,
      success: true,
      reason: available
        ? 'Capacity available for booking'
        : this.buildRejectionReason(conflicts, ruleResult),
      matchedRules,
      capacityDetails: {
        currentBookings: capacityState.currentBookings,
        maxBookings: capacityState.maxBookings,
        utilizationPercentage: capacityState.utilizationPercentage,
        bufferSlotsUsed: capacityState.bufferSlotsUsed,
        bufferSlotsAvailable: capacityState.bufferSlotsAvailable,
        isPeakHour: capacityState.isPeakHour,
      },
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      alternatives,
      executionTime,
      provider: 'CapacityManagementProvider',
      confidence: available ? 1.0 : 0.0,
    };
  }

  /**
   * Generate capacity snapshot
   * 
   * @param input - Capacity check input
   * @returns Capacity snapshot
   */
  generateSnapshot(input: CapacityCheckInput): CapacitySnapshot {
    const capacityState = this.calculateCapacityState(input);
    const hour = this.extractHour(input.booking.requestedStartTime);

    return {
      id: `${input.tenantId}-${input.ktvId}-${input.booking.requestedDate}-${hour}`,
      tenantId: input.tenantId,
      ktvId: input.ktvId,
      date: input.booking.requestedDate,
      hour,
      totalCapacity: capacityState.maxBookings,
      bookingsCount: capacityState.currentBookings,
      utilizationPercentage: capacityState.utilizationPercentage,
      bufferSlotsUsed: capacityState.bufferSlotsUsed,
      isPeakHour: capacityState.isPeakHour,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Validate input
   * @private
   */
  private validateInput(input: CapacityCheckInput): void {
    if (!input.tenantId) {
      throw new Error('tenantId is required');
    }
    if (!input.ktvId) {
      throw new Error('ktvId is required');
    }
    if (!input.booking?.requestedDate) {
      throw new Error('booking.requestedDate is required');
    }
    if (!input.booking?.requestedStartTime) {
      throw new Error('booking.requestedStartTime is required');
    }
    if (!input.booking?.requestedEndTime) {
      throw new Error('booking.requestedEndTime is required');
    }
    if (!input.ktvCapacity?.maxDailyBookings) {
      throw new Error('ktvCapacity.maxDailyBookings is required');
    }
  }

  /**
   * Calculate capacity state
   * @private
   */
  private calculateCapacityState(input: CapacityCheckInput): {
    currentBookings: number;
    maxBookings: number;
    utilizationPercentage: number;
    bufferSlotsUsed: number;
    bufferSlotsAvailable: number;
    isPeakHour: boolean;
  } {
    // Count current bookings (exclude cancelled)
    const currentBookings = input.existingBookings.filter(
      b => b.status !== 'cancelled'
    ).length;

    // Determine max bookings (peak hour or normal)
    const isPeakHour = this.isPeakHour(
      input.booking.requestedStartTime,
      input.ktvCapacity.peakHours
    );

    const maxBookings = isPeakHour && input.ktvCapacity.peakHours?.maxBookings
      ? input.ktvCapacity.peakHours.maxBookings
      : input.ktvCapacity.maxDailyBookings;

    // Calculate utilization
    const utilizationPercentage = (currentBookings / maxBookings) * 100;

    // Calculate buffer slots
    const bufferPercentage = input.tenantCapacity?.bufferPercentage || 10;
    const totalBufferSlots = Math.ceil((bufferPercentage / 100) * maxBookings);
    const bufferThreshold = maxBookings - totalBufferSlots;
    const bufferSlotsUsed = Math.max(0, currentBookings - bufferThreshold);
    const bufferSlotsAvailable = Math.max(0, totalBufferSlots - bufferSlotsUsed);

    return {
      currentBookings,
      maxBookings,
      utilizationPercentage,
      bufferSlotsUsed,
      bufferSlotsAvailable,
      isPeakHour,
    };
  }

  /**
   * Detect conflicts
   * @private
   */
  private detectConflicts(
    input: CapacityCheckInput,
    capacityState: { currentBookings: number; maxBookings: number }
  ): Array<{
    type: 'time_overlap' | 'concurrent_limit' | 'break_time_violation' | 'daily_limit' | 'outside_working_hours';
    reason: string;
    conflictingBooking?: { id: string; startTime: string; endTime: string };
  }> {
    const conflicts: Array<any> = [];

    // Check 1: Daily limit
    if (capacityState.currentBookings >= capacityState.maxBookings) {
      conflicts.push({
        type: 'daily_limit',
        reason: `KTV has reached maximum daily bookings (${capacityState.maxBookings})`,
      });
    }

    // Check 2: Time overlaps
    const timeOverlaps = this.findTimeOverlaps(
      input.booking.requestedStartTime,
      input.booking.requestedEndTime,
      input.existingBookings
    );

    timeOverlaps.forEach(booking => {
      conflicts.push({
        type: 'time_overlap',
        reason: `Time overlaps with existing booking`,
        conflictingBooking: {
          id: booking.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
        },
      });
    });

    // Check 3: Concurrent sessions
    const concurrentCount = this.countConcurrentSessions(
      input.booking.requestedStartTime,
      input.booking.requestedEndTime,
      input.existingBookings
    );

    if (concurrentCount >= (input.ktvCapacity.maxConcurrentSessions || 1)) {
      conflicts.push({
        type: 'concurrent_limit',
        reason: `Concurrent session limit exceeded (${concurrentCount}/${input.ktvCapacity.maxConcurrentSessions})`,
      });
    }

    // Check 4: Break time violations
    if (input.tenantCapacity?.enforceBreakTimes && input.ktvCapacity.minBreakMinutes) {
      const breakViolations = this.findBreakTimeViolations(
        input.booking.requestedStartTime,
        input.booking.requestedEndTime,
        input.existingBookings,
        input.ktvCapacity.minBreakMinutes
      );

      breakViolations.forEach(booking => {
        conflicts.push({
          type: 'break_time_violation',
          reason: `Insufficient break time (min: ${input.ktvCapacity.minBreakMinutes} minutes)`,
          conflictingBooking: {
            id: booking.id,
            startTime: booking.startTime,
            endTime: booking.endTime,
          },
        });
      });
    }

    // Check 5: Working hours
    if (!this.isWithinWorkingHours(
      input.booking.requestedStartTime,
      input.booking.requestedEndTime,
      input.ktvCapacity.workingHours
    )) {
      conflicts.push({
        type: 'outside_working_hours',
        reason: `Booking outside working hours (${input.ktvCapacity.workingHours.start} - ${input.ktvCapacity.workingHours.end})`,
      });
    }

    return conflicts;
  }

  /**
   * Find time overlaps
   * @private
   */
  private findTimeOverlaps(
    requestedStart: string,
    requestedEnd: string,
    existingBookings: Array<any>
  ): Array<any> {
    return existingBookings.filter(booking => {
      // Skip cancelled bookings
      if (booking.status === 'cancelled') return false;

      // Check for overlap
      return this.timeRangesOverlap(
        requestedStart,
        requestedEnd,
        booking.startTime,
        booking.endTime
      );
    });
  }

  /**
   * Count concurrent sessions
   * @private
   */
  private countConcurrentSessions(
    requestedStart: string,
    requestedEnd: string,
    existingBookings: Array<any>
  ): number {
    return existingBookings.filter(booking => {
      if (booking.status === 'cancelled') return false;
      return this.timeRangesOverlap(
        requestedStart,
        requestedEnd,
        booking.startTime,
        booking.endTime
      );
    }).length;
  }

  /**
   * Find break time violations
   * @private
   */
  private findBreakTimeViolations(
    requestedStart: string,
    requestedEnd: string,
    existingBookings: Array<any>,
    minBreakMinutes: number
  ): Array<any> {
    const violations: Array<any> = [];

    existingBookings.forEach(booking => {
      if (booking.status === 'cancelled') return;

      // Check gap before requested booking
      const gapBefore = this.calculateTimeDifference(booking.endTime, requestedStart);
      if (gapBefore >= 0 && gapBefore < minBreakMinutes) {
        violations.push(booking);
      }

      // Check gap after requested booking
      const gapAfter = this.calculateTimeDifference(requestedEnd, booking.startTime);
      if (gapAfter >= 0 && gapAfter < minBreakMinutes) {
        violations.push(booking);
      }
    });

    return violations;
  }

  /**
   * Check if time ranges overlap
   * @private
   */
  private timeRangesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    // Convert HH:mm to minutes for comparison
    const start1Min = this.timeToMinutes(start1);
    const end1Min = this.timeToMinutes(end1);
    const start2Min = this.timeToMinutes(start2);
    const end2Min = this.timeToMinutes(end2);

    // Check for overlap
    return start1Min < end2Min && end1Min > start2Min;
  }

  /**
   * Check if within working hours
   * @private
   */
  private isWithinWorkingHours(
    requestedStart: string,
    requestedEnd: string,
    workingHours: { start: string; end: string }
  ): boolean {
    const startMin = this.timeToMinutes(requestedStart);
    const endMin = this.timeToMinutes(requestedEnd);
    const workStartMin = this.timeToMinutes(workingHours.start);
    const workEndMin = this.timeToMinutes(workingHours.end);

    return startMin >= workStartMin && endMin <= workEndMin;
  }

  /**
   * Check if peak hour
   * @private
   */
  private isPeakHour(
    requestedStart: string,
    peakHours?: { start: string; end: string; maxBookings: number }
  ): boolean {
    if (!peakHours) return false;

    const startMin = this.timeToMinutes(requestedStart);
    const peakStartMin = this.timeToMinutes(peakHours.start);
    const peakEndMin = this.timeToMinutes(peakHours.end);

    return startMin >= peakStartMin && startMin < peakEndMin;
  }

  /**
   * Convert time to minutes
   * @private
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Calculate time difference in minutes
   * @private
   */
  private calculateTimeDifference(time1: string, time2: string): number {
    return this.timeToMinutes(time2) - this.timeToMinutes(time1);
  }

  /**
   * Extract hour from time
   * @private
   */
  private extractHour(time: string): number {
    return parseInt(time.split(':')[0], 10);
  }

  /**
   * Generate alternatives
   * @private
   */
  private generateAlternatives(
    input: CapacityCheckInput,
    capacityState: any,
    conflicts: Array<any>
  ): Array<{
    timeSlot: string;
    ktvId?: string;
    reason: string;
  }> {
    const alternatives: Array<any> = [];

    // If daily limit exceeded, suggest next day
    if (conflicts.some(c => c.type === 'daily_limit')) {
      alternatives.push({
        timeSlot: 'Next day at same time',
        reason: 'KTV at capacity today, available tomorrow',
      });
    }

    // If time overlap, suggest next available slot
    if (conflicts.some(c => c.type === 'time_overlap' || c.type === 'break_time_violation')) {
      const nextAvailable = this.findNextAvailableSlot(
        input.booking.requestedStartTime,
        input.booking.durationMinutes,
        input.existingBookings,
        input.ktvCapacity
      );

      if (nextAvailable) {
        alternatives.push({
          timeSlot: nextAvailable,
          reason: 'Next available time slot for this KTV',
        });
      }
    }

    // If buffer slots issue, suggest off-peak
    if (capacityState.utilizationPercentage > 85) {
      alternatives.push({
        timeSlot: 'Off-peak hours (before 10:00 or after 18:00)',
        reason: 'Lower demand during off-peak hours',
      });
    }

    return alternatives.slice(0, 3); // Return max 3 alternatives
  }

  /**
   * Find next available slot
   * @private
   */
  private findNextAvailableSlot(
    preferredStart: string,
    durationMinutes: number,
    existingBookings: Array<any>,
    ktvCapacity: any
  ): string | null {
    // Simple implementation: try slots every 30 minutes
    let currentTime = this.timeToMinutes(preferredStart);
    const workEnd = this.timeToMinutes(ktvCapacity.workingHours.end);

    while (currentTime < workEnd) {
      currentTime += 30; // Try next 30-minute slot

      const startTime = this.minutesToTime(currentTime);
      const endTime = this.minutesToTime(currentTime + durationMinutes);

      // Check if this slot is available
      const hasConflict = existingBookings.some(booking => {
        if (booking.status === 'cancelled') return false;
        return this.timeRangesOverlap(
          startTime,
          endTime,
          booking.startTime,
          booking.endTime
        );
      });

      if (!hasConflict) {
        return startTime;
      }
    }

    return null;
  }

  /**
   * Convert minutes to time
   * @private
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Build matched rules from conflicts
   * @private
   */
  private buildMatchedRules(conflicts: Array<any>): string[] {
    const ruleMap: Record<string, string> = {
      daily_limit: 'booking-capacity-daily-limit',
      time_overlap: 'booking-capacity-time-overlap',
      concurrent_limit: 'booking-capacity-concurrent-limit',
      break_time_violation: 'booking-capacity-break-time',
      outside_working_hours: 'booking-capacity-working-hours',
    };

    return conflicts.map(c => ruleMap[c.type] || 'capacity-check-failed');
  }

  /**
   * Build rejection reason
   * @private
   */
  private buildRejectionReason(conflicts: Array<any>, ruleResult: any): string {
    if (conflicts.length === 0) {
      return ruleResult.explanation || 'Capacity not available';
    }

    const reasons = conflicts.map(c => c.reason);
    return reasons.join('; ');
  }

  /**
   * Enrich knowledge for rule evaluation
   * @private
   */
  private enrichKnowledge(
    input: CapacityCheckInput,
    capacityState: any,
    conflicts: Array<any>
  ): CapacityKnowledge {
    return {
      tenantId: input.tenantId,
      ktvId: input.ktvId,
      requestedDate: input.booking.requestedDate,
      requestedStartTime: input.booking.requestedStartTime,
      requestedEndTime: input.booking.requestedEndTime,
      durationMinutes: input.booking.durationMinutes,
      'customer.tier': input.booking.customerTier,
      'ktv.maxDailyBookings': input.ktvCapacity.maxDailyBookings,
      'ktv.maxConcurrentSessions': input.ktvCapacity.maxConcurrentSessions || 1,
      'ktv.minBreakMinutes': input.ktvCapacity.minBreakMinutes || 0,
      'ktv.currentBookings': capacityState.currentBookings,
      'ktv.utilizationPercentage': capacityState.utilizationPercentage,
      'ktv.isPeakHour': capacityState.isPeakHour,
      'tenant.bufferPercentage': input.tenantCapacity?.bufferPercentage || 10,
      'tenant.enforceBreakTimes': input.tenantCapacity?.enforceBreakTimes || false,
      hasTimeOverlap: conflicts.some(c => c.type === 'time_overlap'),
      hasBreakTimeViolation: conflicts.some(c => c.type === 'break_time_violation'),
      exceedsDailyLimit: conflicts.some(c => c.type === 'daily_limit'),
      exceedsConcurrentLimit: conflicts.some(c => c.type === 'concurrent_limit'),
      isWithinWorkingHours: !conflicts.some(c => c.type === 'outside_working_hours'),
    };
  }

  /**
   * Convert Platform Rule condition to RuleReasoner condition
   * @private
   */
  private convertConditionToReasoner(condition: any): any {
    if (condition.type === 'simple') {
      return {
        type: 'comparison',
        field: condition.field,
        operator: this.mapOperator(condition.operator),
        value: condition.value,
      };
    }

    if (condition.type === 'all') {
      return {
        type: 'operator',
        operator: 'and',
        conditions: condition.conditions.map((c: any) =>
          this.convertConditionToReasoner(c)
        ),
      };
    }

    if (condition.type === 'any') {
      return {
        type: 'operator',
        operator: 'or',
        conditions: condition.conditions.map((c: any) =>
          this.convertConditionToReasoner(c)
        ),
      };
    }

    throw new Error(`Unsupported condition type: ${condition.type}`);
  }

  /**
   * Map Platform operator to RuleReasoner operator
   * @private
   */
  private mapOperator(operator: string): string {
    const operatorMap: Record<string, string> = {
      equals: '===',
      notEquals: '!==',
      greaterThan: '>',
      greaterThanOrEqual: '>=',
      lessThan: '<',
      lessThanOrEqual: '<=',
    };

    return operatorMap[operator] || '===';
  }
}
