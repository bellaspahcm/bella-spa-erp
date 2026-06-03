import {
  consumeInventoryForCompletedSession,
  enqueueSessionDoneAccountingOutbox,
  ensureSessionReviewPlaceholder,
  recordSingleSessionRevenueIfNeeded,
  rollbackCompletionSideEffects,
  syncBookingCompletionProgress,
  syncKtvSalaryAfterCompletion,
  validateCompletionAccountingPeriod,
} from './session-completion-helpers';
import type { createClient } from '@/lib/supabase-server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ExistingSessionLog = { session_number?: number | null } | null;

/**
 * Logic dùng chung để chốt ca làm việc, xử lý trừ kho, tính lương KTV và rollback toàn diện khi lỗi.
 */
export async function processSessionCompletion(
  supabase: SupabaseServerClient,
  sessionId: string,
  bookingId: string,
  tenantId: string | null | undefined,
  ktvId: string | null | undefined,
  today: string,
  packageId: string | null | undefined,
  existingLog: ExistingSessionLog,
  _currentUser: unknown
) {
  void _currentUser;

  if (!tenantId) {
    return { error: 'Không xác định được chi nhánh khi chốt ca làm việc.' };
  }
  const resolvedKtvId = ktvId || null;

  const accountingPeriodResult = await validateCompletionAccountingPeriod(supabase, tenantId, today);
  if ('error' in accountingPeriodResult) {
    return { error: accountingPeriodResult.error };
  }

  const inventoryResult = await consumeInventoryForCompletedSession(sessionId, packageId);
  if ('error' in inventoryResult) {
    return { error: inventoryResult.error };
  }
  const isInventoryConsumed = inventoryResult.isInventoryConsumed;

  const bookingProgressResult = await syncBookingCompletionProgress({
    supabase,
    bookingId,
    today,
    sessionId,
    isInventoryConsumed,
  });
  if ('error' in bookingProgressResult) {
    return { error: bookingProgressResult.error };
  }
  const currentBooking = bookingProgressResult.currentBooking;

  const revenueResult = await recordSingleSessionRevenueIfNeeded({
    supabase,
    bookingId,
    tenantId,
    today,
    currentBooking,
    sessionId,
    isInventoryConsumed,
  });
  if ('error' in revenueResult) {
    return { error: revenueResult.error };
  }
  const isRevenueCreated = revenueResult.isRevenueCreated;

  const salaryResult = await syncKtvSalaryAfterCompletion({
    supabase,
    ktvId: resolvedKtvId,
    tenantId,
    today,
    sessionId,
    bookingId,
    currentBooking,
    isInventoryConsumed,
    isRevenueCreated,
  });
  if ('error' in salaryResult) {
    return { error: salaryResult.error };
  }

  const reviewResult = await ensureSessionReviewPlaceholder({
    supabase,
    sessionId,
    ktvId: resolvedKtvId,
    tenantId,
    currentBooking,
  });
  if ('error' in reviewResult) {
    await rollbackCompletionSideEffects({
      supabase,
      sessionId,
      bookingId,
      currentBooking,
      isInventoryConsumed,
      isRevenueCreated,
    });
    return { error: reviewResult.error };
  }

  const outboxResult = await enqueueSessionDoneAccountingOutbox({
    supabase,
    sessionId,
    bookingId,
    tenantId,
    ktvId: resolvedKtvId,
    today,
    existingLog,
    currentBooking,
    isInventoryConsumed,
    isRevenueCreated,
  });
  if ('error' in outboxResult) {
    return { error: outboxResult.error };
  }

  return { success: true };
}
