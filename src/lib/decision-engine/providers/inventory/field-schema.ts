/**
 * Inventory Provider - Field Schema
 */

import { FieldSchema } from '../../field-schema.types';

export const INVENTORY_FIELDS: FieldSchema[] = [
  {
    key: 'product.currentStock',
    label: 'Current Stock Level',
    type: 'number',
    operators: ['less_than_or_equal', 'greater_than', 'equals'],
    defaultOperator: 'less_than_or_equal',
    group: 'Stock',
    description: 'Current inventory quantity',
    placeholder: 'e.g., 10',
  },
  {
    key: 'product.reorderPoint',
    label: 'Reorder Point',
    type: 'number',
    operators: ['less_than_or_equal', 'equals'],
    defaultOperator: 'less_than_or_equal',
    group: 'Stock',
    description: 'Minimum stock before reorder',
    placeholder: 'e.g., 20',
  },
  {
    key: 'product.expiryDays',
    label: 'Days Until Expiry',
    type: 'number',
    operators: ['less_than_or_equal', 'greater_than'],
    defaultOperator: 'less_than_or_equal',
    group: 'Expiry',
    description: 'Days remaining until expiration',
    placeholder: 'e.g., 30',
  },
];
