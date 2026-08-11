/**
 * Encounter Engine Interface
 * 
 * Public API contract for Encounter Engine.
 * Consumed by Hospital Product Pack and other healthcare products.
 * 
 * Constitution Compliance:
 * - Law 3: Execution-Engine Decoupled Model
 * - Law 5: Event-First Architecture
 * - Law 8: Registry-First & ADR
 * 
 * @module platform/healthcare/engines/encounter-engine/service
 */

import type { Encounter, EncounterStatus, EncounterType } from '../domain/encounter.entity';

// ============================================================================
// Engine Interface
// ============================================================================

export interface IEncounterEngine {
  /**
   * Register a new encounter (patient arrives or scheduled)
   * 
   * @param request - Registration request
   * @returns Created encounter
   * @throws EncounterEngineError if validation fails
   * 
   * Events Published:
   * - EncounterCreated (always)
   * - EncounterArrived (if status = 'arrived')
   */
  registerEncounter(request: RegisterEncounterRequest): Promise<EncounterEngineResponse<Encounter>>;

  /**
   * Mark patient as arrived (for scheduled encounters)
   * 
   * @param request - Arrival request
   * @returns Updated encounter
   * @throws EncounterEngineError if encounter not found or invalid state
   * 
   * Events Published:
   * - EncounterArrived
   */
  markArrived(request: MarkArrivedRequest): Promise<EncounterEngineResponse<Encounter>>;

  /**
   * Triage patient (emergency department)
   * 
   * @param request - Triage request
   * @returns Updated encounter
   * @throws EncounterEngineError if encounter not found or invalid state
   * 
   * Events Published:
   * - EncounterTriaged
   */
  triageEncounter(request: TriageEncounterRequest): Promise<EncounterEngineResponse<Encounter>>;

  /**
   * Start treatment/consultation
   * 
   * @param request - Start treatment request
   * @returns Updated encounter
   * @throws EncounterEngineError if encounter not found or invalid state
   * 
   * Events Published:
   * - EncounterStarted
   */
  startTreatment(request: StartTreatmentRequest): Promise<EncounterEngineResponse<Encounter>>;

  /**
   * Put encounter on hold (temporary interruption)
   * 
   * @param request - Hold request
   * @returns Updated encounter
   * @throws EncounterEngineError if encounter not found or invalid state
   * 
   * Events Published:
   * - EncounterHeld
   */
  holdEncounter(request: HoldEncounterRequest): Promise<EncounterEngineResponse<Encounter>>;

  /**
   * Resume encounter from hold
   * 
   * @param request - Resume request
   * @returns Updated encounter
   * @throws EncounterEngineError if encounter not found or invalid state
   * 
   * Events Published:
   * - EncounterResumed
   */
  resumeEncounter(request: ResumeEncounterRequest): Promise<EncounterEngineResponse<Encounter>>;

  /**
   * Finish encounter (discharge/check-out)
   * 
   * @param request - Finish request
   * @returns Updated encounter
   * @throws EncounterEngineError if encounter not found or invalid state
   * 
   * Events Published:
   * - EncounterFinished
   */
  finishEncounter(request: FinishEncounterRequest): Promise<EncounterEngineResponse<Encounter>>;

  /**
   * Cancel encounter
   * 
   * @param request - Cancel request
   * @returns Updated encounter
   * @throws EncounterEngineError if encounter not found or invalid state
   * 
   * Events Published:
   * - EncounterCancelled
   */
  cancelEncounter(request: CancelEncounterRequest): Promise<EncounterEngineResponse<Encounter>>;

  /**
   * Add diagnosis to encounter
   * 
   * @param request - Add diagnosis request
   * @returns Updated encounter
   * @throws EncounterEngineError if encounter not found
   * 
   * Events Published:
   * - DiagnosisAdded
   */
  addDiagnosis(request: AddDiagnosisRequest): Promise<EncounterEngineResponse<Encounter>>;

  /**
   * Assign provider to encounter
   * 
   * @param request - Assign provider request
   * @returns Updated encounter
   * @throws EncounterEngineError if encounter not found
   * 
   * Events Published:
   * - ProviderAssigned
   */
  assignProvider(request: AssignProviderRequest): Promise<EncounterEngineResponse<Encounter>>;

  /**
   * Transfer encounter to different department/location
   * 
   * @param request - Transfer request
   * @returns Updated encounter
   * @throws EncounterEngineError if encounter not found or invalid state
   * 
   * Events Published:
   * - EncounterTransferred
   */
  transferEncounter(request: TransferEncounterRequest): Promise<EncounterEngineResponse<Encounter>>;

  /**
   * Get encounter by ID
   * 
   * @param request - Get request
   * @returns Encounter or null if not found
   */
  getEncounter(request: GetEncounterRequest): Promise<EncounterEngineResponse<Encounter | null>>;

  /**
   * Query encounters by criteria
   * 
   * @param request - Query request
   * @returns Paginated encounters
   */
  queryEncounters(request: QueryEncountersRequest): Promise<EncounterEngineResponse<EncounterQueryResult>>;
}

// ============================================================================
// Request Types
// ============================================================================

export interface RegisterEncounterRequest {
  tenantId: string;
  patientId: string; // Person Center ID
  encounterType: EncounterType;
  encounterClass: 'AMB' | 'EMER' | 'IMP' | 'HH' | 'VR';
  status?: EncounterStatus; // Default: 'planned' or 'arrived'
  serviceProviderId?: string; // Person Center ID of provider
  departmentId?: string;
  locationId?: string;
  reasonCode?: string[];
  scheduledTime?: Date;
  userId: string; // User registering the encounter
}

export interface MarkArrivedRequest {
  encounterId: string;
  tenantId: string;
  arrivedAt?: Date; // Default: now
  userId: string;
}

export interface TriageEncounterRequest {
  encounterId: string;
  tenantId: string;
  triageLevel: 1 | 2 | 3 | 4 | 5; // ESI (Emergency Severity Index)
  chiefComplaint: string;
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
  userId: string;
}

export interface StartTreatmentRequest {
  encounterId: string;
  tenantId: string;
  serviceProviderId?: string; // Assign provider if not already assigned
  startedAt?: Date; // Default: now
  userId: string;
}

export interface HoldEncounterRequest {
  encounterId: string;
  tenantId: string;
  reason: string;
  userId: string;
}

export interface ResumeEncounterRequest {
  encounterId: string;
  tenantId: string;
  userId: string;
}

export interface FinishEncounterRequest {
  encounterId: string;
  tenantId: string;
  finishedAt?: Date; // Default: now
  dischargeInstructions?: string;
  followUpDate?: Date;
  userId: string;
}

export interface CancelEncounterRequest {
  encounterId: string;
  tenantId: string;
  reason: string;
  userId: string;
}

export interface AddDiagnosisRequest {
  encounterId: string;
  tenantId: string;
  diagnosis: {
    code: string; // ICD-10 code
    display: string;
    isPrimary: boolean;
    onsetDate?: Date;
    notes?: string;
  };
  userId: string;
}

export interface AssignProviderRequest {
  encounterId: string;
  tenantId: string;
  serviceProviderId: string; // Person Center ID
  role?: string; // e.g., 'attending', 'consultant', 'resident'
  userId: string;
}

export interface TransferEncounterRequest {
  encounterId: string;
  tenantId: string;
  toDepartmentId?: string;
  toLocationId?: string;
  reason: string;
  userId: string;
}

export interface GetEncounterRequest {
  encounterId: string;
  tenantId: string;
}

export interface QueryEncountersRequest {
  tenantId: string;
  patientId?: string;
  serviceProviderId?: string;
  departmentId?: string;
  locationId?: string;
  status?: EncounterStatus | EncounterStatus[];
  encounterType?: EncounterType;
  encounterClass?: 'AMB' | 'EMER' | 'IMP' | 'HH' | 'VR';
  startDateFrom?: Date;
  startDateTo?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface EncounterEngineResponse<T> {
  success: boolean;
  data?: T;
  error?: EncounterEngineError;
  metadata?: {
    executionTimeMs: number;
    eventPublished: boolean;
    warnings?: string[];
  };
}

export interface EncounterQueryResult {
  encounters: Encounter[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface EncounterEngineError {
  code: EncounterErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
}

export type EncounterErrorCode =
  | 'ENCOUNTER_NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'VALIDATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'TENANT_ISOLATION_VIOLATION'
  | 'PATIENT_NOT_FOUND'
  | 'PROVIDER_NOT_FOUND'
  | 'DEPARTMENT_NOT_FOUND'
  | 'LOCATION_NOT_FOUND'
  | 'DATABASE_ERROR'
  | 'EVENT_PUBLISH_ERROR'
  | 'UNKNOWN_ERROR';
