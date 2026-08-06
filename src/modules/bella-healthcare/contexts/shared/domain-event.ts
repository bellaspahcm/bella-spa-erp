import { EventMetadata } from './domain-models';

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
