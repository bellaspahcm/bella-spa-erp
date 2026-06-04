import { resolvePackageName, getLocalDateString } from '@/lib/utils';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import { inferBusinessEventType } from '@/services/accounting/template-rules';
import { resolveAccountingReviewStatus } from './accounting-review';
import { resolveKtvCommission } from './commission-actions';
import type { createClient } from '@/lib/supabase-server';
import type { bookingSchema } from '@/lib/validations';
import type { Database } from '@/types/database.types';
import type { z } from 'zod';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
type BookingUpdate = Database['public']['Tables']['bookings']['Update'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type SessionLogInsert = Database['public']['Tables']['session_logs']['Insert'];
type RevenueInsert = Database['public']['Tables']['revenue']['Insert'];
type ValidatedBookingData = z.infer<typeof bookingSchema>;
type ActionError = { error: string };
type ActionSuccess = { success: true };

type CreateBookingFormData = {
  newCustomer?: Omit<CustomerInsert, 'tenant_id'> & Partial<Pick<CustomerInsert, 'tenant_id'>>;
};

export async function enforceCreateBookingRateLimit(): Promise<ActionSuccess | ActionError> {
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    let clientIp = '127.0.0.1';

    if (forwardedFor) {
      clientIp = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      clientIp = realIp.trim();
    }

    const { rateLimit } = await import('@/lib/rate-limit');
    const allowed = rateLimit(`booking_ip:${clientIp}`, 5, 5 / 600);
    return allowed
      ? { success: true }
      : { error: 'Bạn đã thực hiện quá nhiều yêu cầu đặt lịch. Vui lòng thử lại sau ít phút.' };
  } catch (err) {
    console.error('[createBooking] Rate-limiting evaluation failed, rejecting request for safety:', err);
    return { error: 'Hệ thống tạm thời không khả dụng. Vui lòng thử lại.' };
  }
}

export async function createCustomerForBookingIfNeeded(
  supabase: SupabaseServerClient,
  validatedData: ValidatedBookingData,
  formData: CreateBookingFormData,
  tenantId: string
): Promise<{ customerId: string } | ActionError> {
  if (validatedData.customer_id !== 'new' || !formData.newCustomer) {
    return { customerId: String(validatedData.customer_id) };
  }

  const customerPayload: CustomerInsert = {
    ...formData.newCustomer,
    tenant_id: formData.newCustomer.tenant_id || tenantId,
  };

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert([customerPayload])
    .select()
    .single();

  if (customerError) {
    console.error('Error creating customer inside createBooking:', customerError);
    return { error: 'Lỗi khi tạo khách hàng: ' + customerError.message };
  }

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'customers',
      record_id: customer.id,
      new_data: customer,
    });
  } catch (auditErr) {
    await supabase.from('customers').delete().eq('id', customer.id);
    return {
      error: auditErr instanceof Error
        ? auditErr.message
        : 'Failed to record customer audit log in createBooking',
    };
  }

  return { customerId: customer.id };
}

export async function findPendingBookingForCustomer(
  supabase: SupabaseServerClient,
  customerId: string
): Promise<BookingRow | null> {
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', customerId)
    .in('status', ['deposit_pending', 'lead'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

export async function resolveBookingTenant(supabase: SupabaseServerClient): Promise<{ tenantId: string } | ActionError> {
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

  let tenantId: string | null = null;
  let userEmail: string | null = null;
  let isLoggedIn = false;

  if (currentUser) {
    isLoggedIn = true;
    if (currentUser.tenant_id) {
      tenantId = currentUser.tenant_id || null;
      userEmail = currentUser.email || null;
      console.log('[createBooking] Level1 resolved tenant:', tenantId);
    }
  }

  if (!tenantId) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      isLoggedIn = true;
      userEmail = authUser.email ?? null;
      console.log('[createBooking] Level2 authUser authenticated | id:', authUser.id);
      const { data: userProfile } = await supabase
        .from('users')
        .select('tenant_id, email')
        .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
        .limit(1)
        .single();
      if (userProfile?.tenant_id) {
        tenantId = userProfile.tenant_id;
        console.log('[createBooking] Level2 resolved tenant via DB:', tenantId);
      }
    }
  }

  if (!tenantId) {
    if (isLoggedIn) {
      return { error: 'Unauthorized: Tenant ID is required for logged in users.' };
    }
    tenantId = process.env.DEFAULT_TENANT_ID || null;
    if (!tenantId) {
      return { error: 'System Error: DEFAULT_TENANT_ID is not configured for guest bookings.' };
    }
    console.warn('[createBooking] Level3 DEFAULT_TENANT_ID fallback used for guest booking.');
  }

  console.log('[createBooking] Final tenantId:', tenantId, '| user:', userEmail);
  return { tenantId };
}

export async function buildBookingPayload(params: {
  validatedData: ValidatedBookingData;
  customerId: string;
  tenantId: string;
  existingBooking: BookingRow | null;
}): Promise<BookingInsert> {
  const { validatedData, customerId, tenantId, existingBooking } = params;
  const isFullBooking = validatedData.full_price > 0 && (validatedData.deposit_amount || 0) >= validatedData.full_price;
  const lockedCommission = validatedData.ktv_commission || await resolveKtvCommission(validatedData);

  const payload: BookingInsert = {
    customer_id: customerId,
    booking_number: existingBooking?.booking_number || `BK-${new Date().getTime()}`,
    package_id: validatedData.package_id || null,
    package_name: validatedData.package_name || null,
    status: isFullBooking ? 'booked' : 'deposit_pending',
    full_price: validatedData.full_price,
    deposit_amount: (existingBooking?.deposit_amount || 0) + (validatedData.deposit_amount || 0),
    total_sessions: validatedData.total_sessions,
    ktv_commission: lockedCommission,
    discount_percent: validatedData.discount_percent || 0,
    start_date: validatedData.start_date || null,
    assigned_ktv_id: validatedData.assigned_ktv_id || null,
    preferred_time: validatedData.preferred_time || null,
    tenant_id: tenantId,
  };

  return payload;
}

export async function upsertBookingRecord(params: {
  supabase: SupabaseServerClient;
  existingBooking: BookingRow | null;
  bookingPayload: BookingInsert;
}): Promise<{ booking: BookingRow } | ActionError> {
  const { supabase, existingBooking, bookingPayload } = params;

  if (existingBooking) {
    const updatePayload: BookingUpdate = bookingPayload;
    const { data: updated, error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', existingBooking.id)
      .select()
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      return { error: error.message };
    }

    try {
      const { recordAuditLog } = await import('@/services/audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'bookings',
        record_id: existingBooking.id,
        old_data: existingBooking,
        new_data: bookingPayload,
      });
    } catch (auditErr) {
      await supabase
        .from('bookings')
        .update(existingBooking)
        .eq('id', existingBooking.id);
      return {
        error: auditErr instanceof Error
          ? auditErr.message
          : 'Failed to record createBooking update audit log',
      };
    }

    return { booking: updated };
  }

  const { data: inserted, error } = await supabase
    .from('bookings')
    .insert([bookingPayload])
    .select()
    .single();

  if (error) {
    console.error('Error creating booking:', error);
    return { error: error.message };
  }

  try {
    const { recordAuditLog } = await import('@/services/audit-actions');
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'bookings',
      record_id: inserted.id,
      new_data: inserted,
    });
  } catch (auditErr) {
    await supabase.from('bookings').delete().eq('id', inserted.id);
    return {
      error: auditErr instanceof Error
        ? auditErr.message
        : 'Failed to record createBooking insert audit log',
    };
  }

  return { booking: inserted };
}

export async function recordBookingDepositRevenue(params: {
  supabase: SupabaseServerClient;
  booking: BookingRow;
  tenantId: string;
  depositAmount: number;
}): Promise<ActionSuccess | ActionError> {
  const { supabase, booking, tenantId, depositAmount } = params;
  if (depositAmount <= 0) {
    return { success: true };
  }

  let insertedRevenue: { id: string } | null = null;
  let revenueFailed = false;

  const revenueType = 'deposit';
  const receivedDate = getLocalDateString();
  const businessEventType = inferBusinessEventType({
    sourceTable: 'revenue',
    revenueType,
  });
  const accountingPayload = {
    amount: depositAmount,
    payment_method: 'bank_transfer',
    booking_id: booking.id,
    reason: `Cọc gói ${resolvePackageName(booking)}`,
  };

  try {
    await assertOpenAccountingPeriod(supabase, {
      tenantId,
      date: receivedDate,
      context: 'Create booking deposit',
    });
  } catch (periodErr) {
    await supabase.from('bookings').delete().eq('id', booking.id);
    return {
      error: periodErr instanceof Error
        ? periodErr.message
        : 'Accounting period is closed or unavailable',
    };
  }

  const revenuePayload: RevenueInsert = {
    booking_id: booking.id,
    amount: depositAmount,
    revenue_type: revenueType,
    payment_method: 'bank_transfer',
    received_date: receivedDate,
    status: 'confirmed',
    notes: `Cọc gói ${resolvePackageName(booking)}`,
    tenant_id: tenantId,
    business_event_type: businessEventType,
    accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
    accounting_metadata: accountingPayload,
  };

  const { data: revenueData, error: revenueError } = await supabase
    .from('revenue')
    .insert([revenuePayload])
    .select('id')
    .single();

  if (revenueData) insertedRevenue = revenueData;

  if (revenueError) {
    console.warn('Error recording initial deposit revenue with standard client, trying with admin client fallback:', revenueError);
    const adminUrl = getSupabaseAdminUrl();
    const serviceRoleKey = getSupabaseAdminKey();
    if (adminUrl && serviceRoleKey) {
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createSupabaseClient<Database>(
        adminUrl,
        serviceRoleKey
      );
      const { data: adminRevenueData, error: adminRevenueError } = await supabaseAdmin
        .from('revenue')
        .insert([revenuePayload])
        .select('id')
        .single();

      if (adminRevenueData) insertedRevenue = adminRevenueData;

      if (adminRevenueError) {
        console.error('Error recording initial deposit revenue with admin client as well:', adminRevenueError);
        revenueFailed = true;
      } else {
        console.log('Successfully recorded initial deposit revenue with admin client fallback');
      }
    } else {
      revenueFailed = true;
    }
  }

  if (revenueFailed) {
    await supabase.from('bookings').delete().eq('id', booking.id);
    return { error: 'Không thể ghi nhận doanh thu đặt cọc. Đã hủy tạo booking.' };
  }

  if (insertedRevenue?.id && tenantId) {
    const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
    const outboxEnqueued = await enqueueWithAutoClient(
      supabase,
      {
        tenantId,
        eventType: 'PACKAGE_SALE',
        referenceType: 'REVENUE',
        referenceId: insertedRevenue.id,
        payload: {
          totalAmount: depositAmount,
          vatRate: 0,
          description: `Cọc gói ${resolvePackageName(booking)}`,
          branchId: tenantId,
        },
      },
      '[createBooking]'
    );
    if (!outboxEnqueued) {
      await supabase.from('revenue').delete().eq('id', insertedRevenue.id);
      await supabase.from('bookings').delete().eq('id', booking.id);
      return { error: 'Không thể ghi nhận hàng đợi kế toán cho doanh thu đặt cọc. Đã hủy tạo booking.' };
    }
  }

  return { success: true };
}

export async function createInitialSessionLogs(params: {
  supabase: SupabaseServerClient;
  booking: BookingRow;
  validatedData: ValidatedBookingData;
  tenantId: string;
}): Promise<ActionSuccess | ActionError> {
  const { supabase, booking, validatedData, tenantId } = params;
  const { count: existingLogsCount } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', booking.id);

  if (existingLogsCount && existingLogsCount > 0) {
    return { success: true };
  }

  const totalSessions = validatedData.total_sessions || 15;
  let startDateStr = validatedData.start_date;

  if (!startDateStr) {
    startDateStr = getLocalDateString();
  }

  const sessionLogs: SessionLogInsert[] = Array.from({ length: totalSessions }, (_, index) => {
    const [year, month, day] = startDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + index);

    const assignedDate = getLocalDateString(date);

    return {
      booking_id: booking.id,
      session_number: index + 1,
      status: 'scheduled',
      assigned_date: assignedDate,
      assigned_time: validatedData.preferred_time || null,
      tenant_id: tenantId,
    };
  });

  const { error: sessionsError } = await supabase
    .from('session_logs')
    .insert(sessionLogs);

  if (sessionsError) {
    console.error('Error creating session logs:', sessionsError);
    return { error: 'Booking created but session logs failed: ' + sessionsError.message };
  }

  return { success: true };
}
