'use client';

import { useEffect, useState, ReactNode } from 'react';
import type { TenantContext, SubscriptionPlan } from '@/core/types/tenant';
import { isModuleId, type ModuleId } from '@/core/types/module';
import { TenantContextContext } from '@/core/hooks/useTenantContext';

/**
 * Error message displayed when tenant configuration fails to load.
 */
const TENANT_LOAD_ERROR_MESSAGE = 'Không thể tải cấu hình chi nhánh. Vui lòng thử lại sau.';

/**
 * Loading message displayed while tenant configuration is being fetched.
 */
const TENANT_LOADING_MESSAGE = 'Đang tải cấu hình chi nhánh...';

/**
 * Validate and normalize tenant context received from API.
 *
 * @remarks
 * Network JSON cannot be trusted to match TypeScript types.
 * This function validates the response structure at the network boundary
 * and normalizes it to the canonical TenantContext contract.
 *
 * **Validation Rules:**
 * - Required fields must be present and correct type
 * - enabledModules must be validated against ModuleId discriminant
 * - Invalid modules are filtered out
 * - Safe defaults provided for missing/invalid data
 *
 * @param raw - Unknown data from network response
 * @returns Validated TenantContext or null if invalid
 */
function validateAndNormalizeTenantContext(raw: unknown): TenantContext | null {
  if (!raw || typeof raw !== 'object') return null;

  const ctx = raw as Record<string, unknown>;

  // Validate required fields
  if (typeof ctx.tenantId !== 'string' || !ctx.tenantId) return null;
  if (typeof ctx.tenantName !== 'string' || !ctx.tenantName) return null;

  // Validate and normalize enabledModules
  let modules: ModuleId[] = [];
  if (Array.isArray(ctx.enabledModules)) {
    // Filter to only valid ModuleId values using canonical type guard
    modules = ctx.enabledModules.filter(isModuleId);
  }

  // If no valid modules after filtering, use safe default
  if (modules.length === 0) {
    modules = ['babycare'];
  }

  // Validate subscription plan or use default
  const validPlans: SubscriptionPlan[] = ['free', 'basic', 'professional', 'enterprise'];
  const plan: SubscriptionPlan =
    (typeof ctx.subscriptionPlan === 'string' && validPlans.includes(ctx.subscriptionPlan as SubscriptionPlan))
      ? (ctx.subscriptionPlan as SubscriptionPlan)
      : 'basic';

  // Validate featureFlags is an object
  const flags = (ctx.featureFlags && typeof ctx.featureFlags === 'object' && !Array.isArray(ctx.featureFlags))
    ? ctx.featureFlags as Record<string, boolean>
    : {};

  // Validate settings is an object
  const settings = (ctx.settings && typeof ctx.settings === 'object' && !Array.isArray(ctx.settings))
    ? ctx.settings as Record<string, unknown>
    : {};

  return {
    tenantId: ctx.tenantId,
    tenantName: ctx.tenantName,
    enabledModules: modules as readonly ModuleId[],
    subscriptionPlan: plan,
    featureFlags: flags,
    settings: settings,
  };
}

/**
 * Provider component that loads tenant configuration and makes it available
 * to all child components via useTenantContext() hook.
 *
 * @remarks
 * This provider should wrap the entire application in the root layout.
 * It fetches tenant configuration from the `/api/tenant/context` endpoint
 * on mount and handles loading and error states.
 *
 * **Loading State**: Displays a loading message while fetching tenant data.
 *
 * **Error State**: Displays an error message if tenant fetch fails.
 * Users cannot proceed without valid tenant context.
 *
 * **Success State**: Once loaded, tenant context is available to all
 * child components via useTenantContext() hook.
 *
 * @example
 * ```tsx
 * // In app/layout.tsx
 * export default function RootLayout({ children }: { children: ReactNode }) {
 *   return (
 *     <html>
 *       <body>
 *         <TenantContextProvider>
 *           {children}
 *         </TenantContextProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to tenant context
 */
function getDevFallbackContext(): TenantContext {
  let moduleKey: ModuleId = 'bella_healthcare';
  let name = 'Bella Medical Clinic (Dev)';

  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/dashboard/real-estate')) {
      moduleKey = 'real_estate';
      name = 'Bella Land (Dev)';
    } else if (path.startsWith('/dashboard/bella-auto')) {
      moduleKey = 'bella_auto';
      name = 'Bella Auto (Dev)';
    } else if (path.startsWith('/dashboard/hospital')) {
      moduleKey = 'bella_healthcare';
      name = 'Bella General Hospital (Dev)';
    } else if (path.startsWith('/dashboard/medical') || path.startsWith('/dashboard/healthcare') || path.startsWith('/dashboard/dental')) {
      moduleKey = 'bella_healthcare';
      name = 'Bella Medical Clinic (Dev)';
    }
  }

  return {
    tenantId: 'dev-tenant',
    tenantName: name,
    enabledModules: [moduleKey, 'bella_healthcare', 'bella_auto', 'real_estate', 'beauty_spa', 'cleaning'],
    subscriptionPlan: 'enterprise',
    featureFlags: {},
    settings: {},
  };
}

export function TenantContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTenantContext() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/tenant/context', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
        });

        // 1. If 401 Unauthorized, redirect to login page gracefully
        if (response.status === 401) {
          // In development, use dev fallback context instead of redirecting
          if (process.env.NODE_ENV === 'development') {
            console.info('[TenantContextProvider] Dev mode: Using fallback tenant context');
            setContext(getDevFallbackContext());
            setLoading(false);
            return;
          }

          // Production: redirect to login
          window.location.href = '/login';
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
          const msg = errorData.error || `HTTP ${response.status}: ${response.statusText}`;

          // In development mode, fallback to default tenant context if backend authentication is transient
          if (process.env.NODE_ENV === 'development') {
            console.info('[TenantContextProvider] Dev fallback tenant context activated due to:', msg);
            setContext(getDevFallbackContext());
            return;
          }

          throw new Error(msg);
        }

        const data = await response.json();

        // CRITICAL FIX (2026-09-01): Validate API response at network boundary
        // Cannot trust network JSON matches TypeScript types - must validate at runtime
        const validated = validateAndNormalizeTenantContext(data);

        if (!validated) {
          throw new Error('Invalid tenant context response format');
        }

        setContext(validated);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (process.env.NODE_ENV === 'development') {
          setContext(getDevFallbackContext());
        } else {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    }

    loadTenantContext();
  }, []);

  // Apply tenant module theme to <html> element when context loads
  useEffect(() => {
    if (!context) return;

    // CRITICAL FIX (2026-09-01): Simplified theme detection
    // enabledModules is now validated as readonly ModuleId[] by validateAndNormalizeTenantContext
    // No need for defensive object handling - trust the validated contract

    let moduleKey: ModuleId = 'babycare'; // Default fallback

    // Determine module from URL path first
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/dashboard/hospital')) {
        moduleKey = 'bella_healthcare';
      } else if (path.startsWith('/dashboard/medical') || path.startsWith('/dashboard/healthcare') || path.startsWith('/dashboard/dental')) {
        moduleKey = 'bella_healthcare';
      } else if (path.startsWith('/dashboard/real-estate')) {
        moduleKey = 'real_estate';
      } else if (path.startsWith('/dashboard/bella-auto')) {
        moduleKey = 'bella_auto';
      } else if (context.enabledModules.length > 0) {
        // Use first enabled module as theme if no path match
        // Priority order: healthcare > real_estate > auto > spa > others
        if (context.enabledModules.includes('bella_healthcare')) {
          moduleKey = 'bella_healthcare';
        } else if (context.enabledModules.includes('real_estate')) {
          moduleKey = 'real_estate';
        } else if (context.enabledModules.includes('bella_auto')) {
          moduleKey = 'bella_auto';
        } else if (context.enabledModules.includes('industrial_cleaning')) {
          moduleKey = 'industrial_cleaning';
        } else if (context.enabledModules.includes('beauty_spa')) {
          moduleKey = 'beauty_spa';
        } else if (context.enabledModules.includes('babycare') || context.enabledModules.includes('spa')) {
          moduleKey = 'babycare';
        } else {
          // Use first enabled module
          moduleKey = context.enabledModules[0];
        }
      }
    }

    document.documentElement.dataset.tenantModule = moduleKey;
    console.log('[TenantContextProvider] ✅ Applied module theme:', moduleKey);
    console.log('[TenantContextProvider] ✅ HTML data-tenant-module:', document.documentElement.dataset.tenantModule);

    // Update theme-color meta tag
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      const themeColors: Record<string, string> = {
        babycare: '#FDF2F8',
        beauty_spa: '#F0FDF4',
        industrial_cleaning: '#F8FAFC',
        real_estate: '#FFFBEB',
        bella_auto: '#F0F9FF',
        bella_healthcare: '#ECFEFF',
      };
      themeMeta.setAttribute('content', themeColors[moduleKey] || themeColors.babycare);
    }
  }, [context]);

  // Show loading state while fetching tenant configuration
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">{TENANT_LOADING_MESSAGE}</p>
        </div>
      </div>
    );
  }

  // Show error state if tenant configuration failed to load
  if (error || !context) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-6 bg-red-50 border border-red-200 rounded-lg">
          <svg
            className="w-12 h-12 text-red-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Lỗi tải cấu hình
          </h2>
          <p className="text-red-600 mb-4">
            {error || TENANT_LOAD_ERROR_MESSAGE}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // Provide tenant context to all child components
  return (
    <TenantContextContext.Provider value={context}>
      {children}
    </TenantContextContext.Provider>
  );
}
