/**
 * BELLA HEALTHCARE PLATFORM — CANONICAL DOMAIN MODELS
 * 
 * Target: Enterprise Healthcare Meta-Platform
 * Compliance: Canonical Domain Model (HL7 FHIR Interoperable via Adapter)
 * Governance: Bella Healthcare Constitution v1.0
 */

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'UNKNOWN';

export interface PatientProfile {
  id: string;
  tenant_id: string;
  customer_id: string; // 1-1 Foreign Key to Core `customers.id`
  blood_type: BloodType;
  rh_factor?: string;
  known_allergies: string[]; // e.g. ['Penicillin', 'Aspirin']
  medical_history: string[]; // e.g. ['Diabetes Type 2', 'Hypertension']
  family_medical_history?: string[];
  bhyt_code?: string; // Mã thẻ BHYT
  bhyt_benefit_rate?: number; // % Mức hưởng BHYT (80%, 95%, 100%)
  bhyt_initial_facility?: string; // Nơi ĐKKCB ban đầu
  bhyt_valid_from?: string;
  bhyt_valid_to?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  created_at: string;
  updated_at: string;
}

export type EncounterStatus = 
  | 'planned' 
  | 'arrived' 
  | 'in_triage' 
  | 'in_consultation' 
  | 'orders_pending' 
  | 'under_review' 
  | 'billing_pending' 
  | 'pharmacy_pending' 
  | 'completed' 
  | 'cancelled';

export type EncounterPriority = 'routine' | 'urgent' | 'emergency';

export interface EncounterVitals {
  systolic_bp?: number; // mmHg
  diastolic_bp?: number; // mmHg
  heart_rate?: number; // bpm
  temperature?: number; // Celsius
  spo2?: number; // %
  weight?: number; // kg
  height?: number; // cm
  bmi?: number;
  recorded_at: string;
  recorded_by: string; // Practitioner ID
}

export interface ICD10Diagnosis {
  icd10_code: string;
  icd10_name_vi: string;
  icd10_name_en?: string;
  is_primary: boolean;
  notes?: string;
}

/**
 * Encounter — Aggregate Root for all clinical activities in a visit
 */
export interface Encounter {
  id: string;
  tenant_id: string;
  patient_id: string; // FK to patient_profiles.id
  customer_id: string; // FK to customers.id (Identity)
  practitioner_id: string; // Primary Doctor
  facility_id: string;
  department_id?: string;
  room_id?: string;
  status: EncounterStatus;
  priority: EncounterPriority;
  chief_complaint?: string; // Lý do khám
  subjective_notes?: string; // S: Hỏi bệnh (SOAP)
  objective_notes?: string; // O: Khám lâm sàng (SOAP)
  assessment_notes?: string; // A: Chẩn đoán & Đánh giá (SOAP)
  plan_notes?: string; // P: Hướng điều trị (SOAP)
  vitals?: EncounterVitals;
  diagnoses: ICD10Diagnosis[];
  timeline_events: EncounterTimelineEvent[];
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EncounterTimelineEvent {
  event_type: string;
  title: string;
  description?: string;
  performed_by: string; // Practitioner ID
  timestamp: string;
}

export type OrderType = 'laboratory' | 'imaging' | 'medication' | 'procedure' | 'diet' | 'rehabilitation';
export type OrderStatus = 'draft' | 'placed' | 'in_progress' | 'completed' | 'cancelled';

export interface ClinicalOrder {
  id: string;
  tenant_id: string;
  encounter_id: string;
  patient_id: string;
  ordering_practitioner_id: string;
  order_type: OrderType;
  status: OrderStatus;
  priority: EncounterPriority;
  notes?: string;
  ordered_at: string;
  updated_at: string;
}

export interface LabOrderItem {
  id: string;
  order_id: string;
  test_code: string;
  test_name: string;
  sample_type?: string;
  tube_color?: string;
  result_value?: string;
  result_unit?: string;
  reference_range?: string;
  is_abnormal?: boolean;
  is_panic_value?: boolean;
  verified_by?: string;
  verified_at?: string;
}

export interface ImagingOrderItem {
  id: string;
  order_id: string;
  modality: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'ENDOSCOPY';
  body_site: string;
  dcm_study_uid?: string;
  viewer_link?: string;
  radiologist_report?: string;
  radiologist_id?: string;
  verified_at?: string;
}

export interface PrescriptionItem {
  id: string;
  drug_inventory_id: string;
  drug_code: string;
  drug_name: string;
  active_ingredient?: string;
  dosage: string; // e.g. "1 viên"
  frequency: string; // e.g. "2 lần/ngày"
  route: string; // e.g. "Uống sau ăn"
  duration_days: number;
  total_quantity: number;
  unit: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  tenant_id: string;
  encounter_id: string;
  patient_id: string;
  prescribing_doctor_id: string;
  items: PrescriptionItem[];
  dispensed_status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled';
  dispensed_by?: string;
  dispensed_at?: string;
  created_at: string;
}

export interface PatientJourneyQueueItem {
  id: string;
  tenant_id: string;
  encounter_id: string;
  patient_name: string;
  ticket_number: string; // e.g. "A042"
  queue_type: 'bhyt' | 'service' | 'followup' | 'priority';
  current_station: 'registration' | 'vitals' | 'consultation' | 'lab' | 'imaging' | 'review' | 'billing' | 'pharmacy';
  status: 'waiting' | 'called' | 'in_service' | 'completed' | 'skipped';
  called_at?: string;
  created_at: string;
}

/**
 * Master Patient Index (MPI) — Universal Identity Resolution
 */
export interface MasterPatientIndex {
  id: string;
  tenant_id: string;
  national_id?: string;
  insurance_number?: string;
  mrn_code: string; // Medical Record Number
  full_name: string;
  gender: 'male' | 'female' | 'other';
  dob: string;
  phone?: string;
  address?: string;
  emergency_contact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Bed Engine & Facility Infrastructure Hierarchy
 */
export type BedStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance' | 'out_of_service';
export type BedType = 'standard' | 'icu' | 'vip' | 'isolation' | 'pediatric' | 'recovery';

export interface Building {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  address?: string;
}

export interface Ward {
  id: string;
  tenant_id: string;
  building_id: string;
  code: string;
  name: string; // e.g. "Khoa Nội Tổng Hợp", "Khoa Hồi Sức Tích Cực ICU"
  department_head_practitioner_id?: string;
}

export interface Room {
  id: string;
  tenant_id: string;
  ward_id: string;
  room_number: string;
  floor_number: number;
  gender_restriction?: 'male' | 'female' | 'unrestricted';
  is_isolation?: boolean;
}

export interface Bed {
  id: string;
  tenant_id: string;
  room_id: string;
  ward_id: string;
  bed_code: string; // e.g. "BED-301-A"
  bed_type: BedType;
  status: BedStatus;
  daily_rate: number;
  current_admission_id?: string;
  current_patient_id?: string;
  updated_at: string;
}

/**
 * Inpatient Admission & Nursing Care Records
 */
export type InpatientAdmissionStatus = 'admitted' | 'transferred' | 'discharge_planned' | 'discharged' | 'cancelled';

export interface InpatientAdmission {
  id: string;
  tenant_id: string;
  encounter_id: string; // FK to Encounter Aggregate Root
  patient_id: string;
  bed_id: string;
  ward_id: string;
  admitting_doctor_id: string;
  attending_doctor_id: string;
  admission_diagnosis: ICD10Diagnosis[];
  status: InpatientAdmissionStatus;
  admitted_at: string;
  discharged_at?: string;
  discharge_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface NursingVitalSigns {
  id: string;
  tenant_id: string;
  inpatient_admission_id: string;
  encounter_id: string;
  patient_id: string;
  nurse_practitioner_id: string;
  temperature: number; // Celsius
  heart_rate: number; // bpm
  systolic_bp: number; // mmHg
  diastolic_bp: number; // mmHg
  spo2: number; // %
  respiratory_rate?: number; // breaths/min
  notes?: string;
  recorded_at: string;
}

export type MARStatus = 'scheduled' | 'administered' | 'refused' | 'held' | 'missed';

export interface MedicationAdministrationRecord {
  id: string;
  tenant_id: string;
  inpatient_admission_id: string;
  prescription_item_id: string;
  drug_name: string;
  dosage: string;
  route: string;
  scheduled_time: string;
  administered_time?: string;
  administered_by_nurse_id?: string;
  status: MARStatus;
  notes?: string;
}

/**
 * Break-Glass Emergency Access Audit Log
 */
export interface SecurityBreakGlassLog {
  id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  patient_id: string;
  encounter_id?: string;
  reason: string;
  ip_address?: string;
  activated_at: string;
}

/**
 * Enterprise Asset Registry Record
 */
export type RegistryType =
  | 'capability'
  | 'policy'
  | 'schema'
  | 'api'
  | 'workflow'
  | 'ai'
  | 'metadata'
  | 'terminology'
  | 'adr'
  | 'data_contract';

export interface EnterpriseRegistryRecord {
  id: string;
  registry_type: RegistryType;
  code: string;
  version: string;
  definition: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}
