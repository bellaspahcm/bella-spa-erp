/**
 * Emergency Department Engine Service
 * 
 * Healthcare Platform engine for ED admissions, ESI v5 triage assessments, and NEDOCS scoring.
 * 
 * @module platform/healthcare/engines/emergency-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EmergencyEngineContract,
  RegisterEmergencyVisitRequest,
  EmergencyVisitRow,
  PerformTriageRequest,
  TriageAssessmentRow,
  AssignEmergencyBedRequest,
  CalculateNedocsRequest,
  CalculateNedocsResponse,
} from '../../contracts/emergency-engine.contract';
import type { EngineResponse } from '../../shared-kernel/types';
import { eventBus } from '../../../host/event-bus';

export class EmergencyEngineService implements EmergencyEngineContract {
  readonly engineName = 'emergency-engine';
  readonly engineVersion = '1.1.0';
  readonly contractVersion = '1.1.0';

  constructor(private readonly supabase: SupabaseClient) {}

  async registerEmergencyVisit(request: RegisterEmergencyVisitRequest): Promise<EngineResponse<EmergencyVisitRow>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'registerEmergencyVisit',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_emergency_visits')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('encounter_id', request.encounterId)
              .maybeSingle();

            if (!queryError && existing) {
              return { success: true, data: existing };
            }
          }
          throw new Error(`Idempotency failure: ${insertError.message}`);
        }
      }

      const { data, error } = await this.supabase
        .from('hc_emergency_visits')
        .insert({
          tenant_id: request.tenantId,
          encounter_id: request.encounterId,
          chief_complaint: request.chiefComplaint,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to register emergency visit: ${error.message}`);
      }

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'REGISTER_EMERGENCY_VISIT_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async performTriage(request: PerformTriageRequest): Promise<EngineResponse<TriageAssessmentRow>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'performTriage',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_triage_assessments')
              .select('*')
              .eq('tenant_id', request.tenantId)
              .eq('emergency_visit_id', request.emergencyVisitId)
              .eq('assessment_type', request.assessmentType)
              .maybeSingle();

            if (!queryError && existing) {
              return { success: true, data: existing };
            }
          }
          throw new Error(`Idempotency failure: ${insertError.message}`);
        }
      }

      // Check if emergency visit exists
      const { data: visit, error: visitError } = await this.supabase
        .from('hc_emergency_visits')
        .select('*')
        .eq('id', request.emergencyVisitId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (visitError || !visit) {
        throw new Error(`Emergency visit not found: ${visitError?.message || 'Invalid ID'}`);
      }

      // Record ESI Triage assessment log
      const { data, error } = await this.supabase
        .from('hc_triage_assessments')
        .insert({
          tenant_id: request.tenantId,
          emergency_visit_id: request.emergencyVisitId,
          acuity_level: request.acuityLevel,
          assessment_type: request.assessmentType,
          acuity_criteria: request.acuityCriteria,
          assessed_by: request.assessedBy,
          assessed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to perform triage: ${error.message}`);
      }

      // Record Clinical Calculation Provenance for ESI Triage Assessment
      await this.supabase
        .from('hc_clinical_calculations')
        .insert({
          tenant_id: request.tenantId,
          encounter_id: visit.encounter_id,
          algorithm_id: 'ESI',
          algorithm_version: 'v5',
          calculation_timestamp: new Date().toISOString(),
          calculation_status: 'COMPLETED',
          input_snapshot: { acuityCriteria: request.acuityCriteria },
          source_observation_references: [{ entity_type: 'triage_assessment', entity_id: data.id }],
          output: { acuityLevel: request.acuityLevel, type: request.assessmentType },
          engine_version: this.engineVersion,
        });

      // Publish Triage reassessed domain event
      await eventBus.publish({
        eventType: 'hos.ed.triage.reassessed.v1',
        tenantId: request.tenantId,
        aggregateId: visit.encounter_id,
        aggregateType: 'encounter',
        payload: {
          emergencyVisitId: request.emergencyVisitId,
          acuityLevel: request.acuityLevel,
          assessmentType: request.assessmentType,
          assessedBy: request.assessedBy,
        },
      });

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'PERFORM_TRIAGE_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async assignEmergencyBed(request: AssignEmergencyBedRequest): Promise<EngineResponse<EmergencyVisitRow>> {
    try {
      if (request.requestId) {
        const { error: insertError } = await this.supabase
          .from('hc_idempotency_keys')
          .insert({
            tenant_id: request.tenantId,
            request_id: request.requestId,
            operation: 'assignEmergencyBed',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existing, error: queryError } = await this.supabase
              .from('hc_emergency_visits')
              .select('*')
              .eq('id', request.emergencyVisitId)
              .eq('tenant_id', request.tenantId)
              .single();

            if (!queryError && existing) {
              return { success: true, data: existing };
            }
          }
          throw new Error(`Idempotency failure: ${insertError.message}`);
        }
      }

      // Check if bed is active
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
        .from('hc_emergency_visits')
        .update({
          assigned_bed_id: request.bedId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.emergencyVisitId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to assign bed: ${error.message}`);
      }

      return { success: true, data };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'ASSIGN_BED_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async calculateNedocsScore(request: CalculateNedocsRequest): Promise<EngineResponse<CalculateNedocsResponse>> {
    try {
      // NEDOCS Score calculation formula
      const activeRatio = request.activeEdPatients / Math.max(1, request.totalEdBeds);
      const score = Math.round(
        activeRatio * 100 +
        request.criticalPatients * 10 +
        request.admittedPatientsWaitingForBeds * 5 +
        request.ventilatorsInUse +
        request.longestWaitTimeHrs
      );

      // Write NEDOCS operational score to clinical calculations
      const { data: calc, error: calcError } = await this.supabase
        .from('hc_clinical_calculations')
        .insert({
          tenant_id: request.tenantId,
          encounter_id: request.encounterId,
          algorithm_id: 'NEDOCS',
          algorithm_version: 'v1.0',
          calculation_timestamp: new Date().toISOString(),
          calculation_status: 'COMPLETED',
          input_snapshot: {
            totalEdBeds: request.totalEdBeds,
            activeEdPatients: request.activeEdPatients,
            criticalPatients: request.criticalPatients,
            admittedPatientsWaitingForBeds: request.admittedPatientsWaitingForBeds,
            ventilatorsInUse: request.ventilatorsInUse,
            longestWaitTimeHrs: request.longestWaitTimeHrs,
          },
          source_observation_references: [{ entity_type: 'emergency_visit', entity_id: request.emergencyVisitId }],
          output: { score },
          engine_version: this.engineVersion,
        })
        .select()
        .single();

      if (calcError) {
        throw new Error(`Failed to record clinical calculation: ${calcError.message}`);
      }

      // Update emergency visit with computed NEDOCS
      await this.supabase
        .from('hc_emergency_visits')
        .update({
          nedocs_score: score,
          nedocs_calculated_at: new Date().toISOString(),
        })
        .eq('id', request.emergencyVisitId)
        .eq('tenant_id', request.tenantId);

      return {
        success: true,
        data: {
          score,
          calculationId: calc.id,
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'NEDOCS_CALCULATION_FAILED',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
