import type { Json } from '@/types/database.types';

export const TENANT_MODULE_KEYS = ['babycare', 'beauty_spa'] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];

export type TenantEnabledModules = Record<TenantModuleKey, boolean>;

export type TenantBrandTheme = {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  portalDisplayName: string;
  invoiceDisplayName: string;
};

export const DEFAULT_ENABLED_MODULES: TenantEnabledModules = {
  babycare: true,
  beauty_spa: false,
};

export const DEFAULT_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#A91555',
  accentColor: '#F8A5C2',
  portalDisplayName: '',
  invoiceDisplayName: '',
};

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const TEXT_LIMITS: Record<keyof TenantBrandTheme, number> = {
  brandName: 80,
  logoUrl: 500,
  primaryColor: 7,
  accentColor: 7,
  portalDisplayName: 100,
  invoiceDisplayName: 100,
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function cleanColor(value: unknown, fallback: string) {
  const text = cleanText(value, 7);
  return HEX_COLOR_PATTERN.test(text) ? text.toUpperCase() : fallback;
}

export function normalizeEnabledModules(value: unknown): TenantEnabledModules {
  const source = isPlainRecord(value) ? value : {};

  return {
    babycare: typeof source.babycare === 'boolean'
      ? source.babycare
      : DEFAULT_ENABLED_MODULES.babycare,
    beauty_spa: typeof source.beauty_spa === 'boolean'
      ? source.beauty_spa
      : DEFAULT_ENABLED_MODULES.beauty_spa,
  };
}

export function normalizeEnabledModulesForSave(value: unknown): TenantEnabledModules {
  const modules = normalizeEnabledModules(value);
  if (modules.babycare || modules.beauty_spa) return modules;
  return DEFAULT_ENABLED_MODULES;
}

export function getDefaultTenantModuleKey(value: unknown): TenantModuleKey {
  const modules = normalizeEnabledModulesForSave(value);
  return modules.babycare ? 'babycare' : 'beauty_spa';
}

export function normalizeTenantBrandTheme(value: unknown): TenantBrandTheme {
  const source = isPlainRecord(value) ? value : {};

  return {
    brandName: cleanText(source.brandName, TEXT_LIMITS.brandName),
    logoUrl: cleanText(source.logoUrl, TEXT_LIMITS.logoUrl),
    primaryColor: cleanColor(source.primaryColor, DEFAULT_TENANT_BRAND_THEME.primaryColor),
    accentColor: cleanColor(source.accentColor, DEFAULT_TENANT_BRAND_THEME.accentColor),
    portalDisplayName: cleanText(source.portalDisplayName, TEXT_LIMITS.portalDisplayName),
    invoiceDisplayName: cleanText(source.invoiceDisplayName, TEXT_LIMITS.invoiceDisplayName),
  };
}

export function isTenantModuleEnabled(
  modules: unknown,
  moduleKey: TenantModuleKey,
) {
  return normalizeEnabledModules(modules)[moduleKey];
}

export function toTenantModuleJson(value: unknown): Json {
  return normalizeEnabledModulesForSave(value) as unknown as Json;
}

export function toTenantBrandThemeJson(value: unknown): Json {
  return normalizeTenantBrandTheme(value) as unknown as Json;
}
