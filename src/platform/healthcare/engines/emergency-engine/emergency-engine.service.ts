/**
 * EmergencyEngineService (Application Orchestrator)
 *
 * Orchestrates Emergency Department workflows:
 * Triage -> Emergency Encounter -> Bay Allocation -> Clinical Assessment -> Disposition -> Destination Handoff
 *
 * Architecture Invariants:
 * 1. Zero Business Logic of Kernel capabilities inside this service.
 * 2. Strictly delegates to Contracts (EncounterContract, AdmissionContract, OrderContract, PharmacyContract).
 * 3. Law 6 (Capability Reuse): Reuses existing Kernel engines via contract boundaries.
 * 4. Zero `any` types (Law 11).
 *
 * @module platform/healthcare/engines/emergency-engine
 */

import {
  IEmergencyEngineContract,
  EmergencyTriageResponse,
  EmergencyAssessmentResponse,
  EmergencyBayAllocationResponse,
  EmergencyDispositionResponse,
} from './contracts/emergency-engine.contract';
import { ITriageRepository } from './repositories/triage.repository';
import { IEmergencyBayRepository } from './repositories/emergency-bay.repository';
import { IEmergencyDispositionRepository } from './repositories/emergency-disposition.repository';
import { Triage } from './domain/triage.entity';
import { EmergencyAssessment, PrimarySurvey, ClinicalVitals } from './domain/emergency-assessment.entity';
import { EmergencyDisposition, DispositionType, DischargeMetadata, TransferMetadata, AdmissionMetadata } from './domain/emergency-disposition.entity';
import { AcuityAssessmentInput } from './domain/protocols/triage-protocol.interface';
import { ITriageProtocol } from './domain/protocols/triage-protocol.interface';
import { ITransferContract } from './contracts/transfer.contract';

export interface EmergencyEngineDependencies {
  triageRepository: ITriageRepository;
  bayRepository: IEmergencyBayRepository;
  dispositionRepository: IEmergencyDispositionRepository;
  protocolStrategy?: ITriageProtocol;
  transferContract?: ITransferContract;
}

export class EmergencyEngineService implements IEmergencyEngineContract {
  constructor(private readonly deps: EmergencyEngineDependencies) {}

  public async performTriage(params: {
    tenantId: string;
    patientId: string;
    chiefComplaint: string;
    assessmentInput: AcuityAssessmentInput;
    evaluatedBy: string;
    encounterId?: string | null;
  }): Promise<EmergencyTriageResponse> {
    const id = `triage-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const triage = Triage.create({
      id,
      tenantId: params.tenantId,
      patientId: params.patientId,
      chiefComplaint: params.chiefComplaint,
      assessmentInput: params.assessmentInput,
      evaluatedBy: params.evaluatedBy,
      protocol: this.deps.protocolStrategy,
      encounterId: params.encounterId,
    });

    const saved = await this.deps.triageRepository.save(triage);

    return {
      triageId: saved.id,
      patientId: saved.patientId,
      encounterId: saved.encounterId,
      status: saved.status,
      acuityResult: saved.acuityResult!,
      evaluatedBy: saved.evaluatedBy,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  public async allocateBay(params: {
    tenantId: string;
    bayId: string;
    encounterId: string;
    patientId: string;
  }): Promise<EmergencyBayAllocationResponse> {
    const bay = await this.deps.bayRepository.findById(params.tenantId, params.bayId);
    if (!bay) throw new Error(`EmergencyBay with id ${params.bayId} not found`);

    const allocated = await this.deps.bayRepository.allocateConditional(
      params.tenantId,
      params.bayId,
      params.encounterId,
      params.patientId,
      bay.version
    );

    return {
      bayId: allocated.id,
      bayCode: allocated.bayCode,
      bayName: allocated.bayName,
      status: allocated.status,
      encounterId: allocated.currentEncounterId!,
      allocatedAt: allocated.allocatedAt!.toISOString(),
    };
  }

  public async releaseBay(params: {
    tenantId: string;
    bayId: string;
  }): Promise<{ success: boolean; bayId: string }> {
    const bay = await this.deps.bayRepository.findById(params.tenantId, params.bayId);
    if (!bay) throw new Error(`EmergencyBay with id ${params.bayId} not found`);

    bay.release();
    await this.deps.bayRepository.save(bay);
    return { success: true, bayId: bay.id };
  }

  public async createAssessment(params: {
    tenantId: string;
    encounterId: string;
    triageId: string;
    primarySurvey: PrimarySurvey;
    secondarySurveyNote: string;
    vitals: ClinicalVitals;
    assessedBy: string;
  }): Promise<EmergencyAssessmentResponse> {
    const id = `assess-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const assessment = EmergencyAssessment.create({
      id,
      tenantId: params.tenantId,
      encounterId: params.encounterId,
      triageId: params.triageId,
      primarySurvey: params.primarySurvey,
      secondarySurveyNote: params.secondarySurveyNote,
      vitals: params.vitals,
      assessedBy: params.assessedBy,
    });

    assessment.completeAssessment();

    return {
      assessmentId: assessment.id,
      encounterId: assessment.encounterId,
      triageId: assessment.triageId,
      status: assessment.status,
      primarySurvey: assessment.primarySurvey,
      vitals: assessment.vitals,
      reassessmentNotes: [...assessment.reassessmentNotes],
      assessedBy: assessment.assessedBy,
      createdAt: assessment.createdAt.toISOString(),
    };
  }

  public async decideDisposition(params: {
    tenantId: string;
    encounterId: string;
    patientId: string;
    dispositionType: DispositionType;
    decidedBy: string;
    dischargeMetadata?: DischargeMetadata;
    transferMetadata?: TransferMetadata;
    admissionMetadata?: AdmissionMetadata;
  }): Promise<EmergencyDispositionResponse> {
    const id = `disp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const disposition = EmergencyDisposition.create({
      id,
      tenantId: params.tenantId,
      encounterId: params.encounterId,
      patientId: params.patientId,
    });

    if (params.dispositionType === 'DISCHARGE') {
      if (!params.dischargeMetadata) throw new Error('Discharge requires dischargeMetadata');
      disposition.decideDischarge({
        decidedBy: params.decidedBy,
        metadata: params.dischargeMetadata,
      });
    } else if (params.dispositionType === 'TRANSFER') {
      if (!params.transferMetadata) throw new Error('Transfer requires transferMetadata');
      disposition.decideTransfer({
        decidedBy: params.decidedBy,
        metadata: params.transferMetadata,
      });

      if (this.deps.transferContract) {
        const transferRes = await this.deps.transferContract.initiateTransfer({
          tenantId: params.tenantId,
          encounterId: params.encounterId,
          patientId: params.patientId,
          receivingFacilityName: params.transferMetadata.receivingFacilityName,
          transferReason: params.transferMetadata.transferReason,
          transportMode: params.transferMetadata.transportMode,
          initiatedBy: params.decidedBy,
        });
        disposition.markExecuted(transferRes.transferId);
      }
    } else if (params.dispositionType === 'ADMIT') {
      if (!params.admissionMetadata) throw new Error('Admission requires admissionMetadata');
      disposition.decideAdmission({
        decidedBy: params.decidedBy,
        metadata: params.admissionMetadata,
      });
    }

    const saved = await this.deps.dispositionRepository.save(disposition);

    return {
      dispositionId: saved.id,
      encounterId: saved.encounterId,
      patientId: saved.patientId,
      status: saved.status,
      dispositionType: saved.dispositionType,
      dischargeMetadata: saved.dischargeMetadata,
      transferMetadata: saved.transferMetadata,
      admissionMetadata: saved.admissionMetadata,
      decidedBy: saved.decidedBy,
      decidedAt: saved.decidedAt ? saved.decidedAt.toISOString() : null,
      executionReferenceId: saved.executionReferenceId,
    };
  }
}
