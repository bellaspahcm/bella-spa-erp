/**
 * React Hook: useBedEngine
 * 
 * Hook for consuming Bed Engine operations in Hospital pages.
 * 
 * **STATUS:** ✅ IMPLEMENTED (Phase 0 Week 4)
 * 
 * @example
 * ```tsx
 * const { allocateBed, releaseBed, loading } = useBedEngine();
 * 
 * const handleAllocate = async () => {
 *   const result = await allocateBed({
 *     tenantId, encounterId, patientId, wardId, bedType: 'standard'
 *   });
 *   if (result.success) toast.success('Bed allocated');
 * };
 * ```
 */

'use client';

import { useState } from 'react';
import { BedEngineService } from '@/platform/healthcare/engines/bed-engine';
import { createClient } from '@/lib/supabase-client';
import type {
  BedAllocationRequest,
  BedReleaseRequest,
  BedTransferRequest,
  BedQueryRequest,
} from '@/platform/healthcare/contracts/bed-engine.contract';
import type { EngineResponse, Bed } from '@/platform/healthcare/shared-kernel/types';

export function useBedEngine() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize engine
  const supabase = createClient();
  const bedEngine = new BedEngineService(supabase);

  const allocateBed = async (request: BedAllocationRequest): Promise<EngineResponse<Bed>> => {
    setLoading(true);
    setError(null);

    try {
      const result = await bedEngine.allocateBed(request);
      return result;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      setError(errorObj);
      return { success: false, error: { code: 'ENGINE_ERROR', message: errorObj.message, timestamp: new Date().toISOString() } };
    } finally {
      setLoading(false);
    }
  };

  const releaseBed = async (request: BedReleaseRequest): Promise<EngineResponse<Bed>> => {
    setLoading(true);
    setError(null);

    try {
      const result = await bedEngine.releaseBed(request);
      return result;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      setError(errorObj);
      return { success: false, error: { code: 'ENGINE_ERROR', message: errorObj.message, timestamp: new Date().toISOString() } };
    } finally {
      setLoading(false);
    }
  };

  const transferBed = async (request: BedTransferRequest): Promise<EngineResponse<{ fromBed: Bed; toBed: Bed; transferId: string }>> => {
    setLoading(true);
    setError(null);

    try {
      const result = await bedEngine.transferBed(request);
      return result;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      setError(errorObj);
      return { success: false, error: { code: 'ENGINE_ERROR', message: errorObj.message, timestamp: new Date().toISOString() } };
    } finally {
      setLoading(false);
    }
  };

  const queryBeds = async (request: BedQueryRequest): Promise<EngineResponse<Bed[]>> => {
    setLoading(true);
    setError(null);

    try {
      const result = await bedEngine.queryBeds(request);
      return result;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      setError(errorObj);
      return { success: false, error: { code: 'ENGINE_ERROR', message: errorObj.message, timestamp: new Date().toISOString() } };
    } finally {
      setLoading(false);
    }
  };

  return {
    allocateBed,
    releaseBed,
    transferBed,
    queryBeds,
    loading,
    error,
  };
}

// ✅ Implemented (Phase 0 Week 4)
// TODO: Add retry logic for transient failures
// TODO: Add caching for queryBeds results
// TODO: Integrate feature flag for dual-path support (legacy vs new engine)
