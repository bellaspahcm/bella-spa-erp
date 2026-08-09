/**
 * Payroll Provider Types
 * 
 * Type definitions for Payroll Provider integration with Decision Engine.
 * Covers all 4 salary component providers: KPI, Attendance, Rating, Commission.
 * 
 * @module decision-engine/providers/payroll
 */

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
    kpi?: {
      enabled: boolean;
      strategy: 'threshold' | 'linear' | 'tier';
      params: Record<string, unknown>;
    };
    attendance?: {
      enabled: boolean;
      strategy: 'late_deduction' | 'absent_deduction' | 'combined';
      params: Record<string, unknown>;
    };
    rating?: {
      enabled: boolean;
      strategy: 'threshold' | 'linear' | 'tier';
      params: Record<string, unknown>;
    };
    commission?: {
      enabled: boolean;
      strategy: 'fixed' | 'tier' | 'percentage' | 'service';
      params: Record<string, unknown>;
    };
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
