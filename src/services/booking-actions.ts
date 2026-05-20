'use server';

import { resolvePackageName, getLocalDateString } from '@/lib/utils';


import { safeRevalidatePath } from '@/lib/revalidate';
import { bookingSchema } from '@/lib/validations';



export async function getPackages() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching packages:', error);
    return [];
  }
  return data || [];
}

function resolveKtvCommission(booking: any): number {
  if (booking?.ktv_commission) return Number(booking.ktv_commission);
  if (booking?.packages?.ktv_commission) return Number(booking.packages.ktv_commission);
  return 150000; // Default fallback
}

export async function getBookings() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(name_mother, phone), packages!bookings_package_id_fkey(name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }
  
  if (!data || data.length === 0) return [];
  
  return (data || []).map((b: any) => ({
    ...b,
    package_name: resolvePackageName(b),
    start_date: b.start_date,
    end_date: b.end_date,
    expected_birth_date: b.expected_birth_date
  }));
}

export async function getBookingsByCustomerId(customerId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *, 
      assigned_ktv:users!bookings_assigned_ktv_id_fkey(full_name, phone), 
      packages!bookings_package_id_fkey(name),
      session_logs(
        *,
        completed_by_ktv:users!session_logs_completed_by_ktv_id_fkey(full_name, phone)
      ),
      revenue(
        *,
        recorded_by:users!revenue_recorded_by_id_fkey(full_name)
      )
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bookings by customer ID:', error);
    return [];
  }
  
  if (!data || data.length === 0) return [];
  
  // NOTE: Logic đồng bộ completed_sessions thủ công đã được thay thế bằng Database Trigger
  return (data || []).map((b: any) => ({
    ...b,
    package_name: resolvePackageName(b),
    start_date: b.start_date,
    expected_birth_date: b.expected_birth_date
  }));
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

  // 0.5. Support atomic customer creation for new customers
  if (validatedData.customer_id === 'new' && formData.newCustomer) {
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .insert([formData.newCustomer])
      .select()
      .single();
      
    if (custError) {
      console.error('Error creating customer inside createBooking:', custError);
      return { error: 'Lỗi khi tạo khách hàng: ' + custError.message };
    }
    
    validatedData.customer_id = customer.id;

    // Log audit for customer
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'customers',
        record_id: customer.id,
        new_data: customer
      });
    } catch (auditErr) {
      console.warn('Failed to record customer audit log in createBooking:', auditErr);
    }
  }

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

  // Strategy: resolve tenant_id via 3-level fallback
  // Level 1: getCurrentUser() via session (standard path)
  // Level 2: direct auth.getUser() + DB lookup by email (when session refresh fails)
  // Level 3: DEFAULT_TENANT_ID fallback (dev/emergency fallback)

  let tenantId: string | null = null;
  let userEmail: string | null = null;
  let isLoggedIn = false;

  // Level 1: Try getCurrentUser() (needs working middleware)
  const currentUser = await getCurrentUser();
  if (currentUser) {
    isLoggedIn = true;
    if (currentUser.tenant_id) {
      tenantId = currentUser.tenant_id;
      userEmail = currentUser.email;
      console.log('[createBooking] Level1 resolved tenant:', tenantId);
    }
  }

  // Level 2: Direct auth user lookup
  if (!tenantId) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      isLoggedIn = true;
      userEmail = authUser.email ?? null;
      console.log('[createBooking] Level2 authUser:', authUser.email, '| id:', authUser.id);
      // Lookup by ID first, then email
      const { data: userProfile } = await supabase
        .from('users')
        .select('tenant_id, email')
        .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
        .limit(1)
        .single();
      if (userProfile?.tenant_id) {
        tenantId = userProfile.tenant_id;
        console.log('[createBooking] Level2 resolved tenant via DB:', tenantId);
      }
    }
  }

  // Level 3: Fallback for Guest Bookings (Landing Page)
  if (!tenantId) {
    if (isLoggedIn) {
      return { error: 'Unauthorized: Tenant ID is required for logged in users.' };
    }
    tenantId = process.env.DEFAULT_TENANT_ID || null;
    if (!tenantId) {
      return { error: 'System Error: DEFAULT_TENANT_ID is not configured for guest bookings.' };
    }
    console.warn('[createBooking] Level3 DEFAULT_TENANT_ID fallback used for guest booking.');
  }

  console.log('[createBooking] Final tenantId:', tenantId, '| user:', userEmail);


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
    discount_percent: validatedData.discount_percent || 0,
    start_date: validatedData.start_date || null,
    assigned_ktv_id: validatedData.assigned_ktv_id || null,
    preferred_time: validatedData.preferred_time || null,
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

    if (!error && updated) {
      try {
        const { recordAuditLog } = await import('./audit-actions');
        await recordAuditLog({
          action: 'UPDATE',
          table_name: 'bookings',
          record_id: existingBooking.id,
          old_data: existingBooking,
          new_data: bookingPayload
        });
      } catch (auditErr) {
        console.warn('Failed to record createBooking update audit log:', auditErr);
      }
    }
  } else {
    // Insert new
    const { data: inserted, error } = await supabase
      .from('bookings')
      .insert([bookingPayload])
      .select()
      .single();
    booking = inserted;
    bookingError = error;

    if (!error && inserted) {
      try {
        const { recordAuditLog } = await import('./audit-actions');
        await recordAuditLog({
          action: 'INSERT',
          table_name: 'bookings',
          record_id: inserted.id,
          new_data: inserted
        });
      } catch (auditErr) {
        console.warn('Failed to record createBooking insert audit log:', auditErr);
      }
    }
  }

  if (bookingError) {
    console.error('Error creating booking:', bookingError);
    return { error: bookingError.message };
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
        received_date: getLocalDateString(),
        status: 'confirmed', // Always confirm initial deposit if recorded
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
        assigned_time: validatedData.preferred_time || null,
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

  // 3. Revalidate paths in parallel to maximize performance
  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions',
    '/dashboard/customers',
    `/dashboard/customers/${validatedData.customer_id}`,
    '/dashboard',
    '/dashboard/finance'
  ];
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

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
  
  // A "draft" is only a booking that is in 'deposit_pending' or 'lead' status, NOT a fully confirmed 'booked' package.
  const b = data[0];
  if (b.status === 'deposit_pending' || b.status === 'lead') {
    return b;
  }
  
  return null;
}

export async function getSessionLogs(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('session_logs')
    .select('*, ktv:users!session_logs_completed_by_ktv_id_fkey(full_name)')
    .eq('booking_id', bookingId)
    .order('session_number', { ascending: true });

  if (error || !data || data.length === 0) {
    return [];
  }

  return data;
}

export async function completeSession(sessionId: string, bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { getCurrentUser } = await import('./user-actions');
  const currentUser = await getCurrentUser();

  // 0. Security Check
  const { data: existingLog } = await supabase
    .from('session_logs')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (currentUser?.role?.toLowerCase() !== 'admin' && !['scheduled', 'in_progress'].includes(existingLog?.status)) {
    return { error: 'Bạn không có quyền thực hiện thao tác này (Unauthorized)' };
  }

  // 1. Get current booking to check assigned KTV and package
  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .select('assigned_ktv_id, package_id')
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
      completed_date: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date()),
      completed_by_ktv_id: bookingData.assigned_ktv_id // Snapshot the main KTV at the time of completion
    } as any)
    .eq('id', sessionId);

  if (sessionError) {
    console.error('Error completing session:', sessionError);
    return { error: sessionError.message };
  }

  // 2.5 Tự động trừ kho vật tư tiêu hao nếu có định mức
  if (bookingData?.package_id) {
    try {
      const { autoConsumeForSession } = await import('./inventory-actions');
      await autoConsumeForSession(bookingData.package_id, sessionId);
      console.log(`[completeSession] Successfully auto-consumed materials for package ${bookingData.package_id} and session ${sessionId}`);
    } catch (consumeErr) {
      console.error('[completeSession] Error in autoConsumeForSession:', consumeErr);
    }
  }

  const today = getLocalDateString();

  // 3. Re-calculate actual completed sessions to avoid race conditions
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  if (countError) {
    console.error('Error counting completed sessions:', countError);
  }
  
  // 4. Update booking status transition (completed_sessions is now handled by Trigger)
  const { data: currentBooking } = await supabase.from('bookings').select('total_sessions, status, tenant_id').eq('id', bookingId).single();
  
  if (count && count > 0 && (currentBooking?.status === 'deposit_pending' || currentBooking?.status === 'booked' || currentBooking?.status === 'deposit')) {
    await supabase.from('bookings').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', bookingId);
  }
  
  if (currentBooking?.total_sessions && count && count >= currentBooking.total_sessions) {
    await supabase.from('bookings').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', bookingId);
  }

  // 6. Create a pending review for the customer to fill out
  try {
    const { data: bookingDetails } = await supabase
      .from('bookings')
      .select('customer_id, assigned_ktv_id')
      .eq('id', bookingId)
      .single();

    if (bookingDetails && bookingDetails.assigned_ktv_id) {
      // Only create placeholder review if KTV is assigned
      // rating=0 is now allowed by DB constraint (pending_review state)
      await supabase
        .from('session_reviews')
        .insert([{
          session_log_id: sessionId,
          reviewer_id: null,
          ktv_id: bookingDetails.assigned_ktv_id,
          rating: 0,
          status: 'pending_review',
          tenant_id: currentBooking?.tenant_id
        } as any]);
    }
  } catch (reviewErr) {
    console.error('Error creating pending review:', reviewErr);
    // Non-blocking error
  }

  // Audit log
  try {
    const { recordAuditLog } = await import('./audit-actions');
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'session_logs',
      record_id: sessionId,
      old_data: existingLog,
      new_data: {
        status: 'completed',
        completed_date: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date()),
        completed_by_ktv_id: bookingData.assigned_ktv_id
      }
    });
  } catch (auditErr) {
    console.warn('Failed to record completeSession audit log:', auditErr);
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
      preferred_time,
      customers(id, name_mother, name_baby, phone), 
      assigned_ktv:users!bookings_assigned_ktv_id_fkey(full_name),
      packages!bookings_package_id_fkey(name),
      session_logs(id, booking_id, session_number, assigned_date, assigned_time, completed_date, start_time, end_time, status, notes, rating, rating_comment, ktv:users!session_logs_completed_by_ktv_id_fkey(full_name), duration_warning_type, ktv_checkout_note, standard_duration, actual_duration, time_deviation)
    `)
    .order('created_at', { ascending: false });

  // If KTV, only show bookings where they are assigned
  if (currentUser?.role?.toLowerCase() === 'ktv') {
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
  

  
  const enrichedData = await Promise.all((data || []).map(async (b: any) => {
    // NOTE: Sync completed_sessions is now handled by Trigger
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
    const customerData = b.customers;
    


    return {
      ...b,
      package_name: resolvePackageName(b),
      session_logs: mappedLogs,
      customers: customerData || { name_mother: 'Khách hàng Bella Spa', phone: '---' },
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
  const supabase = (await createClient()) as any;
  
  const { getCurrentUser } = await import('./user-actions');
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

  // If KTV, only show sessions for their assigned bookings
  if (currentUser?.role?.toLowerCase() === 'ktv') {
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
    
      // NOTE: Sync completed_sessions is now handled by Trigger

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

export async function updateSessionLog(id: string, payload: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { getCurrentUser } = await import('./user-actions');
  const currentUser = await getCurrentUser();
  
  // 0. Security & Role Check
  const { data: existingLog } = await supabase
    .from('session_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (currentUser?.role?.toLowerCase() !== 'admin' && !['scheduled', 'in_progress'].includes(existingLog?.status)) {
    return { error: 'Bạn không có quyền thực hiện thao tác này (Unauthorized)' };
  }

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

  // 1.5 Auto-fill completion data if status changed to completed
  if (safeUpdates.status === 'completed' && existingLog?.status !== 'completed') {
    if (!safeUpdates.completed_date) {
      safeUpdates.completed_date = new Date().toISOString();
    }
    if (!safeUpdates.completed_by_ktv_id) {
      const { data: bData } = await supabase.from('bookings').select('assigned_ktv_id').eq('id', bookingId).single();
      if (bData?.assigned_ktv_id) {
        safeUpdates.completed_by_ktv_id = bData.assigned_ktv_id;
      }
    }
  }

  // 2. Update the log
  const { data, error } = await supabase
    .from('session_logs')
    .update(safeUpdates)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating session log:', error);
    return { error: error.message };
  }

  if (data?.[0]) {
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'session_logs',
        record_id: id,
        old_data: existingLog,
        new_data: safeUpdates
      });
    } catch (auditErr) {
      console.warn('Failed to record updateSessionLog audit log:', auditErr);
    }
  }


  // 3. Recalculate and sync completed_sessions for the booking
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  if (!countError) {
    const { data: currentBooking } = await supabase.from('bookings').select('total_sessions, status, package_name, ktv_commission, assigned_ktv_id, tenant_id').eq('id', bookingId).single();
    const today = getLocalDateString();
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

    // --- AUTOMATION START: Financial Recognition ---
    if (safeUpdates.status === 'completed' && existingLog?.status !== 'completed') {
      const ktvId = safeUpdates.completed_by_ktv_id || null;
      const tenantId = currentUser?.tenant_id;
      
      // 1. Revenue Automation for "Dịch vụ lẻ"
      if (currentBooking?.package_name?.toLowerCase().includes('lẻ')) {
        await supabase.from('revenue').insert([{
          booking_id: bookingId,
          amount: 350000,
          revenue_type: 'package_payment',
          payment_method: 'bank_transfer',
          received_date: today,
          status: 'confirmed',
          notes: `Tự động: Thu phí dịch vụ lẻ - ${currentBooking.package_name}`,
          tenant_id: tenantId
        }]);
      }

      // 2. Salary Automation: Update salary_records
      if (ktvId && tenantId) {
        const monthYear = `${today.substring(0, 7)}-01`;
        const commission = Number(currentBooking?.ktv_commission) || 150000;

        // Check if salary record exists for this month
        const { data: salaryRec } = await supabase
          .from('salary_records')
          .select('id, total_sessions, service_percentage_bonus')
          .eq('ktv_id', ktvId)
          .eq('month_year', monthYear)
          .single();

        if (salaryRec) {
          await supabase.from('salary_records').update({
            total_sessions: (salaryRec.total_sessions || 0) + 1,
            service_percentage_bonus: (Number(salaryRec.service_percentage_bonus) || 0) + commission,
            updated_at: new Date().toISOString()
          }).eq('id', salaryRec.id);
        } else {
          await supabase.from('salary_records').insert([{
            ktv_id: ktvId,
            month_year: monthYear,
            total_sessions: 1,
            service_percentage_bonus: commission,
            base_salary: 6000000, // Default
            status: 'draft',
            tenant_id: tenantId
          }]);
        }
      }

      // 3. Review Automation: Create pending review placeholder
      if (currentBooking?.assigned_ktv_id) {
        // Check if review already exists to avoid duplicates
        const { data: existingReview } = await supabase
          .from('session_reviews')
          .select('id')
          .eq('session_log_id', id)
          .single();

        if (!existingReview) {
          await supabase
            .from('session_reviews')
            .insert([{
              session_log_id: id,
              reviewer_id: null,
              ktv_id: currentBooking.assigned_ktv_id,
              rating: 0,
              status: 'pending_review',
              tenant_id: currentBooking.tenant_id
            } as any]);
        }
      }
    }
    // --- AUTOMATION END ---
  }

  // 4. Fetch customer_id for specific revalidation
  const { data: customerData } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('id', bookingId)
    .single();

  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions',
    '/dashboard/customers'
  ];
  if (customerData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${customerData.customer_id}`);
  }
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  return { data };
}

export async function saveSessionNote(sessionId: string, note: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { getCurrentUser } = await import('./user-actions');
  const currentUser = await getCurrentUser();

  // 0. Security Check
  const { data: existingLog } = await supabase
    .from('session_logs')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (currentUser?.role?.toLowerCase() !== 'admin' && !['scheduled', 'in_progress'].includes(existingLog?.status)) {
    return { error: `DEBUG: ID: ${currentUser?.id || 'null'}, Role: ${currentUser?.role || 'null'}, Email: ${currentUser?.email || 'null'}` };
  }
  
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

    const revalPaths = ['/dashboard/sessions', '/dashboard/customers'];
    if (bookingData?.customer_id) {
      revalPaths.push(`/dashboard/customers/${bookingData.customer_id}`);
    }
    await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));
  } else {
    const revalPaths = ['/dashboard/sessions', '/dashboard/customers'];
    await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));
  }

  // Audit log
  try {
    const { recordAuditLog } = await import('./audit-actions');
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'session_logs',
      record_id: sessionId,
      old_data: existingLog,
      new_data: { notes: note }
    });
  } catch (auditErr) {
    console.warn('Failed to record saveSessionNote audit log:', auditErr);
  }

  return { success: true };
}

export async function addExtraSession(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  // 1. Get current booking
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) return { error: fetchError?.message || 'Không tìm thấy booking' };
  
  const newTotal = (booking.total_sessions || 0) + 1;
  
  // 2. Update booking total
  await supabase.from('bookings').update({ total_sessions: newTotal } as any).eq('id', bookingId);

  // Audit log for booking adjustment
  try {
    const { recordAuditLog } = await import('./audit-actions');
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'bookings',
      record_id: bookingId,
      old_data: booking,
      new_data: { total_sessions: newTotal, notes: 'Thêm 01 buổi liệu trình phát sinh' }
    });
  } catch (auditErr) {
    console.warn('Failed to record addExtraSession audit log:', auditErr);
  }
  
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

  const revalPaths = ['/dashboard/sessions'];
  if (bookingData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${bookingData.customer_id}`);
  }
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));
  
  return { success: true };
}

export async function createSessionLog(data: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  // Helper: normalize any time string to HH:MM for Postgres time type
  function sanitizeTime(raw: any): string | null {
    if (!raw) return null;
    const s = String(raw).trim();
    // Already HH:MM or HH:MM:SS
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
      const [h, m] = s.split(':');
      return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    }
    // Extract first HH:MM found (e.g. "09:00 - 11:00" → "09:00")
    const match = s.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
    // Pure digits "09" → "09:00"
    if (/^\d{1,2}$/.test(s)) return `${s.padStart(2, '0')}:00`;
    return null;
  }

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
        assigned_time: sanitizeTime(data.assigned_time),
        notes: data.notes || null,
        status: data.status || 'scheduled'
      } as any,
    ])
    .select();

  if (error) {
    console.error('Error creating session log:', error);
    return { error: error.message };
  }

  // Audit log
  try {
    const { recordAuditLog } = await import('./audit-actions');
    if (session && session.length > 0) {
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'session_logs',
        record_id: session[0].id,
        new_data: session[0]
      });
    }
  } catch (auditErr) {
    console.warn('Failed to record createSessionLog audit log:', auditErr);
  }

  await safeRevalidatePath('/dashboard/bookings');
  return { data: session };
}

export async function updateBooking(id: string, payload: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  // Fetch existing booking before update for audit trail
  let oldBooking = null;
  try {
    const { data: existing } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();
    oldBooking = existing;
  } catch (err) {
    console.warn('Failed to fetch old booking for audit trail:', err);
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(payload)
    .eq('id', id)
    .select();

  if (error) {
    // Fallback: If it's a "column not found" error for package_name or "type mismatch" for package_id
    if (error.message?.includes('package_name') || error.message?.includes('package_id') || error.message?.includes('uuid')) {
      const { package_name, package_id, ...retryPayload } = payload;
      const { data: retryData, error: retryError } = await supabase
        .from('bookings')
        .update(retryPayload)
        .eq('id', id)
        .select();
      
      if (retryError) {
        console.error('Error updating booking (retry):', retryError);
        return { error: retryError.message };
      }
      
      if (retryData?.[0]) {
        try {
          const { recordAuditLog } = await import('./audit-actions');
          await recordAuditLog({
            action: 'UPDATE',
            table_name: 'bookings',
            record_id: id,
            old_data: oldBooking,
            new_data: retryPayload
          });
        } catch (auditErr) {
          console.warn('Failed to record updateBooking retry audit log:', auditErr);
        }
      }
      return { data: retryData };
    }

    console.error('Error updating booking:', error);
    return { error: error.message };
  }

  if (data?.[0]) {
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'bookings',
        record_id: id,
        old_data: oldBooking,
        new_data: payload
      });
    } catch (auditErr) {
      console.warn('Failed to record updateBooking audit log:', auditErr);
    }
  }

  // Synchronize session_logs when total_sessions changes
  if (payload.total_sessions !== undefined) {
    try {
      const newTotal = Number(payload.total_sessions);
      const { data: existingLogs } = await supabase
        .from('session_logs')
        .select('session_number, assigned_date, status')
        .eq('booking_id', id)
        .order('session_number', { ascending: true });

      const logs = existingLogs || [];
      const maxSessionNumber = logs.length > 0 ? Math.max(...logs.map((l: any) => l.session_number || 0)) : 0;

      if (newTotal < maxSessionNumber) {
        // Delete scheduled sessions beyond the new total
        await supabase
          .from('session_logs')
          .delete()
          .eq('booking_id', id)
          .gt('session_number', newTotal)
          .eq('status', 'scheduled');
      } else if (newTotal > maxSessionNumber) {
        // Generate missing session logs
        const newLogs = [];
        let baseDateStr = payload.start_date || data?.[0]?.start_date;
        if (!baseDateStr) {
          const { data: b } = await supabase
            .from('bookings')
            .select('start_date')
            .eq('id', id)
            .single();
          baseDateStr = b?.start_date;
        }

        const lastLogWithDate = [...logs].reverse().find((l: any) => l.assigned_date);
        let lastAssignedDate = lastLogWithDate?.assigned_date || baseDateStr;

        if (!lastAssignedDate) {
          const now = new Date();
          lastAssignedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }

        for (let i = maxSessionNumber + 1; i <= newTotal; i++) {
          const [y, m, d] = lastAssignedDate.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (i - maxSessionNumber));
          const assignedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

          newLogs.push({
            booking_id: id,
            session_number: i,
            status: 'scheduled',
            assigned_date: assignedDate,
            assigned_time: payload.preferred_time || data?.[0]?.preferred_time || null,
            tenant_id: data?.[0]?.tenant_id || process.env.DEFAULT_TENANT_ID || null
          });
        }

        if (newLogs.length > 0) {
          await supabase.from('session_logs').insert(newLogs);
        }
      }

      // Sync booking completed_sessions progress count
      await syncBookingProgress(id);
    } catch (syncErr) {
      console.error('Error synchronizing session logs inside updateBooking:', syncErr);
    }
  }

  // Also revalidate the specific customer page to ensure the treatment card updates
  const { data: bookingData } = await supabase.from('bookings').select('customer_id').eq('id', id).single();
  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/customers'
  ];
  if (bookingData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${bookingData.customer_id}`);
  }
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  return { data };
}

/**
 * Ensures the completed_sessions count in the bookings table matches the actual count of completed logs.
 */
export async function syncBookingProgress(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
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

  if (!booking) return { error: 'Booking not found' };

  // 3. Update if discrepancy found
  if ((booking as any).completed_sessions !== count) {
    const { error: updateError } = await (supabase.from('bookings') as any)
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
    start_date: getLocalDateString(),
  };

  // Only include package_name if it exists in the original record
  if (original.package_name) {
    bookingData.package_name = original.package_name;
  }

  const { data: newBookingData, error: createError } = await supabase
    .from('bookings')
    .insert([bookingData])
    .select();

  let newBooking = newBookingData?.[0];

  if (createError) {
    // Fallback: If it's a "column not found" error for package_name, try without it
    if (createError.message?.includes('package_name')) {
      delete bookingData.package_name;
      const { data: retryBookingData, error: retryError } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select();
      
      if (retryError) return { error: 'Lỗi tạo gói mới: ' + retryError.message };
      return finalizeReuse(retryBookingData?.[0], original.total_sessions, supabase);
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

  // Audit log
  try {
    const { recordAuditLog } = await import('./audit-actions');
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'bookings',
      record_id: newBooking.id,
      new_data: newBooking
    });
  } catch (auditErr) {
    console.warn('Failed to record reusePackage/finalizeReuse audit log:', auditErr);
  }

  const revalPaths = [
    '/dashboard/sessions',
    '/dashboard/bookings',
    `/dashboard/customers/${newBooking.customer_id}`
  ];
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));
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
  status?: string; // Add status field
}) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

  try {
    // 1. Record the revenue
    // If this payment will make the booking 'booked', we can confirm it immediately
    // However, we'll confirm it after the booking status update for consistency
    const { error: revError } = await supabase
      .from('revenue')
      .insert([{
        booking_id: params.booking_id,
        amount: params.amount,
        revenue_type: 'remaining_payment',
        payment_method: params.payment_method,
        received_date: getLocalDateString(),
        status: params.status || 'pending', // Use provided status
        notes: params.notes || `Thanh toán nốt phần còn lại.`,
        receipt_url: params.receipt_url || null
      }]);

    if (revError) {
      console.error('Error recording revenue:', revError);
    }

    // 2. Update the booking's deposit_amount (summing it up)
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', params.booking_id)
      .single();

    if (fetchError || !booking) throw fetchError || new Error('Không tìm thấy booking');

    const newTotalPaid = (booking.deposit_amount || 0) + params.amount;
    
    // Determine new status - If paid in full, change from deposit_pending to booked/active
    let newStatus = booking.status;
    const targetPrice = booking.full_price * (1 - (booking.discount_percent || 0)/100);
    if (newTotalPaid >= targetPrice && (booking.status === 'deposit_pending' || booking.status === 'deposit')) {
      newStatus = 'booked';
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        deposit_amount: newTotalPaid,
        status: newStatus
      } as any)
      .eq('id', params.booking_id);

    if (updateError) throw updateError;

    // Audit log
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'bookings',
        record_id: params.booking_id,
        old_data: booking,
        new_data: { deposit_amount: newTotalPaid, status: newStatus }
      });
    } catch (auditErr) {
      console.warn('Failed to record recordRemainingPayment audit log:', auditErr);
    }

    // 2.5 Logic: Sync Revenue Status
    // If auto_confirm is true OR the booking is now fully paid, confirm relevant records
    if (params.status === 'confirmed' || newStatus === 'booked') {
      const { error: syncError } = await supabase
        .from('revenue')
        .update({ status: 'confirmed' })
        .eq('booking_id', params.booking_id)
        .eq('status', 'pending');
      
      if (syncError) {
        console.error('Error syncing revenue status:', syncError);
      }
    }

    // 3. Revalidate the customer page in parallel
    const revalPaths = [
      `/dashboard/customers/${params.customer_id}`,
      '/dashboard/finance'
    ];
    await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

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
      effectiveOldDateStr = getLocalDateString(bDate);
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
      currentAssignedDate = getLocalDateString(baseDate);
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

  // 5. Revalidate paths in parallel
  const { data: bookingData } = await supabase.from('bookings').select('customer_id').eq('id', bookingId).single();
  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions'
  ];
  if (bookingData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${bookingData.customer_id}`);
  }
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  // Audit log
  try {
    const { recordAuditLog } = await import('./audit-actions');
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'session_logs',
      record_id: sessionId,
      old_data: session,
      new_data: { assigned_date: newDate, notes: `Dời lịch các buổi từ buổi ${session.session_number} thêm ${diffDays} ngày.` }
    });
  } catch (auditErr) {
    console.warn('Failed to record rescheduleSession audit log:', auditErr);
  }

  return { success: true };
}

export async function generateShareToken(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const crypto = await import('crypto');
  
  const token = crypto.randomUUID().split('-')[0] + crypto.randomUUID().split('-')[1];
  
  const { data, error } = await supabase
    .from('bookings')
    .update({ share_token: token })
    .eq('id', bookingId)
    .select();
    
  if (error) {
    console.error('Error generating share token:', error);
    return { error: error.message };
  }
  
  const tokenData = data?.[0];
  
  const revalPaths = ['/dashboard/customers'];
  if (tokenData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${tokenData.customer_id}`);
  }
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));
  
  return { data: tokenData };
}

export async function getBookingDetailsWithPayment(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      tenants (
        id,
        name,
        qr_bank_code,
        qr_account_number,
        qr_account_name
      ),
      revenue (
        *
      )
    `)
    .eq('id', bookingId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching booking payment details:', error);
    return { error: error.message };
  }

  return { data };
}




