/**
 * Surgical Engine Service
 * 
 * Healthcare Platform engine for surgical cases and safety checklists.
 * 
 * @module platform/healthcare/engines/surgical-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SurgicalEngineContract,
  CreateSurgicalCaseRequest,
  AssignTeamMemberRequest,
  CompleteChecklistPhaseRequest,
  StartProcedureRequest,
  CompleteProcedureRequest,
  CancelCaseRequest,
  SurgicalCase,
  SurgicalTeamMember,
  SurgicalSafetyChecklist,
} from '../../contracts/surgical-engine.contract';
import type { EngineResponse, EngineHealthStatus } from '../../shared-kernel/types';
import { eventBus } from '../../../host/event-bus';

export class SurgicalEngineService implements SurgicalEngineContract {
  readonly engineName = 'surgical-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  constructor(private readonly supabase: SupabaseClient) {}

  async createCase(request: CreateSurgicalCaseRequest): Promise<EngineResponse<SurgicalCase>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'createCase',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_surgical_cases')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('encounter_id', request.encounterId)
              .eq('case_number', request.caseNumber)
              .maybeSingle();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  encounterId: existing.encounter_id,
                  caseNumber: existing.case_number,
                  status: existing.status,
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

      // Initialize surgical case
      const { data: surgicalCaseData, error: caseError } = await this.supabase
        .from('hc_surgical_cases')
        .insert({
          tenant_id: request.tenantId,
          encounter_id: request.encounterId,
          case_number: request.caseNumber,
          status: 'planned',
        })
        .select()
        .single();

      if (caseError || !surgicalCaseData) {
        return {
          success: false,
          error: {
            code: 'CASE_CREATION_FAILED',
            message: `Failed to create case: ${caseError?.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Initialize safety checklist for case
      const { error: checklistError } = await this.supabase
        .from('hc_surgical_safety_checklists')
        .insert({
          tenant_id: request.tenantId,
          surgical_case_id: surgicalCaseData.id,
          signin_completed: false,
          timeout_completed: false,
          signout_completed: false,
        });

      if (checklistError) {
        // Rollback case insert
        await this.supabase.from('hc_surgical_cases').delete().eq('id', surgicalCaseData.id);
        return {
          success: false,
          error: {
            code: 'CHECKLIST_INITIALIZATION_FAILED',
            message: `Failed to initialize checklist: ${checklistError.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const result: SurgicalCase = {
        id: surgicalCaseData.id,
        tenantId: surgicalCaseData.tenant_id,
        encounterId: surgicalCaseData.encounter_id,
        caseNumber: surgicalCaseData.case_number,
        status: surgicalCaseData.status,
        createdAt: surgicalCaseData.created_at,
        updatedAt: surgicalCaseData.updated_at,
      };

      await eventBus.publish({
        eventType: 'hos.surgical.case.created.v1',
        tenantId: request.tenantId,
        aggregateId: result.id,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: result.id,
          encounterId: result.encounterId,
          caseNumber: result.caseNumber,
          status: result.status,
        },
        userId: request.userId,
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

  async assignTeamMember(request: AssignTeamMemberRequest): Promise<EngineResponse<SurgicalTeamMember>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'assignTeamMember',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_surgical_teams')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('surgical_case_id', request.surgicalCaseId)
              .eq('user_id', request.userId)
              .eq('role', request.role)
              .maybeSingle();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  surgicalCaseId: existing.surgical_case_id,
                  userId: existing.user_id,
                  role: existing.role,
                  assignedAt: existing.assigned_at,
                  leftAt: existing.left_at,
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

      const { data, error } = await this.supabase
        .from('hc_surgical_teams')
        .insert({
          tenant_id: request.tenantId,
          surgical_case_id: request.surgicalCaseId,
          user_id: request.userId,
          role: request.role,
          assigned_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'TEAM_ASSIGNMENT_FAILED',
            message: `Failed to assign team member: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const member: SurgicalTeamMember = {
        id: data.id,
        tenantId: data.tenant_id,
        surgicalCaseId: data.surgical_case_id,
        userId: data.user_id,
        role: data.role,
        assignedAt: data.assigned_at,
        leftAt: data.left_at,
      };

      await eventBus.publish({
        eventType: 'hos.surgical.team.assigned.v1',
        tenantId: request.tenantId,
        aggregateId: member.surgicalCaseId,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: member.surgicalCaseId,
          userId: member.userId,
          role: member.role,
        },
      });

      return {
        success: true,
        data: member,
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

  async completeSignIn(request: CompleteChecklistPhaseRequest): Promise<EngineResponse<SurgicalSafetyChecklist>> {
    try {
      const { data, error } = await this.supabase
        .from('hc_surgical_safety_checklists')
        .update({
          signin_completed: true,
          signin_completed_at: new Date().toISOString(),
          signin_completed_by: request.completedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('surgical_case_id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'SIGNIN_COMPLETION_FAILED',
            message: `Failed to complete Sign-In checklist: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const checklist: SurgicalSafetyChecklist = {
        id: data.id,
        tenantId: data.tenant_id,
        surgicalCaseId: data.surgical_case_id,
        signinCompleted: data.signin_completed,
        signinCompletedAt: data.signin_completed_at,
        signinCompletedBy: data.signin_completed_by,
        timeoutCompleted: data.timeout_completed,
        timeoutCompletedAt: data.timeout_completed_at,
        timeoutCompletedBy: data.timeout_completed_by,
        signoutCompleted: data.signout_completed,
        signoutCompletedAt: data.signout_completed_at,
        signoutCompletedBy: data.signout_completed_by,
      };

      await eventBus.publish({
        eventType: 'hos.surgical.safety.signin.v1',
        tenantId: request.tenantId,
        aggregateId: checklist.surgicalCaseId,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: checklist.surgicalCaseId,
          signinCompleted: true,
          completedBy: request.completedBy,
        },
      });

      return {
        success: true,
        data: checklist,
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

  async completeTimeOut(request: CompleteChecklistPhaseRequest): Promise<EngineResponse<SurgicalSafetyChecklist>> {
    try {
      const { data, error } = await this.supabase
        .from('hc_surgical_safety_checklists')
        .update({
          timeout_completed: true,
          timeout_completed_at: new Date().toISOString(),
          timeout_completed_by: request.completedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('surgical_case_id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'TIMEOUT_COMPLETION_FAILED',
            message: `Failed to complete Time-Out checklist: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const checklist: SurgicalSafetyChecklist = {
        id: data.id,
        tenantId: data.tenant_id,
        surgicalCaseId: data.surgical_case_id,
        signinCompleted: data.signin_completed,
        signinCompletedAt: data.signin_completed_at,
        signinCompletedBy: data.signin_completed_by,
        timeoutCompleted: data.timeout_completed,
        timeoutCompletedAt: data.timeout_completed_at,
        timeoutCompletedBy: data.timeout_completed_by,
        signoutCompleted: data.signout_completed,
        signoutCompletedAt: data.signout_completed_at,
        signoutCompletedBy: data.signout_completed_by,
      };

      await eventBus.publish({
        eventType: 'hos.surgical.safety.timeout.v1',
        tenantId: request.tenantId,
        aggregateId: checklist.surgicalCaseId,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: checklist.surgicalCaseId,
          timeoutCompleted: true,
          completedBy: request.completedBy,
        },
      });

      return {
        success: true,
        data: checklist,
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

  async completeSignOut(request: CompleteChecklistPhaseRequest): Promise<EngineResponse<SurgicalSafetyChecklist>> {
    try {
      const { data, error } = await this.supabase
        .from('hc_surgical_safety_checklists')
        .update({
          signout_completed: true,
          signout_completed_at: new Date().toISOString(),
          signout_completed_by: request.completedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('surgical_case_id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'SIGNOUT_COMPLETION_FAILED',
            message: `Failed to complete Sign-Out checklist: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const checklist: SurgicalSafetyChecklist = {
        id: data.id,
        tenantId: data.tenant_id,
        surgicalCaseId: data.surgical_case_id,
        signinCompleted: data.signin_completed,
        signinCompletedAt: data.signin_completed_at,
        signinCompletedBy: data.signin_completed_by,
        timeoutCompleted: data.timeout_completed,
        timeoutCompletedAt: data.timeout_completed_at,
        timeoutCompletedBy: data.timeout_completed_by,
        signoutCompleted: data.signout_completed,
        signoutCompletedAt: data.signout_completed_at,
        signoutCompletedBy: data.signout_completed_by,
      };

      return {
        success: true,
        data: checklist,
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

  async startProcedure(request: StartProcedureRequest): Promise<EngineResponse<SurgicalCase>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'startProcedure',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_surgical_cases')
              .select('*')
              .eq('id', request.surgicalCaseId)
              .eq('tenant_id', request.tenantId)
              .single();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  encounterId: existing.encounter_id,
                  caseNumber: existing.case_number,
                  status: existing.status,
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

      // Check current case and its status
      const { data: currentCase, error: fetchCaseError } = await this.supabase
        .from('hc_surgical_cases')
        .select('*')
        .eq('id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchCaseError || !currentCase) {
        return {
          success: false,
          error: {
            code: 'CASE_NOT_FOUND',
            message: 'Surgical case not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (currentCase.status !== 'planned' && currentCase.status !== 'scheduled' && currentCase.status !== 'ready') {
        return {
          success: false,
          error: {
            code: 'INVALID_LIFECYCLE_STATE',
            message: `Cannot start procedure in status ${currentCase.status}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Enforce Invariant: Sign-In and Time-Out must be complete
      const { data: checklist, error: fetchChecklistError } = await this.supabase
        .from('hc_surgical_safety_checklists')
        .select('*')
        .eq('surgical_case_id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .maybeSingle();

      if (fetchChecklistError || !checklist) {
        return {
          success: false,
          error: {
            code: 'CHECKLIST_NOT_FOUND',
            message: 'Safety checklist not initialized for this case',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (!checklist.signin_completed) {
        return {
          success: false,
          error: {
            code: 'SIGNIN_NOT_COMPLETED',
            message: 'Cannot start: Sign In not completed',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (!checklist.timeout_completed) {
        return {
          success: false,
          error: {
            code: 'TIMEOUT_NOT_COMPLETED',
            message: 'Cannot start: Time Out not completed',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Start the procedure
      const { data: updatedCase, error: updateError } = await this.supabase
        .from('hc_surgical_cases')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateError || !updatedCase) {
        return {
          success: false,
          error: {
            code: 'START_PROCEDURE_FAILED',
            message: `Failed to update status to in_progress: ${updateError?.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const result: SurgicalCase = {
        id: updatedCase.id,
        tenantId: updatedCase.tenant_id,
        encounterId: updatedCase.encounter_id,
        caseNumber: updatedCase.case_number,
        status: updatedCase.status,
        createdAt: updatedCase.created_at,
        updatedAt: updatedCase.updated_at,
      };

      await eventBus.publish({
        eventType: 'hos.surgical.procedure.started.v1',
        tenantId: request.tenantId,
        aggregateId: result.id,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: result.id,
          status: result.status,
        },
        userId: request.userId,
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

  async completeProcedure(request: CompleteProcedureRequest): Promise<EngineResponse<SurgicalCase>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'completeProcedure',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_surgical_cases')
              .select('*')
              .eq('id', request.surgicalCaseId)
              .eq('tenant_id', request.tenantId)
              .single();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  encounterId: existing.encounter_id,
                  caseNumber: existing.case_number,
                  status: existing.status,
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

      // Check current case status
      const { data: currentCase, error: fetchCaseError } = await this.supabase
        .from('hc_surgical_cases')
        .select('*')
        .eq('id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchCaseError || !currentCase) {
        return {
          success: false,
          error: {
            code: 'CASE_NOT_FOUND',
            message: 'Surgical case not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (currentCase.status !== 'in_progress') {
        return {
          success: false,
          error: {
            code: 'INVALID_LIFECYCLE_STATE',
            message: 'Cannot complete procedure that is not in progress',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Enforce Invariant: Sign-Out must be complete
      const { data: checklist, error: fetchChecklistError } = await this.supabase
        .from('hc_surgical_safety_checklists')
        .select('*')
        .eq('surgical_case_id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .maybeSingle();

      if (fetchChecklistError || !checklist) {
        return {
          success: false,
          error: {
            code: 'CHECKLIST_NOT_FOUND',
            message: 'Safety checklist not initialized for this case',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (!checklist.signout_completed) {
        return {
          success: false,
          error: {
            code: 'SIGNOUT_NOT_COMPLETED',
            message: 'Cannot complete: Sign Out not completed',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Complete procedure
      const { data: updatedCase, error: updateError } = await this.supabase
        .from('hc_surgical_cases')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateError || !updatedCase) {
        return {
          success: false,
          error: {
            code: 'COMPLETE_PROCEDURE_FAILED',
            message: `Failed to update status to completed: ${updateError?.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const result: SurgicalCase = {
        id: updatedCase.id,
        tenantId: updatedCase.tenant_id,
        encounterId: updatedCase.encounter_id,
        caseNumber: updatedCase.case_number,
        status: updatedCase.status,
        createdAt: updatedCase.created_at,
        updatedAt: updatedCase.updated_at,
      };

      await eventBus.publish({
        eventType: 'hos.surgical.procedure.completed.v1',
        tenantId: request.tenantId,
        aggregateId: result.id,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: result.id,
          status: result.status,
        },
        userId: request.userId,
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

  async cancelCase(request: CancelCaseRequest): Promise<EngineResponse<SurgicalCase>> {
    try {
      const { data, error } = await this.supabase
        .from('hc_surgical_cases')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'CANCEL_CASE_FAILED',
            message: `Failed to cancel case: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const result: SurgicalCase = {
        id: data.id,
        tenantId: data.tenant_id,
        encounterId: data.encounter_id,
        caseNumber: data.case_number,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

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
        .from('hc_surgical_cases')
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
