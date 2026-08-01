import type { Json } from '@/types/database.types';

export const TENANT_MODULE_KEYS = ['babycare', 'beauty_spa', 'student_training', 'industrial_cleaning', 'real_estate'] as const;
export const TENANT_PRIMARY_BUSINESS_MODULE_KEYS = ['babycare', 'beauty_spa', 'industrial_cleaning', 'real_estate'] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];
export type TenantPrimaryBusinessModuleKey = (typeof TENANT_PRIMARY_BUSINESS_MODULE_KEYS)[number];

export type TenantEnabledModules = Record<TenantModuleKey, boolean>;

export const TENANT_BRAND_STYLE_PRESETS = ['bella_rose', 'jade_wellness', 'graphite_luxe', 'ocean_clean', 'luxury_navy'] as const;
export const TENANT_BRAND_RADIUS_STYLES = ['soft', 'balanced', 'compact'] as const;
export const TENANT_BRAND_BUTTON_STYLES = ['pill', 'rounded', 'minimal'] as const;
export const TENANT_BRAND_MENU_STYLES = ['comfortable', 'compact'] as const;

export type TenantBrandStylePreset = (typeof TENANT_BRAND_STYLE_PRESETS)[number];
export type TenantBrandRadiusStyle = (typeof TENANT_BRAND_RADIUS_STYLES)[number];
export type TenantBrandButtonStyle = (typeof TENANT_BRAND_BUTTON_STYLES)[number];
export type TenantBrandMenuStyle = (typeof TENANT_BRAND_MENU_STYLES)[number];

export const TENANT_BRAND_FONT_HEADINGS = ['sans', 'serif'] as const;
export type TenantBrandFontHeading = (typeof TENANT_BRAND_FONT_HEADINGS)[number];

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
  /** Heading font: 'serif' for luxury/spa feel, 'sans' for professional/clean */
  fontHeading: TenantBrandFontHeading;
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
  real_estate: false,
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
  fontHeading: 'serif', // Baby care: warm, premium serif feel
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
  fontHeading: 'serif', // Beauty spa: luxurious serif feel
};

export const DEFAULT_CLEANING_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#1E40AF', // Blue 700 - professional blue
  accentColor: '#3B82F6', // Blue 500 - bright blue accent
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'ocean_clean',
  radiusStyle: 'balanced',
  buttonStyle: 'rounded',
  menuStyle: 'compact',
  fontHeading: 'sans', // Industrial: clean, professional sans-serif
};

export const DEFAULT_REAL_ESTATE_TENANT_BRAND_THEME: TenantBrandTheme = {
  brandName: '',
  logoUrl: '',
  primaryColor: '#1E3A8A', // Navy 900 - professional real estate navy
  accentColor: '#D97706', // Amber 600 - gold accent
  portalDisplayName: '',
  invoiceDisplayName: '',
  stylePreset: 'luxury_navy',
  radiusStyle: 'balanced',
  buttonStyle: 'rounded',
  menuStyle: 'compact',
  fontHeading: 'sans',
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
  fontHeading: 10,
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
  if (Array.isArray(value)) {
    return {
      babycare: value.includes('babycare'),
      beauty_spa: value.includes('beauty_spa'),
      student_training: value.includes('student_training'),
      industrial_cleaning: value.includes('industrial_cleaning'),
      real_estate: value.includes('real_estate'),
    };
  }

  const source = isPlainRecord(value) ? value : {};
  const hasExplicitModuleConfig = TENANT_MODULE_KEYS.some((moduleKey) => typeof source[moduleKey] === 'boolean');

  if (!hasExplicitModuleConfig) {
    return DEFAULT_ENABLED_MODULES;
  }

  return {
    babycare: typeof source.babycare === 'boolean' ? source.babycare : false,
    beauty_spa: typeof source.beauty_spa === 'boolean' ? source.beauty_spa : false,
    student_training: typeof source.student_training === 'boolean' ? source.student_training : false,
    industrial_cleaning: typeof source.industrial_cleaning === 'boolean' ? source.industrial_cleaning : false,
    real_estate: typeof source.real_estate === 'boolean' ? source.real_estate : false,
  };
}

export function normalizeEnabledModulesForSave(value: unknown): TenantEnabledModules {
  const modules = normalizeEnabledModules(value);
  if (modules.babycare || modules.beauty_spa || modules.industrial_cleaning || modules.real_estate) return modules;
  return {
    ...modules,
    babycare: true,
  };
}

export function getDefaultTenantModuleKey(value: unknown, tenantName?: string | null): TenantPrimaryBusinessModuleKey {
  const modules = normalizeEnabledModulesForSave(value);
  if (modules.real_estate) return 'real_estate';
  if (modules.industrial_cleaning) return 'industrial_cleaning';
  if (modules.beauty_spa) return 'beauty_spa';

  if (tenantName) {
    const lower = tenantName.toLowerCase();
    if (lower.includes('land') || lower.includes('bđs') || lower.includes('real estate') || lower.includes('bất động sản')) {
      return 'real_estate';
    }
    if (lower.includes('cleaning') || lower.includes('vệ sinh') || lower.includes('sạch')) {
      return 'industrial_cleaning';
    }
    if (lower.includes('beauty') || lower.includes('spa') || lower.includes('thẩm mỹ')) {
      return 'beauty_spa';
    }
  }

  return modules.babycare ? 'babycare' : 'beauty_spa';
}

export function getDefaultTenantBrandThemeForModule(moduleKey: TenantModuleKey): TenantBrandTheme {
  if (moduleKey === 'beauty_spa') return DEFAULT_BEAUTY_TENANT_BRAND_THEME;
  if (moduleKey === 'industrial_cleaning') return DEFAULT_CLEANING_TENANT_BRAND_THEME;
  if (moduleKey === 'real_estate') return DEFAULT_REAL_ESTATE_TENANT_BRAND_THEME;
  return DEFAULT_TENANT_BRAND_THEME;
}

const LEGACY_DEFAULT_PINKS = ['#A91555', '#DB2777', '#F43F5E', '#BE123C', '#E11D48', '#881337', '#FF4081', '#E91E63', '#EC4899', '#C026D3', '#D946EF', '#9F1239'];

export function normalizeTenantBrandThemeForModule(
  value: unknown,
  moduleKey: TenantModuleKey,
): TenantBrandTheme {
  const source = isPlainRecord(value) ? value : {};
  const fallback = getDefaultTenantBrandThemeForModule(moduleKey);

  let rawPrimary = cleanColor(source.primaryColor, fallback.primaryColor);
  let rawAccent = cleanColor(source.accentColor, fallback.accentColor);
  let rawStylePreset = cleanChoice(source.stylePreset, TENANT_BRAND_STYLE_PRESETS, fallback.stylePreset);

  // Upgrade legacy default pink brand theme to target module signature colors
  if (moduleKey !== 'babycare' && (LEGACY_DEFAULT_PINKS.includes(rawPrimary.toUpperCase()) || rawStylePreset === 'bella_rose')) {
    rawPrimary = fallback.primaryColor;
    rawAccent = fallback.accentColor;
    rawStylePreset = fallback.stylePreset;
  }

  return {
    brandName: cleanText(source.brandName, TEXT_LIMITS.brandName),
    logoUrl: cleanLogoUrl(source.logoUrl),
    primaryColor: rawPrimary,
    accentColor: rawAccent,
    portalDisplayName: cleanText(source.portalDisplayName, TEXT_LIMITS.portalDisplayName),
    invoiceDisplayName: cleanText(source.invoiceDisplayName, TEXT_LIMITS.invoiceDisplayName),
    stylePreset: rawStylePreset,
    radiusStyle: cleanChoice(source.radiusStyle, TENANT_BRAND_RADIUS_STYLES, fallback.radiusStyle),
    buttonStyle: cleanChoice(source.buttonStyle, TENANT_BRAND_BUTTON_STYLES, fallback.buttonStyle),
    menuStyle: cleanChoice(source.menuStyle, TENANT_BRAND_MENU_STYLES, fallback.menuStyle),
    fontHeading: cleanChoice(source.fontHeading, TENANT_BRAND_FONT_HEADINGS, fallback.fontHeading),
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
    moduleKey === 'real_estate' ? 'Bella Land' :
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
    logoUrl: explicitLogoUrl || theme.logoUrl || (moduleKey === 'babycare' ? '/logo.png' : ''),
    subtitle: 
      moduleKey === 'beauty_spa' ? 'Beauty Spa ERP' :
      moduleKey === 'industrial_cleaning' ? 'Industrial Cleaning ERP' :
      moduleKey === 'real_estate' ? 'Real Estate Management' :
      'Management System',
    primaryHoverColor: darkenHexColor(theme.primaryColor),
    monogram: buildMonogram(displayName),
    isBeautySpa: moduleKey === 'beauty_spa',
  };
}
