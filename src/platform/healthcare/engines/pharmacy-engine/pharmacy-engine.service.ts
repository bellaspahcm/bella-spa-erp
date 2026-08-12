/**
 * Pharmacy Engine Service
 * 
 * Healthcare Platform engine for pharmacy, prescription validation, and MAR operations.
 * 
 * Constitution Compliance:
 * - Law 1: All records reference Encounter
 * - Law 5: Domain events published downstream after DB persistence
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
import type { Database } from '@/types/database.types';
import { eventBus } from '@/platform/host/event-bus';
import { SupabasePharmacyRepository } from './repositories/supabase-pharmacy.repository';
import { Prescription, MAREntry, type PrescriptionStatus } from './domain/prescription.entity';
import {
  AllergyPolicy,
  InteractionPolicy,
  DosePolicy,
  DuplicateTherapyPolicy,
  ScreeningResult,
  type ScreeningFinding,
  type MedicationSafetyDefinition,
} from './domain/screening-policies';

export const SAFETY_DEFINITIONS: Record<string, MedicationSafetyDefinition> = {
  'PARACETAMOL': {
    medicationCode: 'PARACETAMOL',
    doseLimit: 4000,
    doseUnit: 'mg',
    interactionRules: [
      { conflictDrugCode: 'WARFARIN', severity: 'WARNING', message: 'Paracetamol may increase anticoagulation effect of Warfarin.' },
    ],
    allergyRules: [
      { allergyCode: 'ALLERGEN-PARA', severity: 'BLOCKED', message: 'Patient has life-threatening allergy to Paracetamol.' },
    ],
  },
  'WARFARIN': {
    medicationCode: 'WARFARIN',
    doseLimit: 10,
    doseUnit: 'mg',
    interactionRules: [
      { conflictDrugCode: 'NSAID-IBU', severity: 'BLOCKED', message: 'Absolute contraindication: Warfarin combined with Ibuprofen increases severe bleeding risk.' },
    ],
  },
  'NSAID-IBU': {
    medicationCode: 'NSAID-IBU',
    doseLimit: 2400,
    doseUnit: 'mg',
  },
};

export class PharmacyEngineService implements PharmacyEngineContract {
  readonly engineName = 'pharmacy-engine';
  readonly engineVersion = '1.1.0';
  readonly contractVersion = '1.0.0';

  private readonly pharmacyRepository: SupabasePharmacyRepository;
  private readonly allergyPolicy = new AllergyPolicy();
  private readonly interactionPolicy = new InteractionPolicy();
  private readonly dosePolicy = new DosePolicy();
  private readonly duplicateTherapyPolicy = new DuplicateTherapyPolicy();

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.pharmacyRepository = new SupabasePharmacyRepository(supabase);
  }

  /**
   * Verify Prescription Command (Gate 1, 2, 3, 5)
   */
  async verifyPrescription(request: {
    tenantId: string;
    medicationOrderId: string; // parent clinical order id
    pharmacistId: string;
    overrides?: { warningCode: string; rationale: string; policyVersion?: string }[];
  }): Promise<EngineResponse<{ id: string; status: string; safetyState: string }>> {
    const now = new Date().toISOString();
    try {
      const prescription = await this.pharmacyRepository.findPrescriptionByClinicalOrderId(
        request.tenantId,
        request.medicationOrderId
      );

      if (!prescription) {
        return {
          success: false,
          error: {
            code: 'PRESCRIPTION_NOT_FOUND',
            message: `Prescription not found for order ${request.medicationOrderId}`,
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
            message: 'Prescription contains no drug items.',
            timestamp: now,
          },
        };
      }

      // 1. Query safety inputs from DB (Allergies & Active Meds)
      const { data: allergies } = await this.supabase
        .from('hc_patient_allergies')
        .select('allergen_code')
        .eq('tenant_id', request.tenantId)
        .eq('patient_id', prescription.patientPartyId)
        .eq('is_active', true);
      const patientAllergies = (allergies || []).map((a) => a.allergen_code);

      const { data: activeRxs } = await this.supabase
        .from('hc_prescriptions')
        .select('drugs')
        .eq('tenant_id', request.tenantId)
        .eq('patient_party_id', prescription.patientPartyId)
        .in('status', ['verified', 'dispensed', 'mar_ready']);
      const activeMedicationCodes: string[] = [];
      if (activeRxs) {
        for (const rx of activeRxs) {
          const drugsRaw = rx.drugs as unknown as { code: string }[];
          for (const d of drugsRaw) {
            if (d.code) activeMedicationCodes.push(d.code);
          }
        }
      }

      // Parse dosage value & unit
      const dosageValue = parseFloat(firstDrug.dose) || 0;
      const dosageUnit = firstDrug.dose.replace(/[0-9. ]/g, '') || 'mg';

      // 2. Execute clinical screening policies (Rule 3)
      const findings: ScreeningFinding[] = [];
      const context = {
        medicationCode: firstDrug.code,
        dosageValue,
        dosageUnit,
        patientAllergies,
        activeMedicationCodes,
        safetyDefinitions: SAFETY_DEFINITIONS,
      };

      findings.push(...this.allergyPolicy.screen(context));
      findings.push(...this.interactionPolicy.screen(context));
      findings.push(...this.dosePolicy.screen(context));
      findings.push(...this.duplicateTherapyPolicy.screen(context));

      const screeningResult = ScreeningResult.create(findings);

      // 3. Transition aggregate state
      const originalVersion = prescription.version;
      prescription.verify(request.pharmacistId, screeningResult, request.overrides);

      // 4. Save aggregate (Gate 4 Event-after-persistence rule)
      await this.pharmacyRepository.savePrescription(prescription, originalVersion);

      // 5. Emit domain event on success
      await eventBus.publish({
        eventType: 'PrescriptionVerified',
        tenantId: request.tenantId,
        aggregateId: prescription.id,
        aggregateType: 'Prescription',
        payload: {
          prescriptionId: prescription.id,
          clinicalOrderId: prescription.clinicalOrderId,
          status: prescription.status,
          safetyState: prescription.safetyState,
          dualVerificationState: prescription.dualVerificationState,
          verifications: prescription.verifications,
        },
        userId: request.pharmacistId,
      });

      return {
        success: true,
        data: {
          id: prescription.id,
          status: prescription.status,
          safetyState: prescription.safetyState,
        },
      };
    } catch (error) {
      console.error('[PharmacyEngine] Verification failed:', error);
      return {
        success: false,
        error: {
          code: 'VERIFICATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: now,
        },
      };
    }
  }

  /**
   * Dispense Medication Command (Gate 6)
   */
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
            message: `Prescription not found for order ${request.medicationOrderId}`,
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
            message: 'Prescription drug list is empty.',
            timestamp: now,
          },
        };
      }

      // 2. Perform Stock Deduction under concurrency check (Rule 1 & Rule 7 / Gate 6)
      await this.pharmacyRepository.deductStock(request.tenantId, firstDrug.code, 1);

      // 3. Transition status to DISPENSED
      const originalVersion = prescription.version;
      prescription.dispense(request.dispensedBy);

      // 4. Save updated aggregate to DB (Event-after-persistence)
      await this.pharmacyRepository.savePrescription(prescription, originalVersion);

      // 5. Publish MedicationDispensed event
      await eventBus.publish({
        eventType: 'MedicationDispensed',
        tenantId: request.tenantId,
        aggregateId: prescription.id,
        aggregateType: 'Prescription',
        payload: {
          prescriptionId: prescription.id,
          medicationCode: firstDrug.code,
          quantity: 1,
        },
        userId: request.dispensedBy,
      });

      // Map DTO
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

  /**
   * Record Medication Administration (Gate 7 Clinical Continuity Outcome)
   */
  async recordMedicationAdministration(request: MARAdministrationRequest): Promise<EngineResponse<{ id: string }>> {
    const now = new Date().toISOString();
    try {
      const prescription = await this.pharmacyRepository.findPrescriptionByClinicalOrderId(
        request.tenantId,
        request.medicationOrderId
      );

      if (!prescription) {
        return {
          success: false,
          error: {
            code: 'PRESCRIPTION_NOT_FOUND',
            message: `Prescription not found for order ${request.medicationOrderId}`,
            timestamp: now,
          },
        };
      }

      // Update prescription state to MAR_READY when first dose is recorded
      if (prescription.status === 'DISPENSED') {
        const originalVersion = prescription.version;
        prescription.markMarReady(request.administeredBy);
        await this.pharmacyRepository.savePrescription(prescription, originalVersion);
      }

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

      mar.administer(request.administeredBy, new Date(request.administeredAt), request.notes);

      await this.pharmacyRepository.saveMAR(mar);

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
        let actualNotes = row.notes || '';
        if (row.notes && row.notes.startsWith('METADATA:')) {
          try {
            const metadata = JSON.parse(row.notes.substring(9));
            actualNotes = metadata.userNotes || '';
          } catch (e) {}
        }

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
          status: row.status === 'dispensed' || row.status === 'mar_ready' ? 'active' : 'on-hold',
          dosage: { value: parsedDose, unit: parsedUnit },
          frequency: firstDrug.frequency,
          route: 'oral',
          startDate: row.created_at,
          duration: firstDrug.durationDays,
          durationUnit: 'days',
          prescribedBy: row.doctor_party_id,
          prescribedDate: row.created_at,
          dispensedBy: row.updated_by ?? undefined,
          dispensedDate: row.status === 'dispensed' || row.status === 'mar_ready' ? row.updated_at : undefined,
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
