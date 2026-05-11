'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { ensure2026 } from '@/lib/utils';

export async function getBookings() {
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(name_mother, phone)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }
  
  return (data || []).map((b: any) => ({
    ...b,
    start_date: ensure2026(b.start_date),
    end_date: ensure2026(b.end_date),
    expected_birth_date: ensure2026(b.expected_birth_date)
  }));
}

import { bookingSchema } from '@/lib/validations';

export async function createBooking(formData: any) {
  const supabase = (await createClient()) as any;
  
  // 0. Validate with Zod
  const validatedFields = bookingSchema.safeParse(formData);
  
  if (!validatedFields.success) {
    return { error: 'Dữ liệu không hợp lệ', details: validatedFields.error.flatten().fieldErrors };
  }

  const validatedData = validatedFields.data;

  // 1. Create the booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert([
      {
        customer_id: validatedData.customer_id,
        booking_number: `BK-${new Date().getTime()}`,
        package_id: validatedData.package_id || null,
        status: 'deposit_pending',
        full_price: validatedData.full_price,
        deposit_amount: validatedData.deposit_amount,
        total_sessions: validatedData.total_sessions,
        start_date: validatedData.start_date || null,
      } as any,
    ])
    .select()
    .single();

  if (bookingError) {
    console.error('Error creating booking:', bookingError);
    return { error: bookingError.message };
  }

  // 2. Automation: Generate session logs (default 21 sessions)
  const totalSessions = booking.total_sessions || 21;
  const sessionLogs = Array.from({ length: totalSessions }, (_: any, i: number) => ({
    booking_id: booking.id,
    session_number: i + 1,
    status: 'scheduled',
  }));

  const { error: sessionsError } = await supabase
    .from('session_logs')
    .insert(sessionLogs as any);

  if (sessionsError) {
    console.error('Error creating session logs:', sessionsError);
    // Note: In production, you might want to rollback the booking creation here if this fails
    return { error: 'Booking created but session logs failed: ' + sessionsError.message };
  }

  revalidatePath('/dashboard/bookings');
  revalidatePath('/dashboard');
  return { data: booking };
}

export async function getSessionLogs(bookingId: string) {
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('session_logs')
    .select('*')
    .eq('booking_id', bookingId)
    .order('session_number', { ascending: true });

  if (error) {
    console.error('Error fetching session logs:', error);
    return [];
  }

  return data;
}

export async function completeSession(sessionId: string, bookingId: string) {
  const supabase = (await createClient()) as any;

  // 1. Update session log status
  const { error: sessionError } = await supabase
    .from('session_logs')
    .update({ 
      status: 'completed',
      completed_date: new Date().toISOString()
    } as any)
    .eq('id', sessionId);

  if (sessionError) {
    console.error('Error completing session:', sessionError);
    return { error: sessionError.message };
  }

  // 2. Fetch current completed sessions count from booking
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('completed_sessions')
    .eq('id', bookingId)
    .single();

  if (fetchError) {
    console.error('Error fetching booking:', fetchError);
    return { error: fetchError.message };
  }

  // 3. Increment completed sessions count
  const newCount = (booking.completed_sessions || 0) + 1;
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ completed_sessions: newCount } as any)
    .eq('id', bookingId);

  if (updateError) {
    console.error('Error updating booking progress:', updateError);
    return { error: updateError.message };
  }

  revalidatePath('/dashboard/sessions');
  revalidatePath('/dashboard/bookings');
  revalidatePath('/dashboard');
  
  return { success: true };
}

export async function getSessionsWithDetails() {
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(name_mother, phone)')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions with details:', error);
    return [];
  }
  
  return (data || []).map((b: any) => ({
    ...b,
    start_date: ensure2026(b.start_date),
    end_date: ensure2026(b.end_date),
    expected_birth_date: ensure2026(b.expected_birth_date)
  }));
}

export async function getCalendarSessions() {
  const supabase = (await createClient()) as any;
  
  const { data, error } = await supabase
    .from('session_logs')
    .select(`
      *,
      bookings (
        *,
        customers (
          name_mother,
          address
        ),
        assigned_ktv:users!bookings_assigned_ktv_id_fkey (
          full_name
        )
      )
    `)
    .order('assigned_date', { ascending: true });

  if (error) {
    console.error('Error fetching calendar sessions:', error);
    return [];
  }
  
  return (data || []).map((s: any) => ({
    ...s,
    assigned_date: ensure2026(s.assigned_date),
    completed_date: ensure2026(s.completed_date),
    bookings: s.bookings ? {
      ...s.bookings,
      start_date: ensure2026(s.bookings.start_date),
      expected_birth_date: ensure2026(s.bookings.expected_birth_date)
    } : null
  }));
}

export async function updateSessionLog(id: string, updates: any) {
  const supabase = (await createClient()) as any;
  
  const { data, error } = await supabase
    .from('session_logs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating session log:', error);
    return { error: error.message };
  }

  revalidatePath('/dashboard/bookings');
  return { data };
}
