/**
 * KPI Bonus Rules
 * 
 * Defines KPI bonus eligibility based on employee performance metrics.
 * Supports 3 strategies:
 * - Threshold: Fixed bonus when target is met (e.g., 30 sessions → 1M)
 * - Linear: Progressive bonus (e.g., 50k per session above baseline)
 * - Tier: Tiered bonuses (e.g., 0-20: 0, 21-30: 500k, 31+: 1M)
 * 
 * @module decision-engine/providers/payroll/rules
 */

import type { Rule } from '@/lib/decision-engine/types';

/**
 * KPI Threshold Strategy - Standard Target
 * Priority: 200
 * 
 * Conditions:
 * - Strategy = 'threshold'
 * - Sessions count >= target (default: 30)
 * 
 * Actions:
 * - Fixed bonus amount (default: 1,000,000đ)
 */
export const kpiThresholdStandardRule: Rule = {
  id: 'payroll-kpi-threshold-standard',
  name: 'KPI Threshold - Standard Target',
  description: 'Fixed KPI bonus when employee meets the standard monthly target',
  priority: 200,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'kpi.strategy',
        operator: 'equals',
        value: 'threshold',
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'greaterThanOrEqual',
        value: 30, // Will be overridden by config
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      bonusType: 'kpi-bonus',
      amount: 1000000, // Will be overridden by config
      strategy: 'threshold',
    },
  },
  metadata: {
    category: 'kpi',
    strategy: 'threshold',
    defaultTarget: 30,
    defaultBonus: 1000000,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * KPI Threshold Strategy - High Performance Target
 * Priority: 210
 * 
 * STATUS: DISABLED - This is a NEW FEATURE, not migration
 * 
 * Conditions:
 * - Strategy = 'threshold'
 * - Sessions count >= high target (40+)
 * 
 * Actions:
 * - Higher fixed bonus (2,000,000đ)
 * 
 * RATIONALE FOR DISABLING:
 * - Existing KPIProvider only supports single threshold (1 target → 1 bonus)
 * - Multiple performance levels should use 'tier' strategy instead
 * - Can be enabled later if business requests this specific feature
 * 
 * ALTERNATIVE:
 * Use tier strategy with high-performance tier:
 * ```
 * tiers: [
 *   { min: 0, max: 29, bonus: 0 },
 *   { min: 30, max: 39, bonus: 1000000 },    // Standard
 *   { min: 40, max: 999, bonus: 2000000 }    // High Performance
 * ]
 * ```
 */
export const kpiThresholdHighRule: Rule = {
  id: 'payroll-kpi-threshold-high',
  name: 'KPI Threshold - High Performance',
  description: 'Premium KPI bonus for exceptional performance (40+ sessions) - DISABLED: Use tier strategy instead',
  priority: 210,
  enabled: false, // DISABLED: Not in existing code, use tier strategy for multi-level
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'kpi.strategy',
        operator: 'equals',
        value: 'threshold',
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'greaterThanOrEqual',
        value: 40,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      bonusType: 'kpi-bonus',
      amount: 2000000,
      strategy: 'threshold-high',
    },
  },
  metadata: {
    category: 'kpi',
    strategy: 'threshold',
    highTarget: 40,
    highBonus: 2000000,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * KPI Linear Strategy - Progressive Bonus
 * Priority: 220
 * 
 * Conditions:
 * - Strategy = 'linear'
 * - Sessions count > baseline (default: 20)
 * 
 * Actions:
 * - Progressive bonus: bonusPerUnit × (actual - baseline)
 * - Example: (35 - 20) × 50,000đ = 750,000đ
 */
export const kpiLinearProgressiveRule: Rule = {
  id: 'payroll-kpi-linear-progressive',
  name: 'KPI Linear - Progressive Bonus',
  description: 'Progressive KPI bonus for each unit above baseline',
  priority: 220,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'kpi.strategy',
        operator: 'equals',
        value: 'linear',
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'greaterThan',
        value: 20, // Will be overridden by config.baseline
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      bonusType: 'kpi-bonus',
      strategy: 'linear',
      baseline: 20,
      bonusPerUnit: 50000,
      maxBonus: 2000000, // Optional cap
    },
  },
  metadata: {
    category: 'kpi',
    strategy: 'linear',
    defaultBaseline: 20,
    defaultBonusPerUnit: 50000,
    defaultMaxBonus: 2000000,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * KPI Tier Strategy - Tier 1 (Entry Level)
 * Priority: 230
 * 
 * Conditions:
 * - Strategy = 'tier'
 * - Sessions count in range 0-20
 * 
 * Actions:
 * - No bonus (entry level)
 */
export const kpiTierLevel1Rule: Rule = {
  id: 'payroll-kpi-tier-level1',
  name: 'KPI Tier 1 - Entry Level',
  description: 'Entry level tier (0-20 sessions) - No bonus',
  priority: 230,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'kpi.strategy',
        operator: 'equals',
        value: 'tier',
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'greaterThanOrEqual',
        value: 0,
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'lessThanOrEqual',
        value: 20,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: false,
      bonusType: 'kpi-bonus',
      amount: 0,
      strategy: 'tier',
      tier: 1,
      tierRange: '0-20',
    },
  },
  metadata: {
    category: 'kpi',
    strategy: 'tier',
    tier: 1,
    minSessions: 0,
    maxSessions: 20,
    bonus: 0,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * KPI Tier Strategy - Tier 2 (Standard)
 * Priority: 240
 * 
 * Conditions:
 * - Strategy = 'tier'
 * - Sessions count in range 21-30
 * 
 * Actions:
 * - Standard bonus: 500,000đ
 */
export const kpiTierLevel2Rule: Rule = {
  id: 'payroll-kpi-tier-level2',
  name: 'KPI Tier 2 - Standard',
  description: 'Standard tier (21-30 sessions) - 500k bonus',
  priority: 240,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'kpi.strategy',
        operator: 'equals',
        value: 'tier',
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'greaterThanOrEqual',
        value: 21,
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'lessThanOrEqual',
        value: 30,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      bonusType: 'kpi-bonus',
      amount: 500000,
      strategy: 'tier',
      tier: 2,
      tierRange: '21-30',
    },
  },
  metadata: {
    category: 'kpi',
    strategy: 'tier',
    tier: 2,
    minSessions: 21,
    maxSessions: 30,
    bonus: 500000,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * KPI Tier Strategy - Tier 3 (Excellent)
 * Priority: 250
 * 
 * Conditions:
 * - Strategy = 'tier'
 * - Sessions count >= 31
 * 
 * Actions:
 * - Excellent bonus: 1,500,000đ
 */
export const kpiTierLevel3Rule: Rule = {
  id: 'payroll-kpi-tier-level3',
  name: 'KPI Tier 3 - Excellent',
  description: 'Excellent tier (31+ sessions) - 1.5M bonus',
  priority: 250,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'kpi.strategy',
        operator: 'equals',
        value: 'tier',
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'greaterThanOrEqual',
        value: 31,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      bonusType: 'kpi-bonus',
      amount: 1500000,
      strategy: 'tier',
      tier: 3,
      tierRange: '31+',
    },
  },
  metadata: {
    category: 'kpi',
    strategy: 'tier',
    tier: 3,
    minSessions: 31,
    maxSessions: 999,
    bonus: 1500000,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * All KPI rules
 */
export const kpiRules: Rule[] = [
  kpiThresholdStandardRule,
  kpiThresholdHighRule,
  kpiLinearProgressiveRule,
  kpiTierLevel1Rule,
  kpiTierLevel2Rule,
  kpiTierLevel3Rule,
];

