/**
 * Rating Provider (Configuration-Driven)
 * 
 * Calculates rating-based bonuses (quality incentive for high customer satisfaction).
 * Supports multiple strategies:
 * - Threshold: Fixed bonus when rating meets threshold (e.g., ≥4.5 stars → 50k)
 * - Linear: Progressive bonus (e.g., 10k per 0.1 star above baseline)
 * - Tier: Tiered bonuses (e.g., 4.0-4.4: 0, 4.5-4.7: 50k, 4.8+: 100k)
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
 * - Spa: avgRating ≥ 4.5 stars → 50k bonus
 * - Retail: customerSatisfaction ≥ 90% → 100k bonus
 * - Restaurant: reviewScore ≥ 4.7 → 80k bonus
 * - Call Center: CSAT ≥ 95% → 200k bonus
 * 
 * This provider does NOT know about "Spa" or "Retail".
 * It reads generic config and applies universal rating logic.
 */

import {
  type SalaryComponent,
  type ProviderEvaluationOptions,
  type PayrollProvider,
  createSalaryComponent,
} from '@/lib/decision-engine/types/payroll-types';
import type { PayrollDecisionContext } from '@/lib/decision-engine/types/decision-context';
import { PayrollConfigService } from '@/services/payroll-config.service';
import type { RatingConfig, RatingThresholdConfig, RatingLinearConfig, RatingTierConfig } from '@/types/payroll-config';

/**
 * Rating Provider
 * 
 * Evaluates rating-based bonuses using tenant configuration.
 * 
 * @example Spa with Threshold Strategy
 * ```typescript
 * // Tenant config (stored in database):
 * {
 *   provider_key: 'rating',
 *   enabled: true,
 *   strategy: 'threshold',
 *   config: {
 *     minRating: 4.5,
 *     bonus: 50000
 *   }
 * }
 * 
 * // Context:
 * const context: PayrollDecisionContext = {
 *   tenantId: 'bella-spa',
 *   sessions: {
 *     avgRating: 4.7,
 *     count: 25
 *   },
 *   ...
 * };
 * 
 * const result = await provider.evaluate(context);
 * // {
 * //   type: 'rating-bonus',
 * //   eligible: true,
 * //   amount: 50000,
 * //   reason: 'Rating bonus: 4.7★ ≥ 4.5★ threshold → 50,000đ',
 * //   metadata: { strategy: 'threshold', minRating: 4.5, avgRating: 4.7 }
 * // }
 * ```
 * 
 * @example Spa with Tier Strategy
 * ```typescript
 * // Tenant config:
 * {
 *   provider_key: 'rating',
 *   enabled: true,
 *   strategy: 'tier',
 *   config: {
 *     tiers: [
 *       { min: 0, max: 4.4, bonus: 0 },
 *       { min: 4.5, max: 4.7, bonus: 50000 },
 *       { min: 4.8, max: 5.0, bonus: 150000 }
 *     ]
 *   }
 * }
 * 
 * // Context:
 * const context: PayrollDecisionContext = {
 *   tenantId: 'bella-spa',
 *   sessions: { avgRating: 4.9 },
 *   ...
 * };
 * 
 * const result = await provider.evaluate(context);
 * // {
 * //   type: 'rating-bonus',
 * //   eligible: true,
 * //   amount: 150000,
 * //   reason: 'Rating tier bonus: 4.9★ → Tier 4.8-5.0 = 150,000đ',
 * //   metadata: { strategy: 'tier', avgRating: 4.9, tier: '4.8-5.0' }
 * // }
 * ```
 */
export class RatingProvider implements PayrollProvider<SalaryComponent> {
  readonly name = 'RatingProvider';
  readonly decisionType = 'rating-bonus';

  private configService: PayrollConfigService;

  constructor() {
    this.configService = PayrollConfigService.getInstance();
  }

  /**
   * Evaluate rating bonus for the given context
   * 
   * Algorithm:
   * 1. Load tenant configuration from PayrollConfigService
   * 2. Check if rating provider is enabled
   * 3. Extract rating metric (avgRating from sessions)
   * 4. Select strategy and execute calculation
   * 5. Return SalaryComponent with full audit trail
   */
  async evaluate(
    context: PayrollDecisionContext,
    options?: ProviderEvaluationOptions
  ): Promise<SalaryComponent> {
    const { tenantId, sessions, overrides } = context;

    // Check if override amount provided
    if (options?.applyOverrides && overrides?.ratingBonus !== undefined) {
      return createSalaryComponent('rating-bonus', {
        eligible: true,
        amount: overrides.ratingBonus,
        reason: 'Manual override applied',
        metadata: {
          override: true,
        },
      });
    }

    // Step 1: Load tenant configuration
    const config = await this.configService.getProviderConfig<RatingConfig>(tenantId, 'rating');

    // Step 2: Check if rating provider is enabled
    if (!config.enabled) {
      return createSalaryComponent('rating-bonus', {
        eligible: false,
        amount: 0,
        reason: 'Rating bonus is disabled for this tenant',
        metadata: {
          configDisabled: true,
        },
      });
    }

    // Step 3: Extract rating metric
    const avgRating = sessions?.avgRating;

    if (avgRating === null || avgRating === undefined) {
      return createSalaryComponent('rating-bonus', {
        eligible: false,
        amount: 0,
        reason: 'No rating data available (no sessions or no ratings)',
        metadata: {
          sessionCount: sessions?.count || 0,
        },
      });
    }

    // Step 4: Select strategy and calculate bonus
    const result = this.calculateBonus(config.strategy, config.config, avgRating);

    return createSalaryComponent('rating-bonus', {
      eligible: result.eligible,
      amount: result.amount,
      reason: result.reason,
      metadata: {
        strategy: config.strategy,
        avgRating,
        sessionCount: sessions?.count || 0,
        ...result.metadata,
      },
    });
  }

  /**
   * Calculate bonus based on strategy
   * @private
   */
  private calculateBonus(
    strategy: string,
    config: any,
    avgRating: number
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, any>;
  } {
    switch (strategy) {
      case 'threshold':
        return this.calculateThresholdBonus(config as RatingThresholdConfig, avgRating);
      case 'linear':
        return this.calculateLinearBonus(config as RatingLinearConfig, avgRating);
      case 'tier':
        return this.calculateTierBonus(config as RatingTierConfig, avgRating);
      default:
        return {
          eligible: false,
          amount: 0,
          reason: `Unknown rating strategy: ${strategy}`,
          metadata: { unknownStrategy: strategy },
        };
    }
  }

  /**
   * STRATEGY 1: Threshold
   * Fixed bonus when rating meets threshold
   * @private
   */
  private calculateThresholdBonus(
    config: RatingThresholdConfig,
    avgRating: number
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, any>;
  } {
    const { minRating, bonus } = config;

    if (avgRating >= minRating) {
      return {
        eligible: true,
        amount: bonus,
        reason: `Rating bonus: ${avgRating.toFixed(1)}★ ≥ ${minRating.toFixed(1)}★ threshold → ${bonus.toLocaleString('vi-VN')}đ`,
        metadata: {
          minRating,
          exceeded: avgRating - minRating,
        },
      };
    }

    return {
      eligible: false,
      amount: 0,
      reason: `Rating below threshold: ${avgRating.toFixed(1)}★ < ${minRating.toFixed(1)}★ (need +${(minRating - avgRating).toFixed(1)}★)`,
      metadata: {
        minRating,
        shortfall: minRating - avgRating,
      },
    };
  }

  /**
   * STRATEGY 2: Linear
   * Progressive bonus (bonusPerPoint × points above baseline)
   * @private
   */
  private calculateLinearBonus(
    config: RatingLinearConfig,
    avgRating: number
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, any>;
  } {
    const { baseline, bonusPerPoint, maxBonus } = config;

    if (avgRating <= baseline) {
      return {
        eligible: false,
        amount: 0,
        reason: `Rating below baseline: ${avgRating.toFixed(1)}★ ≤ ${baseline.toFixed(1)}★`,
        metadata: {
          baseline,
          shortfall: baseline - avgRating,
        },
      };
    }

    const pointsAboveBaseline = avgRating - baseline;
    let bonus = pointsAboveBaseline * bonusPerPoint;

    // Apply max cap if configured
    if (maxBonus && bonus > maxBonus) {
      bonus = maxBonus;
    }

    return {
      eligible: true,
      amount: Math.round(bonus),
      reason: `Rating linear bonus: (${avgRating.toFixed(1)}★ - ${baseline.toFixed(1)}★) × ${bonusPerPoint.toLocaleString('vi-VN')}đ = ${bonus.toLocaleString('vi-VN')}đ${maxBonus && bonus >= maxBonus ? ' (capped)' : ''}`,
      metadata: {
        baseline,
        pointsAboveBaseline: parseFloat(pointsAboveBaseline.toFixed(2)),
        bonusPerPoint,
        maxBonus,
        capped: maxBonus && bonus >= maxBonus,
      },
    };
  }

  /**
   * STRATEGY 3: Tier
   * Tiered bonuses based on rating ranges
   * @private
   */
  private calculateTierBonus(
    config: RatingTierConfig,
    avgRating: number
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, any>;
  } {
    const { tiers } = config;

    // Find matching tier
    const matchedTier = tiers.find(
      (tier) => avgRating >= tier.min && avgRating <= tier.max
    );

    if (!matchedTier) {
      return {
        eligible: false,
        amount: 0,
        reason: `Rating ${avgRating.toFixed(1)}★ does not match any configured tier`,
        metadata: {
          avgRating,
          availableTiers: tiers,
        },
      };
    }

    if (matchedTier.bonus === 0) {
      return {
        eligible: false,
        amount: 0,
        reason: `Rating tier bonus: ${avgRating.toFixed(1)}★ → Tier ${matchedTier.min.toFixed(1)}-${matchedTier.max.toFixed(1)} (no bonus)`,
        metadata: {
          avgRating,
          tier: `${matchedTier.min}-${matchedTier.max}`,
          tierIndex: tiers.indexOf(matchedTier) + 1,
        },
      };
    }

    return {
      eligible: true,
      amount: matchedTier.bonus,
      reason: `Rating tier bonus: ${avgRating.toFixed(1)}★ → Tier ${matchedTier.min.toFixed(1)}-${matchedTier.max.toFixed(1)} = ${matchedTier.bonus.toLocaleString('vi-VN')}đ`,
      metadata: {
        avgRating,
        tier: `${matchedTier.min}-${matchedTier.max}`,
        tierIndex: tiers.indexOf(matchedTier) + 1,
      },
    };
  }
}
