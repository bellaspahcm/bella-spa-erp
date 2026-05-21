'use server';

import { resolvePackageName, getLocalDateString, sanitizeTime } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import { bookingSchema } from '@/lib/validations';
import { resolveKtvCommission } from './commission-actions';

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
  if (validatedData.preferred_time) {
    validatedData.preferred_time = sanitizeTime(validatedData.preferred_time) || undefined;
  }

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
      const { recordAuditLog } = await import('@/services/audit-actions');
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

  const { getCurrentUser } = await import('@/services/user-actions');

  let tenantId: string | null = null;
  let userEmail: string | null = null;
  let isLoggedIn = false;

  const currentUser = await getCurrentUser();
  if (currentUser) {
    isLoggedIn = true;
    if (currentUser.tenant_id) {
      tenantId = currentUser.tenant_id || null;
      userEmail = currentUser.email || null;
      console.log('[createBooking] Level1 resolved tenant:', tenantId);
    }
  }

  if (!tenantId) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      isLoggedIn = true;
      userEmail = authUser.email ?? null;
      console.log('[createBooking] Level2 authUser:', authUser.email, '| id:', authUser.id);
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
  const lockedCommission = validatedData.ktv_commission || await resolveKtvCommission(validatedData);
  
  const bookingPayload: any = {
    customer_id: validatedData.customer_id,
    booking_number: existingBooking?.booking_number || `BK-${new Date().getTime()}`,
    package_id: validatedData.package_id || null,
    package_name: validatedData.package_name || null,
    status: isFullBooking ? 'booked' : 'deposit_pending',
    full_price: validatedData.full_price,
    deposit_amount: (existingBooking?.deposit_amount || 0) + (validatedData.deposit_amount || 0),
    total_sessions: validatedData.total_sessions,
    ktv_commission: lockedCommission,
    discount_percent: validatedData.discount_percent || 0,
    start_date: validatedData.start_date || null,
    assigned_ktv_id: validatedData.assigned_ktv_id || null,
    preferred_time: validatedData.preferred_time || null,
    tenant_id: tenantId
  };

  if (existingBooking) {
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
        const { recordAuditLog } = await import('@/services/audit-actions');
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
    const { data: inserted, error } = await supabase
      .from('bookings')
      .insert([bookingPayload])
      .select()
      .single();
    booking = inserted;
    bookingError = error;

    if (!error && inserted) {
      try {
        const { recordAuditLog } = await import('@/services/audit-actions');
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

  if (validatedData.deposit_amount > 0 && booking?.id) {
    const { error: revError } = await supabase
      .from('revenue')
      .insert([{
        booking_id: booking.id,
        amount: validatedData.deposit_amount,
        revenue_type: 'deposit',
        payment_method: 'bank_transfer',
        received_date: getLocalDateString(),
        status: 'confirmed',
        notes: `Cọc gói ${resolvePackageName(booking)}`,
        tenant_id: tenantId
      }]);
    
    if (revError) console.error('Error recording initial deposit revenue:', revError);
  }

  const { count: existingLogsCount } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', booking.id);

  if (!existingLogsCount || existingLogsCount === 0) {
    const totalSessions = validatedData.total_sessions || 15;
    let startDateStr = validatedData.start_date;
    
    if (!startDateStr) {
      const now = new Date();
      startDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    
    const sessionLogs = Array.from({ length: totalSessions }, (_: any, i: number) => {
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
  
  const b = data[0];
  if (b.status === 'deposit_pending' || b.status === 'lead') {
    return b;
  }
  
  return null;
}

export async function updateBooking(id: string, payload: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  if (payload.preferred_time !== undefined) {
    payload.preferred_time = sanitizeTime(payload.preferred_time);
  }
  
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
          const { recordAuditLog } = await import('@/services/audit-actions');
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
      const { recordAuditLog } = await import('@/services/audit-actions');
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
        await supabase
          .from('session_logs')
          .delete()
          .eq('booking_id', id)
          .gt('session_number', newTotal)
          .eq('status', 'scheduled');
      } else if (newTotal > maxSessionNumber) {
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

      await syncBookingProgress(id);
    } catch (syncErr) {
      console.error('Error synchronizing session logs inside updateBooking:', syncErr);
    }
  }

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

export async function syncBookingProgress(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  if (countError) return { error: countError.message };

  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('completed_sessions')
    .eq('id', bookingId)
    .single();

  if (!booking) return { error: 'Booking not found' };

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

  const { data: original, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (fetchError || !original) {
    return { error: 'Không tìm thấy gói cũ: ' + fetchError?.message };
  }

  const bookingData: any = {
    customer_id: original.customer_id,
    booking_number: `BK-${new Date().getTime()}`,
    package_id: original.package_id,
    status: 'deposit_pending',
    full_price: original.full_price,
    deposit_amount: 0,
    total_sessions: original.total_sessions,
    completed_sessions: 0,
    start_date: getLocalDateString(),
  };

  if (original.package_name) {
    bookingData.package_name = original.package_name;
  }

  const { data: newBookingData, error: createError } = await supabase
    .from('bookings')
    .insert([bookingData])
    .select();

  let newBooking = newBookingData?.[0];

  if (createError) {
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

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
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

export async function recordRemainingPayment(params: {
  booking_id: string;
  customer_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
  receipt_url?: string;
  status?: string;
}) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

  try {
    const { error: revError } = await supabase
      .from('revenue')
      .insert([{
        booking_id: params.booking_id,
        amount: params.amount,
        revenue_type: 'remaining_payment',
        payment_method: params.payment_method,
        received_date: getLocalDateString(),
        status: params.status || 'pending',
        notes: params.notes || `Thanh toán nốt phần còn lại.`,
        receipt_url: params.receipt_url || null
      }]);

    if (revError) {
      console.error('Error recording revenue:', revError);
    }

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', params.booking_id)
      .single();

    if (fetchError || !booking) throw fetchError || new Error('Không tìm thấy booking');

    const newTotalPaid = (booking.deposit_amount || 0) + params.amount;
    
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

    try {
      const { recordAuditLog } = await import('@/services/audit-actions');
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

// ============================================================
// GUEST / SELF-SERVICE ONLINE BOOKING
// ============================================================

export interface OnlineBookingFormData {
  name_mother: string;
  phone: string;
  address?: string;
  package_id?: string;
  package_name?: string;
  expected_birth_date?: string;
  dob_baby?: string;
  name_baby?: string;
  start_date: string;
  preferred_time?: string;
  notes?: string;
}

export async function submitOnlineBooking(formData: OnlineBookingFormData): Promise<{
  success?: boolean;
  bookingNumber?: string;
  error?: string;
}> {
  'use server';

  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

  // 1. Basic validation
  if (!formData.phone || formData.phone.trim().length < 9) {
    return { error: 'Số điện thoại không hợp lệ.' };
  }
  if (!formData.name_mother || formData.name_mother.trim().length < 2) {
    return { error: 'Tên của bạn không hợp lệ.' };
  }
  if (!formData.start_date) {
    return { error: 'Vui lòng chọn ngày bắt đầu.' };
  }

  const phone = formData.phone.trim();
  let tenantId = process.env.DEFAULT_TENANT_ID;

  if (!tenantId) {
    const { data: tenantData } = await supabase.from('tenants').select('id').limit(1).single();
    if (tenantData) {
      tenantId = tenantData.id;
    } else {
      console.error('[submitOnlineBooking] No tenant found in database!');
      return { error: 'Hệ thống chưa được cấu hình. Vui lòng liên hệ trực tiếp qua hotline.' };
    }
  }

  // 2. Look up existing customer by phone
  let customerId: string;

  const { data: existingCustomer, error: lookupError } = await supabase
    .from('customers')
    .select('id, name_mother, phone')
    .eq('phone', phone)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (lookupError) {
    console.error('[submitOnlineBooking] Customer lookup error:', lookupError);
    return { error: 'Lỗi hệ thống khi tìm kiếm thông tin. Vui lòng thử lại.' };
  }

  if (existingCustomer) {
    // Customer already exists — reuse
    customerId = existingCustomer.id;
    console.log('[submitOnlineBooking] Matched existing customer:', customerId);
  } else {
    // Create new customer with status "lead"
    const newCustomerPayload: Record<string, string | null> = {
      name_mother: formData.name_mother.trim(),
      phone,
      address: formData.address?.trim() || null,
      status: 'lead',
      tenant_id: tenantId,
      notes: formData.notes?.trim() || null,
    };

    if (formData.name_baby) newCustomerPayload.name_baby = formData.name_baby.trim();
    if (formData.dob_baby) newCustomerPayload.dob_baby = formData.dob_baby;
    if (formData.expected_birth_date) newCustomerPayload.dob_expected = formData.expected_birth_date;

    const { data: newCustomer, error: createCustError } = await supabase
      .from('customers')
      .insert([newCustomerPayload])
      .select()
      .single();

    if (createCustError || !newCustomer) {
      console.error('[submitOnlineBooking] Create customer error:', createCustError);
      return { error: 'Không thể tạo hồ sơ khách hàng. Vui lòng thử lại sau.' };
    }

    customerId = newCustomer.id;
    console.log('[submitOnlineBooking] Created new lead customer:', customerId);

    // Audit log for new customer
    try {
      const { recordAuditLog } = await import('@/services/audit-actions');
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'customers',
        record_id: customerId,
        new_data: newCustomer,
      });
    } catch (auditErr) {
      console.warn('[submitOnlineBooking] Audit log (customer) failed:', auditErr);
    }
  }

  // 3. Create the booking
  const bookingNumber = `BK-ONLINE-${Date.now()}`;
  const bookingPayload: Record<string, string | number | boolean | null> = {
    customer_id: customerId,
    booking_number: bookingNumber,
    package_id: formData.package_id || null,
    package_name: formData.package_name || null,
    status: 'lead',
    full_price: 0,
    deposit_amount: 0,
    total_sessions: 1,
    start_date: formData.start_date,
    preferred_time: formData.preferred_time || null,
    expected_birth_date: formData.expected_birth_date || null,
    tenant_id: tenantId,
  };

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert([bookingPayload])
    .select()
    .single();

  if (bookingError || !booking) {
    console.error('[submitOnlineBooking] Create booking error:', bookingError);
    return { error: 'Không thể đặt lịch. Vui lòng thử lại hoặc liên hệ hotline.' };
  }

  // Audit log for booking
  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'bookings',
      record_id: booking.id,
      new_data: booking,
    });
  } catch (auditErr) {
    console.warn('[submitOnlineBooking] Audit log (booking) failed:', auditErr);
  }
  // Create notification
  try {
    const { error: notifErr } = await supabase.from('app_notifications').insert([{
      tenant_id: tenantId,
      type: 'new_booking',
      title: 'Khách hàng đặt lịch mới',
      message: `${formData.name_mother} vừa đặt lịch hẹn online.`,
      data: {
        customer_id: customerId,
        booking_id: booking.id,
        booking_number: bookingNumber
      }
    }]);

    if (notifErr) {
      console.error('[submitOnlineBooking] Supabase insert error for notification:', notifErr);
    }
  } catch (notifErr) {
    console.warn('[submitOnlineBooking] Exception while creating notification:', notifErr);
  }

  // Revalidate admin pages
  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/customers',
    `/dashboard/customers/${customerId}`,
    '/dashboard',
  ];
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  return { success: true, bookingNumber };
}
