/**
 * ICU Engine Domain Events Specs
 * 
 * Constitution Compliance:
 * - Law 5: Event-First Architecture
 * - Law 11: Strictly typed, zero `any` types allowed
 * 
 * @module platform/healthcare/engines/icu-engine/events
 */

export const ICU_EVENT_TYPES = {
  ICU_ADMITTED: 'hos.icu.admitted.v1',
  MONITORING_ALERT: 'hos.icu.monitoring_alert.v1',
  VENTILATOR_SAFETY_BLOCKED: 'hos.icu.ventilator_safety_blocked.v1',
  VENTILATOR_STARTED: 'hos.icu.ventilator_started.v1',
  VENTILATOR_STOPPED: 'hos.icu.ventilator_stopped.v1',
  SCORE_CALCULATED: 'hos.icu.score_calculated.v1',
  ICU_STABILIZED: 'hos.icu.stabilized.v1',
  ICU_STEPPED_DOWN: 'hos.icu.stepped_down.v1',
} as const;

export interface IcuAdmittedPayload {
  readonly icuStayId: string;
  readonly tenantId: string;
  readonly encounterId: string;
  readonly patientId: string;
  readonly bedId: string;
  readonly wardId: string;
  readonly admittedAt: string;
}

export interface MonitoringAlertPayload {
  readonly icuStayId: string;
  readonly tenantId: string;
  readonly encounterId: string;
  readonly patientId: string;
  readonly observationId: string;
  readonly breaches: string[];
  readonly vitals: {
    readonly heartRate: number;
    readonly meanArterialPressure: number;
    readonly temperature: number;
    readonly respiratoryRate: number;
    readonly spo2: number;
  };
  readonly recordedAt: string;
}

export interface VentilatorSafetyBlockedPayload {
  readonly icuStayId: string;
  readonly tenantId: string;
  readonly encounterId: string;
  readonly mode: string;
  readonly violations: string[];
  readonly attemptedSettings: {
    readonly fio2: number;
    readonly peep: number;
    readonly tidalVolume: number;
    readonly respiratoryRate: number;
    readonly pressureSupport: number;
  };
}

export interface VentilatorStartedPayload {
  readonly sessionId: string;
  readonly icuStayId: string;
  readonly tenantId: string;
  readonly encounterId: string;
  readonly mode: string;
  readonly settings: {
    readonly fio2: number;
    readonly peep: number;
    readonly tidalVolume: number;
    readonly respiratoryRate: number;
    readonly pressureSupport: number;
  };
  readonly startedAt: string;
}

export interface IcuStabilizedPayload {
  readonly icuStayId: string;
  readonly tenantId: string;
  readonly encounterId: string;
  readonly patientId: string;
  readonly stabilizedAt: string;
}
