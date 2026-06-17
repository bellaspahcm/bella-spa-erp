/**
 * Core Payroll Service Types
 * 
 * Generic payroll types that work across multiple industries.
 * Industry-specific fields belong in module metadata.
 * 
 * @module core/services/payroll/types
 */

/**
 * Payroll period status progression.
 * Applies to all industries.
 */
export type PayrollStatus = 
  | 'draft'              // Initial state, can be modified
  | 'pending_approval'   // Submitted for review
  | 'published'          // Approved and visible to employees
  | 'confirmed'          // Employee acknowledged
  | 'finalized';         // Locked, no further changes

/**
 * Adjustment types for manual payroll corrections.
 * Generic across all industries.
 */
export type AdjustmentType = 
  | 'bonus'              // One-time bonus
  | 'deduction'          // Disciplinary or other deduction
  | 'correction'         // Accounting correction
  | 'advance';           // Advance payment

/**
 * Payroll calculation status.
 * Used for async payroll processing.
 */
export type CalculationStatus = 
  | 'pending'            // Calculation queued
  | 'processing'         // Currently calculating
  | 'completed'          // Successfully calculated
  | 'failed';            // Calculation error

/**
 * Generic employee compensation component.
 * Used to break down salary into line items.
 */
export interface CompensationComponent {
  /** Component identifier (e.g., 'base_salary', 'overtime', 'commission') */
  code: string;
  
  /** Human-readable label */
  label: string;
  
  /** Amount in base currency */
  amount: number;
  
  /** Whether this component is taxable */
  isTaxable: boolean;
  
  /** Additional component metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Generic payroll summary for reporting.
 * Aggregates payroll data across employees.
 */
export interface PayrollSummary {
  /** Total employees in payroll */
  totalEmployees: number;
  
  /** Total base salary across all employees */
  totalBaseSalary: number;
  
  /** Total calculated salary (after adjustments) */
  totalPayroll: number;
  
  /** Total adjustments (sum of all bonuses/deductions) */
  totalAdjustments: number;
  
  /** Breakdown by component */
  componentBreakdown: Record<string, number>;
  
  /** Period identifier (YYYY-MM) */
  period: string;
}

/**
 * Payroll calculation context.
 * Input for payroll calculation engines.
 */
export interface PayrollCalculationContext {
  /** Employee identifier */
  employeeId: string;
  
  /** Payroll period (YYYY-MM) */
  period: string;
  
  /** Base salary amount */
  baseSalary: number;
  
  /** Working days in period */
  workingDays: number;
  
  /** Total days in period */
  totalDays: number;
  
  /** Manual adjustments to apply */
  adjustments?: CompensationComponent[];
  
  /** Industry-specific calculation inputs */
  metadata?: Record<string, unknown>;
}

/**
 * Payroll report filter options.
 * Used for querying payroll records.
 */
export interface PayrollReportFilter {
  /** Filter by period (YYYY-MM) */
  period?: string;
  
  /** Filter by employee IDs */
  employeeIds?: string[];
  
  /** Filter by status */
  status?: PayrollStatus[];
  
  /** Filter by minimum salary */
  minSalary?: number;
  
  /** Filter by maximum salary */
  maxSalary?: number;
  
  /** Department filter (if applicable) */
  department?: string;
}

/**
 * Payroll export format options.
 */
export type PayrollExportFormat = 'excel' | 'pdf' | 'csv' | 'json';

/**
 * Payroll cycle configuration.
 * Defines when and how payroll runs.
 */
export interface PayrollCycleConfig {
  /** Cycle frequency ('monthly', 'bi-weekly', 'weekly') */
  frequency: 'monthly' | 'bi-weekly' | 'weekly';
  
  /** Day of month to run payroll (for monthly cycles) */
  payDay?: number;
  
  /** Whether to auto-lock after finalization */
  autoLock: boolean;
  
  /** Grace period for corrections (days) */
  gracePeriodDays: number;
}

/**
 * Employee payroll history entry.
 * Audit trail for payroll changes.
 */
export interface PayrollHistoryEntry {
  /** Unique identifier */
  id: string;
  
  /** Employee identifier */
  employeeId: string;
  
  /** Period (YYYY-MM) */
  period: string;
  
  /** Change type */
  changeType: 'created' | 'updated' | 'status_changed' | 'adjustment_applied';
  
  /** Previous value (JSON) */
  previousValue?: Record<string, unknown>;
  
  /** New value (JSON) */
  newValue: Record<string, unknown>;
  
  /** Who made the change */
  changedBy: string;
  
  /** When change occurred */
  changedAt: string;
  
  /** Change reason */
  reason?: string;
}
