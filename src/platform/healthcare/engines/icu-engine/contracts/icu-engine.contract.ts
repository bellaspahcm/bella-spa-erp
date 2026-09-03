/**
 * ICU Engine Public Contract & DTO Specs
 * 
 * Constitution Compliance:
 * - Law 1: Encounter referenced
 * - Law 11: Strictly typed, zero `any` types allowed
 * 
 * @module platform/healthcare/engines/icu-engine/contracts
 */

import type { EngineResponse } from '../../../shared-kernel/types';
import type { VentilatorSettings, VentilatorSafetyRules } from '../domain/ventilator-session.entity';
import type { VitalSignsInput, LabResultsInput, ClinicalInput, ScoringResult } from '../domain/scoring/scoring-strategy.interface';

export interface AdmitToIcuRequest {
  readonly tenantId: string;
  readonly encounterId: string;
  readonly patientId: string;
  readonly bedId: string;
  readonly wardId: string;
  readonly admittedBy: string;
}

export interface StartVentilatorSessionRequest {
  readonly tenantId: string;
  readonly icuStayId: string;
  readonly mode: 'AC' | 'SIMV' | 'CPAP' | 'PSV';
  readonly settings: VentilatorSettings;
  readonly safetyRules?: VentilatorSafetyRules;
  readonly initiatedBy: string;
}

export interface StopVentilatorSessionRequest {
  readonly tenantId: string;
  readonly icuStayId: string;
  readonly sessionId: string;
  readonly stoppedBy: string;
}

export interface RecordIcuObservationRequest {
  readonly tenantId: string;
  readonly icuStayId: string;
  readonly vitals: {
    readonly heartRate: number;
    readonly meanArterialPressure: number;
    readonly temperature: number;
    readonly respiratoryRate: number;
    readonly spo2: number;
  };
  readonly recordedBy: string;
}

export interface CalculateClinicalScoreRequest {
  readonly tenantId: string;
  readonly icuStayId: string;
  readonly strategyName: 'SOFA' | 'APACHE_II';
  readonly vitals: VitalSignsInput;
  readonly labs: LabResultsInput;
  readonly clinical: ClinicalInput;
  readonly patientAge?: number;
  readonly hasChronicOrganFailure?: boolean;
}

export interface TransitionIcuStatusRequest {
  readonly tenantId: string;
  readonly icuStayId: string;
  readonly action: 'STABILIZE' | 'STEP_DOWN' | 'DISCHARGE';
  readonly updatedBy: string;
}

export interface IcuStayDTO {
  readonly id: string;
  readonly tenantId: string;
  readonly encounterId: string;
  readonly patientId: string;
  readonly bedId: string;
  readonly wardId: string;
  readonly status: string;
  readonly admittedAt: string;
  readonly stabilizedAt?: string | null;
  readonly dischargedAt?: string | null;
  readonly version: number;
  readonly activeVentilatorSessionId?: string | null;
  readonly latestScore?: ScoringResult | null;
}

export interface IIcuEngineService {
  admitToIcu(request: AdmitToIcuRequest): Promise<EngineResponse<IcuStayDTO>>;
  startVentilatorSession(request: StartVentilatorSessionRequest): Promise<EngineResponse<{ sessionId: string; status: string }>>;
  stopVentilatorSession(request: StopVentilatorSessionRequest): Promise<EngineResponse<void>>;
  recordObservation(request: RecordIcuObservationRequest): Promise<EngineResponse<{ observationId: string; isCritical: boolean }>>;
  calculateClinicalScore(request: CalculateClinicalScoreRequest): Promise<EngineResponse<ScoringResult>>;
  transitionStatus(request: TransitionIcuStatusRequest): Promise<EngineResponse<IcuStayDTO>>;
}
