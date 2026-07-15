/**
 * Campaign Discount Rules
 * 
 * Defines time-based and promotion-based discount eligibility.
 * Campaigns have specific start/end dates and may require codes.
 * 
 * Campaign Types:
 * - Seasonal: Lunar New Year, Summer, Holiday campaigns
 * - Bundle: Multi-service package discounts
 * - Referral: Customer referral program rewards
 * - Birthday: Birthday month special offers
 * 
 * @module decision-engine/providers/discount/rules
 */

import type { Rule } from '@/lib/decision-engine/types';

/**
 * Lunar New Year Campaign Discount Rule
 * Priority: 90 (high for seasonal campaigns)
 * 
 * Conditions:
 * - Campaign code = 'LUNAR_NEW_YEAR_2026'
 * - Within campaign period
 * 
 * Actions:
 * - 20% discount
 * - Limited time offer
 */
export const lunarNewYearCampaignRule: Rule = {
  id: 'discount-lunar-new-year-2026',
  name: 'Lunar New Year 2026 Campaign',
  description: 'Special 20% discount for Lunar New Year celebration',
  priority: 90,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'campaignCode',
        operator: 'equals',
        value: 'LUNAR_NEW_YEAR_2026',
      },
      {
        type: 'simple',
        field: 'isWithinCampaign',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      discountPercent: 20,
      discountType: 'seasonal',
      restrictions: ['Valid during campaign period only'],
      campaignCode: 'LUNAR_NEW_YEAR_2026',
    },
  },
  metadata: {
    category: 'campaign',
    campaignType: 'seasonal',
    startDate: '2026-01-20',
    endDate: '2026-02-10',
    createdAt: '2026-07-09',
    owner: 'marketing-team',
  },
};

/**
 * Summer Promotion Discount Rule
 * Priority: 85
 * 
 * Conditions:
 * - Campaign code = 'SUMMER_2026'
 * - Within campaign period
 * 
 * Actions:
 * - 15% discount
 * - Summer special offer
 */
export const summerPromotionRule: Rule = {
  id: 'discount-summer-2026',
  name: 'Summer 2026 Promotion',
  description: 'Beat the heat with 15% summer discount',
  priority: 85,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'campaignCode',
        operator: 'equals',
        value: 'SUMMER_2026',
      },
      {
        type: 'simple',
        field: 'isWithinCampaign',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      discountPercent: 15,
      discountType: 'seasonal',
      restrictions: ['Valid June-August 2026'],
      campaignCode: 'SUMMER_2026',
    },
  },
  metadata: {
    category: 'campaign',
    campaignType: 'seasonal',
    startDate: '2026-06-01',
    endDate: '2026-08-31',
    createdAt: '2026-07-09',
    owner: 'marketing-team',
  },
};

/**
 * Bundle Discount Rule
 * Priority: 80
 * 
 * Conditions:
 * - Service count >= 3 (multi-service package)
 * 
 * Actions:
 * - 12% discount
 * - Bundle savings
 */
export const bundleDiscountRule: Rule = {
  id: 'discount-bundle-services',
  name: 'Bundle Services Discount',
  description: 'Save 12% when booking 3+ services together',
  priority: 80,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'serviceCount',
        operator: 'greaterThanOrEqual',
        value: 3,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      discountPercent: 12,
      discountType: 'bundle',
      restrictions: ['Minimum 3 services required'],
    },
  },
  metadata: {
    category: 'campaign',
    campaignType: 'bundle',
    minServices: 3,
    createdAt: '2026-07-09',
    owner: 'business-rules-team',
  },
};

/**
 * Referral Discount Rule
 * Priority: 75
 * 
 * Conditions:
 * - Has referral code
 * 
 * Actions:
 * - 8% discount
 * - Both referrer and referee benefit
 */
export const referralDiscountRule: Rule = {
  id: 'discount-referral-program',
  name: 'Referral Program Discount',
  description: 'Get 8% off when referred by existing customer',
  priority: 75,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'hasReferralCode',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      discountPercent: 8,
      discountType: 'referral',
      restrictions: ['Valid for new customers with referral code'],
    },
  },
  metadata: {
    category: 'campaign',
    campaignType: 'referral',
    createdAt: '2026-07-09',
    owner: 'customer-success-team',
  },
};

/**
 * All campaign discount rules
 */
export const campaignRules: Rule[] = [
  lunarNewYearCampaignRule,
  summerPromotionRule,
  bundleDiscountRule,
  referralDiscountRule,
];
