'use server';

import { normalizeEnabledModules } from '@/lib/business-rules/tenant-modules';
import type { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type TenantRow = Pick<
  Database['public']['Tables']['tenants']['Row'],
  'id' | 'name' | 'status' | 'enabled_modules'
>;

type PublicBabycareTenantResult =
  | { tenantId: string; error: null }
  | { tenantId: null; error: string };

const DEFAULT_PUBLIC_BABYCARE_TENANT_NAME = 'Bella Spa Headquarter';

export async function resolvePublicBabycareTenantId(
  supabase: SupabaseServerClient,
): Promise<PublicBabycareTenantResult> {
  const configuredTenantId = process.env.DEFAULT_TENANT_ID?.trim();
  const query = supabase
    .from('tenants')
    .select('id, name, status, enabled_modules');

  const { data: tenant, error } = configuredTenantId
    ? await query.eq('id', configuredTenantId).single<TenantRow>()
    : await query.eq('name', DEFAULT_PUBLIC_BABYCARE_TENANT_NAME).single<TenantRow>();

  if (error || !tenant) {
    return {
      tenantId: null,
      error: configuredTenantId
        ? `Khong the tai cau hinh tenant dat lich mac dinh: ${error?.message || configuredTenantId}`
        : `Khong tim thay tenant dat lich mac dinh ${DEFAULT_PUBLIC_BABYCARE_TENANT_NAME}.`,
    };
  }

  if (tenant.status && tenant.status !== 'active') {
    return {
      tenantId: null,
      error: 'Chi nhanh dat lich mac dinh dang tam khoa. Vui long lien he hotline.',
    };
  }

  const enabledModules = normalizeEnabledModules(tenant.enabled_modules);
  if (!enabledModules.babycare) {
    return {
      tenantId: null,
      error: 'Tenant dat lich cong khai khong duoc cap module Me & Be.',
    };
  }

  return { tenantId: tenant.id, error: null };
}
