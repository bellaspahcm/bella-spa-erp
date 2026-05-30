'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { getLocalDateString } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import { inferBusinessEventType } from '@/services/accounting/template-rules';
import { resolveAccountingReviewStatus } from './accounting-review';

export async function recordRemainingPayment(params: {
  booking_id: string;
  customer_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
  status?: string;
  revenue_type?: string;
  receipt_url?: string;
}) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

  try {
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, deposit_amount, full_price, status, tenant_id, discount_percent')
      .eq('id', params.booking_id)
      .single();

    if (fetchError || !booking) throw new Error('Không tìm thấy booking: ' + fetchError?.message);

    if (params.amount <= 0) {
      throw new Error('Số tiền thanh toán phải lớn hơn 0');
    }

    const currentDebt = (booking.full_price * (1 - (booking.discount_percent || 0) / 100)) - (booking.deposit_amount || 0);
    if (params.amount > currentDebt) {
      throw new Error(`Số tiền thanh toán vượt quá số tiền còn nợ của gói (${currentDebt.toLocaleString()} đ)`);
    }

    try {
      const { checkMonthLock } = await import('@/services/audit-actions');
      const lockCheck = await checkMonthLock();
      if (lockCheck?.isLocked) {
        throw new Error('Không thể ghi nhận doanh thu: Kỳ kế toán này đã được chốt sổ.');
      }
    } catch (e: any) {
      if (e.message.includes('chốt sổ')) throw e;
    }

    const tenantId = booking.tenant_id || currentUser?.tenant_id;
    const receivedDate = getLocalDateString();
    const revenueType = params.revenue_type || 'remaining_payment';
    const businessEventType = inferBusinessEventType({
      sourceTable: 'revenue',
      revenueType,
    });
    const accountingPayload = {
      amount: params.amount,
      payment_method: params.payment_method,
      booking_id: params.booking_id,
      reason: params.notes,
    };

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'record_remaining_payment_atomic',
      {
        p_booking_id: params.booking_id,
        p_amount: params.amount,
        p_payment_method: params.payment_method,
        p_received_date: receivedDate,
        p_status: params.status || 'pending',
        p_revenue_type: revenueType,
        p_notes: params.notes || null,
        p_receipt_url: params.receipt_url || null,
        p_actor_id: currentUser?.id || null,
        p_business_event_type: businessEventType,
        p_accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
        p_accounting_metadata: accountingPayload,
        p_outbox_payload: {
          totalAmount: params.amount,
          vatRate: 0,
          description: params.notes || 'Thanh toán nốt phần còn lại.',
          branchId: tenantId,
        },
      }
    );

    if (rpcError) {
      throw new Error('Không thể ghi nhận giao dịch tài chính: ' + rpcError.message);
    }

    await Promise.all([
      safeRevalidatePath(`/dashboard/customers/${params.customer_id}`),
      safeRevalidatePath('/dashboard/finance'),
    ]);

    return { success: true, data: rpcResult };
  } catch (error: any) {
    console.error('Error recording remaining payment:', error);
    return { error: error.message };
  }
}

export async function generateShareToken(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const crypto = await import('crypto');

  const token = crypto.randomUUID().split('-')[0] + crypto.randomUUID().split('-')[1];

  const { data, error } = await supabase
    .from('bookings')
    .update({ share_token: token })
    .eq('id', bookingId)
    .select();

  if (error) {
    console.error('Error generating share token:', error);
    return { error: error.message };
  }

  const tokenData = data?.[0];
  const revalPaths = ['/dashboard/customers'];
  if (tokenData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${tokenData.customer_id}`);
  }
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  return { data: tokenData };
}

export async function getBookingDetailsWithPayment(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      tenants (
        id,
        name,
        qr_bank_code,
        qr_account_number,
        qr_account_name
      ),
      revenue (
        *
      )
    `)
    .eq('id', bookingId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching booking payment details:', error);
    return { error: error.message };
  }

  return { data };
}
