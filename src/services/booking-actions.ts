'use server';

import { ensure2026 } from '@/lib/utils';
import { DEMO_BOOKINGS, DEMO_SESSIONS } from '@/constants/demo-data';
import { MOCK_SERVICES } from '@/constants/mock-data';
import { safeRevalidatePath } from '@/lib/revalidate';

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
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(name_mother, phone)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bookings:', error);
    return []; // Return empty array on error
  }
  
  if (!data || data.length === 0) {
    return []; // Return empty array if no bookings exist
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
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  // 0. Validate with Zod
  const validatedFields = bookingSchema.safeParse(formData);
  
  if (!validatedFields.success) {
    const errorMessages = Object.values(validatedFields.error.flatten().fieldErrors).flat().join(', ');
    return { error: `Dữ liệu booking không hợp lệ: ${errorMessages}`, details: validatedFields.error.flatten().fieldErrors };
  }

  const validatedData = validatedFields.data;

  // 1. Check for existing "pending" or "deposit" booking for this customer to avoid duplicates
  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', validatedData.customer_id)
    .in('status', ['deposit_pending', 'lead'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let booking;
  let bookingError;

  const bookingPayload: any = {
    customer_id: validatedData.customer_id,
    booking_number: existingBooking?.booking_number || `BK-${new Date().getTime()}`,
    package_id: validatedData.package_id || null,
    package_name: validatedData.package_name || null,
    status: 'deposit_pending',
    full_price: validatedData.full_price,
    deposit_amount: validatedData.deposit_amount,
    total_sessions: validatedData.total_sessions,
    start_date: validatedData.start_date || null,
    assigned_ktv_id: formData.assigned_ktv_id || null,
  };

  if (existingBooking) {
    // Update existing
    const { data: updated, error } = await supabase
      .from('bookings')
      .update(bookingPayload)
      .eq('id', existingBooking.id)
      .select()
      .single();
    booking = updated;
    bookingError = error;
  } else {
    // Insert new
    const { data: inserted, error } = await supabase
      .from('bookings')
      .insert([bookingPayload])
      .select()
      .single();
    booking = inserted;
    bookingError = error;
  }

  if (bookingError) {
    // Fallback: If it's a "column not found" error for package_name or "type mismatch" for package_id
    if (bookingError.message?.includes('package_name') || bookingError.message?.includes('package_id') || bookingError.message?.includes('uuid')) {
      const { package_name, package_id, ...retryPayload } = bookingPayload;
      
      const { data: retryBooking, error: retryError } = existingBooking 
        ? await supabase.from('bookings').update(retryPayload).eq('id', existingBooking.id).select().single()
        : await supabase.from('bookings').insert([retryPayload]).select().single();
      
      if (retryError) {
        console.error('Error creating booking (retry):', retryError);
        return { error: retryError.message };
      }
      booking = retryBooking;
    } else {
      console.error('Error creating booking:', bookingError);
      return { error: bookingError.message };
    }
  }

  // 2. Automation: Generate session logs (only if they don't exist yet for this booking)
  const { count: existingLogsCount } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', booking.id);

  if (!existingLogsCount || existingLogsCount === 0) {
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
      return { error: 'Booking created but session logs failed: ' + sessionsError.message };
    }
  }

  await safeRevalidatePath('/dashboard/bookings');
  await safeRevalidatePath('/dashboard/customers');
  await safeRevalidatePath('/dashboard');
  return { data: booking };
}

export async function getDraftBooking(customerId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(name_mother, phone, address)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  
  // A "draft" is either deposit_pending or has 0 completed sessions
  const b = data[0];
  if (b.status === 'deposit_pending' || b.completed_sessions === 0) {
    return b;
  }
  
  return null;
}

export async function getSessionLogs(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
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
  const { createClient } = await import('@/lib/supabase-server');
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

  // 2. Re-calculate actual completed sessions to avoid race conditions
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  if (countError) {
    console.error('Error counting completed sessions:', countError);
    return { error: countError.message };
  }

  // 3. Update booking with actual count
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ completed_sessions: count || 0 } as any)
    .eq('id', bookingId);

  if (updateError) {
    console.error('Error updating booking progress:', updateError);
    return { error: updateError.message };
  }

  await safeRevalidatePath('/dashboard/sessions');
  await safeRevalidatePath('/dashboard/bookings');
  await safeRevalidatePath('/dashboard/customers');
  await safeRevalidatePath('/dashboard');
  
  return { success: true };
}

export async function getSessionsWithDetails() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(id, name_mother, phone), session_logs(id, booking_id, session_number, assigned_date, assigned_time, completed_date, status, notes)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions with details:', error);
    return []; // Return empty array on error instead of demo data to avoid confusion
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  const { MOCK_CUSTOMERS } = await import('@/constants/mock-data');
  
  return (data || []).map((b: any) => {
    const sortedLogs = (b.session_logs || []).sort((a: any, b2: any) => (a.session_number || 0) - (b2.session_number || 0));
    const nextSession = sortedLogs.find((s: any) => s.status === 'scheduled');
    
    // Fallback for customer data if join fails
    let customerData = b.customers;
    if (!customerData && b.customer_id) {
      const mockCustomer = MOCK_CUSTOMERS.find(c => c.id === b.customer_id);
      if (mockCustomer) {
        customerData = {
          name_mother: mockCustomer.name_mother,
          phone: mockCustomer.phone
        };
      }
    }

    return {
      ...b,
      customers: customerData || { name_mother: 'Khách hàng Bella Spa', phone: '---' },
      next_session_date: nextSession?.assigned_date || null,
      start_date: ensure2026(b.start_date),
      end_date: ensure2026(b.end_date),
      expected_birth_date: ensure2026(b.expected_birth_date)
    };
  });
}

export async function getCalendarSessions() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { data, error } = await supabase
    .from('session_logs')
    .select(`
      *,
      bookings!inner (
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
      package_name: resolvePackageName(s.bookings),
      start_date: ensure2026(s.bookings.start_date),
      expected_birth_date: ensure2026(s.bookings.expected_birth_date)
    } : null
  }));
}

export async function updateSessionLog(id: string, payload: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const updates: any = { ...payload };
  
  // Robust null-handling for DATE, TIME and TEXT columns
  if (updates.assigned_date === "" || updates.assigned_date === "dd/mm/yyyy") updates.assigned_date = null;
  if (updates.assigned_time === "" || updates.assigned_time === "--:-- --") updates.assigned_time = null;
  if (updates.notes === "") updates.notes = null;

  // Only send columns that exist in session_logs table
  const allowedColumns = ['assigned_date', 'completed_date', 'completed_by_ktv_id', 'address', 'status', 'notes', 'assigned_time'];
  const safeUpdates: any = {};
  for (const key of allowedColumns) {
    if (key in updates) {
      safeUpdates[key] = updates[key];
    }
  }

  // 1. Fetch the log to get booking_id if not provided
  const { data: logData, error: logError } = await supabase
    .from('session_logs')
    .select('booking_id')
    .eq('id', id)
    .single();

  if (logError) return { error: logError.message };
  const bookingId = logData.booking_id;

  // 2. Update the log
  const { data, error } = await supabase
    .from('session_logs')
    .update(safeUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating session log:', error);
    return { error: error.message };
  }

  // 3. Recalculate and sync completed_sessions for the booking
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  if (!countError) {
    await supabase
      .from('bookings')
      .update({ completed_sessions: count || 0 } as any)
      .eq('id', bookingId);
  }

  await safeRevalidatePath('/dashboard/bookings');
  await safeRevalidatePath('/dashboard/sessions');
  await safeRevalidatePath('/dashboard/customers');
  return { data };
}

export async function saveSessionNote(sessionId: string, note: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { error } = await supabase
    .from('session_logs')
    .update({ notes: note } as any)
    .eq('id', sessionId);

  if (error) {
    console.error('Error saving session note:', error);
    return { error: error.message };
  }

  await safeRevalidatePath('/dashboard/sessions');
  return { success: true };
}

export async function addExtraSession(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  // 1. Get current sessions count
  const { data, error: fetchError } = await supabase
    .from('bookings')
    .select('total_sessions')
    .eq('id', bookingId)
    .single();

  if (fetchError) return { error: fetchError.message };
  
  const newTotal = (data.total_sessions || 0) + 1;
  
  // 2. Update booking total
  await supabase.from('bookings').update({ total_sessions: newTotal } as any).eq('id', bookingId);
  
  // 3. Insert new log
  await supabase.from('session_logs').insert({
    booking_id: bookingId,
    session_number: newTotal,
    status: 'scheduled'
  } as any);
  
  await safeRevalidatePath('/dashboard/sessions');
  return { success: true };
}

export async function createSessionLog(data: any) {
  const { createClient } = await import('@/lib/supabase-server');
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

  await safeRevalidatePath('/dashboard/bookings');
  return { data: session };
}

export async function updateBooking(id: string, payload: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { data, error } = await supabase
    .from('bookings')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // Fallback: If it's a "column not found" error for package_name or "type mismatch" for package_id
    if (error.message?.includes('package_name') || error.message?.includes('package_id') || error.message?.includes('uuid')) {
      const { package_name, package_id, ...retryPayload } = payload;
      const { data: retryData, error: retryError } = await supabase
        .from('bookings')
        .update(retryPayload)
        .eq('id', id)
        .select()
        .single();
      
      if (retryError) {
        console.error('Error updating booking (retry):', retryError);
        return { error: retryError.message };
      }
      return { data: retryData };
    }

    console.error('Error updating booking:', error);
    return { error: error.message };
  }

  await safeRevalidatePath('/dashboard/bookings');
  await safeRevalidatePath('/dashboard/customers');
  return { data };
}

export async function reusePackage(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
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

  await safeRevalidatePath('/dashboard/sessions');
  await safeRevalidatePath('/dashboard/bookings');
  return { data: newBooking };
}
