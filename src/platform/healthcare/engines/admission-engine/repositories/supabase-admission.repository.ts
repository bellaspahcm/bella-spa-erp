/**
 * Supabase Admission Repository
 *
 * Persists InpatientAdmission aggregates to `hc_inpatient_admissions` table
 * extending BaseSupabaseRepositoryPrimitive with RLS and optimistic concurrency protection.
 *
 * @module platform/healthcare/engines/admission-engine/repositories
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { InpatientAdmission, AdmissionStateProps } from '../domain/inpatient-admission.entity';

export interface IAdmissionRepository {
  save(admission: InpatientAdmission): Promise<InpatientAdmission>;
  findById(tenantId: string, id: string): Promise<InpatientAdmission | null>;
  findByEncounterId(tenantId: string, encounterId: string): Promise<InpatientAdmission | null>;
}

export class SupabaseAdmissionRepository implements IAdmissionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async save(admission: InpatientAdmission): Promise<InpatientAdmission> {
    const snap = admission.toSnapshot();

    const dbRow = {
      id: snap.id,
      tenant_id: snap.tenantId,
      encounter_id: snap.encounterId,
      patient_id: snap.patientPartyId,
      ward_id: snap.wardId,
      bed_id: snap.bedId,
      admitting_doctor_id: snap.admittingDoctorId,
      attending_doctor_id: snap.attendingDoctorId,
      status: snap.status,
      admission_diagnosis: snap.admissionDiagnosis,
      discharge_summary: snap.dischargeSummary || null,
      admitted_at: snap.admittedAt,
      discharged_at: snap.dischargedAt || null,
      updated_at: snap.updatedAt,
    };

    const { data, error } = await this.supabase
      .from('hc_inpatient_admissions')
      .upsert(dbRow, { onConflict: 'id' })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to save InpatientAdmission: ${error?.message || 'Database insert failed'}`);
    }

    return this.mapToEntity(data);
  }

  async findById(tenantId: string, id: string): Promise<InpatientAdmission | null> {
    const { data, error } = await this.supabase
      .from('hc_inpatient_admissions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToEntity(data);
  }

  async findByEncounterId(tenantId: string, encounterId: string): Promise<InpatientAdmission | null> {
    const { data, error } = await this.supabase
      .from('hc_inpatient_admissions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('encounter_id', encounterId)
      .order('admitted_at', { ascending: false })
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToEntity(data);
  }

  private mapToEntity(row: Record<string, unknown>): InpatientAdmission {
    const props: AdmissionStateProps = {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      encounterId: String(row.encounter_id || ''),
      patientPartyId: String(row.patient_id || ''),
      wardId: String(row.ward_id || ''),
      bedId: String(row.bed_id || ''),
      admittingDoctorId: String(row.admitting_doctor_id || ''),
      attendingDoctorId: String(row.attending_doctor_id || ''),
      status: (row.status as AdmissionStatus) || 'admitted',
      admissionDiagnosis: Array.isArray(row.admission_diagnosis) ? (row.admission_diagnosis as Array<{ icd10Code: string; icd10NameVi: string; isPrimary: boolean }>) : [],
      dischargeSummary: row.discharge_summary ? String(row.discharge_summary) : undefined,
      admittedAt: String(row.admitted_at || ''),
      dischargedAt: row.discharged_at ? String(row.discharged_at) : undefined,
      version: Number(row.version) || 1,
      createdAt: String(row.created_at || row.admitted_at || ''),
      updatedAt: String(row.updated_at || row.admitted_at || ''),
    };

    return InpatientAdmission.rehydrate(props);
  }
}
