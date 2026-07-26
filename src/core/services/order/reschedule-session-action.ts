'use server';

import { getLocalDateString } from '@bella/shared';;
import { safeRevalidatePath } from '@/lib/revalidate';
import { validateBookingResourceSchedule } from './booking-resource-schedule-guard';

function addDaysToDateString(dateString: string, days: number) {
  const baseDate = new Date(dateString);
  baseDate.setDate(baseDate.getDate() + days);
  return getLocalDateString(baseDate);
}

export async function rescheduleSession(sessionId: string, newDate: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || null;

  if (!tenantId) {
    return { error: 'Khong xac dinh duoc chi nhanh khi doi lich.' };
  }

  const { data: session, error: sessionError } = await supabase
    .from('session_logs')
    .select('booking_id, assigned_date, assigned_time, booking_resource_id, session_number, status')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
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
      .eq('tenant_id', tenantId)
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
    .select('id, session_number, assigned_date, assigned_time, booking_resource_id, status')
    .eq('booking_id', bookingId)
    .eq('tenant_id', tenantId)
    .eq('status', 'scheduled')
    .gte('session_number', session.session_number)
    .order('session_number', { ascending: true });

  if (futureError) {
    return { error: futureError.message };
  }

  const plannedUpdates = (futureSessions || []).map((futureSession) => {
    const originalAssignedDate = futureSession.assigned_date || addDaysToDateString(
      effectiveOldDateStr,
      futureSession.session_number - session.session_number
    );

    return {
      id: futureSession.id,
      originalAssignedDate,
      newAssignedDate: addDaysToDateString(originalAssignedDate, diffDays),
      assignedTime: futureSession.assigned_time,
      bookingResourceId: futureSession.booking_resource_id,
      status: futureSession.status,
    };
  });

  for (const plannedUpdate of plannedUpdates) {
    const resourceScheduleResult = await validateBookingResourceSchedule({
      supabase,
      tenantId,
      sessionId: plannedUpdate.id,
      bookingResourceId: plannedUpdate.bookingResourceId,
      assignedDate: plannedUpdate.newAssignedDate,
      assignedTime: plannedUpdate.assignedTime,
      status: plannedUpdate.status,
    });

    if ('error' in resourceScheduleResult) {
      return { error: resourceScheduleResult.error };
    }
  }

  const appliedUpdates: typeof plannedUpdates = [];
  const rollbackReschedule = async () => {
    const rollbackErrors: string[] = [];

    for (const appliedUpdate of appliedUpdates) {
      const { error: rollbackError } = await supabase
        .from('session_logs')
        .update({ assigned_date: appliedUpdate.originalAssignedDate })
        .eq('id', appliedUpdate.id)
        .eq('tenant_id', tenantId);

      if (rollbackError) {
        rollbackErrors.push(`${appliedUpdate.id}: ${rollbackError.message}`);
      }
    }

    return rollbackErrors;
  };

  for (const plannedUpdate of plannedUpdates) {
    const { error: updateError } = await supabase
      .from('session_logs')
      .update({ assigned_date: plannedUpdate.newAssignedDate })
      .eq('id', plannedUpdate.id)
      .eq('tenant_id', tenantId);

    if (updateError) {
      const rollbackErrors = await rollbackReschedule();
      const rollbackMessage = rollbackErrors.length > 0
        ? ` Rollback failed: ${rollbackErrors.join('; ')}`
        : '';

      return {
        error: `Failed to reschedule all future sessions: ${updateError.message}.${rollbackMessage}`,
      };
    }

    appliedUpdates.push(plannedUpdate);
  }

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'session_logs',
      record_id: sessionId,
      old_data: session,
      new_data: {
        assigned_date: newDate,
        notes: `Dời lịch các buổi từ buổi ${session.session_number} thêm ${diffDays} ngày.`,
      },
    });
  } catch (auditErr) {
    const rollbackErrors = await rollbackReschedule();
    const rollbackMessage = rollbackErrors.length > 0
      ? ` Rollback failed: ${rollbackErrors.join('; ')}`
      : '';

    return {
      error: `${auditErr instanceof Error ? auditErr.message : 'Failed to record rescheduleSession audit log'}${rollbackMessage}`,
    };
  }

  // Send notification for rescheduled session
  try {
    const { data: updatedSession } = await supabase
      .from('session_logs')
      .select(`
        completed_by_ktv_id,
        bookings (
          assigned_ktv_id,
          package_name,
          customers (
            name_mother
          )
        )
      `)
      .eq('id', sessionId)
      .single();
      
    if (updatedSession) {
      const booking = Array.isArray(updatedSession.bookings) ? updatedSession.bookings[0] : updatedSession.bookings;
      const targetKtvId = updatedSession.completed_by_ktv_id || (booking as any)?.assigned_ktv_id;
      
      if (targetKtvId) {
        const { createSystemNotification } = await import('@/services/notification-helpers');
        const customerName = (booking as any)?.customers?.name_mother || 'Khách hàng';
        const packageName = booking?.package_name || 'Dịch vụ';
        const formattedNewDate = newDate.split('-').reverse().join('/');
        
        await createSystemNotification({
          userId: targetKtvId,
          title: 'Thay đổi lịch hẹn ca 🕒',
          message: `Ca số ${session.session_number} gói ${packageName} cho khách ${customerName} đã được dời lịch sang ngày ${formattedNewDate} (${session.assigned_time || 'Chưa định giờ'}).`,
          tenantId,
          type: 'system'
        });
      }
    }
  } catch (notifErr) {
    console.error('Failed to send reschedule notifications:', notifErr);
  }

  const { data: bookingData } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .single();

  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions',
  ];
  if (bookingData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${bookingData.customer_id}`);
  }
  await Promise.all(revalPaths.map((path) => safeRevalidatePath(path)));

  return { success: true };
}
