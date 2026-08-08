/**
 * PACU Engine Service
 * 
 * Healthcare Platform engine for Post-Anesthesia Care Unit operations.
 * 
 * @module platform/healthcare/engines/pacu-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PacuEngineContract,
  PacuAdmissionRequest,
  RecordAldreteRequest,
  PacuDischargeRequest,
  PacuDischargePolicy,
  PacuAdmission,
} from '../../contracts/pacu-engine.contract';
import type { EngineResponse, EngineHealthStatus } from '../../shared-kernel/types';
import { eventBus } from '../../../host/event-bus';

export class PacuEngineService implements PacuEngineContract {
  readonly engineName = 'pacu-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  // Local lookup for policies (representing clinical policy master repository)
  private readonly policies: Record<string, PacuDischargePolicy> = {
    'standard-v1': {
      policyVersion: 'standard-v1',
      minimumAldreteScore: 9,
      maximumPainScore: 3,
    },
    'strict-v1': {
      policyVersion: 'strict-v1',
      minimumAldreteScore: 10,
      maximumPainScore: 2,
    },
  };

  constructor(private readonly supabase: SupabaseClient) {}

  async admitToPacu(request: PacuAdmissionRequest): Promise<EngineResponse<PacuAdmission>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'admitToPacu',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_pacu_admissions')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('surgical_case_id', request.surgicalCaseId)
              .maybeSingle();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  surgicalCaseId: existing.surgical_case_id,
                  admittedAt: existing.admitted_at,
                  dischargedAt: existing.discharged_at,
                  dischargePolicyVersion: existing.discharge_policy_version,
                  aldreteScore: existing.aldrete_score,
                  painScore: existing.pain_score,
                  status: existing.status as 'admitted' | 'ready_for_discharge' | 'discharged',
                  createdAt: existing.created_at,
                  updatedAt: existing.updated_at,
                },
              };
            }
          }
          return {
            success: false,
            error: {
              code: 'CONCURRENCY_ERROR',
              message: `Idempotency failure: ${insertError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      // Verify case exists
      const { data: surgicalCase, error: caseError } = await this.supabase
        .from('hc_surgical_cases')
        .select('*')
        .eq('id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (caseError || !surgicalCase) {
        return {
          success: false,
          error: {
            code: 'CASE_NOT_FOUND',
            message: 'Surgical case not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Enforce: Case status must be completed/in_progress to admit to PACU
      if (surgicalCase.status !== 'completed' && surgicalCase.status !== 'in_progress') {
        return {
          success: false,
          error: {
            code: 'INVALID_CASE_STATUS',
            message: 'Cannot admit to PACU: procedure is not completed or in progress',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Insert admission with policy version snapshot
      const { data, error } = await this.supabase
        .from('hc_pacu_admissions')
        .insert({
          tenant_id: request.tenantId,
          surgical_case_id: request.surgicalCaseId,
          admitted_at: request.admittedAt,
          discharge_policy_version: request.dischargePolicyVersion,
          status: 'admitted',
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'PACU_ADMISSION_FAILED',
            message: `Failed to admit to PACU: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: {
          id: data.id,
          tenantId: data.tenant_id,
          surgicalCaseId: data.surgical_case_id,
          admittedAt: data.admitted_at,
          dischargedAt: data.discharged_at,
          dischargePolicyVersion: data.discharge_policy_version,
          aldreteScore: data.aldrete_score,
          painScore: data.pain_score,
          status: data.status as 'admitted' | 'ready_for_discharge' | 'discharged',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async recordAldreteScore(request: RecordAldreteRequest): Promise<EngineResponse<PacuAdmission>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'recordAldreteScore',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_pacu_admissions')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('surgical_case_id', request.surgicalCaseId)
              .single();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  surgicalCaseId: existing.surgical_case_id,
                  admittedAt: existing.admitted_at,
                  dischargedAt: existing.discharged_at,
                  dischargePolicyVersion: existing.discharge_policy_version,
                  aldreteScore: existing.aldrete_score,
                  painScore: existing.pain_score,
                  status: existing.status as 'admitted' | 'ready_for_discharge' | 'discharged',
                  createdAt: existing.created_at,
                  updatedAt: existing.updated_at,
                },
              };
            }
          }
          return {
            success: false,
            error: {
              code: 'CONCURRENCY_ERROR',
              message: `Idempotency failure: ${insertError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      // Fetch admission record
      const { data: admission, error: fetchError } = await this.supabase
        .from('hc_pacu_admissions')
        .select('*')
        .eq('surgical_case_id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !admission) {
        return {
          success: false,
          error: {
            code: 'ADMISSION_NOT_FOUND',
            message: 'PACU admission not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (admission.status === 'discharged') {
        return {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Cannot record score: patient has already been discharged',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Calculate total Aldrete score
      const totalAldrete =
        request.activity +
        request.respiration +
        request.circulation +
        request.consciousness +
        request.oxygenSaturation;

      // Check policy parameters to see if status should be ready_for_discharge
      const policyVersion = admission.discharge_policy_version;
      const policy = this.policies[policyVersion] || this.policies['standard-v1'];

      const isReady = totalAldrete >= policy.minimumAldreteScore && request.painScore <= policy.maximumPainScore;
      const newStatus = isReady ? 'ready_for_discharge' : 'admitted';

      const { data: updated, error: updateError } = await this.supabase
        .from('hc_pacu_admissions')
        .update({
          aldrete_score: totalAldrete,
          pain_score: request.painScore,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', admission.id)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateError || !updated) {
        return {
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: `Failed to record Aldrete score: ${updateError?.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: {
          id: updated.id,
          tenantId: updated.tenant_id,
          surgicalCaseId: updated.surgical_case_id,
          admittedAt: updated.admitted_at,
          dischargedAt: updated.discharged_at,
          dischargePolicyVersion: updated.discharge_policy_version,
          aldreteScore: updated.aldrete_score,
          painScore: updated.pain_score,
          status: updated.status as 'admitted' | 'ready_for_discharge' | 'discharged',
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async evaluateDischargeReadiness(
    tenantId: string,
    surgicalCaseId: string,
    policy: PacuDischargePolicy
  ): Promise<EngineResponse<{ ready: boolean; blockers: string[] }>> {
    try {
      const { data: admission, error: fetchError } = await this.supabase
        .from('hc_pacu_admissions')
        .select('*')
        .eq('surgical_case_id', surgicalCaseId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !admission) {
        return {
          success: false,
          error: {
            code: 'ADMISSION_NOT_FOUND',
            message: 'PACU admission not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      const blockers: string[] = [];

      if (admission.aldrete_score === null) {
        blockers.push('Aldrete score has not been recorded');
      } else if (admission.aldrete_score < policy.minimumAldreteScore) {
        blockers.push(`Aldrete score ${admission.aldrete_score} is below minimum required ${policy.minimumAldreteScore}`);
      }

      if (admission.pain_score === null) {
        blockers.push('Pain score has not been recorded');
      } else if (admission.pain_score > policy.maximumPainScore) {
        blockers.push(`Pain score ${admission.pain_score} is above maximum allowed ${policy.maximumPainScore}`);
      }

      return {
        success: true,
        data: {
          ready: blockers.length === 0,
          blockers,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async dischargeFromPacu(request: PacuDischargeRequest): Promise<EngineResponse<PacuAdmission>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'dischargeFromPacu',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_pacu_admissions')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('surgical_case_id', request.surgicalCaseId)
              .single();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  surgicalCaseId: existing.surgical_case_id,
                  admittedAt: existing.admitted_at,
                  dischargedAt: existing.discharged_at,
                  dischargePolicyVersion: existing.discharge_policy_version,
                  aldreteScore: existing.aldrete_score,
                  painScore: existing.pain_score,
                  status: existing.status as 'admitted' | 'ready_for_discharge' | 'discharged',
                  createdAt: existing.created_at,
                  updatedAt: existing.updated_at,
                },
              };
            }
          }
          return {
            success: false,
            error: {
              code: 'CONCURRENCY_ERROR',
              message: `Idempotency failure: ${insertError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      // Fetch admission record to fetch snapshotted policy
      const { data: admission, error: fetchError } = await this.supabase
        .from('hc_pacu_admissions')
        .select('*')
        .eq('surgical_case_id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !admission) {
        return {
          success: false,
          error: {
            code: 'ADMISSION_NOT_FOUND',
            message: 'PACU admission not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (admission.status === 'discharged') {
        return {
          success: false,
          error: {
            code: 'ALREADY_DISCHARGED',
            message: 'Patient has already been discharged',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Enforce Invariant: Check readiness against snapshotted policy version
      const policyVersion = admission.discharge_policy_version;
      const policy = this.policies[policyVersion] || this.policies['standard-v1'];

      const readiness = await this.evaluateDischargeReadiness(request.tenantId, request.surgicalCaseId, policy);

      if (!readiness.success || !readiness.data?.ready) {
        return {
          success: false,
          error: {
            code: 'DISCHARGE_BLOCKED',
            message: `Discharge blocked by safety criteria: ${readiness.data?.blockers.join(', ')}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Discharge
      const { data: updated, error: updateError } = await this.supabase
        .from('hc_pacu_admissions')
        .update({
          status: 'discharged',
          discharged_at: request.dischargedAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', admission.id)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateError || !updated) {
        return {
          success: false,
          error: {
            code: 'DISCHARGE_FAILED',
            message: `Failed to discharge: ${updateError?.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const result: PacuAdmission = {
        id: updated.id,
        tenantId: updated.tenant_id,
        surgicalCaseId: updated.surgical_case_id,
        admittedAt: updated.admitted_at,
        dischargedAt: updated.discharged_at,
        dischargePolicyVersion: updated.discharge_policy_version,
        aldreteScore: updated.aldrete_score,
        painScore: updated.pain_score,
        status: updated.status as 'admitted' | 'ready_for_discharge' | 'discharged',
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      };

      await eventBus.publish({
        eventType: 'hos.pacu.discharged.v1',
        tenantId: request.tenantId,
        aggregateId: result.surgicalCaseId,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: result.surgicalCaseId,
          dischargedAt: result.dischargedAt,
        },
      });

      return {
        success: true,
        data: result,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      const { error } = await this.supabase
        .from('hc_pacu_admissions')
        .select('id')
        .limit(1);

      return {
        status: error ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: error ? 'error' : 'ok',
          eventBus: 'ok',
        },
        message: error ? 'Database connection issue' : undefined,
      };
    } catch (err: unknown) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'error',
        },
        message: err instanceof Error ? err.message : 'Health check failed',
      };
    }
  }
}
