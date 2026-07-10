/**
 * Capacity Management Rules
 * 
 * Defines capacity checking and overbooking prevention rules:
 * - Daily capacity limits
 * - Hourly slot availability
 * - Buffer slot management
 * - Concurrent session limits
 * - Break time enforcement
 * - Peak hour management
 * 
 * Priority Range: 200-260
 * 
 * @module decision-engine/providers/booking/rules
 */

import type { Rule } from '@/lib/decision-engine/types';

/**
 * Daily Capacity Limit Rule
 * Priority: 200 (HIGHEST - Hard limit)
 * 
 * Conditions:
 * - Current bookings >= max daily bookings
 * - Not a buffer slot request
 * 
 * Actions:
 * - Reject if daily limit exceeded
 * 
 * Rationale:
 * - Prevent KTV burnout
 * - Ensure service quality
 * - Compliance with labor laws
 */
export const dailyCapacityLimitRule: Rule = {
  id: 'capacity-daily-limit',
  name: 'Daily Capacity Limit',
  description: 'Reject booking if KTV has reached maximum daily bookings',
  priority: 200,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'ktv.currentBookings',
        operator: 'greaterThanOrEqual',
        value: 0, // Will be compared to ktv.maxDailyBookings at runtime
      },
      {
        type: 'simple',
        field: 'exceedsDailyLimit',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'reject',
    data: {
      capacityStrategy: 'daily-limit',
      reason: 'KTV has reached maximum daily bookings',
      severity: 'hard',
    },
  },
  metadata: {
    category: 'capacity',
    strategy: 'daily-limit',
    required: true,
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Time Overlap Check Rule
 * Priority: 210 (CRITICAL - Prevent double-booking)
 * 
 * Conditions:
 * - Requested time overlaps with existing booking
 * - Existing booking not cancelled
 * 
 * Actions:
 * - Reject if time overlap detected
 * 
 * Rationale:
 * - Prevent double-booking (critical)
 * - KTV can only serve one customer at a time
 */
export const timeOverlapCheckRule: Rule = {
  id: 'capacity-time-overlap',
  name: 'Time Overlap Check',
  description: 'Reject booking if time overlaps with existing booking',
  priority: 210,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'hasTimeOverlap',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'reject',
    data: {
      capacityStrategy: 'time-overlap',
      reason: 'Time slot overlaps with existing booking',
      severity: 'critical',
    },
  },
  metadata: {
    category: 'capacity',
    strategy: 'time-overlap',
    required: true,
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Concurrent Session Limit Rule
 * Priority: 220 (HIGH - Physical constraint)
 * 
 * Conditions:
 * - Number of concurrent sessions >= max concurrent limit
 * 
 * Actions:
 * - Reject if concurrent limit exceeded
 * 
 * Rationale:
 * - KTV can't be in multiple rooms simultaneously
 * - Physical impossibility
 */
export const concurrentSessionLimitRule: Rule = {
  id: 'capacity-concurrent-limit',
  name: 'Concurrent Session Limit',
  description: 'Reject if KTV already has concurrent sessions at requested time',
  priority: 220,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'exceedsConcurrentLimit',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'reject',
    data: {
      capacityStrategy: 'concurrent-limit',
      reason: 'KTV has concurrent session at requested time',
      severity: 'critical',
    },
  },
  metadata: {
    category: 'capacity',
    strategy: 'concurrent',
    required: true,
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Break Time Enforcement Rule
 * Priority: 230 (MEDIUM - Quality & compliance)
 * 
 * Conditions:
 * - Break time enforcement enabled
 * - Break time between sessions < minimum required
 * 
 * Actions:
 * - Reject if insufficient break time
 * 
 * Rationale:
 * - Ensure KTV rest periods
 * - Maintain service quality
 * - Labor law compliance
 */
export const breakTimeEnforcementRule: Rule = {
  id: 'capacity-break-time',
  name: 'Break Time Enforcement',
  description: 'Reject if insufficient break time between sessions',
  priority: 230,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'tenant.enforceBreakTimes',
        operator: 'equals',
        value: true,
      },
      {
        type: 'simple',
        field: 'hasBreakTimeViolation',
        operator: 'equals',
        value: true,
      },
    ],
  },
  action: {
    type: 'reject',
    data: {
      capacityStrategy: 'break-time',
      reason: 'Insufficient break time between sessions',
      severity: 'medium',
    },
  },
  metadata: {
    category: 'capacity',
    strategy: 'break-time',
    required: false, // Can be disabled
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Working Hours Check Rule
 * Priority: 240 (MEDIUM - Operating hours)
 * 
 * Conditions:
 * - Requested time outside working hours
 * 
 * Actions:
 * - Reject if outside working hours
 * 
 * Rationale:
 * - KTV not available outside working hours
 * - Business operating constraints
 */
export const workingHoursCheckRule: Rule = {
  id: 'capacity-working-hours',
  name: 'Working Hours Check',
  description: 'Reject if booking requested outside KTV working hours',
  priority: 240,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'isWithinWorkingHours',
        operator: 'equals',
        value: false,
      },
    ],
  },
  action: {
    type: 'reject',
    data: {
      capacityStrategy: 'working-hours',
      reason: 'Booking requested outside working hours',
      severity: 'medium',
    },
  },
  metadata: {
    category: 'capacity',
    strategy: 'working-hours',
    required: true,
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Buffer Slot Management Rule
 * Priority: 250 (LOW - Soft limit for non-VIP)
 * 
 * Conditions:
 * - Utilization >= (100 - buffer percentage)
 * - Customer not VIP
 * 
 * Actions:
 * - Reject if buffer zone and not VIP
 * 
 * Rationale:
 * - Reserve buffer slots for VIP/emergency
 * - Optimize for high-value customers
 * - Prevent 100% utilization (leave room for VIPs)
 */
export const bufferSlotManagementRule: Rule = {
  id: 'capacity-buffer-slots',
  name: 'Buffer Slot Management',
  description: 'Reserve buffer slots for VIP customers and emergencies',
  priority: 250,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'ktv.utilizationPercentage',
        operator: 'greaterThanOrEqual',
        value: 90, // Will be calculated as (100 - bufferPercentage) at runtime
      },
      {
        type: 'simple',
        field: 'customer.tier',
        operator: 'notEquals',
        value: 'vip',
      },
    ],
  },
  action: {
    type: 'reject',
    data: {
      capacityStrategy: 'buffer-slots',
      reason: 'Buffer slots reserved for VIP customers',
      severity: 'soft',
      suggestWaitlist: true,
    },
  },
  metadata: {
    category: 'capacity',
    strategy: 'buffer',
    required: false, // Can be disabled
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * Peak Hour Management Rule
 * Priority: 260 (LOWEST - Dynamic adjustment)
 * 
 * Conditions:
 * - Peak hour management enabled
 * - Current time is peak hour
 * - Utilization > peak hour limit
 * 
 * Actions:
 * - Apply stricter limits during peak hours
 * - Suggest off-peak alternatives
 * 
 * Rationale:
 * - Manage demand during peak hours
 * - Encourage off-peak bookings
 * - Optimize revenue distribution
 */
export const peakHourManagementRule: Rule = {
  id: 'capacity-peak-hours',
  name: 'Peak Hour Management',
  description: 'Apply stricter capacity limits during peak hours',
  priority: 260,
  enabled: false, // Disabled by default (optional feature)
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'tenant.enablePeakHourManagement',
        operator: 'equals',
        value: true,
      },
      {
        type: 'simple',
        field: 'ktv.isPeakHour',
        operator: 'equals',
        value: true,
      },
      {
        type: 'simple',
        field: 'ktv.utilizationPercentage',
        operator: 'greaterThan',
        value: 85, // Peak hour threshold
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      capacityStrategy: 'peak-hour',
      reason: 'Peak hour capacity limits applied',
      severity: 'soft',
      suggestOffPeak: true,
    },
  },
  metadata: {
    category: 'capacity',
    strategy: 'peak-hour',
    required: false, // Optional feature
    createdAt: '2026-07-09',
    owner: 'booking-team',
  },
};

/**
 * All capacity rules (6 rules)
 * Sorted by priority (ascending)
 */
export const capacityRules: Rule[] = [
  dailyCapacityLimitRule,
  timeOverlapCheckRule,
  concurrentSessionLimitRule,
  breakTimeEnforcementRule,
  workingHoursCheckRule,
  bufferSlotManagementRule,
  peakHourManagementRule,
].sort((a, b) => a.priority - b.priority);

/**
 * Rule count summary
 */
export const capacityRulesSummary = {
  total: capacityRules.length,
  enabled: capacityRules.filter(r => r.enabled).length,
  priorityRange: {
    min: Math.min(...capacityRules.map(r => r.priority)),
    max: Math.max(...capacityRules.map(r => r.priority)),
  },
  strategies: [
    'daily-limit',
    'time-overlap',
    'concurrent',
    'break-time',
    'working-hours',
    'buffer',
    'peak-hour',
  ],
  severity: {
    critical: ['time-overlap', 'concurrent'],
    hard: ['daily-limit'],
    medium: ['break-time', 'working-hours'],
    soft: ['buffer', 'peak-hour'],
  },
};
