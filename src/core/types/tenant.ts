import type { ModuleId } from './module';

/**
 * Subscription plan tiers that determine feature access and quotas.
 * 
 * @remarks
 * - `free`: Limited features, single user, demo data
 * - `basic`: Core features, up to 5 users
 * - `professional`: Advanced features, up to 20 users, API access
 * - `enterprise`: All features, unlimited users, dedicated support
 */
export type SubscriptionPlan = 'free' | 'basic' | 'professional' | 'enterprise';

/**
 * Tenant context object containing configuration and entitlements.
 * 
 * @remarks
 * This context should be constructed once per request (in middleware or server action)
 * and passed to core platform services. It encapsulates tenant-specific settings
 * without requiring database queries in every service function.
 * 
 * **Immutability**: Services must NOT mutate this context. Treat as readonly.
 * 
 * **Serialization**: Safe to pass between server actions and RSC boundaries.
 * Avoid storing functions or class instances in settings/featureFlags.
 * 
 * @example
 * ```typescript
 * const context: TenantContext = {
 *   tenantId: 'uuid-here',
 *   tenantName: 'Bella Spa Hanoi',
 *   enabledModules: ['spa', 'babycare'],
 *   subscriptionPlan: 'professional',
 *   featureFlags: {
 *     'ai_salary_reconciliation': true,
 *     'inventory_transfer': true,
 *     'meta_ads_integration': false,
 *   },
 *   settings: {
 *     currency: 'VND',
 *     timezone: 'Asia/Ho_Chi_Minh',
 *     locale: 'vi-VN',
 *   },
 * };
 * ```
 */
export interface TenantContext {
  /** Unique tenant identifier (UUID from tenants table) */
  readonly tenantId: string;
  
  /** Human-readable tenant name for display purposes */
  readonly tenantName: string;
  
  /** List of enabled industry modules for this tenant */
  readonly enabledModules: readonly ModuleId[];
  
  /** Current subscription plan tier */
  readonly subscriptionPlan: SubscriptionPlan;
  
  /** Feature flags controlling optional functionality */
  readonly featureFlags: Readonly<Record<string, boolean>>;
  
  /** 
   * Tenant-specific configuration settings.
   * 
   * @remarks
   * Store tenant preferences and configuration that don't fit in other fields.
   * 
   * **Common settings**:
   * - `currency: string` - ISO 4217 currency code (e.g., 'VND', 'USD')
   * - `timezone: string` - IANA timezone (e.g., 'Asia/Ho_Chi_Minh')
   * - `locale: string` - Language/locale code (e.g., 'vi-VN', 'en-US')
   * - `dateFormat: string` - Preferred date format (e.g., 'DD/MM/YYYY')
   * - `businessHours: object` - Operating hours configuration
   * 
   * **Branding settings**:
   * - `logoUrl: string` - Tenant logo URL
   * - `primaryColor: string` - Brand primary color
   * - `companyName: string` - Legal company name
   * 
   * **Operational settings**:
   * - `autoApprovalThreshold: number` - Auto-approve payments below this amount
   * - `inventoryAlertThreshold: number` - Stock level to trigger alerts
   * - `defaultTaxRate: number` - Default tax rate for invoices
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly settings: Readonly<Record<string, any>>;
}

/**
 * Type guard to validate TenantContext structure at runtime.
 * 
 * @param value - Value to check
 * @returns True if value is a valid TenantContext
 * 
 * @example
 * ```typescript
 * if (isTenantContext(req.context)) {
 *   // TypeScript now knows req.context is TenantContext
 *   console.log(req.context.tenantId);
 * }
 * ```
 */
export function isTenantContext(value: unknown): value is TenantContext {
  if (typeof value !== 'object' || value === null) return false;
  const ctx = value as Record<string, unknown>;
  return (
    typeof ctx.tenantId === 'string' &&
    typeof ctx.tenantName === 'string' &&
    Array.isArray(ctx.enabledModules) &&
    typeof ctx.subscriptionPlan === 'string' &&
    typeof ctx.featureFlags === 'object' &&
    typeof ctx.settings === 'object'
  );
}
