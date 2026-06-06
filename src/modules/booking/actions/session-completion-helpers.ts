import { FINANCE_CONSTANTS } from '@/constants/finance';
import {
  calculateConfirmedPaidAmount,
  calculateSessionRevenueRecognition,
  type PaymentRevenueLike,
} from '@/lib/business-rules/payment';
import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import {
  buildRevenueAccountingMetadata,
  inferBusinessEventType,
  resolveAccountingReviewStatus,
} from '@/services/accounting/template-rules';
import type { Database } from '@/types/database.types';
import type { createClient } from '@/lib/supabase-server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type BookingUpdate = Database['public']['Tables']['bookings']['Update'];
type RevenueInsert = Database['public']['Tables']['revenue']['Insert'];
type SessionReviewInsert = Database['public']['Tables']['session_reviews']['Insert'];

type CompletionBooking = Pick<
  BookingRow,
  | 'total_sessions'
  | 'completed_sessions'
  | 'status'
  | 'package_name'
  | 'ktv_commission'
  | 'assigned_ktv_id'
  | 'tenant_id'
  | 'full_price'
  | 'deposit_amount'
  | 'discount_percent'
>;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

export async function validateCompletionAccountingPeriod(
  supabase: SupabaseServerClient,
  tenantId: string,
  today: string
) {
  try {
    await assertOpenAccountingPeriod(supabase, {
      tenantId,
      date: today,
      context: 'Complete booking session',
    });
    return { success: true };
  } catch (periodErr) {
    return {
      error: periodErr instanceof Error
        ? periodErr.message
        : 'Accounting period is closed or unavailable',
    };
  }
}

export async function consumeInventoryForCompletedSession(
  sessionId: string,
  packageId: string | null | undefined
) {
  if (!packageId) {
    return { isInventoryConsumed: false };
  }

  const { autoConsumeForSession } = await import('@/services/inventory-actions');
  const consumeResult = await autoConsumeForSession(packageId, sessionId);

  if (consumeResult && consumeResult.success === false) {
    return { error: consumeResult.error || 'Kho không đủ nguyên liệu để thực hiện ca dịch vụ này.' };
  }

  return {
    isInventoryConsumed: Boolean(consumeResult && consumeResult.success && !consumeResult.bypassed),
  };
}

export async function rollbackInventoryIfConsumed(sessionId: string, isInventoryConsumed: boolean) {
  if (!isInventoryConsumed) return;

  const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
  await rollbackInventoryConsumption(sessionId);
}

export async function restoreBookingProgress(
  supabase: SupabaseServerClient,
  bookingId: string,
  currentBooking: CompletionBooking | null
) {
  const rollbackPayload: BookingUpdate = {
    completed_sessions: currentBooking?.completed_sessions || 0,
    status: currentBooking?.status || 'booked',
  };

  await supabase
    .from('bookings')
    .update(rollbackPayload)
    .eq('id', bookingId);
}

export async function deleteSingleSessionRevenue(
  supabase: SupabaseServerClient,
  bookingId: string,
  packageName: string | null | undefined
) {
  await supabase
    .from('revenue')
    .delete()
    .eq('booking_id', bookingId)
    .eq('amount', FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE)
    .eq('notes', `Tự động: Thu phí dịch vụ lẻ - ${packageName}`);
}

export async function rollbackCompletionSideEffects(params: {
  supabase: SupabaseServerClient;
  sessionId: string;
  bookingId: string;
  currentBooking: CompletionBooking | null;
  isInventoryConsumed: boolean;
  isRevenueCreated?: boolean;
}) {
  const { supabase, sessionId, bookingId, currentBooking, isInventoryConsumed, isRevenueCreated } = params;

  if (isRevenueCreated) {
    await deleteSingleSessionRevenue(supabase, bookingId, currentBooking?.package_name);
  }

  await restoreBookingProgress(supabase, bookingId, currentBooking);
  await rollbackInventoryIfConsumed(sessionId, isInventoryConsumed);
}

export async function syncBookingCompletionProgress(params: {
  supabase: SupabaseServerClient;
  bookingId: string;
  today: string;
  sessionId: string;
  isInventoryConsumed: boolean;
}) {
  const { supabase, bookingId, today, sessionId, isInventoryConsumed } = params;

  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  if (countError) {
    await rollbackInventoryIfConsumed(sessionId, isInventoryConsumed);
    return { error: 'Lỗi đếm số buổi đã hoàn thành: ' + countError.message };
  }

  const { data: currentBooking } = await supabase
    .from('bookings')
    .select('total_sessions, completed_sessions, status, package_name, ktv_commission, assigned_ktv_id, tenant_id, full_price, deposit_amount, discount_percent')
    .eq('id', bookingId)
    .single();

  const bookingUpdates: BookingUpdate = {
    completed_sessions: count || 0,
    last_updated_date: today,
    updated_at: new Date().toISOString(),
  };

  if (
    count &&
    count > 0 &&
    (currentBooking?.status === 'deposit_pending' ||
      currentBooking?.status === 'booked' ||
      currentBooking?.status === 'deposit')
  ) {
    bookingUpdates.status = 'in_progress';
  }

  if (currentBooking?.total_sessions && count && count >= currentBooking.total_sessions) {
    bookingUpdates.status = 'completed';
  }

  const { error: bookingUpdateErr } = await supabase
    .from('bookings')
    .update(bookingUpdates)
    .eq('id', bookingId);

  if (bookingUpdateErr) {
    console.error('Error updating booking progress:', bookingUpdateErr);
    await rollbackInventoryIfConsumed(sessionId, isInventoryConsumed);
    return { error: 'Lỗi cập nhật tiến trình booking: ' + bookingUpdateErr.message };
  }

  return { currentBooking: currentBooking as CompletionBooking | null };
}

export async function recordSingleSessionRevenueIfNeeded(params: {
  supabase: SupabaseServerClient;
  bookingId: string;
  tenantId: string;
  today: string;
  currentBooking: CompletionBooking | null;
  sessionId: string;
  isInventoryConsumed: boolean;
}) {
  const { supabase, bookingId, tenantId, today, currentBooking, sessionId, isInventoryConsumed } = params;

  if (!currentBooking?.package_name?.toLowerCase().includes('lẻ')) {
    return { isRevenueCreated: false, createdRevenueId: null };
  }

  const revenueType = 'package_payment';
  const businessEventType = inferBusinessEventType({
    sourceTable: 'revenue',
    revenueType,
  });
  const accountingPayload = buildRevenueAccountingMetadata({
    revenueType,
    amount: FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE,
    paymentMethod: 'bank_transfer',
    bookingId,
    reason: `Tự động: Thu phí dịch vụ lẻ - ${currentBooking.package_name}`,
  });

  const revenuePayload: RevenueInsert = {
    booking_id: bookingId,
    amount: FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE,
    revenue_type: revenueType,
    payment_method: 'bank_transfer',
    received_date: today,
    status: 'confirmed',
    notes: `Tự động: Thu phí dịch vụ lẻ - ${currentBooking.package_name}`,
    tenant_id: tenantId,
    business_event_type: businessEventType,
    accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
    accounting_metadata: accountingPayload,
  };

  const { data: createdRevenue, error: revenueError } = await supabase
    .from('revenue')
    .insert([revenuePayload])
    .select('id')
    .single();

  if (revenueError) {
    console.error('Error auto-creating revenue:', revenueError);
    await rollbackCompletionSideEffects({
      supabase,
      sessionId,
      bookingId,
      currentBooking,
      isInventoryConsumed,
    });
    return { error: 'Không thể ghi nhận doanh thu tự động cho gói lẻ: ' + revenueError.message };
  }

  const createdRevenueId = createdRevenue?.id || null;
  if (!createdRevenueId) {
    return { isRevenueCreated: true, createdRevenueId: null };
  }

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

    await rollbackCompletionSideEffects({
      supabase,
      sessionId,
      bookingId,
      currentBooking,
      isInventoryConsumed,
    });

    return { error: 'Không thể ghi nhận hàng đợi kế toán cho doanh thu gói lẻ. Đã hoàn tác ca làm.' };
  }

  return { isRevenueCreated: true, createdRevenueId };
}

export async function syncKtvSalaryAfterCompletion(params: {
  supabase: SupabaseServerClient;
  ktvId: string | null;
  tenantId: string;
  today: string;
  sessionId: string;
  bookingId: string;
  currentBooking: CompletionBooking | null;
  isInventoryConsumed: boolean;
  isRevenueCreated: boolean;
}) {
  const { supabase, ktvId, tenantId, today, sessionId, bookingId, currentBooking, isInventoryConsumed, isRevenueCreated } = params;

  if (!ktvId || !tenantId) {
    return { success: true };
  }

  const monthYear = `${today.substring(0, 7)}-01`;
  let salaryError: Error | null = null;

  try {
    const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
    await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId);
  } catch (error) {
    salaryError = new Error(getErrorMessage(error));
  }

  if (!salaryError) {
    return { success: true };
  }

  console.error('[processSessionCompletion] Error updating salary record, rolling back...:', salaryError);
  await rollbackCompletionSideEffects({
    supabase,
    sessionId,
    bookingId,
    currentBooking,
    isInventoryConsumed,
    isRevenueCreated,
  });

  return { error: 'Không thể ghi nhận lương cho KTV. Đã hoàn tác ca làm: ' + salaryError.message };
}

export async function ensureSessionReviewPlaceholder(params: {
  supabase: SupabaseServerClient;
  sessionId: string;
  ktvId: string | null;
  tenantId: string;
  currentBooking: CompletionBooking | null;
}) {
  const { supabase, sessionId, ktvId, tenantId, currentBooking } = params;

  if (!currentBooking?.assigned_ktv_id) {
    return { success: true };
  }

  const { data: existingReview, error: reviewLookupError } = await supabase
    .from('session_reviews')
    .select('id')
    .eq('session_log_id', sessionId)
    .maybeSingle();

  if (reviewLookupError) {
    return { error: 'Không thể kiểm tra review chờ đánh giá: ' + reviewLookupError.message };
  }

  if (existingReview) {
    return { success: true };
  }

  const reviewPayload: SessionReviewInsert = {
    session_log_id: sessionId,
    reviewer_id: currentBooking.assigned_ktv_id,
    ktv_id: ktvId,
    rating: 5,
    note: 'Chờ khách hàng đánh giá',
    status: 'pending_review',
    tenant_id: tenantId,
  };

  const { error: reviewInsertError } = await supabase
    .from('session_reviews')
    .insert([reviewPayload]);

  if (reviewInsertError) {
    return { error: 'Không thể tạo review chờ đánh giá: ' + reviewInsertError.message };
  }

  return { success: true };
}

export async function enqueueSessionDoneAccountingOutbox(params: {
  supabase: SupabaseServerClient;
  sessionId: string;
  bookingId: string;
  tenantId: string;
  ktvId: string | null;
  today: string;
  existingLog: { session_number?: number | null } | null;
  currentBooking: CompletionBooking | null;
  isInventoryConsumed: boolean;
  isRevenueCreated: boolean;
}) {
  const {
    supabase,
    sessionId,
    bookingId,
    tenantId,
    ktvId,
    existingLog,
    currentBooking,
    isInventoryConsumed,
    isRevenueCreated,
  } = params;

  try {
    const currentSessionNumber = Math.max(1, Number(existingLog?.session_number || 1));
    const { data: revenueRows, error: revenueRowsError } = await supabase
      .from('revenue')
      .select('amount, status, revenue_type')
      .eq('booking_id', bookingId)
      .eq('tenant_id', tenantId);

    if (revenueRowsError) {
      throw new Error(`Failed to fetch confirmed booking payments: ${revenueRowsError.message}`);
    }

    const totalPaid = calculateConfirmedPaidAmount((revenueRows || []) as PaymentRevenueLike[]);
    const totalSessions = Number(currentBooking?.total_sessions || 1);
    const revenueRecognition = calculateSessionRevenueRecognition({
      fullPrice: currentBooking?.full_price,
      discountPercent: currentBooking?.discount_percent,
      totalSessions,
      currentSessionNumber,
      totalPaid,
    });
    const earnedRevenueAmount = revenueRecognition.earnedRevenueAmount;
    const deferredRevenueAmount = revenueRecognition.deferredRevenueAmount;
    const receivableAmount = revenueRecognition.receivableAmount;
    const commission = Number(currentBooking?.ktv_commission) || 0;

    const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
    const outboxEnqueued = await enqueueWithAutoClient(
      supabase,
      {
        tenantId,
        eventType: 'SESSION_DONE',
        referenceType: 'SESSION_LOG',
        referenceId: sessionId,
        payload: {
          earnedRevenueAmount,
          deferredRevenueAmount,
          receivableAmount,
          bookingId,
          commissionAmount: commission,
          ktvId: ktvId || currentBooking?.assigned_ktv_id || null,
          branchId: tenantId,
          description: `Hoàn thành buổi ${existingLog?.session_number || '--'}/${totalSessions} - ${currentBooking?.package_name || 'Gói dịch vụ'}`,
        },
      },
      '[processSessionCompletion]'
    );
    if (!outboxEnqueued) {
      throw new Error('Failed to enqueue SESSION_DONE accounting event');
    }

    return { success: true };
  } catch (outboxError) {
    const error = outboxError instanceof Error ? outboxError : new Error(String(outboxError));
    console.error('[processSessionCompletion] Error enqueuing accounting outbox event, rolling back...', error);

    await rollbackCompletionSideEffects({
      supabase,
      sessionId,
      bookingId,
      currentBooking,
      isInventoryConsumed,
      isRevenueCreated,
    });

    return { error: 'Không thể ghi nhận hàng đợi kế toán. Đã hoàn tác ca làm: ' + error.message };
  }
}
