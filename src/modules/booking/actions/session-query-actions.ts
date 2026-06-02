'use server';

import { getLocalDateString, resolvePackageName } from '@/lib/utils';
import type { Database } from '@/types/database.types';

type BookingRow = Database['public']['Tables']['bookings']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];

type SessionLogWithKtv = SessionLogRow & {
  ktv?: { id: string; full_name: string | null } | null;
};

type BookingWithSessionDetails = BookingRow & {
  customers?: Pick<CustomerRow, 'id' | 'name_mother' | 'name_baby' | 'phone' | 'dob_expected'> | null;
  assigned_ktv?: { id: string; full_name: string | null } | null;
  packages?: { name: string | null } | null;
  session_logs?: SessionLogWithKtv[];
};

type CalendarBooking = BookingRow & {
  packages?: { name: string | null } | null;
  customers?: Pick<CustomerRow, 'id' | 'name_mother' | 'name_baby' | 'address'> | null;
  assigned_ktv?: { id: string; full_name: string | null } | null;
};

type CalendarSession = SessionLogRow & {
  bookings?: CalendarBooking | null;
};
type EnrichedCalendarSession = Omit<CalendarSession, 'assigned_date'> & {
  assigned_date: string;
};

function parseDateParts(dateString: string): [number, number, number] {
  const parts = dateString.split('-').map(Number);
  return [parts[0] || 1970, parts[1] || 1, parts[2] || 1];
}

export async function getSessionLogs(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session_logs')
    .select('*, ktv:users!session_logs_completed_by_ktv_id_fkey(full_name)')
    .eq('booking_id', bookingId)
    .order('session_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch session logs for booking ${bookingId}: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data;
}

export async function getSessionsWithDetails() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

  let query = supabase
    .from('bookings')
    .select(`
      *, 
      preferred_time,
      customers(id, name_mother, name_baby, phone, dob_expected),
      assigned_ktv:users!bookings_assigned_ktv_id_fkey(id, full_name),
      packages!bookings_package_id_fkey(name),
      session_logs(id, booking_id, session_number, assigned_date, assigned_time, completed_date, start_time, end_time, status, notes, rating, rating_comment, completed_by_ktv_id, ktv:users!session_logs_completed_by_ktv_id_fkey(id, full_name), duration_warning_type, ktv_checkout_note, standard_duration, actual_duration, time_deviation)
    `)
    .order('created_at', { ascending: false });

  if (currentUser?.role?.toLowerCase() === 'ktv') {
    query = query.eq('assigned_ktv_id', currentUser.id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch sessions with details: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  const bookings = (data || []) as BookingWithSessionDetails[];
  const enrichedData = await Promise.all(bookings.map(async (b) => {
    const sortedLogs = (b.session_logs || []).sort((a, b2) => (a.session_number || 0) - (b2.session_number || 0));
    
    let lastKnownDate = b.start_date;
    let lastKnownSessionNum = 1;

    const mappedLogs = sortedLogs.map((s) => {
      let finalDate = s.assigned_date;
      if (!finalDate) {
        if (lastKnownDate) {
          const [y, m, d] = lastKnownDate.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (s.session_number - lastKnownSessionNum));
          finalDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
      }
      if (finalDate) {
        lastKnownDate = finalDate;
        lastKnownSessionNum = s.session_number;
      }
      return { ...s, assigned_date: finalDate };
    });

    const nextSession = mappedLogs.find((s) => s.status === 'scheduled');
    const customerData = b.customers;

    return {
      ...b,
      package_name: resolvePackageName(b),
      session_logs: mappedLogs,
      customers: customerData || {
        id: '',
        name_mother: 'Khách hàng Bella Spa',
        name_baby: null,
        phone: '---',
        dob_expected: null,
      },
      assigned_ktv_name: b.assigned_ktv?.full_name || 'Chưa phân công',
      next_session_date: nextSession?.assigned_date || null,
      start_date: b.start_date,
      end_date: b.end_date,
      expected_birth_date: b.expected_birth_date
    };
  }));

  return enrichedData;
}

export async function getCalendarSessions() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

  let query = supabase
    .from('session_logs')
    .select(`
      *,
      bookings (
        *,
        preferred_time,
        packages!bookings_package_id_fkey (name),
        customers (
          id,
          name_mother,
          name_baby,
          address
        ),
        assigned_ktv:users!bookings_assigned_ktv_id_fkey (
          id,
          full_name
        )
      )
    `)
    .order('booking_id', { ascending: true })
    .order('session_number', { ascending: true });

  if (currentUser?.role?.toLowerCase() === 'ktv') {
    query = query.eq('bookings.assigned_ktv_id', currentUser.id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch calendar sessions: ${error.message}`);
  }
  
  const sessionsByBooking: Record<string, CalendarSession[]> = {};
  const sessions = (data || []) as CalendarSession[];
  sessions.forEach((s) => {
    if (!s.booking_id) return;
    if (!sessionsByBooking[s.booking_id]) sessionsByBooking[s.booking_id] = [];
    sessionsByBooking[s.booking_id].push(s);
  });

  const processedSessionsList = await Promise.all(Object.entries(sessionsByBooking).map(async ([, bookingSessions]) => {
    bookingSessions.sort((a, b) => a.session_number - b.session_number);

    let lastKnownDate: string | null = null;
    let lastKnownSessionNum = 0;
    const bookingResult: EnrichedCalendarSession[] = [];

    for (const s of bookingSessions) {
      let finalDate = s.assigned_date;
      
      if (!finalDate) {
        if (lastKnownDate) {
          const [y, m, d] = parseDateParts(lastKnownDate);
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (s.session_number - lastKnownSessionNum));
          finalDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } else if (s.bookings?.start_date) {
          const [y, m, d] = parseDateParts(s.bookings.start_date);
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (s.session_number - 1));
          finalDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
      }

      if (finalDate) {
        lastKnownDate = finalDate;
        lastKnownSessionNum = s.session_number;
      } else {
        finalDate = getLocalDateString();
      }

      bookingResult.push({
        ...s,
        assigned_date: finalDate,
        completed_date: s.completed_date,
        bookings: s.bookings ? {
          ...s.bookings,
          package_name: resolvePackageName(s.bookings),
          start_date: s.bookings.start_date,
          completed_sessions: s.bookings.completed_sessions,
          expected_birth_date: s.bookings.expected_birth_date
        } : null
      });
    }
    return bookingResult;
  }));

  return processedSessionsList.flat();
}
