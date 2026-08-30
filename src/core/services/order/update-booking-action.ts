'use server';

import { sanitizeTime } from '@bella/shared';;
import { safeRevalidatePath } from '@/lib/revalidate';
import { validateBookingPackageScope } from './create-booking-helpers';
import { BookingError } from '@/core/lib/errors';
import type { Database } from '@/types/database.types';
import { invalidateAvailabilityCache } from '@/app/api/bookings/check-ktv-availability/route';

type BookingRow = Database['public']['Tables']['bookings']['Row'];
type BookingUpdate = Database['public']['Tables']['bookings']['Update'];
type SessionLogInsert = Database['public']['Tables']['session_logs']['Insert'];
type SessionLogSchedulePick = Pick<
  Database['public']['Tables']['session_logs']['Row'],
  'session_number' | 'assigned_date' | 'status'
>;

const BOOKING_TENANT_ACCESS_ERROR = 'Không xác định được đơn vị kinh doanh của người dùng hiện tại.';

async function requireCurrentTenantId() {
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant_id) {
    throw new BookingError(BOOKING_TENANT_ACCESS_ERROR, 'BOOKING_TENANT_ACCESS_ERROR');
  }
  return currentUser.tenant_id;
}

export async function updateBooking(id: string, payload: BookingUpdate) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const tenantId = await requireCurrentTenantId();
  const { tenant_id: _ignoredTenantId, ...scopedPayload } = payload;
  void _ignoredTenantId;
  const updatePayload: BookingUpdate = { ...scopedPayload };

  if (updatePayload.preferred_time !== undefined) {
    updatePayload.preferred_time = sanitizeTime(updatePayload.preferred_time);
  }
  if (updatePayload.package_id === '') {
    updatePayload.package_id = null;
  }
  
  let oldBooking: BookingRow | null = null;
  try {
    const { data: existing, error: existingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (existingError) {
      return { error: existingError.message };
    }
    oldBooking = existing;
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch old booking for audit trail'
    };
  }

  if (updatePayload.package_id !== undefined) {
    const packageScopeResult = await validateBookingPackageScope(supabase, tenantId, updatePayload.package_id);
    if ('error' in packageScopeResult) {
      return { error: packageScopeResult.error };
    }
  }

  // CRITICAL FIX (15/07/2026 - Evening): Add Decision Engine validation for UPDATE
  // When editing booking time, date, or KTV, must check break time buffer
  if (oldBooking && (
    updatePayload.preferred_time !== undefined || 
    updatePayload.start_date !== undefined ||
    updatePayload.assigned_ktv_id !== undefined
  )) {
    console.log('[updateBooking] Decision Engine validation triggered for time/KTV change');
    
    // Build updated booking data for validation
    // Map update payload fields to BookingInsert format for Decision Engine
    const updatedBookingData = {
      // Core booking fields
      id: oldBooking.id,
      tenant_id: oldBooking.tenant_id,
      customer_id: oldBooking.customer_id,
      package_id: updatePayload.package_id !== undefined ? updatePayload.package_id : oldBooking.package_id,
      package_name: updatePayload.package_name !== undefined ? updatePayload.package_name : oldBooking.package_name,
      
      // Time fields - map preferred_time to start_date for Decision Engine
      start_date: updatePayload.start_date !== undefined ? updatePayload.start_date : oldBooking.start_date,
      preferred_time: updatePayload.preferred_time !== undefined ? updatePayload.preferred_time : oldBooking.preferred_time,
      
      // KTV assignment
      assigned_ktv_id: updatePayload.assigned_ktv_id !== undefined ? updatePayload.assigned_ktv_id : oldBooking.assigned_ktv_id,
      ktv_id: updatePayload.assigned_ktv_id !== undefined ? updatePayload.assigned_ktv_id : oldBooking.assigned_ktv_id,
      
      // Status and payment
      status: updatePayload.status !== undefined ? updatePayload.status : oldBooking.status,
      full_price: updatePayload.full_price !== undefined ? updatePayload.full_price : oldBooking.full_price,
      deposit_amount: updatePayload.deposit_amount !== undefined ? updatePayload.deposit_amount : oldBooking.deposit_amount,
      
      // Other fields
      total_sessions: updatePayload.total_sessions !== undefined ? updatePayload.total_sessions : oldBooking.total_sessions,
      metadata: updatePayload.metadata !== undefined ? updatePayload.metadata : oldBooking.metadata,
    };

    console.log('[updateBooking] Updated booking data for validation:', {
      id: updatedBookingData.id,
      start_date: updatedBookingData.start_date,
      assigned_ktv_id: updatedBookingData.assigned_ktv_id,
      status: updatedBookingData.status,
    });

    // Import Decision Engine adapter validation (same as create-booking-action.ts)
    try {
      const { invokeAdapterValidation, constructTenantContextForBooking } = await import('./create-booking-helpers');

      // Get tenant context
      const tenantContext = await constructTenantContextForBooking(supabase, tenantId);
      if ('error' in tenantContext) {
        console.error('[updateBooking] Failed to get tenant context:', tenantContext.error);
        return { error: tenantContext.error };
      }

      console.log('[updateBooking] Tenant context loaded, invoking Decision Engine validation...');

      // Validate with Decision Engine (includes break time buffer check)
      const validationResult = await invokeAdapterValidation(
        updatedBookingData as unknown as Database['public']['Tables']['bookings']['Insert'],
        tenantContext.context
      );

      if ('error' in validationResult) {
        console.error('[updateBooking] Decision Engine validation failed:', validationResult.error);
        return { error: validationResult.error };
      }
      
      console.log('[updateBooking] Decision Engine validation passed');

      // CRITICAL FIX (19/07/2026): Enforce conflict check on all scheduled session logs
      const { data: scheduledSessions, error: scheduledSessionsError } = await supabase
        .from('session_logs')
        .select('id, assigned_date, assigned_time, booking_resource_id')
        .eq('booking_id', id)
        .eq('tenant_id', tenantId)
        .eq('status', 'scheduled');

      if (scheduledSessionsError) {
        console.error('[updateBooking] Failed to fetch scheduled sessions:', scheduledSessionsError.message);
        return { error: 'Không thể tải danh sách ca để kiểm tra xung đột: ' + scheduledSessionsError.message };
      }

      const checkKtvId = updatePayload.assigned_ktv_id !== undefined ? updatePayload.assigned_ktv_id : oldBooking.assigned_ktv_id;
      const checkPreferredTime = updatePayload.preferred_time !== undefined ? updatePayload.preferred_time : oldBooking.preferred_time;

      if (scheduledSessions && scheduledSessions.length > 0) {
        const { checkBookingConflicts } = await import('@/services/decision-actions/booking-decisions');
        
        for (const session of scheduledSessions) {
          const conflictCheck = await checkBookingConflicts({
            bookingId: id,
            ktvId: checkKtvId,
            bookingResourceId: session.booking_resource_id,
            assignedDate: session.assigned_date,
            assignedTime: (updatePayload.preferred_time !== undefined ? checkPreferredTime : (session.assigned_time || checkPreferredTime)) || '09:00',
            durationMinutes: 90, // Will be resolved dynamically by the engine
          });

          if (conflictCheck.decision === 'REJECT') {
            console.error('[updateBooking] Session conflict detected:', conflictCheck.message);
            return { error: `Trùng lịch vào ngày ${session.assigned_date}: ${conflictCheck.message}` };
          }
        }
      }
    } catch (validationErr) {
      console.error('[updateBooking] Decision Engine validation exception:', validationErr);
      return {
        error: validationErr instanceof Error
          ? validationErr.message
          : 'Failed to validate booking update with Decision Engine'
      };
    }
  }
  const { data, error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select();

  let finalData = data;
  let finalPayload = updatePayload;

  if (error) {
    if (error.message?.includes('package_name') || error.message?.includes('package_id') || error.message?.includes('uuid')) {
      const retryPayload: BookingUpdate = { ...updatePayload };
      delete retryPayload.package_name;
      delete retryPayload.package_id;
      const { data: retryData, error: retryError } = await supabase
        .from('bookings')
        .update(retryPayload)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select();
      
      if (retryError) {
        console.error('Error updating booking (retry):', retryError);
        return { error: retryError.message };
      }
      finalData = retryData;
      finalPayload = retryPayload;
    } else {
      console.error('Error updating booking:', error);
      return { error: error.message };
    }
  }

  if (finalData?.[0]) {
    // ── Availability Cache Invalidation ──────────────────────────────────────
    // After booking is confirmed in DB, invalidate the Redis availability cache
    // for any date/time slot that was affected by this update.
    // Fire-and-forget: cache invalidation failure must NOT block booking update.
    // The cache TTL (15s) acts as a safety net if invalidation fails.
    const invalidateDates = new Set<string>();
    if (finalPayload.start_date) invalidateDates.add(finalPayload.start_date);
    if (oldBooking?.start_date && oldBooking.start_date !== finalPayload.start_date) {
      invalidateDates.add(oldBooking.start_date);
    }
    if (invalidateDates.size > 0) {
      const tenantIdForCache = finalData?.[0]?.tenant_id || oldBooking?.tenant_id || tenantId;
      const timeForCache = finalPayload.preferred_time || oldBooking?.preferred_time;
      if (tenantIdForCache && timeForCache) {
        Promise.all(
          [...invalidateDates].map(date =>
            invalidateAvailabilityCache({
              tenantId: tenantIdForCache,
              date,
              time: timeForCache,
              duration: 60, // Default duration — keys without duration variant expire via TTL
            })
          )
        ).catch(err =>
          console.error('[updateBooking] Availability cache invalidation failed (non-blocking):', err)
        );
      }
    }

    try {
      const { recordAuditLog } = await import('@/services/audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'bookings',
        record_id: id,
        old_data: oldBooking,
        new_data: finalPayload
      });
    } catch (auditErr) {
      if (oldBooking) {
        await supabase
          .from('bookings')
          .update(oldBooking)
          .eq('id', id)
          .eq('tenant_id', tenantId);
      }
      return {
        error: auditErr instanceof Error
          ? auditErr.message
          : 'Failed to record updateBooking audit log'
      };
    }

    // Send notification if primary KTV assignment changes
    if (
      finalPayload.assigned_ktv_id !== undefined && 
      oldBooking && 
      finalPayload.assigned_ktv_id !== oldBooking.assigned_ktv_id
    ) {
      try {
        const { createSystemNotification } = await import('@/services/notification-helpers');
        
        // Fetch customer name for notification message
        const { data: customer } = await supabase
          .from('customers')
          .select('name_mother')
          .eq('id', oldBooking.customer_id)
          .single();
          
        const customerName = customer?.name_mother || 'Khách hàng';
        const packageName = finalPayload.package_name || oldBooking.package_name || 'Dịch vụ';
        
        // 1. Notify the new KTV
        if (finalPayload.assigned_ktv_id) {
          await createSystemNotification({
            userId: finalPayload.assigned_ktv_id,
            title: 'Phân công ca chính mới 📅',
            message: `Bạn được phân công làm KTV chính gói ${packageName} cho khách ${customerName}.`,
            tenantId: tenantId,
            type: 'assignment'
          });
        }
        
        // 2. Notify the old KTV (if there was one)
        if (oldBooking.assigned_ktv_id) {
          await createSystemNotification({
            userId: oldBooking.assigned_ktv_id,
            title: 'Thay đổi phân công ca chính ⚠️',
            message: `Bạn đã được điều chuyển và thôi phân công làm KTV chính gói ${packageName} của khách ${customerName}.`,
            tenantId: tenantId,
            type: 'system'
          });
        }
      } catch (notifErr) {
        console.error('Failed to send booking reassign notifications:', notifErr);
      }
    }

    // Sync scheduled sessions' assigned_time with the new preferred_time
    if (finalPayload.preferred_time !== undefined) {
      const { error: logsTimeError } = await supabase
        .from('session_logs')
        .update({ assigned_time: finalPayload.preferred_time })
        .eq('booking_id', id)
        .eq('tenant_id', tenantId)
        .eq('status', 'scheduled');

      if (logsTimeError) {
        console.error('[updateBooking] Failed to update scheduled session times:', logsTimeError);
      }
    }

    // Sync session statuses and assigned_dates when start_date or completed_sessions has actually changed
    const hasStartDateChanged = finalPayload.start_date !== undefined && finalPayload.start_date !== oldBooking?.start_date;
    const hasCompletedSessionsChanged = finalPayload.completed_sessions !== undefined && Number(finalPayload.completed_sessions) !== (oldBooking?.completed_sessions || 0);

    if (hasStartDateChanged || hasCompletedSessionsChanged) {
      const { data: allSessions, error: fetchSessionsError } = await supabase
        .from('session_logs')
        .select('id, session_number, status, assigned_date, completed_date')
        .eq('booking_id', id)
        .eq('tenant_id', tenantId)
        .order('session_number', { ascending: true });

      if (fetchSessionsError) {
        throw new BookingError(`Lỗi tải danh sách buổi liệu trình: ${fetchSessionsError.message}`, 'BOOKING_SESSION_LOGS_FETCH_ERROR', { bookingId: id });
      }

      if (allSessions) {
        const startDateStr = finalPayload.start_date !== undefined 
          ? finalPayload.start_date 
          : (oldBooking?.start_date || null);
          
        const completedCount = finalPayload.completed_sessions !== undefined
          ? Number(finalPayload.completed_sessions)
          : (oldBooking?.completed_sessions || 0);

        if (startDateStr) {
          const [year, month, day] = startDateStr.split('-').map(Number);
          
          const updates = allSessions.map((session) => {
            const sessionNum = session.session_number || 1;
            const isAlreadyCompleted = session.status === 'completed';

            // Recalculate assigned date only if start date has changed and the session is not completed
            let assignedDate = session.assigned_date;
            if (hasStartDateChanged && !isAlreadyCompleted) {
              const date = new Date(year, month - 1, day);
              date.setDate(date.getDate() + (sessionNum - 1));
              assignedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }

            // Determine status and completed_date changes
            let newStatus = session.status;
            let newCompletedDate = session.completed_date;

            if (hasCompletedSessionsChanged) {
              const isCompleted = sessionNum <= completedCount;
              if (isCompleted && !isAlreadyCompleted) {
                // Changing from scheduled to completed
                newStatus = 'completed';
                newCompletedDate = assignedDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
              } else if (!isCompleted && isAlreadyCompleted) {
                // Changing from completed to scheduled
                newStatus = 'scheduled';
                newCompletedDate = null;
              }
            }

            const logUpdatePayload: Database['public']['Tables']['session_logs']['Update'] = {};
            if (assignedDate !== session.assigned_date) {
              logUpdatePayload.assigned_date = assignedDate;
            }
            if (newStatus !== session.status) {
              logUpdatePayload.status = newStatus;
            }
            if (newCompletedDate !== session.completed_date) {
              logUpdatePayload.completed_date = newCompletedDate;
            }

            if (Object.keys(logUpdatePayload).length === 0) {
              return Promise.resolve({ error: null });
            }

            return supabase
              .from('session_logs')
              .update(logUpdatePayload)
              .eq('id', session.id);
          });
          
          const results = await Promise.all(updates);
          for (const res of results) {
            if (res.error) {
              throw new BookingError(`Lỗi cập nhật buổi liệu trình: ${res.error.message}`, 'BOOKING_SESSION_LOGS_UPDATE_ERROR', { bookingId: id });
            }
          }
          console.log(`[updateBooking] Synchronized statuses and dates for ${allSessions.length} sessions starting from ${startDateStr} (completed: ${completedCount})`);
        } else {
          // If no start_date, only update statuses
          const updates = allSessions.map((session) => {
            if (!hasCompletedSessionsChanged) {
              return Promise.resolve({ error: null });
            }

            const sessionNum = session.session_number || 1;
            const isAlreadyCompleted = session.status === 'completed';
            const isCompleted = sessionNum <= completedCount;

            let newStatus = session.status;
            let newCompletedDate = session.completed_date;

            if (isCompleted && !isAlreadyCompleted) {
              newStatus = 'completed';
              newCompletedDate = session.assigned_date || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
            } else if (!isCompleted && isAlreadyCompleted) {
              newStatus = 'scheduled';
              newCompletedDate = null;
            }

            const logUpdatePayload: Database['public']['Tables']['session_logs']['Update'] = {};
            if (newStatus !== session.status) {
              logUpdatePayload.status = newStatus;
            }
            if (newCompletedDate !== session.completed_date) {
              logUpdatePayload.completed_date = newCompletedDate;
            }

            if (Object.keys(logUpdatePayload).length === 0) {
              return Promise.resolve({ error: null });
            }

            return supabase
              .from('session_logs')
              .update(logUpdatePayload)
              .eq('id', session.id);
          });
          
          const results = await Promise.all(updates);
          for (const res of results) {
            if (res.error) {
              throw new BookingError(`Lỗi cập nhật trạng thái buổi liệu trình: ${res.error.message}`, 'BOOKING_SESSION_LOGS_UPDATE_ERROR', { bookingId: id });
            }
          }
          console.log(`[updateBooking] Synchronized statuses for ${allSessions.length} sessions (completed: ${completedCount})`);
        }
      }
    }
  }

  if (finalPayload.total_sessions !== undefined) {
    try {
      const newTotal = Number(finalPayload.total_sessions);
      const { data: existingLogs, error: existingLogsError } = await supabase
        .from('session_logs')
        .select('session_number, assigned_date, status')
        .eq('booking_id', id)
        .eq('tenant_id', tenantId)
        .order('session_number', { ascending: true });

      if (existingLogsError) {
        throw new BookingError(existingLogsError.message, 'BOOKING_SESSION_LOGS_FETCH_ERROR', { bookingId: id });
      }

      const logs = (existingLogs || []) as SessionLogSchedulePick[];
      const maxSessionNumber = logs.length > 0 ? Math.max(...logs.map((l) => l.session_number || 0)) : 0;

      if (newTotal < maxSessionNumber) {
        const { error: deleteLogsError } = await supabase
          .from('session_logs')
          .delete()
          .eq('booking_id', id)
          .eq('tenant_id', tenantId)
          .gt('session_number', newTotal)
          .eq('status', 'scheduled');
        if (deleteLogsError) {
          throw new BookingError(deleteLogsError.message, 'BOOKING_SESSION_LOGS_DELETE_ERROR', { bookingId: id });
        }
      } else if (newTotal > maxSessionNumber) {
        const newLogs: SessionLogInsert[] = [];
        let baseDateStr: string | null = finalPayload.start_date || finalData?.[0]?.start_date || null;
        if (!baseDateStr) {
          const { data: b } = await supabase
            .from('bookings')
            .select('start_date')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();
          baseDateStr = b?.start_date || null;
        }

        let defaultDuration = 60;
        const packageId = finalPayload.package_id || oldBooking?.package_id;
        if (packageId) {
          const { data: pkgData } = await supabase
            .from('packages')
            .select('default_duration_minutes')
            .eq('id', packageId)
            .single();
          if (pkgData?.default_duration_minutes) {
            defaultDuration = pkgData.default_duration_minutes;
          }
        }

        const lastLogWithDate = [...logs].reverse().find((l) => l.assigned_date);
        let lastAssignedDate = lastLogWithDate?.assigned_date || baseDateStr;
        const tenantIdForNewLogs = finalData?.[0]?.tenant_id || oldBooking?.tenant_id || tenantId;

        if (!tenantIdForNewLogs) {
          throw new BookingError('Missing tenant_id for new session logs inside updateBooking', 'BOOKING_MISSING_TENANT_ID', { bookingId: id });
        }

        if (!lastAssignedDate) {
          const now = new Date();
          lastAssignedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }

        for (let i = maxSessionNumber + 1; i <= newTotal; i++) {
          const parts = lastAssignedDate.split('-').map(Number);
          const y = parts[0] || 1970;
          const m = parts[1] || 1;
          const d = parts[2] || 1;
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (i - maxSessionNumber));
          const assignedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

          newLogs.push({
            booking_id: id,
            session_number: i,
            status: 'scheduled',
            assigned_date: assignedDate,
            assigned_time: finalPayload.preferred_time || finalData?.[0]?.preferred_time || null,
            tenant_id: tenantIdForNewLogs,
            standard_duration: defaultDuration
          });
        }

        if (newLogs.length > 0) {
          const { error: insertLogsError } = await supabase.from('session_logs').insert(newLogs);
          if (insertLogsError) {
            throw new BookingError(insertLogsError.message, 'BOOKING_SESSION_LOGS_INSERT_ERROR', { bookingId: id });
          }
        }
      }

      const syncResult = await syncBookingProgress(id, tenantId);
      if (syncResult.error) {
        throw new BookingError(syncResult.error, 'BOOKING_PROGRESS_SYNC_ERROR', { bookingId: id });
      }
    } catch (syncErr) {
      if (oldBooking) {
        await supabase
          .from('bookings')
          .update(oldBooking)
          .eq('id', id)
          .eq('tenant_id', tenantId);
      }
      return {
        error: syncErr instanceof Error
          ? syncErr.message
          : 'Error synchronizing session logs inside updateBooking'
      };
    }
  }

  const { data: bookingData } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();
  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/customers'
  ];
  if (bookingData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${bookingData.customer_id}`);
  }
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  return { data: finalData };
}

export async function syncBookingProgress(bookingId: string, tenantId?: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const scopedTenantId = tenantId || await requireCurrentTenantId();
  
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('tenant_id', scopedTenantId)
    .eq('status', 'completed');

  if (countError) return { error: countError.message };

  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('completed_sessions')
    .eq('id', bookingId)
    .eq('tenant_id', scopedTenantId)
    .single();

  if (fetchError) return { error: fetchError.message };
  if (!booking) return { error: 'Booking not found' };

  if (booking.completed_sessions !== count) {
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ completed_sessions: count })
      .eq('id', bookingId)
      .eq('tenant_id', scopedTenantId);
    
    if (updateError) return { error: updateError.message };
    return { synced: true, newCount: count };
  }

  return { synced: false, count };
}
