import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  Prescription,
  MAREntry,
  PrescriptionStatus,
  PrescriptionDrugItem,
  MARStatus,
  type SafetyState,
  type DualVerificationState,
  type OverrideAuditEntry,
  type VerificationSignature,
} from '../domain/prescription.entity';
import {
  IPharmacyRepository,
  OptimisticLockError,
  UniqueConstraintViolationError,
} from './pharmacy-repository.interface';

type PrescriptionRow = Database['public']['Tables']['hc_prescriptions']['Row'];
type MARRow = Database['public']['Tables']['hc_medication_administration_records']['Row'];

export class SupabasePharmacyRepository implements IPharmacyRepository {
  private readonly PRESCRIPTIONS_TABLE = 'hc_prescriptions';
  private readonly MAR_TABLE = 'hc_medication_administration_records';

  constructor(private readonly supabase: SupabaseClient<Database>) {}

  // ==========================================================================
  // Prescription Persistence
  // ==========================================================================

  async savePrescription(prescription: Prescription, expectedVersion?: number): Promise<void> {
    const existing = await this.findPrescriptionById(prescription.tenantId, prescription.id);

    const notesPayload = {
      userNotes: prescription.notes || '',
      safetyState: prescription.safetyState,
      dualVerificationState: prescription.dualVerificationState,
      overrideHistory: prescription.overrideHistory,
      verifications: prescription.verifications,
      isHighAlert: prescription.isHighAlert,
    };

    const dbPayload = {
      id: prescription.id,
      tenant_id: prescription.tenantId,
      encounter_id: prescription.encounterId,
      patient_party_id: prescription.patientPartyId,
      doctor_party_id: prescription.doctorPartyId,
      clinical_order_id: prescription.clinicalOrderId,
      // Map to JSON-serializable array structure
      drugs: prescription.drugs as unknown as Record<string, unknown>[],
      diagnosis: prescription.diagnosis ?? null,
      notes: `METADATA:${JSON.stringify(notesPayload)}`,
      status: prescription.status.toLowerCase(),
      version: prescription.version,
      created_by: prescription.provenance.createdBy ?? null,
      updated_by: prescription.provenance.updatedBy ?? null,
      created_at: prescription.provenance.createdAt.toISOString(),
      updated_at: prescription.provenance.updatedAt.toISOString(),
    };

    if (!existing) {
      // Perform INSERT
      const { error } = await this.supabase
        .from(this.PRESCRIPTIONS_TABLE)
        .insert(dbPayload);

      if (error) {
        if (error.code === '23505') {
          throw new UniqueConstraintViolationError(
            `Prescription for clinical order ${prescription.clinicalOrderId} already exists: ${error.message}`
          );
        }
        throw new Error(`Failed to insert prescription: ${error.message}`);
      }
    } else {
      // Perform UPDATE with Optimistic Locking check on previous version
      const lockVersion = expectedVersion !== undefined ? expectedVersion : prescription.version - 1;

      const { data, error } = await this.supabase
        .from(this.PRESCRIPTIONS_TABLE)
        .update(dbPayload)
        .eq('tenant_id', prescription.tenantId)
        .eq('id', prescription.id)
        .eq('version', lockVersion)
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '23505') {
          throw new UniqueConstraintViolationError(
            `Unique key violation during update: ${error.message}`
          );
        }
        throw new Error(`Failed to update prescription: ${error.message}`);
      }

      if (!data) {
        // Fetch current row to verify why update failed
        const current = await this.findPrescriptionById(prescription.tenantId, prescription.id);
        if (current) {
          throw new OptimisticLockError(prescription.id, lockVersion, current.version);
        }
        throw new Error(`Prescription not found for update: ${prescription.id}`);
      }
    }
  }

  async findPrescriptionById(tenantId: string, id: string): Promise<Prescription | null> {
    const { data, error } = await this.supabase
      .from(this.PRESCRIPTIONS_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.mapRowToPrescription(data as PrescriptionRow);
  }

  async findPrescriptionByClinicalOrderId(tenantId: string, clinicalOrderId: string): Promise<Prescription | null> {
    const { data, error } = await this.supabase
      .from(this.PRESCRIPTIONS_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('clinical_order_id', clinicalOrderId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.mapRowToPrescription(data as PrescriptionRow);
  }

  // ==========================================================================
  // MAR Persistence
  // ==========================================================================

  async saveMAR(mar: MAREntry): Promise<void> {
    const dbPayload = {
      id: mar.id,
      tenant_id: mar.tenantId,
      inpatient_admission_id: mar.inpatientAdmissionId ?? null,
      encounter_id: mar.encounterId ?? null,
      prescription_item_id: mar.prescriptionItemId,
      drug_name: mar.drugName,
      dosage: mar.dosage,
      route: mar.route,
      scheduled_time: mar.scheduledTime.toISOString(),
      administered_time: mar.administeredTime ? mar.administeredTime.toISOString() : null,
      administered_by_nurse_id: mar.administeredByNurseId ?? null,
      status: mar.status,
      notes: mar.notes ?? null,
    };

    const { error } = await this.supabase
      .from(this.MAR_TABLE)
      .upsert(dbPayload);

    if (error) {
      throw new Error(`Failed to save MAR entry: ${error.message}`);
    }
  }

  async findMARById(tenantId: string, id: string): Promise<MAREntry | null> {
    const { data, error } = await this.supabase
      .from(this.MAR_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.mapRowToMAR(data as MARRow);
  }

  async findMARByPrescriptionId(tenantId: string, prescriptionId: string): Promise<MAREntry[]> {
    // In database, prescription_item_id is mapped to a uuid.
    // In this system we fetch MARs referencing this prescription.
    // We can query MAR records filtered by prescription_item_id or look up items.
    const { data, error } = await this.supabase
      .from(this.MAR_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('prescription_item_id', prescriptionId);

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.mapRowToMAR(row as MARRow));
  }

  // ==========================================================================
  // Reconstitution Mappers (Pure & Strongly Typed, No any)
  // ==========================================================================

  private mapRowToPrescription(row: PrescriptionRow): Prescription {
    const drugsRaw = row.drugs as unknown as {
      code: string;
      name: string;
      dose: string;
      frequency: string;
      durationDays: number;
    }[];

    const drugs: PrescriptionDrugItem[] = drugsRaw.map((d) => ({
      code: d.code,
      name: d.name,
      dose: d.dose,
      frequency: d.frequency,
      durationDays: d.durationDays,
    }));

    let safetyState: SafetyState = 'NO_BLOCK';
    let dualVerificationState: DualVerificationState = 'NONE';
    let overrideHistory: OverrideAuditEntry[] = [];
    let verifications: VerificationSignature[] = [];
    let isHighAlert = false;
    let actualNotes = row.notes || '';

    if (row.notes && row.notes.startsWith('METADATA:')) {
      try {
        const metadata = JSON.parse(row.notes.substring(9));
        actualNotes = metadata.userNotes || '';
        safetyState = metadata.safetyState || 'NO_BLOCK';
        dualVerificationState = metadata.dualVerificationState || 'NONE';
        overrideHistory = metadata.overrideHistory || [];
        verifications = metadata.verifications || [];
        isHighAlert = metadata.isHighAlert || false;
      } catch (e) {
        // Fallback
      }
    }

    return Prescription.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      encounterId: row.encounter_id,
      patientPartyId: row.patient_party_id,
      doctorPartyId: row.doctor_party_id,
      clinicalOrderId: row.clinical_order_id ?? '',
      drugs,
      diagnosis: row.diagnosis ?? undefined,
      notes: actualNotes || undefined,
      status: row.status.toUpperCase() as PrescriptionStatus,
      safetyState,
      dualVerificationState,
      overrideHistory,
      verifications,
      isHighAlert,
      version: row.version,
      provenance: {
        createdBy: row.created_by ?? undefined,
        createdAt: new Date(row.created_at),
        updatedBy: row.updated_by ?? undefined,
        updatedAt: new Date(row.updated_at),
      },
    });
  }

  private mapRowToMAR(row: MARRow): MAREntry {
    return MAREntry.reconstitute({
      id: row.id,
      tenantId: row.tenant_id,
      inpatientAdmissionId: row.inpatient_admission_id ?? undefined,
      encounterId: row.encounter_id ?? undefined,
      prescriptionItemId: row.prescription_item_id,
      drugName: row.drug_name,
      dosage: row.dosage,
      route: row.route,
      scheduledTime: new Date(row.scheduled_time),
      administeredTime: row.administered_time ? new Date(row.administered_time) : undefined,
      administeredByNurseId: row.administered_by_nurse_id ?? undefined,
      status: row.status as MARStatus,
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at ?? new Date()),
    });
  }

  async deductStock(tenantId: string, medicationCode: string, quantity: number): Promise<void> {
    const { data: item, error: fetchError } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('sku', medicationCode)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!item) {
      throw new Error(`Inventory item not found for medication code: ${medicationCode}`);
    }

    const newStock = item.stock_level - quantity;
    if (newStock < 0) {
      throw new Error(`Insufficient stock for medication code: ${medicationCode}. Required: ${quantity}, Available: ${item.stock_level}`);
    }

    // Atomic deduction checking gte stock_level (Gate 6)
    const { data, error } = await this.supabase
      .from('inventory_items')
      .update({
        stock_level: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId)
      .eq('id', item.id)
      .gte('stock_level', quantity)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error(`Concurrency violation or insufficient stock during deduction of ${medicationCode}`);
    }
  }

  async setStock(tenantId: string, medicationCode: string, quantity: number): Promise<void> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('inventory_items')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('sku', medicationCode)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existing) {
      const { error } = await this.supabase
        .from('inventory_items')
        .update({ stock_level: quantity, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await this.supabase
        .from('inventory_items')
        .insert({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          sku: medicationCode,
          name: `Medication ${medicationCode}`,
          stock_level: quantity,
          unit: 'vial',
          min_stock_level: 0,
          price_per_unit: 100,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    }
  }

  async getStock(tenantId: string, medicationCode: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('stock_level')
      .eq('tenant_id', tenantId)
      .eq('sku', medicationCode)
      .maybeSingle();

    if (error) throw error;
    return data ? data.stock_level : 0;
  }
}
