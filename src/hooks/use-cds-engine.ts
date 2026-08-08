/**
 * React Hook: useCdsEngine
 *
 * Hook for consuming Clinical Decision Support Engine operations in Hospital UI components.
 * Per Law 2: No direct DB queries, frontend consumes engine services.
 * Per Law 11: Strictly typed, zero `any` types.
 *
 * @module hooks/use-cds-engine
 */

'use client';

import { useState, useMemo } from 'react';
import { CdsEngineService } from '@/platform/healthcare/engines/cds-engine';
import { createClient } from '@/lib/supabase-client';
import type {
  CheckDrugInteractionsRequest,
  CheckAllergyRequest,
  CheckProtocolAdherenceRequest,
  GenerateCdsSummaryRequest,
  RecordAllergyRequest,
  CdsCheckResult,
  PatientAllergy,
} from '@/platform/healthcare/contracts/cds-engine.contract';
import type { EngineResponse } from '@/platform/healthcare/shared-kernel/types';

export function useCdsEngine() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();
  const cdsEngine = useMemo(() => new CdsEngineService(supabase), [supabase]);

  const checkDrugInteractions = async (
    request: CheckDrugInteractionsRequest
  ): Promise<EngineResponse<CdsCheckResult>> => {
    setLoading(true);
    setError(null);
    try {
      return await cdsEngine.checkDrugInteractions(request);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error in checkDrugInteractions');
      setError(e);
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const checkAllergyContraindications = async (
    request: CheckAllergyRequest
  ): Promise<EngineResponse<CdsCheckResult>> => {
    setLoading(true);
    setError(null);
    try {
      return await cdsEngine.checkAllergyContraindications(request);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error in checkAllergyContraindications');
      setError(e);
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const checkProtocolAdherence = async (
    request: CheckProtocolAdherenceRequest
  ): Promise<EngineResponse<CdsCheckResult>> => {
    setLoading(true);
    setError(null);
    try {
      return await cdsEngine.checkProtocolAdherence(request);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error in checkProtocolAdherence');
      setError(e);
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const generateCdsSummary = async (
    request: GenerateCdsSummaryRequest
  ): Promise<EngineResponse<CdsCheckResult>> => {
    setLoading(true);
    setError(null);
    try {
      return await cdsEngine.generateCdsSummary(request);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error in generateCdsSummary');
      setError(e);
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const recordAllergy = async (
    request: RecordAllergyRequest
  ): Promise<EngineResponse<PatientAllergy>> => {
    setLoading(true);
    setError(null);
    try {
      return await cdsEngine.recordAllergy(request);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error in recordAllergy');
      setError(e);
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const getPatientAllergies = async (
    tenantId: string,
    patientId: string
  ): Promise<EngineResponse<PatientAllergy[]>> => {
    setLoading(true);
    setError(null);
    try {
      return await cdsEngine.getPatientAllergies(tenantId, patientId);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error in getPatientAllergies');
      setError(e);
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    checkDrugInteractions,
    checkAllergyContraindications,
    checkProtocolAdherence,
    generateCdsSummary,
    recordAllergy,
    getPatientAllergies,
  };
}
