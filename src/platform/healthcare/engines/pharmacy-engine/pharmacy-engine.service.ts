/**
 * Pharmacy Engine Service (MAR)
 * 
 * Healthcare Platform engine for pharmacy and medication administration.
 * 
 * Constitution Compliance:
 * - Law 1: All records reference Encounter
 * - Law 5: MedicationAdministered events published downstream
 * - Law 11: Strictly typed, zero `any` types allowed
 * 
 * @module platform/healthcare/engines/pharmacy-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PharmacyEngineContract,
  MARAdministrationRequest,
} from '../../contracts/pharmacy-engine.contract';
import type { EngineResponse, MedicationOrder, EngineHealthStatus } from '../../shared-kernel/types';
import type { Database } from '@/types/supabase';
import { eventBus } from '@/platform/host/event-bus';
import { CdsEngineService } from '../cds-engine/cds-engine.service';
import { SupabasePharmacyRepository } from './repositories/supabase-pharmacy.repository';
import { MAREntry } from './domain/prescription.entity';

type PrescriptionRow = Database['public']['Tables']['hc_prescriptions']['Row'];

export class PharmacyEngineService implements PharmacyEngineContract {
  readonly engineName = 'pharmacy-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  private readonly cdsEngine: CdsEngineService;
  private readonly pharmacyRepository: SupabasePharmacyRepository;

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.cdsEngine = new CdsEngineService(supabase);
    this.pharmacyRepository = new SupabasePharmacyRepository(supabase);
  }

  async recordMedicationAdministration(request: MARAdministrationRequest): Promise<EngineResponse<{ id: string }>> {
    const now = new Date().toISOString();
    try {
      // 1. Fetch referenced Prescription aggregate
      const prescription = await this.pharmacyRepository.findPrescriptionByClinicalOrderId(
        request.tenantId,
        request.medicationOrderId
      );

      if (!prescription) {
        return {
          success: false,
          error: {
            code: 'PRESCRIPTION_NOT_FOUND',
            message: `Prescription not found for clinical order ${request.medicationOrderId}`,
            timestamp: now,
          },
        };
      }

      // 2. Construct and transition MAREntry aggregate
      const mar = MAREntry.create({
        tenantId: request.tenantId,
        encounterId: request.encounterId,
        prescriptionItemId: prescription.id,
        drugName: prescription.drugs[0]?.name || 'Unknown Drug',
        dosage: `${request.dosageGiven.value} ${request.dosageGiven.unit}`,
        route: request.route,
        scheduledTime: new Date(request.administeredAt),
        notes: request.notes,
      });

      // Execute administration transition
      mar.administer(request.administeredBy, new Date(request.administeredAt), request.notes);

      // 3. Save to database (trigger handles cross-table validation, foreign keys block orphan deletes)
      await this.pharmacyRepository.saveMAR(mar);

      // 4. Publish MedicationAdministered event downstream (Event-After-Persistence)
      await eventBus.publish({
        eventType: 'MedicationAdministered',
        tenantId: request.tenantId,
        aggregateId: mar.id,
        aggregateType: 'MedicationAdministration',
        payload: {
          marId: mar.id,
          patientId: request.patientId,
          encounterId: request.encounterId,
          medicationId: prescription.drugs[0]?.code || '',
          drugName: mar.drugName,
          dosage: mar.dosage,
          route: mar.route,
          administeredAt: request.administeredAt,
          practitionerId: request.administeredBy,
          scheduledTime: request.administeredAt,
          notes: request.notes,
        },
        userId: request.administeredBy,
      });

      console.info(`[PharmacyEngine] Recorded medication administration for patient ${request.patientId}, MAR ID: ${mar.id}`);

      return {
        success: true,
        data: { id: mar.id },
      };
    } catch (error) {
      console.error('[PharmacyEngine] Failed to record medication administration:', error);
      return {
        success: false,
        error: {
          code: 'RECORD_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: now,
        },
      };
    }
  }

  async getMedicationOrders(tenantId: string, encounterId: string): Promise<EngineResponse<MedicationOrder[]>> {
    const now = new Date().toISOString();
    try {
      const { data, error } = await this.supabase
        .from('hc_prescriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('encounter_id', encounterId);

      if (error) {
        return {
          success: false,
          error: {
            code: 'QUERY_ERROR',
            message: 'Failed to get prescriptions',
            timestamp: now,
          },
        };
      }

      const rows = (data || []) as PrescriptionRow[];
      const medicationOrders: MedicationOrder[] = rows.map((row) => {
        const drugsRaw = row.drugs as unknown as {
          code: string;
          name: string;
          dose: string;
          frequency: string;
          durationDays: number;
        }[];
        const firstDrug = drugsRaw[0] || { code: '', name: '', dose: '0', frequency: '', durationDays: 0 };
        const parsedDose = parseFloat(firstDrug.dose) || 0;
        const parsedUnit = firstDrug.dose.replace(/[0-9. ]/g, '') || 'mg';

        return {
          id: row.clinical_order_id ?? '',
          tenantId: row.tenant_id,
          encounterId: row.encounter_id,
          patientId: row.patient_party_id,
          medicationId: firstDrug.code,
          status: row.status === 'dispensed' ? 'active' : 'on-hold',
          dosage: { value: parsedDose, unit: parsedUnit },
          frequency: firstDrug.frequency,
          route: 'oral',
          startDate: row.created_at,
          duration: firstDrug.durationDays,
          durationUnit: 'days',
          prescribedBy: row.doctor_party_id,
          prescribedDate: row.created_at,
          dispensedBy: row.updated_by ?? undefined,
          dispensedDate: row.status === 'dispensed' ? row.updated_at : undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      return {
        success: true,
        data: medicationOrders,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: now,
        },
      };
    }
  }

  async dispenseMedication(request: {
    tenantId: string;
    medicationOrderId: string;
    dispensedBy: string;
  }): Promise<EngineResponse<MedicationOrder>> {
    const now = new Date().toISOString();
    try {
      // 1. Fetch referenced Prescription aggregate
      const prescription = await this.pharmacyRepository.findPrescriptionByClinicalOrderId(
        request.tenantId,
        request.medicationOrderId
      );

      if (!prescription) {
        return {
          success: false,
          error: {
            code: 'PRESCRIPTION_NOT_FOUND',
            message: `Prescription not found for clinical order ${request.medicationOrderId}`,
            timestamp: now,
          },
        };
      }

      const firstDrug = prescription.drugs[0];
      if (!firstDrug) {
        return {
          success: false,
          error: {
            code: 'PRESCRIPTION_EMPTY',
            message: `Prescription drug list is empty for order ${request.medicationOrderId}`,
            timestamp: now,
          },
        };
      }

      // 2. CDS Barrier 2: Defense-in-depth re-check at dispense time
      // Query active/dispensed prescriptions of the patient for DDI checks
      const { data: patientRxs } = await this.supabase
        .from('hc_prescriptions')
        .select('drugs')
        .eq('tenant_id', request.tenantId)
        .eq('patient_party_id', prescription.patientPartyId)
        .eq('status', 'dispensed');

      const currentMedicationCodes: string[] = [];
      if (patientRxs) {
        for (const row of patientRxs) {
          const drugsRaw = row.drugs as unknown as { code: string }[];
          for (const d of drugsRaw) {
            if (d.code) currentMedicationCodes.push(d.code);
          }
        }
      }

      const cdsResult = await this.cdsEngine.generateCdsSummary({
        requestId: `dispense-cds-${request.medicationOrderId}`,
        tenantId: request.tenantId,
        encounterId: prescription.encounterId,
        patientId: prescription.patientPartyId,
        proposedDrugCode: firstDrug.code,
        currentMedicationCodes,
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
            encounterId: prescription.encounterId,
            patientId: prescription.patientPartyId,
            drugCode: firstDrug.code,
            cdsCheckId: cdsResult.data.calculationId,
            alertCount: cdsResult.data.alerts.length,
            barrier: 'PHARMACY_DISPENSE',
          },
          userId: request.dispensedBy,
        });

        return {
          success: false,
          error: {
            code: 'CDS_DISPENSE_BLOCKED',
            message: 'Dispense blocked by CDS Barrier 2: new clinical safety constraint detected since prescribing.',
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

      // 3. State transition progression to DISPENSED
      const originalVersion = prescription.version;
      if (prescription.status === 'PENDING_REVIEW') {
        prescription.approve(request.dispensedBy);
      }
      if (prescription.status === 'APPROVED') {
        prescription.markReady(request.dispensedBy);
      }
      prescription.dispense(request.dispensedBy, false);

      // 4. Save updated aggregate to DB
      await this.pharmacyRepository.savePrescription(prescription, originalVersion);

      // 5. Construct mapped MedicationOrder payload
      const parsedDose = parseFloat(firstDrug.dose) || 0;
      const parsedUnit = firstDrug.dose.replace(/[0-9. ]/g, '') || 'mg';

      const medicationOrder: MedicationOrder = {
        id: prescription.clinicalOrderId,
        tenantId: prescription.tenantId,
        encounterId: prescription.encounterId,
        patientId: prescription.patientPartyId,
        medicationId: firstDrug.code,
        status: 'active',
        dosage: { value: parsedDose, unit: parsedUnit },
        frequency: firstDrug.frequency,
        route: 'oral',
        startDate: prescription.provenance.createdAt.toISOString(),
        duration: firstDrug.durationDays,
        durationUnit: 'days',
        prescribedBy: prescription.doctorPartyId,
        prescribedDate: prescription.provenance.createdAt.toISOString(),
        dispensedBy: request.dispensedBy,
        dispensedDate: prescription.provenance.updatedAt.toISOString(),
        createdAt: prescription.provenance.createdAt.toISOString(),
        updatedAt: prescription.provenance.updatedAt.toISOString(),
      };

      console.info(`[PharmacyEngine] Dispensed medication order ${request.medicationOrderId}`);

      return {
        success: true,
        data: medicationOrder,
      };
    } catch (error) {
      console.error('[PharmacyEngine] Dispensing medication failed:', error);
      return {
        success: false,
        error: {
          code: 'DISPENSE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: now,
        },
      };
    }
  }

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      const { error } = await this.supabase
        .from('hc_prescriptions')
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
