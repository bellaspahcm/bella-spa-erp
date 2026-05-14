'use server';

import { ensure2026 } from '@/lib/utils';
import { DEMO_BOOKINGS, DEMO_SESSIONS } from '@/constants/demo-data';
import { MOCK_SERVICES } from '@/constants/mock-data';
import { safeRevalidatePath } from '@/lib/revalidate';
import { bookingSchema } from '@/lib/validations';

/**
 * Helper to resolve package name from booking data
 */
export function resolvePackageName(booking: any): string {
  if (booking?.package_name) return booking.package_name;
  
  const price = Number(booking?.full_price);
  const matchedService = MOCK_SERVICES.find(s => {
    const sPrice = parseInt(s.price.replace(/[^\d]/g, ''));
    return sPrice === price;
  });

  return matchedService?.name || 'Dịch vụ lẻ';
}

function resolveKtvCommission(booking: any): number {
  if (booking?.ktv_commission) return Number(booking.ktv_commission);
  
  const price = Number(booking?.full_price);
  const matchedService = MOCK_SERVICES.find(s => {
    const sPrice = parseInt(s.price.replace(/[^\d]/g, ''));
    return sPrice === price;
  });

  return matchedService?.ktv_commission || 150000; // Default fallback
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
    return [];
  }
  
  if (!data || data.length === 0) return [];
  
  return (data || []).map((b: any) => ({
    ...b,
    package_name: resolvePackageName(b),
    start_date: ensure2026(b.start_date),
    end_date: ensure2026(b.end_date),
    expected_birth_date: ensure2026(b.expected_birth_date)
  }));
}

export async function getBookingsByCustomerId(customerId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('bookings')
    .select('*, assigned_ktv:users!bookings_assigned_ktv_id_fkey(full_name)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bookings by customer ID:', error);
    return [];
  }
  
  if (!data || data.length === 0) return [];
  
  // Hardening: Verify session counts match session_logs truth
  const enrichedData = await Promise.all(data.map(async (b: any) => {
    const { count, error: countError } = await supabase
      .from('session_logs')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', b.id)
      .eq('status', 'completed');

    if (!countError && count !== null && count !== b.completed_sessions) {
      console.log(`Syncing completed_sessions for booking ${b.id}: ${b.completed_sessions} -> ${count}`);
      await supabase
        .from('bookings')
        .update({ completed_sessions: count })
        .eq('id', b.id);
      b.completed_sessions = count;
    }

    return {
      ...b,
      package_name: resolvePackageName(b),
      start_date: ensure2026(b.start_date),
      expected_birth_date: ensure2026(b.expected_birth_date)
    };
  }));

  return enrichedData;
}


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

  const { getCurrentUser } = await import('./user-actions');
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';

  const isFullBooking = validatedData.full_price > 0 || !!validatedData.package_name;
  
  // Resolve commission at time of booking to "lock" it
  const lockedCommission = validatedData.ktv_commission || resolveKtvCommission(validatedData);
  
  const bookingPayload: any = {
    customer_id: validatedData.customer_id,
    booking_number: existingBooking?.booking_number || `BK-${new Date().getTime()}`,
    package_id: validatedData.package_id || null,
    package_name: validatedData.package_name || null,
    status: isFullBooking ? 'booked' : 'deposit_pending',
    full_price: validatedData.full_price,
    deposit_amount: (existingBooking?.deposit_amount || 0) + (validatedData.deposit_amount || 0),
    total_sessions: validatedData.total_sessions,
    ktv_commission: lockedCommission, // Locked rate
    start_date: validatedData.start_date || null,
    assigned_ktv_id: validatedData.assigned_ktv_id || null,
    tenant_id: tenantId
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
    // Fallback: If it's a "column not found" error for package_name or "type mismatch" for package_id or ktv_commission
    if (bookingError.message?.includes('package_name') || 
        bookingError.message?.includes('package_id') || 
        bookingError.message?.includes('uuid') ||
        bookingError.message?.includes('ktv_commission')) {
      const { package_name, package_id, ktv_commission, ...retryPayload } = bookingPayload;
      
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

  // Record revenue for the deposit if any
  if (validatedData.deposit_amount > 0 && booking?.id) {
    const { error: revError } = await supabase
      .from('revenue')
      .insert([{
        booking_id: booking.id,
        amount: validatedData.deposit_amount,
        revenue_type: 'deposit',
        payment_method: 'bank_transfer',
        received_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        notes: `Cọc gói ${resolvePackageName(booking)}`,
        tenant_id: tenantId
      }]);
    
    if (revError) console.error('Error recording initial deposit revenue:', revError);
  }

  // 2. Automation: Generate session logs (only if they don't exist yet for this booking)
  const { count: existingLogsCount } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', booking.id);

  if (!existingLogsCount || existingLogsCount === 0) {
    const totalSessions = validatedData.total_sessions || 15;
    let startDateStr = validatedData.start_date;
    
    if (!startDateStr) {
      const now = new Date();
      // Adjust to VN timezone (UTC+7) or just use local server time parts
      // To be safe for VN, we can add 7 hours if we are on a UTC server
      // But usually local date is better
      startDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    
    const sessionLogs = Array.from({ length: totalSessions }, (_: any, i: number) => {
      // Safely add days using local date parts
      const [y, m, d] = startDateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + i);
      
      const assignedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      return {
        booking_id: booking.id,
        session_number: i + 1,
        status: 'scheduled',
        assigned_date: assignedDate,
        tenant_id: tenantId
      };
    });

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
  await safeRevalidatePath(`/dashboard/customers/${validatedData.customer_id}`);
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

  // 1. Get current booking to check assigned KTV
  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .select('assigned_ktv_id')
    .eq('id', bookingId)
    .single();

  if (bookingError || !bookingData) {
    return { error: 'Không tìm thấy thông tin booking liên quan.' };
  }

  if (!bookingData.assigned_ktv_id) {
    return { error: 'Chưa phân công KTV chính. Vui lòng phân công KTV trước khi xác nhận hoàn thành buổi.' };
  }

  // 2. Update session log status with KTV snapshot
  const { error: sessionError } = await supabase
    .from('session_logs')
    .update({ 
      status: 'completed',
      completed_date: new Date().toISOString(),
      completed_by_ktv_id: bookingData.assigned_ktv_id // Snapshot the main KTV at the time of completion
    } as any)
    .eq('id', sessionId);

  if (sessionError) {
    console.error('Error completing session:', sessionError);
    return { error: sessionError.message };
  }

  const today = new Date().toISOString().split('T')[0];

  // 3. Re-calculate actual completed sessions to avoid race conditions
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  if (countError) {
    console.error('Error counting completed sessions:', countError);
    return { error: countError.message };
  }

  // 4. Update booking with actual count and status transition
  const { data: currentBooking } = await supabase.from('bookings').select('total_sessions, status').eq('id', bookingId).single();
  
  const updates: any = { 
    completed_sessions: count || 0,
    last_updated_date: today,
    updated_at: new Date().toISOString()
  };
  
  if (count > 0 && (currentBooking?.status === 'deposit_pending' || currentBooking?.status === 'booked' || currentBooking?.status === 'deposit')) {
    updates.status = 'active';
  }
  
  if (currentBooking?.total_sessions && count >= currentBooking.total_sessions) {
    updates.status = 'completed';
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId);

  if (updateError) {
    console.error('Error updating booking progress:', updateError);
    return { error: updateError.message };
  }

  // 6. Create a pending review for the customer to fill out
  try {
    const { data: bookingDetails } = await supabase
      .from('bookings')
      .select('customer_id, assigned_ktv_id')
      .eq('id', bookingId)
      .single();

    if (bookingDetails) {
      await supabase
        .from('session_reviews')
        .insert([{
          session_log_id: sessionId,
          reviewer_id: null, // To be linked to customer auth user later
          ktv_id: bookingDetails.assigned_ktv_id,
          rating: 0, // Placeholder
          status: 'pending_review',
          tenant_id: currentBooking?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e'
        } as any]);
    }
  } catch (reviewErr) {
    console.error('Error creating pending review:', reviewErr);
    // Non-blocking error
  }

  return { success: true };
}

export async function getSessionsWithDetails() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { getCurrentUser } = await import('./user-actions');
  const currentUser = await getCurrentUser();

  let query = supabase
    .from('bookings')
    .select(`
      *, 
      customers(id, name_mother, name_baby, phone), 
      assigned_ktv:users!bookings_assigned_ktv_id_fkey(full_name),
      session_logs(id, booking_id, session_number, assigned_date, assigned_time, completed_date, status, notes, ktv:users!session_logs_completed_by_ktv_id_fkey(full_name))
    `)
    .order('created_at', { ascending: false });

  // If KTV, only show bookings where they are assigned
  if (currentUser?.role === 'ktv') {
    query = query.eq('assigned_ktv_id', currentUser.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching sessions with details:', error);
    return []; 
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  const { MOCK_CUSTOMERS } = await import('@/constants/mock-data');
  
  const enrichedData = await Promise.all((data || []).map(async (b: any) => {
    // Hardening: Verify session counts match session_logs truth
    const { count, error: countError } = await supabase
      .from('session_logs')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', b.id)
      .eq('status', 'completed');

    if (!countError && count !== null && count !== b.completed_sessions) {
      console.log(`Syncing completed_sessions for booking ${b.id} in details: ${b.completed_sessions} -> ${count}`);
      await supabase
        .from('bookings')
        .update({ completed_sessions: count })
        .eq('id', b.id);
      b.completed_sessions = count;
    }

    const sortedLogs = (b.session_logs || []).sort((a: any, b2: any) => (a.session_number || 0) - (b2.session_number || 0));
    
    // Predictive logic
    let lastKnownDate = b.start_date;
    let lastKnownSessionNum = 1;

    const mappedLogs = sortedLogs.map((s: any) => {
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

    const nextSession = mappedLogs.find((s: any) => s.status === 'scheduled');
    
    // Fallback for customer data
    let customerData = b.customers;
    if (!customerData && b.customer_id) {
      const mockCustomer = MOCK_CUSTOMERS.find(c => c.id === b.customer_id);
      if (mockCustomer) {
        customerData = {
          name_mother: mockCustomer.name_mother,
          name_baby: mockCustomer.name_baby,
          phone: mockCustomer.phone
        };
      }
    }

    return {
      ...b,
      package_name: resolvePackageName(b),
      session_logs: mappedLogs,
      customers: customerData || { name_mother: 'Khách hàng Bella Spa', phone: '---' },
      assigned_ktv_name: b.assigned_ktv?.full_name || 'Chưa phân công',
      next_session_date: nextSession?.assigned_date || null,
      start_date: ensure2026(b.start_date),
      end_date: ensure2026(b.end_date),
      expected_birth_date: ensure2026(b.expected_birth_date)
    };
  }));

  return enrichedData;
}

export async function getCalendarSessions() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { getCurrentUser } = await import('./user-actions');
  const currentUser = await getCurrentUser();

  let query = supabase
    .from('session_logs')
    .select(`
      *,
      bookings (
        *,
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

  // If KTV, only show sessions for their assigned bookings
  if (currentUser?.role === 'ktv') {
    query = query.eq('bookings.assigned_ktv_id', currentUser.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching calendar sessions:', error);
    return [];
  }
  
  // Predictive Date Calculation
  const sessionsByBooking: Record<string, any[]> = {};
  (data || []).forEach((s: any) => {
    if (!s.booking_id) return;
    if (!sessionsByBooking[s.booking_id]) sessionsByBooking[s.booking_id] = [];
    sessionsByBooking[s.booking_id].push(s);
  });

  const processedSessionsList = await Promise.all(Object.entries(sessionsByBooking).map(async ([bookingId, bookingSessions]) => {
    bookingSessions.sort((a, b) => a.session_number - b.session_number);
    
    // Hardening: Verify session counts match session_logs truth (ONCE PER BOOKING)
    const firstSession = bookingSessions[0];
    if (firstSession?.bookings) {
      const { count, error: countError } = await supabase
        .from('session_logs')
        .select('*', { count: 'exact', head: true })
        .eq('booking_id', bookingId)
        .eq('status', 'completed');

      if (!countError && count !== null && count !== firstSession.bookings.completed_sessions) {
        await supabase.from('bookings').update({ completed_sessions: count }).eq('id', bookingId);
        // Update all local references for this booking
        bookingSessions.forEach(s => { if (s.bookings) s.bookings.completed_sessions = count; });
      }
    }

    let lastKnownDate: string | null = null;
    let lastKnownSessionNum = 0;
    const bookingResult: any[] = [];

    for (const s of bookingSessions) {
      let finalDate = s.assigned_date;
      
      if (!finalDate) {
        if (lastKnownDate) {
          const [y, m, d] = lastKnownDate.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (s.session_number - lastKnownSessionNum));
          finalDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } else if (s.bookings?.start_date) {
          const [y, m, d] = s.bookings.start_date.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (s.session_number - 1));
          finalDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
      }

      if (finalDate) {
        lastKnownDate = finalDate;
        lastKnownSessionNum = s.session_number;
      }

      bookingResult.push({
        ...s,
        assigned_date: ensure2026(finalDate),
        completed_date: ensure2026(s.completed_date),
        bookings: s.bookings ? {
          ...s.bookings,
          package_name: resolvePackageName(s.bookings),
          start_date: ensure2026(s.bookings.start_date),
          completed_sessions: s.bookings.completed_sessions,
          expected_birth_date: ensure2026(s.bookings.expected_birth_date)
        } : null
      });
    }
    return bookingResult;
  }));

  return processedSessionsList.flat();
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
    const { data: currentBooking } = await supabase.from('bookings').select('total_sessions, status').eq('id', bookingId).single();
    const today = new Date().toISOString().split('T')[0];
    const bUpdates: any = { 
      completed_sessions: count || 0,
      last_updated_date: today,
      updated_at: new Date().toISOString()
    };
    
    if (count > 0 && (currentBooking?.status === 'deposit_pending' || currentBooking?.status === 'booked' || currentBooking?.status === 'deposit')) {
      bUpdates.status = 'active';
    }
    
    if (currentBooking?.total_sessions && count >= currentBooking.total_sessions) {
      bUpdates.status = 'completed';
    }

    await supabase
      .from('bookings')
      .update(bUpdates)
      .eq('id', bookingId);
  }

  // 4. Fetch customer_id for specific revalidation
  const { data: customerData } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('id', bookingId)
    .single();

  await safeRevalidatePath('/dashboard/bookings');
  await safeRevalidatePath('/dashboard/sessions');
  await safeRevalidatePath('/dashboard/customers');
  
  if (customerData?.customer_id) {
    await safeRevalidatePath(`/dashboard/customers/${customerData.customer_id}`);
  }

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

  // Get booking_id to find customer_id for revalidation
  const { data: logData } = await supabase
    .from('session_logs')
    .select('booking_id')
    .eq('id', sessionId)
    .single();

  if (logData?.booking_id) {
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('customer_id')
      .eq('id', logData.booking_id)
      .single();

    if (bookingData?.customer_id) {
      await safeRevalidatePath(`/dashboard/customers/${bookingData.customer_id}`);
    }
  }

  await safeRevalidatePath('/dashboard/sessions');
  await safeRevalidatePath('/dashboard/customers');
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
  
  // Get customer_id for revalidation
  const { data: bookingData } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('id', bookingId)
    .single();

  await safeRevalidatePath('/dashboard/sessions');
  if (bookingData?.customer_id) {
    await safeRevalidatePath(`/dashboard/customers/${bookingData.customer_id}`);
  }
  
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
  
  // Also revalidate the specific customer page to ensure the treatment card updates
  const { data: bookingData } = await supabase.from('bookings').select('customer_id').eq('id', id).single();
  if (bookingData?.customer_id) {
    await safeRevalidatePath(`/dashboard/customers/${bookingData.customer_id}`);
  }

  return { data };
}

/**
 * Ensures the completed_sessions count in the bookings table matches the actual count of completed logs.
 */
export async function syncBookingProgress(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  
  // 1. Get current count from logs
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  if (countError) return { error: countError.message };

  // 2. Get current header value
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('completed_sessions')
    .eq('id', bookingId)
    .single();

  if (fetchError) return { error: fetchError.message };

  // 3. Update if discrepancy found
  if (booking.completed_sessions !== count) {
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ completed_sessions: count })
      .eq('id', bookingId);
    
    if (updateError) return { error: updateError.message };
    return { synced: true, newCount: count };
  }

  return { synced: false, count };
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
  let startDateStr = newBooking.start_date;
  if (!startDateStr) {
    const now = new Date();
    startDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  
  const sessionLogs = Array.from({ length: totalSessions }, (_, i) => {
    const [y, m, d] = startDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + i);
    const assignedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return {
      booking_id: newBooking.id,
      session_number: i + 1,
      status: 'scheduled',
      assigned_date: assignedDate,
    };
  });

  const { error: sessionsError } = await supabase
    .from('session_logs')
    .insert(sessionLogs as any);

  if (sessionsError) {
    return { error: 'Đã tạo gói mới nhưng lỗi khởi tạo lịch trình: ' + sessionsError.message };
  }

  await safeRevalidatePath('/dashboard/sessions');
  await safeRevalidatePath('/dashboard/bookings');
  await safeRevalidatePath(`/dashboard/customers/${newBooking.customer_id}`);
  return { data: newBooking };
}

/**
 * Records a remaining payment for a booking
 */
export async function recordRemainingPayment(params: {
  booking_id: string;
  customer_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
  receipt_url?: string;
}) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

  try {
    // 1. Record the revenue
    const { error: revError } = await supabase
      .from('revenue')
      .insert([{
        booking_id: params.booking_id,
        amount: params.amount,
        revenue_type: 'remaining_payment',
        payment_method: params.payment_method,
        received_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        notes: params.notes || `Thanh toán nốt phần còn lại.`,
        receipt_url: params.receipt_url || null
      }]);

    if (revError) {
      console.error('Error recording revenue:', revError);
    }

    // 2. Update the booking's deposit_amount (summing it up)
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('deposit_amount, full_price, status')
      .eq('id', params.booking_id)
      .single();

    if (fetchError) throw fetchError;

    const newTotalPaid = (booking.deposit_amount || 0) + params.amount;
    
    // Determine new status - If paid in full, change from deposit_pending to booked/active
    let newStatus = booking.status;
    if (newTotalPaid >= booking.full_price && (booking.status === 'deposit_pending' || booking.status === 'deposit')) {
      newStatus = 'booked';
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        deposit_amount: newTotalPaid,
        status: newStatus
      })
      .eq('id', params.booking_id);

    if (updateError) throw updateError;

    // 3. Revalidate the customer page
    await safeRevalidatePath(`/dashboard/customers/${params.customer_id}`);
    await safeRevalidatePath('/dashboard/finance');

    return { success: true };
  } catch (error: any) {
    console.error('Error recording remaining payment:', error);
    return { error: error.message };
  }
}

/**
 * Reschedules a session and shifts all subsequent scheduled sessions accordingly
 */
export async function rescheduleSession(sessionId: string, newDate: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

  // 1. Fetch the session to find its booking and current date
  const { data: session, error: sessionError } = await supabase
    .from('session_logs')
    .select('booking_id, assigned_date, session_number, status')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return { error: 'Không tìm thấy buổi cần dời lịch.' };
  }

  if (session.status === 'completed') {
    return { error: 'Không thể dời lịch cho buổi đã hoàn thành.' };
  }

  const bookingId = session.booking_id;
  const oldDateStr = session.assigned_date;
  
  // If we don't have an old date, we use the new date as a base (which won't shift anything)
  // or we try to find it from the booking start_date.
  let effectiveOldDateStr = oldDateStr;
  if (!effectiveOldDateStr) {
    const { data: booking } = await supabase.from('bookings').select('start_date').eq('id', bookingId).single();
    if (booking?.start_date) {
      const bDate = new Date(booking.start_date);
      bDate.setDate(bDate.getDate() + (session.session_number - 1));
      effectiveOldDateStr = bDate.toISOString().split('T')[0];
    } else {
      effectiveOldDateStr = newDate;
    }
  }

  // 2. Calculate the day difference
  const oldDate = new Date(effectiveOldDateStr);
  const targetDate = new Date(newDate);
  
  // Reset time to midnight for accurate day comparison
  oldDate.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - oldDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { success: true };

  // 3. Find all scheduled sessions for this booking starting from this session number
  const { data: futureSessions, error: futureError } = await supabase
    .from('session_logs')
    .select('id, session_number, assigned_date')
    .eq('booking_id', bookingId)
    .eq('status', 'scheduled')
    .gte('session_number', session.session_number)
    .order('session_number', { ascending: true });

  if (futureError) {
    return { error: futureError.message };
  }

  // 4. Update each session with the new shifted date
  const updates = futureSessions.map((s: any) => {
    let currentAssignedDate = s.assigned_date;
    
    // If no assigned date, calculate what it SHOULD have been
    if (!currentAssignedDate) {
      const baseDate = new Date(effectiveOldDateStr);
      baseDate.setDate(baseDate.getDate() + (s.session_number - session.session_number));
      currentAssignedDate = baseDate.toISOString().split('T')[0];
    }

    const baseDate = new Date(currentAssignedDate);
    baseDate.setDate(baseDate.getDate() + diffDays);
    const newAssignedDate = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;

    return supabase
      .from('session_logs')
      .update({ assigned_date: newAssignedDate } as any)
      .eq('id', s.id);
  });

  const results = await Promise.all(updates);
  const hasError = results.some(r => r.error);
  if (hasError) {
    return { error: 'Có lỗi xảy ra khi cập nhật một số buổi học.' };
  }

  // 5. Revalidate paths
  const { data: bookingData } = await supabase.from('bookings').select('customer_id').eq('id', bookingId).single();
  
  await safeRevalidatePath('/dashboard/bookings');
  await safeRevalidatePath('/dashboard/sessions');
  if (bookingData?.customer_id) {
    await safeRevalidatePath(`/dashboard/customers/${bookingData.customer_id}`);
  }

  return { success: true };
}
