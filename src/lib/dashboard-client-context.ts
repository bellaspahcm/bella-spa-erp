'use client';

import { getTenantSettings } from '@/services/tenant-actions';
import { getCurrentUser } from '@/services/user-actions';

type CurrentUserResult = Awaited<ReturnType<typeof getCurrentUser>>;
type TenantSettingsResult = Awaited<ReturnType<typeof getTenantSettings>>;

// ── Cache TTL ────────────────────────────────────────────────────────────────
// Serve from memory for up to 5 minutes.  After that the next caller triggers
// a silent background refresh so the UI never blocks on stale data.
const USER_CACHE_TTL_MS    = 5 * 60 * 1000; // 5 minutes
const TENANT_CACHE_TTL_MS  = 5 * 60 * 1000; // 5 minutes

let currentUserLoaded = false;
let currentUserCache: CurrentUserResult = null;
let currentUserPromise: Promise<CurrentUserResult> | null = null;
let currentUserRequestVersion = 0;
let currentUserCachedAt = 0;

let tenantSettingsLoaded = false;
let tenantSettingsCache: TenantSettingsResult = null;
let tenantSettingsPromise: Promise<TenantSettingsResult> | null = null;
let tenantSettingsRequestVersion = 0;
let tenantSettingsCachedAt = 0;

export function clearDashboardClientContextCache() {
  currentUserRequestVersion += 1;
  currentUserLoaded = false;
  currentUserCache = null;
  currentUserPromise = null;
  currentUserCachedAt = 0;

  tenantSettingsRequestVersion += 1;
  tenantSettingsLoaded = false;
  tenantSettingsCache = null;
  tenantSettingsPromise = null;
  tenantSettingsCachedAt = 0;
}

export function getCachedCurrentUser(options: { force?: boolean } = {}) {
  const now = Date.now();
  const isFresh = currentUserLoaded && (now - currentUserCachedAt) < USER_CACHE_TTL_MS;

  if (!options.force && isFresh) {
    return Promise.resolve(currentUserCache);
  }

  if (!options.force && currentUserPromise) {
    return currentUserPromise;
  }

  const requestVersion = currentUserRequestVersion + 1;
  currentUserRequestVersion = requestVersion;
  currentUserPromise = getCurrentUser()
    .then((user) => {
      if (requestVersion === currentUserRequestVersion) {
        currentUserCache = user;
        currentUserLoaded = true;
        currentUserCachedAt = Date.now();
      }
      return user;
    })
    .finally(() => {
      if (requestVersion === currentUserRequestVersion) {
        currentUserPromise = null;
      }
    });

  return currentUserPromise;
}

export function getCachedTenantSettings(options: { force?: boolean } = {}) {
  const now = Date.now();
  const isFresh = tenantSettingsLoaded && (now - tenantSettingsCachedAt) < TENANT_CACHE_TTL_MS;

  if (!options.force && isFresh) {
    return Promise.resolve(tenantSettingsCache);
  }

  if (!options.force && tenantSettingsPromise) {
    return tenantSettingsPromise;
  }

  const requestVersion = tenantSettingsRequestVersion + 1;
  tenantSettingsRequestVersion = requestVersion;
  tenantSettingsPromise = getTenantSettings()
    .then((settings) => {
      if (requestVersion === tenantSettingsRequestVersion) {
        tenantSettingsCache = settings;
        tenantSettingsLoaded = true;
        tenantSettingsCachedAt = Date.now();
      }
      return settings;
    })
    .finally(() => {
      if (requestVersion === tenantSettingsRequestVersion) {
        tenantSettingsPromise = null;
      }
    });

  return tenantSettingsPromise;
}
