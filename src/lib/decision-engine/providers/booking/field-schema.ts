/**
 * Booking Provider - Field Schema
 * 
 * Defines all available fields for booking decision rules.
 */

import { FieldSchema } from '../../field-schema.types';

export const BOOKING_FIELDS: FieldSchema[] = [
  // Customer Fields
  {
    key: 'customer.tier',
    label: 'Customer Tier',
    type: 'enum',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    defaultOperator: 'equals',
    enumValues: [
      { value: 'VIP', label: 'VIP' },
      { value: 'Loyal', label: 'Loyal Customer' },
      { value: 'New', label: 'New Customer' },
    ],
    group: 'Customer',
    description: 'Customer membership tier',
  },
  {
    key: 'customer.totalBookings',
    label: 'Total Bookings',
    type: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Customer',
    description: 'Total number of bookings by this customer',
    placeholder: 'e.g., 10',
  },
  {
    key: 'customer.lifetimeValue',
    label: 'Lifetime Value (VND)',
    type: 'number',
    operators: ['greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Customer',
    description: 'Total amount spent by customer',
    placeholder: 'e.g., 10000000',
  },
  
  // Booking Fields
  {
    key: 'booking.serviceCount',
    label: 'Number of Services',
    type: 'number',
    operators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Booking',
    description: 'Number of services in this booking',
    placeholder: 'e.g., 3',
  },
  {
    key: 'booking.totalAmount',
    label: 'Total Amount (VND)',
    type: 'number',
    operators: ['greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Booking',
    description: 'Total booking amount',
    placeholder: 'e.g., 2000000',
  },
  {
    key: 'booking.scheduledDate',
    label: 'Scheduled Date',
    type: 'datetime',
    operators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Booking',
    description: 'Date and time of booking',
  },
  {
    key: 'booking.status',
    label: 'Booking Status',
    type: 'enum',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    defaultOperator: 'equals',
    enumValues: [
      { value: 'pending', label: 'Pending' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    group: 'Booking',
    description: 'Current booking status',
  },
  
  // KTV Fields
  {
    key: 'ktv.availableCount',
    label: 'Available KTVs',
    type: 'number',
    operators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than',
    group: 'KTV',
    description: 'Number of available KTVs for this time slot',
    placeholder: 'e.g., 5',
  },
  {
    key: 'ktv.seniorCount',
    label: 'Senior KTVs Available',
    type: 'number',
    operators: ['greater_than', 'greater_than_or_equal'],
    defaultOperator: 'greater_than',
    group: 'KTV',
    description: 'Number of senior-level KTVs available',
    placeholder: 'e.g., 2',
  },
];
