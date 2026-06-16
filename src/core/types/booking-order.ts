import type { ModuleId } from './module';

/**
 * Booking or order status lifecycle.
 * 
 * @remarks
 * Represents the progression of a booking from creation to completion:
 * - `draft`: Initial state, not yet confirmed (can be modified/cancelled freely)
 * - `confirmed`: Customer confirmed, payment intent created
 * - `in_progress`: Service actively being delivered
 * - `completed`: Service fully delivered, ready for final payment/reconciliation
 * - `cancelled`: Booking cancelled (requires refund processing if already paid)
 */
export type BookingOrderStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Core booking order representing a customer's purchase or appointment.
 * 
 * @remarks
 * This is an industry-neutral primitive representing:
 * - Spa: A customer booking a package with scheduled sessions
 * - Cleaning: A customer booking a cleaning appointment
 * - Home-service: A customer booking a repair or maintenance service
 * 
 * **Module-Specific Data** (stored in metadata):
 * - Spa: `sessions_completed`, `sessions_remaining`, `assigned_ktv_id`, `package_details`
 * - Cleaning: `cleaning_type`, `square_meters`, `assigned_cleaner_id`
 * - Home-service: `service_type`, `technician_id`, `parts_needed`
 * 
 * @example
 * ```typescript
 * const spaBooking: CoreBookingOrder = {
 *   id: 'booking-uuid',
 *   tenantId: 'tenant-uuid',
 *   moduleId: 'spa',
 *   customerId: 'customer-uuid',
 *   serviceItemId: 'package-uuid',
 *   status: 'in_progress',
 *   scheduledStartTime: '2025-06-01T09:00:00Z',
 *   scheduledEndTime: '2025-12-01T09:00:00Z',
 *   totalAmount: 15000000,
 *   paidAmount: 5000000,
 *   metadata: {
 *     sessions_completed: 5,
 *     sessions_total: 20,
 *     assigned_ktv_id: 'ktv-uuid',
 *     package_category: 'vip',
 *   },
 * };
 * ```
 */
export interface CoreBookingOrder {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Tenant this booking belongs to */
  tenantId: string;
  
  /** Module that owns this booking */
  moduleId: ModuleId;
  
  /** Customer who made this booking */
  customerId: string;
  
  /** Service catalog item being purchased */
  serviceItemId: string;
  
  /** Current booking status */
  status: BookingOrderStatus;
  
  /** When the service/appointment starts (ISO 8601) */
  scheduledStartTime: string;
  
  /** When the service/appointment ends (ISO 8601, optional) */
  scheduledEndTime?: string;
  
  /** Total amount for this booking */
  totalAmount: number;
  
  /** Amount already paid by customer */
  paidAmount: number;
  
  /** 
   * Module-specific booking data.
   * 
   * @remarks
   * Store module-specific progress tracking and configuration here.
   * 
   * **Spa module examples**:
   * - `sessions_completed: number` - Number of sessions completed
   * - `sessions_remaining: number` - Remaining sessions in package
   * - `assigned_ktv_id: string` - Primary KTV assigned to this booking
   * - `package_details: object` - Full package configuration snapshot
   * - `session_history: Array` - Detailed session completion records
   * 
   * **Cleaning module examples**:
   * - `cleaning_type: string` - Type of cleaning service
   * - `square_meters: number` - Area to be cleaned
   * - `assigned_cleaner_id: string` - Assigned cleaner
   * - `completed_tasks: string[]` - Checklist of completed cleaning tasks
   * 
   * **Home-service module examples**:
   * - `service_type: string` - Type of repair/maintenance
   * - `technician_id: string` - Assigned technician
   * - `parts_needed: Array` - Parts required for the job
   * - `completion_photos: string[]` - URLs to completion photos
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

/**
 * Calculate remaining balance on a booking.
 * 
 * @param booking - Booking order to calculate balance for
 * @returns Remaining unpaid amount (never negative)
 * 
 * @remarks
 * Use this to determine how much the customer still owes.
 * Returns 0 if booking is fully paid or overpaid.
 * 
 * @example
 * ```typescript
 * const balance = getRemainingBalance(booking);
 * if (balance > 0) {
 *   console.log(`Customer owes ${balance} ${booking.currency}`);
 * }
 * ```
 */
export function getRemainingBalance(booking: CoreBookingOrder): number {
  return Math.max(0, booking.totalAmount - booking.paidAmount);
}

/**
 * Check if booking is fully paid.
 * 
 * @param booking - Booking order to check
 * @returns True if paid amount meets or exceeds total amount
 * 
 * @remarks
 * Use this before marking a booking as completed or before
 * allowing service delivery to proceed.
 * 
 * @example
 * ```typescript
 * if (isFullyPaid(booking)) {
 *   await markBookingCompleted(booking.id);
 * } else {
 *   throw new Error('Payment required before completion');
 * }
 * ```
 */
export function isFullyPaid(booking: CoreBookingOrder): boolean {
  return booking.paidAmount >= booking.totalAmount;
}

/**
 * Check if booking is active (confirmed or in progress).
 * 
 * @param booking - Booking order to check
 * @returns True if booking status is confirmed or in_progress
 * 
 * @remarks
 * Use this to filter bookings that require attention or tracking.
 * Draft and completed bookings are not considered active.
 * 
 * @example
 * ```typescript
 * const activeBookings = allBookings.filter(isActiveBooking);
 * console.log(`${activeBookings.length} bookings require attention`);
 * ```
 */
export function isActiveBooking(booking: CoreBookingOrder): boolean {
  return booking.status === 'confirmed' || booking.status === 'in_progress';
}
