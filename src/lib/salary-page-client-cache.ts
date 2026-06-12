'use client';

import { getKtvSessionMatrix } from '@/modules/hr-salary/actions/query-salary-actions';
import { getMonthlyAttendanceSummary } from '@/services/attendance-actions';

type KtvSessionMatrixResult = Awaited<ReturnType<typeof getKtvSessionMatrix>>;
type MonthlyAttendanceSummaryResult = Awaited<ReturnType<typeof getMonthlyAttendanceSummary>>;

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

export const getCachedSalarySessionMatrix = createClientCache<KtvSessionMatrixResult>(() => getKtvSessionMatrix());
export const getCachedMonthlyAttendanceSummaryForSalary =
  createKeyedClientCache<MonthlyAttendanceSummaryResult>((month) => getMonthlyAttendanceSummary(month));
