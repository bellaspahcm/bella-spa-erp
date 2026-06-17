/**
 * Spa Package Management Service
 * 
 * Facade/wrapper for spa-specific package management logic.
 * This module provides a spa-domain interface for package operations,
 * session multipliers, and package categories.
 * 
 * @module spa/services/package
 * @see src/services/package-actions - Core package management
 */

// Re-export core package actions
export {
  createPackage,
  updatePackage,
  deletePackage,
  getPackages,
  type PackageActionInput,
} from '@/services/package-actions';

import type { CoreServiceCatalogItem } from '@/core/types';

/**
 * Package session multipliers based on tier.
 * 
 * - Basic (Tiết Kiệm): 1.0x
 * - Premium (Hạnh Phúc): 1.5x
 * - VIP (Toàn Diện): 2.0x
 */
export const PACKAGE_SESSION_MULTIPLIERS = {
  basic: 1.0,
  premium: 1.5,
  vip: 2.0,
} as const;

export type PackageCategory = keyof typeof PACKAGE_SESSION_MULTIPLIERS;

/**
 * Get package session multiplier from package name or category.
 * 
 * @param packageNameOrCategory - Package name or category
 * @returns Session multiplier (1.0, 1.5, or 2.0)
 * 
 * @example
 * ```ts
 * getPackageMultiplier('Combo Mẹ & Bé Tiết Kiệm') // Returns 1.0
 * getPackageMultiplier('Combo Mẹ & Bé Hạnh Phúc') // Returns 1.5
 * getPackageMultiplier('Combo Mẹ & Bé VIP Toàn Diện') // Returns 2.0
 * getPackageMultiplier('vip') // Returns 2.0
 * ```
 */
export function getPackageMultiplier(packageNameOrCategory: string): number {
  const normalized = packageNameOrCategory.toLowerCase();

  if (normalized.includes('vip') || normalized.includes('toàn diện')) {
    return PACKAGE_SESSION_MULTIPLIERS.vip;
  }

  if (normalized.includes('hạnh phúc') || normalized.includes('premium')) {
    return PACKAGE_SESSION_MULTIPLIERS.premium;
  }

  // Default: basic tier
  return PACKAGE_SESSION_MULTIPLIERS.basic;
}

/**
 * Determine package category from package name.
 * 
 * @param packageName - Package name
 * @returns Package category
 */
export function getPackageCategory(packageName: string): PackageCategory {
  const normalized = packageName.toLowerCase();

  if (normalized.includes('vip') || normalized.includes('toàn diện')) {
    return 'vip';
  }

  if (normalized.includes('hạnh phúc') || normalized.includes('premium')) {
    return 'premium';
  }

  return 'basic';
}

/**
 * Calculate effective session count with multiplier applied.
 * 
 * @param baseSessionCount - Base number of sessions
 * @param packageNameOrCategory - Package name or category
 * @returns Weighted session count
 * 
 * @example
 * ```ts
 * calculateEffectiveSessions(10, 'Combo Mẹ & Bé Tiết Kiệm') // Returns 10.0
 * calculateEffectiveSessions(10, 'Combo Mẹ & Bé Hạnh Phúc') // Returns 15.0
 * calculateEffectiveSessions(10, 'Combo Mẹ & Bé VIP Toàn Diện') // Returns 20.0
 * ```
 */
export function calculateEffectiveSessions(
  baseSessionCount: number,
  packageNameOrCategory: string
): number {
  const multiplier = getPackageMultiplier(packageNameOrCategory);
  return baseSessionCount * multiplier;
}

/**
 * Extract spa-specific package metadata from CoreServiceCatalogItem.
 * 
 * @param item - Core service catalog item
 * @returns Spa package metadata
 */
export function extractSpaPackageMetadata(item: CoreServiceCatalogItem): {
  totalSessions: number;
  sessionMultiplier: number;
  category: PackageCategory;
  durationMinutes: number;
} {
  return {
    totalSessions: (item.metadata.total_sessions as number) || 0,
    sessionMultiplier: (item.metadata.session_multiplier as number) || 1.0,
    category: getPackageCategory(item.name),
    durationMinutes: (item.metadata.duration_minutes as number) || 60,
  };
}

/**
 * Spa package service facade.
 * 
 * This facade establishes the module boundary for spa-specific package operations.
 * All spa components should import from this module for package management.
 * 
 * @example
 * ```ts
 * import { SpaPackageService } from '@/modules/spa/services/package';
 * 
 * // Get package multiplier
 * const multiplier = SpaPackageService.getMultiplier('Combo Mẹ & Bé VIP');
 * 
 * // Calculate effective sessions
 * const effectiveSessions = SpaPackageService.calculateEffectiveSessions(10, 'vip');
 * ```
 */
export const SpaPackageService = {
  getMultiplier: getPackageMultiplier,
  getCategory: getPackageCategory,
  calculateEffectiveSessions,
  extractMetadata: extractSpaPackageMetadata,
  MULTIPLIERS: PACKAGE_SESSION_MULTIPLIERS,
} as const;
