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
