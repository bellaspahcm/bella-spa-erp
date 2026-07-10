/**
 * Booking Engine Rules - Central Export
 * 
 * Phase 1: Assignment Rules (7 rules)
 * Phase 2: Capacity Rules (7 rules)
 * 
 * Priority Ranges:
 * - Assignment: 100-170
 * - Capacity: 200-260
 * 
 * @module decision-engine/providers/booking/rules
 */

// Phase 1: Assignment Rules (7 rules)
export {
  customerPreferenceRule,
  vipSeniorityRule,
  skillMatchingRule,
  availabilityCheckRule,
  workloadBalancingRule,
  performanceScoringRule,
  specializationMatchingRule,
  lowRatingPenaltyRule,
  assignmentRules,
  assignmentRulesSummary,
} from './assignment-rules';

// Phase 2: Capacity Rules (7 rules)
export {
  dailyCapacityLimitRule,
  timeOverlapCheckRule,
  concurrentSessionLimitRule,
  breakTimeEnforcementRule,
  workingHoursCheckRule,
  bufferSlotManagementRule,
  peakHourManagementRule,
  capacityRules,
  capacityRulesSummary,
} from './capacity-rules';
