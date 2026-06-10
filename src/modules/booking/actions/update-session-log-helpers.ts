import { getLocalDateString, sanitizeTime } from '@/lib/utils';
import { processSessionCompletion } from './session-completion-engine';
import type { createClient } from '@/lib/supabase-server';
import type { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
type SessionLogUpdate = Database['public']['Tables']['session_logs']['Update'];
type BookingUpdate = Database['public']['Tables']['bookings']['Update'];

type AllowedUpdateKey =
  | 'assigned_date'
  | 'completed_date'
  | 'completed_by_ktv_id'
  | 'address'
  | 'status'
  | 'notes'
  | 'assigned_time';

export type UpdateSessionLogInput = Partial<Pick<SessionLogUpdate, AllowedUpdateKey>>;

const ALLOWED_UPDATE_KEYS: AllowedUpdateKey[] = [
  'assigned_date',
  'completed_date',
  'completed_by_ktv_id',
  'address',
  'status',
  'notes',
  'assigned_time',
];

function getErrorMessage(error: unknown, fallback = 'Lỗi hệ thống') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export function normalizeSessionLogUpdate(payload: UpdateSessionLogInput): UpdateSessionLogInput {
  const updates: UpdateSessionLogInput = { ...payload };

  if (updates.assigned_date === '' || updates.assigned_date === 'dd/mm/yyyy') {
    updates.assigned_date = null;
  }

  if (updates.assigned_time === '' || updates.assigned_time === '--:-- --') {
    updates.assigned_time = null;
  } else if (updates.assigned_time !== undefined) {
    updates.assigned_time = sanitizeTime(updates.assigned_time);
  }

  if (updates.notes === '') {
    updates.notes = null;
  }

  const safeUpdates: UpdateSessionLogInput = {};
  for (const key of ALLOWED_UPDATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      safeUpdates[key] = updates[key];
    }
  }

  return safeUpdates;
}

export function isCompletingSession(safeUpdates: UpdateSessionLogInput, existingLog: SessionLogRow) {
  return safeUpdates.status === 'completed' && existingLog.status !== 'completed';
}

export async function applyCompletionDefaults(
  supabase: SupabaseServerClient,
  bookingId: string,
  tenantId: string,
  safeUpdates: UpdateSessionLogInput,
  existingLog: SessionLogRow
) {
  if (!isCompletingSession(safeUpdates, existingLog)) {
    return { data: safeUpdates };
  }

  const completedUpdates: UpdateSessionLogInput = { ...safeUpdates };
  if (!completedUpdates.completed_date) {
    completedUpdates.completed_date = new Date().toISOString();
  }

  if (!completedUpdates.completed_by_ktv_id) {
    const { data: bookingData, error } = await supabase
      .from('bookings')
      .select('assigned_ktv_id')
      .eq('id', bookingId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      return { error: error.message };
    }

    if (bookingData?.assigned_ktv_id) {
      completedUpdates.completed_by_ktv_id = bookingData.assigned_ktv_id;
    }
  }

  return { data: completedUpdates };
}

export async function processCompletedSessionUpdate(params: {
  supabase: SupabaseServerClient;
  sessionId: string;
  bookingId: string;
  safeUpdates: UpdateSessionLogInput;
  existingLog: SessionLogRow;
  currentUser: CurrentUser;
}) {
  const { supabase, sessionId, bookingId, safeUpdates, existingLog, currentUser } = params;
  const tenantId = currentUser?.tenant_id || existingLog.tenant_id;
  if (!tenantId) {
    return { error: 'Không xác định được chi nhánh khi xử lý hoàn thành buổi.' };
  }

  if (!existingLog.booking_id || existingLog.booking_id !== bookingId) {
    return { error: 'Buổi dịch vụ không thuộc booking hiện tại.' };
  }

  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .select('assigned_ktv_id, package_id')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .single();

  if (bookingError) {
    return { error: bookingError.message };
  }

  const today = getLocalDateString();
  const ktvId = safeUpdates.completed_by_ktv_id || bookingData?.assigned_ktv_id || null;

  const result = await processSessionCompletion(
    supabase,
    sessionId,
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
    const { error: rollbackError } = await supabase
      .from('session_logs')
      .update({
        status: existingLog.status || 'scheduled',
        completed_date: existingLog.completed_date || null,
        completed_by_ktv_id: existingLog.completed_by_ktv_id || null,
      })
      .eq('id', sessionId)
      .eq('tenant_id', tenantId);

    if (rollbackError) {
      return { error: `${result.error}; rollback session failed: ${rollbackError.message}` };
    }

    if (ktvId && tenantId) {
      try {
        const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
        const monthYear = `${today.substring(0, 7)}-01`;
        await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId);
      } catch (salaryRollbackError) {
        return { error: `${result.error}; rollback salary failed: ${getErrorMessage(salaryRollbackError)}` };
      }
    }

    return { error: result.error };
  }

  return { success: true };
}

export async function syncBookingProgressAfterSessionUpdate(
  supabase: SupabaseServerClient,
  bookingId: string,
  tenantId: string
) {
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('tenant_id', tenantId)
    .eq('status', 'completed');

  if (countError) {
    return { error: countError.message };
  }

  const { data: currentBooking, error: bookingError } = await supabase
    .from('bookings')
    .select('total_sessions, status, package_name')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .single();

  if (bookingError) {
    return { error: bookingError.message };
  }

  const safeCount = count ?? 0;
  const bookingUpdates: BookingUpdate = {
    completed_sessions: safeCount,
    last_updated_date: getLocalDateString(),
    updated_at: new Date().toISOString(),
  };

  if (
    safeCount > 0 &&
    (currentBooking?.status === 'deposit_pending' ||
      currentBooking?.status === 'booked' ||
      currentBooking?.status === 'deposit')
  ) {
    bookingUpdates.status = 'in_progress';
  }

  if (currentBooking?.total_sessions && safeCount >= currentBooking.total_sessions) {
    bookingUpdates.status = 'completed';
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update(bookingUpdates)
    .eq('id', bookingId)
    .eq('tenant_id', tenantId);

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true };
}
