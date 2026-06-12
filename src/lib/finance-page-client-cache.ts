'use client';

import { getFinanceDashboardSnapshot } from '@/services/finance-actions';

type FinanceDashboardSnapshotResult = Awaited<ReturnType<typeof getFinanceDashboardSnapshot>>;

function createClientCache<T>(loader: () => Promise<T>) {
  let loaded = false;
  let cache: T | null = null;
  let promise: Promise<T> | null = null;
  let requestVersion = 0;

  return function getCached(options: { force?: boolean } = {}) {
    if (!options.force && loaded) {
      return Promise.resolve(cache as T);
    }

    if (!options.force && promise) {
      return promise;
    }

    const currentVersion = requestVersion + 1;
    requestVersion = currentVersion;
    promise = loader()
      .then((result) => {
        if (currentVersion === requestVersion) {
          cache = result;
          loaded = true;
        }
        return result;
      })
      .finally(() => {
        if (currentVersion === requestVersion) {
          promise = null;
        }
      });

    return promise;
  };
}

const snapshotCaches = new Map<string, ReturnType<typeof createClientCache<FinanceDashboardSnapshotResult>>>();

export function getCachedFinanceDashboardSnapshot(month: string, options: { force?: boolean } = {}) {
  let cache = snapshotCaches.get(month);
  if (!cache) {
    cache = createClientCache(() => getFinanceDashboardSnapshot(month));
    snapshotCaches.set(month, cache);
  }

  return cache(options);
}
