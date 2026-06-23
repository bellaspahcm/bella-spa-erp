/**
 * Tenant module resolution logic
 * Source: src/lib/business-rules/tenant-modules.ts (minimal subset for mobile)
 */

import {
  DEFAULT_ENABLED_MODULES,
  TENANT_MODULE_KEYS,
  type TenantEnabledModules,
  type TenantModuleKey,
  type TenantPrimaryBusinessModuleKey,
} from './module-keys';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Normalize enabled modules from database
 * Handles: JSON object, null, undefined, empty object
 */
export function normalizeEnabledModules(value: unknown): TenantEnabledModules {
  const source = isPlainRecord(value) ? value : {};
  const hasExplicitModuleConfig = TENANT_MODULE_KEYS.some(
    (moduleKey) => typeof source[moduleKey] === 'boolean'
  );

  if (!hasExplicitModuleConfig) {
    return DEFAULT_ENABLED_MODULES;
  }

  return {
    babycare: typeof source.babycare === 'boolean' ? source.babycare : false,
    beauty_spa: typeof source.beauty_spa === 'boolean' ? source.beauty_spa : false,
    student_training: typeof source.student_training === 'boolean' ? source.student_training : false,
  };
}

/**
 * Normalize enabled modules for save — ensure at least one primary module is enabled
 */
export function normalizeEnabledModulesForSave(value: unknown): TenantEnabledModules {
  const modules = normalizeEnabledModules(value);
  if (modules.babycare || modules.beauty_spa) return modules;
  return {
    ...modules,
    babycare: true,
  };
}

/**
 * Get default module key from enabled modules
 * Priority: babycare > beauty_spa
 * Used in mobile to determine which branding/theme to show
 */
export function getDefaultTenantModuleKey(value: unknown): TenantPrimaryBusinessModuleKey {
  const modules = normalizeEnabledModulesForSave(value);
  return modules.babycare ? 'babycare' : 'beauty_spa';
}

/**
 * Check if a specific module is enabled
 */
export function isTenantModuleEnabled(modules: unknown, moduleKey: TenantModuleKey): boolean {
  return normalizeEnabledModules(modules)[moduleKey as keyof TenantEnabledModules];
}
