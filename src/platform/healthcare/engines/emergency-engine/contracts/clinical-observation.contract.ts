/**
 * Clinical Observation Contract (Decoupled Reader/Provider Interface)
 *
 * Provides decoupled reader contract for clinical vital signs & observations.
 * Allows Emergency Engine to record or read vital signs at Arrival/Triage
 * WITHOUT a hard dependency on Nursing Engine.
 *
 * @module platform/healthcare/engines/emergency-engine/contracts
 */

export interface ClinicalObservationData {
  heartRate?: number;
  respiratoryRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  oxygenSaturation?: number;
  temperatureCelsius?: number;
  glasgowComaScale?: number;
  recordedAt: Date;
  recordedBy: string;
}

export interface IClinicalObservationContract {
  getLatestVitals(tenantId: string, patientId: string): Promise<ClinicalObservationData | null>;
  recordVitals(tenantId: string, patientId: string, data: ClinicalObservationData): Promise<{ success: boolean; observationId: string }>;
}
