export const UNLIMITED_QUOTA = 999999;

export type SubscriptionFeatureKey = 'ktv' | 'customer' | 'sms';

export type SubscriptionEntitlementLike = {
  feature_key: string;
  limit_value?: number | string | null;
  is_unlimited?: boolean | null;
};

export type SubscriptionLimitSnapshot = {
  maxKtv: number;
  maxCustomers: number;
  maxSms: number;
  tierName: string;
};

export function normalizeSubscriptionFeatureKey(value: string | null | undefined): SubscriptionFeatureKey | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'ktv' || normalized === 'customer' || normalized === 'sms') return normalized;
  return null;
}

function toFiniteNumber(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function getEntitlementLimitValue(entitlement: SubscriptionEntitlementLike) {
  if (entitlement.is_unlimited) return UNLIMITED_QUOTA;
  return toFiniteNumber(entitlement.limit_value);
}

export function buildQuotaSnapshot(
  tierName: string,
  maxKtv: number,
  maxCustomers: number,
  maxSms: number
): SubscriptionLimitSnapshot {
  return {
    maxKtv,
    maxCustomers,
    maxSms,
    tierName,
  };
}

export function buildEffectiveSubscriptionLimits(
  tierName: string,
  entitlements: SubscriptionEntitlementLike[]
): SubscriptionLimitSnapshot {
  const byFeature = new Map(entitlements.map((row) => [normalizeSubscriptionFeatureKey(row.feature_key), row]));
  const ktv = byFeature.get('ktv');
  const customer = byFeature.get('customer');
  const sms = byFeature.get('sms');

  return buildQuotaSnapshot(
    tierName,
    ktv ? getEntitlementLimitValue(ktv) : 0,
    customer ? getEntitlementLimitValue(customer) : 0,
    sms ? getEntitlementLimitValue(sms) : 0
  );
}

export function calculateSubscriptionUsageState(input: {
  current: number | null | undefined;
  entitlement: SubscriptionEntitlementLike;
}) {
  const current = Math.max(0, toFiniteNumber(input.current));
  const max = getEntitlementLimitValue(input.entitlement);
  const isUnlimited = Boolean(input.entitlement.is_unlimited);

  return {
    isBlocked: isUnlimited ? false : current >= max,
    current,
    max,
    isUnlimited,
  };
}

export function isSubscriptionExpired(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
) {
  if (!expiresAt) return false;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry < now;
}

export function validateSubscriptionDuration(durationMonths: number) {
  return Number.isInteger(durationMonths) && durationMonths > 0
    ? null
    : 'Thời hạn gói cước không hợp lệ';
}

export function calculateSubscriptionInvoiceAmount(input: {
  priceMonthly: number | string | null | undefined;
  durationMonths: number;
}) {
  const durationError = validateSubscriptionDuration(input.durationMonths);
  if (durationError) {
    return { success: false as const, error: durationError };
  }

  const priceMonthly = toFiniteNumber(input.priceMonthly);
  if (priceMonthly < 0) {
    return { success: false as const, error: 'Giá gói cước không hợp lệ' };
  }

  return {
    success: true as const,
    amount: priceMonthly * input.durationMonths,
  };
}

export function normalizeQuotaOverride(input: {
  limitValue?: number | null;
  isUnlimited?: boolean;
}) {
  const isUnlimited = input.isUnlimited ?? false;
  return {
    isUnlimited,
    limitValue: isUnlimited ? null : input.limitValue ?? null,
  };
}

export function validateQuotaOverrideLimit(input: {
  limitValue?: number | null;
  isUnlimited?: boolean;
}) {
  const override = normalizeQuotaOverride(input);
  if (!override.isUnlimited && (override.limitValue === null || override.limitValue < 0)) {
    return 'Quota override can only be limited with a non-negative limitValue or marked unlimited.';
  }

  return null;
}

export function calculateUsagePercent(current?: number | null, max?: number | null) {
  const maxValue = toFiniteNumber(max);
  if (maxValue <= 0 || maxValue >= UNLIMITED_QUOTA) return 0;

  return Math.min(100, Math.round((toFiniteNumber(current) / maxValue) * 100));
}
