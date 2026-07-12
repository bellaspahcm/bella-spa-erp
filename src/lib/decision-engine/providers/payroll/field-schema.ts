/**
 * Payroll Provider - Field Schema
 */

import { FieldSchema } from '../../field-schema.types';

export const PAYROLL_FIELDS: FieldSchema[] = [
  {
    key: 'ktv.totalSessions',
    label: 'Total Sessions (Weighted)',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than', 'equals', 'greater_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Performance',
    description: 'Total sessions with package multipliers applied',
    placeholder: 'e.g., 100',
  },
  {
    key: 'ktv.avgRating',
    label: 'Average Rating',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than', 'equals'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Performance',
    description: 'Average customer rating (1-5 stars)',
    placeholder: 'e.g., 4.5',
    validation: { min: 1, max: 5 },
  },
  {
    key: 'ktv.violationCount',
    label: 'Violation Count',
    type: 'number',
    operators: ['equals', 'greater_than', 'greater_than_or_equal'],
    defaultOperator: 'equals',
    group: 'Attendance',
    description: 'Number of policy violations',
    placeholder: 'e.g., 0',
  },
  {
    key: 'ktv.lateCount',
    label: 'Late Arrivals',
    type: 'number',
    operators: ['greater_than_or_equal', 'equals', 'greater_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Attendance',
    description: 'Number of late arrivals this period',
    placeholder: 'e.g., 2',
  },
  {
    key: 'period.month',
    label: 'Month',
    type: 'number',
    operators: ['equals'],
    defaultOperator: 'equals',
    group: 'Period',
    description: 'Month of the payroll period (1-12)',
    placeholder: 'e.g., 7',
    validation: { min: 1, max: 12 },
  },
];
