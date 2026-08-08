/**
 * Pharmacy Engine Service (MAR)
 * 
 * Healthcare Platform engine for pharmacy and medication administration.
 * 
 * **STATUS:** PLACEHOLDER - Week 3-4 Implementation
 * **TODO:** Implement full service logic
 * 
 * @module platform/healthcare/engines/pharmacy-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PharmacyEngineContract,
  MARAdministrationRequest,
} from '../../contracts/pharmacy-engine.contract';
import type { EngineResponse, MedicationOrder, EngineHealthStatus } from '../../shared-kernel/types';
import { eventBus } from '@/platform/host/event-bus';
import { CdsEngineService } from '../cds-engine/cds-engine.service';

export class PharmacyEngineService implements PharmacyEngineContract {
  readonly engineName = 'pharmacy-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  private readonly cdsEngine: CdsEngineService;

  constructor(private readonly supabase: SupabaseClient) {
    this.cdsEngine = new CdsEngineService(supabase);
  }

  async recordMedicationAdministration(request: MARAdministrationRequest): Promise<EngineResponse<{ id: string }>> {
    try {
      const now = new Date().toISOString();

      const marRecord = {
        id: crypto.randomUUID(),
        tenant_id: request.tenantId,
        encounter_id: request.encounterId,
        patient_id: request.patientId,
        medication_order_id: request.medicationOrderId,
        administered_by: request.administeredBy,
        administered_at: request.administeredAt,
        dosage_given: request.dosageGiven,
        route: request.route,
        site: request.site,
        notes: request.notes,
        status: 'completed',
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await this.supabase
        .from('hc_medication_administration_records')
        .insert(marRecord)
        .select()
        .single();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'RECORD_FAILED',
            message: 'Failed to record medication administration',
            details: { error },
            timestamp: now,
          },
        };
      }

      // Get medication order details for event payload
      const { data: orderData } = await this.supabase
        .from('hc_medication_orders')
        .select('medication_name, dosage, route')
        .eq('id', request.medicationOrderId)
        .single();

      // Publish MedicationAdministered event
      await eventBus.publish({
        eventType: 'MedicationAdministered',
        tenantId: request.tenantId,
        aggregateId: data.id,
        aggregateType: 'MedicationAdministration',
        payload: {
          marId: data.id,
          orderId: request.medicationOrderId,
          patientId: request.patientId,
          encounterId: request.encounterId,
          medicationName: orderData?.medication_name || 'Unknown',
          dose: request.dosageGiven,
          route: request.route,
          administeredBy: request.administeredBy,
          administeredAt: request.administeredAt,
          notes: request.notes,
        },
        userId: request.administeredBy,
      });

      console.log(`[PharmacyEngine] Recorded medication administration for patient ${request.patientId}`);

      return {
        success: true,
        data: { id: data.id },
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

  async getMedicationOrders(tenantId: string, encounterId: string): Promise<EngineResponse<MedicationOrder[]>> {
    try {
      const { data, error } = await this.supabase
        .from('hc_medication_orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('encounter_id', encounterId)
        .in('status', ['active', 'on-hold'])
        .order('prescribed_date', { ascending: false });

      if (error) {
        return {
          success: false,
          error: {
            code: 'QUERY_ERROR',
            message: 'Failed to get medication orders',
            details: { error },
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: (data || []) as MedicationOrder[],
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

  async dispenseMedication(request: {
    tenantId: string;
    medicationOrderId: string;
    dispensedBy: string;
    /** CDS Barrier 2: required for re-check at dispense time */
    patientId?: string;
    encounterId?: string;
    drugCode?: string;
    currentMedicationCodes?: string[];
  }): Promise<EngineResponse<MedicationOrder>> {
    try {
      const now = new Date().toISOString();

      // ── CDS Barrier 2: Re-check at dispense time ──────────────────────────
      // Defense-in-depth: catches new allergies or DDIs added AFTER prescribing.
      if (request.patientId && request.encounterId && request.drugCode) {
        const cdsResult = await this.cdsEngine.generateCdsSummary({
          requestId: `dispense-cds-${request.medicationOrderId}`,
          tenantId: request.tenantId,
          encounterId: request.encounterId,
          patientId: request.patientId,
          proposedDrugCode: request.drugCode,
          currentMedicationCodes: request.currentMedicationCodes ?? [],
          causationId: request.medicationOrderId,
        });

        if (cdsResult.success && cdsResult.data?.hardBlocked) {
          await eventBus.publish({
            eventType: 'hos.cds.dispense.blocked.v1',
            tenantId: request.tenantId,
            aggregateId: request.medicationOrderId,
            aggregateType: 'MedicationOrder',
            payload: {
              medicationOrderId: request.medicationOrderId,
              encounterId: request.encounterId,
              patientId: request.patientId,
              drugCode: request.drugCode,
              cdsCheckId: cdsResult.data.calculationId,
              alertCount: cdsResult.data.alerts.length,
              barrier: 'PHARMACY_DISPENSE',
            },
          });

          return {
            success: false,
            error: {
              code: 'CDS_DISPENSE_BLOCKED',
              message:
                'Dispense blocked by CDS Barrier 2: new clinical safety constraint detected since prescribing. See hos.cds.dispense.blocked.v1 event.',
              details: {
                cdsCheckId: cdsResult.data.calculationId,
                alerts: cdsResult.data.alerts
                  .filter((a) => a.enforcement === 'ABSOLUTE_BLOCK' || a.enforcement === 'BLOCK')
                  .map((a) => ({ type: a.alertType, severity: a.severity, message: a.message })),
              },
              timestamp: now,
            },
          };
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      const { data, error } = await this.supabase
        .from('hc_medication_orders')
        .update({
          status: 'active',
          dispensed_by: request.dispensedBy,
          dispensed_date: now,
          updated_at: now,
        })
        .eq('id', request.medicationOrderId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'DISPENSE_FAILED',
            message: 'Failed to dispense medication',
            details: { error },
            timestamp: now,
          },
        };
      }

      // TODO: Deduct inventory
      // TODO: Publish MedicationDispensed event

      console.log(`[PharmacyEngine] Dispensed medication order ${request.medicationOrderId}`);

      return {
        success: true,
        data: data as MedicationOrder,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DISPENSE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      const { error } = await this.supabase
        .from('hc_medication_orders')
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

// TODO Week 3-4: Full implementation
// TODO Week 3-4: Drug interaction checking
// TODO Week 3-4: Inventory integration
// TODO Week 3-4: Tests + contract registration
