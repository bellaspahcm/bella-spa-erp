/**
 * Core order management services.
 * 
 * Handles the complete order/booking lifecycle including:
 * - Order CRUD operations
 * - Session scheduling and completion
 * - Payment processing
 * - Commission calculations
 * 
 * @module core/services/order
 */

// Task 4.1B: Query & Lifecycle Files (Migrated)
export {
  getPackages,
  getBookings,
  getBookingsByCustomerId,
  getDraftBooking,
} from './query-actions';

export {
  updateBooking,
  syncBookingProgress,
  submitOnlineBooking,
  reusePackage,
  createBooking,
  recordRemainingPayment,
  generateShareToken,
  getBookingDetailsWithPayment,
} from './lifecycle-actions';

export type { OnlineBookingFormData } from './lifecycle-actions';

// Task 4.1C: Session Lifecycle Files (Migrated)
export {
  updateSessionLog,
  completeSession,
  saveSessionNote,
  addExtraSession,
  createSessionLog,
  rescheduleSession,
  getSessionLogs,
  getSessionsWithDetails,
  getCalendarSessions,
} from './session-actions';

// processSessionCompletion is intentionally NOT re-exported here.
// It's a server-only engine used directly by server action files (complete-session-action.ts, ktv-actions.ts).
// Exporting it from this barrel would pull next/headers into the client bundle via page.tsx.

// Task 4.1D: Payment & Commission Files (Migrated)
// Note: recordRemainingPayment, generateShareToken, getBookingDetailsWithPayment 
// are already exported from lifecycle-actions above

export type { RecordRemainingPaymentParams } from './payment-helpers';

export { resolveKtvCommission } from './commission-actions';

export {
  recordInvoicePrintLog,
  voidLatestInvoicePrintLog,
  getInvoicePrintLogsForBooking,
  type BookingInvoicePrintLog,
} from './invoice-print-actions';

export { getPublicBabycareBookingPackages } from './public-booking-packages';

export { resolvePublicBabycareTenantId } from './public-booking-tenant';

// Task 19.2: Pricing with adapter integration
export { calculateOrderPrice, calculateOrderPriceBatch } from './pricing-actions';
