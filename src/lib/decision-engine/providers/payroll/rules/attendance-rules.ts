/**
 * Attendance Deduction Rules
 * 
 * Defines attendance-based deductions (penalties for late arrivals and absences).
 * Supports 3 strategies:
 * - Late Deduction: Penalty for late arrivals (with grace period)
 * - Absent Deduction: Penalty for absences
 * - Combined: Both late and absent penalties
 * 
 * @module decision-engine/providers/payroll/rules
 */

import type { Rule } from '@/lib/decision-engine/types';

/**
 * Attendance Late Deduction Rule
 * Priority: 260
 * 
 * Conditions:
 * - Strategy = 'late_deduction' ONLY
 * - Late days > 0
 * 
 * Actions:
 * - Deduct penalty per late day (default: -50,000đ per day)
 * - Grace period applied (default: 15 minutes)
 * 
 * NOTE: For 'combined' strategy, use attendanceCombinedDeductionRule instead
 */
export const attendanceLateDeductionRule: Rule = {
  id: 'payroll-attendance-late',
  name: 'Attendance Late Deduction',
  description: 'Penalty for late arrivals (late_deduction strategy only)',
  priority: 260,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'attendance.strategy',
        operator: 'equals',
        value: 'late_deduction',
      },
      {
        type: 'simple',
        field: 'attendance.lateDays',
        operator: 'greaterThan',
        value: 0,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      deductionType: 'attendance-late',
      penaltyPerDay: 50000,
      gracePeriodMinutes: 15,
    },
  },
  metadata: {
    category: 'attendance',
    strategy: 'late_deduction',
    defaultPenalty: 50000,
    defaultGracePeriod: 15,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * Attendance Absent Deduction Rule
 * Priority: 270
 * 
 * Conditions:
 * - Strategy = 'absent_deduction' ONLY
 * - Absent days > 0
 * 
 * Actions:
 * - Deduct penalty per absent day (default: -200,000đ per day)
 * 
 * NOTE: For 'combined' strategy, use attendanceCombinedDeductionRule instead
 */
export const attendanceAbsentDeductionRule: Rule = {
  id: 'payroll-attendance-absent',
  name: 'Attendance Absent Deduction',
  description: 'Penalty for unexcused absences (absent_deduction strategy only)',
  priority: 270,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'attendance.strategy',
        operator: 'equals',
        value: 'absent_deduction',
      },
      {
        type: 'simple',
        field: 'attendance.absentDays',
        operator: 'greaterThan',
        value: 0,
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      deductionType: 'attendance-absent',
      penaltyPerDay: 200000,
    },
  },
  metadata: {
    category: 'attendance',
    strategy: 'absent_deduction',
    defaultPenalty: 200000,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * Attendance Combined Deduction Rule
 * Priority: 280
 * 
 * Conditions:
 * - Strategy = 'combined'
 * - Has any violations (late OR absent)
 * 
 * Actions:
 * - Calculate both late and absent penalties
 * - Apply cumulative deduction
 */
export const attendanceCombinedDeductionRule: Rule = {
  id: 'payroll-attendance-combined',
  name: 'Attendance Combined Deduction',
  description: 'Combined penalty for late arrivals and absences',
  priority: 280,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'attendance.strategy',
        operator: 'equals',
        value: 'combined',
      },
      {
        type: 'any',
        conditions: [
          {
            type: 'simple',
            field: 'attendance.lateDays',
            operator: 'greaterThan',
            value: 0,
          },
          {
            type: 'simple',
            field: 'attendance.absentDays',
            operator: 'greaterThan',
            value: 0,
          },
        ],
      },
    ],
  },
  action: {
    type: 'approve',
    data: {
      eligible: true,
      deductionType: 'attendance-combined',
      latePenaltyPerDay: 50000,
      absentPenaltyPerDay: 200000,
      gracePeriodMinutes: 15,
    },
  },
  metadata: {
    category: 'attendance',
    strategy: 'combined',
    defaultLatePenalty: 50000,
    defaultAbsentPenalty: 200000,
    defaultGracePeriod: 15,
    createdAt: '2026-07-09',
    owner: 'payroll-team',
  },
};

/**
 * All attendance rules
 */
export const attendanceRules: Rule[] = [
  attendanceLateDeductionRule,
  attendanceAbsentDeductionRule,
  attendanceCombinedDeductionRule,
];

