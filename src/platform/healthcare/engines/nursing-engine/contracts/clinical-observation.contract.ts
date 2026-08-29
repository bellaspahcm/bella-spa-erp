/**
 * Healthcare Platform Shared Kernel - Clinical Observation Contract
 * 
 * Defines the generic, cross-vertical representation of clinical measurements 
 * (vital signs, assessments, intakes/outputs) proven in H1.
 * 
 * @module platform/healthcare/engines/nursing-engine/contracts/clinical-observation.contract
 */

/**
 * Core clinical observation aggregate.
 * Fits any clinical recording context (Clinic, Dental, Hospital).
 */
export interface ClinicalObservation {
  id: string;                 // unique observation record ID (UUID)
  tenantId: string;           // multi-tenant isolation
  encounterId: string;        // Law 1: All clinical records reference an Encounter
  patientId: string;          // Master patient index reference
  recordedBy: string;         // practitioner_id of user executing the recording
  recordedAt: string;         // ISO 8601 timestamp of measurement
  observationType: 'vital-signs' | 'clinical-assessment' | 'intake-output';
  values: ObservationValue[]; // Array of measurements captured at this instance
  notes?: string;             // Clinical notes
}

/**
 * Standard observation measurement item representation
 */
export interface ObservationValue {
  code: string;               // LOINC-style identifier (e.g. 'temperature', 'heart-rate', 'spo2')
  value: number;              // Numeric value of measurement
  unit: string;               // Measurement units (e.g. '°C', 'bpm', '%')
  interpretation?: 'normal' | 'low' | 'high' | 'critical'; // Optional CDS categorization
}

/**
 * Inpatient-specific Nursing Vital Signs extension (Hospital Extension specific)
 */
export interface NursingVitalSigns extends ClinicalObservation {
  inpatientAdmissionId: string; // Relates to the specific inpatient admission
  nurseId: string;              // Specific nurse identification context
}
