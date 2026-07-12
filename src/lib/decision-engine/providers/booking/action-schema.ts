/**
 * Booking Provider - Action Schema
 * 
 * Defines all available actions for booking decision rules.
 */

import { ActionSchema } from '../../action-schema.types';

export const BOOKING_ACTIONS: ActionSchema[] = [
  {
    type: 'approve',
    label: 'Approve Booking',
    description: 'Automatically approve the booking without manual review',
    params: [
      {
        key: 'message',
        label: 'Approval Message',
        type: 'string',
        required: false,
        placeholder: 'e.g., VIP customer - auto-approved',
        description: 'Optional message for audit trail',
      },
    ],
    group: 'Approval',
  },
  {
    type: 'reject',
    label: 'Reject Booking',
    description: 'Automatically reject the booking',
    params: [
      {
        key: 'reason',
        label: 'Rejection Reason',
        type: 'string',
        required: true,
        placeholder: 'e.g., No available KTVs',
        description: 'Reason for rejection (required)',
      },
    ],
    group: 'Approval',
  },
  {
    type: 'requiresDeposit',
    label: 'Require Deposit',
    description: 'Flag booking as requiring deposit payment',
    params: [
      {
        key: 'depositAmount',
        label: 'Deposit Amount (VND)',
        type: 'number',
        required: false,
        placeholder: 'e.g., 500000',
        description: 'Fixed deposit amount (optional if using percentage)',
      },
      {
        key: 'depositPercentage',
        label: 'Deposit Percentage',
        type: 'number',
        required: false,
        placeholder: 'e.g., 30',
        validation: { min: 0, max: 100 },
        description: 'Percentage of total (0-100)',
      },
    ],
    group: 'Payment',
  },
  {
    type: 'set_priority',
    label: 'Set Priority',
    description: 'Assign priority level to booking',
    params: [
      {
        key: 'priority',
        label: 'Priority Value',
        type: 'number',
        required: true,
        defaultValue: 100,
        validation: { min: 0, max: 1000 },
        description: 'Higher values = higher priority (0-1000)',
        placeholder: 'e.g., 500',
      },
    ],
    group: 'Processing',
  },
  {
    type: 'assign_ktv',
    label: 'Assign Specific KTV',
    description: 'Assign a specific KTV level to the booking',
    params: [
      {
        key: 'ktvLevel',
        label: 'KTV Level',
        type: 'enum',
        required: true,
        enumValues: [
          { value: 'senior', label: 'Senior KTV' },
          { value: 'intermediate', label: 'Intermediate KTV' },
          { value: 'junior', label: 'Junior KTV' },
        ],
        description: 'KTV experience level to assign',
      },
    ],
    group: 'Assignment',
  },
  {
    type: 'add_to_waitlist',
    label: 'Add to Waitlist',
    description: 'Add booking to waitlist if no KTV available',
    params: [
      {
        key: 'notifyCustomer',
        label: 'Notify Customer',
        type: 'boolean',
        required: false,
        defaultValue: true,
        description: 'Send notification to customer',
      },
    ],
    group: 'Processing',
  },
];
