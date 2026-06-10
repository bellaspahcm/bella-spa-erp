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

const BOOKING_TENANT_ACCESS_ERROR = 'Khong xac dinh duoc don vi kinh doanh cua nguoi dung hien tai.';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requireTenantId(currentUser: { tenant_id?: string | null } | null | undefined) {
  if (!currentUser?.tenant_id) {
    throw new Error(BOOKING_TENANT_ACCESS_ERROR);
  }
  return currentUser.tenant_id;
}

export async function recordRemainingPayment(params: RecordRemainingPaymentParams) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { getCurrentUser } = await import('@/services/user-actions');
  const currentUser = await getCurrentUser();

  try {
    const tenantId = requireTenantId(currentUser);
    const bookingResult = await getBookingPaymentSnapshot(supabase, params.booking_id, tenantId);
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
