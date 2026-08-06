export interface EventMetadata {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly aggregateType: 'Encounter' | 'Patient' | 'Chair' | 'Prescription' | 'CarePath';
  readonly eventName: string; // e.g. 'Scheduling.Appointment.Created.v1', 'Encounter.Patient.Arrived.v1'
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

// --- OUTBOX PATTERN ---
export interface OutboxEntry {
  readonly id: string;
  readonly event: DomainEvent;
  readonly status: 'pending' | 'published' | 'failed';
  readonly createdAt: string;
}

// --- BOUNDED CONTEXTS AGGREGATES & ENTITIES ---

// 1. Patient Context
export interface PatientInfo {
  readonly id: string;
  readonly recordNumber: string; // BN000124
  readonly name: string;
  readonly gender: 'male' | 'female' | 'other';
  readonly dob: string;
  readonly age: number;
  readonly bloodType?: string;
  readonly allergies: string[];
  readonly phone?: string;
  readonly toothData?: Record<string, { status: string; notes?: string }>;
}

export interface DoctorInfo {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly avatarUrl?: string;
}

// 2. Encounter Context
export type EncounterStatus = 'planned' | 'arrived' | 'triaged' | 'in_progress' | 'finished' | 'cancelled';

export interface EncounterAggregate {
  readonly id: string;
  readonly aggregateCode: string; // #EC202600124
  readonly tenantId: string;
  readonly patientId: string;
  readonly doctorId?: string;
  readonly status: EncounterStatus;
  readonly chiefComplaint: string;
  readonly diagnoses: string[];
  readonly procedures: string[];
}

// 3. Clinical Context (Odontogram & Care Path)
export interface ToothState {
  readonly status: 'healthy' | 'decayed' | 'crowned' | 'implanted' | 'missing';
  readonly notes?: string;
}

export interface PatientOdontogram {
  readonly patientId: string;
  readonly toothData: Record<string, ToothState>;
}

export interface CarePathStep {
  readonly stepNumber: number;
  readonly title: string;
  readonly subtitle: string;
  readonly status: 'completed' | 'in_progress' | 'pending';
  readonly date?: string;
  readonly notes?: string;
}

// 4. Resource Context (Chairs & Staff)
export interface ChairInfo {
  readonly id: string;
  readonly code: string; // Chair 03
  readonly zone: string;
  readonly status: 'occupied' | 'available' | 'sanitizing' | 'maintenance';
  readonly currentPatientName?: string;
  readonly currentDoctorName?: string;
  readonly estimatedMinutesRemaining?: number;
}

// 5. Pharmacy Context (Prescriptions)
export interface PrescriptionItem {
  readonly id: string;
  readonly encounterId: string;
  readonly drugs: Array<{ code: string; name: string; dosage: string; frequency: string }>;
  readonly contraindicationChecked: boolean;
}

// 6. Billing Context
export interface BillingSummary {
  readonly invoiceId: string;
  readonly encounterId: string;
  readonly amount: number;
  readonly status: 'unpaid' | 'paid' | 'refunded';
}

// 7. Executive Context (COO Command Panel)
export interface AiCooAction {
  readonly id: string;
  readonly priority: 'high' | 'medium' | 'info';
  readonly category: 'chair' | 'patient_wait' | 'pharmacy' | 'capacity';
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly actionType: 'assign_chair' | 'alert_doctor' | 'verify_prescription' | 'reroute_queue';
}

export interface ResourceUtilization {
  readonly chairOccupancyRate: number;
  readonly doctorOccupancyRate: number;
  readonly avgWaitTimeMinutes: number;
  readonly totalEncountersToday: number;
}

export interface DomainEventStreamItem {
  readonly id: string;
  readonly eventName: string;
  readonly timestamp: string;
  readonly description: string;
  readonly actor: string;
  readonly category: 'encounter' | 'clinical' | 'prescription' | 'resource' | 'billing';
}

export interface TimelineStep {
  readonly id: string;
  readonly time: string;
  readonly title: string;
  readonly actor: string;
  readonly status: 'completed' | 'current' | 'pending';
  readonly durationMinutes?: number;
  readonly isBottleneck?: boolean;
}

// --- COMMAND PATH SCHEMAS (Write Path) ---
export interface CheckInPatientCommand {
  readonly patientId: string;
  readonly chiefComplaint: string;
  readonly tenantId: string;
}

export interface StartTreatmentCommand {
  readonly encounterId: string;
  readonly doctorId: string;
}

export interface UpdateToothStatusCommand {
  readonly patientId: string;
  readonly toothNumber: string;
  readonly status: ToothState['status'];
  readonly notes?: string;
}

export interface AssignChairCommand {
  readonly chairId: string;
  readonly patientName: string;
  readonly doctorName: string;
}
