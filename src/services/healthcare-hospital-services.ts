import { getSupabase } from '@/lib/supabase-client';
import { getHealthcareService } from '@/platform/healthcare/service-locator';
import { AuditComplianceService } from '@/platform/healthcare/engines/audit-compliance-engine/audit-compliance.service';
import { HospitalAdmissionProductService } from '../products/bella-hospital/services/hospital-admission.service';
import type {
  Ward,
  Bed,
  BedStatus,
  InpatientAdmission,
  NursingVitalSigns,
  MedicationAdministrationRecord,
  SecurityBreakGlassLog,
  ICD10Diagnosis,
} from '@/types/healthcare';
import type { AdmissionEngineContract } from '@/platform/healthcare/engines/admission-engine/contracts/admission-engine.contract';

// Input Interfaces with Strict Typing (NO 'any')
export interface CreateAdmissionInput {
  tenantId: string;
  encounterId: string;
  patientId: string;
  bedId: string;
  wardId: string;
  admittingDoctorId: string;
  attendingDoctorId: string;
  admissionDiagnosis: ICD10Diagnosis[];
}

export interface RecordVitalsInput {
  tenantId: string;
  inpatientAdmissionId: string;
  encounterId: string;
  patientId: string;
  nursePractitionerId: string;
  temperature: number;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  spo2: number;
  respiratoryRate?: number;
  notes?: string;
}

export interface ActivateBreakGlassInput {
  tenantId: string;
  userId: string;
  userEmail: string;
  userName: string;
  patientId: string;
  encounterId?: string;
  reason: string;
  ipAddress?: string;
}

/**
 * Bed Engine Service — Hospital Facility & Bed Allocation Engine
 * Reads directly from hc_wards / hc_beds via Supabase (RLS enforced).
 * DB error → throw. Empty result → return [].
 */
export class BedEngineService {
  static async getHospitalWards(tenantId: string): Promise<Ward[]> {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('hc_wards')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`Failed to fetch wards: ${error.message}`);
    return (data ?? []) as Ward[];
  }

  static async getHospitalBeds(tenantId: string, wardId?: string): Promise<Bed[]> {
    const sb = getSupabase();
    let query = sb.from('hc_beds').select('*').eq('tenant_id', tenantId);
    if (wardId) {
      query = query.eq('ward_id', wardId);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch beds: ${error.message}`);
    return (data ?? []) as Bed[];
  }

  static async updateBedStatus(bedId: string, status: BedStatus): Promise<Bed> {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('hc_beds')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bedId)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to update bed ${bedId}: ${error?.message ?? 'no data'}`);
    return data as Bed;
  }
}

/**
 * Inpatient Admission Service — Admission & Discharge
 * Delegates to HospitalAdmissionProductService via Healthcare Kernel contract.
 * DB error → throw. No mock fallback.
 */
export class InpatientAdmissionService {
  private static productService: HospitalAdmissionProductService | null = null;

  private static getProductService(): HospitalAdmissionProductService {
    if (!this.productService) {
      const sb = getSupabase();
      const admissionContract = getHealthcareService<AdmissionEngineContract>(
        'admission-engine',
        sb
      );
      const auditContract = new AuditComplianceService(sb);
      this.productService = new HospitalAdmissionProductService(
        admissionContract,
        auditContract
      );
    }
    return this.productService;
  }

  static async getInpatientAdmissions(tenantId: string): Promise<InpatientAdmission[]> {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('hc_inpatient_admissions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('admitted_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch admissions: ${error.message}`);
    return (data ?? []) as unknown as InpatientAdmission[];
  }

  static async createInpatientAdmission(input: CreateAdmissionInput): Promise<InpatientAdmission> {
    const result = await this.getProductService().admitInpatient({
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      patientPartyId: input.patientId,
      wardId: input.wardId,
      bedId: input.bedId,
      admittingDoctorId: input.admittingDoctorId,
      attendingDoctorId: input.attendingDoctorId,
      admissionDiagnosis: input.admissionDiagnosis.map((d) => ({
        icd10Code: d.icd10_code,
        icd10NameVi: d.icd10_name_vi,
        isPrimary: d.is_primary,
      })),
    });

    // Fetch the persisted record to return canonical InpatientAdmission shape
    const sb = getSupabase();
    const { data, error } = await sb
      .from('hc_inpatient_admissions')
      .select('*')
      .eq('id', result.id)
      .single();

    if (error || !data) throw new Error(`Admission created but fetch failed: ${error?.message ?? 'no data'}`);
    return data as unknown as InpatientAdmission;
  }

  static async dischargePatient(admissionId: string, dischargeSummary: string): Promise<InpatientAdmission> {
    const sb = getSupabase();

    // Fetch existing admission for context
    const { data: existing, error: fetchErr } = await sb
      .from('hc_inpatient_admissions')
      .select('*')
      .eq('id', admissionId)
      .single();

    if (fetchErr || !existing) {
      throw new Error(`Admission record not found: ${fetchErr?.message ?? admissionId}`);
    }

    await this.getProductService().dischargeInpatient({
      admissionId,
      tenantId: existing.tenant_id,
      encounterId: existing.encounter_id,
      patientId: existing.patient_id,
      dischargingPhysicianId: existing.attending_doctor_id,
      dischargeDisposition: 'HOME',
      dischargeSummary,
      timestamp: new Date().toISOString(),
    });

    // Fetch updated record
    const { data, error } = await sb
      .from('hc_inpatient_admissions')
      .select('*')
      .eq('id', admissionId)
      .single();

    if (error || !data) throw new Error(`Discharge succeeded but fetch failed: ${error?.message ?? 'no data'}`);
    return data as unknown as InpatientAdmission;
  }
}

/**
 * Break-Glass Emergency Security Access Service
 * DB error → throw.
 */
export class BreakGlassSecurityService {
  static async activateBreakGlassAccess(input: ActivateBreakGlassInput): Promise<SecurityBreakGlassLog> {
    const sb = getSupabase();
    const log = {
      tenant_id: input.tenantId,
      user_id: input.userId,
      user_email: input.userEmail,
      user_name: input.userName,
      patient_id: input.patientId,
      encounter_id: input.encounterId ?? null,
      reason: input.reason,
      ip_address: input.ipAddress ?? null,
      activated_at: new Date().toISOString(),
    };

    const { data, error } = await sb
      .from('hc_security_break_glass_logs')
      .insert(log)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to activate break glass: ${error?.message ?? 'no data'}`);
    return data as SecurityBreakGlassLog;
  }

  static async getBreakGlassLogs(tenantId: string): Promise<SecurityBreakGlassLog[]> {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('hc_security_break_glass_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('activated_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch break glass logs: ${error.message}`);
    return (data ?? []) as SecurityBreakGlassLog[];
  }
}

/**
 * Nursing Vital Signs Service
 * DB error → throw.
 */
export class NursingVitalsService {
  static async getVitalSignsByAdmission(admissionId: string): Promise<NursingVitalSigns[]> {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('hc_nursing_vital_signs')
      .select('*')
      .eq('inpatient_admission_id', admissionId)
      .order('recorded_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch vital signs: ${error.message}`);
    return (data ?? []) as NursingVitalSigns[];
  }

  static async recordVitalSigns(input: RecordVitalsInput): Promise<NursingVitalSigns> {
    const sb = getSupabase();
    const record = {
      tenant_id: input.tenantId,
      inpatient_admission_id: input.inpatientAdmissionId,
      encounter_id: input.encounterId,
      patient_id: input.patientId,
      nurse_practitioner_id: input.nursePractitionerId,
      temperature: input.temperature,
      heart_rate: input.heartRate,
      systolic_bp: input.systolicBp,
      diastolic_bp: input.diastolicBp,
      spo2: input.spo2,
      respiratory_rate: input.respiratoryRate ?? null,
      notes: input.notes ?? null,
      recorded_at: new Date().toISOString(),
    };

    const { data, error } = await sb
      .from('hc_nursing_vital_signs')
      .insert(record)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to record vital signs: ${error?.message ?? 'no data'}`);
    return data as NursingVitalSigns;
  }
}

/**
 * MAR (Medication Administration Record) Service
 * DB error → throw.
 */
export interface CreateMARInput {
  tenantId: string;
  inpatientAdmissionId: string;
  prescriptionItemId: string;
  drugName: string;
  dosage: string;
  route: string;
  scheduledTime: string;
}

export interface AdministerMARInput {
  marId: string;
  administeredByNurseId: string;
  notes?: string;
}

export class MARService {
  static async getMARByAdmission(admissionId: string): Promise<MedicationAdministrationRecord[]> {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('hc_medication_administration_records')
      .select('*')
      .eq('inpatient_admission_id', admissionId)
      .order('scheduled_time', { ascending: true });

    if (error) throw new Error(`Failed to fetch MAR: ${error.message}`);
    return (data ?? []) as MedicationAdministrationRecord[];
  }

  static async createMAR(input: CreateMARInput): Promise<MedicationAdministrationRecord> {
    const sb = getSupabase();
    const record = {
      tenant_id: input.tenantId,
      inpatient_admission_id: input.inpatientAdmissionId,
      prescription_item_id: input.prescriptionItemId,
      drug_name: input.drugName,
      dosage: input.dosage,
      route: input.route,
      scheduled_time: input.scheduledTime,
      status: 'scheduled',
    };

    const { data, error } = await sb
      .from('hc_medication_administration_records')
      .insert(record)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to create MAR: ${error?.message ?? 'no data'}`);
    return data as MedicationAdministrationRecord;
  }

  static async administerMAR(input: AdministerMARInput): Promise<MedicationAdministrationRecord> {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('hc_medication_administration_records')
      .update({
        status: 'administered',
        administered_time: new Date().toISOString(),
        administered_by_nurse_id: input.administeredByNurseId,
        notes: input.notes ?? null,
      })
      .eq('id', input.marId)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to administer MAR ${input.marId}: ${error?.message ?? 'no data'}`);
    return data as MedicationAdministrationRecord;
  }
}
