/**
 * Core Payroll Service Contracts
 * 
 * These are GENERIC payroll abstractions that work across multiple industries.
 * Industry-specific payroll logic (e.g., spa KTV commissions, session bonuses) 
 * belongs in module adapters (src/modules/spa/).
 * 
 * @module core/services/payroll/contracts
 */

/**
 * Generic payroll period (month/year for payroll cycle).
 * Used across all industries for payroll processing.
 */
export interface PayrollPeriod {
  /** Year of payroll period (e.g., 2026) */
  year: number;
  
  /** Month of payroll period (1-12) */
  month: number;
  
  /** Period status */
  status: 'draft' | 'pending_approval' | 'published' | 'confirmed' | 'finalized';
  
  /** Whether period is locked (no modifications allowed) */
  isLocked: boolean;
}

/**
 * Generic employee payroll record (industry-agnostic).
 * Contains only base fields that apply across all industries.
 */
export interface EmployeePayrollRecord {
  /** Unique identifier */
  id: string;
  
  /** Employee identifier */
  employeeId: string;
  
  /** Tenant identifier */
  tenantId: string;
  
  /** Payroll period (YYYY-MM format) */
  period: string;
  
  /** Base salary amount */
  baseSalary: number;
  
  /** Total calculated salary (after all adjustments) */
  totalSalary: number;
  
  /** Record status */
  status: 'draft' | 'pending_approval' | 'published' | 'confirmed' | 'finalized';
  
  /**
   * Industry-specific metadata (commissions, bonuses, deductions, etc.).
   * 
   * **Spa Industry Example**:
   * ```typescript
   * {
   *   totalSessions: 15.5,
   *   sessionBonus: 1550000,
   *   ratingBonus: 300000,
   *   kpiBonus: 500000,
   *   violationsDeduction: 100000,
   *   actualDays: 26
   * }
   * ```
   * 
   * **Retail Industry Example**:
   * ```typescript
   * {
   *   salesCommission: 2000000,
   *   overtimeHours: 10,
   *   overtimePay: 500000
   * }
   * ```
   */
  metadata: Record<string, unknown>;
  
  /** When record was created */
  createdAt: string;
  
  /** When record was last updated */
  updatedAt: string;
}

/**
 * Generic payroll adjustment (industry-agnostic).
 * Represents manual adjustments to payroll (bonuses, deductions, corrections).
 */
export interface PayrollAdjustment {
  /** Unique identifier */
  id: string;
  
  /** Employee identifier */
  employeeId: string;
  
  /** Adjustment type */
  type: 'bonus' | 'deduction' | 'correction' | 'advance';
  
  /** Amount (positive for additions, negative for deductions) */
  amount: number;
  
  /** Human-readable reason */
  reason: string;
  
  /** Who approved this adjustment */
  approvedBy: string;
  
  /** When adjustment was approved */
  approvedAt: string;
}

/**
 * Generic payroll calculation result.
 * Returned by payroll calculation functions across all industries.
 */
export interface PayrollCalculationResult {
  /** Success status */
  success: boolean;
  
  /** Total calculated salary */
  totalSalary: number;
  
  /** Breakdown of salary components (industry-specific) */
  breakdown: Record<string, number>;
  
  /** Error message if calculation failed */
  error?: string;
}
