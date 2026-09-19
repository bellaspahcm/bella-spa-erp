/**
 * Admission Engine Contract & Interfaces
 *
 * @module platform/healthcare/engines/admission-engine/contracts
 */

import type { EngineResponse } from '../../../shared-kernel/types';
import type { AdmissionStatus } from '../domain/inpatient-admission.entity';

export interface CreateAdmissionRequest {
  tenantId: string;
  encounterId: string;
  patientPartyId: string;
  wardId: string;
  bedId: string;
  admittingDoctorId: string;
  attendingDoctorId: string;
  admissionDiagnosis: Array<{
    icd10Code: string;
    icd10NameVi: string;
    isPrimary: boolean;
  }>;
  userId?: string;
}

export interface DischargeAdmissionRequest {
  tenantId: string;
  admissionId: string;
  dischargeSummary: string;
  userId?: string;
}

export interface AdmissionDTO {
  id: string;
  tenantId: string;
  encounterId: string;
  patientPartyId: string;
  wardId: string;
  bedId: string;
  admittingDoctorId: string;
  attendingDoctorId: string;
  status: AdmissionStatus;
  admissionDiagnosis: Array<{
    icd10Code: string;
    icd10NameVi: string;
    isPrimary: boolean;
  }>;
  dischargeSummary?: string;
  admittedAt: string;
  dischargedAt?: string;
  version: number;
}

export interface AdmissionEngineContract {
  readonly engineName: string;
  readonly engineVersion: string;
  readonly contractVersion: string;

  createAdmission(request: CreateAdmissionRequest): Promise<EngineResponse<AdmissionDTO>>;
  dischargeAdmission(request: DischargeAdmissionRequest): Promise<EngineResponse<AdmissionDTO>>;
  getAdmissionById(tenantId: string, admissionId: string): Promise<EngineResponse<AdmissionDTO>>;
  getAdmissionByEncounterId(tenantId: string, encounterId: string): Promise<EngineResponse<AdmissionDTO>>;
}
