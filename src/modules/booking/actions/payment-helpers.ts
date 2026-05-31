import { getLocalDateString } from '@/lib/utils';
import { inferBusinessEventType } from '@/services/accounting/template-rules';
import { resolveAccountingReviewStatus } from './accounting-review';
import type { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type BookingUpdate = Database['public']['Tables']['bookings']['Update'];

export type RecordRemainingPaymentParams = {
  booking_id: string;
  customer_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
  status?: string;
  revenue_type?: string;
  receipt_url?: string;
};

type PaymentBookingSnapshot = {
  id: string;
  deposit_amount: number | null;
  full_price: number | null;
  status: string | null;
  tenant_id: string | null;
  discount_percent: number | null;
};

type PaymentRpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export async function getBookingPaymentSnapshot(
  supabase: SupabaseServerClient,
  bookingId: string
) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, deposit_amount, full_price, status, tenant_id, discount_percent')
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    return { error: 'Không tìm thấy booking: ' + (error?.message || '') };
  }

  return { booking: booking as PaymentBookingSnapshot };
}

export function validateRemainingPaymentAmount(
  booking: PaymentBookingSnapshot,
  amount: number
) {
  if (amount <= 0) {
    return { error: 'Số tiền thanh toán phải lớn hơn 0' };
  }

  const fullPrice = Number(booking.full_price || 0);
  const discountPercent = Number(booking.discount_percent || 0);
  const currentDebt = (fullPrice * (1 - discountPercent / 100)) - Number(booking.deposit_amount || 0);

  if (amount > currentDebt) {
    return { error: `Số tiền thanh toán vượt quá số tiền còn nợ của gói (${currentDebt.toLocaleString()} đ)` };
  }

  return { success: true };
}

export async function assertPaymentAccountingPeriod() {
  try {
    const { checkMonthLock } = await import('@/services/audit-actions');
    const lockCheck = await checkMonthLock();
    if (lockCheck?.isLocked) {
      return { error: 'Không thể ghi nhận doanh thu: Kỳ kế toán này đã được chốt sổ.' };
    }
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error
        ? error.message
        : 'Không thể kiểm tra trạng thái khóa kỳ kế toán.',
    };
  }
}

export async function recordBookingPaymentRpc(params: {
  supabase: SupabaseServerClient;
  payment: RecordRemainingPaymentParams;
  tenantId: string | null;
  actorId: string | null;
}) {
  const { supabase, payment, tenantId, actorId } = params;
  const receivedDate = getLocalDateString();
  const revenueType = payment.revenue_type || 'remaining_payment';
  const businessEventType = inferBusinessEventType({
    sourceTable: 'revenue',
    revenueType,
  });
  const accountingPayload = {
    amount: payment.amount,
    payment_method: payment.payment_method,
    booking_id: payment.booking_id,
    reason: payment.notes,
  };

  const callPaymentRpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<PaymentRpcResult>;

  const { data: rpcResult, error: rpcError } = await callPaymentRpc(
    'record_remaining_payment_atomic',
    {
      p_booking_id: payment.booking_id,
      p_amount: payment.amount,
      p_payment_method: payment.payment_method,
      p_received_date: receivedDate,
      p_status: payment.status || 'pending',
      p_revenue_type: revenueType,
      p_notes: payment.notes || null,
      p_receipt_url: payment.receipt_url || null,
      p_actor_id: actorId,
      p_business_event_type: businessEventType,
      p_accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
      p_accounting_metadata: accountingPayload,
      p_outbox_payload: {
        totalAmount: payment.amount,
        vatRate: 0,
        description: payment.notes || 'Thanh toán nốt phần còn lại.',
        branchId: tenantId,
      },
    }
  );

  if (rpcError) {
    return { error: 'Không thể ghi nhận giao dịch tài chính: ' + rpcError.message };
  }

  return { data: rpcResult };
}

export async function updateBookingShareToken(
  supabase: SupabaseServerClient,
  bookingId: string,
  token: string
) {
  const tokenPayload: BookingUpdate = {
    share_token: token,
  };

  const { data, error } = await supabase
    .from('bookings')
    .update(tokenPayload)
    .eq('id', bookingId)
    .select();

  if (error) {
    return { error: error.message };
  }

  return { data };
}

export async function fetchBookingDetailsWithPayment(
  supabase: SupabaseServerClient,
  bookingId: string
) {
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
    return { error: error.message };
  }

  return { data };
}
