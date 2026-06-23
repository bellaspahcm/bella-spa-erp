/**
 * TenantContext v2 - Week 2
 * 
 * Changes from v1:
 * 1. AsyncStorage cache with stale-while-revalidate
 * 2. Fixed dependency: [auth.status, tenantId] instead of [auth.status]
 * 3. Expose stale flag to UI
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import {
  fetchTenantContext,
  type TenantContext,
} from '../services/tenant/fetchTenantContext';

// ── Cache Configuration ──────────────────────────────────────────────────
const TENANT_CACHE_PREFIX = 'bella.tenant.v1.';
const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

interface CachedTenant {
  tenant: TenantContext;
  cachedAt: number;
}

async function readTenantCache(
  tenantId: string,
): Promise<TenantContext | null> {
  try {
    const raw = await AsyncStorage.getItem(TENANT_CACHE_PREFIX + tenantId);
    if (!raw) return null;
    const parsed: CachedTenant = JSON.parse(raw);
    // Check if cache expired
    if (Date.now() - parsed.cachedAt > CACHE_MAX_AGE_MS) return null;
    return parsed.tenant;
  } catch {
    return null;
  }
}

async function writeTenantCache(tenant: TenantContext) {
  try {
    const payload: CachedTenant = {
      tenant,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(
      TENANT_CACHE_PREFIX + tenant.id,
      JSON.stringify(payload),
    );
  } catch {
    // Non-critical - ignore if AsyncStorage is full
  }
}

// ── Context State ────────────────────────────────────────────────────────
type TenantState =
  | { status: 'loading' }
  | { status: 'loaded'; tenant: TenantContext; stale: boolean }
  | { status: 'error'; error: string }
  | { status: 'none' };

const TenantCtx = createContext<TenantState>({ status: 'loading' });

// ── Provider ─────────────────────────────────────────────────────────────
export function TenantProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [state, setState] = useState<TenantState>({ status: 'loading' });

  // Extract tenantId safely
  const tenantId =
    auth.status === 'authenticated' ? auth.user.tenant_id ?? null : null;

  // Use ref to avoid stale closure in async callback
  const tenantIdRef = useRef(tenantId);
  tenantIdRef.current = tenantId;

  useEffect(() => {
    // ── Case 1: No session or no tenant_id ──────────────────────────────
    if (auth.status !== 'authenticated' || !tenantId) {
      setState({ status: 'none' });
      return;
    }

    let cancelled = false;

    async function load() {
      // ── Step 1: Render immediately from cache if available ────────────
      const cached = await readTenantCache(tenantId!);
      if (cached && !cancelled) {
        setState({ status: 'loaded', tenant: cached, stale: true });
      } else if (!cancelled) {
        setState({ status: 'loading' });
      }

      // ── Step 2: Fetch fresh data from DB (background if cached) ───────
      const result = await fetchTenantContext(tenantId!);

      // Check if tenant changed during fetch
      if (cancelled || tenantIdRef.current !== tenantId) return;

      if (result.ok) {
        await writeTenantCache(result.tenant);
        setState({ status: 'loaded', tenant: result.tenant, stale: false });
      } else {
        // If cached data exists, keep it and just log warning
        if (cached) {
          console.warn(
            '[TenantContext] Background refresh failed, serving stale cache:',
            result.error,
          );
          setState({ status: 'loaded', tenant: cached, stale: true });
        } else {
          setState({ status: 'error', error: result.error });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };

    // ── FIX: Correct dependency array ─────────────────────────────────
    // auth.status changes: loading → authenticated (need to load)
    // tenantId changes: switch tenant (need to reload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, tenantId]);

  return <TenantCtx.Provider value={state}>{children}</TenantCtx.Provider>;
}

export function useTenant() {
  return useContext(TenantCtx);
}

/**
 * Stale-while-revalidate flow:
 * 
 * App open
 *   ↓ Read AsyncStorage (fast, synchronous-ish)
 *   ↓ Render immediately with cache (stale: true)
 *   ↓ Fetch from DB in background
 *   ↓ Update with fresh data (stale: false)
 * 
 * User sees tenant name instantly - no loading flash
 */
