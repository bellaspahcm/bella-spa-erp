/**
 * Booking Eligibility Policy
 * 
 * Determines if a customer is eligible to make a booking.
 * 
 * Universal rules that work across industries:
 * - VIP customers can book further in advance
 * - New customers may have restrictions
 * - Payment status affects eligibility
 * - No-show history affects eligibility
 * 
 * Same policy, different thresholds per industry.
 */

import type { 
  BookingDecisionContext, 
  EligibilityResult 
} from '@/lib/decision-engine/types/booking-types';

export interface BookingPolicy<TResult> {
  readonly name: string;
  readonly version: string;
  readonly decisionType: string;
  evaluate(context: BookingDecisionContext): Promise<TResult>;
}

export class EligibilityPolicy implements BookingPolicy<EligibilityResult> {
  readonly name = 'EligibilityPolicy';
  readonly version = '1.0.0';
  readonly decisionType = 'booking-eligibility';

  async evaluate(context: BookingDecisionContext): Promise<EligibilityResult> {
    const { customer, request, rules } = context;
    const membershipTier = customer.membershipTier || 'new';
    const paymentStatus = customer.paymentStatus || 'good';
    const totalBookings = customer.totalBookings ?? 0;
    const noShowCount = customer.noShowCount ?? 0;
    const matchedRules: string[] = [];

    // Rule 1: Check payment status
    if (paymentStatus === 'overdue') {
      return {
        eligible: false,
        reason: 'Customer has overdue payments',
        requiresApproval: false,
        requiresDeposit: false,
        matchedRules: ['payment-status-check'],
      };
    }

    // Rule 2: Check no-show history
    if (noShowCount > 3) {
      matchedRules.push('no-show-restriction');
      return {
        eligible: false,
        reason: `Customer has ${noShowCount} no-shows (max 3)`,
        requiresApproval: false,
        requiresDeposit: false,
        matchedRules,
      };
    }

    // Rule 3: Check advance booking window based on membership tier
    const advanceBookingDays = rules?.advanceBookingDays || {};
    const maxAdvanceDays = (advanceBookingDays as Record<string, number>)[membershipTier] || 14;
    const requestedDate = new Date(request.preferredDate);
    const today = new Date();
    const daysDifference = Math.ceil(
      (requestedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDifference > maxAdvanceDays) {
      matchedRules.push('advance-booking-window');
      return {
        eligible: false,
        reason: `${membershipTier.toUpperCase()} customers can book up to ${maxAdvanceDays} days in advance`,
        maxAdvanceDays,
        requiresApproval: membershipTier === 'vip', // VIP can request manual approval
        requiresDeposit: false,
        matchedRules,
      };
    }

    // Rule 4: Check if deposit required for new customers
    const requiresDeposit = 
      membershipTier === 'new' && 
      totalBookings < 3 &&
      !!rules?.requiresDeposit;

    matchedRules.push('eligibility-approved');
    if (requiresDeposit) {
      matchedRules.push('deposit-required-new-customer');
    }

    return {
      eligible: true,
      reason: `${membershipTier.toUpperCase()} customer eligible to book`,
      maxAdvanceDays,
      requiresApproval: false,
      requiresDeposit,
      matchedRules,
    };
  }
}
