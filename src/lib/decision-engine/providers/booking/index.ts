/**
 * Booking Engine Providers - Central Export
 * 
 * Phase 1: Auto-Assignment Provider (COMPLETE)
 * Phase 2: Capacity Management Provider (COMPLETE)
 * Phase 3: Conflict Detection Provider (COMPLETE)
 * Phase 4: Waitlist Management Provider (IN PROGRESS)
 * Phase 5: Dynamic Pricing Provider (TODO)
 * Phase 6: Cancellation Logic Provider (TODO)
 * 
 * @module decision-engine/providers/booking
 */

// Phase 1: Auto-Assignment Provider
export { AutoAssignmentProvider } from './auto-assignment-provider';

// Phase 2: Capacity Management Provider
export { CapacityManagementProvider } from './capacity-management-provider';

// Phase 3: Conflict Detection Provider
export { ConflictDetectionProvider } from './conflict-detection-provider';

// Phase 4: Waitlist Management Provider
export { WaitlistManagementProvider, waitlistManagementProvider } from './waitlist-management-provider';

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
  // Phase 3 types
  ConflictDetectionInput,
  ConflictDetectionOutput,
  ConflictDetail,
  ConflictResolution,
  ConflictType,
  ConflictDetectionKnowledge,
  ConflictDetectionEvaluationOptions,
  // Phase 4 types
  WaitlistManagementInput,
  WaitlistManagementOutput,
  WaitlistEntry,
  WaitlistPriorityFactors,
  WaitlistNotification,
  WaitlistSlotMatch,
  WaitlistKnowledge,
  WaitlistEvaluationOptions,
  WaitlistStatistics,
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
  // Phase 3 rules
  CONFLICT_DETECTION_RULES,
  RULE_CUSTOMER_DOUBLE_BOOKING,
  RULE_CUSTOMER_CLOSE_BOOKINGS,
  RULE_ROOM_CONFLICT,
  RULE_ROOM_TURNOVER,
  RULE_EQUIPMENT_CONFLICT,
  RULE_EQUIPMENT_MAINTENANCE,
  RULE_PACKAGE_SEQUENCE,
  RULE_PACKAGE_MIN_INTERVAL,
  RULE_VIP_SLOT_PROTECTION,
  RULE_PRIME_TIME_VIP_PRIORITY,
  getConflictRulesByCategory,
  getBlockingConflictRules,
  getWarningConflictRules,
  // Phase 4 rules
  waitlistRules,
  waitlistRuleCategories,
  defaultWaitlistConfig,
  calculatePriorityScore,
  vipFastTrack,
  autoNotifyOnSlotAvailable,
  expireOldEntries,
  reserveSlotOnNotification,
  enforceWaitlistCapacity,
  preferredTimeMatchBonus,
  highValueBookingPriority,
  notifyBeforeExpiry,
  positionUpdateNotification,
} from './rules';

