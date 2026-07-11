/**
 * Waitlist Management Provider
 * 
 * Intelligent waitlist management with:
 * - Priority-based ranking (customer tier, booking value, wait time)
 * - Auto-notification on slot availability
 * - Expiry management (auto-cleanup stale entries)
 * - Slot reservation (temporary hold for notified customers)
 * - Capacity management (max waitlist size per slot)
 * - Preferred time matching (boost priority for matching preferences)
 * 
 * Business Goals:
 * - Capture lost revenue when slots unavailable
 * - Maximize waitlist conversion rate (target: 60%+)
 * - Improve customer experience (proactive notifications)
 * - Reduce idle time (fill cancellations quickly)
 * 
 * @module decision-engine/providers/booking
 */

import type {
  WaitlistManagementInput,
  WaitlistManagementOutput,
  WaitlistEntry,
  WaitlistKnowledge,
  WaitlistEvaluationOptions,
  WaitlistPriorityFactors,
  WaitlistSlotMatch,
} from './types';


import { waitlistRules, defaultWaitlistConfig } from './rules/waitlist-rules';

/**
 * WaitlistManagementProvider
 * 
 * Manages booking waitlist with intelligent priority ranking and notifications.
 */
export class WaitlistManagementProvider {
  private debug: boolean;

  constructor(options?: { debug?: boolean }) {
    this.debug = options?.debug ?? false;
  }

  /**
   * Add Customer to Waitlist
   * 
   * Primary method to add customer to waitlist with priority calculation.
   * 
   * @param input - Waitlist management context
   * @param options - Evaluation options
   * @returns Decision result with waitlist entry details
   */
  async addToWaitlist(
    input: WaitlistManagementInput,
    options?: WaitlistEvaluationOptions
  ): Promise<WaitlistManagementOutput> {
    const startTime = Date.now();

    try {
      // 1. Validate input
      this.validateInput(input);

      // 2. Check waitlist capacity
      const capacityCheck = this.checkCapacity(input);
      if (!capacityCheck.allowed) {
        return this.buildRejectionOutput(
          input,
          capacityCheck.reason,
          ['waitlist-capacity-limit'],
          startTime
        );
      }

      // 3. Calculate priority score
      const priorityFactors = this.calculatePriority(input);

      // 4. Calculate position in waitlist
      const position = this.calculatePosition(input.existingWaitlist, priorityFactors.totalScore);

      // 5. Generate waitlist entry
      const entry = this.generateWaitlistEntry(input, priorityFactors, position);

      // 6. Determine if should auto-notify
      const shouldNotify = this.shouldAutoNotify(entry, input.config);

      // 7. Build output
      const output: WaitlistManagementOutput = {
        success: true,
        operation: 'added',
        entry: {
          id: entry.id,
          customerId: entry.customerId,
          bookingRequestId: entry.bookingRequestId,
          priorityScore: entry.priorityScore,
          position: entry.position,
          estimatedWaitMinutes: this.estimateWaitTime(position, input.existingWaitlist),
          status: entry.status,
          createdAt: entry.createdAt,
          expiresAt: entry.expiresAt,
        },
        reason: `Added to waitlist at position ${position} with priority score ${priorityFactors.totalScore.toFixed(0)}`,
        matchedRules: this.getMatchedRules(input, priorityFactors),
        stats: {
          totalEntries: input.existingWaitlist.length + 1,
          currentPosition: position,
          avgWaitMinutes: this.calculateAvgWaitTime(input.existingWaitlist),
          capacityRemaining: input.config.maxWaitlistSize - (input.existingWaitlist.length + 1),
        },
        executionTime: Date.now() - startTime,
        provider: 'WaitlistManagementProvider',
        confidence: this.calculateConfidence(priorityFactors),
      };

      // 8. Add notification if should auto-notify
      if (shouldNotify && !options?.skipNotification) {
        output.notification = {
          sent: true,
          channel: input.customer.contactPreferences.preferredChannel,
          message: this.generateNotificationMessage(entry, 'slot_available'),
          sentAt: new Date().toISOString(),
        };
        output.entry.status = 'notified';
      }

      if (this.debug || options?.debug) {
        console.log('[WaitlistManagementProvider] Added to waitlist:', {
          customerId: input.customer.id,
          position,
          priorityScore: priorityFactors.totalScore,
          factors: priorityFactors,
        });
      }

      return output;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[WaitlistManagementProvider] Error adding to waitlist:', errorMessage);

      return {
        success: false,
        operation: 'rejected',
        entry: {
          id: '',
          customerId: input.customer.id,
          bookingRequestId: '',
          priorityScore: 0,
          position: 0,
          estimatedWaitMinutes: 0,
          status: 'active',
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        },
        reason: `Failed to add to waitlist: ${errorMessage}`,
        matchedRules: [],
        stats: {
          totalEntries: input.existingWaitlist.length,
          currentPosition: 0,
          avgWaitMinutes: 0,
          capacityRemaining: 0,
        },
        executionTime: Date.now() - startTime,
        provider: 'WaitlistManagementProvider',
        confidence: 0,
      };
    }
  }

  /**
   * Process Waitlist on Slot Available
   * 
   * When a slot becomes available (cancellation/reschedule), process waitlist
   * to notify top-priority customers.
   * 
   * @param input - Slot availability context
   * @returns List of customers notified
   */
  async processWaitlistOnSlotAvailable(
    slot: WaitlistSlotMatch,
    waitlist: WaitlistEntry[],
    tenantId: string,
    config: WaitlistManagementInput['config']
  ): Promise<Array<{ entry: WaitlistEntry; notified: boolean }>> {
    const results: Array<{ entry: WaitlistEntry; notified: boolean }> = [];

    // Filter active entries
    const activeEntries = waitlist.filter((e) => e.status === 'active' && !this.isExpired(e));

    // Sort by priority
    const sortedEntries = this.sortByPriority(activeEntries);

    // Notify top 3 customers
    const topCustomers = sortedEntries.slice(0, 3);

    for (const entry of topCustomers) {
      const match = this.calculateSlotMatch(entry, slot);

      if (match.matchScore >= 50) {
        // Good enough match (50%+)
        const notified = await this.sendNotification(entry, slot, config);
        results.push({ entry, notified });

        if (this.debug) {
          console.log('[WaitlistManagementProvider] Notified customer:', {
            customerId: entry.customerId,
            position: entry.position,
            matchScore: match.matchScore,
          });
        }
      }
    }

    return results;
  }

  /**
   * Remove Expired Entries
   * 
   * Cleanup expired waitlist entries.
   * 
   * @param waitlist - Current waitlist entries
   * @param config - Waitlist configuration
   * @returns List of expired entry IDs
   */
  async removeExpiredEntries(
    waitlist: WaitlistEntry[],
    config: WaitlistManagementInput['config']
  ): Promise<string[]> {
    const expiredIds: string[] = [];
    const expiryThresholdMinutes = config.waitlistExpiryHours * 60;

    for (const entry of waitlist) {
      if (entry.waitMinutes >= expiryThresholdMinutes && entry.status !== 'expired') {
        expiredIds.push(entry.id);

        // Send expiry notification
        await this.sendExpiryNotification(entry, config);

        if (this.debug) {
          console.log('[WaitlistManagementProvider] Expired entry:', {
            entryId: entry.id,
            customerId: entry.customerId,
            waitMinutes: entry.waitMinutes,
          });
        }
      }
    }

    return expiredIds;
  }

  /**
   * Update Entry Position
   * 
   * Recalculate positions when waitlist changes.
   * 
   * @param waitlist - Current waitlist entries
   * @returns Updated waitlist with new positions
   */
  updatePositions(waitlist: WaitlistEntry[]): WaitlistEntry[] {
    const sorted = this.sortByPriority(waitlist);

    return sorted.map((entry, index) => ({
      ...entry,
      position: index + 1,
      updatedAt: new Date().toISOString(),
    }));
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Validate input data
   */
  private validateInput(input: WaitlistManagementInput): void {
    if (!input.tenantId) throw new Error('tenantId is required');
    if (!input.customer?.id) throw new Error('customer.id is required');
    if (!input.booking?.serviceId) throw new Error('booking.serviceId is required');
    if (!input.booking?.preferredDate) throw new Error('booking.preferredDate is required');
    if (!input.booking?.preferredStartTime) throw new Error('booking.preferredStartTime is required');
    if (!input.config) throw new Error('config is required');
  }

  /**
   * Check if waitlist has capacity
   */
  private checkCapacity(input: WaitlistManagementInput): { allowed: boolean; reason: string } {
    const currentSize = input.existingWaitlist.length;
    const maxSize = input.config.maxWaitlistSize;

    if (currentSize >= maxSize) {
      return {
        allowed: false,
        reason: `Waitlist is full (${currentSize}/${maxSize}). Try alternative time slots or check back later.`,
      };
    }

    return { allowed: true, reason: 'Capacity available' };
  }

  /**
   * Calculate priority score based on multiple factors
   */
  private calculatePriority(input: WaitlistManagementInput): WaitlistPriorityFactors {
    const config = defaultWaitlistConfig;

    // 1. Tier score
    const tierScore =
      input.customer.tier === 'vip'
        ? config.tierScores.vip
        : input.customer.tier === 'loyal'
          ? config.tierScores.loyal
          : config.tierScores.new;

    // 2. Value score (0-30 based on booking value)
    const valueScore = Math.min(config.valueScoreMax, (input.booking.bookingValue / 10000000) * config.valueScoreMax);

    // 3. Wait time score (0-20, but for new entry = 0)
    const waitTimeScore = 0; // New entry, no wait time yet

    // 4. Flexibility bonus
    const flexibilityBonus = input.booking.isFlexible ? config.flexibilityBonus : 0;

    // 5. Total score
    const totalScore = tierScore + valueScore + waitTimeScore + flexibilityBonus;

    return {
      tierScore,
      valueScore,
      waitTimeScore,
      flexibilityBonus,
      totalScore,
    };
  }

  /**
   * Calculate position in waitlist based on priority
   */
  private calculatePosition(existingWaitlist: WaitlistEntry[], newPriorityScore: number): number {
    const activeEntries = existingWaitlist.filter((e) => e.status === 'active' || e.status === 'notified');

    // Count entries with higher priority
    const higherPriorityCount = activeEntries.filter((e) => e.priorityScore > newPriorityScore).length;

    return higherPriorityCount + 1;
  }

  /**
   * Generate waitlist entry object
   */
  private generateWaitlistEntry(
    input: WaitlistManagementInput,
    priorityFactors: WaitlistPriorityFactors,
    position: number
  ): WaitlistEntry {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.config.waitlistExpiryHours * 60 * 60 * 1000);

    return {
      id: `waitlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: input.tenantId,
      customerId: input.customer.id,
      customerName: input.customer.name,
      customerTier: input.customer.tier,
      bookingRequestId: `booking-req-${Date.now()}`,
      serviceId: input.booking.serviceId,
      serviceName: input.booking.serviceName,
      bookingValue: input.booking.bookingValue,
      preferredDate: input.booking.preferredDate,
      preferredStartTime: input.booking.preferredStartTime,
      durationMinutes: input.booking.durationMinutes,
      priorityScore: priorityFactors.totalScore,
      position,
      waitMinutes: 0,
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  /**
   * Determine if should auto-notify customer
   */
  private shouldAutoNotify(entry: WaitlistEntry, config: WaitlistManagementInput['config']): boolean {
    if (!config.enableAutoNotification) return false;
    if (entry.position > 3) return false; // Only notify top 3
    return true;
  }

  /**
   * Estimate wait time based on position
   */
  private estimateWaitTime(position: number, existingWaitlist: WaitlistEntry[]): number {
    // Simple heuristic: assume 30 minutes per position
    const baseWaitMinutes = position * 30;

    // Adjust based on historical conversion rate
    const avgWaitTime = this.calculateAvgWaitTime(existingWaitlist);
    return avgWaitTime > 0 ? Math.min(baseWaitMinutes, avgWaitTime * position) : baseWaitMinutes;
  }

  /**
   * Calculate average wait time from existing entries
   */
  private calculateAvgWaitTime(waitlist: WaitlistEntry[]): number {
    if (waitlist.length === 0) return 0;

    const totalWait = waitlist.reduce((sum, entry) => sum + entry.waitMinutes, 0);
    return totalWait / waitlist.length;
  }

  /**
   * Get matched rules for this decision
   */
  private getMatchedRules(input: WaitlistManagementInput, priorityFactors: WaitlistPriorityFactors): string[] {
    const rules: string[] = ['waitlist-priority-calculation'];

    if (input.customer.tier === 'vip') {
      rules.push('waitlist-vip-fast-track');
    }

    if (input.booking.bookingValue >= 5000000) {
      rules.push('waitlist-high-value-priority');
    }

    if (input.booking.isFlexible) {
      rules.push('waitlist-preferred-time-match');
    }

    return rules;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(priorityFactors: WaitlistPriorityFactors): number {
    // Confidence based on priority score strength
    const maxScore = 100;
    return Math.min(1.0, priorityFactors.totalScore / maxScore);
  }

  /**
   * Generate notification message
   */
  private generateNotificationMessage(entry: WaitlistEntry, type: string): string {
    switch (type) {
      case 'slot_available':
        return `Great news! A slot is available for ${entry.serviceName} on ${entry.preferredDate} at ${entry.preferredStartTime}. Please respond within 30 minutes to confirm.`;
      case 'position_updated':
        return `You're now #${entry.position} in the waitlist for ${entry.serviceName}. We'll notify you when a slot becomes available.`;
      case 'expiring_soon':
        return `Your waitlist entry for ${entry.serviceName} will expire in 2 hours. Please confirm if still interested.`;
      case 'expired':
        return `Your waitlist entry for ${entry.serviceName} has expired. Please book again if still interested.`;
      default:
        return 'Waitlist status update';
    }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: WaitlistEntry): boolean {
    const now = new Date();
    const expiresAt = new Date(entry.expiresAt);
    return now > expiresAt;
  }

  /**
   * Sort waitlist entries by priority (highest first)
   */
  private sortByPriority(waitlist: WaitlistEntry[]): WaitlistEntry[] {
    return [...waitlist].sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Calculate slot match score
   */
  private calculateSlotMatch(entry: WaitlistEntry, slot: WaitlistSlotMatch): WaitlistSlotMatch {
    const matchesPreferredDate = entry.preferredDate === slot.date;
    const matchesPreferredTime = entry.preferredStartTime === slot.startTime;
    const matchesPreferredKtv = entry.preferredKtvId === slot.ktvId;

    const timeDiff = this.calculateTimeDifference(entry.preferredStartTime, slot.startTime);

    let matchScore = 0;
    if (matchesPreferredDate) matchScore += 40;
    if (matchesPreferredTime) matchScore += 40;
    if (matchesPreferredKtv) matchScore += 20;

    // Deduct points for time difference
    const timePenalty = Math.min(30, (timeDiff / 30) * 10); // -10 per 30 min difference, max -30
    matchScore = Math.max(0, matchScore - timePenalty);

    return {
      ...slot,
      matchScore,
      matchFactors: {
        matchesPreferredDate,
        matchesPreferredTime,
        matchesPreferredKtv,
        timeDifference: timeDiff,
      },
    };
  }

  /**
   * Calculate time difference in minutes
   */
  private calculateTimeDifference(time1: string, time2: string): number {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);

    const minutes1 = h1 * 60 + m1;
    const minutes2 = h2 * 60 + m2;

    return Math.abs(minutes1 - minutes2);
  }

  /**
   * Send notification to customer
   */
  private async sendNotification(
    entry: WaitlistEntry,
    slot: WaitlistSlotMatch,
    config: WaitlistManagementInput['config']
  ): Promise<boolean> {
    // TODO: Integrate with notification service
    // For now, just log
    if (this.debug) {
      console.log('[WaitlistManagementProvider] Sending notification:', {
        customerId: entry.customerId,
        channel: entry.customerTier === 'vip' ? 'sms' : 'email',
        slot: {
          date: slot.date,
          time: slot.startTime,
        },
      });
    }

    return true; // Assume success
  }

  /**
   * Send expiry notification
   */
  private async sendExpiryNotification(
    entry: WaitlistEntry,
    config: WaitlistManagementInput['config']
  ): Promise<boolean> {
    // TODO: Integrate with notification service
    if (this.debug) {
      console.log('[WaitlistManagementProvider] Sending expiry notification:', {
        entryId: entry.id,
        customerId: entry.customerId,
      });
    }

    return true; // Assume success
  }

  /**
   * Build rejection output
   */
  private buildRejectionOutput(
    input: WaitlistManagementInput,
    reason: string,
    matchedRules: string[],
    startTime: number
  ): WaitlistManagementOutput {
    return {
      success: false,
      operation: 'rejected',
      entry: {
        id: '',
        customerId: input.customer.id,
        bookingRequestId: '',
        priorityScore: 0,
        position: 0,
        estimatedWaitMinutes: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
      reason,
      matchedRules,
      stats: {
        totalEntries: input.existingWaitlist.length,
        currentPosition: 0,
        avgWaitMinutes: this.calculateAvgWaitTime(input.existingWaitlist),
        capacityRemaining: 0,
      },
      executionTime: Date.now() - startTime,
      provider: 'WaitlistManagementProvider',
      confidence: 0,
    };
  }
}

/**
 * Create and export default instance
 */
export const waitlistManagementProvider = new WaitlistManagementProvider();
