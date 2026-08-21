/**
 * React Hook: usePharmacyEngine
 *
 * Hook for consuming Pharmacy Engine (MAR) operations in Hospital pages.
 * Follows the same pattern as useBedEngine and useNursingEngine.
 *
 * **STATUS:** ✅ MIGRATED TO CONTRACT-FIRST (Week 2 Day 3 - P1 Remediation)
 *
 * @example
 * ```tsx
 * const { getMedicationOrders, recordMedicationAdministration, loading } = usePharmacyEngine();
 *
 * const orders = await getMedicationOrders(tenantId, encounterId);
 * if (orders.success) setRecords(orders.data ?? []);
 * ```
 */

'use client';

import { useState, useMemo } from 'react';
import { getHealthcareService } from '@/platform/healthcare';
import { createClient } from '@/lib/supabase-client';
import type { PharmacyEngineContract } from '@/platform/healthcare/contracts/pharmacy-engine.contract';
import type { MARAdministrationRequest } from '@/platform/healthcare/contracts/pharmacy-engine.contract';
import type { EngineResponse, MedicationOrder } from '@/platform/healthcare/shared-kernel/types';

export function usePharmacyEngine() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();
  const pharmacyEngine = useMemo(
    () => getHealthcareService<PharmacyEngineContract>('pharmacy-engine', supabase),
    [supabase]
  );

  const getMedicationOrders = async (
    tenantId: string,
    encounterId: string,
  ): Promise<EngineResponse<MedicationOrder[]>> => {
    setLoading(true);
    setError(null);

    try {
      const result = await pharmacyEngine.getMedicationOrders(tenantId, encounterId);
      return result;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      setError(errorObj);
      return {
        success: false,
        error: { code: 'ENGINE_ERROR', message: errorObj.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const recordMedicationAdministration = async (
    request: MARAdministrationRequest,
  ): Promise<EngineResponse<{ id: string }>> => {
    setLoading(true);
    setError(null);

    try {
      const result = await pharmacyEngine.recordMedicationAdministration(request);
      return result;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      setError(errorObj);
      return {
        success: false,
        error: { code: 'ENGINE_ERROR', message: errorObj.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    getMedicationOrders,
    recordMedicationAdministration,
    loading,
    error,
  };
}

// ✅ Implemented (Phase 0 Week 4)
// TODO: Add retry logic for transient failures
// TODO: Add caching for getMedicationOrders results
// TODO: Integrate feature flag for dual-path support (legacy vs new engine)
