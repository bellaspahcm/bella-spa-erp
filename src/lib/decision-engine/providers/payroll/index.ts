/**
 * Payroll Provider - Central Export
 * 
 * Provider #3 for Decision Engine Platform.
 * Integrates payroll salary calculations with rule-based decision logic.
 * 
 * @module decision-engine/providers/payroll
 */

// Main provider
export { PayrollProvider } from './payroll-provider';

// Types
export type {
  PayrollDecisionInput,
  PayrollDecisionOutput,
  SalaryComponent,
  PayrollKnowledge,
  ProviderEvaluationOptions,
  ProviderCategory,
  GateEvaluationResult,
  // Typed param interfaces
  KPIThresholdParams,
  KPILinearParams,
  KPITierParams,
  AttendanceLateDeductionParams,
  AttendanceAbsentDeductionParams,
  AttendanceCombinedParams,
  RatingThresholdParams,
  RatingLinearParams,
  RatingTierParams,
  CommissionFixedParams,
  CommissionTierParams,
  CommissionPercentageParams,
  CommissionServiceParams,
  // Typed config unions
  KPIConfig,
  AttendanceConfig,
  RatingConfig,
  CommissionConfig,
} from './types';

// Rules
export {
  allPayrollRules,
  payrollRulesByCategory,
  payrollRulesSummary,
  kpiRules,
  attendanceRules,
  ratingRules,
  commissionRules,
} from './rules';
