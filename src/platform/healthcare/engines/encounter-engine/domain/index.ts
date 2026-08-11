/**
 * Encounter Engine - Domain Layer Exports
 * 
 * @module platform/healthcare/engines/encounter-engine/domain
 */

/**
 * Encounter Engine - Domain Layer Exports
 * 
 * @module platform/healthcare/engines/encounter-engine/domain
 */

// ===========================
// Entity (value export)
// ===========================
export { Encounter } from './encounter.entity';

// ===========================
// Types & Enums (type-only exports for isolatedModules compliance)
// ===========================
export type { EncounterType, EncounterClass, EncounterStatus } from './encounter.entity';
export type {
  EncounterPeriod,
  EncounterProvenance,
  CreateEncounterData,
  EncounterProps,
} from './encounter.entity';

// ===========================
// Errors (value exports)
// ===========================
export {
  EncounterDomainError,
  InvalidStateTransitionError,
  InvalidPeriodError,
  EncounterAlreadyFinishedError,
  MissingRequiredFieldError,
  TenantBoundaryViolationError,
} from './encounter.entity';

// ===========================
// Events (value exports)
// ===========================
export { EncounterEventFactory } from './encounter.events';
export type { ENCOUNTER_EVENT_TYPES } from './encounter.events';

export type {
  EncounterCreatedEvent,
  EncounterArrivedEvent,
  EncounterTriagedEvent,
  EncounterStartedEvent,
  EncounterHeldEvent,
  EncounterResumedEvent,
  EncounterFinishedEvent,
  EncounterCancelledEvent,
  DiagnosisAddedEvent,
  ProviderAssignedEvent,
  EncounterTransferredEvent,
} from './encounter.events';

// ===========================
// Event Payloads (type-only exports)
// ===========================
export type {
  EncounterCreatedPayload,
  EncounterArrivedPayload,
  EncounterTriagedPayload,
  EncounterStartedPayload,
  EncounterHeldPayload,
  EncounterResumedPayload,
  EncounterFinishedPayload,
  EncounterCancelledPayload,
  DiagnosisAddedPayload,
  ProviderAssignedPayload,
  EncounterTransferredPayload,
} from './encounter.events';
