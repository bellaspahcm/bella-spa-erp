import { supabase } from '@/lib/supabase';
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

// Mock In-Memory Data Store for Dev Mode Fallback when DB tables are pending
const MOCK_WARDS: Ward[] = [
  {
    id: 'ward-001',
    tenant_id: 'bella_healthcare',
    building_id: 'bldg-01',
    code: 'ICU',
    name: 'Khoa Hồi Sức Tích Cực (ICU)',
    department_head_practitioner_id: 'doc-001',
  },
  {
    id: 'ward-002',
    tenant_id: 'bella_healthcare',
    building_id: 'bldg-01',
    code: 'INTERNAL',
    name: 'Khoa Nội Tổng Hợp',
    department_head_practitioner_id: 'doc-002',
  },
  {
    id: 'ward-003',
    tenant_id: 'bella_healthcare',
    building_id: 'bldg-01',
    code: 'SURGERY',
    name: 'Khoa Ngoại Phẫu Thuật',
    department_head_practitioner_id: 'doc-003',
  },
];

const MOCK_BEDS: Bed[] = [
  {
    id: 'bed-101',
    tenant_id: 'bella_healthcare',
    room_id: 'room-101',
    ward_id: 'ward-001',
    bed_code: 'ICU-BED-01',
    bed_type: 'icu',
    status: 'occupied',
    daily_rate: 1500000,
    current_admission_id: 'adm-001',
    current_patient_id: 'pat-001',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'bed-102',
    tenant_id: 'bella_healthcare',
    room_id: 'room-101',
    ward_id: 'ward-001',
    bed_code: 'ICU-BED-02',
    bed_type: 'icu',
    status: 'available',
    daily_rate: 1500000,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'bed-201',
    tenant_id: 'bella_healthcare',
    room_id: 'room-201',
    ward_id: 'ward-002',
    bed_code: 'INT-BED-01',
    bed_type: 'standard',
    status: 'occupied',
    daily_rate: 500000,
    current_admission_id: 'adm-002',
    current_patient_id: 'pat-002',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'bed-202',
    tenant_id: 'bella_healthcare',
    room_id: 'room-201',
    ward_id: 'ward-002',
    bed_code: 'INT-BED-02',
    bed_type: 'standard',
    status: 'cleaning',
    daily_rate: 500000,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'bed-203',
    tenant_id: 'bella_healthcare',
    room_id: 'room-202',
    ward_id: 'ward-002',
    bed_code: 'INT-BED-03',
    bed_type: 'vip',
    status: 'available',
    daily_rate: 1200000,
    updated_at: new Date().toISOString(),
  },
];

const MOCK_ADMISSIONS: InpatientAdmission[] = [
  {
    id: 'adm-001',
    tenant_id: 'bella_healthcare',
    encounter_id: 'enc-001',
    patient_id: 'pat-001',
    bed_id: 'bed-101',
    ward_id: 'ward-001',
    admitting_doctor_id: 'doc-001',
    attending_doctor_id: 'doc-001',
    admission_diagnosis: [
      { icd10_code: 'I50.9', icd10_name_vi: 'Suy tim, không đặc hiệu', is_primary: true },
    ],
    status: 'admitted',
    admitted_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'adm-002',
    tenant_id: 'bella_healthcare',
    encounter_id: 'enc-002',
    patient_id: 'pat-002',
    bed_id: 'bed-201',
    ward_id: 'ward-002',
    admitting_doctor_id: 'doc-002',
    attending_doctor_id: 'doc-002',
    admission_diagnosis: [
      { icd10_code: 'J18.9', icd10_name_vi: 'Viêm phổi, không đặc hiệu', is_primary: true },
    ],
    status: 'admitted',
    admitted_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const MOCK_BREAK_GLASS_LOGS: SecurityBreakGlassLog[] = [];

/**
 * Bed Engine Service — Hospital Facility & Bed Allocation Engine
 */
export class BedEngineService {
  static async getHospitalWards(tenantId: string): Promise<Ward[]> {
    try {
      const { data, error } = await supabase
        .from('hc_wards')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error || !data || data.length === 0) {
        return MOCK_WARDS.filter((w) => w.tenant_id === tenantId || tenantId === 'bella_healthcare');
      }
      return data as Ward[];
    } catch {
      return MOCK_WARDS;
    }
  }

  static async getHospitalBeds(tenantId: string, wardId?: string): Promise<Bed[]> {
    try {
      let query = supabase.from('hc_beds').select('*').eq('tenant_id', tenantId);
      if (wardId) {
        query = query.eq('ward_id', wardId);
      }
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        if (wardId) {
          return MOCK_BEDS.filter((b) => b.ward_id === wardId);
        }
        return MOCK_BEDS;
      }
      return data as Bed[];
    } catch {
      return MOCK_BEDS;
    }
  }

  static async updateBedStatus(bedId: string, status: BedStatus): Promise<Bed> {
    try {
      const { data, error } = await supabase
        .from('hc_beds')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', bedId)
        .select()
        .single();

      if (error || !data) {
        const bed = MOCK_BEDS.find((b) => b.id === bedId);
        if (bed) {
          bed.status = status;
          bed.updated_at = new Date().toISOString();
          return bed;
        }
        throw new Error('Bed not found');
      }
      return data as Bed;
    } catch {
      const bed = MOCK_BEDS.find((b) => b.id === bedId);
      if (bed) {
        bed.status = status;
        return bed;
      }
      throw new Error('Bed update failed');
    }
  }
}

/**
 * Inpatient Admission Service — Admission, Discharge & MAR Engine
 */
export class InpatientAdmissionService {
  static async getInpatientAdmissions(tenantId: string): Promise<InpatientAdmission[]> {
    try {
      const { data, error } = await supabase
        .from('hc_inpatient_admissions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('admitted_at', { ascending: false });

      if (error || !data || data.length === 0) {
        return MOCK_ADMISSIONS;
      }
      return data as InpatientAdmission[];
    } catch {
      return MOCK_ADMISSIONS;
    }
  }

  static async createInpatientAdmission(input: CreateAdmissionInput): Promise<InpatientAdmission> {
    const newAdmission: InpatientAdmission = {
      id: `adm-${Date.now()}`,
      tenant_id: input.tenantId,
      encounter_id: input.encounterId,
      patient_id: input.patientId,
      bed_id: input.bedId,
      ward_id: input.wardId,
      admitting_doctor_id: input.admittingDoctorId,
      attending_doctor_id: input.attendingDoctorId,
      admission_diagnosis: input.admissionDiagnosis,
      status: 'admitted',
      admitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('hc_inpatient_admissions')
        .insert(newAdmission)
        .select()
        .single();

      if (!error && data) {
        await BedEngineService.updateBedStatus(input.bedId, 'occupied');
        return data as InpatientAdmission;
      }
    } catch {
      // Fallback in dev mode
    }

    MOCK_ADMISSIONS.unshift(newAdmission);
    await BedEngineService.updateBedStatus(input.bedId, 'occupied');
    return newAdmission;
  }

  static async dischargePatient(admissionId: string, dischargeSummary: string): Promise<InpatientAdmission> {
    const admission = MOCK_ADMISSIONS.find((a) => a.id === admissionId);
    if (!admission) throw new Error('Admission record not found');

    admission.status = 'discharged';
    admission.discharged_at = new Date().toISOString();
    admission.discharge_summary = dischargeSummary;
    admission.updated_at = new Date().toISOString();

    await BedEngineService.updateBedStatus(admission.bed_id, 'cleaning');

    try {
      await supabase
        .from('hc_inpatient_admissions')
        .update({
          status: 'discharged',
          discharged_at: admission.discharged_at,
          discharge_summary: dischargeSummary,
          updated_at: admission.updated_at,
        })
        .eq('id', admissionId);
    } catch {
      // Swallowed for dev fallback
    }

    return admission;
  }
}

/**
 * Break-Glass Emergency Security Access Service
 */
export class BreakGlassSecurityService {
  static async activateBreakGlassAccess(input: ActivateBreakGlassInput): Promise<SecurityBreakGlassLog> {
    const log: SecurityBreakGlassLog = {
      id: `bg-${Date.now()}`,
      tenant_id: input.tenantId,
      user_id: input.userId,
      user_email: input.userEmail,
      user_name: input.userName,
      patient_id: input.patientId,
      encounter_id: input.encounterId,
      reason: input.reason,
      ip_address: input.ipAddress || '127.0.0.1',
      activated_at: new Date().toISOString(),
    };

    MOCK_BREAK_GLASS_LOGS.unshift(log);

    try {
      await supabase
        .from('hc_security_break_glass_logs')
        .insert(log);
    } catch {
      // Dev mode fallback
    }

    return log;
  }

  static async getBreakGlassLogs(tenantId: string): Promise<SecurityBreakGlassLog[]> {
    try {
      const { data, error } = await supabase
        .from('hc_security_break_glass_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('activated_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as SecurityBreakGlassLog[];
      }
    } catch {
      // Fallback
    }
    return MOCK_BREAK_GLASS_LOGS;
  }
}

/**
 * Nursing Vital Signs Service
 */
const MOCK_VITAL_SIGNS: NursingVitalSigns[] = [
  {
    id: 'vital-001',
    tenant_id: 'bella_healthcare',
    inpatient_admission_id: 'adm-001',
    encounter_id: 'enc-001',
    patient_id: 'pat-001',
    nurse_practitioner_id: 'nurse-001',
    temperature: 37.2,
    heart_rate: 78,
    systolic_bp: 120,
    diastolic_bp: 80,
    spo2: 98,
    respiratory_rate: 16,
    notes: 'Bệnh nhân ổn định',
    recorded_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export class NursingVitalsService {
  static async getVitalSignsByAdmission(admissionId: string): Promise<NursingVitalSigns[]> {
    try {
      const { data, error } = await supabase
        .from('hc_nursing_vital_signs')
        .select('*')
        .eq('inpatient_admission_id', admissionId)
        .order('recorded_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as NursingVitalSigns[];
      }
    } catch {
      // Fallback
    }
    return MOCK_VITAL_SIGNS.filter((v) => v.inpatient_admission_id === admissionId);
  }

  static async recordVitalSigns(input: RecordVitalsInput): Promise<NursingVitalSigns> {
    const newVital: NursingVitalSigns = {
      id: `vital-${Date.now()}`,
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
      respiratory_rate: input.respiratoryRate,
      notes: input.notes,
      recorded_at: new Date().toISOString(),
    };

    MOCK_VITAL_SIGNS.unshift(newVital);

    try {
      const { data, error } = await supabase
        .from('hc_nursing_vital_signs')
        .insert(newVital)
        .select()
        .single();

      if (!error && data) {
        return data as NursingVitalSigns;
      }
    } catch {
      // Dev fallback
    }

    return newVital;
  }
}

/**
 * MAR (Medication Administration Record) Service
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

const MOCK_MAR_RECORDS: MedicationAdministrationRecord[] = [
  {
    id: 'mar-001',
    tenant_id: 'bella_healthcare',
    inpatient_admission_id: 'adm-001',
    prescription_item_id: 'rx-item-001',
    drug_name: 'Amoxicillin 500mg',
    dosage: '1 viên',
    route: 'Uống sau ăn',
    scheduled_time: new Date(Date.now() + 3600000).toISOString(),
    status: 'scheduled',
  },
  {
    id: 'mar-002',
    tenant_id: 'bella_healthcare',
    inpatient_admission_id: 'adm-001',
    prescription_item_id: 'rx-item-002',
    drug_name: 'Paracetamol 500mg',
    dosage: '1 viên',
    route: 'Uống khi sốt',
    scheduled_time: new Date(Date.now() - 1800000).toISOString(),
    administered_time: new Date(Date.now() - 1500000).toISOString(),
    administered_by_nurse_id: 'nurse-001',
    status: 'administered',
    notes: 'Bệnh nhân sốt 38.5°C',
  },
];

export class MARService {
  static async getMARByAdmission(admissionId: string): Promise<MedicationAdministrationRecord[]> {
    try {
      const { data, error } = await supabase
        .from('hc_medication_administration_records')
        .select('*')
        .eq('inpatient_admission_id', admissionId)
        .order('scheduled_time', { ascending: true });

      if (!error && data && data.length > 0) {
        return data as MedicationAdministrationRecord[];
      }
    } catch {
      // Fallback
    }
    return MOCK_MAR_RECORDS.filter((m) => m.inpatient_admission_id === admissionId);
  }

  static async createMAR(input: CreateMARInput): Promise<MedicationAdministrationRecord> {
    const newMAR: MedicationAdministrationRecord = {
      id: `mar-${Date.now()}`,
      tenant_id: input.tenantId,
      inpatient_admission_id: input.inpatientAdmissionId,
      prescription_item_id: input.prescriptionItemId,
      drug_name: input.drugName,
      dosage: input.dosage,
      route: input.route,
      scheduled_time: input.scheduledTime,
      status: 'scheduled',
    };

    MOCK_MAR_RECORDS.unshift(newMAR);

    try {
      const { data, error } = await supabase
        .from('hc_medication_administration_records')
        .insert(newMAR)
        .select()
        .single();

      if (!error && data) {
        return data as MedicationAdministrationRecord;
      }
    } catch {
      // Dev fallback
    }

    return newMAR;
  }

  static async administerMAR(input: AdministerMARInput): Promise<MedicationAdministrationRecord> {
    const marIndex = MOCK_MAR_RECORDS.findIndex((m) => m.id === input.marId);
    if (marIndex === -1) throw new Error('MAR record not found');

    MOCK_MAR_RECORDS[marIndex].status = 'administered';
    MOCK_MAR_RECORDS[marIndex].administered_time = new Date().toISOString();
    MOCK_MAR_RECORDS[marIndex].administered_by_nurse_id = input.administeredByNurseId;
    MOCK_MAR_RECORDS[marIndex].notes = input.notes;

    try {
      const { data, error } = await supabase
        .from('hc_medication_administration_records')
        .update({
          status: 'administered',
          administered_time: MOCK_MAR_RECORDS[marIndex].administered_time,
          administered_by_nurse_id: input.administeredByNurseId,
          notes: input.notes,
        })
        .eq('id', input.marId)
        .select()
        .single();

      if (!error && data) {
        return data as MedicationAdministrationRecord;
      }
    } catch {
      // Dev fallback
    }

    return MOCK_MAR_RECORDS[marIndex];
  }
}
