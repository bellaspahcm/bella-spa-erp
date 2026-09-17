/**
 * Payroll Provider Types
 * 
 * Type definitions for Payroll Provider integration with Decision Engine.
 * Covers all 4 salary component providers: KPI, Attendance, Rating, Commission.
 * 
 * @module decision-engine/providers/payroll
 */

// ============================================================================
// Typed Configuration Parameters (Strategy-Specific)
// ============================================================================

/**
 * KPI Strategy Parameters
 */
export interface KPIThresholdParams {
  target: number;
  bonus: number;
}

export interface KPILinearParams {
  baseline: number;
  bonusPerSession: number;
}

export interface KPITierParams {
  tiers: Array<{
    min: number;
    max: number;
    bonus: number;
  }>;
}

/**
 * Attendance Strategy Parameters
 */
export interface AttendanceLateDeductionParams {
  latePenalty: number;
  absentPenalty?: number; // Optional for late_deduction only
}

export interface AttendanceAbsentDeductionParams {
  absentPenalty: number;
  latePenalty?: number; // Optional for absent_deduction only
}

export interface AttendanceCombinedParams {
  latePenalty: number;
  absentPenalty: number;
}

/**
 * Rating Strategy Parameters
 */
export interface RatingThresholdParams {
  minRating: number;
  bonus: number;
}

export interface RatingLinearParams {
  baseline: number;
  bonusPerPoint: number;
  cap?: number; // Optional max bonus
}

export interface RatingTierParams {
  tiers: Array<{
    min: number;
    max: number;
    bonus: number;
  }>;
}

/**
 * Commission Strategy Parameters
 */
export interface CommissionFixedParams {
  rate: number;
  minSessions?: number; // Optional gate threshold
}

export interface CommissionTierParams {
  tiers: Array<{
    min: number;
    max: number;
    rate: number;
  }>;
}

export interface CommissionPercentageParams {
  percentage: number;
}

export interface CommissionServiceParams {
  serviceRates: Record<string, number>; // { 'Massage': 120000, 'Facial': 150000 }
}

// ============================================================================
// Typed Config Unions (Discriminated by Strategy)
// ============================================================================

export type KPIConfig =
  | { enabled: boolean; strategy: 'threshold'; params: KPIThresholdParams }
  | { enabled: boolean; strategy: 'linear'; params: KPILinearParams }
  | { enabled: boolean; strategy: 'tier'; params: KPITierParams };

export type AttendanceConfig =
  | { enabled: boolean; strategy: 'late_deduction'; params: AttendanceLateDeductionParams }
  | { enabled: boolean; strategy: 'absent_deduction'; params: AttendanceAbsentDeductionParams }
  | { enabled: boolean; strategy: 'combined'; params: AttendanceCombinedParams };

export type RatingConfig =
  | { enabled: boolean; strategy: 'threshold'; params: RatingThresholdParams }
  | { enabled: boolean; strategy: 'linear'; params: RatingLinearParams }
  | { enabled: boolean; strategy: 'tier'; params: RatingTierParams };

export type CommissionConfig =
  | { enabled: boolean; strategy: 'fixed'; params: CommissionFixedParams }
  | { enabled: boolean; strategy: 'tier'; params: CommissionTierParams }
  | { enabled: boolean; strategy: 'percentage'; params: CommissionPercentageParams }
  | { enabled: boolean; strategy: 'service'; params: CommissionServiceParams };

// ============================================================================
// Payroll Decision Input
// ============================================================================

/**
 * Payroll decision input (Knowledge)
 * 
 * Context required to evaluate payroll decisions across all providers.
 */
export interface PayrollDecisionInput {
  /** Tenant identifier */
  tenantId: string;

  /** Employee identifier */
  employeeId: string;

  /** Month-year for calculation (YYYY-MM format) */
  monthYear: string;

  /** Sessions data */
  sessions: {
    /** Total completed sessions count (with package multipliers) */
    count: number;
    /** Average rating (0-5 stars) */
    avgRating: number;
    /** Total service revenue */
    totalRevenue: number;
    /** Service breakdown by type (for commission calculation) */
    serviceTypes?: Record<string, number>; // { 'Massage': 10, 'Facial': 5 }
  };

  /** Attendance data */
  attendance: {
    /** Late arrivals count (after grace period) */
    lateDays: number;
    /** Unexcused absences count */
    absentDays: number;
    /** Actual working days (for pro-rata calculation) */
    workingDays: number;
  };

  /** Employee info */
  employee: {
    /** Base salary (monthly) */
    baseSalary: number;
    /** Position/role (for position bonus) */
    position?: string;
    /** Years of service (for seniority bonus) */
    yearsOfService?: number;
  };

  /** Provider configurations (from tenant config) */
  config?: {
    kpi?: KPIConfig;
    attendance?: AttendanceConfig;
    rating?: RatingConfig;
    commission?: CommissionConfig;
  };

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Payroll decision output (DecisionResult)
 * 
 * Aggregated salary components from all providers.
 */
export interface PayrollDecisionOutput {
  /** Is eligible for any bonuses */
  eligible: boolean;

  /** Total bonuses (KPI + Rating + Commission) */
  totalBonuses: number;

  /** Total deductions (Attendance violations) */
  totalDeductions: number;

  /** Net adjustment (bonuses - deductions) */
  netAdjustment: number;

  /** Component breakdown */
  components: {
    kpiBonus: SalaryComponent;
    attendanceDeduction: SalaryComponent;
    ratingBonus: SalaryComponent;
    sessionCommission: SalaryComponent;
  };

  /** Matched rules (across all providers) */
  matchedRules: string[];

  /** Execution time (ms) */
  executionTime: number;

  /** Provider identifier */
  provider: 'PayrollProvider';

  /** Confidence score (0-1) */
  confidence: number;

  /** Explanation/reason */
  reason: string;
}

/**
 * Salary component (individual calculation result)
 */
export interface SalaryComponent {
  /** Component type */
  type: 'kpi-bonus' | 'attendance-deduction' | 'rating-bonus' | 'session-commission';

  /** Is eligible for this component */
  eligible: boolean;

  /** Amount (positive for bonuses, negative for deductions) */
  amount: number;

  /** Calculation reason */
  reason: string;

  /** Strategy used */
  strategy?: string;

  /** Detailed metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Payroll knowledge (enriched context for rule evaluation)
 * 
 * Used internally by provider to evaluate rules via RuleReasoner.
 */
export interface PayrollKnowledge {
  /** Tenant ID */
  tenantId: string;

  /** Employee ID */
  employeeId: string;

  /** Month-year */
  monthYear: string;

  /** Sessions count */
  'sessions.count': number;

  /** Average rating */
  'sessions.avgRating': number;

  /** Total revenue */
  'sessions.totalRevenue': number;

  /** Late days */
  'attendance.lateDays': number;

  /** Absent days */
  'attendance.absentDays': number;

  /** Working days */
  'attendance.workingDays': number;

  /** Base salary */
  'employee.baseSalary': number;

  /** KPI strategy */
  'kpi.strategy'?: string;

  /** KPI enabled */
  'kpi.enabled'?: boolean;

  /** Attendance strategy */
  'attendance.strategy'?: string;

  /** Attendance enabled */
  'attendance.enabled'?: boolean;

  /** Rating strategy */
  'rating.strategy'?: string;

  /** Rating enabled */
  'rating.enabled'?: boolean;

  /** Commission strategy */
  'commission.strategy'?: string;

  /** Commission enabled */
  'commission.enabled'?: boolean;

  /** Commission min sessions */
  'commission.minSessions'?: number;

  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Provider evaluation options
 */
export interface ProviderEvaluationOptions {
  /** Enable debug logging */
  debug?: boolean;

  /** Apply manual overrides */
  applyOverrides?: boolean;

  /** Manual overrides */
  overrides?: {
    kpiBonus?: number;
    attendanceDeduction?: number;
    ratingBonus?: number;
    sessionCommission?: number;
  };
}

/**
 * Provider category (for rule filtering)
 */
export type ProviderCategory = 'kpi' | 'attendance' | 'rating' | 'commission';

/**
 * Gate evaluation result
 */
export interface GateEvaluationResult {
  /** Did gate pass? */
  passed: boolean;

  /** Gate rejection reason (if failed) */
  reason?: string;

  /** Gate metadata */
  metadata?: Record<string, unknown>;
}
