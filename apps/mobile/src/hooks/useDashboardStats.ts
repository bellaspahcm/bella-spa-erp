/**
 * Hook: useDashboardStats
 * Fetches KPI statistics based on user role
 * Admin KPI ≠ KTV KPI
 * 
 * ✅ Week 3 Fix: Added complete error handling (Loading, Error, Success states)
 * ✅ Pre-Week 4 Phase 1: Added Sentry error tracking and performance monitoring
 * TEMP: Sentry disabled for build debugging
 */

import { useCallback, useEffect, useState } from 'react';
import { isTechnicianRole } from '../lib/shared-utils';
import {
  fetchDashboardStats,
  type AdminKpiData,
  type TechnicianKpiData,
} from '../services/dashboard/fetchDashboardStats';
// import { captureException, startTransaction, addSentryBreadcrumb } from '../lib/sentry';

export type KpiConfig =
  | { type: 'admin'; data: AdminKpiData }
  | { type: 'technician'; data: TechnicianKpiData }
  | null;

export function useDashboardStats(params: {
  tenantId: string | null;
  userId: string;
  role: string;
}) {
  const [kpi, setKpi] = useState<KpiConfig>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tenantId, userId, role } = params;

  const load = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      setError(null);
      setKpi(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Start performance tracking
    // TEMP: Sentry disabled
    // const transaction = startTransaction('useDashboardStats.load', 'hook');
    // const span = transaction.startChild({
    //   op: 'fetch',
    //   description: 'fetchDashboardStats',
    // });

    try {
      // Add breadcrumb for debugging
      // TEMP: Sentry disabled
      // addSentryBreadcrumb('Fetching dashboard stats', 'data', {
      //   tenantId,
      //   userId,
      //   role,
      // });

      const data = await fetchDashboardStats({ tenantId, userId, role });

      if (isTechnicianRole(role)) {
        setKpi({ type: 'technician', data: data as TechnicianKpiData });
      } else {
        setKpi({ type: 'admin', data: data as AdminKpiData });
      }
      setError(null);

      // Mark as successful
      // TEMP: Sentry disabled
      // span.setStatus('ok');
      
      // Add success breadcrumb
      // TEMP: Sentry disabled
      // addSentryBreadcrumb('Dashboard stats loaded successfully', 'data', {
      //   role,
      //   dataType: isTechnicianRole(role) ? 'technician' : 'admin',
      // });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Không thể tải thống kê';
      setError(errorMessage);
      setKpi(null);

      // Mark transaction as failed
      // TEMP: Sentry disabled
      // span.setStatus('internal_error');

      // Report to Sentry with context
      // TEMP: Sentry disabled
      // captureException(err as Error, {
      //   hook: 'useDashboardStats',
      //   operation: 'load',
      //   tenantId,
      //   userId,
      //   role,
      //   errorMessage,
      // });

      // Add error breadcrumb
      // TEMP: Sentry disabled
      // addSentryBreadcrumb('Dashboard stats fetch failed', 'error', {
      //   errorMessage,
      //   role,
      // });
    } finally {
      setIsLoading(false);
      // TEMP: Sentry disabled
      // span.finish();
      // transaction.finish();
    }
  }, [tenantId, userId, role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { kpi, isLoading, error, retry: load };
}
