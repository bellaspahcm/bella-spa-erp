'use server';

type CommissionSource = {
  ktv_commission?: number | string | null;
  packages?: { ktv_commission?: number | string | null } | null;
};

export async function resolveKtvCommission(booking: CommissionSource | null | undefined): Promise<number> {
  if (booking?.ktv_commission) return Number(booking.ktv_commission);
  if (booking?.packages?.ktv_commission) return Number(booking.packages.ktv_commission);
  return 150000; // Default fallback
}
