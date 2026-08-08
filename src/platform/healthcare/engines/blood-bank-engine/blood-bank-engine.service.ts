/**
 * Blood Bank Engine Service
 * 
 * Healthcare Platform engine for blood bank operations, crossmatch testing, and transfusion safety.
 * 
 * @module platform/healthcare/engines/blood-bank-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BloodBankEngineContract,
  ReceiveBloodUnitRequest,
  BloodUnitRow,
  RequestBloodCrossmatchRequest,
  BloodCrossmatchRow,
  RecordCrossmatchResultRequest,
  ApproveCrossmatchRequest,
  ReserveBloodUnitRequest,
  DoubleVerifyTransfusionRequest,
  TransfusionVerificationRow,
  StartTransfusionRequest,
  TransfusionRecordRow,
  CompleteTransfusionRequest,
} from '../../contracts/blood-bank-engine.contract';
import type { EngineResponse } from '../../shared-kernel/types';
import { eventBus } from '../../../host/event-bus';

export class BloodBankEngineService implements BloodBankEngineContract {
  readonly engineName = 'blood-bank-engine';
  readonly engineVersion = '1.1.0';
  readonly contractVersion = '1.1.0';

  constructor(private readonly supabase: SupabaseClient) {}

  async receiveBloodUnit(request: ReceiveBloodUnitRequest): Promise<EngineResponse<BloodUnitRow>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'receiveBloodUnit',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_blood_units')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('unit_number', request.unitNumber)
              .maybeSingle();

            if (!queryError && existing) {
              return { success: true, data: existing };
            }
          }
          throw new Error(`Idempotency failure: ${insertError.message}`);
        }
      }

      const { data, error } = await this.supabase
        .from('hc_blood_units')
        .insert({
          tenant_id: request.tenantId,
          unit_number: request.unitNumber,
          blood_type: request.bloodType,
          rh_factor: request.rhFactor,
          component_type: request.componentType,
          status: 'RECEIVED',
          expiry_date: request.expiryDate,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to receive blood unit: ${error.message}`);
      }

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'RECEIVE_BLOOD_UNIT_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async requestCrossmatch(request: RequestBloodCrossmatchRequest): Promise<EngineResponse<BloodCrossmatchRow>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'requestCrossmatch',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_blood_crossmatch_records')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('encounter_id', request.encounterId)
              .eq('blood_unit_id', request.bloodUnitId)
              .maybeSingle();

            if (!queryError && existing) {
              return { success: true, data: existing };
            }
          }
          throw new Error(`Idempotency failure: ${insertError.message}`);
        }
      }

      // Check unit status before requesting crossmatch
      const { data: unit, error: unitError } = await this.supabase
        .from('hc_blood_units')
        .select('*')
        .eq('id', request.bloodUnitId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (unitError || !unit) {
        throw new Error(`Blood unit not found: ${unitError?.message || 'Invalid unit ID'}`);
      }

      if (unit.status !== 'RECEIVED' && unit.status !== 'QUARANTINED' && unit.status !== 'AVAILABLE') {
        throw new Error(`Invalid blood unit status for crossmatch: ${unit.status}`);
      }

      const { data, error } = await this.supabase
        .from('hc_blood_crossmatch_records')
        .insert({
          tenant_id: request.tenantId,
          encounter_id: request.encounterId,
          blood_unit_id: request.bloodUnitId,
          status: 'REQUESTED',
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to request crossmatch: ${error.message}`);
      }

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'REQUEST_CROSSMATCH_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async recordCrossmatchResult(request: RecordCrossmatchResultRequest): Promise<EngineResponse<BloodCrossmatchRow>> {
    try {
      // Fetch crossmatch record
      const { data: current, error: fetchError } = await this.supabase
        .from('hc_blood_crossmatch_records')
        .select('*')
        .eq('id', request.crossmatchId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !current) {
        throw new Error(`Crossmatch record not found: ${fetchError?.message || 'Invalid ID'}`);
      }

      if (current.status !== 'REQUESTED' && current.status !== 'SAMPLE_VERIFIED') {
        throw new Error(`Crossmatch record already processed: ${current.status}`);
      }

      const targetStatus = request.status === 'COMPATIBLE' ? 'TESTED' : 'INCOMPATIBLE';

      const { data, error } = await this.supabase
        .from('hc_blood_crossmatch_records')
        .update({
          status: targetStatus,
          crossmatched_by: request.crossmatchedBy,
          crossmatched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.crossmatchId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to record crossmatch result: ${error.message}`);
      }

      await eventBus.publish({
        eventType: 'hos.blood.crossmatch.completed.v1',
        tenantId: request.tenantId,
        aggregateId: current.encounter_id,
        aggregateType: 'encounter',
        payload: {
          crossmatchId: request.crossmatchId,
          status: targetStatus,
          crossmatchedBy: request.crossmatchedBy,
        },
      });

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'RECORD_CROSSMATCH_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async approveCrossmatch(request: ApproveCrossmatchRequest): Promise<EngineResponse<BloodCrossmatchRow>> {
    try {
      const { data: current, error: fetchError } = await this.supabase
        .from('hc_blood_crossmatch_records')
        .select('*')
        .eq('id', request.crossmatchId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !current) {
        throw new Error(`Crossmatch record not found: ${fetchError?.message || 'Invalid ID'}`);
      }

      if (current.status !== 'TESTED') {
        throw new Error(`Crossmatch cannot be approved from current state: ${current.status}`);
      }

      const { data, error } = await this.supabase
        .from('hc_blood_crossmatch_records')
        .update({
          status: 'APPROVED',
          approved_by: request.approvedBy,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.crossmatchId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to approve crossmatch: ${error.message}`);
      }

      // Automatically update unit to AVAILABLE upon approved compatibility
      await this.supabase
        .from('hc_blood_units')
        .update({ status: 'AVAILABLE' })
        .eq('id', current.blood_unit_id)
        .eq('tenant_id', request.tenantId);

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'APPROVE_CROSSMATCH_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async reserveBloodUnit(request: ReserveBloodUnitRequest): Promise<EngineResponse<BloodUnitRow>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'reserveBloodUnit',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_blood_units')
              .select('*')
              .eq('id', request.bloodUnitId)
              .eq('tenant_id', request.tenantId)
              .single();

            if (!queryError && existing) {
              return { success: true, data: existing };
            }
          }
          throw new Error(`Idempotency failure: ${insertError.message}`);
        }
      }

      // Enforce Concurrent Reservation Protection via Atomic SQL UPDATE filter
      const { data, error } = await this.supabase
        .from('hc_blood_units')
        .update({ status: 'RESERVED', updated_at: new Date().toISOString() })
        .eq('id', request.bloodUnitId)
        .eq('status', 'AVAILABLE') // Only allow transition if currently AVAILABLE
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (error || !data) {
        // Publish block event
        await eventBus.publish({
          eventType: 'hos.blood.transfusion.blocked.v1',
          tenantId: request.tenantId,
          aggregateId: request.encounterId,
          aggregateType: 'encounter',
          payload: {
            encounterId: request.encounterId,
            bloodUnitId: request.bloodUnitId,
            reasonCode: 'CONCURRENT_RESERVATION_CONFLICT',
            compatibilityResult: 'UNKNOWN',
            crossmatchStatus: 'UNKNOWN',
          },
        });
        throw new Error('Blood unit is unavailable or already reserved/transfused');
      }

      await eventBus.publish({
        eventType: 'hos.blood.unit.reserved.v1',
        tenantId: request.tenantId,
        aggregateId: request.encounterId,
        aggregateType: 'encounter',
        payload: {
          bloodUnitId: request.bloodUnitId,
          encounterId: request.encounterId,
        },
      });

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'RESERVE_BLOOD_UNIT_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async doubleVerifyTransfusion(request: DoubleVerifyTransfusionRequest): Promise<EngineResponse<TransfusionVerificationRow>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'doubleVerifyTransfusion',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_transfusion_verifications')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('encounter_id', request.encounterId)
              .eq('blood_unit_id', request.bloodUnitId)
              .maybeSingle();

            if (!queryError && existing) {
              return { success: true, data: existing };
            }
          }
          throw new Error(`Idempotency failure: ${insertError.message}`);
        }
      }

      // Check unit status & compatibility rules
      const { data: unit, error: unitError } = await this.supabase
        .from('hc_blood_units')
        .select('*')
        .eq('id', request.bloodUnitId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (unitError || !unit) {
        throw new Error(`Blood unit not found: ${unitError?.message || 'Invalid unit ID'}`);
      }

      // Check crossmatch approval
      const { data: crossmatch, error: crossError } = await this.supabase
        .from('hc_blood_crossmatch_records')
        .select('*')
        .eq('id', request.crossmatchId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (crossError || !crossmatch) {
        throw new Error(`Crossmatch record not found: ${crossError?.message || 'Invalid ID'}`);
      }

      if (crossmatch.status !== 'APPROVED') {
        // Block
        await eventBus.publish({
          eventType: 'hos.blood.transfusion.blocked.v1',
          tenantId: request.tenantId,
          aggregateId: request.encounterId,
          aggregateType: 'encounter',
          payload: {
            encounterId: request.encounterId,
            bloodUnitId: request.bloodUnitId,
            reasonCode: 'CROSSMATCH_NOT_APPROVED',
            compatibilityResult: 'UNKNOWN',
            crossmatchStatus: crossmatch.status,
          },
        });
        throw new Error(`Crossmatch must be approved: ${crossmatch.status}`);
      }

      // ENFORCE RBC COMPATIBILITY MATRIX (Donor RBC to Recipient)
      const rBCMatrix: Record<string, string[]> = {
        'O': ['O'],
        'A': ['A', 'O'],
        'B': ['B', 'O'],
        'AB': ['AB', 'A', 'B', 'O'],
      };

      const recipientType = request.verificationData.bloodType;
      const unitType = unit.blood_type as 'A' | 'B' | 'AB' | 'O';

      const aboCompatible = rBCMatrix[recipientType]?.includes(unitType);

      // Rh factor compatibility (Rh- receives ONLY Rh-, Rh+ receives Rh+ or Rh-)
      const recipientRh = request.verificationData.rhFactor;
      const unitRh = unit.rh_factor as 'POSITIVE' | 'NEGATIVE';
      const rhCompatible = recipientRh === 'POSITIVE' || unitRh === 'NEGATIVE';

      if (!aboCompatible || !rhCompatible) {
        // Safety violation event published
        await eventBus.publish({
          eventType: 'hos.blood.transfusion.blocked.v1',
          tenantId: request.tenantId,
          aggregateId: request.encounterId,
          aggregateType: 'encounter',
          payload: {
            encounterId: request.encounterId,
            bloodUnitId: request.bloodUnitId,
            reasonCode: 'RBC_INCOMPATIBILITY',
            compatibilityResult: 'INCOMPATIBLE',
            crossmatchStatus: crossmatch.status,
          },
        });
        throw new Error(`RBC Compatibility check failed: Patient ${recipientType} ${recipientRh} is incompatible with Unit ${unitType} ${unitRh}`);
      }

      const { data, error } = await this.supabase
        .from('hc_transfusion_verifications')
        .insert({
          tenant_id: request.tenantId,
          encounter_id: request.encounterId,
          blood_unit_id: request.bloodUnitId,
          crossmatch_id: request.crossmatchId,
          verification_data: request.verificationData,
          verified_by_clinician_a: request.verifiedByClinicianA,
          verified_by_clinician_b: request.verifiedByClinicianB,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to record transfusion verification: ${error.message}`);
      }

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'DOUBLE_VERIFICATION_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async startTransfusion(request: StartTransfusionRequest): Promise<EngineResponse<TransfusionRecordRow>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'startTransfusion',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_transfusion_records')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('blood_unit_id', request.bloodUnitId)
              .eq('verification_id', request.verificationId)
              .maybeSingle();

            if (!queryError && existing) {
              return { success: true, data: existing };
            }
          }
          throw new Error(`Idempotency failure: ${insertError.message}`);
        }
      }

      // Check verification exists
      const { data: ver, error: verError } = await this.supabase
        .from('hc_transfusion_verifications')
        .select('*')
        .eq('id', request.verificationId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (verError || !ver) {
        throw new Error(`Transfusion verification record not found: ${verError?.message || 'Invalid ID'}`);
      }

      // Check unit status & expiration
      const { data: unit, error: unitError } = await this.supabase
        .from('hc_blood_units')
        .select('*')
        .eq('id', request.bloodUnitId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (unitError || !unit) {
        throw new Error(`Blood unit not found: ${unitError?.message || 'Invalid ID'}`);
      }

      if (unit.status !== 'RESERVED' && unit.status !== 'AVAILABLE') {
        await eventBus.publish({
          eventType: 'hos.blood.transfusion.blocked.v1',
          tenantId: request.tenantId,
          aggregateId: request.encounterId,
          aggregateType: 'encounter',
          payload: {
            encounterId: request.encounterId,
            bloodUnitId: request.bloodUnitId,
            reasonCode: 'INVALID_UNIT_STATUS',
            compatibilityResult: 'UNKNOWN',
            crossmatchStatus: 'APPROVED',
          },
        });
        throw new Error(`Blood unit status must be RESERVED or AVAILABLE: ${unit.status}`);
      }

      const expiry = new Date(unit.expiry_date).getTime();
      const now = new Date().getTime();
      if (now > expiry) {
        // Expiration safety block
        await this.supabase
          .from('hc_blood_units')
          .update({ status: 'EXPIRED' })
          .eq('id', request.bloodUnitId)
          .eq('tenant_id', request.tenantId);

        await eventBus.publish({
          eventType: 'hos.blood.transfusion.blocked.v1',
          tenantId: request.tenantId,
          aggregateId: request.encounterId,
          aggregateType: 'encounter',
          payload: {
            encounterId: request.encounterId,
            bloodUnitId: request.bloodUnitId,
            reasonCode: 'BLOOD_UNIT_EXPIRED',
            compatibilityResult: 'UNKNOWN',
            crossmatchStatus: 'APPROVED',
          },
        });
        throw new Error('Blood unit has expired');
      }

      const { data, error } = await this.supabase
        .from('hc_transfusion_records')
        .insert({
          tenant_id: request.tenantId,
          encounter_id: request.encounterId,
          blood_unit_id: request.bloodUnitId,
          verification_id: request.verificationId,
          started_at: request.startedAt,
          status: 'started',
          reaction_occurred: false,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to record transfusion: ${error.message}`);
      }

      // Update unit status to TRANSFUSING
      await this.supabase
        .from('hc_blood_units')
        .update({ status: 'TRANSFUSING', updated_at: new Date().toISOString() })
        .eq('id', request.bloodUnitId)
        .eq('tenant_id', request.tenantId);

      await eventBus.publish({
        eventType: 'hos.blood.transfusion.started.v1',
        tenantId: request.tenantId,
        aggregateId: request.encounterId,
        aggregateType: 'encounter',
        payload: {
          transfusionId: data.id,
          encounterId: request.encounterId,
          bloodUnitId: request.bloodUnitId,
        },
      });

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'START_TRANSFUSION_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async completeTransfusion(request: CompleteTransfusionRequest): Promise<EngineResponse<TransfusionRecordRow>> {
    try {
      const { data: record, error: fetchError } = await this.supabase
        .from('hc_transfusion_records')
        .select('*')
        .eq('id', request.transfusionId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (fetchError || !record) {
        throw new Error(`Transfusion record not found: ${fetchError?.message || 'Invalid ID'}`);
      }

      if (record.status !== 'started') {
        throw new Error(`Transfusion is already in status: ${record.status}`);
      }

      const targetStatus = request.reactionOccurred ? 'aborted' : 'completed';
      const unitTargetStatus = request.reactionOccurred ? 'REJECTED' : 'TRANSFUSED';

      const { data, error } = await this.supabase
        .from('hc_transfusion_records')
        .update({
          status: targetStatus,
          completed_at: request.completedAt,
          reaction_occurred: request.reactionOccurred,
          reaction_details: request.reactionDetails || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.transfusionId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to complete transfusion: ${error.message}`);
      }

      // Update unit status to terminal status
      await this.supabase
        .from('hc_blood_units')
        .update({ status: unitTargetStatus, updated_at: new Date().toISOString() })
        .eq('id', record.blood_unit_id)
        .eq('tenant_id', request.tenantId);

      await eventBus.publish({
        eventType: 'hos.blood.transfusion.completed.v1',
        tenantId: request.tenantId,
        aggregateId: record.encounter_id,
        aggregateType: 'encounter',
        payload: {
          transfusionId: data.id,
          status: targetStatus,
          reactionOccurred: request.reactionOccurred,
        },
      });

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'COMPLETE_TRANSFUSION_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
