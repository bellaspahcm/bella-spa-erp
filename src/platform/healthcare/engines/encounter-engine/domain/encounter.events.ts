/**
 * Encounter Domain Events
 * 
 * Constitution Compliance:
 * - Law 5: Event-First Architecture - all state changes publish events
 * - Law 11: Strictly typed, no `any` types allowed
 * 
 * These events are published to the Event Bus when encounter state changes occur.
 * Downstream systems (Billing, Analytics, Notification) subscribe to these events.
 * 
 * @module platform/healthcare/engines/encounter-engine/domain
 */

import type { DomainEvent, Diagnosis } from '@/platform/healthcare/shared-kernel/types';
import type { EncounterStatus, EncounterType, EncounterClass } from './encounter.entity';

// ============================================================================
// Base Event Metadata
// ============================================================================

interface EncounterEventMetadata {
  userId: string;
  sessionId?: string;
  correlationId?: string;
  source: 'encounter-engine';
}

// ============================================================================
// Event Payloads
// ============================================================================

export interface EncounterCreatedPayload {
  encounterId: string;
  tenantId: string;
  patientId: string;
  encounterType: EncounterType;
  encounterClass: EncounterClass;
  status: EncounterStatus;
  startDateTime: string; // ISO 8601
  serviceProviderId?: string;
  departmentId?: string;
  locationId?: string;
  reasonCode: string[];
  isEmergency: boolean;
  createdBy: string;
  createdAt: string; // ISO 8601
}

export interface EncounterArrivedPayload {
  encounterId: string;
  tenantId: string;
  patientId: string;
  arrivedAt: string; // ISO 8601
  previousStatus: EncounterStatus;
  currentStatus: 'arrived';
}

export interface EncounterTriagedPayload {
  encounterId: string;
  tenantId: string;
  patientId: string;
  triagedAt: string; // ISO 8601
  previousStatus: EncounterStatus;
  currentStatus: 'triaged';
  encounterClass: 'EMER';
}

export interface EncounterStartedPayload {
  encounterId: string;
  tenantId: string;
  patientId: string;
  startedAt: string; // ISO 8601
  previousStatus: EncounterStatus;
  currentStatus: 'in-progress';
  serviceProviderId?: string;
}

export interface EncounterHeldPayload {
  encounterId: string;
  tenantId: string;
  patientId: string;
  heldAt: string; // ISO 8601
  reason?: string;
  previousStatus: EncounterStatus;
  currentStatus: 'on-hold';
}

export interface EncounterResumedPayload {
  encounterId: string;
  tenantId: string;
  patientId: string;
  resumedAt: string; // ISO 8601
  previousStatus: 'on-hold';
  currentStatus: 'in-progress';
}

export interface EncounterFinishedPayload {
  encounterId: string;
  tenantId: string;
  patientId: string;
  finishedAt: string; // ISO 8601
  startDateTime: string; // ISO 8601
  endDateTime: string; // ISO 8601
  durationMinutes: number;
  previousStatus: EncounterStatus;
  currentStatus: 'finished';
  diagnosisCodes: string[];
  serviceProviderId?: string;
}

export interface EncounterCancelledPayload {
  encounterId: string;
  tenantId: string;
  patientId: string;
  cancelledAt: string; // ISO 8601
  reason: string;
  previousStatus: EncounterStatus;
  currentStatus: 'cancelled';
}

export interface DiagnosisAddedPayload {
  encounterId: string;
  tenantId: string;
  patientId: string;
  diagnosis: Diagnosis;
  addedAt: string; // ISO 8601
  addedBy: string;
}

export interface ProviderAssignedPayload {
  encounterId: string;
  tenantId: string;
  patientId: string;
  serviceProviderId: string;
  previousProviderId?: string;
  assignedAt: string; // ISO 8601
  assignedBy: string;
}

export interface EncounterTransferredPayload {
  encounterId: string;
  tenantId: string;
  patientId: string;
  fromDepartmentId?: string;
  toDepartmentId: string;
  fromLocationId?: string;
  toLocationId: string;
  transferredAt: string; // ISO 8601
  transferredBy: string;
}

// ============================================================================
// Event Types
// ============================================================================

export type EncounterCreatedEvent = DomainEvent<EncounterCreatedPayload>;
export type EncounterArrivedEvent = DomainEvent<EncounterArrivedPayload>;
export type EncounterTriagedEvent = DomainEvent<EncounterTriagedPayload>;
export type EncounterStartedEvent = DomainEvent<EncounterStartedPayload>;
export type EncounterHeldEvent = DomainEvent<EncounterHeldPayload>;
export type EncounterResumedEvent = DomainEvent<EncounterResumedPayload>;
export type EncounterFinishedEvent = DomainEvent<EncounterFinishedPayload>;
export type EncounterCancelledEvent = DomainEvent<EncounterCancelledPayload>;
export type DiagnosisAddedEvent = DomainEvent<DiagnosisAddedPayload>;
export type ProviderAssignedEvent = DomainEvent<ProviderAssignedPayload>;
export type EncounterTransferredEvent = DomainEvent<EncounterTransferredPayload>;

// ============================================================================
// Event Type Constants
// ============================================================================

export const ENCOUNTER_EVENT_TYPES = {
  ENCOUNTER_CREATED: 'healthcare.encounter.created.v1',
  ENCOUNTER_ARRIVED: 'healthcare.encounter.arrived.v1',
  ENCOUNTER_TRIAGED: 'healthcare.encounter.triaged.v1',
  ENCOUNTER_STARTED: 'healthcare.encounter.started.v1',
  ENCOUNTER_HELD: 'healthcare.encounter.held.v1',
  ENCOUNTER_RESUMED: 'healthcare.encounter.resumed.v1',
  ENCOUNTER_FINISHED: 'healthcare.encounter.finished.v1',
  ENCOUNTER_CANCELLED: 'healthcare.encounter.cancelled.v1',
  DIAGNOSIS_ADDED: 'healthcare.encounter.diagnosis-added.v1',
  PROVIDER_ASSIGNED: 'healthcare.encounter.provider-assigned.v1',
  ENCOUNTER_TRANSFERRED: 'healthcare.encounter.transferred.v1',
} as const;

// ============================================================================
// Event Factory Functions
// ============================================================================

export class EncounterEventFactory {
  static createEncounterCreatedEvent(
    payload: EncounterCreatedPayload,
    metadata: EncounterEventMetadata
  ): EncounterCreatedEvent {
    return {
      eventType: ENCOUNTER_EVENT_TYPES.ENCOUNTER_CREATED,
      eventVersion: '1.0.0',
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tenantId: payload.tenantId,
      aggregateId: payload.encounterId,
      aggregateType: 'encounter',
      payload,
      metadata: {
        ...metadata,
        source: 'encounter-engine',
      },
    };
  }

  static createEncounterArrivedEvent(
    payload: EncounterArrivedPayload,
    metadata: EncounterEventMetadata
  ): EncounterArrivedEvent {
    return {
      eventType: ENCOUNTER_EVENT_TYPES.ENCOUNTER_ARRIVED,
      eventVersion: '1.0.0',
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tenantId: payload.tenantId,
      aggregateId: payload.encounterId,
      aggregateType: 'encounter',
      payload,
      metadata: {
        ...metadata,
        source: 'encounter-engine',
      },
    };
  }

  static createEncounterTriagedEvent(
    payload: EncounterTriagedPayload,
    metadata: EncounterEventMetadata
  ): EncounterTriagedEvent {
    return {
      eventType: ENCOUNTER_EVENT_TYPES.ENCOUNTER_TRIAGED,
      eventVersion: '1.0.0',
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tenantId: payload.tenantId,
      aggregateId: payload.encounterId,
      aggregateType: 'encounter',
      payload,
      metadata: {
        ...metadata,
        source: 'encounter-engine',
      },
    };
  }

  static createEncounterStartedEvent(
    payload: EncounterStartedPayload,
    metadata: EncounterEventMetadata
  ): EncounterStartedEvent {
    return {
      eventType: ENCOUNTER_EVENT_TYPES.ENCOUNTER_STARTED,
      eventVersion: '1.0.0',
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tenantId: payload.tenantId,
      aggregateId: payload.encounterId,
      aggregateType: 'encounter',
      payload,
      metadata: {
        ...metadata,
        source: 'encounter-engine',
      },
    };
  }

  static createEncounterHeldEvent(
    payload: EncounterHeldPayload,
    metadata: EncounterEventMetadata
  ): EncounterHeldEvent {
    return {
      eventType: ENCOUNTER_EVENT_TYPES.ENCOUNTER_HELD,
      eventVersion: '1.0.0',
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tenantId: payload.tenantId,
      aggregateId: payload.encounterId,
      aggregateType: 'encounter',
      payload,
      metadata: {
        ...metadata,
        source: 'encounter-engine',
      },
    };
  }

  static createEncounterResumedEvent(
    payload: EncounterResumedPayload,
    metadata: EncounterEventMetadata
  ): EncounterResumedEvent {
    return {
      eventType: ENCOUNTER_EVENT_TYPES.ENCOUNTER_RESUMED,
      eventVersion: '1.0.0',
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tenantId: payload.tenantId,
      aggregateId: payload.encounterId,
      aggregateType: 'encounter',
      payload,
      metadata: {
        ...metadata,
        source: 'encounter-engine',
      },
    };
  }

  static createEncounterFinishedEvent(
    payload: EncounterFinishedPayload,
    metadata: EncounterEventMetadata
  ): EncounterFinishedEvent {
    return {
      eventType: ENCOUNTER_EVENT_TYPES.ENCOUNTER_FINISHED,
      eventVersion: '1.0.0',
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tenantId: payload.tenantId,
      aggregateId: payload.encounterId,
      aggregateType: 'encounter',
      payload,
      metadata: {
        ...metadata,
        source: 'encounter-engine',
      },
    };
  }

  static createEncounterCancelledEvent(
    payload: EncounterCancelledPayload,
    metadata: EncounterEventMetadata
  ): EncounterCancelledEvent {
    return {
      eventType: ENCOUNTER_EVENT_TYPES.ENCOUNTER_CANCELLED,
      eventVersion: '1.0.0',
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tenantId: payload.tenantId,
      aggregateId: payload.encounterId,
      aggregateType: 'encounter',
      payload,
      metadata: {
        ...metadata,
        source: 'encounter-engine',
      },
    };
  }

  static createDiagnosisAddedEvent(
    payload: DiagnosisAddedPayload,
    metadata: EncounterEventMetadata
  ): DiagnosisAddedEvent {
    return {
      eventType: ENCOUNTER_EVENT_TYPES.DIAGNOSIS_ADDED,
      eventVersion: '1.0.0',
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tenantId: payload.tenantId,
      aggregateId: payload.encounterId,
      aggregateType: 'encounter',
      payload,
      metadata: {
        ...metadata,
        source: 'encounter-engine',
      },
    };
  }

  static createProviderAssignedEvent(
    payload: ProviderAssignedPayload,
    metadata: EncounterEventMetadata
  ): ProviderAssignedEvent {
    return {
      eventType: ENCOUNTER_EVENT_TYPES.PROVIDER_ASSIGNED,
      eventVersion: '1.0.0',
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tenantId: payload.tenantId,
      aggregateId: payload.encounterId,
      aggregateType: 'encounter',
      payload,
      metadata: {
        ...metadata,
        source: 'encounter-engine',
      },
    };
  }

  static createEncounterTransferredEvent(
    payload: EncounterTransferredPayload,
    metadata: EncounterEventMetadata
  ): EncounterTransferredEvent {
    return {
      eventType: ENCOUNTER_EVENT_TYPES.ENCOUNTER_TRANSFERRED,
      eventVersion: '1.0.0',
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tenantId: payload.tenantId,
      aggregateId: payload.encounterId,
      aggregateType: 'encounter',
      payload,
      metadata: {
        ...metadata,
        source: 'encounter-engine',
      },
    };
  }
}
