'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO Sprint 1.3: Continue splitting this large action file and remove this disable.
// Remaining as-any casts are intentional stubs pending the split — tracked in remediation plan.

import { sanitizeTime } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import {
  generateShareToken as generateShareTokenAction,
  getBookingDetailsWithPayment as getBookingDetailsWithPaymentAction,
  recordRemainingPayment as recordRemainingPaymentAction,
} from './payment-actions';
import { createBooking as createBookingAction } from './create-booking-action';
import { reusePackage as reusePackageAction } from './reuse-package-action';
import {
  getBookings as getBookingsAction,
  getBookingsByCustomerId as getBookingsByCustomerIdAction,
  getDraftBooking as getDraftBookingAction,
  getPackages as getPackagesAction,
} from './query-actions';

export async function getPackages() {
  return getPackagesAction();
}

export async function getBookings() {
  return getBookingsAction();
}

export async function getBookingsByCustomerId(customerId: string) {
  return getBookingsByCustomerIdAction(customerId);
}

export async function getDraftBooking(customerId: string) {
  return getDraftBookingAction(customerId);
}

export async function reusePackage(bookingId: string) {
  return reusePackageAction(bookingId);
}

export async function createBooking(formData: Parameters<typeof createBookingAction>[0]) {
  return createBookingAction(formData);
}

export async function recordRemainingPayment(
  params: Parameters<typeof recordRemainingPaymentAction>[0]
) {
  return recordRemainingPaymentAction(params);
}

export async function generateShareToken(bookingId: string) {
  return generateShareTokenAction(bookingId);
}

export async function getBookingDetailsWithPayment(bookingId: string) {
  return getBookingDetailsWithPaymentAction(bookingId);
}

export async function updateBooking(id: string, payload: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  if (payload.preferred_time !== undefined) {
    payload.preferred_time = sanitizeTime(payload.preferred_time);
  }
  
  let oldBooking = null;
  try {
    const { data: existing, error: existingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
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

  const { data, error } = await supabase
    .from('bookings')
    .update(payload)
    .eq('id', id)
    .select();

  if (error) {
    if (error.message?.includes('package_name') || error.message?.includes('package_id') || error.message?.includes('uuid')) {
      const { package_name, package_id, ...retryPayload } = payload;
      const { data: retryData, error: retryError } = await supabase
        .from('bookings')
        .update(retryPayload)
        .eq('id', id)
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
              .eq('id', id);
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
        new_data: payload
      });
    } catch (auditErr) {
      if (oldBooking) {
        await supabase
          .from('bookings')
          .update(oldBooking)
          .eq('id', id);
      }
      return {
        error: auditErr instanceof Error
          ? auditErr.message
          : 'Failed to record updateBooking audit log'
      };
    }
  }

  if (payload.total_sessions !== undefined) {
    try {
      const newTotal = Number(payload.total_sessions);
      const { data: existingLogs, error: existingLogsError } = await supabase
        .from('session_logs')
        .select('session_number, assigned_date, status')
        .eq('booking_id', id)
        .order('session_number', { ascending: true });

      if (existingLogsError) {
        throw new Error(existingLogsError.message);
      }

      const logs = existingLogs || [];
      const maxSessionNumber = logs.length > 0 ? Math.max(...logs.map((l: any) => l.session_number || 0)) : 0;

      if (newTotal < maxSessionNumber) {
        const { error: deleteLogsError } = await supabase
          .from('session_logs')
          .delete()
          .eq('booking_id', id)
          .gt('session_number', newTotal)
          .eq('status', 'scheduled');
        if (deleteLogsError) {
          throw new Error(deleteLogsError.message);
        }
      } else if (newTotal > maxSessionNumber) {
        const newLogs = [];
        let baseDateStr = payload.start_date || data?.[0]?.start_date;
        if (!baseDateStr) {
          const { data: b } = await supabase
            .from('bookings')
            .select('start_date')
            .eq('id', id)
            .single();
          baseDateStr = b?.start_date;
        }

        const lastLogWithDate = [...logs].reverse().find((l: any) => l.assigned_date);
        let lastAssignedDate = lastLogWithDate?.assigned_date || baseDateStr;

        if (!lastAssignedDate) {
          const now = new Date();
          lastAssignedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }

        for (let i = maxSessionNumber + 1; i <= newTotal; i++) {
          const [y, m, d] = lastAssignedDate.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (i - maxSessionNumber));
          const assignedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

          newLogs.push({
            booking_id: id,
            session_number: i,
            status: 'scheduled',
            assigned_date: assignedDate,
            assigned_time: payload.preferred_time || data?.[0]?.preferred_time || null,
            tenant_id: data?.[0]?.tenant_id || process.env.DEFAULT_TENANT_ID || null
          });
        }

        if (newLogs.length > 0) {
          const { error: insertLogsError } = await supabase.from('session_logs').insert(newLogs);
          if (insertLogsError) {
            throw new Error(insertLogsError.message);
          }
        }
      }

      const syncResult = await syncBookingProgress(id);
      if (syncResult.error) {
        throw new Error(syncResult.error);
      }
    } catch (syncErr) {
      if (oldBooking) {
        await supabase
          .from('bookings')
          .update(oldBooking)
          .eq('id', id);
      }
      return {
        error: syncErr instanceof Error
          ? syncErr.message
          : 'Error synchronizing session logs inside updateBooking'
      };
    }
  }

  const { data: bookingData } = await supabase.from('bookings').select('customer_id').eq('id', id).single();
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

export async function syncBookingProgress(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  if (countError) return { error: countError.message };

  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('completed_sessions')
    .eq('id', bookingId)
    .single();

  if (!booking) return { error: 'Booking not found' };

  if ((booking as any).completed_sessions !== count) {
    const { error: updateError } = await (supabase.from('bookings') as any)
      .update({ completed_sessions: count })
      .eq('id', bookingId);
    
    if (updateError) return { error: updateError.message };
    return { synced: true, newCount: count };
  }

  return { synced: false, count };
}

// ============================================================
// GUEST / SELF-SERVICE ONLINE BOOKING
// ============================================================

export interface OnlineBookingFormData {
  name_mother: string;
  phone: string;
  address?: string;
  package_id?: string;
  package_name?: string;
  expected_birth_date?: string;
  dob_baby?: string;
  name_baby?: string;
  start_date: string;
  preferred_time?: string;
  notes?: string;
}

export async function submitOnlineBooking(formData: OnlineBookingFormData): Promise<{
  success?: boolean;
  bookingNumber?: string;
  error?: string;
}> {
  'use server';

  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

  // 1. Basic validation
  if (!formData.phone || formData.phone.trim().length < 9) {
    return { error: 'Số điện thoại không hợp lệ.' };
  }
  if (!formData.name_mother || formData.name_mother.trim().length < 2) {
    return { error: 'Tên của bạn không hợp lệ.' };
  }
  if (!formData.start_date) {
    return { error: 'Vui lòng chọn ngày bắt đầu.' };
  }

  const phone = formData.phone.trim();
  let tenantId = process.env.DEFAULT_TENANT_ID;

  if (!tenantId) {
    const { data: tenantData } = await supabase.from('tenants').select('id').limit(1).single();
    if (tenantData) {
      tenantId = tenantData.id;
    } else {
      console.error('[submitOnlineBooking] No tenant found in database!');
      return { error: 'Hệ thống chưa được cấu hình. Vui lòng liên hệ trực tiếp qua hotline.' };
    }
  }

  // 2. Look up existing customer by phone
  let customerId: string;
  let createdCustomerId: string | null = null;

  const { data: existingCustomer, error: lookupError } = await supabase
    .from('customers')
    .select('id, name_mother, phone')
    .eq('phone', phone)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (lookupError) {
    console.error('[submitOnlineBooking] Customer lookup error:', lookupError);
    return { error: 'Lỗi hệ thống khi tìm kiếm thông tin. Vui lòng thử lại.' };
  }

  if (existingCustomer) {
    // Customer already exists — reuse
    customerId = existingCustomer.id;
    console.log('[submitOnlineBooking] Matched existing customer:', customerId);
  } else {
    // Create new customer with status "lead"
    const newCustomerPayload: Record<string, string | null> = {
      name_mother: formData.name_mother.trim(),
      phone,
      address: formData.address?.trim() || null,
      status: 'lead',
      tenant_id: tenantId || null,
      notes: formData.notes?.trim() || null,
    };

    if (formData.name_baby) newCustomerPayload.name_baby = formData.name_baby.trim();
    if (formData.dob_baby) newCustomerPayload.dob_baby = formData.dob_baby;
    if (formData.expected_birth_date) newCustomerPayload.dob_expected = formData.expected_birth_date;

    const { data: newCustomer, error: createCustError } = await supabase
      .from('customers')
      .insert([newCustomerPayload])
      .select()
      .single();

    if (createCustError || !newCustomer) {
      console.error('[submitOnlineBooking] Create customer error:', createCustError);
      return { error: 'Không thể tạo hồ sơ khách hàng. Vui lòng thử lại sau.' };
    }

    customerId = newCustomer.id;
    createdCustomerId = newCustomer.id;
    console.log('[submitOnlineBooking] Created new lead customer:', customerId);

    // Audit log for new customer
    try {
      const { recordAuditLog } = await import('@/services/audit-actions');
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'customers',
        record_id: customerId,
        new_data: newCustomer,
      });
    } catch (auditErr) {
      await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);
      return {
        error: auditErr instanceof Error
          ? auditErr.message
          : '[submitOnlineBooking] Audit log (customer) failed'
      };
    }
  }

  // 3. Create the booking
  const bookingNumber = `BK-ONLINE-${Date.now()}`;
  const bookingPayload: Record<string, string | number | boolean | null> = {
    customer_id: customerId,
    booking_number: bookingNumber,
    package_id: formData.package_id || null,
    package_name: formData.package_name || null,
    status: 'inquiry',
    full_price: 0,
    deposit_amount: 0,
    total_sessions: 1,
    start_date: formData.start_date,
    preferred_time: formData.preferred_time || null,
    expected_birth_date: formData.expected_birth_date || null,
    tenant_id: tenantId || null,
  };

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert([bookingPayload])
    .select()
    .single();

  if (bookingError || !booking) {
    console.error('[submitOnlineBooking] Create booking error:', bookingError);
    if (createdCustomerId) {
      await supabase
        .from('customers')
        .delete()
        .eq('id', createdCustomerId);
    }
    return { error: 'Không thể đặt lịch. Vui lòng thử lại hoặc liên hệ hotline.' };
  }

  const rollbackOnlineBooking = async () => {
    await supabase
      .from('bookings')
      .delete()
      .eq('id', booking.id);

    if (createdCustomerId) {
      await supabase
        .from('customers')
        .delete()
        .eq('id', createdCustomerId);
    }
  };

  // Audit log for booking
  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'bookings',
      record_id: booking.id,
      new_data: booking,
    });
  } catch (auditErr) {
    await rollbackOnlineBooking();
    return {
      error: auditErr instanceof Error
        ? auditErr.message
        : '[submitOnlineBooking] Audit log (booking) failed'
    };
  }
  // Create notification
  try {
    const { error: notifErr } = await supabase.from('app_notifications').insert([{
      tenant_id: tenantId || null,
      type: 'new_booking',
      title: 'Khách hàng đặt lịch mới',
      message: `${formData.name_mother} vừa đặt lịch hẹn online.`,
      data: {
        customer_id: customerId,
        booking_id: booking.id,
        booking_number: bookingNumber
      }
    }]);

    if (notifErr) {
      console.error('[submitOnlineBooking] Supabase insert error for notification:', notifErr);
      await rollbackOnlineBooking();
      return { error: 'Không thể tạo thông báo đặt lịch online: ' + notifErr.message };
    }
  } catch (notifErr) {
    await rollbackOnlineBooking();
    return {
      error: notifErr instanceof Error
        ? notifErr.message
        : '[submitOnlineBooking] Exception while creating notification'
    };
  }

  // Revalidate admin pages
  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/customers',
    `/dashboard/customers/${customerId}`,
    '/dashboard',
  ];
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  return { success: true, bookingNumber };
}
