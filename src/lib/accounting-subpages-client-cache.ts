'use client';

import {
  getAccountingHealthSummary,
  getBalanceSheetReport,
  getJournalEntries,
  getReconciliationReport,
  getSalaryReconciliationReport,
} from '@/services/accounting-actions';
import { getFinancialOverview } from '@/services/finance-actions';

type AccountingOverviewSnapshot = {
  balanceSheet: Awaited<ReturnType<typeof getBalanceSheetReport>> | null;
  financialOverview: Awaited<ReturnType<typeof getFinancialOverview>> | null;
  healthSummary: Awaited<ReturnType<typeof getAccountingHealthSummary>> | null;
  errors: {
    balanceSheet?: string;
    financialOverview?: string;
    healthSummary?: string;
  };
};

type JournalFilters = NonNullable<Parameters<typeof getJournalEntries>[0]>;
type JournalEntriesResult = Awaited<ReturnType<typeof getJournalEntries>>;
type ReconciliationReportResult = Awaited<ReturnType<typeof getReconciliationReport>>;
type SalaryReconciliationReportResult = Awaited<ReturnType<typeof getSalaryReconciliationReport>>;

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

function messageFromUnknown(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function stableJson(value: Record<string, unknown>) {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = value[key];
  }
  return JSON.stringify(sorted);
}

const getCachedAccountingOverviewByDate = createKeyedClientCache<AccountingOverviewSnapshot>(async (asOfDate) => {
  const [bsRes, finRes, healthRes] = await Promise.allSettled([
    getBalanceSheetReport(asOfDate),
    getFinancialOverview(),
    getAccountingHealthSummary(),
  ]);

  return {
    balanceSheet: bsRes.status === 'fulfilled' ? bsRes.value : null,
    financialOverview: finRes.status === 'fulfilled' ? finRes.value : null,
    healthSummary: healthRes.status === 'fulfilled' ? healthRes.value : null,
    errors: {
      balanceSheet: bsRes.status === 'rejected' ? messageFromUnknown(bsRes.reason) : undefined,
      financialOverview: finRes.status === 'rejected' ? messageFromUnknown(finRes.reason) : undefined,
      healthSummary: healthRes.status === 'rejected' ? messageFromUnknown(healthRes.reason) : undefined,
    },
  };
});

export function getCachedAccountingOverviewSnapshot(asOfDate: string, options: { force?: boolean } = {}) {
  return getCachedAccountingOverviewByDate(asOfDate, options);
}

const getCachedJournalEntriesByFilters = createKeyedClientCache<JournalEntriesResult>((filtersKey) => {
  const filters = JSON.parse(filtersKey) as JournalFilters;
  return getJournalEntries(filters);
});

export function getCachedJournalEntriesForPage(filters: JournalFilters, options: { force?: boolean } = {}) {
  return getCachedJournalEntriesByFilters(stableJson(filters), options);
}

const getCachedReconciliationReportByRange = createKeyedClientCache<ReconciliationReportResult>((rangeKey) => {
  const [fromDate, toDate] = rangeKey.split('|');
  return getReconciliationReport(fromDate, toDate);
});

export function getCachedReconciliationReportForPage(
  fromDate: string,
  toDate: string,
  options: { force?: boolean } = {}
) {
  return getCachedReconciliationReportByRange(`${fromDate}|${toDate}`, options);
}

export const getCachedSalaryReconciliationReportForPage =
  createKeyedClientCache<SalaryReconciliationReportResult>((monthYear) => getSalaryReconciliationReport(monthYear));
