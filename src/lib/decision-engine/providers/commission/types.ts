/**
 * @fileoverview Type Definitions for CommissionProvider
 * 
 * Comprehensive type system for commission calculation in Decision Engine.
 * Supports flexible commission strategies, multi-tier bonuses, and manual adjustments.
 * 
 * @module decision-engine/providers/commission/types
 */

/**
 * Commission type: fixed amount or percentage
 */
export type CommissionType = 'fixed' | 'percentage';

/**
 * Commission strategy: determines how base commission is calculated
 */
export type CommissionStrategy = 'fixed' | 'percentage' | 'manual_override';

/**
 * Position tier for commission multipliers
 */
export type PositionTier = 'junior' | 'senior' | 'lead';

/**
 * Volume tier classification
 */
export type VolumeTier = 'standard' | 'high' | 'premium' | 'elite';

/**
 * Performance tier classification
 */
export type PerformanceTier = 'below_standard' | 'standard' | 'good' | 'excellent' | 'perfect';

/**
 * Service item for commission calculation
 */
export interface ServiceItem {
  /** Service subtotal amount (VND) */
  subtotal: number;
  
  /** Override commission type (takes precedence over default) */
  overrideType?: CommissionType | null;
  
  /** Override commission value (amount or percentage) */
  overrideValue?: number | null;
}

/**
 * Product sale for commission calculation
 */
export interface ProductSale {
  /** Total sales amount (VND) */
  salesAmount: number;
  
  /** Override commission type (takes precedence over default) */
  overrideType?: CommissionType | null;
  
  /** Override commission value (amount or percentage) */
  overrideValue?: number | null;

  /** Property-specific commission type */
  productCommissionType?: CommissionType | null;

  /** Property-specific commission value */
  productCommissionValue?: number | null;

  /** Project-specific commission type */
  projectCommissionType?: CommissionType | null;

  /** Project-specific commission value */
  projectCommissionValue?: number | null;
}

/**
 * Manual adjustment (bonus or deduction)
 */
export interface ManualAdjustment {
  /** Adjustment type */
  adjustment_type: 'bonus' | 'deduction';
  
  /** Adjustment amount (VND) */
  amount: number;
  
  /** Approval status (only 'approved' adjustments are applied) */
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  
  /** Adjustment reason (optional) */
  reason?: string;
  
  /** Created by (admin ID) */
  created_by?: string;
}

/**
 * Commission configuration from tenant settings
 */
export interface CommissionConfig {
  // Base commission strategy
  /** Commission calculation strategy: 'fixed' | 'percentage' | 'manual_override' */
  commissionStrategy: CommissionStrategy;
  
  // Service commission defaults
  /** Default fixed commission per service (VND) */
  serviceCommissionFixed?: number;
  
  /** Default service commission rate (percentage 0-100) */
  serviceCommissionRate?: number;
  
  // Product commission defaults
  /** Default fixed commission per product sale (VND) */
  productCommissionFixed?: number;
  
  /** Default product sales commission rate (percentage 0-100) */
  productCommissionRate?: number;
  
  // Volume tier configuration
  /** Enable volume tier multipliers */
  enableVolumeTiers?: boolean;
  
  /** Volume tier thresholds (sessions) */
  volumeTierThresholds?: {
    high: number;      // Default: 30
    premium: number;   // Default: 50
    elite: number;     // Default: 80
  };
  
  /** Volume tier multipliers */
  volumeTierMultipliers?: {
    standard: number;  // Default: 1.0
    high: number;      // Default: 1.1
    premium: number;   // Default: 1.2
    elite: number;     // Default: 1.3
  };
  
  // Performance tier configuration
  /** Enable performance multipliers */
  enablePerformanceMultipliers?: boolean;
  
  /** Performance tier thresholds (rating 0-5) */
  performanceTierThresholds?: {
    standard: number;   // Default: 4.0
    good: number;       // Default: 4.5
    excellent: number;  // Default: 4.8
    perfect: number;    // Default: 4.95
  };
  
  /** Performance tier multipliers */
  performanceTierMultipliers?: {
    belowStandard: number; // Default: 0.9
    standard: number;      // Default: 1.0
    good: number;          // Default: 1.05
    excellent: number;     // Default: 1.1
    perfect: number;       // Default: 1.15
  };
  
  // Position bonus configuration
  /** Position tier multipliers */
  positionMultipliers?: {
    junior: number;  // Default: 1.0
    senior: number;  // Default: 1.2
    lead: number;    // Default: 1.5
  };
  
  // Seniority bonus configuration
  /** Seniority bonus rates by years of service */
  seniorityBonusRates?: {
    '0_to_1_year': number;   // Default: 0.00
    '1_to_3_years': number;  // Default: 0.05
    '3_to_5_years': number;  // Default: 0.10
    '5_plus_years': number;  // Default: 0.15
  };
  
  // Gate configuration (optional, disabled by default)
  /** Enable minimum sessions gate */
  enableMinSessionsGate?: boolean;
  
  /** Minimum sessions required for commission */
  minSessionsForCommission?: number;
  
  /** Enable quality gate */
  enableQualityGate?: boolean;
  
  /** Minimum rating required for commission */
  minRatingForCommission?: number;
  
  /** Grace period for new KTVs (days) */
  gracePerDays?: number;
}

/**
 * Commission decision input
 */
export interface CommissionDecisionInput {
  /** Tenant ID */
  tenantId: string;
  
  /** Employee ID */
  employeeId: string;
  
  /** Month/year for commission calculation (YYYY-MM) */
  monthYear: string;
  
  // Service commission data
  /** Service items for commission calculation */
  serviceItems: ServiceItem[];
  
  // Product sales commission data
  /** Product sales for commission calculation */
  productSales: ProductSale[];
  
  // Performance context
  /** Total sessions completed (for volume tier) */
  totalSessions: number;
  
  /** Completed sessions (subset of total, for eligibility checks) */
  completedSessions: number;
  
  /** Average customer rating (0-5 scale) */
  avgRating: number;
  
  // Employee context
  /** Position tier (for position bonus) */
  positionTier: PositionTier;
  
  /** Hire date (for seniority bonus) */
  hireDate?: Date | string | null;
  
  /** Days since hired (for grace period checks) */
  daysSinceHired?: number;
  
  // Manual adjustments
  /** Manual bonuses/deductions (approved only) */
  manualAdjustments?: ManualAdjustment[];
  
  // Manual override (highest priority)
  /** Admin manual override amount (bypasses all rules) */
  manualOverride?: number | null;
  
  /** Reason for manual override */
  manualOverrideReason?: string;
  
  /** Admin who created manual override */
  manualOverrideBy?: string;
  
  // Configuration
  /** Tenant-specific commission configuration */
  config: CommissionConfig;
}

/**
 * Commission decision output
 */
export interface CommissionDecisionOutput {
  // Base commissions
  /** Service items commission (VND) */
  serviceCommission: number;
  
  /** Product sales commission (VND) */
  productSalesCommission: number;
  
  /** Total base commission before multipliers (VND) */
  baseCommission: number;
  
  // Multipliers
  /** Volume tier multiplier (1.0-1.3x) */
  volumeMultiplier: number;
  
  /** Performance tier multiplier (0.9-1.15x) */
  performanceMultiplier: number;
  
  /** Combined multiplier (volume × performance) */
  combinedMultiplier: number;
  
  /** Commission after multipliers (base × combined) */
  adjustedCommission: number;
  
  // Bonuses
  /** Position bonus (VND) */
  positionBonus: number;
  
  /** Seniority bonus (VND) */
  seniorityBonus: number;
  
  /** Net manual adjustments (bonuses - deductions, VND) */
  manualAdjustments: number;
  
  /** Total bonuses (position + seniority + manual) */
  totalBonuses: number;
  
  // Final total
  /** Total commission (adjusted + bonuses, VND) */
  totalCommission: number;
  
  // Tier classifications
  /** Volume tier classification */
  volumeTier: VolumeTier;
  
  /** Performance tier classification */
  performanceTier: PerformanceTier;
  
  // Metadata
  /** Matched rule IDs */
  matchedRules: string[];
  
  /** Decision confidence (0-1) */
  confidence: number;
  
  /** Applied strategies */
  appliedStrategies: {
    baseCommission: CommissionStrategy;
    volumeTier: VolumeTier;
    performanceTier: PerformanceTier;
  };
  
  /** Execution time (milliseconds) */
  executionTimeMs: number;
  
  // Gate decision (if applicable)
  /** Gate decision (reject/allow) */
  gateDecision?: 'reject' | 'allow';
  
  /** Gate rejection reason (if rejected) */
  rejectReason?: string;
  
  /** Needs management review (quality issues) */
  needsReview?: boolean;
}

/**
 * Commission calculation breakdown (for debugging/auditing)
 */
export interface CommissionBreakdown {
  // Step 1: Base Commission
  step1_baseCommission: {
    serviceItems: Array<{
      subtotal: number;
      commissionType: CommissionType;
      commissionValue: number;
      calculatedCommission: number;
    }>;
    productSales: Array<{
      salesAmount: number;
      commissionType: CommissionType;
      commissionValue: number;
      calculatedCommission: number;
    }>;
    totalServiceCommission: number;
    totalProductCommission: number;
    totalBaseCommission: number;
  };
  
  // Step 2: Volume Tier
  step2_volumeTier: {
    totalSessions: number;
    tier: VolumeTier;
    multiplier: number;
    bonusPercentage: number;
  };
  
  // Step 3: Performance Tier
  step3_performanceTier: {
    avgRating: number;
    tier: PerformanceTier;
    multiplier: number;
    adjustmentPercentage: number;
  };
  
  // Step 4: Adjusted Commission
  step4_adjustedCommission: {
    baseCommission: number;
    volumeMultiplier: number;
    performanceMultiplier: number;
    combinedMultiplier: number;
    adjustedCommission: number;
  };
  
  // Step 5: Position Bonus
  step5_positionBonus: {
    positionTier: PositionTier;
    multiplier: number;
    baseAmount: number; // adjusted commission
    bonusAmount: number;
  };
  
  // Step 6: Seniority Bonus
  step6_seniorityBonus: {
    hireDate?: string;
    yearsOfService: number;
    bonusRate: number;
    baseAmount: number; // adjusted commission
    bonusAmount: number;
  };
  
  // Step 7: Manual Adjustments
  step7_manualAdjustments: {
    adjustments: Array<{
      type: 'bonus' | 'deduction';
      amount: number;
      reason?: string;
    }>;
    netAdjustments: number;
  };
  
  // Step 8: Total Commission
  step8_totalCommission: {
    adjustedCommission: number;
    positionBonus: number;
    seniorityBonus: number;
    manualAdjustments: number;
    totalCommission: number;
  };
}

/**
 * Commission knowledge (for BI analysis)
 */
export interface CommissionKnowledge {
  /** Employee performance metrics */
  performance: {
    totalSessions: number;
    completedSessions: number;
    avgRating: number;
    volumeTier: VolumeTier;
    performanceTier: PerformanceTier;
  };
  
  /** Commission composition */
  composition: {
    serviceCommissionPercent: number;  // % of total
    productCommissionPercent: number;  // % of total
    volumeBonusPercent: number;        // % of total
    performanceBonusPercent: number;   // % of total
    positionBonusPercent: number;      // % of total
    seniorityBonusPercent: number;     // % of total
  };
  
  /** Comparison to averages */
  comparison: {
    avgCommissionForTier: number;      // Average for same position/tier
    percentileRank: number;            // 0-100 (employee's ranking)
    aboveAverage: boolean;
    delta: number;                     // Difference from average
  };
  
  /** Improvement potential */
  improvement: {
    nextVolumeTier?: VolumeTier;
    sessionsToNextTier?: number;
    potentialVolumeBonus?: number;
    
    nextPerformanceTier?: PerformanceTier;
    ratingToNextTier?: number;
    potentialPerformanceBonus?: number;
    
    totalPotentialIncrease?: number;
  };
}
