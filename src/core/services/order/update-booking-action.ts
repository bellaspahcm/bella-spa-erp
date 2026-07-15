'use server';

import { sanitizeTime } from '@bella/shared';;
import { safeRevalidatePath } from '@/lib/revalidate';
import { validateBookingPackageScope } from './create-booking-helpers';
import { BookingError } from '@/core/lib/errors';
import type { Database } from '@/types/database.types';

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
  } catch (err) {
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

  const { data, error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select();

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
      
      if (retryData?.[0]) {
        try {
          const { recordAuditLog } = await import('@/services/audit-actions');
          await recordAuditLog({
            action: 'UPDATE',
            table_name: 'bookings',
            record_id: id,
            old_data: oldBooking,
            new_data: retryPayload
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
              : 'Failed to record updateBooking retry audit log'
          };
        }
      }
      return { data: retryData };
    }

    console.error('Error updating booking:', error);
    return { error: error.message };
  }

  if (data?.[0]) {
    try {
      const { recordAuditLog } = await import('@/services/audit-actions');
      await recordAuditLog({
            action: 'UPDATE',
            table_name: 'bookings',
            record_id: id,
            old_data: oldBooking,
            new_data: updatePayload
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

    // Sync scheduled sessions' assigned_time with the new preferred_time
    if (updatePayload.preferred_time !== undefined) {
      const { error: logsTimeError } = await supabase
        .from('session_logs')
        .update({ assigned_time: updatePayload.preferred_time })
        .eq('booking_id', id)
        .eq('tenant_id', tenantId)
        .eq('status', 'scheduled');

      if (logsTimeError) {
        console.error('[updateBooking] Failed to update scheduled session times:', logsTimeError);
      }
    }
  }

  if (updatePayload.total_sessions !== undefined) {
    try {
      const newTotal = Number(updatePayload.total_sessions);
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
        let baseDateStr: string | null = updatePayload.start_date || data?.[0]?.start_date || null;
        if (!baseDateStr) {
          const { data: b } = await supabase
            .from('bookings')
            .select('start_date')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();
          baseDateStr = b?.start_date || null;
        }

        const lastLogWithDate = [...logs].reverse().find((l) => l.assigned_date);
        let lastAssignedDate = lastLogWithDate?.assigned_date || baseDateStr;
        const tenantIdForNewLogs = data?.[0]?.tenant_id || oldBooking?.tenant_id || tenantId;

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
            assigned_time: updatePayload.preferred_time || data?.[0]?.preferred_time || null,
            tenant_id: tenantIdForNewLogs
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

  return { data };
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
