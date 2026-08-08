/**
 * OR Readiness Engine Service
 * 
 * Healthcare Platform engine for pre-operative readiness checks.
 * 
 * @module platform/healthcare/engines/or-readiness-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ORReadinessEngineContract,
  ORReadinessResult,
  ConsentStatusProvider,
  RoomReadinessProvider,
} from '../../contracts/or-readiness-engine.contract';
import type { EngineResponse, EngineHealthStatus } from '../../shared-kernel/types';
import { eventBus } from '../../../host/event-bus';

export class ORReadinessEngineService implements ORReadinessEngineContract {
  readonly engineName = 'or-readiness-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly consentProvider: ConsentStatusProvider,
    private readonly roomReadinessProvider: RoomReadinessProvider
  ) {}

  async evaluateReadiness(tenantId: string, surgicalCaseId: string): Promise<EngineResponse<ORReadinessResult>> {
    try {
      // 1. Fetch Case and Encounter
      const { data: surgicalCase, error: caseError } = await this.supabase
        .from('hc_surgical_cases')
        .select('id, encounter_id, status')
        .eq('id', surgicalCaseId)
        .eq('tenant_id', tenantId)
        .single();

      if (caseError || !surgicalCase) {
        return {
          success: false,
          error: {
            code: 'CASE_NOT_FOUND',
            message: 'Surgical case not found',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 2. Fetch OR Schedule to identify Operating Room
      const { data: schedule, error: schedError } = await this.supabase
        .from('hc_or_schedules')
        .select('operating_room_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'scheduled') // or confirmed
        .limit(1)
        .maybeSingle();

      const operatingRoomId = schedule?.operating_room_id;

      // 3. Evaluate Consent via Port
      let consentStatus: 'signed' | 'missing' | 'unknown' = 'unknown';
      try {
        consentStatus = await this.consentProvider.getConsentStatus(surgicalCase.encounter_id);
      } catch (err: unknown) {
        consentStatus = 'unknown';
      }

      // 4. Evaluate Room Cleaning Status via Port
      let roomCleaningStatus: 'cleaned' | 'dirty' | 'unknown' = 'unknown';
      let roomScheduled = true;
      if (operatingRoomId) {
        try {
          roomCleaningStatus = await this.roomReadinessProvider.getCleaningStatus(operatingRoomId);
        } catch (err: unknown) {
          roomCleaningStatus = 'unknown';
        }
      } else {
        roomScheduled = false;
      }

      // 5. Evaluate CSSD Cycles Completed
      // Check if there are any equipment usage entries for this surgical case
      const { data: usages, error: usagesError } = await this.supabase
        .from('hc_or_equipment_usage')
        .select(`
          equipment_id,
          hc_cssd_cycles(indicator_result)
        `)
        .eq('surgical_case_id', surgicalCaseId)
        .eq('tenant_id', tenantId);

      let cssdCyclesCompleted = true;
      if (!usagesError && usages && usages.length > 0) {
        for (const usage of usages as Array<Record<string, unknown>>) {
          const cycle = usage.hc_cssd_cycles as Record<string, unknown> | null;
          if (!cycle || cycle.indicator_result !== 'pass') {
            cssdCyclesCompleted = false;
            break;
          }
        }
      } else {
        // If no equipment listed, we consider it completed (no sterile instruments needed)
        cssdCyclesCompleted = true;
      }

      // 6. Evaluate Team Assigned
      // Need at least 1 surgeon and 1 anesthesiologist assigned
      const { data: team, error: teamError } = await this.supabase
        .from('hc_surgical_teams')
        .select('role')
        .eq('surgical_case_id', surgicalCaseId)
        .eq('tenant_id', tenantId);

      let hasSurgeon = false;
      let hasAnesthesiologist = false;
      if (!teamError && team) {
        const teamMembers = team as { role: string }[];
        hasSurgeon = teamMembers.some(member => member.role === 'surgeon');
        hasAnesthesiologist = teamMembers.some(member => member.role === 'anesthesiologist');
      }
      const teamAssigned = hasSurgeon && hasAnesthesiologist;

      // 7. Evaluate Safety Checklist
      const { data: checklist, error: checklistError } = await this.supabase
        .from('hc_surgical_safety_checklists')
        .select('signin_completed, timeout_completed')
        .eq('surgical_case_id', surgicalCaseId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const checklistData = checklist as { signin_completed: boolean; timeout_completed: boolean } | null;
      const checklistCompleted = !checklistError && checklistData ? (checklistData.signin_completed && checklistData.timeout_completed) : false;

      // Determine blockers & final readiness status
      const blockers: string[] = [];

      if (consentStatus === 'missing') {
        blockers.push('Patient consent is missing');
      }
      if (!roomScheduled) {
        blockers.push('Operating room is not scheduled');
      } else if (roomCleaningStatus === 'dirty') {
        blockers.push('Operating room cleaning is incomplete');
      }
      if (!cssdCyclesCompleted) {
        blockers.push('Sterilization cycles for case equipment have not completed or failed');
      }
      if (!teamAssigned) {
        blockers.push('Surgical team is not fully assigned (requires at least a Surgeon and Anesthesiologist)');
      }

      // Fail-Safe Rule: Unknown = Not Ready!
      let finalStatus: 'ready' | 'not_ready' | 'unknown' = 'not_ready';
      let ready = false;

      if (consentStatus === 'unknown' || (roomScheduled && roomCleaningStatus === 'unknown')) {
        finalStatus = 'unknown';
        ready = false;
        blockers.push('Readiness factors are in an unknown state due to provider failure');
      } else if (blockers.length === 0) {
        finalStatus = 'ready';
        ready = true;
      }


      const result: ORReadinessResult = {
        ready,
        status: finalStatus,
        blockers,
        details: {
          consentStatus,
          roomCleaningStatus,
          cssdCyclesCompleted,
          teamAssigned,
          checklistCompleted,
        },
      };

      if (ready) {
        await eventBus.publish({
          eventType: 'hos.or.ready.v1',
          tenantId,
          aggregateId: surgicalCaseId,
          aggregateType: 'encounter',
          payload: {
            surgicalCaseId,
            status: 'ready',
          },
        });
      }

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
        .from('hc_surgical_cases')
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
