/**
 * Base Salary Rules
 * 
 * These rules determine how an employee's base salary is calculated.
 * Rules handle: full month, pro-rata, resignation cap, min/max constraints,
 * position-based adjustments, contract type, and probation period.
 * 
 * Priority Range: P200-P165 (highest priority in payroll)
 */

import type { Rule } from '../core/rule-provider';

/**
 * Decision Type for Base Salary Rules
 */
export const BASE_SALARY_DECISION_TYPE = 'base-salary-eligibility';

/**
 * Base Salary Rules
 * 
 * Priority ordering (highest first):
 * - P200: Full month base salary (standard case)
 * - P195: Pro-rata for partial month (based on attendance)
 * - P190: Resignation cap (pro-rate to resignation date)
 * - P185: Min base salary floor (regional minimum wage)
 * - P180: Position-based base salary (Junior/Senior/Lead)
 * - P175: Contract type adjustment (Part-time/Contract)
 * - P170: Probation period discount (e.g., 85% during probation)
 * - P165: Max base salary cap (if applicable)
 */
export const baseSalaryRules: Rule[] = [
  /**
   * Rule P200: Full Month Base Salary
   * 
   * Applies when employee worked full month (26 days standard).
   * Returns the employee's full base salary without pro-rating.
   */
  {
    id: 'base-salary-full-month',
    name: 'Full Month Base Salary',
    description: 'Employee worked full month, receive 100% base salary',
    type: BASE_SALARY_DECISION_TYPE,
    priority: 200,
    conditions: {
      all: [
        {
          fact: 'employee.baseSalary',
          operator: 'greaterThan',
          value: 0,
        },
        {
          fact: 'attendance.presentDays',
          operator: 'greaterThanInclusive',
          value: 26, // Standard working days per month
        },
        {
          fact: 'employee.resignationDate',
          operator: 'equal',
          value: null, // Not resigned
        },
      ],
    },
    event: {
      type: 'base-salary-calculated',
      params: {
        calculation: 'full-month',
        formula: 'baseSalary × 1.0',
      },
    },
  },

  /**
   * Rule P195: Pro-rata Base Salary (Partial Month)
   * 
   * Applies when employee worked less than full month.
   * Formula: (baseSalary / 26) × actualWorkingDays
   */
  {
    id: 'base-salary-pro-rata',
    name: 'Pro-rata Base Salary',
    description: 'Calculate pro-rata base salary based on actual working days',
    type: BASE_SALARY_DECISION_TYPE,
    priority: 195,
    conditions: {
      all: [
        {
          fact: 'employee.baseSalary',
          operator: 'greaterThan',
          value: 0,
        },
        {
          fact: 'attendance.presentDays',
          operator: 'lessThan',
          value: 26,
        },
        {
          fact: 'attendance.presentDays',
          operator: 'greaterThan',
          value: 0,
        },
        {
          fact: 'employee.resignationDate',
          operator: 'equal',
          value: null, // Not resigned
        },
      ],
    },
    event: {
      type: 'base-salary-calculated',
      params: {
        calculation: 'pro-rata',
        formula: '(baseSalary / 26) × presentDays',
        divisor: 26,
      },
    },
  },

  /**
   * Rule P190: Resignation Cap
   * 
   * Applies when employee resigned during the month.
   * Cap base salary at resignation date (pro-rata).
   * 
   * Note: This rule has higher priority than pro-rata to ensure
   * resignation date takes precedence over attendance-based pro-rata.
   */
  {
    id: 'base-salary-resignation-cap',
    name: 'Resignation Cap',
    description: 'Cap base salary at resignation date (pro-rata)',
    type: BASE_SALARY_DECISION_TYPE,
    priority: 190,
    conditions: {
      all: [
        {
          fact: 'employee.baseSalary',
          operator: 'greaterThan',
          value: 0,
        },
        {
          fact: 'employee.resignationDate',
          operator: 'notEqual',
          value: null,
        },
        // Additional condition: resignation date is within the calculation month
        // This will be checked in the provider service
      ],
    },
    event: {
      type: 'base-salary-calculated',
      params: {
        calculation: 'resignation-cap',
        formula: '(baseSalary / 26) × daysUntilResignation',
        divisor: 26,
      },
    },
  },

  /**
   * Rule P185: Min Base Salary Floor
   * 
   * Ensures calculated base salary never goes below regional minimum wage.
   * This acts as a safety constraint after pro-rata calculations.
   */
  {
    id: 'base-salary-min-floor',
    name: 'Min Base Salary Floor',
    description: 'Ensure base salary meets minimum wage requirement',
    type: BASE_SALARY_DECISION_TYPE,
    priority: 185,
    conditions: {
      all: [
        {
          fact: 'tenantConfig.minBaseSalary',
          operator: 'greaterThan',
          value: 0,
        },
      ],
    },
    event: {
      type: 'base-salary-constraint',
      params: {
        constraintType: 'min-floor',
        description: 'Apply minimum base salary floor',
      },
    },
  },

  /**
   * Rule P180: Position-Based Base Salary
   * 
   * Adjusts base salary based on position tier.
   * Multipliers: Junior 1.0x, Senior 1.2x, Lead 1.5x, Manager 2.0x
   * 
   * Note: This is an alternative to storing different base salaries per position.
   * If employee.baseSalary already reflects position, this rule won't match.
   */
  {
    id: 'base-salary-position-multiplier',
    name: 'Position-Based Salary Adjustment',
    description: 'Apply position tier multiplier to base salary',
    type: BASE_SALARY_DECISION_TYPE,
    priority: 180,
    conditions: {
      any: [
        {
          fact: 'employee.positionTier',
          operator: 'equal',
          value: 'senior',
        },
        {
          fact: 'employee.positionTier',
          operator: 'equal',
          value: 'lead',
        },
        {
          fact: 'employee.positionTier',
          operator: 'equal',
          value: 'manager',
        },
      ],
    },
    event: {
      type: 'base-salary-adjustment',
      params: {
        adjustmentType: 'position-multiplier',
        multipliers: {
          junior: 1.0,
          senior: 1.2,
          lead: 1.5,
          manager: 2.0,
        },
      },
    },
  },

  /**
   * Rule P175: Contract Type Adjustment
   * 
   * Adjusts base salary based on employment contract type.
   * - Full-time: 100%
   * - Part-time: 50%
   * - Contract: Negotiated rate (default 80%)
   * - Intern: 60%
   */
  {
    id: 'base-salary-contract-type',
    name: 'Contract Type Adjustment',
    description: 'Apply contract type multiplier to base salary',
    type: BASE_SALARY_DECISION_TYPE,
    priority: 175,
    conditions: {
      any: [
        {
          fact: 'employee.contractType',
          operator: 'equal',
          value: 'part-time',
        },
        {
          fact: 'employee.contractType',
          operator: 'equal',
          value: 'contract',
        },
        {
          fact: 'employee.contractType',
          operator: 'equal',
          value: 'intern',
        },
      ],
    },
    event: {
      type: 'base-salary-adjustment',
      params: {
        adjustmentType: 'contract-type',
        multipliers: {
          'full-time': 1.0,
          'part-time': 0.5,
          'contract': 0.8,
          'intern': 0.6,
        },
      },
    },
  },

  /**
   * Rule P170: Probation Period Discount
   * 
   * Applies reduced base salary during probation period (typically 85%).
   * Only applies if employee is still within probation period.
   */
  {
    id: 'base-salary-probation',
    name: 'Probation Period Discount',
    description: 'Apply probation discount to base salary (85%)',
    type: BASE_SALARY_DECISION_TYPE,
    priority: 170,
    conditions: {
      all: [
        {
          fact: 'employee.status',
          operator: 'equal',
          value: 'probation',
        },
        {
          fact: 'employee.probationEndDate',
          operator: 'notEqual',
          value: null,
        },
        // Additional condition: current month is before probation end date
        // This will be checked in the provider service
      ],
    },
    event: {
      type: 'base-salary-adjustment',
      params: {
        adjustmentType: 'probation-discount',
        multiplier: 0.85,
        description: 'Probation period (85% of base salary)',
      },
    },
  },

  /**
   * Rule P165: Max Base Salary Cap
   * 
   * Ensures calculated base salary never exceeds tenant's maximum limit.
   * This acts as a safety constraint after all calculations.
   */
  {
    id: 'base-salary-max-cap',
    name: 'Max Base Salary Cap',
    description: 'Ensure base salary does not exceed maximum limit',
    type: BASE_SALARY_DECISION_TYPE,
    priority: 165,
    conditions: {
      all: [
        {
          fact: 'tenantConfig.maxBaseSalary',
          operator: 'greaterThan',
          value: 0,
        },
      ],
    },
    event: {
      type: 'base-salary-constraint',
      params: {
        constraintType: 'max-cap',
        description: 'Apply maximum base salary cap',
      },
    },
  },
];

/**
 * Rule Metadata
 * 
 * Provides additional information about the base salary rule set.
 */
export const baseSalaryRuleMetadata = {
  decisionType: BASE_SALARY_DECISION_TYPE,
  totalRules: baseSalaryRules.length,
  priorityRange: { min: 165, max: 200 },
  categories: {
    calculation: ['base-salary-full-month', 'base-salary-pro-rata', 'base-salary-resignation-cap'],
    constraints: ['base-salary-min-floor', 'base-salary-max-cap'],
    adjustments: [
      'base-salary-position-multiplier',
      'base-salary-contract-type',
      'base-salary-probation',
    ],
  },
  description: 'Rules for calculating employee base salary with pro-rata, caps, and adjustments',
};
