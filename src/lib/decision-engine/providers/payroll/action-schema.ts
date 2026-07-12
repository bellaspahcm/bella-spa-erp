/**
 * Payroll Provider - Action Schema
 */

import { ActionSchema } from '../../action-schema.types';

export const PAYROLL_ACTIONS: ActionSchema[] = [
  {
    type: 'apply_kpi_bonus',
    label: 'Apply KPI Bonus',
    description: 'Apply performance-based KPI bonus',
    params: [
      {
        key: 'amount',
        label: 'Bonus Amount (VND)',
        type: 'number',
        required: true,
        placeholder: 'e.g., 1000000',
        validation: { min: 0 },
        description: 'KPI bonus amount',
      },
      {
        key: 'reason',
        label: 'Bonus Reason',
        type: 'string',
        required: true,
        placeholder: 'e.g., Exceeded session target',
        description: 'Reason for KPI bonus',
      },
    ],
    group: 'Bonus',
  },
  {
    type: 'apply_deduction',
    label: 'Apply Deduction',
    description: 'Apply salary deduction',
    params: [
      {
        key: 'amount',
        label: 'Deduction Amount (VND)',
        type: 'number',
        required: true,
        placeholder: 'e.g., 200000',
        validation: { min: 0 },
        description: 'Deduction amount',
      },
      {
        key: 'reason',
        label: 'Deduction Reason',
        type: 'enum',
        required: true,
        enumValues: [
          { value: 'late_arrival', label: 'Late Arrival' },
          { value: 'absent_unnotified', label: 'Absent Without Notice' },
          { value: 'policy_violation', label: 'Policy Violation' },
        ],
        description: 'Reason for deduction',
      },
    ],
    group: 'Deduction',
  },
  {
    type: 'apply_rating_bonus',
    label: 'Apply Rating Bonus',
    description: 'Apply bonus based on customer ratings',
    params: [
      {
        key: 'amount',
        label: 'Bonus Amount (VND)',
        type: 'number',
        required: true,
        placeholder: 'e.g., 500000',
        validation: { min: 0 },
        description: 'Rating bonus amount',
      },
    ],
    group: 'Bonus',
  },
];
