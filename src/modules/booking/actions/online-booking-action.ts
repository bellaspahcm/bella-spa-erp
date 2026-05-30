'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { safeRevalidatePath } from '@/lib/revalidate';
import type { OnlineBookingFormData } from './online-booking-types';

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