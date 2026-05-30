'use server';

import { resolvePackageName, getLocalDateString, sanitizeTime } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import { syncBookingProgress } from './lifecycle-actions';
import type { Database } from '@/types/database.types';
import { FINANCE_CONSTANTS } from '@/constants/finance';

type SessionLogInsert = Database['public']['Tables']['session_logs']['Insert'];

export async function getSessionLogs(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
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

/**
 * Logic dùng chung để chốt ca làm việc, xử lý trừ kho, tính lương KTV và rollback toàn diện khi lỗi
 */
export async function processSessionCompletion(
  supabase: any,
  sessionId: string,
  bookingId: string,
  tenantId: any,
  ktvId: any,
  today: string,
  packageId: any,
  existingLog: any,
  currentUser: any
) {
  // 1. Tự động trừ kho vật tư tiêu hao nếu có định mức
  let isInventoryConsumed = false;
  if (packageId) {
    const { autoConsumeForSession } = await import('@/services/inventory-actions');
    const consumeResult = await autoConsumeForSession(packageId, sessionId);
    
    // Chặn đứng (halt) quy trình nếu kho không đủ nguyên liệu
    if (consumeResult && consumeResult.success === false) {
      return { error: consumeResult.error || 'Kho không đủ nguyên liệu để thực hiện ca dịch vụ này.' };
    }
    isInventoryConsumed = consumeResult && consumeResult.success && !consumeResult.bypassed;
  }

  // 2. Đếm lại số buổi hoàn thành thực tế
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  if (countError) {
    console.error('Error counting completed sessions:', countError);
  }

  const { data: currentBooking } = await supabase
    .from('bookings')
    .select('total_sessions, completed_sessions, status, package_name, ktv_commission, assigned_ktv_id, tenant_id, full_price, discount_percent')
    .eq('id', bookingId)
    .single();

  const bUpdates: Database['public']['Tables']['bookings']['Update'] = {
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

  const { error: bookingUpdateErr } = await supabase.from('bookings').update(bUpdates).eq('id', bookingId);
  if (bookingUpdateErr) {
    console.error('Error updating booking progress:', bookingUpdateErr);
    if (isInventoryConsumed) {
      const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
      await rollbackInventoryConsumption(sessionId);
    }
    return { error: 'Lỗi cập nhật tiến trình booking: ' + bookingUpdateErr.message };
  }

  // 3. Ghi nhận doanh thu dịch vụ lẻ
  let isRevenueCreated = false;
  if (currentBooking?.package_name?.toLowerCase().includes('lẻ')) {
    const { error: revErr } = await supabase.from('revenue').insert([{
      booking_id: bookingId,
      amount: FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE,
      revenue_type: 'package_payment',
      payment_method: 'bank_transfer',
      received_date: today,
      status: 'confirmed',
      notes: `Tự động: Thu phí dịch vụ lẻ - ${currentBooking.package_name}`,
      tenant_id: tenantId
    }]);

    if (revErr) {
      console.error('Error auto-creating revenue:', revErr);
      // Rollback booking
      await supabase.from('bookings').update({
        completed_sessions: currentBooking?.completed_sessions || 0,
        status: currentBooking?.status || 'booked'
      }).eq('id', bookingId);
      if (isInventoryConsumed) {
        const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
        await rollbackInventoryConsumption(sessionId);
      }
      return { error: 'Không thể ghi nhận doanh thu tự động cho gói lẻ: ' + revErr.message };
    }
    isRevenueCreated = true;
  }

  // 4. Cộng lương KTV vào salary_records
  if (ktvId && tenantId) {
    const monthYear = `${today.substring(0, 7)}-01`;
    let salaryError = null;

    try {
      const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
      await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId);
    } catch (e: any) {
      salaryError = e;
    }

    if (salaryError) {
      console.error('[processSessionCompletion] Error updating salary record, rolling back...:', salaryError);
      
      // Rollback revenue nếu có tạo
      if (isRevenueCreated) {
        await supabase
          .from('revenue')
          .delete()
          .eq('booking_id', bookingId)
          .eq('amount', FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE)
          .eq('notes', `Tự động: Thu phí dịch vụ lẻ - ${currentBooking?.package_name}`);
      }

      // Rollback booking
      await supabase.from('bookings').update({
        completed_sessions: currentBooking?.completed_sessions || 0,
        status: currentBooking?.status || 'booked'
      }).eq('id', bookingId);

      // Rollback kho
      if (isInventoryConsumed) {
        const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
        await rollbackInventoryConsumption(sessionId);
      }

      return { error: 'Không thể ghi nhận lương cho KTV. Đã hoàn tác ca làm: ' + salaryError.message };
    }
  }

  // 5. Tạo placeholder review cho khách hàng
  try {
    if (currentBooking?.assigned_ktv_id) {
      const { data: existingReview } = await supabase
        .from('session_reviews')
        .select('id')
        .eq('session_log_id', sessionId)
        .maybeSingle();

      if (!existingReview) {
        await supabase
          .from('session_reviews')
          .insert([{
            session_log_id: sessionId,
            reviewer_id: currentBooking.assigned_ktv_id, // Gán tạm thời reviewer chính làm placeholder
            ktv_id: ktvId,
            rating: 5,
            note: 'Chờ khách hàng đánh giá',
            status: 'pending_review',
            tenant_id: tenantId
          }]);
      }
    }
  } catch (reviewErr) {
    console.warn('Failed to auto-create review placeholder:', reviewErr);
  }

  // 6. Ghi nhận vào hàng đợi Accounting Outbox cho sự kiện SESSION_DONE
  if (sessionId && tenantId) {
    try {
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
            branchId: tenantId,
            description: `Hoàn thành buổi ${existingLog?.session_number || '--'}/${totalSessions} - ${currentBooking?.package_name || 'Gói dịch vụ'}`,
          },
        },
        '[processSessionCompletion]'
      );
    } catch (outboxError: any) {
      console.error('[processSessionCompletion] Error enqueuing accounting outbox event, rolling back...', outboxError);
      
      // Rollback KTV salary record
      if (ktvId && tenantId) {
        const monthYear = `${today.substring(0, 7)}-01`;
        try {
          const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
          await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId);
        } catch (e) {
          console.error('[processSessionCompletion] Error rolling back KTV salary record:', e);
        }
      }

      // Rollback revenue nếu có tạo
      if (isRevenueCreated) {
        await supabase
          .from('revenue')
          .delete()
          .eq('booking_id', bookingId)
          .eq('amount', FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE)
          .eq('notes', `Tự động: Thu phí dịch vụ lẻ - ${currentBooking?.package_name}`);
      }

      // Rollback booking
      await supabase.from('bookings').update({
        completed_sessions: currentBooking?.completed_sessions || 0,
        status: currentBooking?.status || 'booked'
      }).eq('id', bookingId);

      // Rollback kho
      if (isInventoryConsumed) {
        const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
        await rollbackInventoryConsumption(sessionId);
      }

      return { error: 'Không thể ghi nhận hàng đợi kế toán. Đã hoàn tác ca làm: ' + outboxError.message };
    }
  }

  return { success: true };
}

export async function completeSession(sessionId: string, bookingId: string, customNote?: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

  // 0. Security Check
  const { data: existingLog } = await supabase
    .from('session_logs')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (existingLog?.status === 'completed') {
    return { error: 'Buổi dịch vụ này đã hoàn thành trước đó (Idempotent)' };
  }

  if (currentUser?.role?.toLowerCase() !== 'admin' && !['scheduled', 'in_progress'].includes(existingLog?.status ?? '')) {
    return { error: 'Bạn không có quyền thực hiện thao tác này (Unauthorized)' };
  }

  // 1. Get current booking to check assigned KTV and package
  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .select('assigned_ktv_id, package_id, status')
    .eq('id', bookingId)
    .single();

  if (bookingError || !bookingData) {
    return { error: 'Không tìm thấy thông tin booking liên quan.' };
  }

  if (bookingData.status === 'cancelled') {
    return { error: 'Không thể hoàn thành buổi dịch vụ cho booking đã hủy.' };
  }

  if (!bookingData.assigned_ktv_id) {
    return { error: 'Chưa phân công KTV chính. Vui lòng phân công KTV trước khi xác nhận hoàn thành buổi.' };
  }

  const updatePayload: Database['public']['Tables']['session_logs']['Update'] = {
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
    .update(updatePayload)
    .eq('id', sessionId);

  if (sessionError) {
    console.error('Error completing session:', sessionError);
    return { error: sessionError.message };
  }

  // 3. Gọi helper dùng chung để chốt ca làm việc, trừ kho, tính lương KTV
  const today = getLocalDateString();
  const tenantId = currentUser?.tenant_id || existingLog?.tenant_id;
  const ktvId = bookingData.assigned_ktv_id;

  const result = await processSessionCompletion(
    supabase,
    sessionId,
    bookingId,
    tenantId,
    ktvId,
    today,
    bookingData.package_id,
    existingLog,
    currentUser
  );

  if (result.error) {
    console.error('[completeSession] Failed to process session completion, rolling back status:', result.error);
    // Rollback session status
    await supabase.from('session_logs').update({
      status: existingLog?.status || 'scheduled',
      completed_date: null,
      completed_by_ktv_id: null
    }).eq('id', sessionId);
    
    return { error: result.error };
  }

  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions',
    '/dashboard/customers'
  ];
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  return { success: true };
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
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();
  
  const { data: existingLog, error: existingLogError } = await supabase
    .from('session_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (existingLogError || !existingLog) {
    return { error: existingLogError?.message || 'Không tìm thấy session log' };
  }

  if (currentUser?.role?.toLowerCase() !== 'admin' && !['scheduled', 'in_progress'].includes(existingLog?.status ?? '')) {
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
      await supabase
        .from('session_logs')
        .update(existingLog)
        .eq('id', id);
      return {
        error: auditErr instanceof Error ? auditErr.message : 'Failed to record updateSessionLog audit log'
      };
    }
  }

  if (safeUpdates.status === 'completed' && existingLog?.status !== 'completed') {
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('assigned_ktv_id, package_id')
      .eq('id', bookingId)
      .single();

    const today = getLocalDateString();
    const tenantId = currentUser?.tenant_id || existingLog?.tenant_id;
    const ktvId = safeUpdates.completed_by_ktv_id || bookingData?.assigned_ktv_id || null;

    const result = await processSessionCompletion(
      supabase,
      id,
      bookingId,
      tenantId,
      ktvId,
      today,
      bookingData?.package_id,
      existingLog,
      currentUser
    );

    if (result.error) {
      console.error('[updateSessionLog] Failed to process session completion, rolling back status:', result.error);
      // Rollback session status
      await supabase.from('session_logs').update({
        status: existingLog?.status || 'scheduled',
        completed_date: existingLog?.completed_date || null,
        completed_by_ktv_id: existingLog?.completed_by_ktv_id || null
      }).eq('id', id);

      return { error: result.error };
    }
  } else {
    const { count, error: countError } = await supabase
      .from('session_logs')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', bookingId)
      .eq('status', 'completed');

    if (!countError) {
      const { data: currentBooking } = await supabase
        .from('bookings')
        .select('total_sessions, status, package_name')
        .eq('id', bookingId)
        .single();
      const today = getLocalDateString();
      const safeCount = count ?? 0;
      const bUpdates: Database['public']['Tables']['bookings']['Update'] = {
        completed_sessions: safeCount,
        last_updated_date: today,
        updated_at: new Date().toISOString()
      };

      if (safeCount > 0 && (currentBooking?.status === 'deposit_pending' || currentBooking?.status === 'booked' || currentBooking?.status === 'deposit')) {
        bUpdates.status = 'in_progress';
      }

      if (currentBooking?.total_sessions && safeCount >= currentBooking.total_sessions) {
        bUpdates.status = 'completed';
      }

      await supabase
        .from('bookings')
        .update(bUpdates)
        .eq('id', bookingId);
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
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

  const { data: existingLog } = await supabase
    .from('session_logs')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (currentUser?.role?.toLowerCase() !== 'admin' && !['scheduled', 'in_progress'].includes(existingLog?.status ?? '')) {
    return { error: 'Unauthorized' };
  }
  
  const { error } = await supabase
    .from('session_logs')
    .update({ notes: note })
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
    await supabase
      .from('session_logs')
      .update({ notes: existingLog?.notes || null })
      .eq('id', sessionId);
    return {
      error: auditErr instanceof Error ? auditErr.message : 'Failed to record saveSessionNote audit log'
    };
  }

  return { success: true };
}

export async function addExtraSession(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) return { error: fetchError?.message || 'Không tìm thấy booking' };
  
  const previousTotal = booking.total_sessions || 0;
  const newTotal = previousTotal + 1;
  
  const { error: updateBookingError } = await supabase
    .from('bookings')
    .update({ total_sessions: newTotal })
    .eq('id', bookingId);

  if (updateBookingError) {
    return { error: updateBookingError.message };
  }

  const sessionPayload: SessionLogInsert = {
    booking_id: bookingId,
    session_number: newTotal,
    status: 'scheduled',
    tenant_id: booking.tenant_id
  };

  const { data: insertedSession, error: insertSessionError } = await supabase
    .from('session_logs')
    .insert(sessionPayload)
    .select('id')
    .single();

  if (insertSessionError) {
    await supabase
      .from('bookings')
      .update({ total_sessions: previousTotal })
      .eq('id', bookingId);
    return { error: insertSessionError.message };
  }

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
    await supabase
      .from('session_logs')
      .delete()
      .eq('id', insertedSession.id);
    await supabase
      .from('bookings')
      .update({ total_sessions: previousTotal })
      .eq('id', bookingId);

    return {
      error: auditErr instanceof Error ? auditErr.message : 'Failed to record addExtraSession audit log'
    };
  }
  
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
  const supabase = await createClient();
  
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', data.booking_id);

  if (countError) {
    console.error('Error counting sessions:', countError);
    return { error: countError.message };
  }

  // Lấy tenant_id từ booking (required field cho session_logs)
  const { data: bookingRow } = await supabase
    .from('bookings')
    .select('tenant_id')
    .eq('id', data.booking_id)
    .single();

  const { data: session, error } = await supabase
    .from('session_logs')
    .insert([
      {
        booking_id: data.booking_id,
        session_number: (count || 0) + 1,
        assigned_date: data.assigned_date || null,
        assigned_time: sanitizeTime(data.assigned_time),
        notes: data.notes || null,
        status: data.status || 'scheduled',
        tenant_id: data.tenant_id || bookingRow?.tenant_id
      },
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
    if (session?.[0]?.id) {
      await supabase
        .from('session_logs')
        .delete()
        .eq('id', session[0].id);
    }
    return {
      error: auditErr instanceof Error ? auditErr.message : 'Failed to record createSessionLog audit log'
    };
  }

  await safeRevalidatePath('/dashboard/bookings');
  return { data: session };
}

export async function rescheduleSession(sessionId: string, newDate: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();

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
      .update({ assigned_date: newAssignedDate })
      .eq('id', s.id);
  });

  const results = await Promise.all(updates);
  const hasError = results.some(r => r.error);
  if (hasError) {
    return { error: 'Có lỗi xảy ra khi cập nhật một số buổi học.' };
  }

  const rollbackReschedule = async () => {
    await Promise.all((futureSessions || []).map((s: any) => {
      let rollbackDate = s.assigned_date;
      if (!rollbackDate) {
        const baseDate = new Date(effectiveOldDateStr);
        baseDate.setDate(baseDate.getDate() + (s.session_number - session.session_number));
        rollbackDate = getLocalDateString(baseDate);
      }

      return supabase
        .from('session_logs')
        .update({ assigned_date: rollbackDate })
        .eq('id', s.id);
    }));
  };

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
    await rollbackReschedule();
    return {
      error: auditErr instanceof Error ? auditErr.message : 'Failed to record rescheduleSession audit log'
    };
  }

  return { success: true };
}
