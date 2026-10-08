/**
 * Nursing Engine Service
 *
 * Healthcare Platform engine for nursing operations.
 *
 * @module platform/healthcare/engines/nursing-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type {
  NursingEngineContract,
  RecordVitalsRequest,
} from '../../contracts/nursing-engine.contract';
import type { EngineResponse, VitalSigns, NursingNote, EngineHealthStatus } from '../../shared-kernel/types';
import { eventBus } from '@/platform/host/event-bus';

type NursingVitalSignsRow = Database['public']['Tables']['hc_nursing_vital_signs']['Row'];
type NursingVitalSignsInsert = Database['public']['Tables']['hc_nursing_vital_signs']['Insert'];

export class NursingEngineService implements NursingEngineContract {
  readonly engineName = 'nursing-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async recordVitalSigns(request: RecordVitalsRequest): Promise<EngineResponse<VitalSigns>> {
    try {
      const now = new Date().toISOString();
      const temperature = request.temperature;
      const bloodPressure = request.bloodPressure;
      const heartRate = request.heartRate;
      const oxygenSaturation = request.oxygenSaturation;

      if (!temperature || !bloodPressure || !heartRate || !oxygenSaturation) {
        return {
          success: false,
          error: {
            code: 'NURSING_VITALS_VALIDATION_FAILED',
            message: 'Temperature, blood pressure, heart rate, and oxygen saturation are required',
            timestamp: now,
          },
        };
      }

      const vitalSignsRecord: NursingVitalSignsInsert = {
        id: crypto.randomUUID(),
        tenant_id: request.tenantId,
        encounter_id: request.encounterId,
        patient_id: request.patientId,
        nurse_practitioner_id: request.recordedBy,
        recorded_at: now,
        temperature: temperature.value,
        systolic_bp: bloodPressure.systolic,
        diastolic_bp: bloodPressure.diastolic,
        heart_rate: heartRate.value,
        respiratory_rate: request.respiratoryRate?.value ?? null,
        spo2: oxygenSaturation.value,
        notes: request.notes ?? null,
      };

      const { data, error } = await this.supabase
        .from('hc_nursing_vital_signs')
        .insert(vitalSignsRecord)
        .select()
        .single();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'RECORD_FAILED',
            message: 'Failed to record vital signs',
            details: { error },
            timestamp: now,
          },
        };
      }

      const vitalSigns = mapVitalSignsRow(data);

      await eventBus.publish({
        eventType: 'VitalsRecorded',
        tenantId: request.tenantId,
        aggregateId: vitalSigns.id,
        aggregateType: 'VitalSigns',
        payload: {
          vitalsId: vitalSigns.id,
          patientId: request.patientId,
          encounterId: request.encounterId,
          recordedBy: request.recordedBy,
          recordedAt: vitalSigns.recordedDateTime,
          temperature,
          bloodPressureSystolic: bloodPressure.systolic,
          bloodPressureDiastolic: bloodPressure.diastolic,
          heartRate,
          respiratoryRate: request.respiratoryRate,
          oxygenSaturation,
          painScore: request.painScore,
        },
        userId: request.recordedBy,
      });

      return {
        success: true,
        data: vitalSigns,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RECORD_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async getVitalSigns(tenantId: string, encounterId: string, limit?: number): Promise<EngineResponse<VitalSigns[]>> {
    try {
      let query = this.supabase
        .from('hc_nursing_vital_signs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('encounter_id', encounterId)
        .order('recorded_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: {
            code: 'QUERY_ERROR',
            message: 'Failed to get vital signs',
            details: { error },
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: (data ?? []).map((row) => mapVitalSignsRow(row)),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async createNursingNote(request: {
    tenantId: string;
    encounterId: string;
    patientId: string;
    noteType: string;
    content: string;
    recordedBy: string;
  }): Promise<EngineResponse<NursingNote>> {
    return {
      success: false,
      error: {
        code: 'NURSING_NOTE_PERSISTENCE_NOT_SUPPORTED',
        message: 'Nursing note persistence is not backed by a generated canonical table',
        details: {
          tenantId: request.tenantId,
          encounterId: request.encounterId,
          patientId: request.patientId,
          noteType: request.noteType,
          recordedBy: request.recordedBy,
        },
        timestamp: new Date().toISOString(),
      },
    };
  }

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      const { error } = await this.supabase
        .from('hc_nursing_vital_signs')
        .select('id')
        .limit(1);

      return {
        status: error ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: error ? 'error' : 'ok',
        },
        message: error ? 'Database connection issue' : undefined,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'error',
        },
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }
}

function mapVitalSignsRow(row: NursingVitalSignsRow): VitalSigns {
  const recordedAt = row.recorded_at ?? new Date().toISOString();

  return {
    id: row.id,
    tenantId: row.tenant_id,
    encounterId: row.encounter_id,
    patientId: row.patient_id,
    recordedBy: row.nurse_practitioner_id,
    recordedDateTime: recordedAt,
    temperature: { value: row.temperature, unit: 'C' },
    bloodPressure: {
      systolic: row.systolic_bp,
      diastolic: row.diastolic_bp,
      unit: 'mmHg',
    },
    heartRate: { value: row.heart_rate, unit: 'bpm' },
    respiratoryRate: row.respiratory_rate === null
      ? undefined
      : { value: row.respiratory_rate, unit: 'breaths/min' },
    oxygenSaturation: { value: row.spo2, unit: '%' },
    notes: row.notes ?? undefined,
    createdAt: recordedAt,
  };
}
