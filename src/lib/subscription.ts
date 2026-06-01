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
type SubscriptionPlanDisplay = Pick<
  Database['public']['Tables']['subscription_plans']['Row'],
  'plan_code' | 'display_name'
>;

const UNLIMITED_QUOTA = 999999;

function entitlementLimitValue(entitlement: EffectiveEntitlement) {
  if (entitlement.is_unlimited) return UNLIMITED_QUOTA;
  return Number(entitlement.limit_value ?? 0);
}

function buildQuotaSnapshot(
  tierName: string,
  maxKtv: number,
  maxCustomers: number,
  maxSms: number
): SubscriptionLimit {
  return {
    maxKtv,
    maxCustomers,
    maxSms,
    tierName,
  };
}

function buildEffectiveLimits(tierName: string, entitlements: EffectiveEntitlement[]): SubscriptionLimit {
  const byFeature = new Map(entitlements.map((row) => [row.feature_key, row]));
  const ktv = byFeature.get('ktv');
  const customer = byFeature.get('customer');
  const sms = byFeature.get('sms');

  return buildQuotaSnapshot(
    tierName,
    ktv ? entitlementLimitValue(ktv) : 0,
    customer ? entitlementLimitValue(customer) : 0,
    sms ? entitlementLimitValue(sms) : 0
  );
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

async function getSubscriptionPlanDisplayName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tier: string
) {
  const { data, error } = await (supabase
    .from('subscription_plans')
    .select('plan_code, display_name')
    .eq('plan_code', tier)
    .maybeSingle() as unknown as Promise<{ data: SubscriptionPlanDisplay | null; error: { message: string } | null }>);

  if (error) {
    throw new Error(`[checkSubscriptionLimit] subscription_plans query failed: ${error.message}`);
  }

  return data?.display_name || tier;
}

async function getCurrentSmsUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string
) {
  const { data, error } = await supabase.rpc('get_tenant_sms_usage', {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(`[checkSubscriptionLimit] get_tenant_sms_usage failed: ${error.message}`);
  }

  if (data === null) {
    throw new Error('[checkSubscriptionLimit] get_tenant_sms_usage returned null');
  }

  return Number(data);
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

  interface TenantSubscriptionRow {
    subscription_tier: string | null;
    subscription_expires_at: string | null;
    franchise_agreement_date: string | null;
  }

  const { data: tenant, error: tenantErr } = await (supabase
    .from('tenants')
    .select('subscription_tier, subscription_expires_at, franchise_agreement_date')
    .eq('id', tenantId)
    .single() as unknown as Promise<{ data: TenantSubscriptionRow | null; error: { message: string } | null }>);

  if (tenantErr) {
    throw new Error(`[checkSubscriptionLimit] tenants query failed: ${tenantErr.message}`);
  }

  if (!tenant) {
    throw new Error(`[checkSubscriptionLimit] Tenant ${tenantId} not found`);
  }

  const isFranchise = !!tenant.franchise_agreement_date;
  if (!isFranchise) {
    return {
      isBlocked: false,
      current: 0,
      max: UNLIMITED_QUOTA,
      tier: 'hq_owned',
      isExpired: false,
      limits: buildQuotaSnapshot('Spa truc thuoc', UNLIMITED_QUOTA, UNLIMITED_QUOTA, UNLIMITED_QUOTA),
    };
  }

  const tier = tenant.subscription_tier || 'free_trial';
  const expiresAt = tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at) : null;
  const tierName = await getSubscriptionPlanDisplayName(supabase, tier);

  if (expiresAt && expiresAt < new Date()) {
    console.warn(`[checkSubscriptionLimit] Tenant ${tenantId} subscription expired on ${expiresAt}`);
    const limits = buildQuotaSnapshot(tierName, 0, 0, 0);
    return { isBlocked: true, current: 0, max: 0, tier, isExpired: true, limits };
  }

  const { entitlements, requested } = await getEffectiveEntitlements(supabase, tenantId, limitType);
  const limits = buildEffectiveLimits(tierName, entitlements);
  const maxLimit = entitlementLimitValue(requested);

  if (limitType === 'ktv') {
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
      limits,
    };
  }

  if (limitType === 'customer') {
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
      limits,
    };
  }

  const currentCount = await getCurrentSmsUsage(supabase, tenantId);
  return {
    isBlocked: requested.is_unlimited ? false : currentCount >= maxLimit,
    current: currentCount,
    max: maxLimit,
    tier,
    isExpired: false,
    limits,
  };
}

/**
 * Increment SMS usage allotment.
 * Direct RPC call to security definer database function.
 */
export async function incrementSmsCount(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('increment_tenant_sms', {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(`[incrementSmsCount] increment_tenant_sms failed: ${error.message}`);
  }

  if (data === null) {
    throw new Error('[incrementSmsCount] increment_tenant_sms returned null');
  }

  return data;
}
