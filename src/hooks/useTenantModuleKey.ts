'use client';

import { useCallback, useEffect, useState } from 'react';

import { getDefaultTenantModuleKey, type TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { getCachedTenantSettings } from '@/lib/dashboard-client-context';

const RUNTIME_BRAND_CACHE_KEY = 'bella.runtime.brand.v1';
const SIDEBAR_BRAND_CACHE_KEY = 'bella.sidebar.brand.v2';

function getSynchronousModuleKey(): TenantModuleKey | null {
  if (typeof window === 'undefined') return null;
  try {
    const runtimeSession = window.sessionStorage.getItem(RUNTIME_BRAND_CACHE_KEY);
    if (runtimeSession) {
      const parsed = JSON.parse(runtimeSession);
      if (parsed && typeof parsed.moduleKey === 'string') {
        return parsed.moduleKey as TenantModuleKey;
      }
    }
  } catch (e) {
    // Ignore
  }
  try {
    const sidebarLocal = window.localStorage.getItem(SIDEBAR_BRAND_CACHE_KEY);
    if (sidebarLocal) {
      const parsed = JSON.parse(sidebarLocal);
      if (parsed && typeof parsed.moduleKey === 'string') {
        return parsed.moduleKey as TenantModuleKey;
      }
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

export function useTenantModuleKey(options?: { forceFresh?: boolean }) {
  const forceFresh = options?.forceFresh ?? false;
  const [tenantModuleKey, setTenantModuleKey] = useState<TenantModuleKey | null>(() =>
    forceFresh ? null : getSynchronousModuleKey()
  );
  const [isTenantModuleLoading, setIsTenantModuleLoading] = useState(() =>
    forceFresh ? true : !getSynchronousModuleKey()
  );
  const [tenantModuleError, setTenantModuleError] = useState<string | null>(null);

  const refreshTenantModuleKey = useCallback(async () => {
    const initialKey = getSynchronousModuleKey();
    if (!initialKey) {
      setIsTenantModuleLoading(true);
    }
    setTenantModuleError(null);

    try {
      const tenant = await getCachedTenantSettings();
      const resolved = getDefaultTenantModuleKey(tenant?.enabled_modules);
      setTenantModuleKey(resolved);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Khong the tai cau hinh phan he';
      setTenantModuleError(message);
      if (!initialKey) {
        setTenantModuleKey(null);
      }
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
