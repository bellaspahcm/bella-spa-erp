/**
 * Lifecycle Discount Rules
 * 
 * Defines discount eligibility based on customer lifecycle events.
 * Events include birthdays, special occasions, and time-based promotions.
 * 
 * Lifecycle Types:
 * - Birthday: Customer's birthday month
 * - Weekend: Saturday/Sunday bookings
 * - Default: No discount (fallback rule)
 * 
 * @module decision-engine/providers/discount/rules
 */

import type { Rule } from '@/lib/decision-engine/types';

/**
 * Birthday Month Discount Rule
 * Priority: 70
 * 
 * Conditions:
 * - Current month = customer's birthday month
 * 
 * Actions:
 * - 10% discount
 * - Birthday celebration special
 */
export const birthdayMonthDiscountRule: Rule = {
  id: 'discount-birthday-month',
  name: 'Birthday Month Discount',
  description: 'Special 10% discount during customer birthday month',
  priority: 70,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'isBirthdayMonth',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      discountPercent: 10,
      discountType: 'birthday',
      restrictions: ['Valid during birthday month only'],
    },
  },
  metadata: {
    category: 'lifecycle',
    eventType: 'birthday',
    createdAt: '2026-07-09',
    owner: 'customer-success-team',
  },
};

/**
 * Weekend Special Discount Rule
 * Priority: 50
 * 
 * Conditions:
 * - Booking date is on weekend (Saturday or Sunday)
 * 
 * Actions:
 * - 7% discount
 * - Weekend special offer
 */
export const weekendSpecialRule: Rule = {
  id: 'discount-weekend-special',
  name: 'Weekend Special Discount',
  description: 'Save 7% on weekend bookings (Saturday & Sunday)',
  priority: 50,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'isWeekend',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      discountPercent: 7,
      discountType: 'weekend',
      restrictions: ['Valid for Saturday and Sunday bookings only'],
    },
  },
  metadata: {
    category: 'lifecycle',
    eventType: 'weekend',
    createdAt: '2026-07-09',
    owner: 'business-rules-team',
  },
};

/**
 * No Discount Rule (Fallback)
 * Priority: 10 (lowest)
 * 
 * Conditions:
 * - Always matches (catchall rule)
 * 
 * Actions:
 * - 0% discount
 * - Ensures a decision is always made
 */
export const noDiscountRule: Rule = {
  id: 'discount-none-fallback',
  name: 'No Discount (Fallback)',
  description: 'Default rule when no other discount qualifies',
  priority: 10,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'totalAmount',
        operator: 'greater_than',
        value: 0,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: false,
      discountPercent: 0,
      discountType: 'none',
      restrictions: [],
    },
  },
  metadata: {
    category: 'lifecycle',
    eventType: 'fallback',
    createdAt: '2026-07-09',
    owner: 'business-rules-team',
  },
};

/**
 * All lifecycle discount rules
 */
export const lifecycleRules: Rule[] = [
  birthdayMonthDiscountRule,
  weekendSpecialRule,
  noDiscountRule,
];
