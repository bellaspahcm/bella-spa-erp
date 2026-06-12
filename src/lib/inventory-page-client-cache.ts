'use client';

import {
  getInventoryItems,
  getInventoryLogs,
  getMonthlyReconciliation,
} from '@/services/inventory-actions';
import { getInventoryTransferOrdersResult } from '@/services/inventory-transfer-actions';

type InventoryItemsResult = Awaited<ReturnType<typeof getInventoryItems>>;
type InventoryLogsResult = Awaited<ReturnType<typeof getInventoryLogs>>;
type InventoryTransferOrdersResult = Awaited<ReturnType<typeof getInventoryTransferOrdersResult>>;
type MonthlyReconciliationResult = Awaited<ReturnType<typeof getMonthlyReconciliation>>;

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

function createKeyedClientCache<T>(loader: (key: string) => Promise<T>) {
  const caches = new Map<string, ReturnType<typeof createClientCache<T>>>();

  return function getCached(key: string, options: { force?: boolean } = {}) {
    let cache = caches.get(key);
    if (!cache) {
      cache = createClientCache(() => loader(key));
      caches.set(key, cache);
    }
    return cache(options);
  };
}

export const getCachedInventoryItemsForPage = createClientCache<InventoryItemsResult>(() => getInventoryItems());
export const getCachedInventoryTransferOrdersForPage = createClientCache<InventoryTransferOrdersResult>(() =>
  getInventoryTransferOrdersResult(),
);

export const getCachedInventoryLogsForPage = createKeyedClientCache<InventoryLogsResult>((key) => {
  const limit = Number(key);
  return getInventoryLogs(Number.isFinite(limit) && limit > 0 ? limit : 200);
});

export const getCachedMonthlyReconciliationForPage = createKeyedClientCache<MonthlyReconciliationResult>((key) => {
  const [year, month] = key.split('-').map(Number);
  return getMonthlyReconciliation(year, month);
});
