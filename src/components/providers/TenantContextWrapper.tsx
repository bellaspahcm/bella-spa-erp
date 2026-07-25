'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { TenantContextProvider } from '@/core/providers/TenantContextProvider';

/**
 * Auth/Public routes that should NOT load tenant context
 * 
 * These pages work without authentication and should not trigger
 * the tenant context fetch (which would redirect to /login creating a loop)
 */
const PUBLIC_ROUTES = [
  '/login',
  '/login-static',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/', // Landing page
  '/book', // Public booking page
  '/beauty-spa', // Public marketing page
  '/bellaspa', // Public Bella Spa page
  '/portal', // Public customer portal links
];

/**
 * Wrapper that conditionally applies TenantContextProvider
 * 
 * - Public/Auth pages: Children rendered directly (no tenant context)
 * - Protected pages: Children wrapped in TenantContextProvider
 * 
 * This prevents infinite redirect loops on login page:
 * 1. User goes to /login (not authenticated)
 * 2. WITHOUT this wrapper: TenantContextProvider fetches /api/tenant/context
 * 3. API returns 401, TenantContextProvider redirects to /login
 * 4. Loop repeats infinitely
 * 
 * WITH this wrapper:
 * 1. User goes to /login
 * 2. Wrapper detects /login is a public route
 * 3. Children rendered directly, no tenant fetch, no redirect
 * 4. User can see login form
 */
export default function TenantContextWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => {
    if (route === pathname) return true;
    // Support sub-paths like /login/oauth/callback
    if (pathname?.startsWith(route + '/')) return true;
    return false;
  });

  // For public routes, render children directly without tenant context
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // For protected routes, wrap with TenantContextProvider
  return (
    <TenantContextProvider>
      {children}
    </TenantContextProvider>
  );
}
