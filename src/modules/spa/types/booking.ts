/**
 * Spa Booking Types
 * 
 * Spa-specific booking and order types.
 * These extend the core CoreBookingOrder with spa-specific fields.
 */

import type { Database } from '@/types/database.types';
import type { CoreBookingOrder } from '@/core/types';
import type { SessionPackageLike } from './package';

/**
 * Spa-specific booking extending CoreBookingOrder with spa fields.
 * 
 * This type adds strongly-typed spa-specific fields from the metadata
 * for better type safety and developer experience.
 */
export interface SpaBooking extends CoreBookingOrder {
  /** Number of sessions completed */
  sessionsCompleted: number;
  /** Total sessions in package */
  sessionsTotal: number;
  /** Assigned KTV employee ID */
  assignedKtvId: string;
  /** Package category (basic, premium, vip) */
  packageCategory: string;
}

// Database row types
export type BookingRow = Database['public']['Tables']['bookings']['Row'];
export type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
export type BookingUpdate = Database['public']['Tables']['bookings']['Update'];

// Booking status types
export type BookingCompletionStatus =
  | 'draft'
  | 'deposit_pending'
  | 'booked'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | string;

// Booking completion types
export type BookingCompletionSnapshot = {
  total_sessions?: number | string | null;
  completed_sessions?: number | string | null;
  status?: string | null;
};

export type BookingCompletionUpdate = {
  completed_sessions: number;
  last_updated_date: string;
  status?: string;
};

// Booking payment types
export type BookingPaymentStateInput = {
  fullPrice: number | string | null | undefined;
  discountPercent?: number | string | null;
  discountAmount?: number | string | null;
  totalPaid: number | string | null | undefined;
  status?: string | null;
};

export type BookingPaymentState = {
  priceAfterDiscount: number;
  totalPaid: number;
  remaining: number;
  isFullyPaid: boolean;
};

// Booking resource types
export const BOOKING_RESOURCE_TYPES = ['bed', 'room', 'machine', 'chair', 'other'] as const;
export const BOOKING_RESOURCE_STATUSES = ['available', 'in_use', 'maintenance', 'inactive'] as const;

export type BookingResourceType = (typeof BOOKING_RESOURCE_TYPES)[number];
export type BookingResourceStatus = (typeof BOOKING_RESOURCE_STATUSES)[number];

export type BookingResource = Database['public']['Tables']['booking_resources']['Row'];

export type BookingResourceInput = {
  tenant_id?: string | null;
  branch_tenant_id?: string | null;
  name?: string | null;
  resource_type?: string | null;
  status?: string | null;
  capacity?: number | string | null;
  location_note?: string | null;
};

export type BookingResourcePayload = {
  tenant_id: string;
  branch_tenant_id: string | null;
  name: string;
  resource_type: BookingResourceType;
  status: BookingResourceStatus;
  capacity: number | null;
  location_note: string | null;
};

export type BookingResourceRuleResult =
  | { success: true; payload: BookingResourcePayload }
  | { success: false; error: string };

export type BookingResourceFormState = {
  id: string | null;
  name: string;
  resourceType: BookingResourceType;
  status: BookingResourceStatus;
  capacity: string;
  locationNote: string;
};

// Booking financial integrity types
export type BookingFinancialIntegritySnapshot = {
  bookingId: string;
  bookingNumber?: string | null;
  fullPrice: number;
  totalPaid: number;
  remaining: number;
  revenues: Array<{
    id: string;
    amount: number;
    status: string;
    revenue_type?: string | null;
  }>;
};

// Booking invoice types
export type BookingInvoicePrintLog = Database['public']['Tables']['invoice_print_logs']['Row'] & {
  printed_by_user?: {
    full_name: string | null;
  } | null;
};

// Booking utility types
export interface BookingForPackageName {
  packages?: { name?: string | null } | { name?: string | null }[] | null;
  package_name?: string | null;
}

// Session booking types (used in session logs)
export type SessionBookingLike = {
  package_name?: string | null;
  ktv_commission?: number | string | null;
  packages?: SessionPackageLike | SessionPackageLike[] | null;
};

// Database row types for related tables
export interface BookingDBRow {
  id: string;
  status: string;
  full_price: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  completed_sessions: number | null;
  total_sessions: number | null;
}
