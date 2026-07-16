'use server';

import { safeRevalidatePath } from '@/lib/revalidate';
import type { Database } from '@/types/database.types';
import type { OnlineBookingFormData } from './online-booking-types';
import { validateBookingPackageScope } from '@/core/services/order/create-booking-helpers';
import { resolvePublicBabycareTenantId } from './public-booking-tenant';

type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
type AppNotificationInsert = Database['public']['Tables']['app_notifications']['Insert'];

export async function submitOnlineBooking(formData: OnlineBookingFormData): Promise<{
  success?: boolean;
  bookingNumber?: string;
  error?: string;
}> {
  'use server';

  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();

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
  const tenantResult = await resolvePublicBabycareTenantId(supabase);
  if (tenantResult.tenantId === null) {
    return { error: tenantResult.error };
  }
  const tenantId = tenantResult.tenantId;

  const packageScopeResult = await validateBookingPackageScope(supabase, tenantId, formData.package_id);
  if ('error' in packageScopeResult) {
    return { error: packageScopeResult.error };
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
    const newCustomerPayload: CustomerInsert = {
      name_mother: formData.name_mother.trim(),
      phone,
      address: formData.address?.trim() || null,
      status: 'lead',
      tenant_id: tenantId,
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
        .eq('id', customerId)
        .eq('tenant_id', tenantId);
      return {
        error: auditErr instanceof Error
          ? auditErr.message
          : '[submitOnlineBooking] Audit log (customer) failed'
      };
    }
  }

  // 2.5. CRITICAL FIX (15/07/2026): Check for conflicting active bookings
  // Prevent customer from creating multiple active bookings
  const { data: activeBookings, error: conflictCheckError } = await supabase
    .from('bookings')
    .select('id, package_name, status, start_date, booking_number')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .in('status', ['deposit_pending', 'in_progress', 'scheduled', 'confirmed']);

  if (conflictCheckError) {
    console.error('[submitOnlineBooking] Conflict check error:', conflictCheckError);
    // Log error but allow booking to proceed (graceful degradation)
    // In production, consider blocking if conflict check fails
  }

  if (activeBookings && activeBookings.length > 0) {
    // Customer has active bookings - block new booking creation
    const packageNames = activeBookings
      .map(b => b.package_name || 'Gói không tên')
      .filter((name, index, self) => self.indexOf(name) === index)  // Unique names only
      .join(', ');

    console.warn(
      `[submitOnlineBooking] Blocked: Customer ${customerId} has ${activeBookings.length} active booking(s):`,
      activeBookings.map(b => b.booking_number).join(', ')
    );

    // If we created a new customer (lead) for this booking attempt, we should NOT delete it
    // The customer record is still valuable even if booking is blocked
    // Next time they book, we'll find existing customer

    return {
      error: 
        `❌ Bạn đang có ${activeBookings.length} gói đang thực hiện:\n\n` +
        `📦 ${packageNames}\n\n` +
        `Vui lòng hoàn thành hoặc hủy các gói này trước khi đặt gói mới.\n\n` +
        `💡 Nếu cần hỗ trợ, vui lòng liên hệ hotline để được tư vấn.`
    };
  }

  // 3. Create the booking
  const bookingNumber = `BK-ONLINE-${Date.now()}`;
  const bookingPayload: BookingInsert = {
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
    tenant_id: tenantId,
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
        .eq('id', createdCustomerId)
        .eq('tenant_id', tenantId);
    }
    return { error: 'Không thể đặt lịch. Vui lòng thử lại hoặc liên hệ hotline.' };
  }

  const rollbackOnlineBooking = async () => {
    await supabase
      .from('bookings')
      .delete()
      .eq('id', booking.id)
      .eq('tenant_id', tenantId);

    if (createdCustomerId) {
      await supabase
        .from('customers')
        .delete()
        .eq('id', createdCustomerId)
        .eq('tenant_id', tenantId);
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
    const notificationPayload: AppNotificationInsert = {
      tenant_id: tenantId,
      type: 'new_booking',
      title: 'Khách hàng đặt lịch mới',
      message: `${formData.name_mother} vừa đặt lịch hẹn online.`,
      data: {
        customer_id: customerId,
        booking_id: booking.id,
        booking_number: bookingNumber
      }
    };
    const { error: notifErr } = await supabase.from('app_notifications').insert([notificationPayload]);

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
