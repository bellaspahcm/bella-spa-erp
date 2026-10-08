/**
 * React Hook: useNursingEngine
 * 
 * Hook for consuming Nursing Engine operations in Hospital pages.
 * 
 * **STATUS:** ✅ MIGRATED TO CONTRACT-FIRST (Week 2 Day 3 - P1 Remediation)
 * **IMPLEMENTATION:** Week 4 TODO (contract-first structure ready)
 */

'use client';

import { useState, useMemo } from 'react';
import { getHealthcareService } from '@/platform/healthcare';
import { createClient } from '@/lib/supabase-client';
import type { NursingEngineContract } from '@/platform/healthcare/contracts/nursing-engine.contract';
import type { RecordVitalsRequest } from '@/platform/healthcare/contracts/nursing-engine.contract';
import type { EngineResponse, VitalSigns } from '@/platform/healthcare/shared-kernel/types';

function browserBoundaryResponse<T>(operation: string): EngineResponse<T> {
  return {
    success: false,
    error: {
      code: 'BROWSER_PUBLIC_CONTRACT_REQUIRED',
      message: `${operation} must run through a server/product public contract boundary.`,
      timestamp: new Date().toISOString(),
    },
  };
}

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
      if (typeof window !== 'undefined') {
        return browserBoundaryResponse<VitalSigns>('recordVitalSigns');
      }

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
      if (typeof window !== 'undefined') {
        return browserBoundaryResponse<VitalSigns[]>('getVitalSigns');
      }

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

  return { recordVitalSigns, getVitalSigns, loading };
}
