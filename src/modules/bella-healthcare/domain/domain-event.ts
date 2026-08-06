export interface EventMetadata {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly aggregateType: 'Encounter' | 'Patient' | 'Chair' | 'Prescription' | 'CarePath';
  readonly eventName: string; // e.g. 'appointment.created.v1', 'encounter.finished.v2'
  readonly tenantId: string;
  readonly userId?: string;
  readonly causationId?: string;
  readonly correlationId: string;
  readonly schemaVersion: string; // e.g. 'v1', 'v2'
  readonly occurredAt: string;
}

export interface DomainEvent<T = unknown> {
  readonly metadata: EventMetadata;
  readonly payload: T;
}

export interface AppointmentCreatedPayload {
  readonly appointmentId: string;
  readonly patientId: string;
  readonly doctorId: string;
  readonly scheduledAt: string;
  readonly chiefComplaint: string;
}

export interface EncounterArrivedPayload {
  readonly encounterId: string;
  readonly patientId: string;
  readonly queueNumber: number;
  readonly arrivedAt: string;
}

export interface DoctorAssignedPayload {
  readonly encounterId: string;
  readonly doctorId: string;
  readonly doctorName: string;
}

export interface ToothUpdatedPayload {
  readonly patientId: string;
  readonly toothNumber: string;
  readonly status: string;
  readonly notes?: string;
}

export interface PrescriptionCreatedPayload {
  readonly encounterId: string;
  readonly prescriptionId: string;
  readonly drugs: Array<{ code: string; name: string; dosage: string }>;
}
