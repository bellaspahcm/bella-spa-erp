/**
 * Commission Provider - Field Schema
 */

import { FieldSchema } from '../../field-schema.types';

export const COMMISSION_FIELDS: FieldSchema[] = [
  {
    key: 'session.count',
    label: 'Session Count',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than', 'equals'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Performance',
    description: 'Number of completed sessions',
    placeholder: 'e.g., 50',
  },
  {
    key: 'session.avgRating',
    label: 'Average Session Rating',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Performance',
    description: 'Average rating across sessions',
    placeholder: 'e.g., 4.5',
    validation: { min: 1, max: 5 },
  },
  {
    key: 'sales.totalAmount',
    label: 'Total Sales Amount (VND)',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Sales',
    description: 'Total product sales amount',
    placeholder: 'e.g., 5000000',
  },
];
