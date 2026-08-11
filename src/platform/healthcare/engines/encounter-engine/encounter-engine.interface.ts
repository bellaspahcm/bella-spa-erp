/**
 * Encounter Engine Interface
 * 
 * @layer Healthcare Platform → Encounter Engine
 * @責任 Public API contract for Encounter Engine
 * 
 * This interface defines the complete API that Hospital Product Pack will consume.
 * All methods return standardized Response objects with success/error handling.
 */

import type {
  EncounterClass,
  EncounterStatus,
  EncounterType,
  EncounterDiagnosis,
  EncounterParticipant,
  EncounterPriority,
} from './encounter.types';

/**
 * ✅ Phase 3 - Encounter Engine Interface
 * 
 * Hospital consumes this interface, NOT the service implementation directly.
 * This enables:
 * - Contract-based development
 * - Easy mocking for tests
 * - Implementation swap without breaking Hospital
 */
export interface IEncounterEngine {
  /**
   * Create a new encounter (visit)
   */
  createEncounter(
    request: CreateEncounterRequest
  ): Promise<CreateEncounterResponse>;

  /**
   * Update encounter status (state transition)
   */
  updateStatus(
    request: UpdateEncounterStatusRequest
  ): Promise<UpdateEncounterStatusResponse>;

  /**
   * Add diagnosis (ICD-10/ICD-11) to encounter
   */
  addDiagnosis(request: AddDiagnosisRequest): Promise<AddDiagnosisResponse>;

  /**
   * Assign provider (doctor/practitioner) to encounter
   */
  assignProvider(
    request: AssignProviderRequest
  ): Promise<AssignProviderResponse>;

  /**
   * Transfer encounter to different department/location
   */
  transferEncounter(
    request: TransferEncounterRequest
  ): Promise<TransferEncounterResponse>;

  /**
   * Get encounter by ID
   */
  getEncounter(request: GetEncounterRequest): Promise<GetEncounterResponse>;

  /**
   * Search encounters with filters
   */
  searchEncounters(
    request: SearchEncountersRequest
  ): Promise<SearchEncountersResponse>;
}

// =============================================================================
// Request/Response DTOs
// =============================================================================

/**
 * Create Encounter
 */
export interface CreateEncounterRequest {
  tenantId: string;
  patientId: string;
  encounterClass?: EncounterClass;
  encounterType?: EncounterType;
  priority?: EncounterPriority;
  serviceType?: string;
  admittingProviderId?: string;
  admittingDepartmentId?: string;
  chiefComplaint?: string;
  referralSource?: string;
  userId: string;
}

export interface CreateEncounterResponse {
  success: boolean;
  encounter?: EncounterDTO;
  error?: string;
}

/**
 * Update Status
 */
export interface UpdateEncounterStatusRequest {
  tenantId: string;
  encounterId: string;
  status: EncounterStatus;
  reason?: string;
  userId: string;
}

export interface UpdateEncounterStatusResponse {
  success: boolean;
  encounter?: EncounterDTO;
  error?: string;
}

/**
 * Add Diagnosis
 */
export interface AddDiagnosisRequest {
  tenantId: string;
  encounterId: string;
  code: string;
  system: string; // 'ICD-10', 'ICD-11', 'SNOMED-CT'
  display?: string;
  isPrimary?: boolean;
  onsetDate?: string;
  clinicalStatus?: string;
  verificationStatus?: string;
  notes?: string;
  userId: string;
}

export interface AddDiagnosisResponse {
  success: boolean;
  encounter?: EncounterDTO;
  error?: string;
}

/**
 * Assign Provider
 */
export interface AssignProviderRequest {
  tenantId: string;
  encounterId: string;
  providerId: string;
  role: string; // 'attending', 'consulting', 'resident', etc.
  userId: string;
}

export interface AssignProviderResponse {
  success: boolean;
  encounter?: EncounterDTO;
  error?: string;
}

/**
 * Transfer Encounter
 */
export interface TransferEncounterRequest {
  tenantId: string;
  encounterId: string;
  toDepartmentId?: string;
  toLocationId?: string;
  reason?: string;
  userId: string;
}

export interface TransferEncounterResponse {
  success: boolean;
  encounter?: EncounterDTO;
  error?: string;
}

/**
 * Get Encounter
 */
export interface GetEncounterRequest {
  tenantId: string;
  encounterId: string;
}

export interface GetEncounterResponse {
  success: boolean;
  encounter?: EncounterDTO;
  error?: string;
}

/**
 * Search Encounters
 */
export interface SearchEncountersRequest {
  tenantId: string;
  patientId?: string;
  status?: EncounterStatus;
  encounterClass?: EncounterClass;
  departmentId?: string;
  providerId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export interface SearchEncountersResponse {
  success: boolean;
  encounters: EncounterDTO[];
  total: number;
  error?: string;
}

/**
 * Encounter DTO (Data Transfer Object)
 * 
 * This is what Hospital UI receives
 */
export interface EncounterDTO {
  id: string;
  tenantId: string;
  patientId: string;
  encounterNumber?: string;
  status: EncounterStatus;
  encounterClass: EncounterClass;
  encounterType: EncounterType;
  priority?: EncounterPriority;
  serviceType?: string;
  admittingProviderId?: string;
  admittingDepartmentId?: string;
  currentDepartmentId?: string;
  currentLocationId?: string;
  chiefComplaint?: string;
  diagnoses: EncounterDiagnosis[];
  participants: EncounterParticipant[];
  referralSource?: string;
  registeredAt?: string;
  arrivedAt?: string;
  triagedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  duration?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
