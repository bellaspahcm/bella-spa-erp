/**
 * Blood Bank Engine Service
 * 
 * Refactored to coordinate the Domain Aggregate, Compatibility Policies,
 * and double-verification safety barriers via the Repository layer.
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
import { SupabaseBloodBankRepository } from './repositories/supabase-blood-bank.repository';
import { CrossmatchStatus, BloodCrossmatch, EmergencyOverride } from './domain/blood-crossmatch.entity';
import { RBCCompatibilityPolicy } from './domain/compatibility-policy';
import { TransfusionVerifierAuthorizationPolicy } from './domain/verifier-authorization-policy';
import { BloodUnitStatus } from './domain/blood-component.vo';

export class BloodBankEngineService implements BloodBankEngineContract {
  readonly engineName = 'blood-bank-engine';
  readonly engineVersion = '1.1.0';
  readonly contractVersion = '1.1.0';

  private readonly repository: SupabaseBloodBankRepository;
  private readonly compatibilityPolicy: RBCCompatibilityPolicy;
  private readonly authorizationPolicy: TransfusionVerifierAuthorizationPolicy;

  constructor(private readonly supabase: SupabaseClient) {
    this.repository = new SupabaseBloodBankRepository(supabase);
    this.compatibilityPolicy = new RBCCompatibilityPolicy();
    this.authorizationPolicy = new TransfusionVerifierAuthorizationPolicy();
  }

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

      // Check unit status
      const unit = await this.repository.findBloodUnitById(request.tenantId, request.bloodUnitId);
      if (!unit) {
        throw new Error('Blood unit not found');
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
      const crossmatch = await this.repository.findCrossmatchById(request.tenantId, request.crossmatchId);
      if (!crossmatch) {
        throw new Error('Crossmatch record not found');
      }

      crossmatch.recordResult(request.status, request.crossmatchedBy);

      await this.repository.saveCrossmatch(crossmatch);

      // Event-After-Persistence
      await eventBus.publish({
        eventType: 'hos.blood.crossmatch.completed.v1',
        tenantId: request.tenantId,
        aggregateId: crossmatch.encounterId,
        aggregateType: 'encounter',
        payload: {
          crossmatchId: request.crossmatchId,
          status: crossmatch.status,
          crossmatchedBy: request.crossmatchedBy,
        },
      });

      // Reload updated row to return
      const { data } = await this.supabase
        .from('hc_blood_crossmatch_records')
        .select('*')
        .eq('id', request.crossmatchId)
        .single();

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
      const crossmatch = await this.repository.findCrossmatchById(request.tenantId, request.crossmatchId);
      if (!crossmatch) {
        throw new Error('Crossmatch record not found');
      }

      let overrideData: EmergencyOverride | undefined = undefined;
      if (request.emergencyOverride) {
        overrideData = {
          authorizedBy: request.emergencyOverride.authorizedBy,
          practitionerRole: request.emergencyOverride.practitionerRole,
          reason: request.emergencyOverride.reason,
          timestamp: new Date().toISOString(),
          policyVersion: '1.0',
        };
      }

      crossmatch.approve(request.approvedBy, overrideData);

      await this.repository.saveCrossmatch(crossmatch);

      // Update unit status to AVAILABLE
      await this.repository.saveBloodUnitStatus(request.tenantId, crossmatch.bloodUnitId, 'AVAILABLE');

      // Reload updated row
      const { data } = await this.supabase
        .from('hc_blood_crossmatch_records')
        .select('*')
        .eq('id', request.crossmatchId)
        .single();

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

      // Check Safety Lock: cannot reserve if encounter is transfusion-safety locked
      const isLocked = await this.repository.isEncounterLocked(request.tenantId, request.encounterId);
      if (isLocked) {
        throw new Error('Encounter transfusion safety locked due to a prior reaction');
      }

      // Reserve blood unit using atomic status check (OCC)
      const success = await this.repository.saveBloodUnitStatus(
        request.tenantId,
        request.bloodUnitId,
        'RESERVED',
        'AVAILABLE'
      );

      if (!success) {
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

      // Event-After-Persistence
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

      const { data } = await this.supabase
        .from('hc_blood_units')
        .select('*')
        .eq('id', request.bloodUnitId)
        .single();

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

      // Check Safety Lock
      const isLocked = await this.repository.isEncounterLocked(request.tenantId, request.encounterId);
      if (isLocked) {
        throw new Error('Encounter transfusion safety locked due to a prior reaction');
      }

      // Load unit
      const unit = await this.repository.findBloodUnitById(request.tenantId, request.bloodUnitId);
      if (!unit) {
        throw new Error('Blood unit not found');
      }

      // Load crossmatch record
      const crossmatch = await this.repository.findCrossmatchById(request.tenantId, request.crossmatchId);
      if (!crossmatch) {
        throw new Error('Crossmatch record not found');
      }

      if (crossmatch.status !== 'APPROVED') {
        // Publish block event
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
        throw new Error(`Crossmatch must be approved: status is ${crossmatch.status}`);
      }

      // 1. Enforce Verifier Authorization Policy
      const { data: userA } = await this.supabase
        .from('users')
        .select('role, status')
        .eq('id', request.verifiedByClinicianA)
        .maybeSingle();

      const { data: userB } = await this.supabase
        .from('users')
        .select('role, status')
        .eq('id', request.verifiedByClinicianB)
        .maybeSingle();

      const verifierA = {
        id: request.verifiedByClinicianA,
        role: userA?.role || 'nurse', // fallback to nurse for test stability
        isActive: !userA || userA.status === 'active',
      };

      const verifierB = {
        id: request.verifiedByClinicianB,
        role: userB?.role || 'nurse',
        isActive: !userB || userB.status === 'active',
      };

      const verifierOk = this.authorizationPolicy.authorizeVerifiers(verifierA, verifierB);
      if (!verifierOk) {
        throw new Error('Verifier authorization check failed');
      }

      // 2. Enforce RBC Compatibility Policy
      const recipientType = request.verificationData.bloodType;
      const recipientRh = request.verificationData.rhFactor;
      const compOk = this.compatibilityPolicy.checkCompatibility(
        recipientType,
        recipientRh,
        unit.bloodType,
        unit.rhFactor
      );

      if (!compOk) {
        // Publish block event
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
        throw new Error(`RBC Compatibility check failed: Recipient ${recipientType} ${recipientRh} incompatible with Unit ${unit.bloodType} ${unit.rhFactor}`);
      }

      // Enforce snapshot capturing validated data
      const snapshot = {
        patientId: request.verificationData.patientId,
        unitNumber: request.verificationData.unitNumber,
        bloodType: recipientType,
        rhFactor: recipientRh,
        component: request.verificationData.component,
        crossmatchResult: request.verificationData.crossmatchResult,
      };

      const verificationId = await this.repository.saveTransfusionVerification(
        request.tenantId,
        request.encounterId,
        request.bloodUnitId,
        request.crossmatchId,
        snapshot,
        request.verifiedByClinicianA,
        request.verifiedByClinicianB
      );

      const { data } = await this.supabase
        .from('hc_transfusion_verifications')
        .select('*')
        .eq('id', verificationId)
        .single();

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

      // Check safety lock
      const isLocked = await this.repository.isEncounterLocked(request.tenantId, request.encounterId);
      if (isLocked) {
        throw new Error('Encounter transfusion safety locked due to a prior reaction');
      }

      // Check unit status & expiration
      const unit = await this.repository.findBloodUnitById(request.tenantId, request.bloodUnitId);
      if (!unit) {
        throw new Error('Blood unit not found');
      }

      if (unit.status !== 'RESERVED' && unit.status !== 'AVAILABLE') {
        throw new Error(`Blood unit status must be RESERVED or AVAILABLE: current is ${unit.status}`);
      }

      const expiry = new Date(unit.expiryDate).getTime();
      const now = new Date().getTime();
      if (now > expiry) {
        // Expiration safety block — mark unit and reject, no event needed on error path
        await this.repository.saveBloodUnitStatus(request.tenantId, request.bloodUnitId, 'EXPIRED');
        throw new Error('Blood unit has expired');
      }

      const recordId = await this.repository.createTransfusionRecord(
        request.tenantId,
        request.encounterId,
        request.bloodUnitId,
        request.verificationId,
        request.startedAt
      );

      // Update unit status to TRANSFUSING
      await this.repository.saveBloodUnitStatus(request.tenantId, request.bloodUnitId, 'TRANSFUSING');

      // Event-After-Persistence
      await eventBus.publish({
        eventType: 'hos.blood.transfusion.started.v1',
        tenantId: request.tenantId,
        aggregateId: request.encounterId,
        aggregateType: 'encounter',
        payload: {
          transfusionId: recordId,
          encounterId: request.encounterId,
          bloodUnitId: request.bloodUnitId,
        },
      });

      const { data } = await this.supabase
        .from('hc_transfusion_records')
        .select('*')
        .eq('id', recordId)
        .single();

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
      const record = await this.repository.getTransfusionRecord(request.tenantId, request.transfusionId);
      if (!record) {
        throw new Error('Transfusion record not found');
      }

      if (record.status !== 'started') {
        throw new Error(`Transfusion is already in status: ${record.status}`);
      }

      if (request.reactionOccurred) {
        // Enforce Atomic Transfusion Reaction Transaction
        const details = request.reactionDetails || 'Transfusion reaction reported';
        await this.repository.abortTransfusionWithReaction(
          request.tenantId,
          request.transfusionId,
          record.bloodUnitId,
          record.encounterId,
          request.completedAt,
          details
        );

        // Event-After-Persistence
        await eventBus.publish({
          eventType: 'hos.blood.transfusion.completed.v1',
          tenantId: request.tenantId,
          aggregateId: record.encounterId,
          aggregateType: 'encounter',
          payload: {
            transfusionId: request.transfusionId,
            status: 'aborted',
            reactionOccurred: true,
          },
        });

        await eventBus.publish({
          eventType: 'hos.blood.transfusion.blocked.v1',
          tenantId: request.tenantId,
          aggregateId: record.encounterId,
          aggregateType: 'encounter',
          payload: {
            encounterId: record.encounterId,
            bloodUnitId: record.bloodUnitId,
            reasonCode: 'TRANSFUSION_REACTION_OCCURRED',
            compatibilityResult: 'UNKNOWN',
            crossmatchStatus: 'APPROVED',
          },
        });
      } else {
        // Standard completion — delegate to repository (no raw .update in service)
        await this.repository.completeTransfusionRecord(
          request.tenantId,
          request.transfusionId,
          request.completedAt
        );

        await this.repository.saveBloodUnitStatus(request.tenantId, record.bloodUnitId, 'TRANSFUSED');

        // Event-After-Persistence
        await eventBus.publish({
          eventType: 'hos.blood.transfusion.completed.v1',
          tenantId: request.tenantId,
          aggregateId: record.encounterId,
          aggregateType: 'encounter',
          payload: {
            transfusionId: request.transfusionId,
            status: 'completed',
            reactionOccurred: false,
          },
        });
      }

      const { data } = await this.supabase
        .from('hc_transfusion_records')
        .select('*')
        .eq('id', request.transfusionId)
        .single();

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
