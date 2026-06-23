/**
 * Tenant module type definitions
 * Source: src/lib/business-rules/tenant-modules.ts (minimal subset for mobile)
 */

export const TENANT_MODULE_KEYS = ['babycare', 'beauty_spa', 'student_training'] as const;
export const TENANT_PRIMARY_BUSINESS_MODULE_KEYS = ['babycare', 'beauty_spa'] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];
export type TenantPrimaryBusinessModuleKey = (typeof TENANT_PRIMARY_BUSINESS_MODULE_KEYS)[number];

export type TenantEnabledModules = Record<TenantModuleKey, boolean>;

export const DEFAULT_ENABLED_MODULES: TenantEnabledModules = {
  babycare: true,
  beauty_spa: false,
  student_training: false,
};
