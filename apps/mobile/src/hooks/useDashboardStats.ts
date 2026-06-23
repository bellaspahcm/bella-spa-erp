/**
 * Hook: useDashboardStats
 * Fetches KPI statistics based on user role
 * Admin KPI ≠ KTV KPI
 * 
 * ✅ Week 3 Fix: Added complete error handling (Loading, Error, Success states)
 */

import { useCallback, useEffect, useState } from 'react';
import { isTechnicianRole } from '@bella/shared';
import {
  fetchDashboardStats,
  type AdminKpiData,
  type TechnicianKpiData,
} from '../services/dashboard/fetchDashboardStats';

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

    try {
      const data = await fetchDashboardStats({ tenantId, userId, role });

      if (isTechnicianRole(role)) {
        setKpi({ type: 'technician', data: data as TechnicianKpiData });
      } else {
        setKpi({ type: 'admin', data: data as AdminKpiData });
      }
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Không thể tải thống kê';
      setError(errorMessage);
      setKpi(null);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, userId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  return { kpi, isLoading, error, retry: load };
}
