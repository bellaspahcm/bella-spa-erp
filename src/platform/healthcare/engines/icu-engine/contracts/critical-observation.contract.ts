/**
 * Decoupled Critical Observation Contract
 * 
 * Constitution Compliance:
 * - Law 1: Encounter referenced
 * - Law 11: Strictly typed, zero `any` types allowed
 * - Boundary Isolation: ICU reads observation telemetry via contract without owning observation recording capability
 * 
 * @module platform/healthcare/engines/icu-engine/contracts
 */

export interface VitalTelemetrySnapshot {
  readonly vitalSignsId: string;
  readonly encounterId: string;
  readonly patientId: string;
  readonly heartRate: number;
  readonly meanArterialPressure: number;
  readonly temperature: number;
  readonly respiratoryRate: number;
  readonly spo2: number;
  readonly recordedAt: Date;
  readonly isCritical: boolean;
  readonly criticalBreaches: string[];
}

export interface GetVitalObservationRequest {
  readonly tenantId: string;
  readonly encounterId: string;
  readonly limit?: number;
}

export interface ICriticalObservationContract {
  /**
   * Get latest vital telemetry observations for an encounter
   */
  getLatestVitals(request: GetVitalObservationRequest): Promise<VitalTelemetrySnapshot[]>;

  /**
   * Evaluate vital telemetry for critical threshold breaches
   */
  evaluateCriticalThresholds(vitals: {
    heartRate: number;
    meanArterialPressure: number;
    temperature: number;
    respiratoryRate: number;
    spo2: number;
  }): { isCritical: boolean; breaches: string[] };
}
