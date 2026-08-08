'use client';

/**
 * useRollbackEngine — React hook for Compensating Transaction Engine (D1)
 * Constitution Law 2: Product packs must consume engines via hooks, not direct DB.
 */

import { useCallback } from 'react';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';
import {
  RollbackEngineService,
  StartTransactionParams,
  ExecuteStepParams,
} from '@/platform/host/rollback-engine';

async function getEngineInstance(): Promise<RollbackEngineService> {
  const supabase = await createDevelopmentBypassClient();
  const user = await getCurrentUser();
  const tenantId = user?.tenant_id ?? '88888888-8888-8888-8888-888888888888';
  return new RollbackEngineService(supabase, tenantId);
}

export function useRollbackEngine() {
  const startTransaction = useCallback(
    async (params: StartTransactionParams) => {
      const engine = await getEngineInstance();
      return engine.startTransaction(params);
    },
    []
  );

  const executeStep = useCallback(
    async (transactionId: string, params: ExecuteStepParams) => {
      const engine = await getEngineInstance();
      return engine.executeStep(transactionId, params);
    },
    []
  );

  const commitTransaction = useCallback(
    async (transactionId: string) => {
      const engine = await getEngineInstance();
      return engine.commitTransaction(transactionId);
    },
    []
  );

  const rollbackTransaction = useCallback(
    async (transactionId: string, reason: string, triggeredBy?: string) => {
      const engine = await getEngineInstance();
      return engine.rollbackTransaction(transactionId, reason, triggeredBy);
    },
    []
  );

  const markManualRecovery = useCallback(
    async (transactionId: string, note: string, resolvedBy: string) => {
      const engine = await getEngineInstance();
      return engine.markManualRecovery(transactionId, note, resolvedBy);
    },
    []
  );

  return {
    startTransaction,
    executeStep,
    commitTransaction,
    rollbackTransaction,
    markManualRecovery,
  };
}
