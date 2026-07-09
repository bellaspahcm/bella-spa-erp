/**
 * Rating Bonus Rules
 * 
 * Defines rating-based bonuses (quality incentive for high customer satisfaction).
 * Supports 3 strategies:
 * - Threshold: Fixed bonus when rating meets threshold (e.g., ≥4.5 stars → 50k)
 * - Linear: Progressive bonus (e.g., 100k per 0.1 star above baseline)
 * - Tier: Tiered bonuses (e.g., 4.0-4.4: 0, 4.5-4.7: 50k, 4.8+: 150k)
 * 
 * @module decision-engine/providers/payroll/rules
 */

import type { Rule } from '@/lib/decision-engine/types';

/**
 * Rating Threshold Strategy - Standard Quality
 * Priority: 290
 * 
 * Conditions:
 * - Strategy = 'threshold'
 * - Average rating >= 4.5 stars
 * 
 * Actions:
 * - Fixed bonus: 50,000đ
 */
export const ratingThresholdStandardRule: Rule = {
  id: 'payroll-rating-threshold-standard',
  name: 'Rating Threshold - Standard Quality',
  description: 'Bonus for maintaining standard quality rating (≥4.5 stars)',
  priority: 290,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'rating.strategy',
        operator: 'equals',
        value: 'threshold',
      },
      {
        type: 'simple',
        field: 'sessions.avgRating',
        operator: 'greaterThanOrEqual',
        value: 4.5,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      bonusType: 'rating-bonus',
      amount: 50000,
      strategy: 'threshold',
      threshold: 4.5,
    },
  },
  metadata: {
    category: 'rating',
    strategy: 'threshold',
    minRating: 4.5,
    bonus: 50000,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * Rating Linear Strategy - Progressive Quality Bonus
 * Priority: 300
 * 
 * Conditions:
 * - Strategy = 'linear'
 * - Average rating > baseline (default: 4.0)
 * 
 * Actions:
 * - Progressive bonus: bonusPerPoint × (rating - baseline)
 * - Example: (4.7 - 4.0) × 100,000đ = 70,000đ
 * - Max cap: 300,000đ
 */
export const ratingLinearProgressiveRule: Rule = {
  id: 'payroll-rating-linear-progressive',
  name: 'Rating Linear - Progressive Quality Bonus',
  description: 'Progressive bonus for each 0.1 star above baseline',
  priority: 300,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'rating.strategy',
        operator: 'equals',
        value: 'linear',
      },
      {
        type: 'simple',
        field: 'sessions.avgRating',
        operator: 'greaterThan',
        value: 4.0, // Will be overridden by config.baseline
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      bonusType: 'rating-bonus',
      strategy: 'linear',
      baseline: 4.0,
      bonusPerPoint: 100000, // Per 1.0 star (10k per 0.1 star)
      maxBonus: 300000,
    },
  },
  metadata: {
    category: 'rating',
    strategy: 'linear',
    defaultBaseline: 4.0,
    defaultBonusPerPoint: 100000,
    defaultMaxBonus: 300000,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * Rating Tier Strategy - Tiered Quality Bonuses
 * Priority: 310
 * 
 * Conditions:
 * - Strategy = 'tier'
 * - Average rating in tier range
 * 
 * Tiers:
 * - Tier 1 (0-4.4): No bonus
 * - Tier 2 (4.5-4.7): 50,000đ
 * - Tier 3 (4.8-5.0): 150,000đ
 * 
 * Actions:
 * - Tiered bonus based on rating range
 */
export const ratingTierQualityRule: Rule = {
  id: 'payroll-rating-tier-quality',
  name: 'Rating Tier - Quality Bonus',
  description: 'Tiered bonus based on average rating range',
  priority: 310,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'rating.strategy',
        operator: 'equals',
        value: 'tier',
      },
      {
        type: 'simple',
        field: 'sessions.avgRating',
        operator: 'greaterThan',
        value: 0, // Has rating data
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      bonusType: 'rating-bonus',
      strategy: 'tier',
      tiers: [
        { min: 0, max: 4.4, bonus: 0, tierName: 'Basic' },
        { min: 4.5, max: 4.7, bonus: 50000, tierName: 'Good' },
        { min: 4.8, max: 5.0, bonus: 150000, tierName: 'Excellent' },
      ],
    },
  },
  metadata: {
    category: 'rating',
    strategy: 'tier',
    tierCount: 3,
    defaultTiers: [
      { min: 0, max: 4.4, bonus: 0 },
      { min: 4.5, max: 4.7, bonus: 50000 },
      { min: 4.8, max: 5.0, bonus: 150000 },
    ],
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * All rating rules
 */
export const ratingRules: Rule[] = [
  ratingThresholdStandardRule,
  ratingLinearProgressiveRule,
  ratingTierQualityRule,
];

