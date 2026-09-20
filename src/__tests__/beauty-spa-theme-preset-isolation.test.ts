import { readFileSync } from 'fs';
import path from 'path';
import {
  normalizeTenantBrandThemeForModule,
  resolveTenantBrandIdentity,
  type TenantBrandTheme,
} from '@/lib/business-rules/tenant-modules';

function readSource(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('beauty_spa and haircut theme preset isolation & CSS ownership (Pass 1 Verification)', () => {
  const globalStyles = readSource('src/app/globals.css');

  describe('Layer 1 & Layer 2: Brand Identity Resolution & DOM Attribute Coupling', () => {
    it('resolves preset slate_minimal correctly for beauty_spa module', () => {
      const inputTheme: Partial<TenantBrandTheme> = {
        stylePreset: 'slate_minimal',
        primaryColor: '#334155',
        accentColor: '#64748B',
      };

      const normalized = normalizeTenantBrandThemeForModule(inputTheme, 'beauty_spa');
      expect(normalized.stylePreset).toBe('slate_minimal');
      expect(normalized.primaryColor).toBe('#334155');

      const resolved = resolveTenantBrandIdentity({
        enabledModules: { beauty_spa: true },
        brandTheme: inputTheme,
        tenantName: 'Bella Haircut Shop',
        surface: 'app',
      });

      expect(resolved.moduleKey).toBe('beauty_spa');
      expect(resolved.stylePreset).toBe('slate_minimal');
      expect(resolved.primaryColor).toBe('#334155');
    });

    it('resolves default Jade Emerald fallback when brandTheme is unconfigured', () => {
      const normalized = normalizeTenantBrandThemeForModule({}, 'beauty_spa');
      expect(normalized.stylePreset).toBe('jade_wellness');
      expect(normalized.primaryColor).toBe('#074E44');

      const resolved = resolveTenantBrandIdentity({
        enabledModules: { beauty_spa: true },
        brandTheme: {},
        tenantName: 'Bella Haircut Shop',
        surface: 'app',
      });

      expect(resolved.moduleKey).toBe('beauty_spa');
      expect(resolved.primaryColor).toBe('#074E44');
    });
  });

  describe('Layer 3: CSS Ownership & Cascade Invariants in globals.css', () => {
    it('scopes default beauty_spa CSS variables behind :not([data-tenant-brand-preset]) so presets are not overridden', () => {
      expect(globalStyles).toContain('html:not([data-tenant-brand-preset])[data-tenant-module="beauty_spa"]');
      expect(globalStyles).not.toMatch(/^html\[data-tenant-module="beauty_spa"\]\s*\{[^}]*--primary:\s*#074e44/m);
    });

    it('scopes default beauty_spa sidebar background behind :not([data-tenant-brand-preset])', () => {
      expect(globalStyles).toContain(
        'html:not([data-tenant-brand-preset])[data-tenant-module="beauty_spa"] .beauty-erp-sidebar',
      );
    });

    it('scopes default beauty_spa nav active item behind :not([data-tenant-brand-preset])', () => {
      expect(globalStyles).toContain(
        'html:not([data-tenant-brand-preset])[data-tenant-module="beauty_spa"] .beauty-erp-nav-item-active',
      );
    });

    it('retains explicit brand preset definitions for slate_minimal, ocean_clean, luxury_navy, graphite_luxe, and bella_rose', () => {
      expect(globalStyles).toContain('html[data-tenant-brand-preset="slate_minimal"] .beauty-erp-sidebar');
      expect(globalStyles).toContain('html[data-tenant-brand-preset="slate_minimal"] .beauty-erp-nav-item-active');

      expect(globalStyles).toContain('html[data-tenant-brand-preset="ocean_clean"] .beauty-erp-sidebar');
      expect(globalStyles).toContain('html[data-tenant-brand-preset="ocean_clean"] .beauty-erp-nav-item-active');

      expect(globalStyles).toContain('html[data-tenant-brand-preset="luxury_navy"] .beauty-erp-sidebar');
      expect(globalStyles).toContain('html[data-tenant-brand-preset="luxury_navy"] .beauty-erp-nav-item-active');

      expect(globalStyles).toContain('html[data-tenant-brand-preset="graphite_luxe"] .beauty-erp-sidebar');
      expect(globalStyles).toContain('html[data-tenant-brand-preset="graphite_luxe"] .beauty-erp-nav-item-active');

      expect(globalStyles).toContain('html[data-tenant-brand-preset="bella_rose"] .beauty-erp-sidebar');
      expect(globalStyles).toContain('html[data-tenant-brand-preset="bella_rose"] .beauty-erp-nav-item-active');
    });

    it('does NOT force --beauty-em (#074E44) on active nav items when a brand preset is active', () => {
      // Ensures no unscoped html[data-tenant-module="beauty_spa"] .beauty-erp-nav-item-active exists without :not([data-tenant-brand-preset])
      const unscopedBeautyNavActive = globalStyles.match(
        /^html\[data-tenant-module="beauty_spa"\]\s+\.beauty-erp-nav-item-active\s*\{/m,
      );
      expect(unscopedBeautyNavActive).toBeNull();
    });
  });
});
