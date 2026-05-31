'use server';

import { safeRevalidatePath } from '@/lib/revalidate';
import {
  applyCompletionDefaults,
  isCompletingSession,
  normalizeSessionLogUpdate,
  processCompletedSessionUpdate,
  syncBookingProgressAfterSessionUpdate,
  type UpdateSessionLogInput,
} from './update-session-log-helpers';

export async function updateSessionLog(id: string, payload: UpdateSessionLogInput) {
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

  const { data: logData, error: logError } = await supabase
    .from('session_logs')
    .select('booking_id')
    .eq('id', id)
    .single();

  if (logError) return { error: logError.message };
  const bookingId = logData.booking_id;

  const normalizedUpdates = normalizeSessionLogUpdate(payload);
  const completionDefaultsResult = await applyCompletionDefaults(
    supabase,
    bookingId,
    normalizedUpdates,
    existingLog
  );

  if ('error' in completionDefaultsResult) {
    return { error: completionDefaultsResult.error };
  }

  const safeUpdates = completionDefaultsResult.data;

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

  if (isCompletingSession(safeUpdates, existingLog)) {
    const result = await processCompletedSessionUpdate({
      supabase,
      sessionId: id,
      bookingId,
      safeUpdates,
      existingLog,
      currentUser,
    });

    if (result.error) {
      return { error: result.error };
    }
  } else {
    const progressResult = await syncBookingProgressAfterSessionUpdate(supabase, bookingId);
    if (progressResult.error) {
      return { error: progressResult.error };
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
