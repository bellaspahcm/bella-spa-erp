'use server';

import { safeRevalidatePath } from '@/lib/revalidate';
import {
  assertPaymentAccountingPeriod,
  fetchBookingDetailsWithPayment,
  getBookingPaymentSnapshot,
  recordBookingPaymentRpc,
  type RecordRemainingPaymentParams,
  updateBookingShareToken,
  validateRemainingPaymentAmount,
} from './payment-helpers';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function recordRemainingPayment(params: RecordRemainingPaymentParams) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

  try {
    const bookingResult = await getBookingPaymentSnapshot(supabase, params.booking_id);
    if ('error' in bookingResult) {
      throw new Error(bookingResult.error);
    }

    const amountValidation = validateRemainingPaymentAmount(bookingResult.booking, params.amount);
    if ('error' in amountValidation) {
      throw new Error(amountValidation.error);
    }

    const periodResult = await assertPaymentAccountingPeriod();
    if ('error' in periodResult) {
      throw new Error(periodResult.error);
    }

    const tenantId = bookingResult.booking.tenant_id || currentUser?.tenant_id || null;
    const rpcResult = await recordBookingPaymentRpc({
      supabase,
      payment: params,
      tenantId,
      actorId: currentUser?.id || null,
    });

    if ('error' in rpcResult) {
      throw new Error(rpcResult.error);
    }

    await Promise.all([
      safeRevalidatePath(`/dashboard/customers/${params.customer_id}`),
      safeRevalidatePath('/dashboard/finance'),
    ]);

    return { success: true, data: rpcResult.data };
  } catch (error) {
    console.error('Error recording remaining payment:', error);
    return { error: getErrorMessage(error) };
  }
}

export async function generateShareToken(bookingId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const crypto = await import('crypto');

  const token = crypto.randomUUID().split('-')[0] + crypto.randomUUID().split('-')[1];
  const result = await updateBookingShareToken(supabase, bookingId, token);

  if ('error' in result) {
    console.error('Error generating share token:', result.error);
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
  const result = await fetchBookingDetailsWithPayment(supabase, bookingId);

  if ('error' in result) {
    console.error('Error fetching booking payment details:', result.error);
    return { error: result.error };
  }

  return { data: result.data };
}
