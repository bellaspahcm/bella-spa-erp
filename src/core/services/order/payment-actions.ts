'use server';

import { getLocalDateString } from '@bella/shared';
import { safeRevalidatePath } from '@/lib/revalidate';
import { BookingError } from '@/core/lib/errors';
import { allocateConfirmedBookingPaymentToFinanceAr } from '@/services/finance-payment-allocation';
import {
  assertPaymentAccountingPeriod,
  buildManualPaymentIdempotencyKey,
  findExistingManualPaymentByIdempotencyKey,
  fetchBookingDetailsWithPayment,
  getBookingPaymentSnapshot,
  recordBookingPaymentRpc,
  type RecordRemainingPaymentParams,
  updateBookingShareToken,
  validateRemainingPaymentAmount,
} from './payment-helpers';

const BOOKING_TENANT_ACCESS_ERROR = 'Khong xac dinh duoc don vi kinh doanh cua nguoi dung hien tai.';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requireTenantId(currentUser: { tenant_id?: string | null } | null | undefined) {
  if (!currentUser?.tenant_id) {
    throw new BookingError(BOOKING_TENANT_ACCESS_ERROR, 'BOOKING_TENANT_ACCESS_ERROR');
  }
  return currentUser.tenant_id;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readStringField(source: Record<string, unknown> | null, field: string): string | null {
  const value = source?.[field];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function resolvePaymentRevenueId(data: unknown): string | null {
  const record = asRecord(data);
  const directRevenueId = readStringField(record, 'revenue_id');
  if (directRevenueId) return directRevenueId;
  return readStringField(asRecord(record?.revenue), 'id');
}

function resolvePaymentRevenueStatus(data: unknown): string | null {
  const record = asRecord(data);
  const directStatus = readStringField(record, 'revenue_status');
  if (directStatus) return directStatus;
  return readStringField(asRecord(record?.revenue), 'status');
}

async function safeAllocateConfirmedPaymentToFinanceAr(params: {
  readonly payment: RecordRemainingPaymentParams;
  readonly tenantId: string;
  readonly paymentData: unknown;
}): Promise<{ readonly status: 'ALLOCATED' | 'SKIPPED' | 'FAILED'; readonly error?: string }> {
  const revenueId = resolvePaymentRevenueId(params.paymentData);
  const revenueStatus = resolvePaymentRevenueStatus(params.paymentData)
    ?? params.payment.status
    ?? 'pending';

  if (revenueStatus !== 'confirmed') {
    return { status: 'SKIPPED' };
  }
  if (!revenueId) {
    return {
      status: 'FAILED',
      error: 'BOOKING_PAYMENT_REVENUE_ID_MISSING',
    };
  }

  const receivedDate = getLocalDateString();
  const revenueType = params.payment.revenue_type || 'remaining_payment';
  const idempotencyKey = params.payment.idempotency_key
    || buildManualPaymentIdempotencyKey(params.payment, receivedDate, revenueType);
  const amountMinor = Math.round(Math.abs(Number(params.payment.amount)));

  try {
    await allocateConfirmedBookingPaymentToFinanceAr({
      tenantId: params.tenantId,
      bookingId: params.payment.booking_id,
      revenueId,
      amountMinor,
      currency: 'VND',
      paymentMethod: params.payment.payment_method,
      receivedAt: receivedDate,
      idempotencyKey,
      description: params.payment.notes || 'Confirmed booking remaining payment',
    });
    return { status: 'ALLOCATED' };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[recordRemainingPayment] Finance AR allocation failed:', message);
    return {
      status: 'FAILED',
      error: message,
    };
  }
}

function attachFinanceAllocationOutcome(
  data: unknown,
  outcome: { readonly status: 'ALLOCATED' | 'SKIPPED' | 'FAILED'; readonly error?: string },
) {
  if (outcome.status !== 'FAILED') {
    return data;
  }
  const record = asRecord(data);
  return record
    ? { ...record, finance_ar_allocation: outcome }
    : data;
}

export async function recordRemainingPayment(params: RecordRemainingPaymentParams) {
  const { createDevelopmentBypassClient } = await import('@/lib/supabase-dev-bypass-server');
  const supabase = await createDevelopmentBypassClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

  try {
    const tenantId = requireTenantId(currentUser);
    const bookingResult = await getBookingPaymentSnapshot(supabase, params.booking_id, tenantId);
    if ('error' in bookingResult) {
      throw new BookingError(bookingResult.error || 'Unknown booking payment snapshot error', 'BOOKING_PAYMENT_SNAPSHOT_ERROR', { bookingId: params.booking_id });
    }

    const existingPaymentResult = await findExistingManualPaymentByIdempotencyKey({
      supabase,
      payment: params,
      tenantId,
    });
    if ('error' in existingPaymentResult) {
      throw new BookingError(existingPaymentResult.error || 'Failed to verify payment idempotency', 'BOOKING_PAYMENT_IDEMPOTENCY_LOOKUP_ERROR', { bookingId: params.booking_id });
    }
    if (existingPaymentResult.data) {
      const financeAllocation = await safeAllocateConfirmedPaymentToFinanceAr({
        payment: params,
        tenantId,
        paymentData: existingPaymentResult.data,
      });

      await Promise.all([
        safeRevalidatePath(`/dashboard/customers/${params.customer_id}`),
        safeRevalidatePath('/dashboard/finance'),
      ]);

      return {
        success: true,
        data: attachFinanceAllocationOutcome(existingPaymentResult.data, financeAllocation),
      };
    }

    const amountValidation = validateRemainingPaymentAmount(bookingResult.booking, params.amount);
    if ('error' in amountValidation) {
      throw new BookingError(amountValidation.error || 'Invalid payment amount', 'BOOKING_PAYMENT_AMOUNT_INVALID', { bookingId: params.booking_id, amount: params.amount });
    }

    const periodResult = await assertPaymentAccountingPeriod();
    if ('error' in periodResult) {
      throw new BookingError(periodResult.error || 'Accounting period is closed', 'BOOKING_ACCOUNTING_PERIOD_CLOSED');
    }

    const rpcResult = await recordBookingPaymentRpc({
      supabase,
      payment: params,
      tenantId,
      actorId: currentUser?.id || null,
    });

    if ('error' in rpcResult) {
      throw new BookingError(rpcResult.error || 'Failed to record payment', 'BOOKING_PAYMENT_RECORD_ERROR', { bookingId: params.booking_id });
    }

    const financeAllocation = await safeAllocateConfirmedPaymentToFinanceAr({
      payment: params,
      tenantId,
      paymentData: rpcResult.data,
    });

    await Promise.all([
      safeRevalidatePath(`/dashboard/customers/${params.customer_id}`),
      safeRevalidatePath('/dashboard/finance'),
    ]);

    return {
      success: true,
      data: attachFinanceAllocationOutcome(rpcResult.data, financeAllocation),
    };
  } catch (error) {
    console.error('Error recording remaining payment:', error);
    return { error: getErrorMessage(error) };
  }
}

export async function generateShareToken(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();
  let tenantId: string;
  try {
    tenantId = requireTenantId(currentUser);
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
  const crypto = await import('crypto');

  const token = crypto.randomUUID().split('-')[0] + crypto.randomUUID().split('-')[1];
  const result = await updateBookingShareToken(supabase, bookingId, token, tenantId);

  if ('error' in result) {
    console.error('Error generating booking share link:', result.error);
    return { error: result.error };
  }

  const tokenData = result.data?.[0];
  const revalPaths = ['/dashboard/customers'];
  if (tokenData?.customer_id) {
    revalPaths.push(`/dashboard/customers/${tokenData.customer_id}`);
  }
  await Promise.all(revalPaths.map((path) => safeRevalidatePath(path)));

  return { data: tokenData };
}

export async function getBookingDetailsWithPayment(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();
  let tenantId: string;
  try {
    tenantId = requireTenantId(currentUser);
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
  const result = await fetchBookingDetailsWithPayment(supabase, bookingId, tenantId);

  if ('error' in result) {
    console.error('Error fetching booking payment details:', result.error);
    return { error: result.error };
  }

  return { data: result.data };
}
