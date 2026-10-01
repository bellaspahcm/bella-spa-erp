/**
 * Admission Public Contract - Product-facing H1-H12 boundary.
 *
 * This contract is the public surface consumed by Healthcare Product Verticals.
 * Kernel admission engine internals remain under
 * `platform/healthcare/engines/admission-engine/**`.
 *
 * @module platform/healthcare/contracts/admission-engine.contract
 */

export interface InpatientAdmissionDTO {
  tenantId: string;
  encounterId: string;
  patientId: string;
  bedId: string;
  admittingPhysicianId: string;
  wardId?: string;
  admittingDoctorId?: string;
  attendingDoctorId?: string;
  admissionDiagnosis?: Array<{
    icd10Code: string;
    icd10NameVi: string;
    isPrimary: boolean;
  }>;
  timestamp?: string;
}

export interface InpatientAdmissionResultDTO {
  admissionId: string;
  encounterId?: string;
  status: 'ADMITTED' | 'admitted' | string;
  admittedAt?: string;
}

export interface BedTransferDTO {
  admissionId: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  targetBedId: string;
  transferReason: string;
  transferredBy: string;
  timestamp?: string;
}

export interface BedTransferResultDTO {
  admissionId: string;
  status: 'TRANSFERRED' | 'transferred' | string;
  transferredAt?: string;
}

export interface DischargeInpatientDTO {
  admissionId: string;
  tenantId: string;
  dischargedBy: string;
  timestamp?: string;
}

export interface DischargeInpatientResultDTO {
  admissionId: string;
  status: 'DISCHARGED' | 'discharged' | string;
  dischargedAt?: string;
}

export interface IAdmissionContract {
  admitInpatient(dto: InpatientAdmissionDTO): Promise<InpatientAdmissionResultDTO>;
  transferBed(dto: BedTransferDTO): Promise<BedTransferResultDTO>;
  dischargeInpatient(dto: DischargeInpatientDTO): Promise<DischargeInpatientResultDTO>;
}
