'use client';

import { useCallback, useEffect, useState } from 'react';

import { getDefaultTenantModuleKey, type TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { getCachedTenantSettings } from '@/lib/dashboard-client-context';

export function useTenantModuleKey() {
  const [tenantModuleKey, setTenantModuleKey] = useState<TenantModuleKey | null>(null);
  const [isTenantModuleLoading, setIsTenantModuleLoading] = useState(true);
  const [tenantModuleError, setTenantModuleError] = useState<string | null>(null);

  const refreshTenantModuleKey = useCallback(async () => {
    setIsTenantModuleLoading(true);
    setTenantModuleError(null);

    try {
      const tenant = await getCachedTenantSettings();
      setTenantModuleKey(getDefaultTenantModuleKey(tenant?.enabled_modules));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Khong the tai cau hinh phan he';
      setTenantModuleError(message);
      setTenantModuleKey(null);
    } finally {
      setIsTenantModuleLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTenantModuleKey();
  }, [refreshTenantModuleKey]);

  return {
    tenantModuleKey,
    isTenantModuleLoading,
    tenantModuleError,
    refreshTenantModuleKey,
  };
}
