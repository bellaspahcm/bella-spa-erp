import { readFileSync } from 'fs';
import { join } from 'path';

const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260601011000_create_subscription_quota_schema.sql'),
  'utf8'
);

const smsUsageCounterMigrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260602010000_use_usage_counters_for_sms.sql'),
  'utf8'
);

describe('subscription quota schema migration', () => {
  it('creates the Super Admin plan/quota foundation tables', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.subscription_plans');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.subscription_plan_entitlements');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.tenant_subscription_overrides');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.tenant_usage_counters');
  });

  it('enables RLS and uses HQ/tenant-scoped policies for tenant-specific quota data', () => {
    expect(migrationSql).toContain('ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('ALTER TABLE public.tenant_subscription_overrides ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('ALTER TABLE public.tenant_usage_counters ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('public.is_hq_super_admin()');
    expect(migrationSql).toContain('tenant_id = public.get_auth_tenant_id()');
  });

  it('seeds current subscription tiers and matching limits', () => {
    expect(migrationSql).toContain("('free_trial', 'Dùng thử'");
    expect(migrationSql).toContain("('basic', 'Cơ bản'");
    expect(migrationSql).toContain("('pro', 'Chuyên nghiệp'");
    expect(migrationSql).toContain("('enterprise', 'Nhượng quyền'");
    expect(migrationSql).toContain("('basic', 'ktv', 3");
    expect(migrationSql).toContain("('pro', 'customer', 500");
    expect(migrationSql).toContain("('enterprise', 'sms', 2000");
  });

  it('defines a guarded effective entitlement RPC for future service-layer use', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_effective_subscription_entitlements');
    expect(migrationSql).toContain('Unauthorized: cannot view subscription entitlements for another tenant');
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.get_effective_subscription_entitlements(UUID) FROM PUBLIC');
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.get_effective_subscription_entitlements(UUID) TO authenticated, service_role');
  });

  it('moves SMS metering into tenant usage counters with guarded RPCs', () => {
    expect(smsUsageCounterMigrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_tenant_sms_usage');
    expect(smsUsageCounterMigrationSql).toContain('CREATE OR REPLACE FUNCTION public.increment_tenant_sms');
    expect(smsUsageCounterMigrationSql).toContain('public.tenant_usage_counters');
    expect(smsUsageCounterMigrationSql).toContain("feature_key = 'sms'");
    expect(smsUsageCounterMigrationSql).toContain("ON CONFLICT (tenant_id, feature_key, period_start)");
    expect(smsUsageCounterMigrationSql).toContain('Unauthorized: cannot view SMS usage for another tenant');
    expect(smsUsageCounterMigrationSql).toContain('Unauthorized: cannot increment SMS usage for another tenant');
    expect(smsUsageCounterMigrationSql).toContain('GRANT EXECUTE ON FUNCTION public.get_tenant_sms_usage(UUID) TO authenticated, service_role');
  });

  it('keeps renewal SMS resets aligned with the usage counter source of truth', () => {
    expect(smsUsageCounterMigrationSql).toContain('CREATE OR REPLACE FUNCTION public.renew_tenant_subscription');
    expect(smsUsageCounterMigrationSql).toContain("jsonb_build_object('source', 'renew_tenant_subscription'");
    expect(smsUsageCounterMigrationSql).toContain('used_value = 0');
    expect(smsUsageCounterMigrationSql).toContain('sms_allotment_used = 0');
    expect(smsUsageCounterMigrationSql).toContain('GRANT EXECUTE ON FUNCTION public.renew_tenant_subscription(TEXT, TEXT) TO authenticated, service_role');
  });
});
