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

export interface SessionBooking {
  id: string;
  booking_number: string;
  package_name: string;
  total_sessions: number;
  completed_sessions: number;
  status: string | null;
  start_date: string | null;
  next_session_date: string | null;
  assigned_ktv_id: string | null;
  assigned_ktv_name: string | null;
  tenant_id: string;
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

export interface KtvUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
}
