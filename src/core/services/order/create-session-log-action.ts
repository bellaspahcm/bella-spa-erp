'use server';

import { sanitizeTime } from '@bella/shared';;
import { safeRevalidatePath } from '@/lib/revalidate';
import { validateBookingResourceSchedule } from './booking-resource-schedule-guard';
import type { Database } from '@/types/database.types';

type SessionLogInsert = Database['public']['Tables']['session_logs']['Insert'];
type CreateSessionLogInput = Pick<SessionLogInsert, 'booking_id'> &
  Partial<Pick<SessionLogInsert, 'assigned_date' | 'assigned_time' | 'booking_resource_id' | 'notes' | 'status'>>;

export async function createSessionLog(data: CreateSessionLogInput) {
  const { createDevelopmentBypassClient } = await import('@/lib/supabase-dev-bypass-server');
  const supabase = await createDevelopmentBypassClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || null;

  if (!tenantId) {
    return { error: 'Khong xac dinh duoc chi nhanh cho lich hen.' };
  }

  const [bookingResult, sessionCountResult] = await Promise.all([
    supabase
      .from('bookings')
      .select('tenant_id')
      .eq('id', data.booking_id)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('session_logs')
      .select('*', { count: 'exact', head: true })
      .eq('booking_id', data.booking_id)
      .eq('tenant_id', tenantId),
  ]);

  const { data: bookingRow, error: bookingError } = bookingResult;
  const { count, error: countError } = sessionCountResult;

  if (bookingError) {
    return { error: bookingError.message };
  }
  if (!bookingRow) {
    return { error: 'Khong tim thay booking hop le trong chi nhanh hien tai.' };
  }
  if (countError) {
    console.error('Error counting sessions:', countError);
    return { error: countError.message };
  }

  const assignedTime = sanitizeTime(data.assigned_time);
  const resourceScheduleResult = await validateBookingResourceSchedule({
    supabase,
    tenantId,
    bookingResourceId: data.booking_resource_id || null,
    assignedDate: data.assigned_date || null,
    assignedTime,
    status: data.status || 'scheduled',
  });

  if ('error' in resourceScheduleResult) {
    return { error: resourceScheduleResult.error };
  }

  const sessionPayload: SessionLogInsert = {
    booking_id: data.booking_id,
    session_number: (count || 0) + 1,
    assigned_date: data.assigned_date || null,
    assigned_time: assignedTime,
    booking_resource_id: data.booking_resource_id || null,
    notes: data.notes || null,
    status: data.status || 'scheduled',
    tenant_id: tenantId
  };

  const { data: session, error } = await supabase
    .from('session_logs')
    .insert([sessionPayload])
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
        new_data: session[0],
        tenant_id: tenantId,
        changed_by_id: currentUser?.id ?? null,
        supabase
      });
    }
  } catch (auditErr) {
    if (session?.[0]?.id) {
      await supabase
        .from('session_logs')
        .delete()
        .eq('id', session[0].id)
        .eq('tenant_id', tenantId);
    }
    return {
      error: auditErr instanceof Error ? auditErr.message : 'Failed to record createSessionLog audit log'
    };
  }

  void safeRevalidatePath('/dashboard/bookings').catch((error) => {
    console.error('[createSessionLog] Background revalidation failed:', error);
  });
  return { data: session };
}
