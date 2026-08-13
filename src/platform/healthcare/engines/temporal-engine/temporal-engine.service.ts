/**
 * Temporal & Clinical History Engine Service — Phase H9
 *
 * Implements ITemporalContract for bitemporal timeline recording,
 * point-in-time state reconstruction, and CDS decision temporal provenance audit.
 *
 * Constitution:
 *   - Law 1: Encounter as aggregate root
 *   - Law 11: Zero `any` types (Law 11 enforced)
 *   - Event-After-Persistence: Events published strictly after DB transaction
 *
 * @module platform/healthcare/engines/temporal-engine/temporal-engine.service
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ITemporalContract,
  ITemporalEventInput,
  ITemporalEventRecord,
  ITemporalStateSnapshot,
  IDecisionTemporalAudit,
  IHistoricalStateQuery,
  TimeDimension
} from '../../contracts/temporal-engine.contract';
import type { EngineResponse } from '../../shared-kernel/types';
import { TemporalEventEntity } from './domain/temporal-event.entity';
import { TemporalSnapshotEntity } from './domain/temporal-snapshot.entity';
import { eventBus } from '@/platform/host/event-bus';

export class TemporalEngineService implements ITemporalContract {
  private sequenceCounter = 0;

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Records a new bitemporal event into the immutable timeline.
   */
  public async recordTemporalEvent(
    input: ITemporalEventInput
  ): Promise<EngineResponse<ITemporalEventRecord>> {
    try {
      const eventId = crypto.randomUUID();
      const sequenceNumber = Date.now() * 1000 + (this.sequenceCounter++ % 1000);

      const entity = new TemporalEventEntity({
        id: eventId,
        tenantId: input.tenantId,
        encounterId: input.encounterId,
        patientId: input.patientId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        validTime: input.validTime,
        transactionTime: input.transactionTime || new Date().toISOString(),
        sequenceNumber,
        deltaPayload: input.deltaPayload
      });

      const record = entity.toRecord();

      const { error } = await this.supabase
        .from('hc_temporal_events')
        .insert({
          id: record.id,
          tenant_id: record.tenantId,
          encounter_id: record.encounterId,
          patient_id: record.patientId,
          aggregate_type: record.aggregateType,
          aggregate_id: record.aggregateId,
          event_type: record.eventType,
          valid_time: record.validTime,
          transaction_time: record.transactionTime,
          sequence_number: record.sequenceNumber,
          delta_payload: record.deltaPayload
        });

      if (error) {
        console.error('RECORD TEMPORAL EVENT DB ERROR:', error);
        return {
          success: false,
          error: {
            code: 'TEMPORAL_PERSISTENCE_ERROR',
            message: `Failed to record temporal event: ${error.message}`,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Event-After-Persistence: Publish temporal recorded event strictly after DB commit
      await eventBus.publish({
        eventType: 'hos.temporal.event_recorded.v1',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId: record.tenantId,
        aggregateId: record.id,
        aggregateType: 'TemporalEvent',
        payload: {
          encounterId: record.encounterId,
          patientId: record.patientId,
          sequenceNumber: record.sequenceNumber,
          validTime: record.validTime,
          transactionTime: record.transactionTime
        }
      });

      return {
        success: true,
        data: record
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'TEMPORAL_RECORD_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Reconstructs the exact patient encounter state at historical timestamp T.
   */
  public async reconstructStateAt(
    tenantId: string,
    encounterId: string,
    targetTime: string,
    timeDimension: TimeDimension = 'VALID_TIME'
  ): Promise<EngineResponse<ITemporalStateSnapshot>> {
    try {
      const { data, error } = await this.supabase.rpc('reconstruct_temporal_state_at', {
        p_tenant_id: tenantId,
        p_encounter_id: encounterId,
        p_target_time: targetTime,
        p_dimension: timeDimension
      });

      if (error) {
        console.error('RECONSTRUCT STATE AT DB ERROR:', error);
        return {
          success: false,
          error: {
            code: 'TEMPORAL_RECONSTRUCTION_FAILED',
            message: `Failed to reconstruct state: ${error.message}`,
            timestamp: new Date().toISOString()
          }
        };
      }

      const entity = new TemporalSnapshotEntity({
        tenantId: data.tenantId || tenantId,
        encounterId: data.encounterId || encounterId,
        patientId: data.patientId || '',
        asOfValidTime: data.asOfValidTime || targetTime,
        asOfTransactionTime: data.asOfTransactionTime || new Date().toISOString(),
        timeDimension,
        activeMedications: (data.activeMedications as Array<Record<string, unknown>>) || [],
        allergies: (data.allergies as Array<Record<string, unknown>>) || [],
        labResults: (data.labResults as Array<Record<string, unknown>>) || [],
        vitalSigns: (data.vitalSigns as Array<Record<string, unknown>>) || [],
        diagnoses: (data.diagnoses as Array<Record<string, unknown>>) || [],
        orders: (data.orders as Array<Record<string, unknown>>) || [],
        cdsDecisions: (data.cdsDecisions as Array<Record<string, unknown>>) || [],
        eventCountReconstructed: Number(data.eventCountReconstructed) || 0
      });

      return {
        success: true,
        data: entity.toDTO()
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'TEMPORAL_RECONSTRUCTION_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Retrieves the full temporal audit context for an H8 CDS decision.
   */
  public async getDecisionTemporalContext(
    tenantId: string,
    decisionId: string
  ): Promise<EngineResponse<IDecisionTemporalAudit>> {
    try {
      const { data: decision, error: decErr } = await this.supabase
        .from('hc_clinical_decisions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', decisionId)
        .single();

      if (decErr || !decision) {
        return {
          success: false,
          error: {
            code: 'DECISION_NOT_FOUND',
            message: `Decision with ID ${decisionId} not found: ${decErr?.message || ''}`,
            timestamp: new Date().toISOString()
          }
        };
      }

      const evalTime = decision.created_at || new Date().toISOString();
      const snapshotRes = await this.reconstructStateAt(
        tenantId,
        decision.encounter_id,
        evalTime,
        'VALID_TIME'
      );

      if (!snapshotRes.success || !snapshotRes.data) {
        return {
          success: false,
          error: snapshotRes.error || {
            code: 'SNAPSHOT_RECONSTRUCTION_FAILED',
            message: 'Failed to reconstruct snapshot for decision',
            timestamp: new Date().toISOString()
          }
        };
      }

      return {
        success: true,
        data: {
          decisionId: decision.id,
          tenantId: decision.tenant_id,
          encounterId: decision.encounter_id,
          patientId: decision.patient_id,
          evaluationTimestamp: evalTime,
          evaluationFingerprint: decision.evaluation_fingerprint,
          decisionResult: decision.result,
          decisionSeverity: decision.severity,
          decisionEnforcement: decision.enforcement,
          temporalSnapshot: snapshotRes.data,
          auditProvenanceMatch: Boolean(decision.evaluation_fingerprint)
        }
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: 'DECISION_AUDIT_ERROR',
          message: errorMsg,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Queries historical clinical state with field filtering.
   */
  public async queryHistoricalState(
    query: IHistoricalStateQuery
  ): Promise<EngineResponse<Partial<ITemporalStateSnapshot>>> {
    const fullStateRes = await this.reconstructStateAt(
      query.tenantId,
      query.encounterId,
      query.targetTime,
      query.timeDimension || 'VALID_TIME'
    );

    if (!fullStateRes.success || !fullStateRes.data) {
      return {
        success: false,
        error: fullStateRes.error
      };
    }

    const full = fullStateRes.data;
    const fields = query.includeFields;

    if (!fields || fields.length === 0) {
      return {
        success: true,
        data: full
      };
    }

    const filtered: Partial<ITemporalStateSnapshot> = {
      tenantId: full.tenantId,
      encounterId: full.encounterId,
      patientId: full.patientId,
      asOfValidTime: full.asOfValidTime,
      asOfTransactionTime: full.asOfTransactionTime,
      timeDimension: full.timeDimension
    };

    if (fields.includes('MEDICATIONS')) filtered.activeMedications = full.activeMedications;
    if (fields.includes('ALLERGIES')) filtered.allergies = full.allergies;
    if (fields.includes('LAB_RESULTS')) filtered.labResults = full.labResults;
    if (fields.includes('VITAL_SIGNS')) filtered.vitalSigns = full.vitalSigns;
    if (fields.includes('ORDERS')) filtered.orders = full.orders;
    if (fields.includes('DECISIONS')) filtered.cdsDecisions = full.cdsDecisions;

    return {
      success: true,
      data: filtered
    };
  }
}
