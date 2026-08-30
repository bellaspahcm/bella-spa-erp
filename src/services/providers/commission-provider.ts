/**
 * Commission Provider (Configuration-Driven)
 * 
 * Calculates session/service commissions based on tenant configuration.
 * Supports multiple strategies:
 * - Fixed: Fixed amount per session (e.g., 120k per session)
 * - Tier: Tiered commissions based on session ranges (e.g., 0-10: 100k, 11-20: 120k, 21+: 150k)
 * - Percentage: Percentage of service revenue (e.g., 15% of booking value)
 * - Service-Based: Different rates per service type (e.g., massage: 150k, facial: 100k)
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
 * - Spa: sessions, service revenue, service types
 * - Retail: sales transactions, product revenue, product categories
 * - Real Estate: deals, commission split, property types
 * - Delivery: deliveries, delivery fees, delivery types
 * 
 * This provider does NOT know about specific industries.
 * It reads generic config and applies universal commission logic.
 */

import {
  type SalaryComponent,
  type ProviderEvaluationOptions,
  type PayrollProvider,
  createSalaryComponent,
} from '@/lib/decision-engine/types/payroll-types';
import type { PayrollDecisionContext, SessionData } from '@/lib/decision-engine/types/decision-context';
import { PayrollConfigService } from '@/services/payroll-config.service';
import type {
  CommissionConfig,
  CommissionFixedConfig,
  CommissionTierConfig,
  CommissionPercentageConfig,
  CommissionServiceConfig,
  ProviderConfig,
} from '@/types/payroll-config';

interface CommissionSessionData extends SessionData {
  totalRevenue?: number;
  byServiceType?: Record<string, number>;
}

/**
 * Commission Provider
 * 
 * Evaluates session/service commissions using tenant configuration.
 * 
 * @example Spa with Fixed Strategy
 * ```typescript
 * // Tenant config (stored in database):
 * {
 *   provider_key: 'commission',
 *   enabled: true,
 *   strategy: 'fixed',
 *   config: {
 *     commissionPerSession: 120000
 *   }
 * }
 * 
 * // Context:
 * const context: PayrollDecisionContext = {
 *   tenantId: 'bella-spa',
 *   sessions: { count: 15 },
 *   ...
 * };
 * 
 * const result = await provider.evaluate(context);
 * // {
 * //   type: 'session-commission',
 * //   eligible: true,
 * //   amount: 1800000,
 * //   reason: 'Fixed commission: 15 sessions × 120,000đ = 1,800,000đ',
 * //   metadata: { strategy: 'fixed', sessions: 15, rate: 120000 }
 * // }
 * ```
 * 
 * @example Spa with Tier Strategy
 * ```typescript
 * // Tenant config:
 * {
 *   provider_key: 'commission',
 *   enabled: true,
 *   strategy: 'tier',
 *   config: {
 *     tiers: [
 *       { minSessions: 0, maxSessions: 10, commissionPerSession: 100000 },
 *       { minSessions: 11, maxSessions: 20, commissionPerSession: 120000 },
 *       { minSessions: 21, maxSessions: 999, commissionPerSession: 150000 }
 *     ]
 *   }
 * }
 * 
 * // Context:
 * const context: PayrollDecisionContext = {
 *   tenantId: 'bella-spa',
 *   sessions: { count: 25 },
 *   ...
 * };
 * 
 * const result = await provider.evaluate(context);
 * // {
 * //   type: 'session-commission',
 * //   eligible: true,
 * //   amount: 3750000,
 * //   reason: 'Tiered commission: 25 sessions at 150,000đ/session = 3,750,000đ',
 * //   metadata: { strategy: 'tier', sessions: 25, rate: 150000, tier: 3 }
 * // }
 * ```
 * 
 * @example Spa with Percentage Strategy
 * ```typescript
 * // Tenant config:
 * {
 *   provider_key: 'commission',
 *   enabled: true,
 *   strategy: 'percentage',
 *   config: {
 *     commissionPercentage: 15,
 *     maxCommissionPerSession: 200000
 *   }
 * }
 * 
 * // Context:
 * const context: PayrollDecisionContext = {
 *   tenantId: 'bella-spa',
 *   sessions: {
 *     count: 10,
 *     totalRevenue: 12000000
 *   },
 *   ...
 * };
 * 
 * const result = await provider.evaluate(context);
 * // {
 * //   type: 'session-commission',
 * //   eligible: true,
 * //   amount: 1800000,
 * //   reason: 'Percentage commission: 15% of 12,000,000đ = 1,800,000đ',
 * //   metadata: { strategy: 'percentage', revenue: 12000000, rate: 15 }
 * // }
 * ```
 * 
 * @example Spa with Service-Based Strategy
 * ```typescript
 * // Tenant config:
 * {
 *   provider_key: 'commission',
 *   enabled: true,
 *   strategy: 'service-based',
 *   config: {
 *     serviceRates: {
 *       'Massage': 150000,
 *       'Facial': 100000,
 *       'Manicure': 80000
 *     },
 *     defaultRate: 120000
 *   }
 * }
 * 
 * // Context:
 * const context: PayrollDecisionContext = {
 *   tenantId: 'bella-spa',
 *   sessions: {
 *     count: 12,
 *     byServiceType: {
 *       'Massage': 5,
 *       'Facial': 4,
 *       'Manicure': 3
 *     }
 *   },
 *   ...
 * };
 * 
 * const result = await provider.evaluate(context);
 * // {
 * //   type: 'session-commission',
 * //   eligible: true,
 * //   amount: 1390000,
 * //   reason: 'Service-based: Massage×5 + Facial×4 + Manicure×3 = 1,390,000đ',
 * //   metadata: { strategy: 'service-based', breakdown: {...} }
 * // }
 * ```
 */
export class CommissionProvider implements PayrollProvider<SalaryComponent> {
  readonly name = 'CommissionProvider';
  readonly decisionType = 'session-commission';

  private configService: PayrollConfigService;

  constructor() {
    this.configService = PayrollConfigService.getInstance();
  }

  /**
   * Evaluate session commission for the given context
   * 
   * Algorithm:
   * 1. Load tenant configuration from PayrollConfigService
   * 2. Check if commission provider is enabled
   * 3. Extract session data (count, revenue, service types)
   * 4. Select strategy and execute calculation
   * 5. Return SalaryComponent with full audit trail
   */
  async evaluate(
    context: PayrollDecisionContext,
    options?: ProviderEvaluationOptions
  ): Promise<SalaryComponent> {
    const { tenantId, sessions, overrides } = context;

    // Check if override amount provided
    if (options?.applyOverrides && typeof overrides?.sessionCommission === 'number') {
      return createSalaryComponent('session-commission', {
        eligible: true,
        amount: overrides.sessionCommission,
        reason: 'Manual override applied',
        metadata: {
          override: true,
        },
      });
    }

    // Step 1: Load tenant configuration
    const config = (await this.configService.getProviderConfig(tenantId, 'commission')) as unknown as ProviderConfig<CommissionConfig>;

    // Step 2: Check if commission provider is enabled
    if (!config.enabled) {
      return createSalaryComponent('session-commission', {
        eligible: false,
        amount: 0,
        reason: 'Commission calculation is disabled for this tenant',
        metadata: {
          configDisabled: true,
        },
      });
    }

    // Step 3: Extract session data
    const sessionCount = sessions?.count ?? 0;

    if (sessionCount === 0) {
      return createSalaryComponent('session-commission', {
        eligible: false,
        amount: 0,
        reason: 'No sessions completed this period',
        metadata: {
          sessionCount: 0,
        },
      });
    }

    // Step 4: Select strategy and calculate commission
    const result = this.calculateCommission(
      config.strategy || 'linear',
      config.config as CommissionConfig,
      sessions as CommissionSessionData
    );

    return createSalaryComponent('session-commission', {
      eligible: result.eligible,
      amount: result.amount,
      reason: result.reason,
      metadata: {
        strategy: config.strategy,
        sessionCount,
        ...result.metadata,
      },
    });
  }

  /**
   * Calculate commission based on strategy
   * @private
   */
  private calculateCommission(
    strategy: string,
    config: CommissionConfig,
    sessions: CommissionSessionData
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    switch (strategy) {
      case 'fixed':
        return this.calculateFixedCommission(config as CommissionFixedConfig, sessions);
      case 'tier':
        return this.calculateTierCommission(config as CommissionTierConfig, sessions);
      case 'percentage':
        return this.calculatePercentageCommission(config as CommissionPercentageConfig, sessions);
      case 'service':
        return this.calculateServiceBasedCommission(config as CommissionServiceConfig, sessions);
      default:
        return {
          eligible: false,
          amount: 0,
          reason: `Unknown commission strategy: ${strategy}`,
          metadata: { unknownStrategy: strategy },
        };
    }
  }

 /**
   * STRATEGY 1: Fixed
   * Fixed amount per session
   * @private
   */
  private calculateFixedCommission(
    config: CommissionFixedConfig,
    sessions: CommissionSessionData
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    const { rate, minSessions = 0 } = config;
    const sessionCount = sessions?.count ?? 0;

    if (sessionCount < minSessions) {
      return {
        eligible: false,
        amount: 0,
        reason: `Minimum sessions not met: ${sessionCount}/${minSessions}`,
        metadata: { sessionCount, minSessions },
      };
    }

    const totalCommission = sessionCount * rate;

    return {
      eligible: true,
      amount: Math.round(totalCommission),
      reason: `Fixed commission: ${sessionCount} sessions × ${rate.toLocaleString('vi-VN')}đ = ${totalCommission.toLocaleString('vi-VN')}đ`,
      metadata: {
        sessionCount,
        rate,
      },
    };
  }

  /**
   * STRATEGY 2: Tier
   * Tiered commissions based on session ranges
   * @private
   */
  private calculateTierCommission(
    config: CommissionTierConfig,
    sessions: CommissionSessionData
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    const { tiers } = config;
    const sessionCount = sessions?.count ?? 0;

    if (sessionCount === 0) {
      return {
        eligible: false,
        amount: 0,
        reason: 'No sessions to calculate commission',
        metadata: { sessionCount: 0 },
      };
    }

    // Find matching tier
    const matchedTier = tiers.find(
      (tier) => sessionCount >= tier.min && sessionCount <= tier.max
    );

    if (!matchedTier) {
      return {
        eligible: false,
        amount: 0,
        reason: `Session count ${sessionCount} does not match any configured tier`,
        metadata: {
          sessionCount,
          availableTiers: tiers,
        },
      };
    }

    const totalCommission = sessionCount * matchedTier.rate;

    return {
      eligible: true,
      amount: Math.round(totalCommission),
      reason: `Tiered commission: ${sessionCount} sessions at ${matchedTier.rate.toLocaleString('vi-VN')}đ/session = ${totalCommission.toLocaleString('vi-VN')}đ`,
      metadata: {
        sessionCount,
        rate: matchedTier.rate,
        tier: `${matchedTier.min}-${matchedTier.max}`,
        tierIndex: tiers.indexOf(matchedTier) + 1,
      },
    };
  }

  /**
   * STRATEGY 3: Percentage
   * Percentage of service revenue
   * @private
   */
  private calculatePercentageCommission(
    config: CommissionPercentageConfig,
    sessions: CommissionSessionData
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    const { percentage, minRevenue = 0 } = config;
    const sessionCount = sessions?.count ?? 0;
    const totalRevenue = sessions?.totalRevenue ?? 0;

    if (sessionCount === 0 || totalRevenue < minRevenue) {
      return {
        eligible: false,
        amount: 0,
        reason: totalRevenue < minRevenue 
          ? `Minimum revenue not met: ${totalRevenue.toLocaleString('vi-VN')}/${minRevenue.toLocaleString('vi-VN')}đ`
          : 'No sessions or revenue to calculate commission',
        metadata: { sessionCount, totalRevenue, minRevenue },
      };
    }

    const totalCommission = (totalRevenue * percentage) / 100;

    return {
      eligible: true,
      amount: Math.round(totalCommission),
      reason: `Percentage commission: ${percentage}% of ${totalRevenue.toLocaleString('vi-VN')}đ = ${totalCommission.toLocaleString('vi-VN')}đ`,
      metadata: {
        sessionCount,
        totalRevenue,
        rate: percentage,
      },
    };
  }

  /**
   * STRATEGY 4: Service-Based
   * Different rates per service type
   * @private
   */
  private calculateServiceBasedCommission(
    config: CommissionServiceConfig,
    sessions: CommissionSessionData
  ): {
    eligible: boolean;
    amount: number;
    reason: string;
    metadata?: Record<string, unknown>;
  } {
    const { rates } = config;
    const sessionCount = sessions?.count ?? 0;
    const byServiceType = sessions?.byServiceType ?? {};

    if (sessionCount === 0) {
      return {
        eligible: false,
        amount: 0,
        reason: 'No sessions to calculate commission',
        metadata: { sessionCount: 0 },
      };
    }

    let totalCommission = 0;
    const breakdown: Record<string, { count: number; rate: number; total: number }> = {};

    // Calculate commission for each service type
    for (const [serviceType, count] of Object.entries(byServiceType)) {
      const rate = rates[serviceType] ?? 0;
      
      if (rate === 0) {
        // Skip services not configured
        continue;
      }
      
      const serviceTotal = (count as number) * rate;
      totalCommission += serviceTotal;

      breakdown[serviceType] = {
        count: count as number,
        rate,
        total: serviceTotal,
      };
    }

    if (totalCommission === 0) {
      return {
        eligible: false,
        amount: 0,
        reason: 'No matching service types with configured rates',
        metadata: {
          sessionCount,
          availableRates: Object.keys(rates),
          sessionTypes: Object.keys(byServiceType),
        },
      };
    }

    const breakdownText = Object.entries(breakdown)
      .map(([type, data]) => `${type}×${data.count}`)
      .join(' + ');

    return {
      eligible: true,
      amount: Math.round(totalCommission),
      reason: `Service-based commission: ${breakdownText} = ${totalCommission.toLocaleString('vi-VN')}đ`,
      metadata: {
        sessionCount,
        breakdown,
        serviceTypes: Object.keys(breakdown),
      },
    };
  }
}
