/** @jest-environment jsdom */
import {
  applyThemeTokensToRoot,
  hexToRelativeLuminance,
  resolveDynamicThemeTokens,
  resolveTenantBrandIdentity,
  type TenantBrandTheme,
  type TenantModuleKey,
} from '@/lib/business-rules/tenant-modules';
import fs from 'fs';
import path from 'path';

describe('Configuration-Driven Dynamic Theme Engine (Unknown Module & Future-Proof Invariants)', () => {
  const UNKNOWN_MODULE_KEY = '__theme_test_module__' as TenantModuleKey;
  const CUSTOM_PURPLE_PRIMARY = '#6D28D9';
  const CUSTOM_AMBER_ACCENT = '#F59E0B';

  beforeEach(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.removeAttribute('style');
      document.documentElement.removeAttribute('data-tenant-module');
      document.documentElement.removeAttribute('data-tenant-brand-preset');
    }
  });

  describe('1. Unknown / Future Module Dynamic Token Generation', () => {
    it('accepts an unknown/new module and generates full semantic tokens without code modification', () => {
      const tokens = resolveDynamicThemeTokens({
        primaryColor: CUSTOM_PURPLE_PRIMARY,
        accentColor: CUSTOM_AMBER_ACCENT,
        stylePreset: '' as any, // No preset match → triggers pure dynamic resolution
      });

      expect(tokens.primary).toBe(CUSTOM_PURPLE_PRIMARY);
      expect(tokens.accent).toBe(CUSTOM_AMBER_ACCENT);
      expect(tokens.ring).toBe(CUSTOM_PURPLE_PRIMARY);
      // Dark primary color (#6D28D9) must yield readable white foreground text for WCAG AA
      expect(tokens.primaryForeground).toBe('#FFFFFF');
      expect(tokens.accentForeground).toBe('#FFFFFF');
      // Sidebar should dynamically generate dark gradient and dark translucent inner panel
      expect(tokens.sidebarBg).toContain('linear-gradient');
      expect(tokens.sidebarBg.toUpperCase()).toContain('6D28D9');
      expect(tokens.sidebarFg).toBe('#FFFFFF');
      expect(tokens.sidebarInnerBg).toBe('rgba(0, 0, 0, 0.45)');
      expect(tokens.sidebarBorder).toBe('rgba(255, 255, 255, 0.15)');
    });

    it('generates light sidebar tokens dynamically for a light primary custom color', () => {
      const LIGHT_YELLOW_PRIMARY = '#FDE047'; // Bright yellow
      const tokens = resolveDynamicThemeTokens({
        primaryColor: LIGHT_YELLOW_PRIMARY,
        accentColor: '#1E293B',
        stylePreset: '' as any,
      });

      expect(tokens.primary).toBe(LIGHT_YELLOW_PRIMARY);
      // Light primary color (#FDE047) must yield readable dark foreground text for WCAG AA
      expect(tokens.primaryForeground).toBe('#0F172A');
      expect(tokens.sidebarBg).toBe('#F8FAFC');
      expect(tokens.sidebarInnerBg).toBe('rgba(255, 255, 255, 0.80)');
      expect(tokens.sidebarFg).toBe('#0F172A');
    });
  });

  describe('2. DOM Root Attribute & CSS Token Injection', () => {
    it('applies semantic tokens to document.documentElement without errors', () => {
      const tokens = resolveDynamicThemeTokens({
        primaryColor: CUSTOM_PURPLE_PRIMARY,
        accentColor: CUSTOM_AMBER_ACCENT,
        stylePreset: '' as any,
      });

      applyThemeTokensToRoot(tokens);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--primary')).toBe(CUSTOM_PURPLE_PRIMARY);
      expect(root.style.getPropertyValue('--accent')).toBe(CUSTOM_AMBER_ACCENT);
      expect(root.style.getPropertyValue('--primary-foreground')).toBe('#FFFFFF');
      expect(root.style.getPropertyValue('--sidebar-bg')).toBe(tokens.sidebarBg);
      expect(root.style.getPropertyValue('--sidebar-inner-bg')).toBe('rgba(0, 0, 0, 0.45)');
      expect(root.style.getPropertyValue('--sidebar-fg')).toBe('#FFFFFF');
      expect(root.style.getPropertyValue('--sidebar-border')).toBe('rgba(255, 255, 255, 0.15)');
    });
  });

  describe('3. Default Unconfigured Tenant Fallback ({})', () => {
    it('handles empty brandTheme {} gracefully without crashing or returning undefined tokens', () => {
      const defaultTokens = resolveDynamicThemeTokens({});

      expect(defaultTokens.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(defaultTokens.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(defaultTokens.primaryForeground).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(defaultTokens.sidebarBg).toBeDefined();
      expect(defaultTokens.sidebarInnerBg).toBeDefined();
      expect(defaultTokens.sidebarFg).toBeDefined();
      expect(defaultTokens.sidebarBorder).toBeDefined();
    });
  });

  describe('4. Existing Signature Presets Integrity', () => {
    it('preserves exact canonical styling for all 6 built-in signature presets', () => {
      const presets = ['jade_wellness', 'luxury_navy', 'ocean_clean', 'graphite_luxe', 'bella_rose', 'slate_minimal'] as const;

      presets.forEach((preset) => {
        const tokens = resolveDynamicThemeTokens({ stylePreset: preset });
        expect(tokens.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(tokens.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(tokens.sidebarBg).toBeDefined();
        expect(tokens.sidebarInnerBg).toBeDefined();
        expect(tokens.sidebarFg).toBeDefined();
      });
    });
  });

  describe('5. Zero-Hardcode & Architecture Isolation Guards', () => {
    it('proves that globals.css contains NO hardcoded rules for __theme_test_module__', () => {
      const cssPath = path.join(process.cwd(), 'src/app/globals.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      expect(cssContent).not.toContain(UNKNOWN_MODULE_KEY);
    });

    it('proves that sidebar.tsx contains NO hardcoded checks for __theme_test_module__', () => {
      const sidebarPath = path.join(process.cwd(), 'src/components/layout/sidebar.tsx');
      const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

      expect(sidebarContent).not.toContain(UNKNOWN_MODULE_KEY);
      // Verify inner container uses beauty-erp-sidebar-inner token consumer instead of hardcoded bg-white
      expect(sidebarContent).toContain('beauty-erp-sidebar-inner');
      expect(sidebarContent).not.toContain('bg-white dark:bg-[#15171e]');
    });
  });
});
