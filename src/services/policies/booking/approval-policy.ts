/**
 * Booking Approval Policy
 * 
 * Determines if a booking can be auto-approved or requires manual review.
 * 
 * Universal rules across industries:
 * - VIP customers → auto-approve
 * - New customers → require review for first bookings
 * - High-value bookings → require manager approval
 * - Customers with violations → require review
 * 
 * Same logic, different thresholds per industry.
 */

import type {
  BookingDecisionContext,
  ApprovalResult,
} from '@/lib/decision-engine/types/booking-types';
import type { BookingPolicy } from './eligibility-policy';

export class ApprovalPolicy implements BookingPolicy<ApprovalResult> {
  readonly name = 'ApprovalPolicy';
  readonly version = '1.0.0';
  readonly decisionType = 'booking-approval';

  async evaluate(context: BookingDecisionContext): Promise<ApprovalResult> {
    const { customer } = context;
    const membershipTier = customer.membershipTier || 'new';
    const paymentStatus = customer.paymentStatus || 'good';
    const totalBookings = customer.totalBookings ?? 0;
    const cancelledBookings = customer.cancelledBookings ?? 0;
    const noShowCount = customer.noShowCount ?? 0;
    const matchedRules: string[] = [];

    // Rule 1: Auto-approve VIP customers
    if (membershipTier === 'vip' && paymentStatus === 'good') {
      matchedRules.push('vip-auto-approval');
      return {
        autoApproved: true,
        requiredApprovers: [],
        reason: 'VIP customer with good payment status',
        matchedRules,
      };
    }

    // Rule 2: Require review for new customers (first 3 bookings)
    if (membershipTier === 'new' || totalBookings < 3) {
      matchedRules.push('new-customer-review');
      return {
        autoApproved: false,
        requiredApprovers: ['receptionist', 'manager'],
        estimatedReviewTime: '2 hours',
        reason: 'New customer requires verification',
        matchedRules,
      };
    }

    // Rule 3: Require review if customer has cancellations/no-shows
    if (cancelledBookings > 2 || noShowCount > 0) {
      matchedRules.push('violation-review');
      return {
        autoApproved: false,
        requiredApprovers: ['manager'],
        estimatedReviewTime: '4 hours',
        reason: `Customer has ${cancelledBookings} cancellations and ${noShowCount} no-shows`,
        matchedRules,
      };
    }

    // Rule 4: Auto-approve regular customers with good history
    if (
      membershipTier === 'regular' &&
      paymentStatus === 'good' &&
      totalBookings >= 3
    ) {
      matchedRules.push('regular-customer-auto-approval');
      return {
        autoApproved: true,
        requiredApprovers: [],
        reason: 'Regular customer with good history',
        matchedRules,
      };
    }

    // Default: Require basic review
    matchedRules.push('default-review');
    return {
      autoApproved: false,
      requiredApprovers: ['receptionist'],
      estimatedReviewTime: '1 hour',
      reason: 'Standard booking review required',
      matchedRules,
    };
  }
}
