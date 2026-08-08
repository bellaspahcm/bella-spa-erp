'use client';

/**
 * useAnalyticsEngine — React hook for Multi-Level Rollup Analytics Engine (D4)
 * Constitution Law 2: Product packs must consume engines via hooks, not direct DB.
 */

import { useCallback } from 'react';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';
import { AnalyticsEngineService, MetricEvent } from '@/platform/host/analytics-engine';

async function getEngineInstance(): Promise<AnalyticsEngineService> {
  const supabase = await createDevelopmentBypassClient();
  const user = await getCurrentUser();
  const tenantId = user?.tenant_id ?? '88888888-8888-8888-8888-888888888888';
  return new AnalyticsEngineService(supabase, tenantId);
}

export function useAnalyticsEngine() {
  const recordMetric = useCallback(
    async (params: MetricEvent) => {
      const engine = await getEngineInstance();
      return engine.recordMetric(params);
    },
    []
  );

  const rollupDaily = useCallback(
    async (periodDate: string) => {
      const engine = await getEngineInstance();
      return engine.rollupDaily(periodDate);
    },
    []
  );

  const rollupMonthly = useCallback(
    async (periodMonth: string) => {
      const engine = await getEngineInstance();
      return engine.rollupMonthly(periodMonth);
    },
    []
  );

  const rollupEnterprise = useCallback(
    async (periodMonth: string) => {
      const engine = await getEngineInstance();
      return engine.rollupEnterprise(periodMonth);
    },
    []
  );

  const getTenantDashboard = useCallback(
    async (periodMonth: string) => {
      const engine = await getEngineInstance();
      return engine.getTenantDashboard(periodMonth);
    },
    []
  );

  return {
    recordMetric,
    rollupDaily,
    rollupMonthly,
    rollupEnterprise,
    getTenantDashboard,
  };
}
