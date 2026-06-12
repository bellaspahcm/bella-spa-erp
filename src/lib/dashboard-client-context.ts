'use client';

import { getTenantSettings } from '@/services/tenant-actions';
import { getCurrentUser } from '@/services/user-actions';

type CurrentUserResult = Awaited<ReturnType<typeof getCurrentUser>>;
type TenantSettingsResult = Awaited<ReturnType<typeof getTenantSettings>>;

let currentUserLoaded = false;
let currentUserCache: CurrentUserResult = null;
let currentUserPromise: Promise<CurrentUserResult> | null = null;
let currentUserRequestVersion = 0;

let tenantSettingsLoaded = false;
let tenantSettingsCache: TenantSettingsResult = null;
let tenantSettingsPromise: Promise<TenantSettingsResult> | null = null;
let tenantSettingsRequestVersion = 0;

export function clearDashboardClientContextCache() {
  currentUserRequestVersion += 1;
  currentUserLoaded = false;
  currentUserCache = null;
  currentUserPromise = null;

  tenantSettingsRequestVersion += 1;
  tenantSettingsLoaded = false;
  tenantSettingsCache = null;
  tenantSettingsPromise = null;
}

export function getCachedCurrentUser(options: { force?: boolean } = {}) {
  if (!options.force && currentUserLoaded) {
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
  if (!options.force && tenantSettingsLoaded) {
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
