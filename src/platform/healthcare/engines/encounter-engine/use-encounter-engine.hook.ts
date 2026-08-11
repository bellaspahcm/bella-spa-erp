/**
 * useEncounterEngine Hook
 * 
 * @layer Healthcare Platform → React Integration
 * @責任 React hook for Hospital UI to consume Encounter Engine
 * 
 * Usage:
 * ```typescript
 * import { useEncounterEngine } from '@/platform/healthcare/engines/encounter-engine/use-encounter-engine.hook';
 * 
 * function AdmissionForm() {
 *   const { createEncounter, loading, error } = useEncounterEngine();
 *   
 *   const handleSubmit = async (data) => {
 *     const result = await createEncounter({
 *       tenantId: currentTenant.id,
 *       patientId: patient.id,
 *       encounterClass: 'inpatient',
 *       ...data
 *     });
 *     
 *     if (result.success) {
 *       toast.success('Encounter created');
 *       router.push(`/encounters/${result.encounter.id}`);
 *     }
 *   };
 * }
 * ```
 */

'use client';

'use client';

import { useState, useCallback } from 'react';
import { createClient as createBrowserClient } from '@/lib/supabase-client';
import { getEncounterEngine } from './encounter-engine.factory';
import type {
  IEncounterEngine,
  CreateEncounterRequest,
  CreateEncounterResponse,
  UpdateEncounterStatusRequest,
  UpdateEncounterStatusResponse,
  AddDiagnosisRequest,
  AddDiagnosisResponse,
  AssignProviderRequest,
  AssignProviderResponse,
  TransferEncounterRequest,
  TransferEncounterResponse,
  GetEncounterRequest,
  GetEncounterResponse,
  SearchEncountersRequest,
  SearchEncountersResponse,
} from './encounter-engine.interface';

/**
 * ✅ Phase 3 - React Hook for Encounter Engine
 */
export function useEncounterEngine() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get engine instance
  const getEngine = useCallback((): IEncounterEngine => {
    const supabase = createBrowserClient();
    return getEncounterEngine(supabase);
  }, []);

  // ===========================
  // Create Encounter
  // ===========================
  const createEncounter = useCallback(
    async (
      request: CreateEncounterRequest
    ): Promise<CreateEncounterResponse> => {
      setLoading(true);
      setError(null);

      try {
        const engine = getEngine();
        const result = await engine.createEncounter(request);

        if (!result.success) {
          setError(result.error || 'Failed to create encounter');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [getEngine]
  );

  // ===========================
  // Update Status
  // ===========================
  const updateStatus = useCallback(
    async (
      request: UpdateEncounterStatusRequest
    ): Promise<UpdateEncounterStatusResponse> => {
      setLoading(true);
      setError(null);

      try {
        const engine = getEngine();
        const result = await engine.updateStatus(request);

        if (!result.success) {
          setError(result.error || 'Failed to update status');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [getEngine]
  );

  // ===========================
  // Add Diagnosis
  // ===========================
  const addDiagnosis = useCallback(
    async (request: AddDiagnosisRequest): Promise<AddDiagnosisResponse> => {
      setLoading(true);
      setError(null);

      try {
        const engine = getEngine();
        const result = await engine.addDiagnosis(request);

        if (!result.success) {
          setError(result.error || 'Failed to add diagnosis');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [getEngine]
  );

  // ===========================
  // Assign Provider
  // ===========================
  const assignProvider = useCallback(
    async (
      request: AssignProviderRequest
    ): Promise<AssignProviderResponse> => {
      setLoading(true);
      setError(null);

      try {
        const engine = getEngine();
        const result = await engine.assignProvider(request);

        if (!result.success) {
          setError(result.error || 'Failed to assign provider');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [getEngine]
  );

  // ===========================
  // Transfer Encounter
  // ===========================
  const transferEncounter = useCallback(
    async (
      request: TransferEncounterRequest
    ): Promise<TransferEncounterResponse> => {
      setLoading(true);
      setError(null);

      try {
        const engine = getEngine();
        const result = await engine.transferEncounter(request);

        if (!result.success) {
          setError(result.error || 'Failed to transfer encounter');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [getEngine]
  );

  // ===========================
  // Get Encounter
  // ===========================
  const getEncounter = useCallback(
    async (request: GetEncounterRequest): Promise<GetEncounterResponse> => {
      setLoading(true);
      setError(null);

      try {
        const engine = getEngine();
        const result = await engine.getEncounter(request);

        if (!result.success) {
          setError(result.error || 'Failed to get encounter');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [getEngine]
  );

  // ===========================
  // Search Encounters
  // ===========================
  const searchEncounters = useCallback(
    async (
      request: SearchEncountersRequest
    ): Promise<SearchEncountersResponse> => {
      setLoading(true);
      setError(null);

      try {
        const engine = getEngine();
        const result = await engine.searchEncounters(request);

        if (!result.success) {
          setError(result.error || 'Failed to search encounters');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return { success: false, error: message, encounters: [], total: 0 };
      } finally {
        setLoading(false);
      }
    },
    [getEngine]
  );

  return {
    // Methods
    createEncounter,
    updateStatus,
    addDiagnosis,
    assignProvider,
    transferEncounter,
    getEncounter,
    searchEncounters,

    // State
    loading,
    error,

    // Clear error
    clearError: useCallback(() => setError(null), []),
  };
}
