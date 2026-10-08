/**
 * BELLA HOSPITAL - ENCOUNTER FOUNDATION PRODUCT SERVICE
 *
 * Minimal Hospital runtime integration with the public Healthcare Encounter
 * contract. This service does not access Encounter internals, direct DB tables,
 * legacy healthcare services, Admission, Bed, Nursing, Pharmacy, CDS,
 * Temporal/Audit, Billing, or Finance.
 *
 * @module src/products/bella-hospital/services/hospital-encounter.service
 */

import type {
  CreateEncounterRequest,
  EncounterDTO,
  IEncounterEngine,
} from '../../../platform/healthcare/contracts/encounter-engine.contract';

export type HospitalEncounterActorRole = 'receptionist' | 'nurse' | 'doctor' | 'admin';

export interface HospitalEncounterActorDTO {
  actorId: string;
  role: HospitalEncounterActorRole;
}

export interface HospitalCreateFoundationEncounterDTO {
  tenantId: string;
  patientId: string;
  encounterClass: NonNullable<CreateEncounterRequest['encounterClass']>;
  encounterType: NonNullable<CreateEncounterRequest['encounterType']>;
  priority?: CreateEncounterRequest['priority'];
  serviceType?: string;
  admittingProviderId?: string;
  admittingDepartmentId?: string;
  chiefComplaint?: string;
  referralSource?: string;
  actor: HospitalEncounterActorDTO;
}

export interface HospitalGetFoundationEncounterDTO {
  tenantId: string;
  encounterId: string;
  actor: HospitalEncounterActorDTO;
}

export interface HospitalAssignFoundationProviderDTO {
  tenantId: string;
  encounterId: string;
  providerId: string;
  role: string;
  actor: HospitalEncounterActorDTO;
}

export interface HospitalSearchFoundationEncountersDTO {
  tenantId: string;
  patientId?: string;
  status?: EncounterDTO['status'];
  encounterClass?: EncounterDTO['encounterClass'];
  departmentId?: string;
  providerId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
  actor: HospitalEncounterActorDTO;
}

export interface HospitalEncounterIdentityDTO {
  tenantId: string;
  encounterId: string;
  patientId: string;
  status: EncounterDTO['status'];
  encounterClass: EncounterDTO['encounterClass'];
  encounterType: EncounterDTO['encounterType'];
  currentDepartmentId?: string;
  currentLocationId?: string;
  admittingProviderId?: string;
  admittingDepartmentId?: string;
  createdAt: string;
  updatedAt: string;
}

type HospitalEncounterContract = Pick<
  IEncounterEngine,
  'createEncounter' | 'getEncounter' | 'assignProvider' | 'searchEncounters'
>;

type GetEncounterRequest = Parameters<IEncounterEngine['getEncounter']>[0];
type AssignProviderRequest = Parameters<IEncounterEngine['assignProvider']>[0];
type SearchEncountersRequest = Parameters<IEncounterEngine['searchEncounters']>[0];

export class HospitalEncounterProductService {
  constructor(private readonly encounterContract: HospitalEncounterContract) {}

  async createFoundationEncounter(
    dto: HospitalCreateFoundationEncounterDTO
  ): Promise<HospitalEncounterIdentityDTO> {
    assertTenant(dto.tenantId);
    assertActor(dto.actor);
    assertAuthorized(dto.actor.role, 'createEncounter');
    assertRequired(dto.patientId, 'patientId');

    const request: CreateEncounterRequest = {
      tenantId: dto.tenantId,
      patientId: dto.patientId,
      encounterClass: dto.encounterClass,
      encounterType: dto.encounterType,
      priority: dto.priority,
      serviceType: dto.serviceType,
      admittingProviderId: dto.admittingProviderId,
      admittingDepartmentId: dto.admittingDepartmentId,
      chiefComplaint: dto.chiefComplaint,
      referralSource: dto.referralSource,
      userId: dto.actor.actorId,
    };

    const encounter = unwrapEncounterResponse(
      await this.encounterContract.createEncounter(request),
      'ENCOUNTER_CREATE_FAILED'
    );

    return mapEncounter(encounter);
  }

  async getFoundationEncounter(dto: HospitalGetFoundationEncounterDTO): Promise<HospitalEncounterIdentityDTO> {
    assertTenant(dto.tenantId);
    assertActor(dto.actor);
    assertAuthorized(dto.actor.role, 'getEncounter');
    assertRequired(dto.encounterId, 'encounterId');

    const request: GetEncounterRequest = {
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
    };

    const encounter = unwrapEncounterResponse(
      await this.encounterContract.getEncounter(request),
      'ENCOUNTER_GET_FAILED'
    );

    return mapEncounter(encounter);
  }

  async assignFoundationProvider(
    dto: HospitalAssignFoundationProviderDTO
  ): Promise<HospitalEncounterIdentityDTO> {
    assertTenant(dto.tenantId);
    assertActor(dto.actor);
    assertAuthorized(dto.actor.role, 'assignProvider');
    assertRequired(dto.encounterId, 'encounterId');
    assertRequired(dto.providerId, 'providerId');
    assertRequired(dto.role, 'role');

    const request: AssignProviderRequest = {
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      providerId: dto.providerId,
      role: dto.role,
      userId: dto.actor.actorId,
    };

    const encounter = unwrapEncounterResponse(
      await this.encounterContract.assignProvider(request),
      'ENCOUNTER_ASSIGN_PROVIDER_FAILED'
    );

    return mapEncounter(encounter);
  }

  async searchFoundationEncounters(
    dto: HospitalSearchFoundationEncountersDTO
  ): Promise<HospitalEncounterIdentityDTO[]> {
    assertTenant(dto.tenantId);
    assertActor(dto.actor);
    assertAuthorized(dto.actor.role, 'searchEncounters');
    if (dto.limit !== undefined && (dto.limit < 1 || dto.limit > 100)) {
      throw new Error('ENCOUNTER_VALIDATION_FAILED: limit must be between 1 and 100');
    }

    const request: SearchEncountersRequest = {
      tenantId: dto.tenantId,
      patientId: dto.patientId,
      status: dto.status,
      encounterClass: dto.encounterClass,
      departmentId: dto.departmentId,
      providerId: dto.providerId,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      limit: dto.limit,
      offset: dto.offset,
    };

    const response = await this.encounterContract.searchEncounters(request);
    if (!response.success) {
      throw new Error(`ENCOUNTER_SEARCH_FAILED: ${response.error ?? 'ENCOUNTER_SEARCH_FAILED'}`);
    }

    return response.encounters.map(mapEncounter);
  }
}

function assertTenant(tenantId: string): void {
  if (!tenantId.trim()) {
    throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
  }
}

function assertActor(actor: HospitalEncounterActorDTO): void {
  if (!actor.actorId.trim()) {
    throw new Error('AUTHORIZATION_VIOLATION: actorId is required');
  }
}

function assertAuthorized(role: HospitalEncounterActorRole, operation: string): void {
  const allowedByOperation: Record<string, HospitalEncounterActorRole[]> = {
    createEncounter: ['receptionist', 'nurse', 'doctor', 'admin'],
    getEncounter: ['receptionist', 'nurse', 'doctor', 'admin'],
    assignProvider: ['nurse', 'doctor', 'admin'],
    searchEncounters: ['receptionist', 'nurse', 'doctor', 'admin'],
  };
  const allowedRoles = allowedByOperation[operation] ?? [];

  if (!allowedRoles.includes(role)) {
    throw new Error(`AUTHORIZATION_VIOLATION: ${role} cannot ${operation}`);
  }
}

function assertRequired(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`ENCOUNTER_VALIDATION_FAILED: ${field} is required`);
  }
}

function mapEncounter(encounter: EncounterDTO): HospitalEncounterIdentityDTO {
  return {
    tenantId: encounter.tenantId,
    encounterId: encounter.id,
    patientId: encounter.patientId,
    status: encounter.status,
    encounterClass: encounter.encounterClass,
    encounterType: encounter.encounterType,
    currentDepartmentId: encounter.currentDepartmentId,
    currentLocationId: encounter.currentLocationId,
    admittingProviderId: encounter.admittingProviderId,
    admittingDepartmentId: encounter.admittingDepartmentId,
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt,
  };
}

function unwrapEncounterResponse(
  response: { success: boolean; encounter?: EncounterDTO; error?: string },
  fallbackCode: string
): EncounterDTO {
  if (response.success && response.encounter) {
    return response.encounter;
  }

  throw new Error(`${fallbackCode}: ${response.error ?? fallbackCode}`);
}
