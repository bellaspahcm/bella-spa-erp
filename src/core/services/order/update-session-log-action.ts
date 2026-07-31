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
import { validateBookingResourceSchedule } from './booking-resource-schedule-guard';

export async function updateSessionLog(id: string, payload: UpdateSessionLogInput) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || null;

  if (!tenantId) {
    return { error: 'Không xác định được chi nhánh khi cập nhật buổi dịch vụ.' };
  }
  
  const { data: existingLog, error: existingLogError } = await supabase
    .from('session_logs')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (existingLogError || !existingLog) {
    return { error: existingLogError?.message || 'Không tìm thấy session log' };
  }

  if (currentUser?.role?.toLowerCase() !== 'admin' && !['scheduled', 'in_progress'].includes(existingLog?.status ?? '')) {
    return { error: 'Bạn không có quyền thực hiện thao tác này (Unauthorized)' };
  }

  const bookingId = existingLog.booking_id;
  if (!bookingId) {
    return { error: 'Buổi dịch vụ chưa gắn với booking hợp lệ.' };
  }

  const normalizedUpdates = normalizeSessionLogUpdate(payload);
  const completionDefaultsResult = await applyCompletionDefaults(
    supabase,
    bookingId,
    tenantId,
    normalizedUpdates,
    existingLog
  );

  if ('error' in completionDefaultsResult) {
    return { error: completionDefaultsResult.error };
  }

  const safeUpdates = completionDefaultsResult.data;
  const resourceScheduleResult = await validateBookingResourceSchedule({
    supabase,
    tenantId,
    sessionId: id,
    bookingResourceId: Object.prototype.hasOwnProperty.call(safeUpdates, 'booking_resource_id')
      ? safeUpdates.booking_resource_id
      : existingLog.booking_resource_id,
    assignedDate: Object.prototype.hasOwnProperty.call(safeUpdates, 'assigned_date')
      ? safeUpdates.assigned_date
      : existingLog.assigned_date,
    assignedTime: Object.prototype.hasOwnProperty.call(safeUpdates, 'assigned_time')
      ? safeUpdates.assigned_time
      : existingLog.assigned_time,
    status: Object.prototype.hasOwnProperty.call(safeUpdates, 'status')
      ? safeUpdates.status
      : existingLog.status,
  });

  if ('error' in resourceScheduleResult) {
    return { error: resourceScheduleResult.error };
  }

  const { data, error } = await supabase
    .from('session_logs')
    .update(safeUpdates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
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
        .eq('id', id)
        .eq('tenant_id', tenantId);
      return {
        error: auditErr instanceof Error ? auditErr.message : 'Failed to record updateSessionLog audit log'
      };
    }
    // Send notifications if KTV assignment for this specific session log changes
    const newKtvId = safeUpdates.completed_by_ktv_id;
    const oldKtvId = existingLog.completed_by_ktv_id;
    
    if (newKtvId !== undefined && newKtvId !== oldKtvId) {
      try {
        const { createSystemNotification } = await import('@/services/notification-helpers');
        
        // Fetch booking & customer details
        const { data: booking } = await supabase
          .from('bookings')
          .select(`
            package_name,
            customers (
              name_mother
            )
          `)
          .eq('id', bookingId)
          .single();
          
        const bookingTyped = booking as Record<string, unknown> & { package_name?: string; customers?: { name_mother?: string } };
        const customerName = bookingTyped?.customers?.name_mother || 'Khách hàng';
        const packageName = bookingTyped?.package_name || 'Dịch vụ';
        
        const dateVal = safeUpdates.assigned_date || existingLog.assigned_date || '';
        const dateStr = dateVal ? dateVal.split('-').reverse().join('/') : '';
        const timeStr = safeUpdates.assigned_time || existingLog.assigned_time || 'Chưa định giờ';
        
        // 1. Notify the new substitute/assigned KTV
        if (newKtvId) {
          await createSystemNotification({
            userId: newKtvId,
            title: 'Phân công ca làm việc mới 🔄',
            message: `Bạn được phân công làm ca số ${existingLog.session_number} gói ${packageName} cho khách ${customerName} ngày ${dateStr} (${timeStr}).`,
            tenantId: tenantId,
            type: 'assignment'
          });
        }
        
        // 2. Notify the old substitute KTV (if there was one)
        if (oldKtvId) {
          await createSystemNotification({
            userId: oldKtvId,
            title: 'Hủy phân công ca làm việc ⚠️',
            message: `Bạn đã thôi phân công ca số ${existingLog.session_number} gói ${packageName} của khách ${customerName} ngày ${dateStr}.`,
            tenantId: tenantId,
            type: 'system'
          });
        }
      } catch (notifErr) {
        console.error('Failed to send session reassign notifications:', notifErr);
      }
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
    const progressResult = await syncBookingProgressAfterSessionUpdate(supabase, bookingId, tenantId);
    if (progressResult.error) {
      return { error: progressResult.error };
    }
  }

  const { data: customerData } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
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
