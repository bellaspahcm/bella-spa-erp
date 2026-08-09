import type { SubscriptionPlan } from './tenant';
import type { ModuleId } from './module';

/**
 * Feature flag configuration controlling optional system functionality.
 * 
 * @remarks
 * Feature flags enable/disable features based on:
 * - Subscription plan tier
 * - Enabled modules
 * - Custom tenant configuration
 * 
 * @example
 * ```typescript
 * const flag: FeatureFlag = {
 *   key: 'ai_salary_reconciliation',
 *   enabled: true,
 *   requiredPlan: ['professional', 'enterprise'],
 *   requiredModules: ['spa'],
 *   metadata: {
 *     betaFeature: true,
 *     documentationUrl: 'https://docs.example.com/ai-salary',
 *   },
 * };
 * ```
 */
export interface FeatureFlag {
  /** Unique identifier for this feature (kebab-case recommended) */
  key: string;
  
  /** Whether this feature is currently enabled for the tenant */
  enabled: boolean;
  
  /** Subscription plans that unlock this feature (if undefined, available to all plans) */
  requiredPlan?: readonly SubscriptionPlan[];
  
  /** Modules required for this feature (if undefined, no module dependency) */
  requiredModules?: readonly ModuleId[];
  
  /** 
   * Additional feature configuration or metadata.
   * 
   * @remarks
   * Store feature-specific configuration and documentation references.
   * 
   * **Common fields**:
   * - `betaFeature: boolean` - Whether this is a beta/experimental feature
   * - `documentationUrl: string` - Link to feature documentation
   * - `releaseDate: string` - When feature was released (ISO 8601 date)
   * - `deprecationDate: string` - Planned deprecation date (if applicable)
   * 
   * **Usage tracking**:
   * - `usageQuota: number` - Maximum usage allowed per month
   * - `usageCount: number` - Current usage count
   * - `resetDate: string` - When usage count resets
   * 
   * **Access control**:
   * - `allowedRoles: string[]` - User roles that can access this feature
   * - `allowedUserIds: string[]` - Specific users with access
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Check if a feature is accessible given tenant context.
 * 
 * @param flag - Feature flag to evaluate
 * @param context - Tenant context
 * @returns True if feature is enabled and tenant meets requirements
 * 
 * @example
 * ```typescript
 * const canUseAI = isFeatureEnabled(aiSalaryFlag, tenantContext);
 * if (canUseAI) {
 *   // Show AI salary reconciliation UI
 * }
 * ```
 */
export function isFeatureEnabled(flag: FeatureFlag, context: import('./tenant').TenantContext): boolean {
  if (!flag.enabled) return false;
  
  // Check plan requirement
  if (flag.requiredPlan && !flag.requiredPlan.includes(context.subscriptionPlan)) {
    return false;
  }
  
  // Check module requirement
  if (flag.requiredModules) {
    const hasAllModules = flag.requiredModules.every(mod => 
      context.enabledModules.includes(mod)
    );
    if (!hasAllModules) return false;
  }
  
  return true;
}
