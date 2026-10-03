import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { productRegistry } from '@/platform/registry/product-registry';
import {
  resolvePlatformPwaIdentity,
  toPlatformWebAppManifest,
  type PlatformPwaBrandOverlay,
} from '@/platform/pwa/platform-pwa-contract';

function readWorkspaceFile(pathFromRoot: string): string {
  return readFileSync(join(process.cwd(), pathFromRoot), 'utf8');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

describe('Platform PWA Contract V1', () => {
  it('generates a complete manifest from the platform PWA identity', () => {
    const product = productRegistry.getRequired('bella_spa');
    const identity = resolvePlatformPwaIdentity({ product });
    const manifest = toPlatformWebAppManifest(identity);

    expect(manifest).toMatchObject({
      name: 'Bella Beauty Spa v2',
      short_name: 'Bella Beauty Spa v2',
      description: 'Spa Chain Management',
      start_url: '/dashboard/beauty-spa-v2',
      scope: '/',
      display: 'standalone',
      theme_color: '#0f172a',
      background_color: '#ffffff',
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/icons/icon-192x192.png', sizes: '192x192' }),
        expect.objectContaining({ src: '/icons/icon-512x512.png', sizes: '512x512' }),
      ]),
    );
  });

  it('uses Product Registry defaultRoute as the canonical start_url', () => {
    const product = productRegistry.getRequired('bella_spa');
    const identity = resolvePlatformPwaIdentity({ product });

    expect(product.defaultRoute).toBe('/dashboard/beauty-spa-v2');
    expect(identity.productKey).toBe('bella_spa');
    expect(identity.startUrl).toBe(product.defaultRoute);
  });

  it('falls back safely when product identity is missing', () => {
    const manifest = toPlatformWebAppManifest(resolvePlatformPwaIdentity());

    expect(manifest.name).toBe('Bella Platform');
    expect(manifest.start_url).toBe('/dashboard');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('lets tenant brand affect only display fields, not PWA boundaries', () => {
    const product = productRegistry.getRequired('bella_spa');
    const tenantBrand = {
      brandName: 'Tenant Beauty Collective',
      logoUrl: '/tenant-logo.svg',
      primaryColor: '#074E44',
      startUrl: 'https://example.invalid/hijack',
    } satisfies PlatformPwaBrandOverlay & { readonly startUrl: string };

    const identity = resolvePlatformPwaIdentity({ product, brand: tenantBrand });
    const manifest = toPlatformWebAppManifest(identity);

    expect(manifest.name).toBe('Tenant Beauty Collective');
    expect(manifest.short_name).toBe('Tenant Beauty Collective');
    expect(manifest.theme_color).toBe('#074E44');
    expect(manifest.icons[0]).toMatchObject({
      src: '/tenant-logo.svg',
      sizes: 'any',
      type: 'image/svg+xml',
    });
    expect(manifest.start_url).toBe('/dashboard/beauty-spa-v2');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('keeps the static manifest as a neutral fallback contract', () => {
    const payload: unknown = JSON.parse(readWorkspaceFile('public/manifest.json'));

    expect(isRecord(payload)).toBe(true);
    if (!isRecord(payload)) return;

    expect(payload.name).toBe('Bella Platform');
    expect(payload.short_name).toBe('Bella');
    expect(payload.start_url).toBe('/dashboard');
    expect(payload.scope).toBe('/');
    expect(payload.display).toBe('standalone');
    expect(Array.isArray(payload.icons)).toBe(true);
  });

  it('exposes a generated manifest route through Product Registry linkage', () => {
    const routeSource = readWorkspaceFile('src/app/manifest.webmanifest/route.ts');
    const layoutSource = readWorkspaceFile('src/app/layout.tsx');

    expect(layoutSource).toContain('manifest: "/manifest.webmanifest"');
    expect(routeSource).toContain('productRegistry.get(tenant.product_key)');
    expect(routeSource).toContain("'Content-Type': 'application/manifest+json; charset=utf-8'");
    expect(routeSource).not.toContain('tenant.start_url');
  });

  it('keeps PwaRegister on the shared platform install identity', () => {
    const source = readWorkspaceFile('src/components/common/PwaRegister.tsx');

    expect(source).toContain('/manifest.webmanifest');
    expect(source).not.toContain('Bella Spa ERP');
    expect(source).not.toContain('làm việc offline');
  });

  it('does not expand the service worker into offline/cache behavior', () => {
    const source = readWorkspaceFile('public/sw.js');

    expect(source).toContain('Let browser handle all requests normally');
    expect(source).toContain('No offline or runtime cache strategy in V1');
    expect(source).not.toMatch(/caches\.open|cache\.addAll|event\.respondWith/);
  });
});

