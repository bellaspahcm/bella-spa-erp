/**
 * useTenantName Hook
 * 
 * Fetches tenant name with skeleton loader support
 * Prevents FOUC (Flash of Unstyled Content) when tenant name loads
 * 
 * @example
 * ```tsx
 * const { tenantName, TenantNameSkeleton } = useTenantName();
 * 
 * return tenantName ? (
 *   <h1>Welcome to {tenantName}</h1>
 * ) : (
 *   <TenantNameSkeleton />
 * );
 * ```
 */

import { useEffect, useState } from 'react';
import { getCachedTenantSettings } from '@/lib/dashboard-client-context';

interface UseTenantNameOptions {
  /** Width of skeleton loader in pixels (default: 200) */
  skeletonWidth?: number;
  /** Custom skeleton className */
  skeletonClassName?: string;
}

export function useTenantName(options: UseTenantNameOptions = {}) {
  const { skeletonWidth = 200, skeletonClassName } = options;
  const [tenantName, setTenantName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCachedTenantSettings()
      .then((tenant) => {
        if (tenant?.name) {
          setTenantName(tenant.name);
        }
      })
      .catch((err) => {
        console.error('Error loading tenant settings:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Skeleton component with default styling
  const TenantNameSkeleton = () => (
    <div
      className={skeletonClassName || 'h-6 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse'}
      style={{ width: `${skeletonWidth}px` }}
      aria-label="Loading tenant name..."
    />
  );

  return {
    /** Tenant name (empty string while loading) */
    tenantName,
    /** Is data still loading? */
    isLoading,
    /** Skeleton loader component */
    TenantNameSkeleton,
  };
}
