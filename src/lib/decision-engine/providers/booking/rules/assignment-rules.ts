/**
 * Auto-Assignment Rules
 * 
 * Defines KTV assignment logic based on:
 * - Skill matching
 * - Availability
 * - Workload balancing
 * - Performance scoring
 * - Customer preference
 * - Specialization matching
 * - Seniority rules (VIP customers)
 * 
 * Priority Range: 100-170
 * 
 * @module decision-engine/providers/booking/rules
 */

import type { Rule } from '@/lib/decision-engine/types';

/**
 * Customer Preference Override Rule
 * Priority: 100 (HIGHEST - Override all other rules)
 * 
 * Conditions:
 * - Customer has preferred KTV
 * - Preferred KTV is available
 * - Preferred KTV has required skills
 * 
 * Actions:
 * - Assign to preferred KTV (skip other checks)
 * 
 * Rationale:
 * - Customer satisfaction is paramount
 * - Repeat customer loyalty
 * - Reduces refusal rate
 */
export const customerPreferenceRule: Rule = {
  id: 'booking-assignment-customer-preference',
  name: 'Customer Preference Override',
  description: 'Assign booking to customer\'s preferred KTV if available and qualified',
  priority: 100,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'customer.preferredKtvId',
        operator: 'exists',
        value: true,
      },
      {
        type: 'simple',
        field: 'preferredKtv.availability.isAvailable',
        operator: 'equals',
        value: true,
      },
      {
        type: 'simple',
        field: 'preferredKtv.hasRequiredSkills',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      assignmentStrategy: 'customer-preference',
      priority: 'high',
    },
  },
  metadata: {
    category: 'assignment',
    strategy: 'customer-preference',
    overrides: ['workload', 'performance'],
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * VIP Customer Seniority Rule
 * Priority: 110
 * 
 * Conditions:
 * - Customer tier = VIP
 * - Senior KTV available (yearsOfService >= 3)
 * - Senior KTV has required skills
 * 
 * Actions:
 * - Prefer senior KTVs for VIP customers
 * - Higher score bonus for senior KTVs
 */
export const vipSeniorityRule: Rule = {
  id: 'booking-assignment-vip-seniority',
  name: 'VIP Customer Seniority Matching',
  description: 'Assign senior KTVs to VIP customers for premium experience',
  priority: 110,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'customer.tier',
        operator: 'equals',
        value: 'vip',
      },
      {
        type: 'simple',
        field: 'candidate.yearsOfService',
        operator: 'greaterThanOrEqual',
        value: 3,
      },
      {
        type: 'simple',
        field: 'candidate.hasRequiredSkills',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      assignmentStrategy: 'vip-seniority',
      scoreBonus: 15,
    },
  },
  metadata: {
    category: 'assignment',
    strategy: 'vip-seniority',
    seniorityThreshold: 3,
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Skill Matching Rule
 * Priority: 120
 * 
 * Conditions:
 * - KTV has all required skills
 * - Service type matches KTV skills
 * 
 * Actions:
 * - Approve if skills match
 * - Score based on skill match percentage
 */
export const skillMatchingRule: Rule = {
  id: 'booking-assignment-skill-matching',
  name: 'Skill Matching',
  description: 'KTV must have required skills for the requested service',
  priority: 120,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'candidate.hasRequiredSkills',
        operator: 'equals',
        value: true,
      },
      {
        type: 'simple',
        field: 'candidate.skillMatchPercentage',
        operator: 'greaterThanOrEqual',
        value: 100, // Must have 100% skill match
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      assignmentStrategy: 'skill-matching',
      scoreWeight: 25, // 25 points for skill match
    },
  },
  metadata: {
    category: 'assignment',
    strategy: 'skill-matching',
    required: true,
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Availability Check Rule
 * Priority: 130
 * 
 * Conditions:
 * - KTV available at requested time
 * - No overlapping bookings
 * - Not exceeding daily booking limit
 * 
 * Actions:
 * - Approve if available
 * - Reject if unavailable
 */
export const availabilityCheckRule: Rule = {
  id: 'booking-assignment-availability',
  name: 'Availability Check',
  description: 'KTV must be available at requested time slot',
  priority: 130,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'candidate.availability.isAvailable',
        operator: 'equals',
        value: true,
      },
      {
        type: 'simple',
        field: 'candidate.hasOverlappingBooking',
        operator: 'equals',
        value: false,
      },
      {
        type: 'simple',
        field: 'candidate.belowDailyLimit',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      assignmentStrategy: 'availability',
      scoreWeight: 20, // 20 points for availability
    },
  },
  metadata: {
    category: 'assignment',
    strategy: 'availability',
    required: true,
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Workload Balancing Rule
 * Priority: 140
 * 
 * Conditions:
 * - KTV has lower workload than average
 * - Or workload difference < threshold
 * 
 * Actions:
 * - Prefer KTVs with lower workload
 * - Score inversely proportional to workload
 */
export const workloadBalancingRule: Rule = {
  id: 'booking-assignment-workload-balancing',
  name: 'Workload Balancing',
  description: 'Distribute bookings evenly across KTVs to prevent burnout',
  priority: 140,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'candidate.availability.isAvailable',
        operator: 'equals',
        value: true,
      },
      {
        type: 'simple',
        field: 'candidate.workloadPercentage',
        operator: 'lessThan',
        value: 90, // Not overloaded (< 90% capacity)
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      assignmentStrategy: 'workload-balancing',
      scoreWeight: 20, // 20 points for workload balance
      scoringMethod: 'inverse-proportional', // Lower workload = higher score
    },
  },
  metadata: {
    category: 'assignment',
    strategy: 'workload-balancing',
    overloadThreshold: 90,
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Performance Scoring Rule
 * Priority: 150
 * 
 * Conditions:
 * - KTV rating above minimum (4.0+)
 * - Has customer feedback history
 * 
 * Actions:
 * - Score based on rating (4.5+ preferred)
 * - Bonus for high-rated KTVs
 */
export const performanceScoringRule: Rule = {
  id: 'booking-assignment-performance',
  name: 'Performance-Based Scoring',
  description: 'Prefer high-performing KTVs with excellent customer ratings',
  priority: 150,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'candidate.avgRating',
        operator: 'greaterThanOrEqual',
        value: 4.0,
      },
      {
        type: 'simple',
        field: 'candidate.hasRatingHistory',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      assignmentStrategy: 'performance',
      scoreWeight: 15, // 15 points for performance
      bonusThreshold: 4.5, // Bonus for 4.5+ rating
      bonusPoints: 5,
    },
  },
  metadata: {
    category: 'assignment',
    strategy: 'performance',
    minRating: 4.0,
    preferredRating: 4.5,
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Specialization Matching Rule
 * Priority: 160
 * 
 * Conditions:
 * - Service type matches KTV specialization
 * - KTV has experience in service type
 * 
 * Actions:
 * - Bonus for specialists
 * - Higher score for specialized KTVs
 */
export const specializationMatchingRule: Rule = {
  id: 'booking-assignment-specialization',
  name: 'Specialization Matching',
  description: 'Match service type to KTV specialization for better quality',
  priority: 160,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'candidate.hasMatchingSpecialization',
        operator: 'equals',
        value: true,
      },
      {
        type: 'simple',
        field: 'candidate.specializationMatchScore',
        operator: 'greaterThanOrEqual',
        value: 80, // High specialization match
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      assignmentStrategy: 'specialization',
      scoreWeight: 10, // 10 points for specialization
      scoreBonus: 5, // Extra bonus for perfect match
    },
  },
  metadata: {
    category: 'assignment',
    strategy: 'specialization',
    matchThreshold: 80,
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Low Rating Penalty Rule
 * Priority: 170
 * 
 * Conditions:
 * - KTV rating below quality threshold (< 3.5)
 * 
 * Actions:
 * - Apply score penalty
 * - Discourage low-rated KTV assignment
 */
export const lowRatingPenaltyRule: Rule = {
  id: 'booking-assignment-low-rating-penalty',
  name: 'Low Rating Penalty',
  description: 'Discourage assignment of low-rated KTVs',
  priority: 170,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'candidate.avgRating',
        operator: 'lessThan',
        value: 3.5,
      },
      {
        type: 'simple',
        field: 'candidate.hasRatingHistory',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      assignmentStrategy: 'low-rating-penalty',
      scorePenalty: -10, // -10 points for low rating
      warnOnAssignment: true,
    },
  },
  metadata: {
    category: 'assignment',
    strategy: 'penalty',
    ratingThreshold: 3.5,
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * All assignment rules (7 rules)
 * Sorted by priority (ascending)
 */
export const assignmentRules: Rule[] = [
  customerPreferenceRule,
  vipSeniorityRule,
  skillMatchingRule,
  availabilityCheckRule,
  workloadBalancingRule,
  performanceScoringRule,
  specializationMatchingRule,
  lowRatingPenaltyRule,
].sort((a, b) => a.priority - b.priority);

/**
 * Rule count summary
 */
export const assignmentRulesSummary = {
  total: assignmentRules.length,
  enabled: assignmentRules.filter(r => r.enabled).length,
  priorityRange: {
    min: Math.min(...assignmentRules.map(r => r.priority)),
    max: Math.max(...assignmentRules.map(r => r.priority)),
  },
  strategies: [
    'customer-preference',
    'vip-seniority',
    'skill-matching',
    'availability',
    'workload-balancing',
    'performance',
    'specialization',
    'penalty',
  ],
};
