/**
 * Payroll Rules - Central Export
 * 
 * Exports all payroll-related rules across 4 provider categories:
 * - KPI Rules (6 rules): Threshold, Linear, Tier strategies
 * - Attendance Rules (3 rules): Late, Absent, Combined deductions
 * - Rating Rules (3 rules): Threshold, Linear, Tier quality bonuses
 * - Commission Rules (5 rules): Fixed, Tier, Percentage, Service-Based, Gate
 * 
 * Total: 17 payroll rules (exceeds 15-20 target from roadmap)
 * 
 * Priority Ranges:
 * - KPI: 200-250
 * - Attendance: 260-280
 * - Rating: 290-310
 * - Commission: 315-350
 * 
 * @module decision-engine/providers/payroll/rules
 */

// KPI Rules (6 rules)
export {
  kpiThresholdStandardRule,
  kpiThresholdHighRule,
  kpiLinearProgressiveRule,
  kpiTierLevel1Rule,
  kpiTierLevel2Rule,
  kpiTierLevel3Rule,
  kpiRules,
} from './kpi-rules';

// Attendance Rules (3 rules)
export {
  attendanceLateDeductionRule,
  attendanceAbsentDeductionRule,
  attendanceCombinedDeductionRule,
  attendanceRules,
} from './attendance-rules';

// Rating Rules (3 rules)
export {
  ratingThresholdStandardRule,
  ratingLinearProgressiveRule,
  ratingTierQualityRule,
  ratingRules,
} from './rating-rules';

// Commission Rules (5 rules)
export {
  commissionMinimumSessionsGateRule,
  commissionFixedStandardRule,
  commissionTierProgressiveRule,
  commissionPercentageRevenueRule,
  commissionServiceBasedRule,
  commissionRules,
} from './commission-rules';

// Import all rule types
import type { Rule } from '@/lib/decision-engine/types';
import { kpiRules } from './kpi-rules';
import { attendanceRules } from './attendance-rules';
import { ratingRules } from './rating-rules';
import { commissionRules } from './commission-rules';

/**
 * All payroll rules combined (17 rules)
 * Sorted by priority (ascending)
 */
export const allPayrollRules: Rule[] = [
  ...kpiRules,
  ...attendanceRules,
  ...ratingRules,
  ...commissionRules,
].sort((a, b) => a.priority - b.priority);

/**
 * Payroll rules grouped by category
 */
export const payrollRulesByCategory = {
  kpi: kpiRules,
  attendance: attendanceRules,
  rating: ratingRules,
  commission: commissionRules,
};

/**
 * Rule count summary
 */
export const payrollRulesSummary = {
  total: allPayrollRules.length,
  byCategory: {
    kpi: kpiRules.length,
    attendance: attendanceRules.length,
    rating: ratingRules.length,
    commission: commissionRules.length,
  },
  priorityRange: {
    min: Math.min(...allPayrollRules.map(r => r.priority)),
    max: Math.max(...allPayrollRules.map(r => r.priority)),
  },
};
