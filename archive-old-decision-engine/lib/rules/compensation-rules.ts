/**
 * Compensation Rules (Universal Business Model)
 * 
 * These rules implement a universal compensation model using abstract components:
 * - Reward: What you get for performing activities
 * - Multiplier: Performance boost factors
 * - Incentive: Goal-based bonuses
 * - Penalty: Reductions for violations/underperformance
 * - Cap: Upper limits
 * - Floor: Lower limits / minimum thresholds
 * 
 * Design Philosophy:
 * Engine doesn't know about "sessions", "sales", or "deals".
 * Engine only knows about: Rewards, Multipliers, Caps, Constraints.
 * 
 * Industry Mapping Examples:
 * - Spa: activityMetric = 'sessions', performanceMetric = 'avgRating'
 * - Retail: activityMetric = 'sales', performanceMetric = 'margin'
 * - Real Estate: activityMetric = 'deals', performanceMetric = 'closingRate'
 * - Manufacturing: activityMetric = 'unitsProduced', performanceMetric = 'qualityScore'
 * 
 * Same rules. Different metrics. Platform proven.
 * 
 * Priority Range: P180-P135 (after base salary)
 * 
 * @see docs/decision-engine/COMPENSATION_POLICY_DESIGN.md
 */

/**
 * Decision Type for Compensation Rules
 */
export const COMPENSATION_DECISION_TYPE = 'compensation-eligibility';

/**
 * @deprecated This file uses legacy rule format and is not actively used.
 * See src/services/providers/ for current implementation.
 */

/**
 * Compensation Rules
 * 
 * Priority ordering (highest first):
 * - P180: Session-based compensation (per session/transaction)
 * - P175: Service-based compensation (per service item)
 * - P170: Product-based compensation (sales margin)
 * - P165: Volume tier bonus (sales > threshold)
 * - P160: Position multiplier (Senior/Lead/Manager)
 * - P155: Performance multiplier (rating, quality score)
 * - P150: Team bonus (team lead override)
 * - P145: Min threshold (must meet minimum to qualify)
 * - P140: Compensation cap (max per period)
 * - P135: Individual item cap (max per transaction)
 */
export const compensationRules: any[] = [
  /**
   * Rule P180: Activity-Based Reward
   * 
   * Universal formula: activityCount × baseRate × activityMultiplier
   * 
   * Industry mappings:
   * - Spa: sessions × 150k × packageMultiplier (VIP 2.0x)
   * - Retail: sales × 5% × categoryMultiplier
   * - Real Estate: deals × 2M × propertyTierMultiplier
   * - Manufacturing: unitsProduced × 5k × batchMultiplier
   * - Logistics: deliveries × 20k × urgencyMultiplier
   * 
   * Note: This is the most fundamental compensation rule.
   * Everything else (multipliers, incentives) builds on top of this.
   */
  {
    id: 'compensation-activity-reward',
    name: 'Activity-Based Reward',
    description: 'Calculate reward based on completed activities (universal)',
    type: COMPENSATION_DECISION_TYPE,
    priority: 180,
    conditions: {
      all: [
        {
          fact: 'activity.count',
          operator: 'greaterThan',
          value: 0,
        },
        {
          fact: 'tenantConfig.activityRewardRate',
          operator: 'greaterThan',
          value: 0,
        },
      ],
    },
    event: {
      type: 'compensation-calculated',
      params: {
        calculation: 'activity-reward',
        formula: 'activityCount × rewardRate × activityMultiplier',
        componentType: 'activity-reward',
      },
    },
  },

  /**
   * Rule P175: Value-Based Reward
   * 
   * Universal formula: Σ(itemValue × rewardRate)
   * 
   * Industry mappings:
   * - Spa: serviceValue × 10% commission
   * - Retail: productValue × margin%
   * - Real Estate: propertyValue × 3% commission
   * - Healthcare: procedureValue × fee%
   * - Consulting: projectValue × rate%
   * 
   * Can be:
   * - Fixed: 150,000đ per item
   * - Percentage: 10% of item value
   */
  {
    id: 'compensation-value-reward',
    name: 'Value-Based Reward',
    description: 'Calculate reward based on value of items/services delivered',
    type: COMPENSATION_DECISION_TYPE,
    priority: 175,
    conditions: {
      all: [
        {
          fact: 'value.count',
          operator: 'greaterThan',
          value: 0,
        },
        {
          fact: 'tenantConfig.valueRewardRate',
          operator: 'greaterThan',
          value: 0,
        },
      ],
    },
    event: {
      type: 'compensation-calculated',
      params: {
        calculation: 'value-reward',
        formula: 'Σ(itemValue × rewardRate)',
        componentType: 'value-reward',
      },
    },
  },

  /**
   * Rule P170: Sales-Based Reward
   * 
   * Universal formula: totalSales × rewardRate
   * 
   * Industry mappings:
   * - Spa: productSales × 12% commission
   * - Retail: merchandiseSales × margin%
   * - Pharmacy: prescriptionSales × 8%
   * - E-commerce: orderValue × affiliate%
   * 
   * Typically percentage-based (5-20%)
   */
  {
    id: 'compensation-sales-reward',
    name: 'Sales-Based Reward',
    description: 'Calculate reward based on sales volume/revenue',
    type: COMPENSATION_DECISION_TYPE,
    priority: 170,
    conditions: {
      all: [
        {
          fact: 'sales.total',
          operator: 'greaterThan',
          value: 0,
        },
        {
          fact: 'tenantConfig.salesRewardRate',
          operator: 'greaterThan',
          value: 0,
        },
      ],
    },
    event: {
      type: 'compensation-calculated',
      params: {
        calculation: 'sales-reward',
        formula: 'totalSales × rewardRate',
        componentType: 'sales-reward',
      },
    },
  },

  /**
   * Rule P165: Volume Incentive (Goal-Based Bonus)
   * 
   * Universal formula: IF (metric >= threshold) THEN bonusAmount
   * 
   * Industry mappings:
   * - Spa: sessions > 50 → +1M bonus
   * - Retail: sales > 200M → +3M bonus
   * - Real Estate: deals > 10 → +5M bonus
   * - Manufacturing: units > 1000 → +2M bonus
   * - Logistics: deliveries > 500 → +1M bonus
   * 
   * Tiers:
   * - Tier 1: > 50M/50 units → +500k
   * - Tier 2: > 100M/100 units → +1.5M
   * - Tier 3: > 200M/200 units → +3M
   */
  {
    id: 'compensation-volume-incentive',
    name: 'Volume Incentive (Goal Bonus)',
    description: 'Apply bonus for reaching volume/output thresholds',
    type: COMPENSATION_DECISION_TYPE,
    priority: 165,
    conditions: {
      any: [
        {
          fact: 'performance.volumeMetric',
          operator: 'greaterThanInclusive',
          value: 50, // Configurable threshold
        },
      ],
    },
    event: {
      type: 'compensation-incentive',
      params: {
        incentiveType: 'volume-goal',
        tiers: {
          50: 500000,      // Tier 1
          100: 1500000,    // Tier 2
          200: 3000000,    // Tier 3
        },
      },
    },
  },

  /**
   * Rule P160: Position Multiplier
   * 
   * Applies to: All industries (position-based rewards)
   * Multipliers:
   * - Junior: 1.0x (baseline)
   * - Senior: 1.2x
   * - Lead: 1.5x
   * - Manager: 2.0x
   * 
   * Applied to: Service + Product compensation (not session)
   */
  {
    id: 'compensation-position-multiplier',
    name: 'Position Multiplier',
    description: 'Apply position tier multiplier to compensation',
    type: COMPENSATION_DECISION_TYPE,
    priority: 160,
    conditions: {
      any: [
        {
          fact: 'employee.positionTier',
          operator: 'equal',
          value: 'senior',
        },
        {
          fact: 'employee.positionTier',
          operator: 'equal',
          value: 'lead',
        },
        {
          fact: 'employee.positionTier',
          operator: 'equal',
          value: 'manager',
        },
      ],
    },
    event: {
      type: 'compensation-adjustment',
      params: {
        adjustmentType: 'position-multiplier',
        multipliers: {
          junior: 1.0,
          senior: 1.2,
          lead: 1.5,
          manager: 2.0,
        },
      },
    },
  },

  /**
   * Rule P155: Performance Multiplier (Quality Boost)
   * 
   * Universal formula: BaseReward × performanceMultiplier
   * 
   * Industry mappings:
   * - Spa: avgRating 4.5+ → 1.1x, 4.8+ → 1.15x, 5.0 → 1.2x
   * - Manufacturing: defectRate < 1% → 1.2x, < 0.5% → 1.3x
   * - Logistics: onTimeRate > 95% → 1.15x, > 98% → 1.2x
   * - Customer Service: CSAT > 90% → 1.15x, > 95% → 1.25x
   * 
   * Performance metrics are industry-specific but multiplier logic is universal.
   */
  {
    id: 'compensation-performance-multiplier',
    name: 'Performance Multiplier (Quality Boost)',
    description: 'Apply performance-based multiplier (rating, quality, CSAT, etc.)',
    type: COMPENSATION_DECISION_TYPE,
    priority: 155,
    conditions: {
      all: [
        {
          fact: 'performance.qualityScore',
          operator: 'greaterThanInclusive',
          value: 85, // Configurable threshold
        },
      ],
    },
    event: {
      type: 'compensation-multiplier',
      params: {
        multiplierType: 'performance',
        thresholds: {
          85: 1.1,   // Good
          90: 1.15,  // Great
          95: 1.2,   // Excellent
          100: 1.25, // Perfect
        },
      },
    },
  },

  /**
   * Rule P150: Team Incentive (Leadership Bonus)
   * 
   * Universal formula: teamTotalCompensation × overrideRate
   * 
   * Industry mappings:
   * - Spa: Team lead gets 0.5% of team's total
   * - Retail: Store manager gets 1% of store total
   * - Real Estate: Broker gets 1% of agent transactions
   * - Manufacturing: Supervisor gets 0.5% of team output value
   * 
   * Override rates by position:
   * - Lead: 0.5%
   * - Manager: 1%
   * - Director: 1.5%
   */
  {
    id: 'compensation-team-incentive',
    name: 'Team Incentive (Leadership Bonus)',
    description: 'Team leader receives percentage of team total compensation/output',
    type: COMPENSATION_DECISION_TYPE,
    priority: 150,
    conditions: {
      any: [
        {
          fact: 'employee.positionTier',
          operator: 'equal',
          value: 'lead',
        },
        {
          fact: 'employee.positionTier',
          operator: 'equal',
          value: 'manager',
        },
      ],
    },
    event: {
      type: 'compensation-incentive',
      params: {
        incentiveType: 'team-bonus',
        formula: 'teamTotal × overrideRate',
        overrideRates: {
          lead: 0.005,    // 0.5%
          manager: 0.01,  // 1%
        },
      },
    },
  },

  /**
   * Rule P145: Min Floor (Qualification Threshold)
   * 
   * Universal constraint: Must meet minimum to qualify for reward.
   * 
   * Industry mappings:
   * - Spa: Must complete >= 5 sessions to receive commission
   * - Retail: Must sell >= 5M to receive sales commission
   * - Manufacturing: Must achieve >= 70% quality score
   * - Logistics: Must deliver >= 10 orders
   * 
   * This is a "floor" in the sense of eligibility, not amount.
   */
  {
    id: 'compensation-min-floor',
    name: 'Min Floor (Qualification Threshold)',
    description: 'Apply minimum threshold to qualify for compensation',
    type: COMPENSATION_DECISION_TYPE,
    priority: 145,
    conditions: {
      all: [
        {
          fact: 'tenantConfig.minActivityThreshold',
          operator: 'greaterThan',
          value: 0,
        },
      ],
    },
    event: {
      type: 'compensation-constraint',
      params: {
        constraintType: 'min-floor',
        description: 'Must meet minimum activity to qualify',
      },
    },
  },

  /**
   * Rule P140: Max Cap (Period Upper Limit)
   * 
   * Universal constraint: Prevents excessive compensation in a single period.
   * 
   * Industry mappings:
   * - Spa: Max 20M commission per month
   * - Retail: Max 15M sales commission per month
   * - Real Estate: Max 50M per quarter
   * - Manufacturing: Max 10M production bonus per month
   * 
   * Formula: FinalReward = MIN(CalculatedReward, CapAmount)
   */
  {
    id: 'compensation-max-cap',
    name: 'Max Cap (Period Upper Limit)',
    description: 'Ensure total compensation does not exceed maximum limit per period',
    type: COMPENSATION_DECISION_TYPE,
    priority: 140,
    conditions: {
      all: [
        {
          fact: 'tenantConfig.maxCompensationPerPeriod',
          operator: 'greaterThan',
          value: 0,
        },
      ],
    },
    event: {
      type: 'compensation-constraint',
      params: {
        constraintType: 'max-cap',
        description: 'Apply maximum compensation cap',
      },
    },
  },

  /**
   * Rule P135: Item Cap (Transaction Upper Limit)
   * 
   * Universal constraint: Limits compensation per individual transaction/activity.
   * 
   * Industry mappings:
   * - Spa: Max 500k commission per session
   * - Retail: Max 1M commission per sale
   * - Real Estate: Max 10M commission per deal
   * - Manufacturing: Max 200k bonus per batch
   * 
   * Prevents outlier transactions from skewing compensation.
   * Formula: itemReward = MIN(CalculatedReward, ItemCap)
   */
  {
    id: 'compensation-item-cap',
    name: 'Item Cap (Transaction Upper Limit)',
    description: 'Cap compensation per individual transaction/activity',
    type: COMPENSATION_DECISION_TYPE,
    priority: 135,
    conditions: {
      all: [
        {
          fact: 'tenantConfig.maxRewardPerItem',
          operator: 'greaterThan',
          value: 0,
        },
      ],
    },
    event: {
      type: 'compensation-constraint',
      params: {
        constraintType: 'item-cap',
        description: 'Cap per-item compensation to prevent outliers',
      },
    },
  },
];

/**
 * Rule Metadata
 */
export const compensationRuleMetadata = {
  decisionType: COMPENSATION_DECISION_TYPE,
  totalRules: compensationRules.length,
  priorityRange: { min: 135, max: 180 },
  categories: {
    reward: [
      'compensation-activity-reward',
      'compensation-value-reward',
      'compensation-sales-reward',
    ],
    multiplier: [
      'compensation-position-multiplier',
      'compensation-performance-multiplier',
    ],
    incentive: [
      'compensation-volume-incentive',
      'compensation-team-incentive',
    ],
    constraint: [
      'compensation-min-floor',
      'compensation-max-cap',
      'compensation-item-cap',
    ],
  },
  abstractModel: {
    reward: 'What you get for activities (activityCount × rate)',
    multiplier: 'Performance boost (baseReward × multiplier)',
    incentive: 'Goal-based bonuses (IF threshold THEN bonus)',
    penalty: 'Reductions (baseReward - penalty)',
    cap: 'Upper limits (MIN(calculated, cap))',
    floor: 'Lower limits / thresholds (MAX(calculated, floor) OR mustMeet)',
  },
  industries: [
    'Spa & Beauty (sessions, services, products)',
    'Retail (sales, margins)',
    'Real Estate (deals, listings)',
    'Manufacturing (production, quality)',
    'Logistics (deliveries, on-time rate)',
    'Healthcare (procedures, patient volume)',
    'Consulting (projects, hours)',
  ],
  description:
    'Universal compensation model: Reward + Multiplier + Incentive - Penalty, with Caps & Floors. Industry-agnostic design.',
};
