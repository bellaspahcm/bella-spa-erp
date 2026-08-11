/**
 * Encounter Engine Types
 * 
 * @layer Healthcare Platform → Encounter Engine
 * @責任 Shared types for Encounter Engine public API
 */

// Re-export domain types for public API
export type {
  EncounterType,
  EncounterClass,
  EncounterStatus,
  EncounterPeriod,
  EncounterProvenance,
  CreateEncounterData,
  EncounterProps,
} from './domain/encounter.entity';

// Re-export domain errors
export {
  EncounterDomainError,
  InvalidStateTransitionError,
  InvalidPeriodError,
  EncounterAlreadyFinishedError,
  MissingRequiredFieldError,
  TenantBoundaryViolationError,
} from './domain/encounter.entity';

/**
 * Encounter state for DTOs
 */
export interface EncounterState {
  id: string;
  tenantId: string;
  patientId: string;
  encounterNumber?: string;
  status: string;
  encounterClass: string;
  encounterType: string;
  priority?: string;
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

/**
 * Encounter diagnosis
 */
export interface EncounterDiagnosis {
  code: string;
  system: string;
  display?: string;
  isPrimary: boolean;
  onsetDate?: string;
  clinicalStatus?: string;
  verificationStatus?: string;
  notes?: string;
  recordedAt: string;
  recordedBy: string;
}

/**
 * Encounter participant (provider/practitioner)
 */
export interface EncounterParticipant {
  providerId: string;
  role: string;
  assignedAt: string;
  assignedBy: string;
}

/**
 * Domain event base
 */
export interface EncounterDomainEvent {
  eventType: string;
  aggregateId: string;
  aggregateType: 'Encounter';
  payload: Record<string, unknown>;
  metadata: {
    userId?: string;
    correlationId?: string;
    causationId?: string;
  };
  occurredAt: string;
}

// Priority enum for backwards compatibility with service
export enum EncounterPriority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
  ELECTIVE = 'elective',
}
