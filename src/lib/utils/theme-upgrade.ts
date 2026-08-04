/**
 * Theme Upgrade Utility
 * 
 * Purpose: Auto-upgrade legacy tenant themes to module-specific colors
 * 
 * Use Case:
 * - Bella Auto tenants with pink/navy colors → upgrade to cyan/teal
 * - Real Estate tenants with pink colors → upgrade to navy/gold
 * - etc.
 * 
 * @author Bella ERP Team
 * @date 2026-08-04
 */

import { createClient } from '@/lib/supabase-client';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import {
  getDefaultTenantBrandThemeForModule,
  normalizeTenantBrandThemeForModule,
} from '@/lib/business-rules/tenant-modules';

const LEGACY_DEFAULT_PINKS = [
  '#A91555', // Bella Rose primary
  '#DB2777', // Pink 600
  '#F43F5E', // Rose 500
  '#BE123C', // Rose 700
  '#E11D48', // Rose 600
  '#881337', // Rose 900
  '#FF4081', // Material Pink
  '#E91E63', // Material Pink
  '#EC4899', // Pink 500
  '#C026D3', // Fuchsia 600
  '#D946EF', // Fuchsia 500
  '#9F1239', // Rose 800
];

const LEGACY_DEFAULT_NAVY = '#1E3A8A'; // Navy 900 (used for Real Estate)
const LEGACY_DEFAULT_BLUE = '#1E40AF'; // Blue 700 (old industrial cleaning)

/**
 * Check if tenant theme needs upgrade
 */
export function needsThemeUpgrade(
  currentTheme: Record<string, unknown> | null,
  moduleKey: TenantModuleKey,
): boolean {
  // Don't upgrade baby care (pink is correct for them)
  if (moduleKey === 'babycare') return false;

  const normalized = normalizeTenantBrandThemeForModule(currentTheme, moduleKey);
  const primary = normalized.primaryColor.toUpperCase();
  const preset = normalized.stylePreset;

  // Bella Auto should use cyan (#0891b2), not pink/navy
  if (moduleKey === 'bella_auto') {
    if (LEGACY_DEFAULT_PINKS.includes(primary)) return true;
    if (primary === LEGACY_DEFAULT_NAVY) return true;
    if (primary === LEGACY_DEFAULT_BLUE) return true;
    if (preset === 'bella_rose' || preset === 'luxury_navy') return true;
  }

  // Beauty Spa should use jade green (#074E44), not pink
  if (moduleKey === 'beauty_spa') {
    if (LEGACY_DEFAULT_PINKS.includes(primary)) return true;
    if (preset === 'bella_rose') return true;
  }

  // Industrial Cleaning should use ocean clean blue, not pink
  if (moduleKey === 'industrial_cleaning') {
    if (LEGACY_DEFAULT_PINKS.includes(primary)) return true;
    if (preset === 'bella_rose') return true;
  }

  // Real Estate should use luxury navy, not pink
  if (moduleKey === 'real_estate') {
    if (LEGACY_DEFAULT_PINKS.includes(primary)) return true;
    if (preset === 'bella_rose') return true;
  }

  return false;
}

/**
 * Upgrade tenant theme to module-specific colors
 */
export async function upgradeTheme(
  tenantId: string,
  moduleKey: TenantModuleKey,
): Promise<{ success: boolean; message: string; upgraded?: boolean }> {
  const supabase = createClient();

  try {
    // Fetch current tenant
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('brand_theme')
      .eq('id', tenantId)
      .single();

    if (fetchError) {
      console.error('[ThemeUpgrade] Fetch error:', fetchError);
      return { success: false, message: 'Failed to fetch tenant' };
    }

    // Check if upgrade needed
    if (!needsThemeUpgrade(tenant.brand_theme as Record<string, unknown> | null, moduleKey)) {
      return { success: true, message: 'Theme already up to date', upgraded: false };
    }

    // Get default theme for module
    const defaultTheme = getDefaultTenantBrandThemeForModule(moduleKey);
    const currentTheme = normalizeTenantBrandThemeForModule(tenant.brand_theme, moduleKey);

    // Merge: keep custom values (brandName, logoUrl), upgrade colors
    const upgradedTheme = {
      ...currentTheme,
      primaryColor: defaultTheme.primaryColor,
      accentColor: defaultTheme.accentColor,
      stylePreset: defaultTheme.stylePreset,
      // Keep other custom settings
    };

    // Update database
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        brand_theme: upgradedTheme as unknown as import('@/types/database.types').Json,
      })
      .eq('id', tenantId);

    if (updateError) {
      console.error('[ThemeUpgrade] Update error:', updateError);
      return { success: false, message: 'Failed to update theme' };
    }

    console.log(`[ThemeUpgrade] ✅ Upgraded ${moduleKey} theme:`, {
      from: currentTheme.primaryColor,
      to: upgradedTheme.primaryColor,
      preset: upgradedTheme.stylePreset,
    });

    return {
      success: true,
      message: `Theme upgraded to ${moduleKey} colors`,
      upgraded: true,
    };
  } catch (error) {
    console.error('[ThemeUpgrade] Unexpected error:', error);
    return { success: false, message: 'Unexpected error during upgrade' };
  }
}

/**
 * Get upgrade description for user notification
 */
export function getUpgradeDescription(moduleKey: TenantModuleKey): string {
  switch (moduleKey) {
    case 'bella_auto':
      return 'Đã cập nhật màu sắc Bella Auto (Xanh cyan/teal)';
    case 'beauty_spa':
      return 'Đã cập nhật màu sắc Beauty Spa (Xanh ngọc/vàng gold)';
    case 'industrial_cleaning':
      return 'Đã cập nhật màu sắc Industrial Cleaning (Xanh dương sạch)';
    case 'real_estate':
      return 'Đã cập nhật màu sắc Real Estate (Navy/vàng gold)';
    default:
      return 'Đã cập nhật màu sắc giao diện';
  }
}
