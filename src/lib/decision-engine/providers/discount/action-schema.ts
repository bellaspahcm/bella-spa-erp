/**
 * Discount Provider - Action Schema
 */

import { ActionSchema } from '../../action-schema.types';

export const DISCOUNT_ACTIONS: ActionSchema[] = [
  {
    type: 'apply_percentage_discount',
    label: 'Apply Percentage Discount',
    description: 'Apply a percentage-based discount',
    params: [
      {
        key: 'percentage',
        label: 'Discount Percentage',
        type: 'number',
        required: true,
        validation: { min: 0, max: 100 },
        placeholder: 'e.g., 15',
        description: 'Discount percentage (0-100)',
      },
      {
        key: 'reason',
        label: 'Discount Reason',
        type: 'string',
        required: false,
        placeholder: 'e.g., VIP membership',
        description: 'Reason for discount (for audit)',
      },
    ],
    group: 'Discount',
  },
  {
    type: 'apply_fixed_discount',
    label: 'Apply Fixed Amount Discount',
    description: 'Apply a fixed amount discount',
    params: [
      {
        key: 'amount',
        label: 'Discount Amount (VND)',
        type: 'number',
        required: true,
        placeholder: 'e.g., 100000',
        validation: { min: 0 },
        description: 'Fixed discount amount',
      },
      {
        key: 'reason',
        label: 'Discount Reason',
        type: 'string',
        required: false,
        placeholder: 'e.g., Bundle discount',
        description: 'Reason for discount (for audit)',
      },
    ],
    group: 'Discount',
  },
  {
    type: 'apply_campaign_discount',
    label: 'Apply Campaign Discount',
    description: 'Apply discount from active campaign',
    params: [
      {
        key: 'campaignCode',
        label: 'Campaign Code',
        type: 'string',
        required: true,
        placeholder: 'e.g., SUMMER2024',
        description: 'Campaign code to apply',
      },
    ],
    group: 'Campaign',
  },
];
