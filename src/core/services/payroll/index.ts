/**
 * Core Payroll Services
 * 
 * Generic payroll abstractions for multi-industry platform.
 * Industry-specific logic belongs in module adapters.
 * 
 * @module core/services/payroll
 */

// ── Contracts ─────────────────────────────────────────────────────────────────
export type {
  PayrollPeriod,
  EmployeePayrollRecord,
  PayrollAdjustment,
  PayrollCalculationResult,
} from './contracts';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  PayrollStatus,
  AdjustmentType,
  CalculationStatus,
  CompensationComponent,
  PayrollSummary,
  PayrollCalculationContext,
  PayrollReportFilter,
  PayrollExportFormat,
  PayrollCycleConfig,
  PayrollHistoryEntry,
} from './types';

// ── Note ──────────────────────────────────────────────────────────────────────
// This is a skeleton for Wave 3. No service functions exist yet.
// Actual payroll calculation engines live in industry modules:
// - Spa payroll: src/modules/hr-salary/actions/salary-recalculation-engine.ts
// - Future retail payroll: src/modules/retail/services/payroll.ts
// - Future cleaning payroll: src/modules/cleaning/services/payroll.ts
