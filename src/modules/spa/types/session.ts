/**
 * Spa Session Types
 * 
 * Session log and session-related types specific to the spa module.
 */

import type { Database } from '@/types/database.types';
import type { SessionBookingLike } from './booking';

// Database row types
export type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
export type SessionLogInsert = Database['public']['Tables']['session_logs']['Insert'];
export type SessionLogUpdate = Database['public']['Tables']['session_logs']['Update'];

// Session log types
export interface SessionLog {
  id: string;
  booking_id: string;
  session_number: number;
  status: 'scheduled' | 'completed' | 'cancelled' | 'in_progress';
  notes: string | null;
  assigned_date: string | null;
  assigned_time: string | null;
  completed_date: string | null;
  start_time: string | null;
  end_time: string | null;
  checkin_lat: number | null;
  checkin_lon: number | null;
  checkout_lat: number | null;
  checkout_lon: number | null;
  duration_warning_type: 'normal' | 'under_time' | 'over_time' | null;
  time_deviation: number | null;
  standard_duration: number | null;
  actual_duration: number | null;
  ktv_checkout_note: string | null;
  rating: number | null;
  rating_comment: string | null;
  completed_by_ktv_id: string | null;
  ktv?: {
    id: string;
    full_name: string;
  } | null;
}

// Session booking types
export interface SessionBooking {
  id: string;
  booking_number: string;
  package_name: string;
  total_sessions: number;
  completed_sessions: number;
  start_date: string | null;
  next_session_date: string | null;
  assigned_ktv_id: string | null;
  assigned_ktv_name: string | null;
  created_at: string;
  last_updated_date: string | null;
  customers: {
    id: string;
    name_mother: string;
    name_baby: string | null;
    phone: string | null;
    dob_expected: string | null;
  } | null;
  assigned_ktv?: {
    id: string;
    full_name: string;
  } | null;
  session_logs?: SessionLog[];
}

// Conflict session types
export interface ConflictSession {
  id: string;
  session_number: number;
  assigned_time: string | null;
  bookings?: {
    id: string;
    package_name: string;
    customers?: {
      full_name: string;
    } | null;
  } | null;
}

// Leave request types
export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_date: string;
  leave_type: 'full_day' | 'morning' | 'afternoon';
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  users?: {
    full_name: string;
    email: string;
  } | null;
}

// Session revenue recognition types
export type SessionRevenueRecognitionInput = {
  fullPrice: number | string | null | undefined;
  discountPercent?: number | string | null;
  discountAmount?: number | string | null;
  completedSessions: number | string | null | undefined;
  totalSessions: number | string | null | undefined;
};

export type SessionRevenueRecognition = {
  targetPrice: number;
  earnedRevenueAmount: number;
  remainingRevenueAmount: number;
};

// Session review types
export interface SessionReviewDBRow {
  rating: number | null;
  status: string;
}

// Session log database types
export interface SessionLogDBRow {
  id: string;
  completed_by_ktv_id: string | null;
  completed_date: string | null;
  rating: number | null;
  status: string;
}

// Session matrix export types
export interface SessionMatrixRow {
  name: string;
  [packageName: string]: string | number | boolean | null | undefined;
}

// Session types for business rules
export type SessionLike = {
  bookings?: SessionBookingLike | null;
};

// KTV salary confirmation session types
export type KtvSalaryConfirmationSession = Pick<
  SessionLogRow,
  'id' | 'completed_date' | 'session_number'
> & {
  bookings?: {
    package_name: string | null;
    booking_number: string | null;
    customers?: { name_mother: string | null } | null;
  } | null;
};
