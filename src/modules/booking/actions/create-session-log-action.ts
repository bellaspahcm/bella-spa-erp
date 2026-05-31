'use server';

import { sanitizeTime } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import type { Database } from '@/types/database.types';

type SessionLogInsert = Database['public']['Tables']['session_logs']['Insert'];
type CreateSessionLogInput = Pick<SessionLogInsert, 'booking_id'> &
  Partial<Pick<SessionLogInsert, 'assigned_date' | 'assigned_time' | 'notes' | 'status' | 'tenant_id'>>;

export async function createSessionLog(data: CreateSessionLogInput) {
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

  const { data: bookingRow } = await supabase
    .from('bookings')
    .select('tenant_id')
    .eq('id', data.booking_id)
    .single();

  const tenantId = data.tenant_id || bookingRow?.tenant_id;
  if (!tenantId) {
    return { error: 'Không xác định được chi nhánh cho lịch hẹn.' };
  }

  const sessionPayload: SessionLogInsert = {
    booking_id: data.booking_id,
    session_number: (count || 0) + 1,
    assigned_date: data.assigned_date || null,
    assigned_time: sanitizeTime(data.assigned_time),
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
