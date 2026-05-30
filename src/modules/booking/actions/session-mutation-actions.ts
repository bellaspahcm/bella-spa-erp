'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { getLocalDateString, sanitizeTime } from '@/lib/utils';
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

export async function createSessionLog(data: any) {
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

  // Lấy tenant_id từ booking (required field cho session_logs)
  const { data: bookingRow } = await supabase
    .from('bookings')
    .select('tenant_id')
    .eq('id', data.booking_id)
    .single();

  const { data: session, error } = await supabase
    .from('session_logs')
    .insert([
      {
        booking_id: data.booking_id,
        session_number: (count || 0) + 1,
        assigned_date: data.assigned_date || null,
        assigned_time: sanitizeTime(data.assigned_time),
        notes: data.notes || null,
        status: data.status || 'scheduled',
        tenant_id: data.tenant_id || bookingRow?.tenant_id
      },
    ])
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

export async function rescheduleSession(sessionId: string, newDate: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from('session_logs')
    .select('booking_id, assigned_date, session_number, status')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return { error: 'Không tìm thấy buổi cần dời lịch.' };
  }

  if (session.status === 'completed') {
    return { error: 'Không thể dời lịch cho buổi đã hoàn thành.' };
  }

  const bookingId = session.booking_id;
  const oldDateStr = session.assigned_date;
  
  let effectiveOldDateStr = oldDateStr;
  if (!effectiveOldDateStr) {
    const { data: booking } = await supabase.from('bookings').select('start_date').eq('id', bookingId).single();
    if (booking?.start_date) {
      const bDate = new Date(booking.start_date);
      bDate.setDate(bDate.getDate() + (session.session_number - 1));
      effectiveOldDateStr = getLocalDateString(bDate);
    } else {
      effectiveOldDateStr = newDate;
    }
  }

  const oldDate = new Date(effectiveOldDateStr);
  const targetDate = new Date(newDate);
  
  oldDate.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - oldDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { success: true };

  const { data: futureSessions, error: futureError } = await supabase
    .from('session_logs')
    .select('id, session_number, assigned_date')
    .eq('booking_id', bookingId)
    .eq('status', 'scheduled')
    .gte('session_number', session.session_number)
    .order('session_number', { ascending: true });

  if (futureError) {
    return { error: futureError.message };
  }

  const updates = futureSessions.map((s: any) => {
    let currentAssignedDate = s.assigned_date;
    
    if (!currentAssignedDate) {
      const baseDate = new Date(effectiveOldDateStr);
      baseDate.setDate(baseDate.getDate() + (s.session_number - session.session_number));
      currentAssignedDate = getLocalDateString(baseDate);
    }

    const baseDate = new Date(currentAssignedDate);
    baseDate.setDate(baseDate.getDate() + diffDays);
    const newAssignedDate = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;

    return supabase
      .from('session_logs')
      .update({ assigned_date: newAssignedDate })
      .eq('id', s.id);
  });

  const results = await Promise.all(updates);
  const hasError = results.some(r => r.error);
  if (hasError) {
    return { error: 'Có lỗi xảy ra khi cập nhật một số buổi học.' };
  }

  const rollbackReschedule = async () => {
    await Promise.all((futureSessions || []).map((s: any) => {
      let rollbackDate = s.assigned_date;
      if (!rollbackDate) {
        const baseDate = new Date(effectiveOldDateStr);
        baseDate.setDate(baseDate.getDate() + (s.session_number - session.session_number));
        rollbackDate = getLocalDateString(baseDate);
      }

      return supabase
        .from('session_logs')
        .update({ assigned_date: rollbackDate })
        .eq('id', s.id);
    }));
  };

  const { data: bookingData } = await supabase.from('bookings').select('customer_id').eq('id', bookingId).single();
  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions'
  ];
  if (bookingData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${bookingData.customer_id}`);
  }
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'session_logs',
      record_id: sessionId,
      old_data: session,
      new_data: { assigned_date: newDate, notes: `Dời lịch các buổi từ buổi ${session.session_number} thêm ${diffDays} ngày.` }
    });
  } catch (auditErr) {
    await rollbackReschedule();
    return {
      error: auditErr instanceof Error ? auditErr.message : 'Failed to record rescheduleSession audit log'
    };
  }

  return { success: true };
}