/**
 * BELLA HOSPITAL - PATIENT/MPI FOUNDATION PRODUCT SERVICE
 *
 * Minimal Hospital runtime integration with the public Healthcare Patient/MPI
 * contract. This service does not access Patient/MPI internals, direct DB
 * tables, legacy healthcare services, EMR, Encounter, Admission, Billing, or
 * Finance.
 *
 * @module src/products/bella-hospital/services/hospital-patient-mpi.service
 */

import type {
  FindPatientByIdentifierRequest,
  GetPatientByIdRequest,
  PatientMpiContract,
  PatientMpiDTO,
  PatientMpiGender,
  PatientMpiIdentifierDTO,
  PatientMpiIdentifierType,
  RegisterPatientRequest,
  SearchPatientsRequest,
} from '../../../platform/healthcare/contracts/patient-mpi.contract';
import type { EngineResponse } from '../../../platform/healthcare/shared-kernel/types';

export type HospitalPatientMpiActorRole = 'receptionist' | 'nurse' | 'doctor' | 'admin';

export interface HospitalPatientMpiActorDTO {
  actorId: string;
  role: HospitalPatientMpiActorRole;
}

export interface HospitalRegisterFoundationPatientDTO {
  tenantId: string;
  displayName: string;
  legalName?: string;
  dob?: string;
  gender?: PatientMpiGender;
  bloodType?: string;
  bhytNumber?: string;
  nationalId?: string;
  actor: HospitalPatientMpiActorDTO;
}

export interface HospitalGetFoundationPatientDTO {
  tenantId: string;
  patientId: string;
  actor: HospitalPatientMpiActorDTO;
}

export interface HospitalFindFoundationPatientByIdentifierDTO {
  tenantId: string;
  identifierType: PatientMpiIdentifierType;
  identifierValue: string;
  actor: HospitalPatientMpiActorDTO;
}

export interface HospitalSearchFoundationPatientsDTO {
  tenantId: string;
  displayNameLike?: string;
  identifierType?: PatientMpiIdentifierType;
  identifierValue?: string;
  limit?: number;
  offset?: number;
  actor: HospitalPatientMpiActorDTO;
}

export interface HospitalPatientIdentityDTO {
  tenantId: string;
  patientId: string;
  displayName: string;
  legalName?: string;
  dob?: string;
  gender?: PatientMpiGender;
  bloodType?: string;
  identifiers: PatientMpiIdentifierDTO[];
}

type HospitalPatientMpiContract = Pick<
  PatientMpiContract,
  'registerPatient' | 'getPatientById' | 'findPatientByIdentifier' | 'searchPatients'
>;

export class HospitalPatientMpiProductService {
  constructor(private readonly patientMpiContract: HospitalPatientMpiContract) {}

  async registerFoundationPatient(
    dto: HospitalRegisterFoundationPatientDTO
  ): Promise<HospitalPatientIdentityDTO> {
    assertTenant(dto.tenantId);
    assertActor(dto.actor);
    assertAuthorized(dto.actor.role, 'registerPatient');
    if (!dto.displayName.trim()) {
      throw new Error('PATIENT_MPI_VALIDATION_FAILED: displayName is required');
    }

    const request: RegisterPatientRequest = {
      tenantId: dto.tenantId,
      displayName: dto.displayName,
      legalName: dto.legalName,
      dob: dto.dob,
      gender: dto.gender,
      bloodType: dto.bloodType,
      bhytNumber: dto.bhytNumber,
      nationalId: dto.nationalId,
      actorId: dto.actor.actorId,
    };

    const patient = unwrapRequiredEngineResponse(
      await this.patientMpiContract.registerPatient(request),
      'PATIENT_MPI_REGISTER_FAILED'
    );

    return mapPatient(patient);
  }

  async getFoundationPatient(dto: HospitalGetFoundationPatientDTO): Promise<HospitalPatientIdentityDTO> {
    assertTenant(dto.tenantId);
    assertActor(dto.actor);
    assertAuthorized(dto.actor.role, 'getPatientById');
    if (!dto.patientId.trim()) {
      throw new Error('PATIENT_MPI_VALIDATION_FAILED: patientId is required');
    }

    const request: GetPatientByIdRequest = {
      tenantId: dto.tenantId,
      patientId: dto.patientId,
    };

    const patient = unwrapRequiredEngineResponse(
      await this.patientMpiContract.getPatientById(request),
      'PATIENT_MPI_GET_FAILED'
    );

    return mapPatient(patient);
  }

  async findFoundationPatientByIdentifier(
    dto: HospitalFindFoundationPatientByIdentifierDTO
  ): Promise<HospitalPatientIdentityDTO | null> {
    assertTenant(dto.tenantId);
    assertActor(dto.actor);
    assertAuthorized(dto.actor.role, 'findPatientByIdentifier');
    if (!dto.identifierValue.trim()) {
      throw new Error('PATIENT_MPI_VALIDATION_FAILED: identifierValue is required');
    }

    const request: FindPatientByIdentifierRequest = {
      tenantId: dto.tenantId,
      identifierType: dto.identifierType,
      identifierValue: dto.identifierValue,
    };

    const patient = unwrapNullableEngineResponse(
      await this.patientMpiContract.findPatientByIdentifier(request),
      'PATIENT_MPI_FIND_FAILED'
    );

    return patient ? mapPatient(patient) : null;
  }

  async searchFoundationPatients(
    dto: HospitalSearchFoundationPatientsDTO
  ): Promise<HospitalPatientIdentityDTO[]> {
    assertTenant(dto.tenantId);
    assertActor(dto.actor);
    assertAuthorized(dto.actor.role, 'searchPatients');
    if (dto.limit !== undefined && (dto.limit < 1 || dto.limit > 100)) {
      throw new Error('PATIENT_MPI_VALIDATION_FAILED: limit must be between 1 and 100');
    }

    const request: SearchPatientsRequest = {
      tenantId: dto.tenantId,
      displayNameLike: dto.displayNameLike,
      identifierType: dto.identifierType,
      identifierValue: dto.identifierValue,
      limit: dto.limit,
      offset: dto.offset,
    };

    const patients = unwrapRequiredEngineResponse(
      await this.patientMpiContract.searchPatients(request),
      'PATIENT_MPI_SEARCH_FAILED'
    );

    return patients.map(mapPatient);
  }
}

function assertTenant(tenantId: string): void {
  if (!tenantId.trim()) {
    throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
  }
}

function assertActor(actor: HospitalPatientMpiActorDTO): void {
  if (!actor.actorId.trim()) {
    throw new Error('AUTHORIZATION_VIOLATION: actorId is required');
  }
}

function assertAuthorized(role: HospitalPatientMpiActorRole, operation: string): void {
  const allowedRoles: HospitalPatientMpiActorRole[] = ['receptionist', 'nurse', 'doctor', 'admin'];
  if (!allowedRoles.includes(role)) {
    throw new Error(`AUTHORIZATION_VIOLATION: ${role} cannot ${operation}`);
  }
}

function mapPatient(patient: PatientMpiDTO): HospitalPatientIdentityDTO {
  return {
    tenantId: patient.tenantId,
    patientId: patient.patientId,
    displayName: patient.displayName,
    legalName: patient.legalName,
    dob: patient.dob,
    gender: patient.gender,
    bloodType: patient.bloodType,
    identifiers: patient.identifiers,
  };
}

function unwrapRequiredEngineResponse<T>(response: EngineResponse<T>, fallbackCode: string): T {
  if (response.success && response.data !== undefined) {
    return response.data;
  }

  const code = response.error?.code ?? fallbackCode;
  const message = response.error?.message ?? fallbackCode;
  throw new Error(`${code}: ${message}`);
}

function unwrapNullableEngineResponse<T>(response: EngineResponse<T | null>, fallbackCode: string): T | null {
  if (response.success) {
    return response.data ?? null;
  }

  const code = response.error?.code ?? fallbackCode;
  const message = response.error?.message ?? fallbackCode;
  throw new Error(`${code}: ${message}`);
}
