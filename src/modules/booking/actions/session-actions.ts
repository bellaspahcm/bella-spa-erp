'use server';

import { getLocalDateString, sanitizeTime } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import { syncBookingProgress } from './lifecycle-actions';
import { processSessionCompletion } from './session-completion-engine';
import { completeSession as completeSessionAction } from './complete-session-action';
import type { Database } from '@/types/database.types';
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

export async function completeSession(sessionId: string, bookingId: string, customNote?: string) {
  return completeSessionAction(sessionId, bookingId, customNote);
}

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
