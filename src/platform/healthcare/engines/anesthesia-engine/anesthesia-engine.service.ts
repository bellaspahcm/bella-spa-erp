/**
 * Anesthesia Engine Service
 * 
 * Healthcare Platform engine for anesthesia lifecycle and monitoring.
 * 
 * @module platform/healthcare/engines/anesthesia-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnesthesiaEngineContract,
  CreateAnesthesiaRequest,
  PreOpAssessmentRequest,
  RecordObservationRequest,
  RecordMedicationRequest,
  PostOpAssessmentRequest,
  AnesthesiaRecord,
  AnesthesiaObservation,
  AnesthesiaMedication,
  AnesthesiaRecordStatus,
} from '../../contracts/anesthesia-engine.contract';
import type { EngineResponse, EngineHealthStatus } from '../../shared-kernel/types';
import { eventBus } from '../../../host/event-bus';

export class AnesthesiaEngineService implements AnesthesiaEngineContract {
  readonly engineName = 'anesthesia-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  constructor(private readonly supabase: SupabaseClient) {}

  // Helper to validate status transitions
  private validateTransition(current: AnesthesiaRecordStatus, target: AnesthesiaRecordStatus): boolean {
    const validMap: Record<AnesthesiaRecordStatus, AnesthesiaRecordStatus[]> = {
      created: ['pre_op_complete'],
      pre_op_complete: ['intra_op'],
      intra_op: ['post_op'],
      post_op: ['completed'],
      completed: [],
    };
    return validMap[current].includes(target);
  }

  async createRecord(request: CreateAnesthesiaRequest): Promise<EngineResponse<AnesthesiaRecord>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'createAnesthesiaRecord',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_anesthesia_records')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('surgical_case_id', request.surgicalCaseId)
              .maybeSingle();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  surgicalCaseId: existing.surgical_case_id,
                  asaClassification: existing.asa_classification,
                  status: existing.status as AnesthesiaRecordStatus,
                  preOpAssessment: existing.pre_op_assessment,
                  postOpAssessment: existing.post_op_assessment,
                  createdAt: existing.created_at,
                  updatedAt: existing.updated_at,
                },
              };
            }
          }
          return {
            success: false,
            error: {
              code: 'CONCURRENCY_ERROR',
              message: `Idempotency failure: ${insertError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      const { data, error } = await this.supabase
        .from('hc_anesthesia_records')
        .insert({
          tenant_id: request.tenantId,
          surgical_case_id: request.surgicalCaseId,
          status: 'created',
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'ANESTHESIA_RECORD_CREATION_FAILED',
            message: `Failed to create record: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const record: AnesthesiaRecord = {
        id: data.id,
        tenantId: data.tenant_id,
        surgicalCaseId: data.surgical_case_id,
        asaClassification: data.asa_classification,
        status: data.status as AnesthesiaRecordStatus,
        preOpAssessment: data.pre_op_assessment,
        postOpAssessment: data.post_op_assessment,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      return {
        success: true,
        data: record,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async recordPreOpAssessment(request: PreOpAssessmentRequest): Promise<EngineResponse<AnesthesiaRecord>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'recordPreOpAssessment',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_anesthesia_records')
              .select('*')
              .eq('id', request.anesthesiaRecordId)
              .eq('tenant_id', request.tenantId)
              .single();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  surgicalCaseId: existing.surgical_case_id,
                  asaClassification: existing.asa_classification,
                  status: existing.status as AnesthesiaRecordStatus,
                  preOpAssessment: existing.pre_op_assessment,
                  postOpAssessment: existing.post_op_assessment,
                  createdAt: existing.created_at,
                  updatedAt: existing.updated_at,
                },
              };
            }
          }
          return {
            success: false,
            error: {
              code: 'CONCURRENCY_ERROR',
              message: `Idempotency failure: ${insertError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      if (
        request.asaClassification === undefined ||
        request.asaClassification < 1 ||
        request.asaClassification > 5
      ) {
        return {
          success: false,
          error: {
            code: 'INVALID_ASA_CLASSIFICATION',
            message: 'ASA classification must be between 1 and 5',
            timestamp: new Date().toISOString(),
          },
        };
      }

      const { data: record, error: fetchError } = await this.supabase
        .from('hc_anesthesia_records')
        .select('*')
        .eq('id', request.anesthesiaRecordId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !record) {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: 'Anesthesia record not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (!this.validateTransition(record.status as AnesthesiaRecordStatus, 'pre_op_complete')) {
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot transition from ${record.status} to pre_op_complete`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const { data: updated, error: updateError } = await this.supabase
        .from('hc_anesthesia_records')
        .update({
          asa_classification: request.asaClassification,
          pre_op_assessment: request.preOpAssessment,
          status: 'pre_op_complete',
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.anesthesiaRecordId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateError || !updated) {
        return {
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: `Failed to update assessment: ${updateError?.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const result: AnesthesiaRecord = {
        id: updated.id,
        tenantId: updated.tenant_id,
        surgicalCaseId: updated.surgical_case_id,
        asaClassification: updated.asa_classification,
        status: updated.status as AnesthesiaRecordStatus,
        preOpAssessment: updated.pre_op_assessment,
        postOpAssessment: updated.post_op_assessment,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      };

      await eventBus.publish({
        eventType: 'hos.anesthesia.preop.completed.v1',
        tenantId: request.tenantId,
        aggregateId: result.surgicalCaseId,
        aggregateType: 'encounter',
        payload: {
          surgicalCaseId: result.surgicalCaseId,
          asaClassification: result.asaClassification,
        },
      });

      return {
        success: true,
        data: result,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async recordObservation(request: RecordObservationRequest): Promise<EngineResponse<AnesthesiaObservation>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'recordObservation',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_anesthesia_observations')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('anesthesia_record_id', request.anesthesiaRecordId)
              .eq('observation_time', request.observationTime)
              .eq('type', request.type)
              .maybeSingle();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  anesthesiaRecordId: existing.anesthesia_record_id,
                  observationTime: existing.observation_time,
                  type: existing.type,
                  value: Number(existing.value),
                  createdAt: existing.created_at,
                },
              };
            }
          }
          return {
            success: false,
            error: {
              code: 'CONCURRENCY_ERROR',
              message: `Idempotency failure: ${insertError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      // Check current record and lifecycle
      const { data: record, error: fetchError } = await this.supabase
        .from('hc_anesthesia_records')
        .select('*')
        .eq('id', request.anesthesiaRecordId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !record) {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: 'Anesthesia record not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Check if terminal/completed status or if not prepared
      if (record.status === 'completed' || record.status === 'created' || record.status === 'post_op') {
        return {
          success: false,
          error: {
            code: 'INVALID_LIFECYCLE_STATE',
            message: `Cannot record observation when status is ${record.status}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Move to intra_op status if pre_op_complete
      if (record.status === 'pre_op_complete') {
        const { error: transitionError } = await this.supabase
          .from('hc_anesthesia_records')
          .update({
            status: 'intra_op',
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.anesthesiaRecordId)
          .eq('tenant_id', request.tenantId);

        if (transitionError) {
          return {
            success: false,
            error: {
              code: 'TRANSITION_FAILED',
              message: `Failed to transition state to intra_op: ${transitionError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      // Record observation
      const { data, error } = await this.supabase
        .from('hc_anesthesia_observations')
        .insert({
          tenant_id: request.tenantId,
          anesthesia_record_id: request.anesthesiaRecordId,
          observation_time: request.observationTime,
          type: request.type,
          value: request.value,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'INSERT_OBSERVATION_FAILED',
            message: `Failed to record observation: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const observation: AnesthesiaObservation = {
        id: data.id,
        tenantId: data.tenant_id,
        anesthesiaRecordId: data.anesthesia_record_id,
        observationTime: data.observation_time,
        type: data.type,
        value: Number(data.value),
        createdAt: data.created_at,
      };

      await eventBus.publish({
        eventType: 'hos.anesthesia.observation.recorded.v1',
        tenantId: request.tenantId,
        aggregateId: record.surgical_case_id,
        aggregateType: 'encounter',
        payload: {
          anesthesiaRecordId: observation.anesthesiaRecordId,
          type: observation.type,
          value: observation.value,
          observationTime: observation.observationTime,
        },
      });

      return {
        success: true,
        data: observation,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async recordMedication(request: RecordMedicationRequest): Promise<EngineResponse<AnesthesiaMedication>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'recordMedication',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_anesthesia_medications')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('anesthesia_record_id', request.anesthesiaRecordId)
              .eq('inventory_item_id', request.inventoryItemId)
              .eq('administered_at', request.administeredAt)
              .maybeSingle();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  anesthesiaRecordId: existing.anesthesia_record_id,
                  inventoryItemId: existing.inventory_item_id,
                  administeredAt: existing.administered_at,
                  dose: Number(existing.dose),
                  unit: existing.unit,
                  waste: Number(existing.waste),
                  verifiedBy: existing.verified_by,
                  createdAt: existing.created_at,
                },
              };
            }
          }
          return {
            success: false,
            error: {
              code: 'CONCURRENCY_ERROR',
              message: `Idempotency failure: ${insertError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      // Check current record and lifecycle
      const { data: record, error: fetchError } = await this.supabase
        .from('hc_anesthesia_records')
        .select('*')
        .eq('id', request.anesthesiaRecordId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !record) {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: 'Anesthesia record not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (record.status === 'completed' || record.status === 'created' || record.status === 'post_op') {
        return {
          success: false,
          error: {
            code: 'INVALID_LIFECYCLE_STATE',
            message: `Cannot record medication when status is ${record.status}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Move to intra_op status if pre_op_complete
      if (record.status === 'pre_op_complete') {
        const { error: transitionError } = await this.supabase
          .from('hc_anesthesia_records')
          .update({
            status: 'intra_op',
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.anesthesiaRecordId)
          .eq('tenant_id', request.tenantId);

        if (transitionError) {
          return {
            success: false,
            error: {
              code: 'TRANSITION_FAILED',
              message: `Failed to transition state to intra_op: ${transitionError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      const { data, error } = await this.supabase
        .from('hc_anesthesia_medications')
        .insert({
          tenant_id: request.tenantId,
          anesthesia_record_id: request.anesthesiaRecordId,
          inventory_item_id: request.inventoryItemId,
          administered_at: request.administeredAt,
          dose: request.dose,
          unit: request.unit,
          waste: request.waste || 0,
          verified_by: request.verifiedBy || null,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'RECORD_MEDICATION_FAILED',
            message: `Failed to record medication: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const medication: AnesthesiaMedication = {
        id: data.id,
        tenantId: data.tenant_id,
        anesthesiaRecordId: data.anesthesia_record_id,
        inventoryItemId: data.inventory_item_id,
        administeredAt: data.administered_at,
        dose: Number(data.dose),
        unit: data.unit,
        waste: Number(data.waste),
        verifiedBy: data.verified_by,
        createdAt: data.created_at,
      };

      return {
        success: true,
        data: medication,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async recordPostOp(request: PostOpAssessmentRequest): Promise<EngineResponse<AnesthesiaRecord>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'recordPostOp',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_anesthesia_records')
              .select('*')
              .eq('id', request.anesthesiaRecordId)
              .eq('tenant_id', request.tenantId)
              .single();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  surgicalCaseId: existing.surgical_case_id,
                  asaClassification: existing.asa_classification,
                  status: existing.status as AnesthesiaRecordStatus,
                  preOpAssessment: existing.pre_op_assessment,
                  postOpAssessment: existing.post_op_assessment,
                  createdAt: existing.created_at,
                  updatedAt: existing.updated_at,
                },
              };
            }
          }
          return {
            success: false,
            error: {
              code: 'CONCURRENCY_ERROR',
              message: `Idempotency failure: ${insertError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      const { data: record, error: fetchError } = await this.supabase
        .from('hc_anesthesia_records')
        .select('*')
        .eq('id', request.anesthesiaRecordId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !record) {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: 'Anesthesia record not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (!this.validateTransition(record.status as AnesthesiaRecordStatus, 'post_op')) {
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot transition from ${record.status} to post_op`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const { data: updated, error: updateError } = await this.supabase
        .from('hc_anesthesia_records')
        .update({
          post_op_assessment: request.postOpAssessment,
          status: 'post_op',
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.anesthesiaRecordId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (updateError || !updated) {
        return {
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: `Failed to record post-op assessment: ${updateError?.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const result: AnesthesiaRecord = {
        id: updated.id,
        tenantId: updated.tenant_id,
        surgicalCaseId: updated.surgical_case_id,
        asaClassification: updated.asa_classification,
        status: updated.status as AnesthesiaRecordStatus,
        preOpAssessment: updated.pre_op_assessment,
        postOpAssessment: updated.post_op_assessment,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      };

      return {
        success: true,
        data: result,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async completeRecord(tenantId: string, recordId: string, requestId?: string): Promise<EngineResponse<AnesthesiaRecord>> {
    try {
      if (requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: tenantId,
            request_id: requestId,
            operation: 'completeAnesthesiaRecord',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_anesthesia_records')
              .select('*')
              .eq('id', recordId)
              .eq('tenant_id', tenantId)
              .single();

            if (!queryError && existing) {
              return {
                success: true,
                data: {
                  id: existing.id,
                  tenantId: existing.tenant_id,
                  surgicalCaseId: existing.surgical_case_id,
                  asaClassification: existing.asa_classification,
                  status: existing.status as AnesthesiaRecordStatus,
                  preOpAssessment: existing.pre_op_assessment,
                  postOpAssessment: existing.post_op_assessment,
                  createdAt: existing.created_at,
                  updatedAt: existing.updated_at,
                },
              };
            }
          }
          return {
            success: false,
            error: {
              code: 'CONCURRENCY_ERROR',
              message: `Idempotency failure: ${insertError.message}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      const { data: record, error: fetchError } = await this.supabase
        .from('hc_anesthesia_records')
        .select('*')
        .eq('id', recordId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !record) {
        return {
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: 'Anesthesia record not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (!this.validateTransition(record.status as AnesthesiaRecordStatus, 'completed')) {
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot transition from ${record.status} to completed`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const { data: updated, error: updateError } = await this.supabase
        .from('hc_anesthesia_records')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (updateError || !updated) {
        return {
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: `Failed to complete anesthesia record: ${updateError?.message}`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const result: AnesthesiaRecord = {
        id: updated.id,
        tenantId: updated.tenant_id,
        surgicalCaseId: updated.surgical_case_id,
        asaClassification: updated.asa_classification,
        status: updated.status as AnesthesiaRecordStatus,
        preOpAssessment: updated.pre_op_assessment,
        postOpAssessment: updated.post_op_assessment,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      };

      return {
        success: true,
        data: result,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      const { error } = await this.supabase
        .from('hc_anesthesia_records')
        .select('id')
        .limit(1);

      return {
        status: error ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: error ? 'error' : 'ok',
          eventBus: 'ok',
        },
        message: error ? 'Database connection issue' : undefined,
      };
    } catch (err: unknown) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'error',
        },
        message: err instanceof Error ? err.message : 'Health check failed',
      };
    }
  }
}
