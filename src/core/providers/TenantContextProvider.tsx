'use client';

import { useEffect, useState, ReactNode } from 'react';
import type { TenantContext } from '@/core/types/tenant';
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
          console.warn('[TenantContextProvider] User not authenticated, redirecting to login');
          window.location.href = '/login';
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
          const msg = errorData.error || `HTTP ${response.status}: ${response.statusText}`;

          // In development mode, fallback to default tenant context if backend authentication is transient
          if (process.env.NODE_ENV === 'development') {
            console.warn('[TenantContextProvider] Dev fallback tenant context activated due to:', msg);
            setContext({
              tenantId: 'dev-tenant',
              tenantName: 'Bella Land (Dev)',
              enabledModules: ['real_estate', 'beauty_spa', 'cleaning'],
              subscriptionPlan: 'enterprise',
              featureFlags: {},
              settings: {},
            });
            return;
          }

          throw new Error(msg);
        }

        const data = await response.json();
        
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid tenant context response format');
        }

        setContext(data as TenantContext);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn('[TenantContextProvider] Failed to load tenant context: %s', errorMessage);
        
        if (process.env.NODE_ENV === 'development') {
          setContext({
            tenantId: 'dev-tenant',
            tenantName: 'Bella Land (Dev)',
            enabledModules: ['real_estate', 'beauty_spa', 'cleaning'],
            subscriptionPlan: 'enterprise',
            featureFlags: {},
            settings: {},
          });
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

    const enabledModules = context.enabledModules;
    console.log('[TenantContextProvider] enabledModules RAW:', enabledModules);
    console.log('[TenantContextProvider] enabledModules type:', typeof enabledModules);
    console.log('[TenantContextProvider] is Array?', Array.isArray(enabledModules));
    console.log('[TenantContextProvider] JSON.stringify:', JSON.stringify(enabledModules));
    
    let moduleKey: string = 'baby_care'; // Default fallback

    // Determine primary module key
    // CRITICAL FIX: Check object format FIRST (most common in database)
    // Database stores as JSONB object: { beauty_spa: true, babycare: false }
    if (typeof enabledModules === 'object' && enabledModules !== null && !Array.isArray(enabledModules)) {
      // Legacy JSONB object format: { beauty_spa: true, babycare: false }
      console.log('[TenantContextProvider] Processing JSONB object format (priority check)');
      
      const modules = enabledModules as any;
      if (modules.real_estate === true) {
        moduleKey = 'real_estate';
      } else if (modules.industrial_cleaning === true) {
        moduleKey = 'industrial_cleaning';
      } else if (modules.beauty_spa === true) {
        moduleKey = 'beauty_spa';
      } else if (modules.bella_auto === true) {
        moduleKey = 'bella_auto';
      } else if (modules.babycare === true || modules.spa === true) {
        moduleKey = 'baby_care';
      }
    } else if (Array.isArray(enabledModules)) {
      // API returns array of enabled module names: ['beauty_spa'] or ['babycare'] or ['industrial_cleaning'] or ['real_estate'] or ['bella_auto']
      console.log('[TenantContextProvider] Processing array format:', enabledModules);
      
      // Priority order: real_estate > industrial_cleaning > beauty_spa > bella_auto > babycare/spa
      if (enabledModules.includes('real_estate')) {
        moduleKey = 'real_estate';
      } else if (enabledModules.includes('industrial_cleaning')) {
        moduleKey = 'industrial_cleaning';
      } else if (enabledModules.includes('beauty_spa')) {
        moduleKey = 'beauty_spa';
      } else if (enabledModules.includes('bella_auto')) {
        moduleKey = 'bella_auto';
      } else if (enabledModules.includes('babycare') || enabledModules.includes('spa')) {
        moduleKey = 'baby_care';
      }
    }

    // Set data-tenant-module attribute on <html> element
    document.documentElement.dataset.tenantModule = moduleKey;
    console.log('[TenantContextProvider] ✅ Applied module theme:', moduleKey);
    console.log('[TenantContextProvider] ✅ HTML data-tenant-module:', document.documentElement.dataset.tenantModule);

    // Update theme-color meta tag
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      const themeColors: Record<string, string> = {
        baby_care: '#FDF2F8',
        beauty_spa: '#F0FDF4',
        industrial_cleaning: '#F8FAFC',
        real_estate: '#FFFBEB',
        bella_auto: '#F0F9FF',
      };
      themeMeta.setAttribute('content', themeColors[moduleKey] || themeColors.baby_care);
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
