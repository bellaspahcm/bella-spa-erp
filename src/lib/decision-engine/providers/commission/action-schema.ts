/**
 * Commission Provider - Action Schema
 */

import { ActionSchema } from '../../action-schema.types';

export const COMMISSION_ACTIONS: ActionSchema[] = [
  {
    type: 'apply_session_commission',
    label: 'Apply Session Commission',
    description: 'Apply commission based on sessions',
    params: [
      {
        key: 'rate',
        label: 'Commission Rate (VND per session)',
        type: 'number',
        required: true,
        placeholder: 'e.g., 50000',
        validation: { min: 0 },
        description: 'Commission per session',
      },
    ],
    group: 'Commission',
  },
  {
    type: 'apply_sales_commission',
    label: 'Apply Sales Commission',
    description: 'Apply commission based on product sales',
    params: [
      {
        key: 'percentage',
        label: 'Commission Percentage',
        type: 'number',
        required: true,
        placeholder: 'e.g., 10',
        validation: { min: 0, max: 100 },
        description: 'Percentage of sales (0-100)',
      },
    ],
    group: 'Commission',
  },
];
