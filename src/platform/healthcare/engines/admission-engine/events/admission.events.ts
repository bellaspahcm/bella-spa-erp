/**
 * Admission Engine Domain Events
 *
 * @module platform/healthcare/engines/admission-engine/events
 */

export interface AdmissionCreatedPayload {
  admissionId: string;
  tenantId: string;
  encounterId: string;
  patientPartyId: string;
  wardId: string;
  bedId: string;
  admittingDoctorId: string;
  attendingDoctorId: string;
  admittedAt: string;
}

export interface AdmissionTransferredPayload {
  admissionId: string;
  tenantId: string;
  encounterId: string;
  patientPartyId: string;
  fromWardId: string;
  fromBedId: string;
  toWardId: string;
  toBedId: string;
  transferredAt: string;
}

export interface AdmissionDischargedPayload {
  admissionId: string;
  tenantId: string;
  encounterId: string;
  patientPartyId: string;
  bedId: string;
  wardId: string;
  dischargeSummary: string;
  dischargedAt: string;
}

export const ADMISSION_EVENT_TYPES = {
  ADMISSION_CREATED: 'hos.admission.created.v1',
  ADMISSION_TRANSFERRED: 'hos.admission.transferred.v1',
  ADMISSION_DISCHARGED: 'hos.admission.discharged.v1',
} as const;
