/**
 * Supabase MAR Reader Implementation for Nursing Engine
 *
 * Queries `hc_medication_administration_records` table owned by Pharmacy Kernel.
 *
 * @module platform/healthcare/engines/nursing-engine/repositories
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IMARReader, MARItemSummary } from '../contracts/mar-reader.interface';

export class SupabaseMARReader implements IMARReader {
  constructor(private readonly supabase: SupabaseClient) {}

  async getMARRecordsByAdmission(tenantId: string, admissionId: string): Promise<MARItemSummary[]> {
    const { data, error } = await this.supabase
      .from('hc_medication_administration_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('inpatient_admission_id', admissionId)
      .order('scheduled_time', { ascending: true });

    if (error || !data) return [];
    return data.map((row) => this.mapToSummary(row));
  }

  async getMARRecordsByEncounter(tenantId: string, encounterId: string): Promise<MARItemSummary[]> {
    const { data, error } = await this.supabase
      .from('hc_medication_administration_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('encounter_id', encounterId)
      .order('scheduled_time', { ascending: true });

    if (error || !data) return [];
    return data.map((row) => this.mapToSummary(row));
  }

  private mapToSummary(row: Record<string, unknown>): MARItemSummary {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      encounterId: String(row.encounter_id || ''),
      admissionId: row.inpatient_admission_id ? String(row.inpatient_admission_id) : undefined,
      prescriptionItemId: String(row.prescription_item_id || ''),
      drugName: String(row.drug_name || ''),
      dosage: String(row.dosage || ''),
      route: String(row.route || ''),
      scheduledTime: String(row.scheduled_time || ''),
      administeredTime: row.administered_time ? String(row.administered_time) : undefined,
      administeredByNurseId: row.administered_by_nurse_id ? String(row.administered_by_nurse_id) : undefined,
      status: (row.status as MARItemSummary['status']) || 'scheduled',
      notes: row.notes ? String(row.notes) : undefined,
    };
  }
}
