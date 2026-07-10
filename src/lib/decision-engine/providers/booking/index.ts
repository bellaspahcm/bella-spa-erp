/**
 * Booking Engine Providers - Central Export
 * 
 * Phase 1: Auto-Assignment Provider (COMPLETE)
 * Phase 2: Capacity Management Provider (COMPLETE)
 * Phase 3: Conflict Detection Provider (TODO)
 * Phase 4: Waitlist Management Provider (TODO)
 * Phase 5: Dynamic Pricing Provider (TODO)
 * Phase 6: Cancellation Logic Provider (TODO)
 * 
 * @module decision-engine/providers/booking
 */

// Phase 1: Auto-Assignment Provider
export { AutoAssignmentProvider } from './auto-assignment-provider';

// Phase 2: Capacity Management Provider
export { CapacityManagementProvider } from './capacity-management-provider';

// Types
export type {
  // Phase 1 types
  AutoAssignmentInput,
  AutoAssignmentOutput,
  KtvCandidate,
  AssignmentScoreBreakdown,
  AutoAssignmentKnowledge,
  AssignmentEvaluationOptions,
  // Phase 2 types
  CapacityCheckInput,
  CapacityCheckOutput,
  CapacitySnapshot,
  CapacityKnowledge,
  CapacityEvaluationOptions,
} from './types';

// Rules
export {
  // Phase 1 rules
  assignmentRules,
  assignmentRulesSummary,
  customerPreferenceRule,
  vipSeniorityRule,
  skillMatchingRule,
  availabilityCheckRule,
  workloadBalancingRule,
  performanceScoringRule,
  specializationMatchingRule,
  lowRatingPenaltyRule,
  // Phase 2 rules
  capacityRules,
  capacityRulesSummary,
  dailyCapacityLimitRule,
  timeOverlapCheckRule,
  concurrentSessionLimitRule,
  breakTimeEnforcementRule,
  workingHoursCheckRule,
  bufferSlotManagementRule,
  peakHourManagementRule,
} from './rules';
