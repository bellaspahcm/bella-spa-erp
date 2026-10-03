import type { ProductDefinition } from '@/platform/registry/product-registry';

export type PlatformPwaDisplay = 'standalone';
export type PlatformPwaScope = '/';

export interface PlatformPwaIcon {
  readonly src: string;
  readonly sizes: string;
  readonly type: string;
  readonly purpose?: string;
}

export interface PlatformPwaBrandOverlay {
  readonly brandName?: string | null;
  readonly logoUrl?: string | null;
  readonly primaryColor?: string | null;
}

export interface PlatformPwaIdentity {
  readonly productKey: string | null;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly startUrl: string;
  readonly scope: PlatformPwaScope;
  readonly display: PlatformPwaDisplay;
  readonly themeColor: string;
  readonly backgroundColor: string;
  readonly icons: PlatformPwaIcon[];
}

export interface PlatformWebAppManifest {
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly start_url: string;
  readonly scope: PlatformPwaScope;
  readonly display: PlatformPwaDisplay;
  readonly orientation: 'portrait';
  readonly theme_color: string;
  readonly background_color: string;
  readonly icons: PlatformPwaIcon[];
}

const FALLBACK_NAME = 'Bella Platform';
const FALLBACK_DESCRIPTION = 'Bella Platform workspace';
const FALLBACK_START_URL = '/dashboard';
const FALLBACK_THEME_COLOR = '#0f172a';
const FALLBACK_BACKGROUND_COLOR = '#ffffff';
const PLATFORM_PWA_SCOPE: PlatformPwaScope = '/';
const PLATFORM_PWA_DISPLAY: PlatformPwaDisplay = 'standalone';
const SHORT_NAME_LIMIT = 24;

const PLATFORM_PWA_ICONS: PlatformPwaIcon[] = [
  {
    src: '/icons/icon-192x192.png',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any maskable',
  },
  {
    src: '/icons/icon-512x512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable',
  },
];

function cleanText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeShortName(value: string): string {
  const cleaned = cleanText(value) || FALLBACK_NAME;
  return cleaned.length <= SHORT_NAME_LIMIT
    ? cleaned
    : cleaned.slice(0, SHORT_NAME_LIMIT).trim();
}

function normalizeStartUrl(value: string | null | undefined): string {
  const cleaned = cleanText(value);
  if (!cleaned.startsWith('/') || cleaned.startsWith('//')) {
    return FALLBACK_START_URL;
  }
  return cleaned;
}

function normalizeThemeColor(value: string | null | undefined): string {
  const cleaned = cleanText(value);
  return /^#[0-9a-fA-F]{6}$/.test(cleaned) ? cleaned : FALLBACK_THEME_COLOR;
}

function inferIconType(src: string): string | null {
  const lower = src.toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

function buildBrandIcon(logoUrl: string | null | undefined): PlatformPwaIcon | null {
  const cleaned = cleanText(logoUrl);
  if (!cleaned || cleaned.startsWith('//')) return null;
  if (!cleaned.startsWith('/') && !cleaned.startsWith('https://')) return null;

  const type = inferIconType(cleaned);
  if (!type) return null;

  return {
    src: cleaned,
    sizes: type === 'image/svg+xml' ? 'any' : '512x512',
    type,
    purpose: 'any',
  };
}

function buildIcons(brand: PlatformPwaBrandOverlay | undefined): PlatformPwaIcon[] {
  const brandIcon = buildBrandIcon(brand?.logoUrl);
  return brandIcon ? [brandIcon, ...PLATFORM_PWA_ICONS] : PLATFORM_PWA_ICONS;
}

export function resolvePlatformPwaIdentity(input: {
  readonly product?: Pick<ProductDefinition, 'productKey' | 'displayName' | 'subtitle' | 'defaultRoute'> | null;
  readonly brand?: PlatformPwaBrandOverlay | null;
} = {}): PlatformPwaIdentity {
  const product = input.product ?? null;
  const brand = input.brand ?? null;
  const brandName = cleanText(brand?.brandName);
  const productName = cleanText(product?.displayName);
  const name = brandName || productName || FALLBACK_NAME;
  const productDescription = cleanText(product?.subtitle);

  return {
    productKey: product?.productKey ?? null,
    name,
    shortName: normalizeShortName(name),
    description: productDescription || FALLBACK_DESCRIPTION,
    startUrl: normalizeStartUrl(product?.defaultRoute),
    scope: PLATFORM_PWA_SCOPE,
    display: PLATFORM_PWA_DISPLAY,
    themeColor: normalizeThemeColor(brand?.primaryColor),
    backgroundColor: FALLBACK_BACKGROUND_COLOR,
    icons: buildIcons(brand ?? undefined),
  };
}

export function toPlatformWebAppManifest(identity: PlatformPwaIdentity): PlatformWebAppManifest {
  return {
    name: identity.name,
    short_name: identity.shortName,
    description: identity.description,
    start_url: identity.startUrl,
    scope: identity.scope,
    display: identity.display,
    orientation: 'portrait',
    theme_color: identity.themeColor,
    background_color: identity.backgroundColor,
    icons: identity.icons,
  };
}

