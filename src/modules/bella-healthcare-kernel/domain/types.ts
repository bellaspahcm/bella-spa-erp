/**
 * Pure Healthcare Kernel Domain Data Transfer Objects (DTOs)
 * Strictly zero `any` types. 100% UI-Agnostic.
 */

export interface HealthcareResourceDTO {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly resourceType: 'room' | 'chair' | 'device' | 'bed';
  readonly status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  readonly capacity?: number;
  readonly department?: string;
}

export interface HealthcareEncounterDTO {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly practitionerId?: string;
  readonly practitionerName?: string;
  readonly resourceId?: string;
  readonly encounterType: string;
  readonly status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  readonly startTime: string;
  readonly endTime?: string;
  readonly notes?: string;
}

export interface HealthcareClinicalRecordDTO {
  readonly encounterId: string;
  readonly patientId: string;
  readonly primaryDiagnosisCode?: string;
  readonly primaryDiagnosisName?: string;
  readonly secondaryDiagnosisCodes?: readonly string[];
  readonly vitalSigns?: {
    readonly heartRateBpm?: number;
    readonly systolicBpMmHg?: number;
    readonly diastolicBpMmHg?: number;
    readonly temperatureCelsius?: number;
    readonly weightKg?: number;
  };
  readonly clinicalNotes?: string;
}
