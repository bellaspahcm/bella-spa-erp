'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { ensure2026 } from '@/lib/utils';
import { DEMO_BOOKINGS, DEMO_SESSIONS } from '@/constants/demo-data';
import { MOCK_SERVICES } from '@/constants/mock-data';

/**
 * Helper to resolve package name from booking data
 */
function resolvePackageName(booking: any): string {
  if (booking?.package_name) return booking.package_name;
  
  const price = Number(booking?.full_price);
  const matchedService = MOCK_SERVICES.find(s => {
    const sPrice = parseInt(s.price.replace(/[^\d]/g, ''));
    return sPrice === price;
  });

  return matchedService?.name || 'Chưa đăng ký';
}

export async function getBookings() {
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(name_mother, phone)')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    console.error('Error fetching bookings or empty:', error);
    return DEMO_BOOKINGS;
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
    const errorMessages = Object.values(validatedFields.error.flatten().fieldErrors).flat().join(', ');
    return { error: `Dữ liệu booking không hợp lệ: ${errorMessages}`, details: validatedFields.error.flatten().fieldErrors };
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
        package_name: validatedData.package_name || null,
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

  // 1.1 Sync package_name to customer table for data integrity
  if (validatedData.package_name) {
    await supabase
      .from('customers')
      .update({ package_name: validatedData.package_name } as any)
      .eq('id', validatedData.customer_id);
  }

  // 2. Automation: Generate session logs
  const totalSessions = validatedData.total_sessions || 21;
  const sessionLogs = Array.from({ length: totalSessions }, (_: any, i: number) => ({
    booking_id: booking.id,
    session_number: i + 1,
    status: 'scheduled',
    assigned_date: i === 0 ? (validatedData.start_date || null) : null,
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

  if (error || !data || data.length === 0) {
    console.error('Error fetching session logs or empty:', error);
    // Return mock sessions (default 15 as seen in user's UI)
    return Array.from({ length: 15 }, (_, i) => ({
      id: `mock-session-${i + 1}`,
      booking_id: bookingId,
      session_number: i + 1,
      status: 'scheduled',
      notes: '',
      completed_date: null
    }));
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

  if (error || !data || data.length === 0) {
    console.error('Error fetching sessions with details:', error);
    return DEMO_BOOKINGS;
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
          address,
          package_name
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
      package_name: resolvePackageName(s.bookings),
      start_date: ensure2026(s.bookings.start_date),
      expected_birth_date: ensure2026(s.bookings.expected_birth_date)
    } : null
  }));
}

export async function updateSessionLog(id: string, payload: any) {
  const supabase = (await createClient()) as any;
  
  const updates: any = { ...payload };
  
  // Robust null-handling for TIME and TEXT columns
  if (updates.assigned_time === "") updates.assigned_time = null;
  if (updates.notes === "") updates.notes = null;

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

export async function saveSessionNote(sessionId: string, note: string) {
  const supabase = (await createClient()) as any;
  
  const { error } = await supabase
    .from('session_logs')
    .update({ notes: note } as any)
    .eq('id', sessionId);

  if (error) {
    console.error('Error saving session note:', error);
    return { error: error.message };
  }

  revalidatePath('/dashboard/sessions');
  return { success: true };
}

export async function createSessionLog(data: any) {
  const supabase = (await createClient()) as any;
  
  // 1. Get current session number for this booking
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', data.booking_id);

  if (countError) {
    console.error('Error counting sessions:', countError);
    return { error: countError.message };
  }

  // 2. Insert new session log
  const { data: session, error } = await supabase
    .from('session_logs')
    .insert([
      {
        booking_id: data.booking_id,
        session_number: (count || 0) + 1,
        assigned_date: data.assigned_date || null,
        assigned_time: data.assigned_time || null,
        notes: data.notes || null,
        status: data.status || 'scheduled'
      } as any,
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating session log:', error);
    return { error: error.message };
  }

  revalidatePath('/dashboard/bookings');
  return { data: session };
}

export async function updateBooking(id: string, payload: any) {
  const supabase = (await createClient()) as any;
  
  const { data, error } = await supabase
    .from('bookings')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating booking:', error);
    return { error: error.message };
  }

  // Sync package_name to customer if updated
  if (payload.package_name && data.customer_id) {
    await supabase
      .from('customers')
      .update({ package_name: payload.package_name } as any)
      .eq('id', data.customer_id);
  }

  revalidatePath('/dashboard/bookings');
  revalidatePath('/dashboard/customers');
  return { data };
}

export async function reusePackage(bookingId: string) {
  const supabase = (await createClient()) as any;

  // 1. Fetch original booking
  const { data: original, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (fetchError || !original) {
    return { error: 'Không tìm thấy gói cũ: ' + fetchError?.message };
  }

  // 2. Create new booking based on original
  const bookingData: any = {
    customer_id: original.customer_id,
    booking_number: `BK-${new Date().getTime()}`,
    package_id: original.package_id,
    status: 'deposit_pending',
    full_price: original.full_price,
    deposit_amount: 0, // Reset deposit for new cycle
    total_sessions: original.total_sessions,
    completed_sessions: 0,
    start_date: new Date().toISOString().split('T')[0],
  };

  // Only include package_name if it exists in the original record
  if (original.package_name) {
    bookingData.package_name = original.package_name;
  }

  const { data: newBooking, error: createError } = await supabase
    .from('bookings')
    .insert([bookingData])
    .select()
    .single();

  if (createError) {
    // Fallback: If it's a "column not found" error for package_name, try without it
    if (createError.message?.includes('package_name')) {
      delete bookingData.package_name;
      const { data: retryBooking, error: retryError } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select()
        .single();
      
      if (retryError) return { error: 'Lỗi tạo gói mới: ' + retryError.message };
      return finalizeReuse(retryBooking, original.total_sessions, supabase);
    }
    return { error: 'Lỗi tạo gói mới: ' + createError.message };
  }

  return finalizeReuse(newBooking, original.total_sessions, supabase);
}

async function finalizeReuse(newBooking: any, total: number, supabase: any) {
  // 3. Generate new session logs
  const totalSessions = total || 21;
  const sessionLogs = Array.from({ length: totalSessions }, (_, i) => ({
    booking_id: newBooking.id,
    session_number: i + 1,
    status: 'scheduled',
    assigned_date: i === 0 ? newBooking.start_date : null,
  }));

  const { error: sessionsError } = await supabase
    .from('session_logs')
    .insert(sessionLogs as any);

  if (sessionsError) {
    return { error: 'Đã tạo gói mới nhưng lỗi khởi tạo lịch trình: ' + sessionsError.message };
  }

  revalidatePath('/dashboard/sessions');
  revalidatePath('/dashboard/bookings');
  return { data: newBooking };
}
