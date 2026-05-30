'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { resolvePackageName, getLocalDateString, sanitizeTime } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import { bookingSchema } from '@/lib/validations';
import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import { inferBusinessEventType } from '@/services/accounting/template-rules';
import { resolveAccountingReviewStatus } from './accounting-review';
import { resolveKtvCommission } from './commission-actions';

export async function createBooking(formData: any) {
  // 0. Rate limiting by Client IP (Token Bucket: 5 requests / 10 minutes)
  let rateLimitAllowed = true;
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
    // 5 requests / 10 minutes = 5 tokens capacity, refill rate of 5/600 per second (approx 0.008333)
    rateLimitAllowed = rateLimit(`booking_ip:${clientIp}`, 5, 5 / 600);
  } catch (err) {
    console.error('[createBooking] Rate-limiting evaluation failed, rejecting request for safety:', err);
    return { error: 'Hệ thống tạm thời không khả dụng. Vui lòng thử lại.' };
  }

  if (!rateLimitAllowed) {
    return { error: 'Bạn đã thực hiện quá nhiều yêu cầu đặt lịch. Vui lòng thử lại sau ít phút.' };
  }

  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  // 0. Validate with Zod
  const validatedFields = bookingSchema.safeParse(formData);
  
  if (!validatedFields.success) {
    const errorMessages = Object.values(validatedFields.error.flatten().fieldErrors).flat().join(', ');
    return { error: `Dữ liệu booking không hợp lệ: ${errorMessages}`, details: validatedFields.error.flatten().fieldErrors };
  }

  const validatedData = validatedFields.data;
  if (validatedData.preferred_time) {
    validatedData.preferred_time = sanitizeTime(validatedData.preferred_time) || undefined;
  }

  // 0.5. Support atomic customer creation for new customers
  if (validatedData.customer_id === 'new' && formData.newCustomer) {
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .insert([formData.newCustomer])
      .select()
      .single();
      
    if (custError) {
      console.error('Error creating customer inside createBooking:', custError);
      return { error: 'Lỗi khi tạo khách hàng: ' + custError.message };
    }
    
    validatedData.customer_id = customer.id;

    // Log audit for customer
    try {
      const { recordAuditLog } = await import('@/services/audit-actions');
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'customers',
        record_id: customer.id,
        new_data: customer
      });
    } catch (auditErr) {
      await supabase.from('customers').delete().eq('id', customer.id);
      return {
        error: auditErr instanceof Error
          ? auditErr.message
          : 'Failed to record customer audit log in createBooking'
      };
    }
  }

  // 1. Check for existing "pending" or "deposit" booking for this customer to avoid duplicates
  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', validatedData.customer_id)
    .in('status', ['deposit_pending', 'lead'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let booking;
  let bookingError;

  const { getCurrentUser } = await import('@/services/user-actions');

  let tenantId: string | null = null;
  let userEmail: string | null = null;
  let isLoggedIn = false;

  const currentUser = await getCurrentUser();
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

  const isFullBooking = validatedData.full_price > 0 && (validatedData.deposit_amount || 0) >= validatedData.full_price;
  const lockedCommission = validatedData.ktv_commission || await resolveKtvCommission(validatedData);
  
  const bookingPayload: any = {
    customer_id: validatedData.customer_id,
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
    tenant_id: tenantId
  };

  if (existingBooking) {
    const { data: updated, error } = await supabase
      .from('bookings')
      .update(bookingPayload)
      .eq('id', existingBooking.id)
      .select()
      .single();
    booking = updated;
    bookingError = error;

    if (!error && updated) {
      try {
        const { recordAuditLog } = await import('@/services/audit-actions');
        await recordAuditLog({
          action: 'UPDATE',
          table_name: 'bookings',
          record_id: existingBooking.id,
          old_data: existingBooking,
          new_data: bookingPayload
        });
      } catch (auditErr) {
        await supabase
          .from('bookings')
          .update(existingBooking)
          .eq('id', existingBooking.id);
        return {
          error: auditErr instanceof Error
            ? auditErr.message
            : 'Failed to record createBooking update audit log'
        };
      }
    }
  } else {
    const { data: inserted, error } = await supabase
      .from('bookings')
      .insert([bookingPayload])
      .select()
      .single();
    booking = inserted;
    bookingError = error;

    if (!error && inserted) {
      try {
        const { recordAuditLog } = await import('@/services/audit-actions');
        await recordAuditLog({
          action: 'INSERT',
          table_name: 'bookings',
          record_id: inserted.id,
          new_data: inserted
        });
      } catch (auditErr) {
        await supabase.from('bookings').delete().eq('id', inserted.id);
        return {
          error: auditErr instanceof Error
            ? auditErr.message
            : 'Failed to record createBooking insert audit log'
        };
      }
    }
  }

  if (bookingError) {
    console.error('Error creating booking:', bookingError);
    return { error: bookingError.message };
  }

  if (validatedData.deposit_amount > 0 && booking?.id) {
    let insertedRev: { id: string } | null = null;
    let revFailed = false;

    const revenueType = 'deposit';
    const receivedDate = getLocalDateString();
    const businessEventType = inferBusinessEventType({
      sourceTable: 'revenue',
      revenueType,
    });
    const accountingPayload = {
      amount: validatedData.deposit_amount,
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

    const { data: revData, error: revError } = await supabase
      .from('revenue')
      .insert([{
        booking_id: booking.id,
        amount: validatedData.deposit_amount,
        revenue_type: revenueType,
        payment_method: 'bank_transfer',
        received_date: receivedDate,
        status: 'confirmed',
        notes: `Cọc gói ${resolvePackageName(booking)}`,
        tenant_id: tenantId,
        business_event_type: businessEventType,
        accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
        accounting_metadata: accountingPayload
      }])
      .select('id')
      .single();
    
    if (revData) insertedRev = revData;
    
    if (revError) {
      console.warn('Error recording initial deposit revenue with standard client, trying with admin client fallback:', revError);
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        );
        const { data: adminRevData, error: adminRevError } = await supabaseAdmin
          .from('revenue')
          .insert([{
            booking_id: booking.id,
            amount: validatedData.deposit_amount,
            revenue_type: revenueType,
            payment_method: 'bank_transfer',
            received_date: receivedDate,
            status: 'confirmed',
            notes: `Cọc gói ${resolvePackageName(booking)}`,
            tenant_id: tenantId,
            business_event_type: businessEventType,
            accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
            accounting_metadata: accountingPayload
          }])
          .select('id')
          .single();
        
        if (adminRevData) insertedRev = adminRevData;

        if (adminRevError) {
          console.error('Error recording initial deposit revenue with admin client as well:', adminRevError);
          revFailed = true;
        } else {
          console.log('Successfully recorded initial deposit revenue with admin client fallback');
        }
      } else {
        revFailed = true;
      }
    }

    if (revFailed) {
      await supabase.from('bookings').delete().eq('id', booking.id);
      return { error: 'Không thể ghi nhận doanh thu đặt cọc. Đã hủy tạo booking.' };
    }

    // ⭐ Ghi nhận vào hàng đợi Accounting Outbox nếu tạo revenue thành công
    if (insertedRev?.id && tenantId) {
      const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
      await enqueueWithAutoClient(
        supabase,
        {
          tenantId,
          eventType: 'PACKAGE_SALE',
          referenceType: 'REVENUE',
          referenceId: insertedRev.id,
          payload: {
            totalAmount: validatedData.deposit_amount,
            vatRate: 0,
            description: `Cọc gói ${resolvePackageName(booking)}`,
            // TODO Phase 29: thay tenantId bằng branch_id thực khi có bảng branches riêng
            branchId: tenantId,
          },
        },
        '[createBooking]'
      );
    }
  }

  const { count: existingLogsCount } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', booking.id);

  if (!existingLogsCount || existingLogsCount === 0) {
    const totalSessions = validatedData.total_sessions || 15;
    let startDateStr = validatedData.start_date;
    
    if (!startDateStr) {
      const now = new Date();
      startDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    
    const sessionLogs = Array.from({ length: totalSessions }, (_: any, i: number) => {
      const [y, m, d] = startDateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + i);
      
      const assignedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      return {
        booking_id: booking.id,
        session_number: i + 1,
        status: 'scheduled',
        assigned_date: assignedDate,
        assigned_time: validatedData.preferred_time || null,
        tenant_id: tenantId
      };
    });

    const { error: sessionsError } = await supabase
      .from('session_logs')
      .insert(sessionLogs as any);

    if (sessionsError) {
      console.error('Error creating session logs:', sessionsError);
      return { error: 'Booking created but session logs failed: ' + sessionsError.message };
    }
  }

  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions',
    '/dashboard/customers',
    `/dashboard/customers/${validatedData.customer_id}`,
    '/dashboard',
    '/dashboard/finance'
  ];
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  return { data: booking };
}