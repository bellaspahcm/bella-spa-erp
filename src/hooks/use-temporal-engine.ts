'use client';

/**
 * useTemporalEngine — React hook for Temporal Intelligence Engine (D2)
 * Constitution Law 2: Product packs must consume engines via hooks, not direct DB.
 *
 * Usage example (from a healthcare component):
 *   const { captureSnapshot, getAtPointInTime, diffSnapshots } = useTemporalEngine();
 *
 *   // After creating a clinical order (called from Domain Event handler):
 *   await captureSnapshot({
 *     entityType: 'hc_clinical_order',
 *     entityId: order.id,
 *     snapshotData: order,
 *     changeType: 'INSERT',
 *     changeSummary: 'Order created',
 *     sourceEventType: 'hos.order.created.v1',
 *   });
 *
 *   // Audit query: "What was this order's state at 10:00 AM?"
 *   const historicState = await getAtPointInTime('hc_clinical_order', orderId, '2026-08-08T10:00:00Z');
 */

import { useCallback } from 'react';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';
import {
  TemporalEngineService,
  SnapshotParams,
  GetHistoryOptions,
} from '@/platform/host/temporal-engine';

async function getEngineInstance(): Promise<TemporalEngineService> {
  const supabase = await createDevelopmentBypassClient();
  const user = await getCurrentUser();
  const tenantId = user?.tenant_id ?? '88888888-8888-8888-8888-888888888888';
  return new TemporalEngineService(supabase, tenantId);
}

export function useTemporalEngine() {
  const captureSnapshot = useCallback(
    async (params: SnapshotParams) => {
      const engine = await getEngineInstance();
      return engine.captureSnapshot(params);
    },
    []
  );

  const getHistory = useCallback(
    async (entityType: string, entityId: string, options?: GetHistoryOptions) => {
      const engine = await getEngineInstance();
      return engine.getHistory(entityType, entityId, options);
    },
    []
  );

  const getAtPointInTime = useCallback(
    async (entityType: string, entityId: string, timestamp: string) => {
      const engine = await getEngineInstance();
      return engine.getAtPointInTime(entityType, entityId, timestamp);
    },
    []
  );

  const diffSnapshots = useCallback(
    async (snapshotId1: string, snapshotId2: string) => {
      const engine = await getEngineInstance();
      return engine.diffSnapshots(snapshotId1, snapshotId2);
    },
    []
  );

  const getLatestSnapshot = useCallback(
    async (entityType: string, entityId: string) => {
      const engine = await getEngineInstance();
      return engine.getLatestSnapshot(entityType, entityId);
    },
    []
  );

  return {
    captureSnapshot,
    getHistory,
    getAtPointInTime,
    diffSnapshots,
    getLatestSnapshot,
  };
}
