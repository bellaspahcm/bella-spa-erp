/**
 * Event Bus Types
 * Platform-of-Platforms: Host Platform
 * Constitution: Law 5 (Event-Driven Communication)
 */

export type EventType =
  // Bed Engine Events
  | 'BedAllocated'
  | 'BedReleased'
  | 'BedTransferred'
  // Nursing Engine Events
  | 'VitalsRecorded'
  | 'VitalsAlertTriggered'
  // Pharmacy Engine Events
  | 'MedicationAdministered'
  | 'MedicationRefused'
  | 'MedicationHeld'
  // Billing Engine Events
  | 'BillingChargeCreated'
  | 'PaymentReceived'
  // Clinical Engine Events
  | 'TimelineEntryAdded'
  | 'DiagnosisRecorded';

export interface DomainEvent<T = unknown> {
  // Event identification
  eventId: string;
  eventType: EventType;
  eventVersion: string;
  
  // Context
  tenantId: string;
  aggregateId: string; // ID of the entity that triggered the event
  aggregateType: string; // Type of entity (e.g., 'bed', 'patient', 'medication')
  
  // Payload
  payload: T;
  
  // Metadata
  occurredAt: string; // ISO timestamp
  userId?: string; // Who triggered the event
  correlationId?: string; // For tracing related events
  causationId?: string; // Event that caused this event
}

export interface EventHandler<T = unknown> {
  (event: DomainEvent<T>): Promise<void> | void;
}

export interface EventBusAdapter {
  publish(event: DomainEvent): Promise<void>;
  subscribe<T = unknown>(
    eventType: EventType,
    handler: EventHandler<T>
  ): () => void; // Returns unsubscribe function
}

// Event payloads
export interface BedAllocatedPayload {
  bedId: string;
  bedCode: string;
  bedType: 'standard' | 'icu' | 'vip' | 'isolation';
  patientId: string;
  encounterId: string;
  admissionId: string;
  wardId: string;
  dailyRate: number;
  allocatedAt: string;
}

export interface VitalsRecordedPayload {
  vitalSignsId: string;
  patientId: string;
  encounterId: string;
  temperature: number;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  oxygenSaturation: number;
  respiratoryRate?: number;
  recordedAt: string;
  practitionerId: string;
  isCritical: boolean;
  alerts: string[];
}

export interface MedicationAdministeredPayload {
  marId: string;
  patientId: string;
  encounterId: string;
  medicationId: string;
  drugName: string;
  dosage: string;
  route: string;
  administeredAt: string;
  practitionerId: string;
  scheduledTime: string;
  notes?: string;
}
