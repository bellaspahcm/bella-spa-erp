/**
 * Emergency Engine Contract
 *
 * Public API Contract for Emergency Engine Operations.
 *
 * @module platform/healthcare/engines/emergency-engine/contracts
 */

import { AcuityAssessmentInput, AcuityLevelResult } from '../domain/protocols/triage-protocol.interface';
import { TriageStatus } from '../domain/triage.entity';
import { EmergencyAssessmentStatus, PrimarySurvey, ClinicalVitals, RapidReassessmentNote } from '../domain/emergency-assessment.entity';
import { EmergencyBayStatus } from '../domain/emergency-bay.resource';
import { DispositionType, DispositionStatus, DischargeMetadata, TransferMetadata, AdmissionMetadata } from '../domain/emergency-disposition.entity';

export interface EmergencyTriageResponse {
  triageId: string;
  patientId: string;
  encounterId?: string | null;
  status: TriageStatus;
  acuityResult: AcuityLevelResult;
  evaluatedBy: string;
  createdAt: string;
}

export interface EmergencyAssessmentResponse {
  assessmentId: string;
  encounterId: string;
  triageId: string;
  status: EmergencyAssessmentStatus;
  primarySurvey: PrimarySurvey;
  vitals: ClinicalVitals;
  reassessmentNotes: RapidReassessmentNote[];
  assessedBy: string;
  createdAt: string;
}

export interface EmergencyBayAllocationResponse {
  bayId: string;
  bayCode: string;
  bayName: string;
  status: EmergencyBayStatus;
  encounterId: string;
  allocatedAt: string;
}

export interface EmergencyDispositionResponse {
  dispositionId: string;
  encounterId: string;
  patientId: string;
  status: DispositionStatus;
  dispositionType?: DispositionType | null;
  dischargeMetadata?: DischargeMetadata | null;
  transferMetadata?: TransferMetadata | null;
  admissionMetadata?: AdmissionMetadata | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  executionReferenceId?: string | null;
}

export interface IEmergencyEngineContract {
  performTriage(params: {
    tenantId: string;
    patientId: string;
    chiefComplaint: string;
    assessmentInput: AcuityAssessmentInput;
    evaluatedBy: string;
    encounterId?: string | null;
  }): Promise<EmergencyTriageResponse>;

  allocateBay(params: {
    tenantId: string;
    bayId: string;
    encounterId: string;
    patientId: string;
  }): Promise<EmergencyBayAllocationResponse>;

  releaseBay(params: {
    tenantId: string;
    bayId: string;
  }): Promise<{ success: boolean; bayId: string }>;

  createAssessment(params: {
    tenantId: string;
    encounterId: string;
    triageId: string;
    primarySurvey: PrimarySurvey;
    secondarySurveyNote: string;
    vitals: ClinicalVitals;
    assessedBy: string;
  }): Promise<EmergencyAssessmentResponse>;

  decideDisposition(params: {
    tenantId: string;
    encounterId: string;
    patientId: string;
    dispositionType: DispositionType;
    decidedBy: string;
    dischargeMetadata?: DischargeMetadata;
    transferMetadata?: TransferMetadata;
    admissionMetadata?: AdmissionMetadata;
  }): Promise<EmergencyDispositionResponse>;
}
