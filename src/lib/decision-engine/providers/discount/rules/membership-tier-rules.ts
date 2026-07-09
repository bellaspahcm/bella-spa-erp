/**
 * Membership Tier Discount Rules
 * 
 * Defines discount eligibility based on customer tier (VIP, Loyal, Active, New).
 * Tier is determined by lifetime spending and booking history.
 * 
 * Tier Thresholds:
 * - VIP: ≥50M VND lifetime spending
 * - Loyal: ≥20M VND or 10+ completed bookings
 * - Active: >1 completed booking
 * - New: 0-1 completed bookings
 * 
 * @module decision-engine/providers/discount/rules
 */

import type { Rule } from '@/lib/decision-engine/types';

/**
 * VIP Customer Discount Rule
 * Priority: 110 (highest for customer tiers)
 * 
 * Conditions:
 * - Customer tier = 'vip' (≥50M lifetime spending)
 * 
 * Actions:
 * - 15% discount
 * - No restrictions
 */
export const vipCustomerDiscountRule: Rule = {
  id: 'discount-vip-customer',
  name: 'VIP Customer Discount',
  description: 'VIP customers receive 15% discount on all purchases',
  priority: 110,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'customerTier',
        operator: 'equals',
        value: 'vip',
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      discountPercent: 15,
      discountType: 'membership',
      restrictions: [],
    },
  },
  metadata: {
    category: 'membership_tier',
    tier: 'vip',
    minSpending: 50000000,
    createdAt: '2026-07-09',
    owner: 'business-rules-team',
  },
};

/**
 * Loyal Customer Discount Rule
 * Priority: 100
 * 
 * Conditions:
 * - Customer tier = 'loyal' (≥20M spending OR 10+ bookings)
 * 
 * Actions:
 * - 10% discount
 * - No restrictions
 */
export const loyalCustomerDiscountRule: Rule = {
  id: 'discount-loyal-customer',
  name: 'Loyal Customer Discount',
  description: 'Loyal customers receive 10% discount on all purchases',
  priority: 100,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'customerTier',
        operator: 'equals',
        value: 'loyal',
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      discountPercent: 10,
      discountType: 'membership',
      restrictions: [],
    },
  },
  metadata: {
    category: 'membership_tier',
    tier: 'loyal',
    minSpending: 20000000,
    minBookings: 10,
    createdAt: '2026-07-09',
    owner: 'business-rules-team',
  },
};

/**
 * Active Customer Discount Rule
 * Priority: 60
 * 
 * Conditions:
 * - Customer tier = 'active' (>1 completed booking)
 * 
 * Actions:
 * - 5% discount
 * - No restrictions
 */
export const activeCustomerDiscountRule: Rule = {
  id: 'discount-active-customer',
  name: 'Active Customer Discount',
  description: 'Active customers receive 5% discount on all purchases',
  priority: 60,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'customerTier',
        operator: 'equals',
        value: 'active',
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      discountPercent: 5,
      discountType: 'membership',
      restrictions: [],
    },
  },
  metadata: {
    category: 'membership_tier',
    tier: 'active',
    minBookings: 2,
    createdAt: '2026-07-09',
    owner: 'business-rules-team',
  },
};

/**
 * New Customer Discount Rule
 * Priority: 95
 * 
 * Conditions:
 * - Customer tier = 'new' (0-1 completed bookings)
 * - Is first booking
 * 
 * Actions:
 * - 5% discount
 * - First-time customer incentive
 */
export const newCustomerDiscountRule: Rule = {
  id: 'discount-new-customer',
  name: 'New Customer Discount',
  description: 'New customers receive 5% welcome discount on first purchase',
  priority: 95,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'customerTier',
        operator: 'equals',
        value: 'new',
      },
      {
        type: 'simple',
        field: 'isFirstBooking',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      discountPercent: 5,
      discountType: 'firsttime',
      restrictions: ['First purchase only'],
    },
  },
  metadata: {
    category: 'membership_tier',
    tier: 'new',
    createdAt: '2026-07-09',
    owner: 'business-rules-team',
  },
};

/**
 * All membership tier discount rules
 */
export const membershipTierRules: Rule[] = [
  vipCustomerDiscountRule,
  loyalCustomerDiscountRule,
  activeCustomerDiscountRule,
  newCustomerDiscountRule,
];
