'use server';

import { getLocalDateString, sanitizeTime } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import { findMissingRequiredFields, inferBusinessEventType } from '@/services/accounting/template-rules';
import { syncBookingProgress } from './lifecycle-actions';
import type { Database } from '@/types/database.types';
import { FINANCE_CONSTANTS } from '@/constants/finance';
import {
  getCalendarSessions as getCalendarSessionsAction,
  getSessionLogs as getSessionLogsAction,
  getSessionsWithDetails as getSessionsWithDetailsAction,
} from './session-query-actions';
import {
  addExtraSession as addExtraSessionAction,
  createSessionLog as createSessionLogAction,
  rescheduleSession as rescheduleSessionAction,
  saveSessionNote as saveSessionNoteAction,
} from './session-mutation-actions';

export async function saveSessionNote(sessionId: string, note: string) {
  return saveSessionNoteAction(sessionId, note);
}

export async function addExtraSession(bookingId: string) {
  return addExtraSessionAction(bookingId);
}

export async function createSessionLog(data: Parameters<typeof createSessionLogAction>[0]) {
  return createSessionLogAction(data);
}

export async function rescheduleSession(sessionId: string, newDate: string) {
  return rescheduleSessionAction(sessionId, newDate);
}

export async function getSessionLogs(bookingId: string) {
  return getSessionLogsAction(bookingId);
}

export async function getSessionsWithDetails() {
  return getSessionsWithDetailsAction();
}

export async function getCalendarSessions() {
  return getCalendarSessionsAction();
}

function resolveAccountingReviewStatus(
  businessEventType: ReturnType<typeof inferBusinessEventType>,
  payload: Record<string, unknown>
) {
  if (!businessEventType) return 'NEEDS_REVIEW';
  return findMissingRequiredFields(businessEventType, payload).length > 0
    ? 'NEEDS_REVIEW'
    : 'UNREVIEWED';
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
  try {
    await assertOpenAccountingPeriod(supabase, {
      tenantId,
      date: today,
      context: 'Complete booking session',
    });
  } catch (periodErr) {
    return {
      error: periodErr instanceof Error
        ? periodErr.message
        : 'Accounting period is closed or unavailable',
    };
  }

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
    if (isInventoryConsumed) {
      const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
      await rollbackInventoryConsumption(sessionId);
    }
    return { error: 'Lỗi đếm số buổi đã hoàn thành: ' + countError.message };
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
  let createdRevenueId: string | null = null;
  if (currentBooking?.package_name?.toLowerCase().includes('lẻ')) {
    const businessEventType = inferBusinessEventType({
      sourceTable: 'revenue',
      revenueType: 'package_payment',
    });
    const accountingPayload = {
      amount: FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE,
      payment_method: 'bank_transfer',
      booking_id: bookingId,
      reason: `Tự động: Thu phí dịch vụ lẻ - ${currentBooking.package_name}`,
    };

    const { data: createdRevenue, error: revErr } = await supabase.from('revenue').insert([{
      booking_id: bookingId,
      amount: FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE,
      revenue_type: 'package_payment',
      payment_method: 'bank_transfer',
      received_date: today,
      status: 'confirmed',
      notes: `Tự động: Thu phí dịch vụ lẻ - ${currentBooking.package_name}`,
      tenant_id: tenantId,
      business_event_type: businessEventType,
      accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
      accounting_metadata: accountingPayload
    }]).select('id').single();

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
    createdRevenueId = createdRevenue?.id || null;

    if (createdRevenueId) {
      const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
      const outboxEnqueued = await enqueueWithAutoClient(
        supabase,
        {
          tenantId,
          eventType: 'PACKAGE_SALE',
          referenceType: 'REVENUE',
          referenceId: createdRevenueId,
          payload: {
            totalAmount: FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE,
            vatRate: 0,
            description: accountingPayload.reason,
            branchId: tenantId,
          },
        },
        '[processSessionCompletion:single-session-revenue]'
      );

      if (!outboxEnqueued) {
        await supabase
          .from('revenue')
          .delete()
          .eq('id', createdRevenueId);

        await supabase.from('bookings').update({
          completed_sessions: currentBooking?.completed_sessions || 0,
          status: currentBooking?.status || 'booked'
        }).eq('id', bookingId);

        if (isInventoryConsumed) {
          const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
          await rollbackInventoryConsumption(sessionId);
        }

        return { error: 'Không thể ghi nhận hàng đợi kế toán cho doanh thu gói lẻ. Đã hoàn tác ca làm.' };
      }
    }
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
