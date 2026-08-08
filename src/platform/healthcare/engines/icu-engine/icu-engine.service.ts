/**
 * ICU Engine Service
 * 
 * Healthcare Platform engine for ICU management, vitals monitoring, ventilator control, and scoring.
 * 
 * @module platform/healthcare/engines/icu-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IcuEngineContract,
  IcuBedAllocationRequest,
  IcuBedRow,
  RecordIcuObservationRequest,
  IcuObservationRow,
  ConfigureVentilatorPolicyRequest,
  VentilatorPolicyRow,
  StartVentilatorRequest,
  VentilatorRecordRow,
  CalculateScoreResponse,
} from '../../contracts/icu-engine.contract';
import type { EngineResponse } from '../../shared-kernel/types';
import { eventBus } from '../../../host/event-bus';

export class IcuEngineService implements IcuEngineContract {
  readonly engineName = 'icu-engine';
  readonly engineVersion = '1.1.0';
  readonly contractVersion = '1.1.0';

  constructor(private readonly supabase: SupabaseClient) {}

  async allocateIcuBed(request: IcuBedAllocationRequest): Promise<EngineResponse<IcuBedRow>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'allocateIcuBed',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_icu_beds')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('bed_id', request.bedId)
              .maybeSingle();

            if (!queryError && existing) {
              return { success: true, data: existing };
            }
          }
          throw new Error(`Idempotency failure: ${insertError.message}`);
        }
      }

      // Check if bed exists in core beds
      const { data: bed, error: bedError } = await this.supabase
        .from('hc_beds')
        .select('*')
        .eq('id', request.bedId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (bedError || !bed) {
        throw new Error(`Bed not found: ${bedError?.message || 'Invalid bed ID'}`);
      }

      const { data, error } = await this.supabase
        .from('hc_icu_beds')
        .insert({
          tenant_id: request.tenantId,
          bed_id: request.bedId,
          monitoring_level: request.monitoringLevel,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to allocate ICU bed: ${error.message}`);
      }

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'ICU_BED_ALLOCATION_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async recordIcuObservation(request: RecordIcuObservationRequest): Promise<EngineResponse<IcuObservationRow>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'recordIcuObservation',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_icu_observations')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('encounter_id', request.encounterId)
              .eq('observed_at', request.observedAt)
              .maybeSingle();

            if (!queryError && existing) {
              return { success: true, data: existing };
            }
          }
          throw new Error(`Idempotency failure: ${insertError.message}`);
        }
      }

      const { data, error } = await this.supabase
        .from('hc_icu_observations')
        .insert({
          tenant_id: request.tenantId,
          encounter_id: request.encounterId,
          observed_at: request.observedAt,
          vitals: request.vitals,
          labs: request.labs,
          clinical: request.clinical,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to record ICU observation: ${error.message}`);
      }

      // Publish telemetry raw observation event
      await eventBus.publish({
        eventType: 'VitalsRecorded',
        tenantId: request.tenantId,
        aggregateId: data.id,
        aggregateType: 'encounter',
        payload: {
          vitalSignsId: data.id,
          patientId: '', // Looked up downstream
          encounterId: request.encounterId,
          temperature: request.vitals.temperature,
          heartRate: request.vitals.heartRate,
          bloodPressureSystolic: request.vitals.meanArterialPressure, // MAP fallback
          bloodPressureDiastolic: 80,
          oxygenSaturation: request.vitals.spo2,
          respiratoryRate: request.vitals.respiratoryRate,
          recordedAt: request.observedAt,
          practitionerId: '',
          isCritical: false,
          alerts: [],
        },
      });

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'RECORD_OBSERVATION_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async configureVentilatorPolicy(request: ConfigureVentilatorPolicyRequest): Promise<EngineResponse<VentilatorPolicyRow>> {
    try {
      const { data, error } = await this.supabase
        .from('hc_ventilator_safety_policies')
        .insert({
          tenant_id: request.tenantId,
          name: request.name,
          settings_rules: request.settingsRules,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to configure policy: ${error.message}`);
      }

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'VENTILATOR_POLICY_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async startVentilation(request: StartVentilatorRequest): Promise<EngineResponse<VentilatorRecordRow>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'startVentilation',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_ventilator_records')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('encounter_id', request.encounterId)
              .eq('policy_id', request.policyId)
              .maybeSingle();

            if (!queryError && existing) {
              return { success: true, data: existing };
            }
          }
          throw new Error(`Idempotency failure: ${insertError.message}`);
        }
      }

      // Fetch active policy details
      const { data: policy, error: policyError } = await this.supabase
        .from('hc_ventilator_safety_policies')
        .select('*')
        .eq('id', request.policyId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (policyError || !policy) {
        throw new Error(`Ventilator safety policy not found: ${policyError?.message || 'Invalid ID'}`);
      }

      // Validate settings against active policy rules
      const rules = policy.settings_rules as {
        fio2: { min: number; max: number };
        peep: { min: number; max: number };
        tidalVolume: { min: number; max: number };
        respiratoryRate: { min: number; max: number };
        pressureSupport: { min: number; max: number };
      };

      const s = request.settings;
      const validationErrors: string[] = [];

      if (s.fio2 < rules.fio2.min || s.fio2 > rules.fio2.max) {
        validationErrors.push(`FiO2 ${s.fio2}% violates range [${rules.fio2.min}-${rules.fio2.max}]`);
      }
      if (s.peep < rules.peep.min || s.peep > rules.peep.max) {
        validationErrors.push(`PEEP ${s.peep} cmH2O violates range [${rules.peep.min}-${rules.peep.max}]`);
      }
      if (s.tidalVolume < rules.tidalVolume.min || s.tidalVolume > rules.tidalVolume.max) {
        validationErrors.push(`Tidal Volume ${s.tidalVolume} mL violates range [${rules.tidalVolume.min}-${rules.tidalVolume.max}]`);
      }
      if (s.respiratoryRate < rules.respiratoryRate.min || s.respiratoryRate > rules.respiratoryRate.max) {
        validationErrors.push(`Resp Rate ${s.respiratoryRate} bpm violates range [${rules.respiratoryRate.min}-${rules.respiratoryRate.max}]`);
      }
      if (s.pressureSupport < rules.pressureSupport.min || s.pressureSupport > rules.pressureSupport.max) {
        validationErrors.push(`Pressure Support ${s.pressureSupport} cmH2O violates range [${rules.pressureSupport.min}-${rules.pressureSupport.max}]`);
      }

      if (validationErrors.length > 0) {
        // Publish safety block event
        await eventBus.publish({
          eventType: 'hos.icu.ventilator.validation_failed.v1',
          tenantId: request.tenantId,
          aggregateId: request.encounterId,
          aggregateType: 'encounter',
          payload: {
            encounterId: request.encounterId,
            policyId: request.policyId,
            settings: request.settings,
            violations: validationErrors,
          },
        });
        throw new Error(`Ventilator safety validation failed: ${validationErrors.join(', ')}`);
      }

      const { data, error } = await this.supabase
        .from('hc_ventilator_records')
        .insert({
          tenant_id: request.tenantId,
          encounter_id: request.encounterId,
          policy_id: request.policyId,
          mode: request.mode,
          settings: request.settings,
          monitored_params: request.monitoredParams,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to record ventilator settings: ${error.message}`);
      }

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'VENTILATOR_START_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async calculateSofaScore(tenantId: string, encounterId: string, observationId: string): Promise<EngineResponse<CalculateScoreResponse>> {
    try {
      // 1. Fetch observation
      const { data: obs, error: obsError } = await this.supabase
        .from('hc_icu_observations')
        .select('*')
        .eq('id', observationId)
        .eq('tenant_id', tenantId)
        .single();

      if (obsError || !obs) {
        throw new Error(`Observation record not found: ${obsError?.message || 'Invalid ID'}`);
      }

      const vitals = obs.vitals as { heartRate: number; meanArterialPressure: number; temperature: number; respiratoryRate: number; spo2: number };
      const labs = obs.labs as { pao2: number; plateletCount: number; bilirubin: number; creatinine: number };
      const clinical = obs.clinical as { glasgowComaScale: number; urineOutput: number; vasopressorDoses?: { dopamine?: number; epinephrine?: number; norepinephrine?: number; dobutamine?: number } };

      let sofa = 0;

      // Respiration (PaO2/FiO2 ratio, estimated from spo2 if needed)
      // Assume labs.pao2 represents the PaO2/FiO2 ratio for calculation simplicity
      const pfRatio = labs.pao2;
      if (pfRatio < 100) sofa += 4;
      else if (pfRatio < 200) sofa += 3;
      else if (pfRatio < 300) sofa += 2;
      else if (pfRatio < 400) sofa += 1;

      // Coagulation (Platelets)
      const platelets = labs.plateletCount;
      if (platelets < 20) sofa += 4;
      else if (platelets < 50) sofa += 3;
      else if (platelets < 100) sofa += 2;
      else if (platelets < 150) sofa += 1;

      // Liver (Bilirubin)
      const bilirubin = labs.bilirubin;
      if (bilirubin >= 12.0) sofa += 4;
      else if (bilirubin >= 6.0) sofa += 3;
      else if (bilirubin >= 2.0) sofa += 2;
      else if (bilirubin >= 1.2) sofa += 1;

      // Cardiovascular
      const map = vitals.meanArterialPressure;
      const vaso = clinical.vasopressorDoses || {};
      const dopamine = vaso.dopamine || 0;
      const epinephrine = vaso.epinephrine || 0;
      const norepinephrine = vaso.norepinephrine || 0;
      const dobutamine = vaso.dobutamine || 0;

      if (dopamine > 15 || epinephrine > 0.1 || norepinephrine > 0.1) sofa += 4;
      else if (dopamine > 5 || (epinephrine > 0 && epinephrine <= 0.1) || (norepinephrine > 0 && norepinephrine <= 0.1)) sofa += 3;
      else if (dopamine > 0 || dobutamine > 0) sofa += 2;
      else if (map < 70) sofa += 1;

      // CNS (Glasgow Coma Scale)
      const gcs = clinical.glasgowComaScale;
      if (gcs < 6) sofa += 4;
      else if (gcs >= 6 && gcs <= 9) sofa += 3;
      else if (gcs >= 10 && gcs <= 12) sofa += 2;
      else if (gcs >= 13 && gcs <= 14) sofa += 1;

      // Renal (Creatinine or Urine Output)
      const creatinine = labs.creatinine;
      const urine = clinical.urineOutput;

      if (creatinine >= 5.0 || urine < 200) sofa += 4;
      else if (creatinine >= 3.5 || urine < 500) sofa += 3;
      else if (creatinine >= 2.0 && creatinine <= 3.4) sofa += 2;
      else if (creatinine >= 1.2 && creatinine <= 1.9) sofa += 1;

      // Write scoring clinical calculation record
      const { data: calc, error: calcError } = await this.supabase
        .from('hc_clinical_calculations')
        .insert({
          tenant_id: tenantId,
          encounter_id: encounterId,
          algorithm_id: 'SOFA',
          algorithm_version: 'v1.0',
          calculation_timestamp: new Date().toISOString(),
          calculation_status: 'COMPLETED',
          input_snapshot: { vitals, labs, clinical },
          source_observation_references: [{ entity_type: 'icu_observation', entity_id: observationId }],
          output: { score: sofa },
          engine_version: this.engineVersion,
        })
        .select()
        .single();

      if (calcError) {
        throw new Error(`Failed to record clinical calculation: ${calcError.message}`);
      }

      return {
        success: true,
        data: {
          score: sofa,
          calculationId: calc.id,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'SOFA_CALCULATION_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async calculateApacheIIScore(
    tenantId: string,
    encounterId: string,
    observationId: string,
    patientAge: number,
    hasChronicOrganFailure: boolean
  ): Promise<EngineResponse<CalculateScoreResponse>> {
    try {
      const { data: obs, error: obsError } = await this.supabase
        .from('hc_icu_observations')
        .select('*')
        .eq('id', observationId)
        .eq('tenant_id', tenantId)
        .single();

      if (obsError || !obs) {
        throw new Error(`Observation record not found: ${obsError?.message || 'Invalid ID'}`);
      }

      const vitals = obs.vitals as { heartRate: number; meanArterialPressure: number; temperature: number; respiratoryRate: number; spo2: number };
      const labs = obs.labs as { pao2: number; plateletCount: number; bilirubin: number; creatinine: number };
      const clinical = obs.clinical as { glasgowComaScale: number; urineOutput: number };

      let apache = 0;

      // 1. Age points
      if (patientAge >= 75) apache += 6;
      else if (patientAge >= 65) apache += 5;
      else if (patientAge >= 55) apache += 3;
      else if (patientAge >= 45) apache += 2;

      // 2. Chronic health points
      if (hasChronicOrganFailure) {
        apache += 5; // non-operative or emergency admission chronic point value
      }

      // 3. Acute physiological points (Simplified APACHE II parameters)
      // Temperature
      const temp = vitals.temperature;
      if (temp >= 41.0 || temp <= 29.9) apache += 4;
      else if (temp >= 39.0 || temp <= 31.9) apache += 3;
      else if (temp >= 38.5 || temp <= 33.9) apache += 1;

      // Mean Arterial Pressure (MAP)
      const map = vitals.meanArterialPressure;
      if (map >= 160 || map <= 49) apache += 4;
      else if (map >= 130 || map <= 69) apache += 3;
      else if (map >= 110 && map <= 129) apache += 2;

      // Heart Rate
      const hr = vitals.heartRate;
      if (hr >= 180 || hr <= 39) apache += 4;
      else if (hr >= 140 || hr <= 54) apache += 3;
      else if (hr >= 110 && hr <= 139) apache += 2;

      // Respiratory Rate
      const rr = vitals.respiratoryRate;
      if (rr >= 50 || rr <= 5) apache += 4;
      else if (rr >= 35 || rr <= 9) apache += 3;
      else if (rr >= 25 && rr <= 34) apache += 1;

      // Glasgow Coma Scale (15 - GCS score points)
      const gcsPoints = 15 - clinical.glasgowComaScale;
      apache += gcsPoints;

      // Serum Creatinine
      const creat = labs.creatinine;
      if (creat >= 3.5) apache += 4;
      else if (creat >= 2.0 && creat <= 3.4) apache += 3;
      else if (creat >= 1.5 && creat <= 1.9) apache += 2;

      // PaO2
      const pao2 = labs.pao2;
      if (pao2 < 55) apache += 4;
      else if (pao2 >= 55 && pao2 <= 60) apache += 3;
      else if (pao2 >= 61 && pao2 <= 70) apache += 1;

      const { data: calc, error: calcError } = await this.supabase
        .from('hc_clinical_calculations')
        .insert({
          tenant_id: tenantId,
          encounter_id: encounterId,
          algorithm_id: 'APACHE_II',
          algorithm_version: 'v1.0',
          calculation_timestamp: new Date().toISOString(),
          calculation_status: 'COMPLETED',
          input_snapshot: { vitals, labs, clinical, patientAge, hasChronicOrganFailure },
          source_observation_references: [{ entity_type: 'icu_observation', entity_id: observationId }],
          output: { score: apache },
          engine_version: this.engineVersion,
        })
        .select()
        .single();

      if (calcError) {
        throw new Error(`Failed to record clinical calculation: ${calcError.message}`);
      }

      return {
        success: true,
        data: {
          score: apache,
          calculationId: calc.id,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'APACHE_CALCULATION_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
