'use server';

import { sanitizeTime } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';
import { bookingSchema } from '@/lib/validations';
import type { Database } from '@/types/database.types';
import type { z } from 'zod';
import {
  buildBookingPayload,
  createCustomerForBookingIfNeeded,
  createInitialSessionLogs,
  enforceCreateBookingRateLimit,
  findPendingBookingForCustomer,
  recordBookingDepositRevenue,
  resolveBookingTenant,
  upsertBookingRecord,
} from './create-booking-helpers';

type CreateBookingInput = z.input<typeof bookingSchema> & {
  newCustomer?: Database['public']['Tables']['customers']['Insert'];
};

// Keep the legacy loose return type because several integration tests and callers
// read `result.data` after runtime assertions instead of TypeScript narrowing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createBooking(formData: CreateBookingInput): Promise<any> {
  const rateLimitResult = await enforceCreateBookingRateLimit();
  if ('error' in rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  
  const validatedFields = bookingSchema.safeParse(formData);
  
  if (!validatedFields.success) {
    const errorMessages = Object.values(validatedFields.error.flatten().fieldErrors).flat().join(', ');
    return { error: `Dữ liệu booking không hợp lệ: ${errorMessages}`, details: validatedFields.error.flatten().fieldErrors };
  }

  const validatedData = validatedFields.data;
  if (validatedData.preferred_time) {
    validatedData.preferred_time = sanitizeTime(validatedData.preferred_time) || undefined;
  }

  const customerResult = await createCustomerForBookingIfNeeded(supabase, validatedData, formData);
  if ('error' in customerResult) {
    return { error: customerResult.error };
  }
  const customerId = customerResult.customerId;

  const existingBooking = await findPendingBookingForCustomer(supabase, customerId);
  const tenantResult = await resolveBookingTenant(supabase);
  if ('error' in tenantResult) {
    return { error: tenantResult.error };
  }
  const tenantId = tenantResult.tenantId;

  const bookingPayload = await buildBookingPayload({
    validatedData,
    customerId,
    tenantId,
    existingBooking,
  });
  const bookingResult = await upsertBookingRecord({
    supabase,
    existingBooking,
    bookingPayload,
  });
  if ('error' in bookingResult) {
    return { error: bookingResult.error };
  }
  const booking = bookingResult.booking;

  const depositResult = await recordBookingDepositRevenue({
    supabase,
    booking,
    tenantId,
    depositAmount: validatedData.deposit_amount,
  });
  if ('error' in depositResult) {
    return { error: depositResult.error };
  }

  const sessionLogsResult = await createInitialSessionLogs({
    supabase,
    booking,
    validatedData,
    tenantId,
  });
  if ('error' in sessionLogsResult) {
    return { error: sessionLogsResult.error };
  }

  const revalPaths = [
    '/dashboard/bookings',
    '/dashboard/sessions',
    '/dashboard/customers',
    `/dashboard/customers/${customerId}`,
    '/dashboard',
    '/dashboard/finance'
  ];
  await Promise.all(revalPaths.map(path => safeRevalidatePath(path)));

  return { data: booking };
}
