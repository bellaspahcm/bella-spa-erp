/**
 * Booking Engine Rules - Central Export
 * 
 * Phase 1: Assignment Rules (7 rules)
 * Phase 2: Capacity Rules (7 rules)
 * Phase 3: Conflict Detection Rules (10 rules)
 * Phase 4: Waitlist Management Rules (10 rules)
 * 
 * Priority Ranges:
 * - Assignment: 100-170
 * - Capacity: 200-260
 * - Conflict: 300-390
 * - Waitlist: 400-500
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

// Phase 3: Conflict Detection Rules (10 rules)
export {
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
  CONFLICT_DETECTION_RULES,
  getConflictRulesByCategory,
  getBlockingConflictRules,
  getWarningConflictRules,
} from './conflict-rules';

// Phase 4: Waitlist Management Rules (10 rules)
export {
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
  waitlistRules,
  waitlistRuleCategories,
  defaultWaitlistConfig,
} from './waitlist-rules';
