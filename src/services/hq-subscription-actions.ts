'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from './audit-actions';
import { checkHqAuth } from './hq-actions';
import type { Database, Json } from '@/types/database.types';

type TenantRow = Database['public']['Tables']['tenants']['Row'];
type TenantUpdate = Database['public']['Tables']['tenants']['Update'];
type TenantSubscriptionOverrideRow =
  Database['public']['Tables']['tenant_subscription_overrides']['Row'];
type TenantSubscriptionOverrideInsert =
  Database['public']['Tables']['tenant_subscription_overrides']['Insert'];
type TenantSubscriptionOverrideUpdate =
  Database['public']['Tables']['tenant_subscription_overrides']['Update'];
type TenantUsageCounterRow =
  Database['public']['Tables']['tenant_usage_counters']['Row'];
type TenantUsageCounterInsert =
  Database['public']['Tables']['tenant_usage_counters']['Insert'];
type TenantUsageCounterUpdate =
  Database['public']['Tables']['tenant_usage_counters']['Update'];

type HqUser = {
  id: string;
  tenant_id: string | null;
};

export type UpdateTenantSubscriptionInput = {
  tenantId: string;
  planCode: string;
  subscriptionExpiresAt?: string | null;
};

export type SetTenantQuotaOverrideInput = {
  tenantId: string;
  featureKey: string;
  limitValue?: number | null;
  isUnlimited?: boolean;
  unit?: string;
  enforcementMode?: string;
  resetPeriod?: string;
  reason?: string | null;
  expiresAt?: string | null;
};

export type ResetTenantUsageCounterInput = {
  tenantId: string;
  featureKey: string;
  periodStart: string;
  periodEnd: string;
  reason?: string | null;
};

function getErrorMessage(error: unknown, fallback = 'Loi khong xac dinh') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

async function requireHqAuth(): Promise<HqUser> {
  const auth = await checkHqAuth();
  if (!auth.authorized || !('user' in auth) || !auth.user) {
    throw new Error(auth.error || 'Unauthorized: HQ Super Admin access required.');
  }

  return {
    id: auth.user.id,
    tenant_id: auth.user.tenant_id,
  };
}

function tenantSubscriptionAuditJson(
  tenant: Pick<TenantRow, 'id' | 'name' | 'subscription_tier' | 'subscription_expires_at' | 'updated_at'>
): Json {
  return {
    id: tenant.id,
    name: tenant.name,
    subscription_tier: tenant.subscription_tier,
    subscription_expires_at: tenant.subscription_expires_at,
    updated_at: tenant.updated_at,
  };
}

function quotaOverrideAuditJson(row: TenantSubscriptionOverrideRow): Json {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    feature_key: row.feature_key,
    limit_value: row.limit_value,
    is_unlimited: row.is_unlimited,
    unit: row.unit,
    enforcement_mode: row.enforcement_mode,
    reset_period: row.reset_period,
    reason: row.reason,
    starts_at: row.starts_at,
    expires_at: row.expires_at,
    is_active: row.is_active,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function usageCounterAuditJson(row: TenantUsageCounterRow): Json {
  return {
    tenant_id: row.tenant_id,
    feature_key: row.feature_key,
    period_start: row.period_start,
    period_end: row.period_end,
    used_value: row.used_value,
    metadata: row.metadata,
    last_increment_at: row.last_increment_at,
    updated_at: row.updated_at,
  };
}

function validateOverrideLimit(input: SetTenantQuotaOverrideInput) {
  const isUnlimited = input.isUnlimited ?? false;
  const limitValue = isUnlimited ? null : input.limitValue;

  if (!isUnlimited && (limitValue === null || limitValue === undefined || limitValue < 0)) {
    return 'Quota override can only be limited with a non-negative limitValue or marked unlimited.';
  }

  return null;
}

export async function getHqSubscriptionOverview() {
  await requireHqAuth();
  const supabase = await createClient();

  const { data: plans, error: plansError } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('sort_order', { ascending: true });

  if (plansError) {
    throw new Error(`[getHqSubscriptionOverview] subscription_plans query failed: ${plansError.message}`);
  }

  const { data: entitlements, error: entitlementsError } = await supabase
    .from('subscription_plan_entitlements')
    .select('*')
    .order('plan_code', { ascending: true })
    .order('feature_key', { ascending: true });

  if (entitlementsError) {
    throw new Error(
      `[getHqSubscriptionOverview] subscription_plan_entitlements query failed: ${entitlementsError.message}`
    );
  }

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id,name,status,subscription_tier,subscription_expires_at,sms_allotment_used,franchise_agreement_date,created_at,updated_at')
    .order('name', { ascending: true });

  if (tenantsError) {
    throw new Error(`[getHqSubscriptionOverview] tenants query failed: ${tenantsError.message}`);
  }

  const { data: overrides, error: overridesError } = await supabase
    .from('tenant_subscription_overrides')
    .select('*')
    .order('created_at', { ascending: false });

  if (overridesError) {
    throw new Error(
      `[getHqSubscriptionOverview] tenant_subscription_overrides query failed: ${overridesError.message}`
    );
  }

  const { data: usageCounters, error: usageCountersError } = await supabase
    .from('tenant_usage_counters')
    .select('*')
    .order('period_start', { ascending: false });

  if (usageCountersError) {
    throw new Error(
      `[getHqSubscriptionOverview] tenant_usage_counters query failed: ${usageCountersError.message}`
    );
  }

  return {
    plans: plans || [],
    entitlements: entitlements || [],
    tenants: tenants || [],
    overrides: overrides || [],
    usageCounters: usageCounters || [],
  };
}

export async function updateTenantSubscriptionPlan(input: UpdateTenantSubscriptionInput) {
  try {
    await requireHqAuth();
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Unauthorized') };
  }

  const tenantId = input.tenantId.trim();
  const planCode = input.planCode.trim();
  if (!tenantId || !planCode) {
    return { success: false, error: 'Missing tenantId or planCode for subscription update.' };
  }

  const supabase = await createClient();

  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('plan_code,is_active')
    .eq('plan_code', planCode)
    .eq('is_active', true)
    .maybeSingle();

  if (planError) {
    return { success: false, error: `Failed to validate subscription plan: ${planError.message}` };
  }

  if (!plan) {
    return { success: false, error: 'Subscription plan is not active or does not exist.' };
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id,name,subscription_tier,subscription_expires_at,updated_at')
    .eq('id', tenantId)
    .single();

  if (tenantError) {
    return { success: false, error: `Failed to fetch tenant before subscription update: ${tenantError.message}` };
  }

  if (!tenant) {
    return { success: false, error: 'Tenant not found for subscription update.' };
  }

  const nextExpiresAt =
    'subscriptionExpiresAt' in input ? input.subscriptionExpiresAt ?? null : tenant.subscription_expires_at;
  const updatePayload: TenantUpdate = {
    subscription_tier: plan.plan_code,
    subscription_expires_at: nextExpiresAt,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('tenants')
    .update(updatePayload)
    .eq('id', tenantId);

  if (updateError) {
    return { success: false, error: `Failed to update tenant subscription: ${updateError.message}` };
  }

  const newTenantSnapshot = {
    ...tenant,
    subscription_tier: plan.plan_code,
    subscription_expires_at: nextExpiresAt,
    updated_at: updatePayload.updated_at ?? tenant.updated_at,
  };

  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'tenants',
      record_id: tenantId,
      old_data: tenantSubscriptionAuditJson(tenant),
      new_data: tenantSubscriptionAuditJson(newTenantSnapshot),
    });
  } catch (auditError) {
    const rollbackPayload: TenantUpdate = {
      subscription_tier: tenant.subscription_tier,
      subscription_expires_at: tenant.subscription_expires_at,
      updated_at: tenant.updated_at,
    };
    const { error: rollbackError } = await supabase
      .from('tenants')
      .update(rollbackPayload)
      .eq('id', tenantId);

    if (rollbackError) {
      return {
        success: false,
        error: `Audit log failed after tenant subscription update: ${getErrorMessage(auditError)}. Rollback failed: ${rollbackError.message}`,
      };
    }

    return {
      success: false,
      error: `Audit log failed after tenant subscription update: ${getErrorMessage(auditError)}`,
    };
  }

  await safeRevalidatePath('/hq');
  await safeRevalidatePath('/dashboard/settings');

  return { success: true };
}

export async function setTenantQuotaOverride(input: SetTenantQuotaOverrideInput) {
  let user: HqUser;
  try {
    user = await requireHqAuth();
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Unauthorized') };
  }

  const tenantId = input.tenantId.trim();
  const featureKey = input.featureKey.trim();
  if (!tenantId || !featureKey) {
    return { success: false, error: 'Missing tenantId or featureKey for quota override.' };
  }

  const limitValidation = validateOverrideLimit(input);
  if (limitValidation) {
    return { success: false, error: limitValidation };
  }

  const supabase = await createClient();
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .single();

  if (tenantError) {
    return { success: false, error: `Failed to validate tenant for quota override: ${tenantError.message}` };
  }

  if (!tenant) {
    return { success: false, error: 'Tenant not found for quota override.' };
  }

  const { data: existing, error: existingError } = await supabase
    .from('tenant_subscription_overrides')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('feature_key', featureKey)
    .eq('is_active', true)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: `Failed to fetch active quota override: ${existingError.message}` };
  }

  const now = new Date().toISOString();
  const isUnlimited = input.isUnlimited ?? false;
  const limitValue = isUnlimited ? null : input.limitValue ?? null;

  if (existing) {
    const updatePayload: TenantSubscriptionOverrideUpdate = {
      limit_value: limitValue,
      is_unlimited: isUnlimited,
      unit: input.unit ?? existing.unit,
      enforcement_mode: input.enforcementMode ?? existing.enforcement_mode,
      reset_period: input.resetPeriod ?? existing.reset_period,
      reason: input.reason ?? null,
      expires_at: input.expiresAt ?? null,
      updated_by: user.id,
      updated_at: now,
    };

    const { data: updated, error: updateError } = await supabase
      .from('tenant_subscription_overrides')
      .update(updatePayload)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (updateError) {
      return { success: false, error: `Failed to update quota override: ${updateError.message}` };
    }

    try {
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'tenant_subscription_overrides',
        record_id: existing.id,
        old_data: quotaOverrideAuditJson(existing),
        new_data: quotaOverrideAuditJson(updated),
      });
    } catch (auditError) {
      const rollbackPayload: TenantSubscriptionOverrideUpdate = {
        limit_value: existing.limit_value,
        is_unlimited: existing.is_unlimited,
        unit: existing.unit,
        enforcement_mode: existing.enforcement_mode,
        reset_period: existing.reset_period,
        reason: existing.reason,
        expires_at: existing.expires_at,
        is_active: existing.is_active,
        updated_by: existing.updated_by,
        updated_at: existing.updated_at,
      };
      const { error: rollbackError } = await supabase
        .from('tenant_subscription_overrides')
        .update(rollbackPayload)
        .eq('id', existing.id);

      if (rollbackError) {
        return {
          success: false,
          error: `Audit log failed after quota override update: ${getErrorMessage(auditError)}. Rollback failed: ${rollbackError.message}`,
        };
      }

      return {
        success: false,
        error: `Audit log failed after quota override update: ${getErrorMessage(auditError)}`,
      };
    }

    await safeRevalidatePath('/hq');
    await safeRevalidatePath('/dashboard/settings');
    return { success: true, override: updated };
  }

  const insertPayload: TenantSubscriptionOverrideInsert = {
    tenant_id: tenantId,
    feature_key: featureKey,
    limit_value: limitValue,
    is_unlimited: isUnlimited,
    unit: input.unit ?? 'count',
    enforcement_mode: input.enforcementMode ?? 'hard',
    reset_period: input.resetPeriod ?? 'none',
    reason: input.reason ?? null,
    expires_at: input.expiresAt ?? null,
    is_active: true,
    created_by: user.id,
    updated_by: user.id,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('tenant_subscription_overrides')
    .insert(insertPayload)
    .select('*')
    .single();

  if (insertError) {
    return { success: false, error: `Failed to create quota override: ${insertError.message}` };
  }

  try {
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'tenant_subscription_overrides',
      record_id: inserted.id,
      new_data: quotaOverrideAuditJson(inserted),
    });
  } catch (auditError) {
    const { error: rollbackError } = await supabase
      .from('tenant_subscription_overrides')
      .delete()
      .eq('id', inserted.id);

    if (rollbackError) {
      return {
        success: false,
        error: `Audit log failed after quota override insert: ${getErrorMessage(auditError)}. Rollback failed: ${rollbackError.message}`,
      };
    }

    return {
      success: false,
      error: `Audit log failed after quota override insert: ${getErrorMessage(auditError)}`,
    };
  }

  await safeRevalidatePath('/hq');
  await safeRevalidatePath('/dashboard/settings');

  return { success: true, override: inserted };
}

export async function resetTenantUsageCounter(input: ResetTenantUsageCounterInput) {
  let user: HqUser;
  try {
    user = await requireHqAuth();
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Unauthorized') };
  }

  const tenantId = input.tenantId.trim();
  const featureKey = input.featureKey.trim();
  const periodStart = input.periodStart.trim();
  const periodEnd = input.periodEnd.trim();
  if (!tenantId || !featureKey || !periodStart || !periodEnd) {
    return { success: false, error: 'Missing tenantId, featureKey, periodStart or periodEnd for usage reset.' };
  }

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from('tenant_usage_counters')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('feature_key', featureKey)
    .eq('period_start', periodStart)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: `Failed to fetch usage counter before reset: ${existingError.message}` };
  }

  const now = new Date().toISOString();
  const resetMetadata: Json = {
    reset_by: user.id,
    reset_reason: input.reason ?? null,
    reset_at: now,
  };

  if (existing) {
    const updatePayload: TenantUsageCounterUpdate = {
      period_end: periodEnd,
      used_value: 0,
      metadata: resetMetadata,
      last_increment_at: null,
      updated_at: now,
    };

    const { data: updated, error: updateError } = await supabase
      .from('tenant_usage_counters')
      .update(updatePayload)
      .eq('tenant_id', tenantId)
      .eq('feature_key', featureKey)
      .eq('period_start', periodStart)
      .select('*')
      .single();

    if (updateError) {
      return { success: false, error: `Failed to reset usage counter: ${updateError.message}` };
    }

    try {
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'tenant_usage_counters',
        record_id: `${tenantId}:${featureKey}:${periodStart}`,
        old_data: usageCounterAuditJson(existing),
        new_data: usageCounterAuditJson(updated),
      });
    } catch (auditError) {
      const rollbackPayload: TenantUsageCounterUpdate = {
        period_end: existing.period_end,
        used_value: existing.used_value,
        metadata: existing.metadata,
        last_increment_at: existing.last_increment_at,
        updated_at: existing.updated_at,
      };
      const { error: rollbackError } = await supabase
        .from('tenant_usage_counters')
        .update(rollbackPayload)
        .eq('tenant_id', tenantId)
        .eq('feature_key', featureKey)
        .eq('period_start', periodStart);

      if (rollbackError) {
        return {
          success: false,
          error: `Audit log failed after usage counter reset: ${getErrorMessage(auditError)}. Rollback failed: ${rollbackError.message}`,
        };
      }

      return {
        success: false,
        error: `Audit log failed after usage counter reset: ${getErrorMessage(auditError)}`,
      };
    }

    await safeRevalidatePath('/hq');
    await safeRevalidatePath('/dashboard/settings');
    return { success: true, usageCounter: updated };
  }

  const insertPayload: TenantUsageCounterInsert = {
    tenant_id: tenantId,
    feature_key: featureKey,
    period_start: periodStart,
    period_end: periodEnd,
    used_value: 0,
    metadata: resetMetadata,
    last_increment_at: null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('tenant_usage_counters')
    .insert(insertPayload)
    .select('*')
    .single();

  if (insertError) {
    return { success: false, error: `Failed to create reset usage counter: ${insertError.message}` };
  }

  try {
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'tenant_usage_counters',
      record_id: `${tenantId}:${featureKey}:${periodStart}`,
      new_data: usageCounterAuditJson(inserted),
    });
  } catch (auditError) {
    const { error: rollbackError } = await supabase
      .from('tenant_usage_counters')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('feature_key', featureKey)
      .eq('period_start', periodStart);

    if (rollbackError) {
      return {
        success: false,
        error: `Audit log failed after usage counter insert: ${getErrorMessage(auditError)}. Rollback failed: ${rollbackError.message}`,
      };
    }

    return {
      success: false,
      error: `Audit log failed after usage counter insert: ${getErrorMessage(auditError)}`,
    };
  }

  await safeRevalidatePath('/hq');
  await safeRevalidatePath('/dashboard/settings');

  return { success: true, usageCounter: inserted };
}
