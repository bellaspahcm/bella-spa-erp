'use server';
import { safeRevalidatePath } from '@/lib/revalidate';
import type { Database } from '@/types/database.types';

type SessionLogInsert = Database['public']['Tables']['session_logs']['Insert'];

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
