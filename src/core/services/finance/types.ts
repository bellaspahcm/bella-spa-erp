// Shared finance domain types. Plain module (no 'use server').

export interface MappedTransaction {
  id: string;
  dbId: string;
  type: 'revenue' | 'expense';
  category: string;
  amountNum: number;
  amount: string;
  date: string;
  method: string;
  status: string;
  details: string;
  timestamp: number;
}

export interface RevenueDBRow {
  id: string;
  booking_id: string | null;
  amount: number | string;
  revenue_type: string;
  payment_method: string;
  received_date: string;
  status: string;
  notes: string | null;
  bookings: {
    package_name: string;
    customers: {
      name_mother: string;
      name_baby: string | null;
    } | null;
  } | null;
}

export interface ExpenseDBRow {
  id: string;
  category: string;
  amount: number | string;
  description: string | null;
  expense_date: string;
  status: string;
}

export interface KtvDBRow {
  id: string;
  base_salary?: number;
}

export interface SalaryRecordDBRow {
  id: string;
  ktv_id: string;
  base_salary?: number | string | null;
  kpi_bonus?: number | string | null;
  violations_deduction?: number | string | null;
  service_percentage_bonus?: number | string | null;
  total_salary?: number | string | null;
  session_bonus?: number | string | null;
  rating_bonus?: number | string | null;
}

export interface SessionReviewDBRow {
  rating: number | null;
  status: string;
}

export interface SessionLogDBRow {
  id: string;
  completed_by_ktv_id: string | null;
  status: string;
  completed_date: string;
  rating: number | null;
  booking_id: string | null;
  bookings: {
    tenant_id: string;
    ktv_commission: number | null;
  } | null;
  session_reviews: SessionReviewDBRow[] | null;
}

export interface BookingDBRow {
  id: string;
  status: string;
  full_price?: number;
  completed_sessions?: number;
  total_sessions?: number;
  ktv_commission?: number;
}

export interface ServiceBookingDBRow {
  package_name: string;
  full_price: number;
  discount_percent: number;
  completed_sessions: number;
  total_sessions: number;
  ktv_commission: number;
  status: string;
}
