import { FINANCE_CONSTANTS } from '@/constants/finance';
import { BookingError } from '@/core/lib/errors';
import {
  calculateConfirmedPaidAmount,
  calculateSessionRevenueRecognition,
  type PaymentRevenueLike,
} from '@/lib/business-rules/payment';
import {
  buildCompletionRollbackPayload,
  calculateBookingCompletionUpdate,
  formatRollbackAppend,
  shouldCreateSingleSessionRevenue,
} from '@/lib/business-rules/session-completion';
import {
  buildPackageSaleOutboxEvent,
  buildSessionDoneOutboxEvent,
} from '@/lib/business-rules/accounting-outbox';
import { assertOpenAccountingPeriod } from '@/core/services/accounting/period-guards';
import {
  buildRevenueAccountingMetadata,
  inferBusinessEventType,
  resolveAccountingReviewStatus,
} from '@/core/services/accounting/template-rules';
import type { CoreBookingOrder, BookingOrderStatus } from '@/core/types/booking-order';
import type { ModuleId } from '@/core/types/module';
import type { Database, Json } from '@/types/database.types';
import type { createClient } from '@/lib/supabase-server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type BookingUpdate = Database['public']['Tables']['bookings']['Update'];
type RevenueInsert = Database['public']['Tables']['revenue']['Insert'];
type SessionLogUpdate = Database['public']['Tables']['session_logs']['Update'];
type SessionReviewInsert = Database['public']['Tables']['session_reviews']['Insert'];

type CompletionBooking = Pick<
  BookingRow,
  | 'total_sessions'
  | 'completed_sessions'
  | 'status'
  | 'package_name'
  | 'package_id'
  | 'start_date'
  | 'end_date'
  | 'ktv_commission'
  | 'assigned_ktv_id'
  | 'customer_id'
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
  if (!isInventoryConsumed) return { success: true };

  const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
  const rollbackResult = await rollbackInventoryConsumption(sessionId);
  if (rollbackResult && rollbackResult.success === false) {
    return { error: rollbackResult.error || 'Không thể hoàn tác tiêu hao kho' };
  }

  return { success: true };
}

function isJsonObject(value: Json | null | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampDiscountPercent(value: number | string | null | undefined) {
  return Math.min(Math.max(asFiniteNumber(value), 0), 100);
}

export function buildCompletedSessionAccountingUpdate(input: {
  sessionId: string;
  bookingId: string;
  completedByKtvId?: string | null;
  completedDate?: string | null;
  fullPrice?: number | string | null;
  discountPercent?: number | string | null;
  totalSessions?: number | string | null;
  existingAccountingMetadata?: Json | null;
  existingAccountingReviewStatus?: string | null;
}): Pick<SessionLogUpdate, 'business_event_type' | 'accounting_review_status' | 'accounting_metadata'> {
  const businessEventType = inferBusinessEventType({
    sourceTable: 'session_logs',
    status: 'completed',
  });
  const discountedPrice = Math.max(
    0,
    asFiniteNumber(input.fullPrice) * (1 - clampDiscountPercent(input.discountPercent) / 100),
  );
  const earnedRevenue = discountedPrice / Math.max(asFiniteNumber(input.totalSessions, 1), 1);
  const accountingMetadata: { [key: string]: Json | undefined } = {
    ...(isJsonObject(input.existingAccountingMetadata) ? input.existingAccountingMetadata : {}),
    session_log_id: input.sessionId,
    booking_id: input.bookingId,
    earned_revenue: earnedRevenue,
    completed_by_ktv_id: input.completedByKtvId ?? null,
    completed_date: input.completedDate ?? null,
    status: 'completed',
  };

  return {
    business_event_type: businessEventType,
    accounting_review_status: input.existingAccountingReviewStatus === 'POSTING_FAILED'
      ? 'POSTING_FAILED'
      : resolveAccountingReviewStatus(businessEventType, accountingMetadata),
    accounting_metadata: accountingMetadata,
  };
}

export async function restoreBookingProgress(
  supabase: SupabaseServerClient,
  bookingId: string,
  currentBooking: CompletionBooking | null
) {
  const rollbackPayload: BookingUpdate = buildCompletionRollbackPayload(currentBooking);

  const { error } = await supabase
    .from('bookings')
    .update(rollbackPayload)
    .eq('id', bookingId);

  return error?.message || '';
}

export async function deleteSingleSessionRevenue(
  supabase: SupabaseServerClient,
  bookingId: string,
  packageName: string | null | undefined,
  revenueId?: string | null
) {
  const deleteQuery = supabase
    .from('revenue')
    .delete();

  const { error } = revenueId
    ? await deleteQuery.eq('id', revenueId)
    : await deleteQuery
    .eq('booking_id', bookingId)
    .eq('amount', FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE)
    .eq('notes', `Tự động: Thu phí dịch vụ lẻ - ${packageName}`);

  return error?.message || '';
}

export async function rollbackCompletionSideEffects(params: {
  supabase: SupabaseServerClient;
  sessionId: string;
  bookingId: string;
  currentBooking: CompletionBooking | null;
  isInventoryConsumed: boolean;
  isRevenueCreated?: boolean;
  createdRevenueId?: string | null;
}) {
  const { supabase, sessionId, bookingId, currentBooking, isInventoryConsumed, isRevenueCreated, createdRevenueId } = params;
  const rollbackFailures: string[] = [];

  if (isRevenueCreated) {
    const revenueRollbackError = await deleteSingleSessionRevenue(
      supabase,
      bookingId,
      currentBooking?.package_name,
      createdRevenueId,
    );
    if (revenueRollbackError) {
      rollbackFailures.push(`revenue rollback failed: ${revenueRollbackError}`);
    }
  }

  const bookingRollbackError = await restoreBookingProgress(supabase, bookingId, currentBooking);
  if (bookingRollbackError) {
    rollbackFailures.push(`booking progress rollback failed: ${bookingRollbackError}`);
  }

  const inventoryRollbackResult = await rollbackInventoryIfConsumed(sessionId, isInventoryConsumed);
  if ('error' in inventoryRollbackResult) {
    rollbackFailures.push(`inventory rollback failed: ${inventoryRollbackResult.error}`);
  }

  return rollbackFailures.length > 0
    ? { error: rollbackFailures.join('; ') }
    : { success: true };
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
    const rollbackResult = await rollbackInventoryIfConsumed(sessionId, isInventoryConsumed);
    const rollbackMessage = formatRollbackAppend(rollbackResult);
    return { error: 'Lỗi đếm số buổi đã hoàn thành: ' + countError.message + rollbackMessage };
  }

  const { data: currentBooking } = await supabase
    .from('bookings')
    .select('total_sessions, completed_sessions, status, package_name, ktv_commission, assigned_ktv_id, customer_id, tenant_id, full_price, deposit_amount, discount_percent')
    .eq('id', bookingId)
    .single();

  const bookingUpdates: BookingUpdate = calculateBookingCompletionUpdate({
    completedSessionCount: count,
    currentBooking,
    today,
  });

  const { error: bookingUpdateErr } = await supabase
    .from('bookings')
    .update(bookingUpdates)
    .eq('id', bookingId);

  if (bookingUpdateErr) {
    console.error('Error updating booking progress:', bookingUpdateErr);
    const rollbackResult = await rollbackInventoryIfConsumed(sessionId, isInventoryConsumed);
    const rollbackMessage = formatRollbackAppend(rollbackResult);
    return { error: 'Lỗi cập nhật tiến trình booking: ' + bookingUpdateErr.message + rollbackMessage };
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

  const packageName = currentBooking?.package_name ?? '';
  if (!shouldCreateSingleSessionRevenue(packageName)) {
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
    reason: `Tự động: Thu phí dịch vụ lẻ - ${packageName}`,
  });

  const revenuePayload: RevenueInsert = {
    booking_id: bookingId,
    amount: FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE,
    revenue_type: revenueType,
    payment_method: 'bank_transfer',
    received_date: today,
    status: 'confirmed',
    notes: `Tự động: Thu phí dịch vụ lẻ - ${packageName}`,
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
    const rollbackResult = await rollbackCompletionSideEffects({
      supabase,
      sessionId,
      bookingId,
      currentBooking,
      isInventoryConsumed,
    });
    const rollbackMessage = formatRollbackAppend(rollbackResult);
    return { error: 'Không thể ghi nhận doanh thu tự động cho gói lẻ: ' + revenueError.message + rollbackMessage };
  }

  const createdRevenueId = createdRevenue?.id || null;
  if (!createdRevenueId) {
    const rollbackResult = await rollbackCompletionSideEffects({
      supabase,
      sessionId,
      bookingId,
      currentBooking,
      isInventoryConsumed,
      isRevenueCreated: true,
      createdRevenueId,
    });

    const rollbackMessage = formatRollbackAppend(rollbackResult);
    return { error: 'Không xác định được mã doanh thu tự động vừa tạo. Đã hoàn tác ca làm.' + rollbackMessage };
  }

  const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
  const outboxEnqueued = await enqueueWithAutoClient(
    supabase,
    buildPackageSaleOutboxEvent({
      tenantId,
      revenueId: createdRevenueId,
      totalAmount: FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE,
      description: accountingPayload.reason,
    }),
    '[processSessionCompletion:single-session-revenue]'
  );

  if (!outboxEnqueued) {
    const rollbackResult = await rollbackCompletionSideEffects({
      supabase,
      sessionId,
      bookingId,
      currentBooking,
      isInventoryConsumed,
      isRevenueCreated: true,
      createdRevenueId,
    });

    const rollbackMessage = formatRollbackAppend(rollbackResult);
    return { error: 'Không thể ghi nhận hàng đợi kế toán cho doanh thu gói lẻ. Đã hoàn tác ca làm.' + rollbackMessage };
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
  createdRevenueId?: string | null;
}) {
  const {
    supabase,
    ktvId,
    tenantId,
    today,
    sessionId,
    bookingId,
    currentBooking,
    isInventoryConsumed,
    isRevenueCreated,
    createdRevenueId,
  } = params;

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
  const rollbackResult = await rollbackCompletionSideEffects({
    supabase,
    sessionId,
    bookingId,
    currentBooking,
    isInventoryConsumed,
    isRevenueCreated,
    createdRevenueId,
  });

  const rollbackMessage = formatRollbackAppend(rollbackResult);
  return { error: 'Không thể ghi nhận lương cho KTV. Đã hoàn tác ca làm: ' + salaryError.message + rollbackMessage };
}

export async function ensureSessionReviewPlaceholder(params: {
  supabase: SupabaseServerClient;
  sessionId: string;
  ktvId: string | null;
  tenantId: string;
  currentBooking: CompletionBooking | null;
}) {
  const { supabase, sessionId, ktvId, tenantId, currentBooking } = params;

  if (!currentBooking?.assigned_ktv_id || !currentBooking.customer_id) {
    return { success: true };
  }

  if (currentBooking.tenant_id !== tenantId) {
    return { error: 'Booking không thuộc chi nhánh hiện tại, không thể tạo review chờ đánh giá.' };
  }

  const { data: existingReview, error: reviewLookupError } = await supabase
    .from('session_reviews')
    .select('id')
    .eq('session_log_id', sessionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (reviewLookupError) {
    return { error: 'Không thể kiểm tra review chờ đánh giá: ' + reviewLookupError.message };
  }

  if (existingReview) {
    return { success: true };
  }

  const reviewPayload: SessionReviewInsert = {
    session_log_id: sessionId,
    reviewer_id: currentBooking.customer_id,
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
  createdRevenueId?: string | null;
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
    createdRevenueId,
  } = params;

  try {
    const currentSessionNumber = Math.max(1, Number(existingLog?.session_number || 1));
    const { data: revenueRows, error: revenueRowsError } = await supabase
      .from('revenue')
      .select('amount, status, revenue_type')
      .eq('booking_id', bookingId)
      .eq('tenant_id', tenantId);

    if (revenueRowsError) {
      throw new BookingError(`Failed to fetch confirmed booking payments: ${revenueRowsError.message}`, 'BOOKING_PAYMENT_FETCH_ERROR', { bookingId });
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
      buildSessionDoneOutboxEvent({
        tenantId,
        sessionLogId: sessionId,
        bookingId,
        ktvId: ktvId || currentBooking?.assigned_ktv_id || null,
        earnedRevenueAmount,
        deferredRevenueAmount,
        receivableAmount,
        commissionAmount: commission,
        description: `Hoàn thành buổi ${existingLog?.session_number || '--'}/${totalSessions} - ${currentBooking?.package_name || 'Gói dịch vụ'}`,
      }),
      '[processSessionCompletion]'
    );
    if (!outboxEnqueued) {
      throw new BookingError('Failed to enqueue SESSION_DONE accounting event', 'BOOKING_ACCOUNTING_ENQUEUE_ERROR', { sessionLogId: sessionId, bookingId });
    }

    return { success: true };
  } catch (outboxError) {
    const error = outboxError instanceof Error ? outboxError : new Error(String(outboxError));
    console.error('[processSessionCompletion] Error enqueuing accounting outbox event, rolling back...', error);

    const rollbackResult = await rollbackCompletionSideEffects({
      supabase,
      sessionId,
      bookingId,
      currentBooking,
      isInventoryConsumed,
      isRevenueCreated,
      createdRevenueId,
    });

    const rollbackMessage = formatRollbackAppend(rollbackResult);
    return { error: 'Không thể ghi nhận hàng đợi kế toán. Đã hoàn tác ca làm: ' + error.message + rollbackMessage };
  }
}

/**
 * Invoke module adapter onBookingCompleted for side effects after order completion.
 * 
 * Task 19.3: Call adapter.onBookingCompleted() to handle module-specific side effects
 * such as salary updates, inventory deductions, and loyalty points.
 * 
 * @param params - Parameters including supabase, bookingId, tenantId, and current booking
 * @returns Success or error
 */
export async function invokeAdapterOnCompletion(params: {
  supabase: SupabaseServerClient;
  bookingId: string;
  tenantId: string;
  currentBooking: CompletionBooking | null;
}): Promise<{ success: true } | { error: string }> {
  const { supabase, bookingId, tenantId, currentBooking } = params;

  if (!currentBooking) {
    console.warn('[invokeAdapterOnCompletion] No booking found, skipping adapter call');
    return { success: true };
  }

  // Import tenant context construction helper
  const { constructTenantContextForBooking } = await import('./create-booking-helpers');
  const contextResult = await constructTenantContextForBooking(supabase, tenantId);

  if ('error' in contextResult) {
    console.error('[invokeAdapterOnCompletion] Failed to construct tenant context:', contextResult.error);
    return { error: contextResult.error };
  }

  const context = contextResult.context;

  // Determine module ID from enabled modules (default to 'spa')
  const moduleId = context.enabledModules.length > 0 
    ? context.enabledModules[0] 
    : 'spa';

  // Import module registry
  const { moduleRegistry } = await import('@/core/adapters/registry');
  const adapter = moduleRegistry.get(moduleId as ModuleId);

  // If no adapter registered, skip gracefully
  if (!adapter) {
    console.log(`[invokeAdapterOnCompletion] No adapter found for module '${moduleId}', skipping completion callback`);
    return { success: true };
  }

  // If adapter doesn't implement onBookingCompleted, skip
  if (!adapter.onBookingCompleted) {
    console.log(`[invokeAdapterOnCompletion] Adapter '${moduleId}' does not implement onBookingCompleted, skipping`);
    return { success: true };
  }

  // Transform booking to CoreBookingOrder for adapter
  // Map database status to CoreBookingOrder status
  const mapStatus = (dbStatus: string | null | undefined): BookingOrderStatus => {
    if (!dbStatus) return 'completed';
    if (dbStatus === 'deposit_pending' || dbStatus === 'pending') return 'draft';
    if (dbStatus === 'confirmed' || dbStatus === 'active' || dbStatus === 'booked') return 'confirmed';
    if (dbStatus === 'in_progress') return 'in_progress';
    if (dbStatus === 'completed') return 'completed';
    if (dbStatus === 'cancelled') return 'cancelled';
    return 'completed'; // Default fallback for completion context
  };

  const coreOrder: CoreBookingOrder = {
    id: bookingId,
    tenantId,
    moduleId: (context.enabledModules[0] || 'spa') as ModuleId,
    customerId: currentBooking.customer_id || '',
    serviceItemId: currentBooking.package_id || '',
    status: mapStatus(currentBooking.status),
    totalAmount: asFiniteNumber(currentBooking.full_price),
    paidAmount: asFiniteNumber(currentBooking.deposit_amount),
    scheduledStartTime: currentBooking.start_date || '',
    scheduledEndTime: currentBooking.end_date || '',
    metadata: {
      assigned_ktv_id: currentBooking.assigned_ktv_id,
      sessions_total: currentBooking.total_sessions,
      sessions_completed: currentBooking.completed_sessions,
      package_name: currentBooking.package_name,
      ktv_commission: currentBooking.ktv_commission,
      original_db_status: currentBooking.status,
    },
  };

  try {
    console.log(`[invokeAdapterOnCompletion] Calling adapter.onBookingCompleted for module '${moduleId}'`);
    await adapter.onBookingCompleted(coreOrder, context);
    console.log(`[invokeAdapterOnCompletion] Adapter completion callback successful for module '${moduleId}'`);
    return { success: true };
  } catch (error) {
    console.error(`[invokeAdapterOnCompletion] Adapter completion callback failed:`, error);
    // Don't fail the completion - log error and continue
    // The booking is already completed, adapter side effects are non-critical
    return {
      error: error instanceof Error 
        ? `Lỗi xử lý hậu quả module: ${error.message}` 
        : 'Lỗi xử lý hậu quả module',
    };
  }
}
