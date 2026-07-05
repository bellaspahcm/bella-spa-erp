/**
 * Booking Approval Rules
 * 
 * Business rules for auto-approval of booking orders.
 * Integrated with Decision Engine Platform.
 * 
 * @module decision-engine/rules/booking-approval
 */

import type { IfThenRule } from '@/lib/decision-engine';

/**
 * Rule: Auto-approve small bookings (< 5M VND)
 * 
 * **Business Logic:**
 * - Low-risk bookings under 5M VND can be auto-approved
 * - Reduces manual review workload
 * - Fast-track for small transactions
 * 
 * **Conditions:**
 * - Total amount < 5,000,000 VND
 * 
 * **Action:**
 * - approved: true
 * - requiresDeposit: false (small amount, trust customer)
 */
export const RULE_AUTO_APPROVE_SMALL_BOOKING: IfThenRule = {
  id: 'booking-auto-approve-small',
  description: 'Auto-approve bookings under 5M VND without deposit requirement',
  condition: {
    field: 'totalAmount',
    operator: '<',
    value: 5000000,
  },
  action: {
    approved: true,
    requiresDeposit: false,
    reason: 'Đơn hàng nhỏ (<5M), tự động duyệt',
  },
};

/**
 * Rule: Auto-approve for VIP customers
 * 
 * **Business Logic:**
 * - VIP customers have proven track record
 * - High trust level, no deposit required
 * - Auto-approve regardless of amount (up to reasonable limit)
 * 
 * **Conditions:**
 * - Customer tier is 'vip'
 * - Total amount < 20,000,000 VND (safety limit)
 * 
 * **Action:**
 * - approved: true
 * - requiresDeposit: false (VIP privilege)
 */
export const RULE_AUTO_APPROVE_VIP: IfThenRule = {
  id: 'booking-auto-approve-vip',
  description: 'Auto-approve bookings from VIP customers up to 20M VND',
  condition: {
    and: [
      {
        field: 'customerTier',
        operator: '==',
        value: 'vip',
      },
      {
        field: 'totalAmount',
        operator: '<',
        value: 20000000,
      },
    ],
  },
  action: {
    approved: true,
    requiresDeposit: false,
    reason: 'Khách hàng VIP, tự động duyệt',
  },
};

/**
 * Rule: Require deposit for medium bookings (5M - 10M VND)
 * 
 * **Business Logic:**
 * - Medium-value bookings need commitment
 * - Require 30% deposit to reduce no-show risk
 * - Auto-approve once deposit confirmed
 * 
 * **Conditions:**
 * - Total amount >= 5,000,000 VND
 * - Total amount < 10,000,000 VND
 * 
 * **Action:**
 * - approved: true (conditional on deposit)
 * - requiresDeposit: true
 * - depositPercent: 30
 */
export const RULE_REQUIRE_DEPOSIT_MEDIUM: IfThenRule = {
  id: 'booking-deposit-medium',
  description: 'Bookings 5M-10M require 30% deposit',
  condition: {
    and: [
      {
        field: 'totalAmount',
        operator: '>=',
        value: 5000000,
      },
      {
        field: 'totalAmount',
        operator: '<',
        value: 10000000,
      },
    ],
  },
  action: {
    approved: true,
    requiresDeposit: true,
    depositPercent: 30,
    reason: 'Đơn hàng 5M-10M, yêu cầu đặt cọc 30%',
  },
};

/**
 * Rule: Require deposit for large bookings (>= 10M VND)
 * 
 * **Business Logic:**
 * - High-value bookings need strong commitment
 * - Require 50% deposit to secure booking
 * - Protects business from cancellation risk
 * 
 * **Conditions:**
 * - Total amount >= 10,000,000 VND
 * 
 * **Action:**
 * - approved: true (conditional on deposit)
 * - requiresDeposit: true
 * - depositPercent: 50
 */
export const RULE_REQUIRE_DEPOSIT_LARGE: IfThenRule = {
  id: 'booking-deposit-large',
  description: 'Bookings >= 10M require 50% deposit',
  condition: {
    field: 'totalAmount',
    operator: '>=',
    value: 10000000,
  },
  action: {
    approved: true,
    requiresDeposit: true,
    depositPercent: 50,
    reason: 'Đơn hàng lớn (>=10M), yêu cầu đặt cọc 50%',
  },
};

/**
 * Rule: Require manual review for new customers with large bookings
 * 
 * **Business Logic:**
 * - New customers + high value = higher risk
 * - Require manager approval to verify legitimacy
 * - Prevent fraud and no-show losses
 * 
 * **Conditions:**
 * - Customer tier is 'new' (first booking)
 * - Total amount >= 10,000,000 VND
 * 
 * **Action:**
 * - approved: false (requires manual review)
 * - requiresManualReview: true
 * 
 * **Priority:** 95 (High - check after suspicious but before VIP auto-approve)
 */
export const RULE_MANUAL_REVIEW_NEW_CUSTOMER_LARGE: IfThenRule = {
  id: 'booking-manual-review-new-large',
  description: 'New customers booking >= 10M require manager approval',
  condition: {
    and: [
      {
        field: 'customerTier',
        operator: '==',
        value: 'new',
      },
      {
        field: 'totalAmount',
        operator: '>=',
        value: 10000000,
      },
    ],
  },
  action: {
    approved: false,
    requiresManualReview: true,
    reason: 'Khách hàng mới với đơn hàng lớn (>=10M), cần duyệt thủ công',
  },
};

/**
 * Rule: Auto-approve for loyal customers
 * 
 * **Business Logic:**
 * - Loyal customers (>= 5 completed bookings) have proven reliability
 * - Reduce deposit to 20% for medium bookings
 * - Auto-approve up to 15M VND
 * 
 * **Conditions:**
 * - Customer tier is 'loyal'
 * - Total amount < 15,000,000 VND
 * 
 * **Action:**
 * - approved: true
 * - requiresDeposit: conditional (only if > 5M)
 * - depositPercent: 20 (reduced for loyalty)
 */
export const RULE_AUTO_APPROVE_LOYAL: IfThenRule = {
  id: 'booking-auto-approve-loyal',
  description: 'Auto-approve loyal customers up to 15M with reduced deposit',
  condition: {
    and: [
      {
        field: 'customerTier',
        operator: '==',
        value: 'loyal',
      },
      {
        field: 'totalAmount',
        operator: '<',
        value: 15000000,
      },
    ],
  },
  action: {
    approved: true,
    requiresDeposit: true, // Will be overridden by small booking rule if <5M
    depositPercent: 20,
    reason: 'Khách hàng trung thành, tự động duyệt với cọc ưu đãi 20%',
  },
};

/**
 * Rule: Reject suspicious bookings (edge case)
 * 
 * **Business Logic:**
 * - Extremely high bookings (>= 50M) are suspicious
 * - Require full verification before processing
 * - Prevent fraud attempts
 * 
 * **Conditions:**
 * - Total amount >= 50,000,000 VND
 * 
 * **Action:**
 * - approved: false
 * - requiresVerification: true
 * 
 * **Priority:** 110 (HIGHEST - must check before any approvals)
 */
export const RULE_REJECT_SUSPICIOUS: IfThenRule = {
  id: 'booking-reject-suspicious',
  description: 'Bookings >= 50M require full verification',
  condition: {
    field: 'totalAmount',
    operator: '>=',
    value: 50000000,
  },
  action: {
    approved: false,
    requiresVerification: true,
    reason: 'Đơn hàng rất lớn (>=50M), yêu cầu xác minh đầy đủ',
  },
};

/**
 * All booking approval rules (sorted by priority DESC - highest first)
 * 
 * **Evaluation Order:**
 * 1. Priority 110: Reject suspicious bookings (>=50M) - SECURITY CHECK
 * 2. Priority 100: Auto-approve small bookings (<5M)
 * 3. Priority 95: Manual review for new customers + large bookings (>=10M) - RISK CHECK
 * 4. Priority 90: Auto-approve VIP customers (<20M)
 * 5. Priority 85: Auto-approve loyal customers (<15M, 20% deposit)
 * 6. Priority 80: Require 30% deposit for medium bookings (5M-10M)
 * 7. Priority 70: Require 50% deposit for large bookings (>=10M)
 * 
 * **Note:** Higher priority rules are evaluated first. If a rule matches,
 * evaluation stops and that rule's action is returned.
 * 
 * **Design Pattern:** Rejection/security checks have highest priority (110, 95),
 * then auto-approvals (100, 90, 85), then deposit requirements (80, 70).
 */
export const BOOKING_APPROVAL_RULES: IfThenRule[] = [
  RULE_REJECT_SUSPICIOUS, // Priority 110 - SECURITY CHECK FIRST
  RULE_AUTO_APPROVE_SMALL_BOOKING, // Priority 100
  RULE_MANUAL_REVIEW_NEW_CUSTOMER_LARGE, // Priority 95 - RISK CHECK
  RULE_AUTO_APPROVE_VIP, // Priority 90
  RULE_AUTO_APPROVE_LOYAL, // Priority 85
  RULE_REQUIRE_DEPOSIT_MEDIUM, // Priority 80
  RULE_REQUIRE_DEPOSIT_LARGE, // Priority 70
].sort((a, b) => {
  // Sort by rule order (already ordered by priority in comments)
  const ruleOrder = [
    'booking-reject-suspicious', // Priority 110
    'booking-auto-approve-small', // Priority 100
    'booking-manual-review-new-large', // Priority 95
    'booking-auto-approve-vip', // Priority 90
    'booking-auto-approve-loyal', // Priority 85
    'booking-deposit-medium', // Priority 80
    'booking-deposit-large', // Priority 70
  ];
  return ruleOrder.indexOf(a.id!) - ruleOrder.indexOf(b.id!);
});

/**
 * Get booking approval rules for Decision Engine
 * 
 * @returns Array of booking approval rules
 * 
 * @example
 * ```typescript
 * import { getBookingApprovalRules } from '@/lib/decision-engine/rules/booking-approval-rules';
 * import { bootstrapDecisionEngine, createDecisionContext } from '@/lib/decision-engine';
 * 
 * const { engine } = bootstrapDecisionEngine();
 * 
 * const context = createDecisionContext({
 *   tenantId: 'bella-spa-vn',
 *   module: 'booking',
 *   decisionType: 'auto-approval',
 *   ruleType: 'if-then',
 *   rule: getBookingApprovalRules()[0], // Use first matching rule
 *   data: {
 *     totalAmount: 3000000,
 *     customerTier: 'new',
 *   },
 * });
 * 
 * const result = await engine.evaluate(context);
 * console.log(result.approved); // true (small booking auto-approved)
 * ```
 */
export function getBookingApprovalRules(): IfThenRule[] {
  return BOOKING_APPROVAL_RULES;
}

/**
 * Helper: Map database customer status to tier for Decision Engine
 * 
 * **Tier Mapping:**
 * - new/lead → 'new' (first-time customer)
 * - active → 'active' (has bookings but not yet loyal)
 * - vip → 'vip' (high-value customer)
 * - loyal → 'loyal' (>= 5 completed bookings)
 * 
 * @param status - Customer status from database
 * @param completedBookingsCount - Number of completed bookings
 * @returns Customer tier for decision rules
 */
export function mapCustomerTier(
  status: string | null | undefined,
  completedBookingsCount: number = 0
): 'new' | 'active' | 'loyal' | 'vip' {
  if (status === 'vip') return 'vip';
  if (completedBookingsCount >= 5) return 'loyal';
  if (status === 'new' || status === 'lead' || completedBookingsCount === 0) return 'new';
  return 'active';
}

/**
 * Helper: Calculate deposit amount from booking total and decision result
 * 
 * @param totalAmount - Booking total amount
 * @param depositPercent - Deposit percentage from decision result
 * @returns Deposit amount in VND
 */
export function calculateDepositAmount(
  totalAmount: number,
  depositPercent: number
): number {
  return Math.round(totalAmount * (depositPercent / 100));
}
