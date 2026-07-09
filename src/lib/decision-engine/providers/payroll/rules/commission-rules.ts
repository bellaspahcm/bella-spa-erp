/**
 * Commission Rules
 * 
 * Defines session/service commission calculation rules.
 * Supports 4 strategies:
 * - Fixed: Fixed amount per session (e.g., 120k per session)
 * - Tier: Tiered commissions based on session ranges (e.g., 0-10: 100k, 11-20: 120k, 21+: 150k)
 * - Percentage: Percentage of service revenue (e.g., 15% of booking value)
 * - Service-Based: Different rates per service type (e.g., massage: 150k, facial: 100k)
 * 
 * @module decision-engine/providers/payroll/rules
 */

import type { Rule } from '@/lib/decision-engine/types';

/**
 * Commission Fixed Strategy - Standard Rate
 * Priority: 320
 * 
 * Conditions:
 * - Strategy = 'fixed'
 * - Sessions count > 0
 * - Meets minimum sessions requirement (if configured)
 * 
 * Actions:
 * - Fixed commission per session (default: 120,000đ)
 */
export const commissionFixedStandardRule: Rule = {
  id: 'payroll-commission-fixed-standard',
  name: 'Commission Fixed - Standard Rate',
  description: 'Fixed commission per session completed',
  priority: 320,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'commission.strategy',
        operator: 'equals',
        value: 'fixed',
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'greaterThan',
        value: 0,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      commissionType: 'session-commission',
      ratePerSession: 120000,
      minSessions: 0,
      strategy: 'fixed',
    },
  },
  metadata: {
    category: 'commission',
    strategy: 'fixed',
    defaultRate: 120000,
    defaultMinSessions: 0,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * Commission Tier Strategy - Tiered Rates
 * Priority: 330
 * 
 * Conditions:
 * - Strategy = 'tier'
 * - Sessions count > 0
 * 
 * Tiers (default):
 * - Tier 1 (0-10): 100,000đ per session
 * - Tier 2 (11-20): 120,000đ per session
 * - Tier 3 (21+): 150,000đ per session
 * 
 * Actions:
 * - Tiered commission based on session count
 */
export const commissionTierProgressiveRule: Rule = {
  id: 'payroll-commission-tier-progressive',
  name: 'Commission Tier - Progressive Rates',
  description: 'Tiered commission rates based on session volume',
  priority: 330,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'commission.strategy',
        operator: 'equals',
        value: 'tier',
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'greaterThan',
        value: 0,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      commissionType: 'session-commission',
      strategy: 'tier',
      tiers: [
        { min: 0, max: 10, rate: 100000 },
        { min: 11, max: 20, rate: 120000 },
        { min: 21, max: 999, rate: 150000 },
      ],
    },
  },
  metadata: {
    category: 'commission',
    strategy: 'tier',
    tierCount: 3,
    defaultTiers: [
      { min: 0, max: 10, rate: 100000 },
      { min: 11, max: 20, rate: 120000 },
      { min: 21, max: 999, rate: 150000 },
    ],
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * Commission Percentage Strategy - Revenue-Based
 * Priority: 340
 * 
 * Conditions:
 * - Strategy = 'percentage'
 * - Sessions count > 0
 * - Total revenue > minimum (if configured)
 * 
 * Actions:
 * - Commission = percentage × total revenue
 * - Example: 15% × 12,000,000đ = 1,800,000đ
 * - Optional max cap per session
 */
export const commissionPercentageRevenueRule: Rule = {
  id: 'payroll-commission-percentage-revenue',
  name: 'Commission Percentage - Revenue-Based',
  description: 'Commission as percentage of service revenue',
  priority: 340,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'commission.strategy',
        operator: 'equals',
        value: 'percentage',
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'greaterThan',
        value: 0,
      },
      {
        type: 'simple',
        field: 'sessions.totalRevenue',
        operator: 'greaterThan',
        value: 0,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      commissionType: 'session-commission',
      strategy: 'percentage',
      percentage: 15, // 15%
      minRevenue: 0,
      maxCommissionPerSession: null, // Optional cap
    },
  },
  metadata: {
    category: 'commission',
    strategy: 'percentage',
    defaultPercentage: 15,
    defaultMinRevenue: 0,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * Commission Service-Based Strategy - Per Service Type
 * Priority: 350
 * 
 * Conditions:
 * - Strategy = 'service' or 'service-based'
 * - Sessions count > 0
 * - Service breakdown available
 * 
 * Actions:
 * - Commission varies by service type
 * - Example rates:
 *   - Massage: 150,000đ
 *   - Facial: 100,000đ
 *   - Manicure: 80,000đ
 * - Fallback to default rate for unconfigured services
 */
export const commissionServiceBasedRule: Rule = {
  id: 'payroll-commission-service-based',
  name: 'Commission Service-Based - Per Service Type',
  description: 'Different commission rates per service type',
  priority: 350,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'any',
        conditions: [
          {
            type: 'simple',
            field: 'commission.strategy',
            operator: 'equals',
            value: 'service',
          },
          {
            type: 'simple',
            field: 'commission.strategy',
            operator: 'equals',
            value: 'service-based',
          },
        ],
      },
      {
        type: 'simple',
        field: 'sessions.count',
        operator: 'greaterThan',
        value: 0,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      commissionType: 'session-commission',
      strategy: 'service-based',
      serviceRates: {
        Massage: 150000,
        Facial: 100000,
        Manicure: 80000,
        Pedicure: 80000,
        'Hair Spa': 120000,
      },
      defaultRate: 120000, // Fallback for unconfigured services
    },
  },
  metadata: {
    category: 'commission',
    strategy: 'service-based',
    defaultRates: {
      Massage: 150000,
      Facial: 100000,
      Manicure: 80000,
      Pedicure: 80000,
      'Hair Spa': 120000,
    },
    defaultFallbackRate: 120000,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * Commission Minimum Sessions Gate Rule
 * Priority: 315 (evaluated before other commission rules)
 * 
 * Conditions:
 * - Any commission strategy
 * - Minimum sessions requirement is configured (minSessions > 0)
 * 
 * Actions:
 * - Provider must check: if sessions.count < minSessions, REJECT commission
 * 
 * NOTE: This is a GATE rule. Provider must enforce dynamic comparison
 * at runtime (sessions.count vs config.minSessions) since Rule conditions
 * don't support field-to-field comparisons.
 * 
 * Implementation pattern:
 * ```typescript
 * if (config.minSessions && context.sessions.count < config.minSessions) {
 *   return { eligible: false, reason: 'Minimum sessions not met' };
 * }
 * ```
 */
export const commissionMinimumSessionsGateRule: Rule = {
  id: 'payroll-commission-minimum-gate',
  name: 'Commission Minimum Sessions Gate',
  description: 'Reject commission if minimum sessions requirement not met (Provider-enforced)',
  priority: 315,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'commission.enabled',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      gateType: 'minimum-sessions',
      requiresRuntimeCheck: true,
      checkDescription: 'Provider must verify sessions.count >= config.minSessions',
    },
  },
  metadata: {
    category: 'commission',
    ruleType: 'gate',
    requiresProviderLogic: true,
    implementation: 'Provider must enforce dynamic minSessions comparison',
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * All commission rules
 */
export const commissionRules: Rule[] = [
  commissionMinimumSessionsGateRule, // Gate rule first (priority 315)
  commissionFixedStandardRule,       // Fixed (priority 320)
  commissionTierProgressiveRule,     // Tier (priority 330)
  commissionPercentageRevenueRule,   // Percentage (priority 340)
  commissionServiceBasedRule,        // Service-based (priority 350)
];

