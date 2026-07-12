/**
 * Inventory Provider - Action Schema
 */

import { ActionSchema } from '../../action-schema.types';

export const INVENTORY_ACTIONS: ActionSchema[] = [
  {
    type: 'trigger_reorder',
    label: 'Trigger Reorder',
    description: 'Create purchase order for restocking',
    params: [
      {
        key: 'quantity',
        label: 'Reorder Quantity',
        type: 'number',
        required: true,
        placeholder: 'e.g., 100',
        validation: { min: 1 },
        description: 'Quantity to reorder',
      },
    ],
    group: 'Reorder',
  },
  {
    type: 'apply_discount',
    label: 'Apply Expiry Discount',
    description: 'Apply discount to expiring products',
    params: [
      {
        key: 'percentage',
        label: 'Discount Percentage',
        type: 'number',
        required: true,
        placeholder: 'e.g., 30',
        validation: { min: 0, max: 100 },
        description: 'Discount percentage (0-100)',
      },
    ],
    group: 'Expiry',
  },
];
