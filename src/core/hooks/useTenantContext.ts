'use client';

import { useContext, createContext } from 'react';
import type { TenantContext } from '@/core/types/tenant';

/**
 * React context for TenantContext.
 * 
 * @internal
 * This context is created in TenantContextProvider and should only be
 * accessed via useTenantContext() hook.
 */
export const TenantContextContext = createContext<TenantContext | null>(null);

/**
 * React hook to access the current tenant's configuration and entitlements.
 * 
 * @remarks
 * This hook must be used within a component tree wrapped by TenantContextProvider.
 * The provider is typically added in the root layout (app/layout.tsx).
 * 
 * **Standard React Context Pattern**: This hook throws an error if called
 * outside of TenantContextProvider, following React's best practices for context usage.
 * 
 * **Use Cases**:
 * - Check enabled modules: `context.enabledModules.includes('spa')`
 * - Check feature flags: `context.featureFlags['ai_salary_reconciliation']`
 * - Get tenant settings: `context.settings.currency`
 * - Check subscription tier: `context.subscriptionPlan === 'enterprise'`
 * 
 * **Performance**: The context value is loaded once on app mount and remains
 * stable throughout the session. Re-renders only occur if user manually reloads
 * the page or logs out.
 * 
 * @throws {Error} If used outside TenantContextProvider
 * 
 * @returns The current tenant's context containing configuration and entitlements
 * 
 * @example
 * ```tsx
 * 'use client';
 * 
 * import { useTenantContext } from '@/core/hooks/useTenantContext';
 * 
 * export function MyComponent() {
 *   const context = useTenantContext();
 * 
 *   // Check if spa module is enabled
 *   if (!context.enabledModules.includes('spa')) {
 *     return <div>Spa module not available</div>;
 *   }
 * 
 *   // Check feature flag
 *   const aiEnabled = context.featureFlags['ai_salary_reconciliation'];
 * 
 *   // Get tenant settings
 *   const currency = context.settings.currency || 'VND';
 * 
 *   return (
 *     <div>
 *       <h1>{context.tenantName}</h1>
 *       <p>Plan: {context.subscriptionPlan}</p>
 *       <p>Currency: {currency}</p>
 *       {aiEnabled && <AIFeatureComponent />}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // Conditional rendering based on subscription plan
 * function PremiumFeature() {
 *   const context = useTenantContext();
 *   
 *   if (context.subscriptionPlan === 'free') {
 *     return (
 *       <div className="text-gray-500">
 *         Upgrade to access this feature
 *       </div>
 *     );
 *   }
 * 
 *   return <ActualFeatureComponent />;
 * }
 * ```
 */
export function useTenantContext(): TenantContext {
  const context = useContext(TenantContextContext);
  
  if (!context) {
    throw new Error(
      'useTenantContext must be used within TenantContextProvider. ' +
      'Ensure your component tree is wrapped with <TenantContextProvider> in the root layout.'
    );
  }
  
  return context;
}
