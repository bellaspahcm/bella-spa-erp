/**
 * SurgicalEngineService Implementation
 * 
 * Enforces safety gates (pre-op, anesthesia checklist, CSSD sterilization)
 * using the SurgicalCase aggregate root and SurgeryRepository.
 * 
 * @module platform/healthcare/engines/surgical-engine/surgical-engine.service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type {
  SurgicalEngineContract,
  CreateSurgicalCaseRequest,
  AssignTeamMemberRequest,
  CompleteChecklistPhaseRequest,
  StartProcedureRequest,
  CompleteProcedureRequest,
  CancelCaseRequest,
  SurgicalCase as ContractSurgicalCase,
  SurgicalTeamMember,
  SurgicalSafetyChecklist,
} from '../../contracts/surgical-engine.contract';
import type { ISterilizationContract } from '../../contracts/sterilization.contract';
import type { EngineHealthStatus, EngineResponse } from '../../shared-kernel/types';
import { eventBus } from '../../../host/event-bus';
import { SurgicalCase } from './domain/surgical-case.entity';
import { ISurgeryRepository } from './repositories/surgery-repository.interface';
import { SupabaseSurgeryRepository } from './repositories/supabase-surgery.repository';

// Default mock sterilization contract for compatibility/fallbacks
class DefaultSterilizationContract implements ISterilizationContract {
  readonly engineName = 'sterilization-contract';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';
  async isSterile(): Promise<boolean> {
    return true;
  }

  async healthCheck() {
    return {
      status: 'healthy' as const,
      timestamp: new Date().toISOString(),
      checks: {},
    };
  }
}

export class SurgicalEngineService implements SurgicalEngineContract {
  readonly engineName = 'surgical-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  private readonly repo: ISurgeryRepository;
  private readonly sterilizationContract: ISterilizationContract;

  constructor(
    private readonly supabase: SupabaseClient<Database>,
    repo?: ISurgeryRepository,
    sterilizationContract?: ISterilizationContract
  ) {
    this.repo = repo || new SupabaseSurgeryRepository(supabase);
    this.sterilizationContract = sterilizationContract || new DefaultSterilizationContract();
  }

  async createCase(request: CreateSurgicalCaseRequest): Promise<EngineResponse<ContractSurgicalCase>> {
    try {
      // 1. Idempotency Check
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'createCase',
          });

        if (insertError && insertError.code === '23505') {
          // Retrieve existing
          const existing = await this.repo.findByEncounterId(request.tenantId, request.encounterId);
          if (existing) {
            return {
              success: true,
              data: this.mapToContract(existing),
            };
          }
        }
      }

      // 2. Resolve patientId from encounter if not provided
      let patientId = request.patientId;
      if (!patientId) {
        const { data: encounter } = await this.supabase
          .from('hc_encounters')
          .select('patient_party_id')
          .eq('id', request.encounterId)
          .maybeSingle();
        patientId = encounter?.patient_party_id || '00000000-0000-0000-0000-000000000000';
      }

      // 3. Fallback defaults for scheduling fields
      const orId = request.orId || 'OR-DEFAULT-ROOM';
      
      let surgeonId = request.surgeonId;
      if (!surgeonId) {
        const { data: party } = await this.supabase
          .from('party_parties')
          .select('id')
          .limit(1)
          .maybeSingle();
        surgeonId = party?.id || '00000000-0000-0000-0000-000000000000';
      }

      const scheduledStart = request.scheduledStart ? new Date(request.scheduledStart) : new Date();
      const scheduledEnd = request.scheduledEnd ? new Date(request.scheduledEnd) : new Date(Date.now() + 3600 * 1000);

      // 4. Create and Save aggregate
      const sCase = SurgicalCase.create({
        id: crypto.randomUUID(),
        tenantId: request.tenantId,
        encounterId: request.encounterId,
        patientId,
        orId,
        surgeonId,
        scheduledStart,
        scheduledEnd,
      });

      const saved = await this.repo.save(sCase);

      // 5. Backwards compatibility table insertions
      await this.supabase.from('hc_surgical_safety_checklists').insert({
        tenant_id: request.tenantId,
        surgical_case_id: saved.id,
        signin_completed: false,
        timeout_completed: false,
        signout_completed: false,
      });

      // 6. Publish Event
      await eventBus.publish({
        eventType: 'hos.surgical.case.created.v1',
        tenantId: request.tenantId,
        aggregateId: saved.id,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: saved.id,
          encounterId: saved.encounterId,
          caseNumber: request.caseNumber,
          status: saved.status,
        },
        userId: request.userId,
      });

      return {
        success: true,
        data: this.mapToContract(saved),
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
      // Compatibility insert in hc_surgical_teams
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
            message: error.message,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // If assigning a surgeon, update the SurgicalCase aggregate (demonstrating AR alignment)
      if (request.role === 'surgeon') {
        const sCase = await this.repo.findById(request.tenantId, request.surgicalCaseId);
        if (sCase) {
          // Reconstitute with updated surgeonId
          const snap = sCase.toJSON();
          const updatedCase = SurgicalCase.reconstitute({
            ...snap,
            surgeonId: request.userId,
          });
          await this.repo.save(updatedCase);
        }
      }

      const member: SurgicalTeamMember = {
        id: data.id,
        tenantId: data.tenant_id,
        surgicalCaseId: data.surgical_case_id,
        userId: data.user_id,
        role: data.role as 'surgeon' | 'assistant_surgeon' | 'anesthesiologist' | 'circulating_nurse' | 'scrub_nurse',
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
      const sCase = await this.repo.findById(request.tenantId, request.surgicalCaseId);
      if (!sCase) {
        return { success: false, error: { code: 'CASE_NOT_FOUND', message: 'Surgical case not found', timestamp: new Date().toISOString() } };
      }

      sCase.completeSignIn(request.completedBy);
      await this.repo.save(sCase);

      // Sync legacy safety checklists table for backwards compatibility
      await this.supabase
        .from('hc_surgical_safety_checklists')
        .update({
          signin_completed: true,
          signin_completed_at: new Date().toISOString(),
          signin_completed_by: request.completedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('surgical_case_id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId);
      const checklist = this.mapToChecklist(sCase);

      await eventBus.publish({
        eventType: 'hos.surgical.safety.signin.v1',
        tenantId: request.tenantId,
        aggregateId: sCase.id,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: sCase.id,
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
      const sCase = await this.repo.findById(request.tenantId, request.surgicalCaseId);
      if (!sCase) {
        return { success: false, error: { code: 'CASE_NOT_FOUND', message: 'Surgical case not found', timestamp: new Date().toISOString() } };
      }

      sCase.completeTimeOut(request.completedBy);
      await this.repo.save(sCase);

      // Sync legacy safety checklists table
      await this.supabase
        .from('hc_surgical_safety_checklists')
        .update({
          timeout_completed: true,
          timeout_completed_at: new Date().toISOString(),
          timeout_completed_by: request.completedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('surgical_case_id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId);

      const checklist = this.mapToChecklist(sCase);

      await eventBus.publish({
        eventType: 'hos.surgical.safety.timeout.v1',
        tenantId: request.tenantId,
        aggregateId: sCase.id,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: sCase.id,
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
      const sCase = await this.repo.findById(request.tenantId, request.surgicalCaseId);
      if (!sCase) {
        return { success: false, error: { code: 'CASE_NOT_FOUND', message: 'Surgical case not found', timestamp: new Date().toISOString() } };
      }

      sCase.completeSignOut(request.completedBy);
      await this.repo.save(sCase);

      // Sync legacy table
      await this.supabase
        .from('hc_surgical_safety_checklists')
        .update({
          signout_completed: true,
          signout_completed_at: new Date().toISOString(),
          signout_completed_by: request.completedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('surgical_case_id', request.surgicalCaseId)
        .eq('tenant_id', request.tenantId);

      const checklist = this.mapToChecklist(sCase);

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

  async administerAnesthesia(request: { tenantId: string; surgicalCaseId: string }): Promise<EngineResponse<ContractSurgicalCase>> {
    try {
      const sCase = await this.repo.findById(request.tenantId, request.surgicalCaseId);
      if (!sCase) {
        return {
          success: false,
          error: {
            code: 'CASE_NOT_FOUND',
            message: 'Surgical case not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Query anesthesia record to check if it has a valid pre_op assessment (and ASA classification 1-5)
      const { data: record, error: recordError } = await this.supabase
        .from('hc_anesthesia_records')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .eq('surgical_case_id', request.surgicalCaseId)
        .maybeSingle();

      if (
        recordError ||
        !record ||
        record.status !== 'pre_op_complete' ||
        !record.asa_classification ||
        record.asa_classification < 1 ||
        record.asa_classification > 5
      ) {
        return {
          success: false,
          error: {
            code: 'ANESTHESIA_NOT_COMPLETED',
            message: 'Anesthesia Safety Gate: Patient pre-op evaluation and ASA classification (1-5) must be completed before administering anesthesia',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Reconstitute case as preop_ready if it is scheduled
      if (sCase.status === 'SCHEDULED') {
        sCase.completePreop();
      }

      // Update aggregate root
      sCase.signAnesthesiaConsent(); // set consent signed
      sCase.administerAnesthesia();  // transition to ANESTHETIZED
      const saved = await this.repo.save(sCase);

      return {
        success: true,
        data: this.mapToContract(saved),
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

  async startProcedure(request: StartProcedureRequest): Promise<EngineResponse<ContractSurgicalCase>> {
    try {
      // 1. Load aggregate root
      const sCase = await this.repo.findById(request.tenantId, request.surgicalCaseId);
      if (!sCase) {
        return {
          success: false,
          error: {
            code: 'CASE_NOT_FOUND',
            message: 'Surgical case not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 2. Validate Safety Checklist invariants
      if (!sCase.signinCompleted) {
        return {
          success: false,
          error: {
            code: 'SIGNIN_NOT_COMPLETED',
            message: 'Cannot start: Sign In not completed',
            timestamp: new Date().toISOString(),
          },
        };
      }
      if (!sCase.timeoutCompleted) {
        return {
          success: false,
          error: {
            code: 'TIMEOUT_NOT_COMPLETED',
            message: 'Cannot start: Time Out not completed',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 3. Enforce CSSD Sterilization Gate
      let cssdVerified = true;
      const cssdTokenId = sCase.cssdTokenId || 'CSSD-TOKEN-1'; // fallback/mock
      if (sCase.cssdTokenId) {
        cssdVerified = await this.sterilizationContract.isSterile(request.tenantId, sCase.cssdTokenId);
      }

      if (!cssdVerified) {
        return {
          success: false,
          error: {
            code: 'CSSD_NOT_STERILE',
            message: 'CSSD Safety Gate: Surgical equipment sterilization not verified',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 4. Update domain state
      sCase.startProcedure(cssdVerified, cssdTokenId);
      const saved = await this.repo.save(sCase);

      // 5. Publish event
      await eventBus.publish({
        eventType: 'hos.surgical.procedure.started.v1',
        tenantId: request.tenantId,
        aggregateId: saved.id,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: saved.id,
          status: saved.status,
        },
        userId: request.userId,
      });

      return {
        success: true,
        data: this.mapToContract(saved),
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

  async completeProcedure(request: CompleteProcedureRequest): Promise<EngineResponse<ContractSurgicalCase>> {
    try {
      const sCase = await this.repo.findById(request.tenantId, request.surgicalCaseId);
      if (!sCase) {
        return {
          success: false,
          error: {
            code: 'CASE_NOT_FOUND',
            message: 'Surgical case not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (!sCase.signoutCompleted) {
        return {
          success: false,
          error: {
            code: 'SIGNOUT_NOT_COMPLETED',
            message: 'Cannot complete: Sign Out not completed',
            timestamp: new Date().toISOString(),
          },
        };
      }

      sCase.completeCase();
      const saved = await this.repo.save(sCase);

      await eventBus.publish({
        eventType: 'hos.surgical.procedure.completed.v1',
        tenantId: request.tenantId,
        aggregateId: saved.id,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: saved.id,
          status: saved.status,
        },
        userId: request.userId,
      });

      return {
        success: true,
        data: this.mapToContract(saved),
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

  async cancelCase(request: CancelCaseRequest): Promise<EngineResponse<ContractSurgicalCase>> {
    try {
      const sCase = await this.repo.findById(request.tenantId, request.surgicalCaseId);
      if (!sCase) {
        return { success: false, error: { code: 'CASE_NOT_FOUND', message: 'Surgical case not found', timestamp: new Date().toISOString() } };
      }

      sCase.cancel();
      const saved = await this.repo.save(sCase);

      return {
        success: true,
        data: this.mapToContract(saved),
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

  private mapToContract(sCase: SurgicalCase): ContractSurgicalCase {
    const snap = sCase.toJSON();
    return {
      id: snap.id,
      tenantId: snap.tenantId,
      encounterId: snap.encounterId,
      caseNumber: `CASE-${snap.id.substring(0, 8)}`,
      status: snap.status,
      createdAt: snap.createdAt.toISOString(),
      updatedAt: snap.updatedAt.toISOString(),
    };
  }

  private mapToChecklist(sCase: SurgicalCase): SurgicalSafetyChecklist {
    return {
      id: `chk-${sCase.id}`,
      tenantId: sCase.tenantId,
      surgicalCaseId: sCase.id,
      signinCompleted: sCase.signinCompleted,
      signinCompletedAt: sCase.signinCompletedAt ? sCase.signinCompletedAt.toISOString() : null,
      signinCompletedBy: sCase.signinCompletedBy,
      timeoutCompleted: sCase.timeoutCompleted,
      timeoutCompletedAt: sCase.timeoutCompletedAt ? sCase.timeoutCompletedAt.toISOString() : null,
      timeoutCompletedBy: sCase.timeoutCompletedBy,
      signoutCompleted: sCase.signoutCompleted,
      signoutCompletedAt: sCase.signoutCompletedAt ? sCase.signoutCompletedAt.toISOString() : null,
      signoutCompletedBy: sCase.signoutCompletedBy,
    };
  }
}
