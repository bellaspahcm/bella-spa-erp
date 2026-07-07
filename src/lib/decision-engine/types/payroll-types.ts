/**
 * Payroll Domain Types
 * 
 * These types define the outputs from payroll providers.
 * 
 * Design Philosophy:
 * - Providers return SalaryComponent (for earnings) or SalaryDeduction (for reductions)
 * - Each result includes amount + reason + metadata for audit trail
 * - Aggregator combines components into SalaryBreakdown
 * - PolicyMapping enables policy-based rules (one rule, multiple thresholds)
 */

import type { DecisionResult } from '../types';

/**
 * Salary Component Type
 * 
 * Defines different types of salary earnings.
 */
export type SalaryComponentType =
  | 'base-salary'
  | 'session-commission'
  | 'service-commission'
  | 'product-commission'
  | 'position-bonus'
  | 'seniority-bonus'
  | 'rating-bonus'
  | 'kpi-bonus'
  | 'performance-bonus'
  | 'referral-bonus'
  | 'manual-bonus'
  | 'overtime'
  | 'shift-differential'
  | 'attendance-deduction'
  | 'other';

/**
 * Salary Deduction Type
 * 
 * Defines different types of salary reductions.
 */
export type SalaryDeductionType =
  | 'late-penalty'
  | 'absent-penalty'
  | 'half-day-deduction'
  | 'violation-deduction'
  | 'advance-deduction'
  | 'loan-repayment'
  | 'insurance'
  | 'tax'
  | 'equipment-cost'
  | 'training-recovery'
  | 'manual-deduction'
  | 'other';

/**
 * Salary Component Result
 * 
 * Output from a payroll provider that calculates earnings.
 * 
 * @example
 * {
 *   type: 'base-salary',
 *   eligible: true,
 *   amount: 6500000,
 *   reason: 'Pro-rata: 20/26 days × 8,000,000đ',
 *   metadata: {
 *     fullMonthSalary: 8000000,
 *     workingDays: 20,
 *     totalDays: 26
 *   },
 *   matchedRules: [...],
 *   observability: {...}
 * }
 */
export interface SalaryComponent {
  /** Component type */
  type: SalaryComponentType;
  
  /** Whether the employee is eligible for this component */
  eligible: boolean;
  
  /** Calculated amount (0 if not eligible) */
  amount: number;
  
  /** Human-readable explanation of calculation */
  reason: string;
  
  /** Detailed breakdown (for multi-part components like commission) */
  breakdown?: Record<string, number>;
  
  /** Additional metadata for audit/debugging */
  metadata?: Record<string, any>;
  
  /** Rules that matched (from DecisionResult) */
  matchedRules?: DecisionResult['matchedRules'];
  
  /** Additional observability/debugging data */
  observability?: Record<string, any>;
}

/**
 * Salary Deduction Result
 * 
 * Output from a payroll provider that calculates reductions.
 * 
 * @example
 * {
 *   type: 'late-penalty',
 *   amount: 100000,
 *   reason: '2 late days × 50,000đ/day',
 *   metadata: {
 *     lateDays: 2,
 *     penaltyPerDay: 50000
 *   },
 *   matchedRules: [...],
 *   observability: {...}
 * }
 */
export interface SalaryDeduction {
  /** Deduction type */
  type: SalaryDeductionType;
  
  /** Deduction amount (always positive, will be subtracted) */
  amount: number;
  
  /** Human-readable explanation of calculation */
  reason: string;
  
  /** Detailed breakdown (for multi-part deductions) */
  breakdown?: Record<string, number>;
  
  /** Additional metadata for audit/debugging */
  metadata?: Record<string, any>;
  
  /** Rules that matched (from DecisionResult) */
  matchedRules?: DecisionResult['matchedRules'];
  
  /** Additional observability/debugging data */
  observability?: Record<string, any>;
}

/**
 * Salary Breakdown
 * 
 * Final aggregated result from PayrollAggregator.
 * Contains all components, deductions, and total salary.
 * 
 * @example
 * {
 *   totalSalary: 8700000,
 *   components: [
 *     { type: 'base-salary', amount: 6500000, ... },
 *     { type: 'session-commission', amount: 1500000, ... },
 *     { type: 'kpi-bonus', amount: 1000000, ... }
 *   ],
 *   deductions: [
 *     { type: 'late-penalty', amount: 100000, ... },
 *     { type: 'advance-deduction', amount: 200000, ... }
 *   ],
 *   summary: {
 *     totalComponents: 9000000,
 *     totalDeductions: 300000
 *   }
 * }
 */
export interface SalaryBreakdown {
  /** Final total salary (components - deductions) */
  totalSalary: number;
  
  /** All salary components (earnings) */
  components: SalaryComponent[];
  
  /** All salary deductions (reductions) */
  deductions: SalaryDeduction[];
  
  /** Summary totals */
  summary: {
    /** Sum of all component amounts */
    totalComponents: number;
    
    /** Sum of all deduction amounts */
    totalDeductions: number;
  };
  
  /** Calculation metadata */
  metadata?: {
    /** Month/Year calculated */
    monthYear: string;
    
    /** Employee ID */
    employeeId: string;
    
    /** Calculation timestamp */
    calculatedAt: string;
    
    /** Whether any overrides were applied */
    hasOverrides?: boolean;
    
    /** Status of salary record (draft, published, finalized, etc.) */
    status?: string;
  };
}

/**
 * Policy Mapping
 * 
 * Enables policy-based rules where one rule handles multiple thresholds.
 * 
 * @example Rating Bonus Policy
 * {
 *   policyType: 'tiered',
 *   tiers: [
 *     { threshold: 5.0, value: 50000 },
 *     { threshold: 4.5, value: 30000 },
 *     { threshold: 4.0, value: 10000 }
 *   ],
 *   factPath: 'sessions.avgRating',
 *   matchStrategy: 'highest-below-or-equal'
 * }
 * 
 * @example Seniority Bonus Policy
 * {
 *   policyType: 'range',
 *   ranges: [
 *     { min: 0, max: 1, rate: 0.00 },
 *     { min: 1, max: 3, rate: 0.05 },
 *     { min: 3, max: 5, rate: 0.10 },
 *     { min: 5, max: Infinity, rate: 0.15 }
 *   ],
 *   factPath: 'employee.yearsOfService',
 *   matchStrategy: 'range-inclusive'
 * }
 */
export interface PolicyMapping {
  /** Policy type */
  policyType: 'tiered' | 'range' | 'exact' | 'progressive';
  
  /** Tiered mapping (for rating bonus, commission tiers, etc.) */
  tiers?: Array<{
    threshold: number;
    value: number;
    label?: string;
  }>;
  
  /** Range mapping (for seniority, sales volume, etc.) */
  ranges?: Array<{
    min: number;
    max: number;
    rate?: number;
    value?: number;
    label?: string;
  }>;
  
  /** Exact mapping (for position tiers, contract types, etc.) */
  exact?: Record<string, number>;
  
  /** Progressive mapping (for late penalties: 1st=30k, 2nd=50k, 3rd+=100k) */
  progressive?: Array<{
    occurrenceNumber: number;
    value: number;
  }>;
  
  /** Fact path to evaluate (e.g., 'sessions.avgRating', 'employee.yearsOfService') */
  factPath: string;
  
  /** How to match the fact against the policy */
  matchStrategy:
    | 'highest-below-or-equal' // For tiered (e.g., rating 4.7 matches 4.5 tier)
    | 'range-inclusive'        // For ranges (e.g., 3.2 years matches 3-5 range)
    | 'exact'                  // For exact matches (e.g., positionTier = 'senior')
    | 'occurrence-based';      // For progressive (e.g., 3rd late = 100k)
}

/**
 * Provider Evaluation Options
 * 
 * Optional configuration for provider evaluation.
 */
export interface ProviderEvaluationOptions {
  /** Whether to include full observability data (can be verbose) */
  includeObservability?: boolean;
  
  /** Whether to include matched rules (for debugging) */
  includeMatchedRules?: boolean;
  
  /** Whether to apply overrides from context */
  applyOverrides?: boolean;
  
  /** Custom rule execution timeout (ms) */
  timeout?: number;
}

/**
 * Payroll Provider Interface
 * 
 * All payroll providers must implement this interface.
 * 
 * @example BaseSalaryProvider
 * class BaseSalaryProvider implements PayrollProvider<SalaryComponent> {
 *   async evaluate(ctx: PayrollDecisionContext): Promise<SalaryComponent> {
 *     // Evaluate base salary rules
 *     const result = await this.ruleProvider.evaluate('base-salary-eligibility', ctx);
 *     return {
 *       type: 'base-salary',
 *       eligible: result.decision === 'approve',
 *       amount: result.outputs.amount || 0,
 *       reason: result.outputs.reason || '',
 *       matchedRules: result.matchedRules,
 *       observability: result.observability
 *     };
 *   }
 * }
 */
export interface PayrollProvider<T = SalaryComponent | SalaryDeduction> {
  /**
   * Evaluate the provider for the given context
   * 
   * @param context - Payroll decision context
   * @param options - Optional evaluation options
   * @returns Component or deduction result
   */
  evaluate(
    context: any, // Using any here to allow flexibility, will be PayrollDecisionContext in practice
    options?: ProviderEvaluationOptions
  ): Promise<T>;
  
  /**
   * Provider name (for logging/debugging)
   */
  readonly name: string;
  
  /**
   * Decision type this provider handles
   */
  readonly decisionType: string;
}

/**
 * Utility Functions
 */

/**
 * Create a SalaryComponent with defaults
 */
export function createSalaryComponent(
  type: SalaryComponentType,
  data: Partial<SalaryComponent>
): SalaryComponent {
  return {
    type,
    eligible: data.eligible ?? false,
    amount: data.amount ?? 0,
    reason: data.reason ?? 'No calculation performed',
    breakdown: data.breakdown,
    metadata: data.metadata,
    matchedRules: data.matchedRules,
    observability: data.observability,
  };
}

/**
 * Create a SalaryDeduction with defaults
 */
export function createSalaryDeduction(
  type: SalaryDeductionType,
  data: Partial<SalaryDeduction>
): SalaryDeduction {
  return {
    type,
    amount: data.amount ?? 0,
    reason: data.reason ?? 'No calculation performed',
    breakdown: data.breakdown,
    metadata: data.metadata,
    matchedRules: data.matchedRules,
    observability: data.observability,
  };
}

/**
 * Create a SalaryBreakdown from components and deductions
 */
export function createSalaryBreakdown(
  components: SalaryComponent[],
  deductions: SalaryDeduction[],
  metadata?: SalaryBreakdown['metadata']
): SalaryBreakdown {
  const totalComponents = components.reduce((sum, c) => sum + c.amount, 0);
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const totalSalary = Math.max(0, totalComponents - totalDeductions);
  
  return {
    totalSalary,
    components,
    deductions,
    summary: {
      totalComponents,
      totalDeductions,
    },
    metadata,
  };
}
