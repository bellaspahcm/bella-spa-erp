export type HqTenantIdentity = {
  product_key?: string | null;
};

export const HQ_PRODUCT_KEY = 'bella_hq';

export function isHqTenant(tenant: HqTenantIdentity | null | undefined): boolean {
  return tenant?.product_key === HQ_PRODUCT_KEY;
}

export function isOperatingTenant(tenant: HqTenantIdentity | null | undefined): boolean {
  return !isHqTenant(tenant);
}
