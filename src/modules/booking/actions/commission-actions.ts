'use server';

export async function resolveKtvCommission(booking: any): Promise<number> {
  if (booking?.ktv_commission) return Number(booking.ktv_commission);
  if (booking?.packages?.ktv_commission) return Number(booking.packages.ktv_commission);
  return 150000; // Default fallback
}
