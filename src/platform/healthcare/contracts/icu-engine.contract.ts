/**
 * ICU Engine Contract
 * Healthcare Platform - Platform-of-Platforms
 */

import { Database } from '@/types/database.types';
import { EngineResponse } from '../shared-kernel/types';

export type IcuBedRow = Database['public']['Tables']['hc_icu_beds']['Row'];
export type IcuObservationRow = Database['public']['Tables']['hc_icu_observations']['Row'];
export type VentilatorRecordRow = Database['public']['Tables']['hc_ventilator_records']['Row'];
export type VentilatorPolicyRow = Database['public']['Tables']['hc_ventilator_safety_policies']['Row'];

export interface IcuBedAllocationRequest {
  requestId: string;
  tenantId: string;
  bedId: string;
  monitoringLevel: 'standard' | 'advanced' | 'critical';
}

export interface RecordIcuObservationRequest {
  requestId: string;
  tenantId: string;
  encounterId: string;
  observedAt: string;
  vitals: {
    heartRate: number;
    meanArterialPressure: number;
    temperature: number;
    respiratoryRate: number;
    spo2: number;
  };
  labs: {
    pao2: number;
    plateletCount: number;
    bilirubin: number;
    creatinine: number;
  };
  clinical: {
    glasgowComaScale: number;
    urineOutput: number;
    vasopressorDoses: {
      dopamine?: number;
      epinephrine?: number;
      norepinephrine?: number;
      dobutamine?: number;
    };
  };
}

export interface ConfigureVentilatorPolicyRequest {
  tenantId: string;
  name: string;
  settingsRules: {
    fio2: { min: number; max: number };
    peep: { min: number; max: number };
    tidalVolume: { min: number; max: number };
    respiratoryRate: { min: number; max: number };
    pressureSupport: { min: number; max: number };
  };
}

export interface StartVentilatorRequest {
  requestId: string;
  tenantId: string;
  encounterId: string;
  policyId: string;
  mode: 'AC' | 'SIMV' | 'CPAP' | 'PSV' | 'PRVC';
  settings: {
    fio2: number;
    peep: number;
    tidalVolume: number;
    respiratoryRate: number;
    pressureSupport: number;
    ieRatio: string;
    inspiratoryPressure: number;
  };
  monitoredParams: {
    pip: number;
    platPressure: number;
    minuteVolume: number;
  };
}

export interface CalculateScoreResponse {
  score: number;
  calculationId: string;
}

export interface IcuEngineContract {
  allocateIcuBed(request: IcuBedAllocationRequest): Promise<EngineResponse<IcuBedRow>>;
  recordIcuObservation(request: RecordIcuObservationRequest): Promise<EngineResponse<IcuObservationRow>>;
  configureVentilatorPolicy(request: ConfigureVentilatorPolicyRequest): Promise<EngineResponse<VentilatorPolicyRow>>;
  startVentilation(request: StartVentilatorRequest): Promise<EngineResponse<VentilatorRecordRow>>;
  calculateSofaScore(tenantId: string, encounterId: string, observationId: string): Promise<EngineResponse<CalculateScoreResponse>>;
  calculateApacheIIScore(tenantId: string, encounterId: string, observationId: string, patientAge: number, hasChronicOrganFailure: boolean): Promise<EngineResponse<CalculateScoreResponse>>;
}
