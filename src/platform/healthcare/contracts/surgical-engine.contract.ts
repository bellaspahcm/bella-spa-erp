/**
 * Surgical Engine Contract
 * 
 * Contract definition for Surgical Engine (Healthcare Platform).
 * 
 * @module platform/healthcare/contracts/surgical-engine
 */

import type { EngineContract, EngineResponse } from '../shared-kernel/types';
import type { ContractMetadata } from '../../host/contract-registry/types';

export interface CreateSurgicalCaseRequest {
  tenantId: string;
  encounterId: string;
  caseNumber: string;
  requestId?: string; // Idempotency
  userId?: string;
  patientId?: string;
  orId?: string;
  surgeonId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface AssignTeamMemberRequest {
  tenantId: string;
  surgicalCaseId: string;
  userId: string;
  role: 'surgeon' | 'assistant_surgeon' | 'anesthesiologist' | 'circulating_nurse' | 'scrub_nurse';
  requestId?: string; // Idempotency
}

export interface CompleteChecklistPhaseRequest {
  tenantId: string;
  surgicalCaseId: string;
  completedBy: string;
  requestId?: string; // Idempotency
}

export interface StartProcedureRequest {
  tenantId: string;
  surgicalCaseId: string;
  requestId?: string; // Idempotency
  userId?: string;
}

export interface CompleteProcedureRequest {
  tenantId: string;
  surgicalCaseId: string;
  requestId?: string; // Idempotency
  userId?: string;
}

export interface CancelCaseRequest {
  tenantId: string;
  surgicalCaseId: string;
  reason: string;
  requestId?: string; // Idempotency
  userId?: string;
}

export interface SurgicalCase {
  id: string;
  tenantId: string;
  encounterId: string;
  caseNumber: string;
  status: 'planned' | 'scheduled' | 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'aborted' | 'SCHEDULED' | 'PREOP_READY' | 'ANESTHETIZED' | 'PROCEDURE_IN_PROGRESS' | 'RECOVERY_PACU' | 'POSTOP_COMPLETED';
  createdAt: string;
  updatedAt: string;
}

export interface SurgicalTeamMember {
  id: string;
  tenantId: string;
  surgicalCaseId: string;
  userId: string;
  role: 'surgeon' | 'assistant_surgeon' | 'anesthesiologist' | 'circulating_nurse' | 'scrub_nurse';
  assignedAt: string;
  leftAt: string | null;
}

export interface SurgicalSafetyChecklist {
  id: string;
  tenantId: string;
  surgicalCaseId: string;
  signinCompleted: boolean;
  signinCompletedAt: string | null;
  signinCompletedBy: string | null;
  timeoutCompleted: boolean;
  timeoutCompletedAt: string | null;
  timeoutCompletedBy: string | null;
  signoutCompleted: boolean;
  signoutCompletedAt: string | null;
  signoutCompletedBy: string | null;
}

export interface SurgicalEngineContract extends EngineContract {
  createCase(request: CreateSurgicalCaseRequest): Promise<EngineResponse<SurgicalCase>>;
  assignTeamMember(request: AssignTeamMemberRequest): Promise<EngineResponse<SurgicalTeamMember>>;
  completeSignIn(request: CompleteChecklistPhaseRequest): Promise<EngineResponse<SurgicalSafetyChecklist>>;
  completeTimeOut(request: CompleteChecklistPhaseRequest): Promise<EngineResponse<SurgicalSafetyChecklist>>;
  completeSignOut(request: CompleteChecklistPhaseRequest): Promise<EngineResponse<SurgicalSafetyChecklist>>;
  administerAnesthesia(request: { tenantId: string; surgicalCaseId: string }): Promise<EngineResponse<SurgicalCase>>;
  startProcedure(request: StartProcedureRequest): Promise<EngineResponse<SurgicalCase>>;
  completeProcedure(request: CompleteProcedureRequest): Promise<EngineResponse<SurgicalCase>>;
  cancelCase(request: CancelCaseRequest): Promise<EngineResponse<SurgicalCase>>;
}

export const SURGICAL_ENGINE_CONTRACT: ContractMetadata = {
  name: 'surgical-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'Surgical case management, team scheduling, safety checklist enforcement, and procedure engine',
  owner: 'Healthcare Platform Team',
  status: 'active',
  endpoints: [],
  events: [
    {
      eventType: 'hos.surgical.case.created.v1',
      version: '1.0.0',
      summary: 'Published when a surgical case is initialized',
      payloadSchema: { schemaId: 'surgical-case-created-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'surgical-engine',
      subscribers: ['anesthesia-engine'],
    },
    {
      eventType: 'hos.surgical.team.assigned.v1',
      version: '1.0.0',
      summary: 'Published when a team member is assigned to a case',
      payloadSchema: { schemaId: 'surgical-team-assigned-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'surgical-engine',
      subscribers: ['or-readiness-engine'],
    },
    {
      eventType: 'hos.surgical.safety.signin.v1',
      version: '1.0.0',
      summary: 'Published when surgical safety Sign-In checklist is completed',
      payloadSchema: { schemaId: 'surgical-safety-signin-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'surgical-engine',
      subscribers: ['or-readiness-engine'],
    },
    {
      eventType: 'hos.surgical.safety.timeout.v1',
      version: '1.0.0',
      summary: 'Published when surgical safety Time-Out checklist is completed',
      payloadSchema: { schemaId: 'surgical-safety-timeout-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'surgical-engine',
      subscribers: ['or-readiness-engine'],
    },
    {
      eventType: 'hos.surgical.procedure.started.v1',
      version: '1.0.0',
      summary: 'Published when a surgical procedure begins',
      payloadSchema: { schemaId: 'surgical-procedure-started-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'surgical-engine',
      subscribers: ['anesthesia-engine'],
    },
    {
      eventType: 'hos.surgical.procedure.completed.v1',
      version: '1.0.0',
      summary: 'Published when a surgical procedure is completed',
      payloadSchema: { schemaId: 'surgical-procedure-completed-payload', version: '1.0.0', inline: true, schema: { type: 'object', properties: {} } },
      publisher: 'surgical-engine',
      subscribers: ['billing-engine', 'pacu-engine'],
    },
  ],
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
