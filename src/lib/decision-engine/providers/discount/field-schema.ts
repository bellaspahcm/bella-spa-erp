/**
 * Discount Provider - Field Schema
 */

import { FieldSchema } from '../../field-schema.types';

export const DISCOUNT_FIELDS: FieldSchema[] = [
  {
    key: 'customer.membershipTier',
    label: 'Membership Tier',
    type: 'enum',
    operators: ['equals', 'in', 'not_in'],
    defaultOperator: 'equals',
    enumValues: [
      { value: 'VIP', label: 'VIP (15% discount)' },
      { value: 'Loyal', label: 'Loyal (10% discount)' },
      { value: 'New', label: 'New Customer (5% discount)' },
    ],
    group: 'Customer',
    description: 'Customer membership tier for discounts',
  },
  {
    key: 'order.totalAmount',
    label: 'Order Total (VND)',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than', 'greater_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Order',
    description: 'Total order amount before discount',
    placeholder: 'e.g., 1000000',
  },
  {
    key: 'order.itemCount',
    label: 'Number of Items',
    type: 'number',
    operators: ['greater_than_or_equal', 'equals', 'greater_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Order',
    description: 'Number of items in order',
    placeholder: 'e.g., 3',
  },
  {
    key: 'campaign.code',
    label: 'Campaign Code',
    type: 'string',
    operators: ['equals', 'in'],
    defaultOperator: 'equals',
    group: 'Campaign',
    description: 'Active campaign code',
    placeholder: 'e.g., SUMMER2024',
  },
  {
    key: 'campaign.isActive',
    label: 'Campaign Active',
    type: 'boolean',
    operators: ['equals'],
    defaultOperator: 'equals',
    group: 'Campaign',
    description: 'Whether campaign is currently active',
  },
];
