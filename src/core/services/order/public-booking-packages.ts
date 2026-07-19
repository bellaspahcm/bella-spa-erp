'use server';

import { createClient } from '@/lib/supabase-server';
import { resolvePublicBabycareTenantId } from './public-booking-tenant';
import type { Database } from '@/types/database.types';

type TenantRow = Pick<
  Database['public']['Tables']['tenants']['Row'],
  | 'id'
  | 'name'
  | 'status'
  | 'enabled_modules'
  | 'contact_phone'
>;

type PackageRow = Pick<
  Database['public']['Tables']['packages']['Row'],
  | 'id'
  | 'name'
  | 'description'
  | 'price'
  | 'full_price'
  | 'total_sessions'
  | 'service_category'
  | 'module_key'
  | 'status'
  | 'tenant_id'
>;

export type PublicBookingPackage = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  total_sessions: number | null;
  category: string | null;
};

export async function getPublicBabycareBookingPackages(): Promise<{
  packages: PublicBookingPackage[];
  tenantPhone: string | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const tenantResult = await resolvePublicBabycareTenantId(supabase);

  if (tenantResult.tenantId === null) {
    return { packages: [], tenantPhone: null, error: tenantResult.error };
  }

  const { tenantId } = tenantResult;

  // Fetch tenant phone alongside packages
  const [packagesResult, tenantResult2] = await Promise.all([
    supabase
      .from('packages')
      .select('id, name, description, price, full_price, total_sessions, service_category, module_key, status, tenant_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .or('module_key.is.null,module_key.eq.babycare')
      .order('name', { ascending: true }),
    supabase
      .from('tenants')
      .select('contact_phone')
      .eq('id', tenantId)
      .single<Pick<TenantRow, 'contact_phone'>>(),
  ]);

  const { data, error } = packagesResult;
  const tenantPhone = tenantResult2.data?.contact_phone ?? null;

  if (error) {
    return {
      packages: [],
      tenantPhone,
      error: `Khong the tai danh sach goi dat lich: ${error.message}`,
    };
  }

  const packages = ((data || []) as PackageRow[])
    .filter((pkg) => pkg.tenant_id === tenantId && (pkg.module_key === null || pkg.module_key === 'babycare'))
    .map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      price: pkg.price ?? pkg.full_price ?? null,
      total_sessions: pkg.total_sessions,
      category: pkg.service_category,
    }));

  return { packages, tenantPhone, error: null };
}
