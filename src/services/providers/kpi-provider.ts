/**
 * KPI Provider (Configuration-Driven)
 * 
 * Calculates KPI bonuses based on tenant configuration.
 * Supports multiple strategies:
 * - Threshold: Fixed bonus when target is met (e.g., 30 sessions → 1M)
 * - Linear: Progressive bonus (e.g., 10k per session above baseline)
 * - Tier: Tiered bonuses (e.g., 0-20: 0, 21-30: 500k, 31+: 1M)
 * 
 * CONFIGURATION-DRIVEN ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────┐
 * │  Tenant Config (JSONB)  →  Strategy Selection  →  Logic │
 * │  ────────────────────────────────────────────────────── │
 * │  Provider reads config from PayrollConfigService        │
 * │  Selects strategy dynamically based on config           │
 * │  Executes calculation using strategy parameters         │
 * └─────────────────────────────────────────────────────────┘
 * 
 * CROSS-INDUSTRY ABSTRACTION:
 * - Spa: activityMetric = sessions, target = 30
 * - Retail: activityMetric = sales, target = 100 transactions
 * - Real Estate: activityMetric = deals, target = 5 closings
 * - Manufacturing: activityMetric = units, target = 1000 units
 * 
 * This provider does NOT know about "Spa" or "Retail".
 * It reads generic config and applies universal KPI logic.
 */

import {
  type SalaryComponent,
  type ProviderEvaluationOptions,
  type PayrollProvider,
  createSalaryComponent,
} from '@/lib/decision-engine/types/payroll-types';
import type { PayrollDecisionContext } from '@/lib/decision-engine/types/decision-context';
import { PayrollConfigService } from '@/services/payroll-config.service';
import type { KPIConfig, KPIThresholdConfig, KPILinearConfig, KPITierConfig } from '@/types/payroll-config';

/**
 * KPI Provider
 * 
 * Evaluates KPI bonuses using tenant configuration.
 * 
 * @example Spa with Threshold Strategy
 * ```typescript
 * // Tenant config (stored in database):
 * {
 *   provider_key: 'kpi',
 *   enabled: true,
 *   strategy: 'threshold',
 *   config: {
 *     target: 30,
 *     bonus: 1000000,
 *     metric: 'sessions'
 *   }
 * }
 * 
 * // Context:
 * const context: PayrollDecisionContext = {
 *   tenantId: 'bella-spa',
 *   sessions: { count: 35 },
 *   ...
 * };
 * 
 * const result = await provider.evaluate(context);
 * // {
 * //   type: 'kpi-bonus',
 * //   eligible: true,
 * //   amount: 1000000,
 * //   reason: 'KPI target met: 35/30 sessions (Threshold strategy)',
 * //   metadata: { strategy: 'threshold', target: 30, actual: 35 }
 * // }
 * ```
 * 
 * @example Spa with Linear Strategy
 * ```typescript
 * // Tenant config:
 * {
 *   provider_key: 'kpi',
 *   enabled: true,
 *   strategy: 'linear',
 *   config: {
 *     baseline: 20,
 *     bonusPerUnit: 50000,
 *     maxBonus: 2000000,
 *     metric: 'sessions'
 *   }
 * }
 * 
 * // Context:
 * const context: PayrollDecisionContext = {
 *   tenantId: 'bella-spa',
 *   sessions: { count: 35 },
 *   ...
 * };
 * 
 * const result = await provider.evaluate(context);
 * // {
 * //   type: 'kpi-bonus',
 * //   eligible: true,
 * //   amount: 750000,
 * //   reason: 'KPI linear bonus: (35 - 20) × 50,000đ = 750,000đ',
 * //   metadata: { strategy: 'linear', baseline: 20, actual: 35, units: 15 }
 * // }
 * ```
 * 
 * @example Spa with Tier Strategy
 * ```typescript
 * // Tenant config:
 * {
 *   provider_key: 'kpi',
 *   enabled: true,
 *   strategy: 'tier',
 *   config: {
 *     tiers: [
 *       { min: 0, max: 20, bonus: 0 },
 *       { min: 21, max: 30, bonus: 500000 },
 *       { min: 31, max: 999, bonus: 1500000 }
 *     ],
 *     metric: 'sessions'
 *   }
 * }
 * 
 * // Context:
 * const context: PayrollDecisionContext = {
 *   tenantId: 'bella-spa',
 *   sessions: { count: 35 },
 *   ...
 * };
 * 
 * const result = await provider.evaluate(context);
 * // {
 * //   type: 'kpi-bonus',
 * //   eligible: true,
 * //   amount: 1500000,
 * //   reason: 'KPI tier bonus: 35 sessions → Tier 3 (31-999) = 1,500,000đ',
 * //   metadata: { strategy: 'tier', actual: 35, tier: 3 }
 * // }
 * ```
 */
export class KPIProvider implements PayrollProvider<SalaryComponent> {
  readonly name = 'KPIProvider';
  readonly decisionType = 'kpi-bonus';

  private configService: PayrollConfigService;

  constructor() {
    this.configService = PayrollConfigService.getInstance();
  }

  /**
   * Evaluate KPI bonus for the given context
   * 
   * Algorithm:
   * 1. Load tenant configuration from PayrollConfigService
   * 2. Check if KPI provider is enabled
   * 3. Extract activity metric (sessions, sales, deals, etc.)
   * 4. Select strategy and execute calculation
   * 5. Return SalaryComponent with full audit trail
   */
  async evaluate(
    context: PayrollDecisionContext,
    options?: ProviderEvaluationOptions
  ): Promise<SalaryComponent> {
    const { tenantId, sessions, sales, overrides } = context;

    // Check if override amount provided
    if (options?.applyOverrides && overrides?.kpiBonus !== undefined) {
      return createSalaryComponent('kpi-bonus', {
        eligible: true,
        amount: overrides.kpiBonus,
        reason: 'Manual override applied',
        metadata: {
          override: true,
        },
      });
    }

    // Step 1: Load tenant configuration
    const config = (await this.configService.getProviderConfig(tenantId, 'kpi')) as unknown as {
      enabled: boolean;
      strategy: string | null;
      config: KPIConfig & { metric?: string };
    };

    // Step 2: Check if KPI provider is enabled
    if (!config.enabled) {
      return createSalaryComponent('kpi-bonus', {
        eligible: false,
        amount: 0,
        reason: 'KPI bonus is disabled for this tenant',
        metadata: {
          configDisabled: true,
        },
      });
    }

    // Step 3: Extract activity metric
    const activityMetric = this.extractActivityMetric(config, sessions, sales);

    if (activityMetric === null) {
      return createSalaryComponent('kpi-bonus', {
        eligible: false,
        amount: 0,
        reason: 'No activity metric available for KPI calculation',
        metadata: {
          configuredMetric: config.config.metric || 'sessions',
        },
      });
    }

    // Step 4: Select strategy and calculate bonus
    const result = this.calculateBonus(config.strategy || 'linear', config.config, activityMetric);

    return createSalaryComponent('kpi-bonus', {
      eligible: result.eligible,
      amount: result.amount,
      reason: result.reason,
      metadata: {
        strategy: config.strategy,
        metric: config.config.metric || 'sessions',
        actualMetric: activityMetric,
        ...result.metadata,
      },
    });
  }

  /**
   * Extract activity metric from context based on config
   * @private
   */
  private extractActivityMetric(
    config: { config: KPIConfig },
    sessions: PayrollDecisionContext['sessions'],
    sales: PayrollDecisionContext['sales']
  ): number | null {
    // All KPI strategies use session count as the default metric.
    // Sales-based metrics fall back to session count.
    return sessions?.count ?? sales?.serviceCount ?? null;
  }

  /**
   * Calculate bonus based on strategy
   * @private
   */
  private calculateBonus(
    strategy: string,
    config: KPIConfig,
    activityMetric: number
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    switch (strategy) {
      case 'threshold':
        return this.calculateThresholdBonus(config as KPIThresholdConfig, activityMetric);
      case 'linear':
        return this.calculateLinearBonus(config as KPILinearConfig, activityMetric);
      case 'tier':
        return this.calculateTierBonus(config as KPITierConfig, activityMetric);
      default:
        return {
          eligible: false,
          amount: 0,
          reason: `Unknown KPI strategy: ${strategy}`,
          metadata: { unknownStrategy: strategy },
        };
    }
  }

  /**
   * STRATEGY 1: Threshold
   * Fixed bonus when target is met
   * @private
   */
  private calculateThresholdBonus(
    config: KPIThresholdConfig,
    activityMetric: number
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    const { target, bonus } = config;

    if (activityMetric >= target) {
      return {
        eligible: true,
        amount: bonus,
        reason: `KPI target met: ${activityMetric}/${target} sessions (Threshold) → ${bonus.toLocaleString('vi-VN')}đ`,
        metadata: {
          target,
          actual: activityMetric,
          exceeded: activityMetric - target,
        },
      };
    }

    return {
      eligible: false,
      amount: 0,
      reason: `KPI target not met: ${activityMetric}/${target} sessions (need ${target - activityMetric} more)`,
      metadata: {
        target,
        actual: activityMetric,
        shortfall: target - activityMetric,
      },
    };
  }

  /**
   * STRATEGY 2: Linear
   * Progressive bonus (bonusPerUnit × units above baseline)
   * @private
   */
  private calculateLinearBonus(
    config: KPILinearConfig,
    activityMetric: number
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    const { bonusPerSession, minSessions } = config;
    const baseline = minSessions ?? 0;

    if (activityMetric <= baseline) {
      return {
        eligible: false,
        amount: 0,
        reason: `KPI below minimum: ${activityMetric}/${baseline} sessions`,
        metadata: {
          baseline,
          actual: activityMetric,
          shortfall: baseline - activityMetric,
        },
      };
    }

    const unitsAboveBaseline = activityMetric - baseline;
    const bonus = unitsAboveBaseline * bonusPerSession;

    return {
      eligible: true,
      amount: Math.round(bonus),
      reason: `KPI linear bonus: (${activityMetric} - ${baseline}) × ${bonusPerSession.toLocaleString('vi-VN')}đ/session = ${bonus.toLocaleString('vi-VN')}đ`,
      metadata: {
        baseline,
        actual: activityMetric,
        unitsAboveBaseline,
        bonusPerSession,
      },
    };
  }

  /**
   * STRATEGY 3: Tier
   * Tiered bonuses based on ranges
   * @private
   */
  private calculateTierBonus(
    config: KPITierConfig,
    activityMetric: number
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    const { tiers } = config;

    const matchedTier = tiers.find(
      (tier) => activityMetric >= tier.min && activityMetric <= tier.max
    );

    if (!matchedTier) {
      return {
        eligible: false,
        amount: 0,
        reason: `KPI metric ${activityMetric} does not match any configured tier`,
        metadata: { actual: activityMetric },
      };
    }

    if (matchedTier.bonus === 0) {
      return {
        eligible: false,
        amount: 0,
        reason: `KPI tier: ${activityMetric} sessions → Tier ${matchedTier.min}-${matchedTier.max} (no bonus)`,
        metadata: {
          actual: activityMetric,
          tier: `${matchedTier.min}-${matchedTier.max}`,
        },
      };
    }

    return {
      eligible: true,
      amount: matchedTier.bonus,
      reason: `KPI tier bonus: ${activityMetric} sessions → Tier ${matchedTier.min}-${matchedTier.max} = ${matchedTier.bonus.toLocaleString('vi-VN')}đ`,
      metadata: {
        actual: activityMetric,
        tier: `${matchedTier.min}-${matchedTier.max}`,
        tierIndex: tiers.indexOf(matchedTier) + 1,
      },
    };
  }
}
