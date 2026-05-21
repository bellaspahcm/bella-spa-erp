import { createClient } from '@/lib/supabase-server';

export interface SubscriptionLimit {
  maxKtv: number;
  maxCustomers: number;
  maxSms: number;
  tierName: string;
}

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
  }

  const { data: tenant, error: tenantErr } = await (supabase
    .from('tenants')
    .select('subscription_tier, subscription_expires_at, sms_allotment_used')
    .eq('id', tenantId)
    .single() as unknown as Promise<{ data: TenantSubscriptionRow | null; error: any }>);

  if (tenantErr || !tenant) {
    console.error('[checkSubscriptionLimit] Error fetching tenant subscription:', tenantErr);
    return { isBlocked: false, current: 0, max: 999999, tier: 'free_trial', isExpired: false, limits: SUBSCRIPTION_TIERS.free_trial };
  }

  const tier = tenant.subscription_tier || 'free_trial';
  const expiresAt = tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at) : null;
  const limits = SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free_trial;

  // Check expiration first
  if (expiresAt && expiresAt < new Date()) {
    console.warn(`[checkSubscriptionLimit] Tenant ${tenantId} subscription expired on ${expiresAt}`);
    return { isBlocked: true, current: 0, max: 0, tier, isExpired: true, limits };
  }

  if (limitType === 'ktv') {
    // Count active KTVs
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', 'ktv');

    if (error) console.error('Error counting KTVs:', error);
    const currentCount = count || 0;
    return {
      isBlocked: currentCount >= limits.maxKtv,
      current: currentCount,
      max: limits.maxKtv,
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

    if (error) console.error('Error counting customers:', error);
    const currentCount = count || 0;
    return {
      isBlocked: currentCount >= limits.maxCustomers,
      current: currentCount,
      max: limits.maxCustomers,
      tier,
      isExpired: false,
      limits
    };
  } else {
    // Check SMS count
    const currentCount = tenant.sms_allotment_used || 0;
    return {
      isBlocked: currentCount >= limits.maxSms,
      current: currentCount,
      max: limits.maxSms,
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
  type IncrementSmsRpc = (
    fn: 'increment_tenant_sms',
    args: { p_tenant_id: string }
  ) => Promise<{ data: number | null; error: { message: string } | null }>;

  const { data, error } = await (supabase.rpc as unknown as IncrementSmsRpc)('increment_tenant_sms', {
    p_tenant_id: tenantId
  });

  if (error) {
    console.error('[incrementSmsCount] Failed to increment SMS:', error);
    return 0;
  }
  return data || 0;
}
