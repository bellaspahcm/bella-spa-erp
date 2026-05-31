'use server';

import { getLocalDateString } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';

function addDaysToDateString(dateString: string, days: number) {
  const baseDate = new Date(dateString);
  baseDate.setDate(baseDate.getDate() + days);
  return getLocalDateString(baseDate);
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
    const { data: booking } = await supabase
      .from('bookings')
      .select('start_date')
      .eq('id', bookingId)
      .single();

    if (booking?.start_date) {
      effectiveOldDateStr = addDaysToDateString(booking.start_date, session.session_number - 1);
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

  const updates = futureSessions.map((futureSession) => {
    let currentAssignedDate = futureSession.assigned_date;

    if (!currentAssignedDate) {
      currentAssignedDate = addDaysToDateString(
        effectiveOldDateStr,
        futureSession.session_number - session.session_number
      );
    }

    const newAssignedDate = addDaysToDateString(currentAssignedDate, diffDays);

    return supabase
      .from('session_logs')
      .update({ assigned_date: newAssignedDate })
      .eq('id', futureSession.id);
  });

  const results = await Promise.all(updates);
  const hasError = results.some((result) => result.error);
  if (hasError) {
    return { error: 'Có lỗi xảy ra khi cập nhật một số buổi học.' };
  }

  const rollbackReschedule = async () => {
    await Promise.all((futureSessions || []).map((futureSession) => {
      let rollbackDate = futureSession.assigned_date;
      if (!rollbackDate) {
        rollbackDate = addDaysToDateString(
          effectiveOldDateStr,
          futureSession.session_number - session.session_number
        );
      }

      return supabase
        .from('session_logs')
        .update({ assigned_date: rollbackDate })
        .eq('id', futureSession.id);
    }));
  };

  const { data: bookingData } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('id', bookingId)
    .single();

  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions'
  ];
  if (bookingData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${bookingData.customer_id}`);
  }
  await Promise.all(revalPaths.map((path) => safeRevalidatePath(path)));

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
