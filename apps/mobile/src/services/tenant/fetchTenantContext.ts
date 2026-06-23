/**
 * Tenant context service for mobile app
 * Fetches tenant info: name, module key, logo, status
 */

import type { TenantModuleKey } from '@bella/shared';
import { getDefaultTenantModuleKey } from '@bella/shared';
import { getMobileSupabase } from '../../lib/supabase';

export interface TenantContext {
  id: string;
  name: string;
  moduleKey: TenantModuleKey;
  logoUrl: string | null;
  status: string | null;
}

export type TenantContextResult =
  | { ok: true; tenant: TenantContext }
  | { ok: false; error: string };

/**
 * Fetch tenant context from database
 * 
 * Returns:
 * - Tenant name for display
 * - Module key to determine branding/theme (babycare vs beauty_spa)
 * - Logo URL
 * - Status (for suspended check)
 */
export async function fetchTenantContext(
  tenantId: string,
): Promise<TenantContextResult> {
  const supabase = getMobileSupabase();

  // Only select fields needed - avoid over-fetching
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, enabled_modules, logo_url, status')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? 'Không tìm thấy thông tin chi nhánh.',
    };
  }

  return {
    ok: true,
    tenant: {
      id: data.id,
      name: data.name ?? '',
      moduleKey: getDefaultTenantModuleKey(data.enabled_modules),
      logoUrl: data.logo_url ?? null,
      status: data.status ?? null,
    },
  };
}
