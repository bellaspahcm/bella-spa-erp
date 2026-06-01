import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';

export interface SubscriptionLimit {
  maxKtv: number;
  maxCustomers: number;
  maxSms: number;
  tierName: string;
}

type EffectiveEntitlement =
  Database['public']['Functions']['get_effective_subscription_entitlements']['Returns'][number];

const UNLIMITED_QUOTA = 999999;

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionLimit> = {
  free_trial: {
    maxKtv: 1,
    maxCustomers: 15,
    maxSms: 20,
    tierName: 'Dùng thử miễn phí',
  },
  basic: {
    maxKtv: 3,
    maxCustomers: 50,
    maxSms: 100,
    tierName: 'Gói Cơ bản',
  },
  pro: {
    maxKtv: 10,
    maxCustomers: 500,
    maxSms: 500,
    tierName: 'Gói Chuyên nghiệp',
  },
  enterprise: {
    maxKtv: 999999, // unlimited
    maxCustomers: 999999, // unlimited
    maxSms: 2000,
    tierName: 'Gói Nhượng quyền',
  },
};

function resolveTierName(tier: string) {
  return SUBSCRIPTION_TIERS[tier]?.tierName || tier;
}

function entitlementLimitValue(entitlement: EffectiveEntitlement) {
  if (entitlement.is_unlimited) return UNLIMITED_QUOTA;
  return Number(entitlement.limit_value ?? 0);
}

function buildEffectiveLimits(tier: string, entitlements: EffectiveEntitlement[]): SubscriptionLimit {
  const byFeature = new Map(entitlements.map((row) => [row.feature_key, row]));
  const ktv = byFeature.get('ktv');
  const customer = byFeature.get('customer');
  const sms = byFeature.get('sms');

  return {
    maxKtv: ktv ? entitlementLimitValue(ktv) : 0,
    maxCustomers: customer ? entitlementLimitValue(customer) : 0,
    maxSms: sms ? entitlementLimitValue(sms) : 0,
    tierName: resolveTierName(tier),
  };
}

async function getEffectiveEntitlements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  limitType: 'ktv' | 'customer' | 'sms'
) {
  const { data, error } = await supabase.rpc('get_effective_subscription_entitlements', {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(`[checkSubscriptionLimit] get_effective_subscription_entitlements failed: ${error.message}`);
  }

  const entitlements = data || [];
  const requested = entitlements.find((row) => row.feature_key === limitType);
  if (!requested) {
    throw new Error(`[checkSubscriptionLimit] Missing entitlement for feature ${limitType}`);
  }

  return {
    entitlements,
    requested,
  };
}

/**
 * Checks if a tenant has exceeded their active subscription limits.
 * Returns { isBlocked: boolean; current: number; max: number; tier: string; isExpired?: boolean }
 */
export async function checkSubscriptionLimit(
  tenantId: string,
  limitType: 'ktv' | 'customer' | 'sms'
) {
  const supabase = await createClient();

  // 1. Fetch tenant subscription details
  interface TenantSubscriptionRow {
    subscription_tier: string | null;
    subscription_expires_at: string | null;
    sms_allotment_used: number | null;
    franchise_agreement_date: string | null;
  }

  const { data: tenant, error: tenantErr } = await (supabase
    .from('tenants')
    .select('subscription_tier, subscription_expires_at, sms_allotment_used, franchise_agreement_date')
    .eq('id', tenantId)
    .single() as unknown as Promise<{ data: TenantSubscriptionRow | null; error: { message: string } | null }>);

  if (tenantErr) {
    throw new Error(`[checkSubscriptionLimit] tenants query failed: ${tenantErr.message}`);
  }

  if (!tenant) {
    throw new Error(`[checkSubscriptionLimit] Tenant ${tenantId} not found`);
  }

  // Subscription limits (KTV/customer/SMS quotas) apply ONLY to franchise
  // branches. HQ-owned spas (spa trực thuộc) have no franchise agreement
  // → bypass entirely, treated as unlimited.
  const isFranchise = !!tenant.franchise_agreement_date;
  if (!isFranchise) {
    return { isBlocked: false, current: 0, max: UNLIMITED_QUOTA, tier: 'hq_owned', isExpired: false, limits: SUBSCRIPTION_TIERS.enterprise };
  }

  const tier = tenant.subscription_tier || 'free_trial';
  const expiresAt = tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at) : null;

  // Check expiration first
  if (expiresAt && expiresAt < new Date()) {
    console.warn(`[checkSubscriptionLimit] Tenant ${tenantId} subscription expired on ${expiresAt}`);
    const limits = SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free_trial;
    return { isBlocked: true, current: 0, max: 0, tier, isExpired: true, limits };
  }

  const { entitlements, requested } = await getEffectiveEntitlements(supabase, tenantId, limitType);
  const limits = buildEffectiveLimits(tier, entitlements);
  const maxLimit = entitlementLimitValue(requested);

  if (limitType === 'ktv') {
    // Count active KTVs
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', 'ktv');

    if (error) {
      throw new Error(`[checkSubscriptionLimit] users count failed: ${error.message}`);
    }
    const currentCount = count || 0;
    return {
      isBlocked: requested.is_unlimited ? false : currentCount >= maxLimit,
      current: currentCount,
      max: maxLimit,
      tier,
      isExpired: false,
      limits
    };
  } else if (limitType === 'customer') {
    // Count active customers
    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`[checkSubscriptionLimit] customers count failed: ${error.message}`);
    }
    const currentCount = count || 0;
    return {
      isBlocked: requested.is_unlimited ? false : currentCount >= maxLimit,
      current: currentCount,
      max: maxLimit,
      tier,
      isExpired: false,
      limits
    };
  } else {
    // Check SMS count
    const currentCount = tenant.sms_allotment_used || 0;
    return {
      isBlocked: requested.is_unlimited ? false : currentCount >= maxLimit,
      current: currentCount,
      max: maxLimit,
      tier,
      isExpired: false,
      limits
    };
  }
}

/**
 * Increment SMS usage allotment.
 * Direct RPC call to security definer database function.
 */
export async function incrementSmsCount(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('increment_tenant_sms', {
    p_tenant_id: tenantId
  });

  if (error) {
    throw new Error(`[incrementSmsCount] increment_tenant_sms failed: ${error.message}`);
  }

  if (data === null) {
    throw new Error('[incrementSmsCount] increment_tenant_sms returned null');
  }

  return data;
}
