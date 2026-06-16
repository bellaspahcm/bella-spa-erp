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
  validateBookingPackageScope,
} from './create-booking-helpers';

type CreateBookingInput = z.input<typeof bookingSchema> & {
  newCustomer?: Omit<Database['public']['Tables']['customers']['Insert'], 'tenant_id'> &
    Partial<Pick<Database['public']['Tables']['customers']['Insert'], 'tenant_id'>>;
};
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type BookingValidationDetails = z.inferFlattenedErrors<typeof bookingSchema>['fieldErrors'];
type CreateBookingResult =
  | { error: string; details?: BookingValidationDetails; data?: undefined }
  | { data: BookingRow; error?: undefined; details?: undefined };

export async function createBooking(formData: CreateBookingInput): Promise<CreateBookingResult> {
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

  const tenantResult = await resolveBookingTenant(supabase);
  if ('error' in tenantResult) {
    return { error: tenantResult.error };
  }
  const tenantId = tenantResult.tenantId;

  const packageScopeResult = await validateBookingPackageScope(supabase, tenantId, validatedData.package_id);
  if ('error' in packageScopeResult) {
    return { error: packageScopeResult.error };
  }

  const customerResult = await createCustomerForBookingIfNeeded(supabase, validatedData, formData, tenantId);
  if ('error' in customerResult) {
    return { error: customerResult.error };
  }
  const customerId = customerResult.customerId;

  const existingBooking = await findPendingBookingForCustomer(supabase, customerId, tenantId);

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
