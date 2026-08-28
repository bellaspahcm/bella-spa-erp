/**
 * React Hook: useNursingEngine
 *
 * Hook for consuming Nursing Engine operations in Hospital pages.
 *
 * **STATUS:** ✅ MIGRATED TO CONTRACT-FIRST (Week 2 Day 3 - P1 Remediation)
 * **H1.3:** recordVitalSigns / getVitalSigns — live DB
 * **H1.4:** getMARByAdmission / recordAdministration — live DB
 */

'use client';

import { useState, useMemo } from 'react';
import { getHealthcareService } from '@/platform/healthcare';
import { createClient } from '@/lib/supabase-client';
import type { NursingEngineContract, MARAdministrationEntry, RecordVitalsRequest, MARItemSummary } from '@/platform/healthcare/contracts/nursing-engine.contract';
import type { EngineResponse, VitalSigns } from '@/platform/healthcare/shared-kernel/types';

export function useNursingEngine() {
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  const nursingEngine = useMemo(
    () => getHealthcareService<NursingEngineContract>('nursing-engine', supabase),
    [supabase]
  );

  const recordVitalSigns = async (request: RecordVitalsRequest): Promise<EngineResponse<VitalSigns>> => {
    setLoading(true);
    try {
      return await nursingEngine.recordVitalSigns(request);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('Unknown error in recordVitalSigns');
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const getVitalSigns = async (tenantId: string, encounterId: string): Promise<EngineResponse<VitalSigns[]>> => {
    setLoading(true);
    try {
      return await nursingEngine.getVitalSigns(tenantId, encounterId);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('Unknown error in getVitalSigns');
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const getMARByAdmission = async (tenantId: string, admissionId: string): Promise<EngineResponse<MARItemSummary[]>> => {
    setLoading(true);
    try {
      return await nursingEngine.getMARByAdmission(tenantId, admissionId);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('Unknown error in getMARByAdmission');
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const recordAdministration = async (entry: MARAdministrationEntry): Promise<EngineResponse<MARItemSummary>> => {
    setLoading(true);
    try {
      return await nursingEngine.recordAdministration(entry);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('Unknown error in recordAdministration');
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  return { recordVitalSigns, getVitalSigns, getMARByAdmission, recordAdministration, loading };
}
