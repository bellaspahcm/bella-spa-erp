"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRemainingBalance = getRemainingBalance;
exports.isFullyPaid = isFullyPaid;
exports.isActiveBooking = isActiveBooking;
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
function getRemainingBalance(booking) {
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
function isFullyPaid(booking) {
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
function isActiveBooking(booking) {
    return booking.status === 'confirmed' || booking.status === 'in_progress';
}
