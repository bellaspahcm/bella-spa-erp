/**
 * Compensation Provider (Business Policy Language)
 * 
 * Implements universal compensation calculation using policy composition:
 * 
 * POLICY COMPOSITION:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  REWARD POLICIES       → Base compensation calculation      │
 * │  MULTIPLIER POLICIES   → Performance & Position adjustments │
 * │  INCENTIVE POLICIES    → Volume & Team bonuses              │
 * │  CONSTRAINT POLICIES   → Min thresholds, Max caps           │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * CROSS-INDUSTRY ABSTRACTION:
 * - Spa: Activity=Sessions, Value=Services, Volume=Monthly sessions
 * - Retail: Activity=Sales, Value=Margin, Volume=Revenue
 * - Real Estate: Activity=Deals, Value=Commission%, Volume=Transaction value
 * - Manufacturing: Activity=Units, Value=Quality bonus, Volume=Production target
 * 
 * This provider does NOT know about "Spa" or "Retail".
 * Industry adapters map domain data → universal policy context.
 */

import {
  type SalaryComponent,
  type ProviderEvaluationOptions,
  type PayrollProvider,
  createSalaryComponent,
} from '@/lib/decision-engine/types/payroll-types';
import type { PayrollDecisionContext, SessionData, SalesData, EmployeeData } from '@/lib/decision-engine/types/decision-context';

export interface AppliedPolicies {
  rewardPolicies: string[];
  multiplierPolicies: string[];
  incentivePolicies: string[];
  constraintPolicies: string[];
}

const COMPENSATION_DECISION_TYPE = 'session-commission';

/**
 * Compensation Provider
 * 
 * Evaluates compensation policies in composition order:
 * 1. REWARD POLICIES      → Calculate base compensation from activity/value metrics
 * 2. MULTIPLIER POLICIES  → Apply performance & position adjustments
 * 3. INCENTIVE POLICIES   → Add volume & team bonuses
 * 4. CONSTRAINT POLICIES  → Apply min thresholds & max caps
 * 
 * @example Spa (via Spa Adapter)
 * ```typescript
 * // Adapter transforms Spa domain → Universal policy context
 * const context = {
 *   activityMetric: 15,          // 15 sessions
 *   valueMetric: 11000000,       // Service+Product sales
 *   performanceScore: 4.6,       // Average rating
 *   positionTier: 'senior',
 *   rewardRates: {
 *     activity: 150000,          // Per session
 *     value: 0.11                // 11% of sales
 *   }
 * };
 * 
 * const result = await provider.evaluate(context);
 * // Returns: SalaryComponent with policy composition metadata
 * ```
 * 
 * @example Real Estate (via Real Estate Adapter)
 * ```typescript
 * // Same engine, different domain mapping
 * const context = {
 *   activityMetric: 3,           // 3 deals closed
 *   valueMetric: 120000000,      // Transaction value
 *   performanceScore: null,      // N/A for real estate
 *   rewardRates: {
 *     activity: 2000000,         // Per deal
 *     value: 0.03                // 3% commission
 *   }
 * };
 * 
 * const result = await provider.evaluate(context);
 * ```
 */
export class CompensationProvider implements PayrollProvider<SalaryComponent> {
  readonly name = 'CompensationProvider';
  readonly decisionType = COMPENSATION_DECISION_TYPE;

  /**
   * Evaluate compensation using Policy Composition
   * 
   * ALGORITHM (Policy Composition):
   * ┌──────────────────────────────────────────────────────────┐
   * │ Phase 1: REWARD POLICIES                                 │
   * │  R1. Activity-Based Reward  (activityMetric × rate)      │
   * │  R2. Value-Based Reward     (valueMetric × rate)         │
   * │  R3. Sales-Based Reward     (productSales × rate)        │
   * ├──────────────────────────────────────────────────────────┤
   * │ Phase 2: MULTIPLIER POLICIES                             │
   * │  M1. Performance Multiplier (if performanceScore >= X)   │
   * │  M2. Position Multiplier    (if positionTier > junior)   │
   * ├──────────────────────────────────────────────────────────┤
   * │ Phase 3: INCENTIVE POLICIES                              │
   * │  I1. Volume Incentive       (if volumeGoal met)          │
   * │  I2. Team Incentive         (if team lead/manager)       │
   * ├──────────────────────────────────────────────────────────┤
   * │ Phase 4: CONSTRAINT POLICIES                             │
   * │  C1. Min Threshold          (qualification gate)         │
   * │  C2. Max Cap                (per period limit)           │
   * │  C3. Item Cap               (per transaction limit)      │
   * └──────────────────────────────────────────────────────────┘
   * 
   * POLICY METADATA:
   * The result includes `policyComposition` showing which policies applied:
   * {
   *   rewardPolicies: ['R1:Activity', 'R2:Value'],
   *   multiplierPolicies: ['M1:Performance-1.1x'],
   *   incentivePolicies: ['I1:Volume-500k'],
   *   constraintPolicies: ['C2:MaxCap-Applied']
   * }
   */
  async evaluate(
    context: PayrollDecisionContext,
    options?: ProviderEvaluationOptions
  ): Promise<SalaryComponent> {
    const { employee, sessions, sales, tenantConfig, overrides } = context;

    // Track which policies applied
    const appliedPolicies: AppliedPolicies = {
      rewardPolicies: [] as string[],
      multiplierPolicies: [] as string[],
      incentivePolicies: [] as string[],
      constraintPolicies: [] as string[],
    };

    // Check if override amount provided
    if (options?.applyOverrides && overrides?.compensation !== undefined) {
      return createSalaryComponent('session-commission', {
        eligible: true,
        amount: overrides.compensation,
        reason: 'Manual override applied',
        metadata: {
          override: true,
          policyComposition: appliedPolicies,
        },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: REWARD POLICIES
    // Calculate base compensation from activity/value metrics
    // ═══════════════════════════════════════════════════════════
    
    // R1. Activity-Based Reward (e.g., sessions, deals, units)
    const activityReward = this.applyActivityReward(sessions, tenantConfig, appliedPolicies);
    
    // R2. Value-Based Reward (e.g., service fees, commission %)
    const valueReward = this.applyValueReward(sales, tenantConfig, appliedPolicies);
    
    // R3. Sales-Based Reward (e.g., product sales, margin)
    const salesReward = this.applySalesReward(sales, tenantConfig, appliedPolicies);

    // Base compensation (sum of all reward policies)
    const baseCompensation = activityReward + valueReward + salesReward;

    // ═══════════════════════════════════════════════════════════
    // PHASE 4: CONSTRAINT POLICIES (Check eligibility FIRST)
    // ═══════════════════════════════════════════════════════════
    
    // C1. Min Threshold Constraint (qualification gate)
    const minThresholdCheck = this.checkMinThreshold(
      sessions,
      tenantConfig,
      appliedPolicies
    );
    
    if (!minThresholdCheck.eligible) {
      return createSalaryComponent('session-commission', {
        eligible: false,
        amount: 0,
        reason: minThresholdCheck.reason,
        metadata: {
          ...minThresholdCheck.metadata,
          policyComposition: appliedPolicies,
        },
      });
    }

    if (baseCompensation === 0) {
      return createSalaryComponent('session-commission', {
        eligible: false,
        amount: 0,
        reason: 'No compensation-eligible activity (no reward policies triggered)',
        metadata: {
          activityMetric: sessions?.count || 0,
          valueMetric: sales?.serviceCount || 0,
          salesMetric: sales?.productSales || 0,
          policyComposition: appliedPolicies,
        },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: MULTIPLIER POLICIES
    // Apply performance & position adjustments
    // ═══════════════════════════════════════════════════════════
    
    // M1. Performance Multiplier (based on rating/quality score)
    const performanceResult = this.applyPerformanceMultiplier(
      baseCompensation,
      sessions?.avgRating,
      appliedPolicies
    );
    
    // M2. Position Multiplier (based on seniority tier)
    const positionResult = this.applyPositionMultiplier(
      valueReward + salesReward, // Applied only to value/sales, NOT activity
      employee.positionTier,
      appliedPolicies
    );

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: INCENTIVE POLICIES
    // Add volume & team bonuses
    // ═══════════════════════════════════════════════════════════
    
    // I1. Volume Incentive (tier-based bonus)
    const volumeIncentive = this.applyVolumeIncentive(
      sales,
      sessions,
      tenantConfig,
      appliedPolicies
    );
    
    // I2. Team Incentive (team lead override)
    const teamIncentive = this.applyTeamIncentive(
      employee,
      context.metadata?.teamTotalCompensation,
      appliedPolicies
    );

    // Total compensation (before max cap)
    let totalCompensation =
      baseCompensation +
      performanceResult.bonus +
      positionResult.bonus +
      volumeIncentive +
      teamIncentive;

    // C2. Max Cap Constraint
    const maxCapResult = this.applyMaxCap(
      totalCompensation,
      tenantConfig,
      appliedPolicies
    );
    
    totalCompensation = maxCapResult.cappedAmount;

    // Build breakdown
    const breakdown: Record<string, number> = {};
    if (activityReward > 0) breakdown.activityReward = activityReward;
    if (valueReward > 0) breakdown.valueReward = valueReward;
    if (salesReward > 0) breakdown.salesReward = salesReward;
    if (performanceResult.bonus > 0) breakdown.performanceBonus = Math.round(performanceResult.bonus);
    if (positionResult.bonus > 0) breakdown.positionBonus = Math.round(positionResult.bonus);
    if (volumeIncentive > 0) breakdown.volumeIncentive = volumeIncentive;
    if (teamIncentive > 0) breakdown.teamIncentive = teamIncentive;

    // Build reason (policy-based narrative)
    const reasonParts: string[] = [];
    if (appliedPolicies.rewardPolicies.length > 0) {
      reasonParts.push(`Rewards: ${appliedPolicies.rewardPolicies.join(', ')}`);
    }
    if (appliedPolicies.multiplierPolicies.length > 0) {
      reasonParts.push(`Multipliers: ${appliedPolicies.multiplierPolicies.join(', ')}`);
    }
    if (appliedPolicies.incentivePolicies.length > 0) {
      reasonParts.push(`Incentives: ${appliedPolicies.incentivePolicies.join(', ')}`);
    }
    if (appliedPolicies.constraintPolicies.length > 0) {
      reasonParts.push(`Constraints: ${appliedPolicies.constraintPolicies.join(', ')}`);
    }

    const reason = reasonParts.join(' | ');

    return createSalaryComponent('session-commission', {
      eligible: true,
      amount: Math.round(totalCompensation),
      reason,
      breakdown,
      metadata: {
        baseCompensation,
        policyComposition: appliedPolicies,
        multipliers: {
          performance: performanceResult.multiplier,
          position: positionResult.multiplier,
        },
        activityMetric: sessions?.count || 0,
        performanceScore: sessions?.avgRating,
        valueMetric: sales?.serviceCount || 0,
        salesMetric: sales?.productSales || 0,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // REWARD POLICIES
  // ═══════════════════════════════════════════════════════════

  /**
   * R1. Activity-Based Reward Policy
   * Universal formula: activityMetric × rewardRate × weightMultiplier
   * 
   * CROSS-INDUSTRY MAPPING:
   * - Spa: sessions × 150k × packageMultiplier
   * - Retail: sales × commission
   * - Real Estate: deals × 2M
   * - Manufacturing: units × bonusRate
   */
  private applyActivityReward(
    activityData: SessionData | undefined,
    config: PayrollDecisionContext['tenantConfig'],
    appliedPolicies: AppliedPolicies
  ): number {
    if (!activityData || activityData.count === 0) return 0;
    if (!config?.sessionCommissionRate) return 0;

    const baseRate = config.sessionCommissionRate;
    const activityMetric = activityData.weightedCount || activityData.count;
    const reward = activityMetric * baseRate;

    if (reward > 0) {
      appliedPolicies.rewardPolicies.push(
        `R1:Activity(${activityMetric}×${baseRate.toLocaleString('vi-VN')}=${reward.toLocaleString('vi-VN')})`
      );
    }

    return reward;
  }

  /**
   * R2. Value-Based Reward Policy
   * Universal formula: valueMetric × rewardRate
   * 
   * CROSS-INDUSTRY MAPPING:
   * - Spa: serviceFees × 10%
   * - Retail: margin × commissionRate
   * - Real Estate: transactionValue × 3%
   * - Manufacturing: qualityScore × bonusRate
   */
  private applyValueReward(
    valueData: SalesData | undefined,
    config: PayrollDecisionContext['tenantConfig'],
    appliedPolicies: AppliedPolicies
  ): number {
    if (!valueData || valueData.serviceCount === 0) return 0;
    if (!config?.serviceCommissionRate) return 0;

    const rate = config.serviceCommissionRate;

    // If rate < 1, assume it's a percentage (e.g., 0.10 = 10%)
    if (rate < 1 && valueData.serviceSales) {
      const reward = valueData.serviceSales * rate;
      if (reward > 0) {
        appliedPolicies.rewardPolicies.push(
          `R2:Value(${valueData.serviceSales.toLocaleString('vi-VN')}×${(rate * 100).toFixed(0)}%=${reward.toLocaleString('vi-VN')})`
        );
      }
      return reward;
    }

    // Otherwise, it's a fixed rate per item
    const reward = valueData.serviceCount * rate;
    if (reward > 0) {
      appliedPolicies.rewardPolicies.push(
        `R2:Value(${valueData.serviceCount}×${rate.toLocaleString('vi-VN')}=${reward.toLocaleString('vi-VN')})`
      );
    }
    return reward;
  }

  /**
   * R3. Sales-Based Reward Policy
   * Universal formula: salesMetric × rewardRate
   * 
   * CROSS-INDUSTRY MAPPING:
   * - Spa: productSales × 12%
   * - Retail: totalSales × marginRate
   * - Real Estate: N/A
   * - Manufacturing: N/A
   */
  private applySalesReward(
    salesData: SalesData | undefined,
    config: PayrollDecisionContext['tenantConfig'],
    appliedPolicies: AppliedPolicies
  ): number {
    if (!salesData || !salesData.productSales || salesData.productSales === 0) return 0;
    if (!config?.productCommissionRate) return 0;

    const reward = salesData.productSales * config.productCommissionRate;
    
    if (reward > 0) {
      appliedPolicies.rewardPolicies.push(
        `R3:Sales(${salesData.productSales.toLocaleString('vi-VN')}×${(config.productCommissionRate * 100).toFixed(0)}%=${reward.toLocaleString('vi-VN')})`
      );
    }

    return reward;
  }

  // ═══════════════════════════════════════════════════════════
  // MULTIPLIER POLICIES
  // ═══════════════════════════════════════════════════════════

  /**
   * M1. Performance Multiplier Policy
   * Universal formula: baseAmount × (1 + performanceBonus%)
   * 
   * CROSS-INDUSTRY MAPPING:
   * - Spa: avgRating >= 4.5 → 1.1x
   * - Retail: customerSatisfaction >= 90% → 1.15x
   * - Real Estate: closingRate >= 50% → 1.2x
   * - Manufacturing: defectRate < 1% → 1.25x
   */
  private applyPerformanceMultiplier(
    baseAmount: number,
    performanceScore: number | null | undefined,
    appliedPolicies: AppliedPolicies
  ): { multiplier: number; bonus: number } {
    if (!performanceScore || baseAmount === 0) {
      return { multiplier: 1.0, bonus: 0 };
    }

    let multiplier = 1.0;
    if (performanceScore >= 5.0) multiplier = 1.2;
    else if (performanceScore >= 4.8) multiplier = 1.15;
    else if (performanceScore >= 4.5) multiplier = 1.1;

    const bonus = baseAmount * (multiplier - 1.0);

    if (bonus > 0) {
      appliedPolicies.multiplierPolicies.push(
        `M1:Performance(${performanceScore.toFixed(1)}→${multiplier}x=+${bonus.toLocaleString('vi-VN')})`
      );
    }

    return { multiplier, bonus };
  }

  /**
   * M2. Position Multiplier Policy
   * Universal formula: applicableAmount × positionMultiplier
   * 
   * CROSS-INDUSTRY MAPPING:
   * - Spa: Senior KTV → 1.2x on services/products
   * - Retail: Senior Sales → 1.3x
   * - Real Estate: Senior Agent → 1.4x
   * - Manufacturing: Team Lead → 1.5x
   */
  private applyPositionMultiplier(
    applicableAmount: number,
    positionTier: string | undefined,
    appliedPolicies: AppliedPolicies
  ): { multiplier: number; bonus: number } {
    if (!positionTier || positionTier === 'junior' || applicableAmount === 0) {
      return { multiplier: 1.0, bonus: 0 };
    }

    const multipliers: Record<string, number> = {
      junior: 1.0,
      senior: 1.2,
      lead: 1.5,
      manager: 2.0,
    };

    const multiplier = multipliers[positionTier] || 1.0;
    const bonus = applicableAmount * (multiplier - 1.0);

    if (bonus > 0) {
      appliedPolicies.multiplierPolicies.push(
        `M2:Position(${positionTier}→${multiplier}x=+${bonus.toLocaleString('vi-VN')})`
      );
    }

    return { multiplier, bonus };
  }

  // ═══════════════════════════════════════════════════════════
  // INCENTIVE POLICIES
  // ═══════════════════════════════════════════════════════════

  /**
   * I1. Volume Incentive Policy
   * Universal formula: Tiered bonus based on volume thresholds
   * 
   * CROSS-INDUSTRY MAPPING:
   * - Spa: 50+ sessions → 1M bonus
   * - Retail: 200M+ revenue → 3M bonus
   * - Real Estate: 10+ deals → 5M bonus
   * - Manufacturing: 1000+ units → 2M bonus
   */
  private applyVolumeIncentive(
    salesData: (SalesData & { totalRevenue?: number }) | undefined,
    activityData: SessionData | undefined,
    config: PayrollDecisionContext['tenantConfig'],
    appliedPolicies: AppliedPolicies
  ): number {
    const totalRevenue = salesData?.totalRevenue || salesData?.serviceSales || 0;
    const activityCount = activityData?.count || 0;

    // Revenue-based tiers
    if (totalRevenue >= 200000000) {
      appliedPolicies.incentivePolicies.push('I1:Volume(Revenue>=200M→3M)');
      return 3000000;
    }
    if (totalRevenue >= 100000000) {
      appliedPolicies.incentivePolicies.push('I1:Volume(Revenue>=100M→1.5M)');
      return 1500000;
    }
    if (totalRevenue >= 50000000) {
      appliedPolicies.incentivePolicies.push('I1:Volume(Revenue>=50M→500k)');
      return 500000;
    }

    // Activity-based tiers (for service industries)
    if (activityCount >= 50) {
      appliedPolicies.incentivePolicies.push('I1:Volume(Activity>=50→1M)');
      return 1000000;
    }
    if (activityCount >= 30) {
      appliedPolicies.incentivePolicies.push('I1:Volume(Activity>=30→500k)');
      return 500000;
    }

    return 0;
  }

  /**
   * I2. Team Incentive Policy
   * Universal formula: teamTotalCompensation × overrideRate
   * 
   * CROSS-INDUSTRY MAPPING:
   * - Spa: Team Lead → 0.5% of team total
   * - Retail: Store Manager → 1% of team total
   * - Real Estate: Broker → 2% of team total
   * - Manufacturing: Supervisor → 0.8% of team total
   */
  private applyTeamIncentive(
    employee: EmployeeData,
    teamTotalCompensation: number | undefined,
    appliedPolicies: AppliedPolicies
  ): number {
    if (!teamTotalCompensation || teamTotalCompensation === 0) return 0;
    if (!employee.positionTier) return 0;

    const overrideRates: Record<string, number> = {
      junior: 0,
      senior: 0,
      lead: 0.005,  // 0.5%
      manager: 0.01, // 1%
    };

    const rate = overrideRates[employee.positionTier] || 0;
    const incentive = teamTotalCompensation * rate;

    if (incentive > 0) {
      appliedPolicies.incentivePolicies.push(
        `I2:Team(${employee.positionTier}→${(rate * 100).toFixed(1)}%×${teamTotalCompensation.toLocaleString('vi-VN')}=${incentive.toLocaleString('vi-VN')})`
      );
    }

    return incentive;
  }

  // ═══════════════════════════════════════════════════════════
  // CONSTRAINT POLICIES
  // ═══════════════════════════════════════════════════════════

  /**
   * C1. Min Threshold Constraint Policy
   * Universal formula: Qualification gate (must meet minimum to be eligible)
   * 
   * CROSS-INDUSTRY MAPPING:
   * - Spa: Must complete >= 3 sessions
   * - Retail: Must have >= 1 sale
   * - Real Estate: Must close >= 1 deal
   * - Manufacturing: Must meet >= 80% production quota
   */
  private checkMinThreshold(
    activityData: SessionData | undefined,
    config: PayrollDecisionContext['tenantConfig'],
    appliedPolicies: AppliedPolicies
  ): { eligible: boolean; reason: string; metadata?: Record<string, unknown> } {
    if (!config?.minSessionsForCommission) {
      return { eligible: true, reason: '' };
    }

    if (!activityData || activityData.count < config.minSessionsForCommission) {
      appliedPolicies.constraintPolicies.push(
        `C1:MinThreshold(${activityData?.count || 0}/${config.minSessionsForCommission}→BLOCKED)`
      );

      return {
        eligible: false,
        reason: `Did not meet minimum threshold (${activityData?.count || 0}/${config.minSessionsForCommission} required)`,
        metadata: {
          minThresholdNotMet: true,
          activityCount: activityData?.count || 0,
          minRequired: config.minSessionsForCommission,
        },
      };
    }

    appliedPolicies.constraintPolicies.push(
      `C1:MinThreshold(${activityData.count}/${config.minSessionsForCommission}→PASS)`
    );

    return { eligible: true, reason: '' };
  }

  /**
   * C2. Max Cap Constraint Policy
   * Universal formula: Cap total compensation at configured maximum
   * 
   * CROSS-INDUSTRY MAPPING:
   * - Spa: Max 15M/month
   * - Retail: Max 30M/month
   * - Real Estate: Max 50M/month
   * - Manufacturing: Max 20M/month
   */
  private applyMaxCap(
    totalAmount: number,
    config: PayrollDecisionContext['tenantConfig'],
    appliedPolicies: AppliedPolicies
  ): { cappedAmount: number } {
    if (!config?.maxCompensationPerMonth || totalAmount <= config.maxCompensationPerMonth) {
      return { cappedAmount: totalAmount };
    }

    const cappedAmount = config.maxCompensationPerMonth;
    const reductionAmount = totalAmount - cappedAmount;

    appliedPolicies.constraintPolicies.push(
      `C2:MaxCap(${totalAmount.toLocaleString('vi-VN')}→${cappedAmount.toLocaleString('vi-VN')},-${reductionAmount.toLocaleString('vi-VN')})`
    );

    return { cappedAmount };
  }
}
