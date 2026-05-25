'use server';

import { resolvePackageName, getLocalDateString, sanitizeTime } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import { syncBookingProgress } from './lifecycle-actions';

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

export async function completeSession(sessionId: string, bookingId: string, customNote?: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { getCurrentUser } = await import('@/services/user-actions');
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

  const updatePayload: any = { 
    status: 'completed',
    completed_date: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()),
    completed_by_ktv_id: bookingData.assigned_ktv_id
  };

  if (customNote !== undefined) {
    updatePayload.notes = customNote;
  }

  // 2. Update session log status with KTV snapshot
  const { error: sessionError } = await supabase
    .from('session_logs')
    .update(updatePayload as any)
    .eq('id', sessionId);

  if (sessionError) {
    console.error('Error completing session:', sessionError);
    return { error: sessionError.message };
  }

  // 2.5 Tự động trừ kho vật tư tiêu hao nếu có định mức
  if (bookingData?.package_id) {
    try {
      const { autoConsumeForSession } = await import('@/services/inventory-actions');
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
  
  // 4. Update booking status transition and completed sessions count
  const { data: currentBooking } = await supabase
    .from('bookings')
    .select('total_sessions, status, package_name, ktv_commission, assigned_ktv_id, tenant_id')
    .eq('id', bookingId)
    .single();
  
  const bUpdates: any = { 
    completed_sessions: count || 0,
    last_updated_date: today,
    updated_at: new Date().toISOString()
  };
  
  if (count && count > 0 && (currentBooking?.status === 'deposit_pending' || currentBooking?.status === 'booked' || currentBooking?.status === 'deposit')) {
    bUpdates.status = 'in_progress';
  }
  
  if (currentBooking?.total_sessions && count && count >= currentBooking.total_sessions) {
    bUpdates.status = 'completed';
  }

  await supabase.from('bookings').update(bUpdates).eq('id', bookingId);

  // --- AUTOMATION: Financial Recognition ---
  const ktvId = bookingData.assigned_ktv_id;
  const tenantId = currentBooking?.tenant_id || currentUser?.tenant_id;

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

  if (ktvId && tenantId) {
    const monthYear = `${today.substring(0, 7)}-01`;
    const commission = Number(currentBooking?.ktv_commission) || 150000;

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
        base_salary: 6000000,
        status: 'draft',
        tenant_id: tenantId
      }]);
    }
  }

  // 6. Create a pending review for the customer to fill out
  try {
    const { data: bookingDetails } = await supabase
      .from('bookings')
      .select('customer_id, assigned_ktv_id')
      .eq('id', bookingId)
      .single();

    if (bookingDetails && bookingDetails.assigned_ktv_id) {
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
  }

  // ⭐ Ghi nhận vào hàng đợi Accounting Outbox cho sự kiện SESSION_DONE
  if (sessionId && tenantId) {
    const fullPrice = Number(currentBooking?.full_price || 0);
    const discountPercent = Number(currentBooking?.discount_percent || 0);
    const targetPrice = fullPrice * (1 - discountPercent / 100);
    const totalSessions = Number(currentBooking?.total_sessions || 1);
    const earnedRevenueAmount = totalSessions > 0 ? targetPrice / totalSessions : 0;
    const commission = Number(currentBooking?.ktv_commission) || 0;

    const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
    await enqueueWithAutoClient(
      supabase,
      {
        tenantId,
        eventType: 'SESSION_DONE',
        referenceType: 'SESSION_LOG',
        referenceId: sessionId,
        payload: {
          earnedRevenueAmount,
          commissionAmount: commission,
          ktvId: ktvId || currentBooking?.assigned_ktv_id || null,
          // TODO Phase 29: dùng branch_id thực khi multi-branch
          branchId: tenantId,
          description: `Hoàn thành buổi ${existingLog?.session_number || '--'}/${totalSessions} - ${currentBooking?.package_name || 'Gói dịch vụ'}`,
        },
      },
      '[completeSession]'
    );
  }

  return { success: true };
}

export async function getSessionsWithDetails() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { getCurrentUser } = await import('@/services/user-actions');
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
    const sortedLogs = (b.session_logs || []).sort((a: any, b2: any) => (a.session_number || 0) - (b2.session_number || 0));
    
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
    console.error('Error fetching calendar sessions:', error);
    return [];
  }
  
  const sessionsByBooking: Record<string, any[]> = {};
  (data || []).forEach((s: any) => {
    if (!s.booking_id) return;
    if (!sessionsByBooking[s.booking_id]) sessionsByBooking[s.booking_id] = [];
    sessionsByBooking[s.booking_id].push(s);
  });

  const processedSessionsList = await Promise.all(Object.entries(sessionsByBooking).map(async ([bookingId, bookingSessions]) => {
    bookingSessions.sort((a, b) => a.session_number - b.session_number);

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
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();
  
  const { data: existingLog } = await supabase
    .from('session_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (currentUser?.role?.toLowerCase() !== 'admin' && !['scheduled', 'in_progress'].includes(existingLog?.status)) {
    return { error: 'Bạn không có quyền thực hiện thao tác này (Unauthorized)' };
  }

  const updates: any = { ...payload };
  
  if (updates.assigned_date === "" || updates.assigned_date === "dd/mm/yyyy") updates.assigned_date = null;
  if (updates.assigned_time === "" || updates.assigned_time === "--:-- --") {
    updates.assigned_time = null;
  } else if (updates.assigned_time !== undefined) {
    updates.assigned_time = sanitizeTime(updates.assigned_time);
  }
  if (updates.notes === "") updates.notes = null;

  const allowedColumns = ['assigned_date', 'completed_date', 'completed_by_ktv_id', 'address', 'status', 'notes', 'assigned_time'];
  const safeUpdates: any = {};
  for (const key of allowedColumns) {
    if (key in updates) {
      safeUpdates[key] = updates[key];
    }
  }

  const { data: logData, error: logError } = await supabase
    .from('session_logs')
    .select('booking_id')
    .eq('id', id)
    .single();

  if (logError) return { error: logError.message };
  const bookingId = logData.booking_id;

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
      const { recordAuditLog } = await import('@/services/audit-actions');
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
      bUpdates.status = 'in_progress';
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
      const tenantId = currentUser?.tenant_id || currentBooking?.tenant_id;
      
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

      if (ktvId && tenantId) {
        const monthYear = `${today.substring(0, 7)}-01`;
        const commission = Number(currentBooking?.ktv_commission) || 150000;

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
            base_salary: 6000000,
            status: 'draft',
            tenant_id: tenantId
          }]);
        }
      }

      if (currentBooking?.assigned_ktv_id) {
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

      // ⭐ Ghi nhận vào hàng đợi Accounting Outbox cho sự kiện SESSION_DONE
      if (id && tenantId) {
        const fullPrice = Number(currentBooking?.full_price || 0);
        const discountPercent = Number(currentBooking?.discount_percent || 0);
        const targetPrice = fullPrice * (1 - discountPercent / 100);
        const totalSessions = Number(currentBooking?.total_sessions || 1);
        const earnedRevenueAmount = totalSessions > 0 ? targetPrice / totalSessions : 0;
        const commission = Number(currentBooking?.ktv_commission) || 0;

        const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
        await enqueueWithAutoClient(
          supabase,
          {
            tenantId,
            eventType: 'SESSION_DONE',
            referenceType: 'SESSION_LOG',
            referenceId: id,
            payload: {
              earnedRevenueAmount,
              commissionAmount: commission,
              ktvId: ktvId || currentBooking?.assigned_ktv_id || null,
              // TODO Phase 29: dùng branch_id thực khi multi-branch
              branchId: tenantId,
              description: `Hoàn thành buổi ${existingLog?.session_number || '--'}/${totalSessions} - ${currentBooking?.package_name || 'Gói dịch vụ'}`,
            },
          },
          '[updateSessionLog]'
        );
      }
    }
  }

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
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

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

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
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
  
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) return { error: fetchError?.message || 'Không tìm thấy booking' };
  
  const newTotal = (booking.total_sessions || 0) + 1;
  
  await supabase.from('bookings').update({ total_sessions: newTotal } as any).eq('id', bookingId);

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
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
  
  await supabase.from('session_logs').insert({
    booking_id: bookingId,
    session_number: newTotal,
    status: 'scheduled'
  } as any);
  
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
  
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', data.booking_id);

  if (countError) {
    console.error('Error counting sessions:', countError);
    return { error: countError.message };
  }

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

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
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

export async function rescheduleSession(sessionId: string, newDate: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

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

  const oldDate = new Date(effectiveOldDateStr);
  const targetDate = new Date(newDate);
  
  oldDate.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - oldDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { success: true };

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

  const updates = futureSessions.map((s: any) => {
    let currentAssignedDate = s.assigned_date;
    
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

  const { data: bookingData } = await supabase.from('bookings').select('customer_id').eq('id', bookingId).single();
  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions'
  ];
  if (bookingData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${bookingData.customer_id}`);
  }
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
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
