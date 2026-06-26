import type { Json } from '@/types/database.types';

export const TENANT_MODULE_KEYS = ['babycare', 'beauty_spa', 'student_training', 'industrial_cleaning'] as const;
export const TENANT_PRIMARY_BUSINESS_MODULE_KEYS = ['babycare', 'beauty_spa', 'industrial_cleaning'] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];
export type TenantPrimaryBusinessModuleKey = (typeof TENANT_PRIMARY_BUSINESS_MODULE_KEYS)[number];

export type TenantEnabledModules = Record<TenantModuleKey, boolean>;

export const TENANT_BRAND_STYLE_PRESETS = ['bella_rose', 'jade_wellness', 'graphite_luxe'] as const;
export const TENANT_BRAND_RADIUS_STYLES = ['soft', 'balanced', 'compact'] as const;
export const TENANT_BRAND_BUTTON_STYLES = ['pill', 'rounded', 'minimal'] as const;
export const TENANT_BRAND_MENU_STYLES = ['comfortable', 'compact'] as const;

export type TenantBrandStylePreset = (typeof TENANT_BRAND_STYLE_PRESETS)[number];
export type TenantBrandRadiusStyle = (typeof TENANT_BRAND_RADIUS_STYLES)[number];
export type TenantBrandButtonStyle = (typeof TENANT_BRAND_BUTTON_STYLES)[number];
export type TenantBrandMenuStyle = (typeof TENANT_BRAND_MENU_STYLES)[number];

export type TenantBrandTheme = {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  portalDisplayName: string;
  invoiceDisplayName: string;
  stylePreset: TenantBrandStylePreset;
  radiusStyle: TenantBrandRadiusStyle;
  buttonStyle: TenantBrandButtonStyle;
  menuStyle: TenantBrandMenuStyle;
};

export type TenantBrandSurface = 'app' | 'portal' | 'invoice';

export type ResolvedTenantBrandIdentity = TenantBrandTheme & {
  moduleKey: TenantModuleKey;
  displayName: string;
  subtitle: string;
  logoUrl: string;
  primaryHoverColor: string;
  monogram: string;
  isBeautySpa: boolean;
};

export const DEFAULT_ENABLED_MODULES: TenantEnabledModules = {
  babycare: true,
  beauty_spa: false,
  student_training: false,
  industrial_cleaning: false,
};

export const DEFAULT_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#A91555',
  accentColor: '#F8A5C2',
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'bella_rose',
  radiusStyle: 'soft',
  buttonStyle: 'pill',
  menuStyle: 'comfortable',
};

export const DEFAULT_BEAUTY_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#074E44',
  accentColor: '#C8A97A',
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'jade_wellness',
  radiusStyle: 'soft',
  buttonStyle: 'pill',
  menuStyle: 'comfortable',
};

export const DEFAULT_CLEANING_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#1E40AF', // Blue 700 - professional blue
  accentColor: '#3B82F6', // Blue 500 - bright blue accent
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'graphite_luxe',
  radiusStyle: 'balanced',
  buttonStyle: 'rounded',
  menuStyle: 'compact',
};

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const TEXT_LIMITS: Record<keyof TenantBrandTheme, number> = {
  brandName: 80,
  logoUrl: 500,
  primaryColor: 7,
  accentColor: 7,
  portalDisplayName: 100,
  invoiceDisplayName: 100,
  stylePreset: 40,
  radiusStyle: 40,
  buttonStyle: 40,
  menuStyle: 40,
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

function cleanChoice<T extends readonly string[]>(value: unknown, choices: T, fallback: T[number]): T[number] {
  const text = cleanText(value, 40);
  return choices.includes(text) ? text : fallback;
}

function cleanLogoUrl(value: unknown) {
  const text = cleanText(value, TEXT_LIMITS.logoUrl);
  if (!text) return '';
  if (text.startsWith('/')) return text;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? text : '';
  } catch {
    return '';
  }
}

function darkenHexColor(hex: string) {
  const normalized = cleanColor(hex, DEFAULT_TENANT_BRAND_THEME.primaryColor);
  const value = normalized.slice(1);
  const amount = 0.84;
  const r = Math.max(0, Math.round(parseInt(value.slice(0, 2), 16) * amount));
  const g = Math.max(0, Math.round(parseInt(value.slice(2, 4), 16) * amount));
  const b = Math.max(0, Math.round(parseInt(value.slice(4, 6), 16) * amount));
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function buildMonogram(displayName: string) {
  const words = displayName
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const letters = words.length > 1
    ? `${words[0][0] || ''}${words[1][0] || ''}`
    : (words[0] || 'SP').slice(0, 2);
  return letters.toUpperCase();
}

export function normalizeEnabledModules(value: unknown): TenantEnabledModules {
  const source = isPlainRecord(value) ? value : {};
  const hasExplicitModuleConfig = TENANT_MODULE_KEYS.some((moduleKey) => typeof source[moduleKey] === 'boolean');

  if (!hasExplicitModuleConfig) {
    return DEFAULT_ENABLED_MODULES;
  }

  return {
    babycare: typeof source.babycare === 'boolean'
      ? source.babycare
      : false,
    beauty_spa: typeof source.beauty_spa === 'boolean'
      ? source.beauty_spa
      : false,
    student_training: typeof source.student_training === 'boolean'
      ? source.student_training
      : false,
    industrial_cleaning: typeof source.industrial_cleaning === 'boolean'
      ? source.industrial_cleaning
      : false,
  };
}

export function normalizeEnabledModulesForSave(value: unknown): TenantEnabledModules {
  const modules = normalizeEnabledModules(value);
  if (modules.babycare || modules.beauty_spa || modules.industrial_cleaning) return modules;
  return {
    ...modules,
    babycare: true,
  };
}

export function getDefaultTenantModuleKey(value: unknown): TenantPrimaryBusinessModuleKey {
  const modules = normalizeEnabledModulesForSave(value);
  if (modules.industrial_cleaning) return 'industrial_cleaning';
  return modules.babycare ? 'babycare' : 'beauty_spa';
}

export function getDefaultTenantBrandThemeForModule(moduleKey: TenantModuleKey): TenantBrandTheme {
  if (moduleKey === 'beauty_spa') return DEFAULT_BEAUTY_TENANT_BRAND_THEME;
  if (moduleKey === 'industrial_cleaning') return DEFAULT_CLEANING_TENANT_BRAND_THEME;
  return DEFAULT_TENANT_BRAND_THEME;
}

export function normalizeTenantBrandThemeForModule(
  value: unknown,
  moduleKey: TenantModuleKey,
): TenantBrandTheme {
  const source = isPlainRecord(value) ? value : {};
  const fallback = getDefaultTenantBrandThemeForModule(moduleKey);

  return {
    brandName: cleanText(source.brandName, TEXT_LIMITS.brandName),
    logoUrl: cleanLogoUrl(source.logoUrl),
    primaryColor: cleanColor(source.primaryColor, fallback.primaryColor),
    accentColor: cleanColor(source.accentColor, fallback.accentColor),
    portalDisplayName: cleanText(source.portalDisplayName, TEXT_LIMITS.portalDisplayName),
    invoiceDisplayName: cleanText(source.invoiceDisplayName, TEXT_LIMITS.invoiceDisplayName),
    stylePreset: cleanChoice(source.stylePreset, TENANT_BRAND_STYLE_PRESETS, fallback.stylePreset),
    radiusStyle: cleanChoice(source.radiusStyle, TENANT_BRAND_RADIUS_STYLES, fallback.radiusStyle),
    buttonStyle: cleanChoice(source.buttonStyle, TENANT_BRAND_BUTTON_STYLES, fallback.buttonStyle),
    menuStyle: cleanChoice(source.menuStyle, TENANT_BRAND_MENU_STYLES, fallback.menuStyle),
  };
}

export function normalizeTenantBrandTheme(value: unknown): TenantBrandTheme {
  return normalizeTenantBrandThemeForModule(value, 'babycare');
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

export function toTenantBrandThemeJsonForModule(value: unknown, moduleKey: TenantModuleKey): Json {
  return normalizeTenantBrandThemeForModule(value, moduleKey) as unknown as Json;
}

export function resolveTenantBrandIdentity(input: {
  enabledModules?: unknown;
  brandTheme?: unknown;
  logoUrl?: string | null;
  tenantName?: string | null;
  surface?: TenantBrandSurface;
}): ResolvedTenantBrandIdentity {
  const moduleKey = getDefaultTenantModuleKey(input.enabledModules);
  const theme = normalizeTenantBrandThemeForModule(input.brandTheme, moduleKey);
  const tenantName = cleanText(input.tenantName, TEXT_LIMITS.brandName);
  const explicitLogoUrl = cleanLogoUrl(input.logoUrl);
  const defaultDisplayName = 
    moduleKey === 'beauty_spa' ? 'Beauty Spa' :
    moduleKey === 'industrial_cleaning' ? 'Industrial Cleaning' :
    'Bella Spa';
  const baseDisplayName =
    theme.brandName ||
    (input.surface === 'portal' ? theme.portalDisplayName : '') ||
    (input.surface === 'invoice' ? theme.invoiceDisplayName : '') ||
    tenantName ||
    defaultDisplayName;
  const portalDisplayName = theme.portalDisplayName || theme.brandName || tenantName || defaultDisplayName;
  const invoiceDisplayName = theme.invoiceDisplayName || theme.brandName || tenantName || defaultDisplayName;
  const displayName =
    input.surface === 'portal'
      ? portalDisplayName
      : input.surface === 'invoice'
        ? invoiceDisplayName
        : baseDisplayName;

  return {
    ...theme,
    moduleKey,
    displayName,
    portalDisplayName,
    invoiceDisplayName,
    logoUrl: explicitLogoUrl || theme.logoUrl || (moduleKey === 'babycare' ? '/FullLogo_Transparent_NoBuffer.png' : ''),
    subtitle: 
      moduleKey === 'beauty_spa' ? 'Beauty Spa ERP' :
      moduleKey === 'industrial_cleaning' ? 'Industrial Cleaning ERP' :
      'Management System',
    primaryHoverColor: darkenHexColor(theme.primaryColor),
    monogram: buildMonogram(displayName),
    isBeautySpa: moduleKey === 'beauty_spa',
  };
}
