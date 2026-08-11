/**
 * Encounter Engine - Domain Layer Exports
 * 
 * @module platform/healthcare/engines/encounter-engine/domain
 */

export {
  Encounter,
  EncounterType,
  EncounterClass,
  EncounterStatus,
  EncounterPeriod,
  EncounterProvenance,
  CreateEncounterData,
  EncounterProps,
  EncounterDomainError,
  InvalidStateTransitionError,
  InvalidPeriodError,
  EncounterAlreadyFinishedError,
  MissingRequiredFieldError,
  TenantBoundaryViolationError,
} from './encounter.entity';

export {
  EncounterEventFactory,
  ENCOUNTER_EVENT_TYPES,
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
