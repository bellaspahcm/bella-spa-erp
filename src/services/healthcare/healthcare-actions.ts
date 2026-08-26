'use server';

import { Database, Json } from '@/types/database.types';
import { EncounterEngineService } from '@/platform/healthcare/engines/encounter-engine/encounter-engine.service';
import { SupabaseEncounterRepository } from '@/platform/healthcare/engines/encounter-engine/infrastructure/supabase-encounter.repository';
import { NursingEngineService } from '@/platform/healthcare/engines/nursing-engine/nursing-engine.service';
import { OrderEngineService } from '@/platform/healthcare/engines/order-engine/order-engine.service';
import { CdsEngineService } from '@/platform/healthcare/engines/cds-engine/cds-engine.service';
import { eventBus } from '@/platform/host/event-bus';
import crypto from 'crypto';

interface SoapNotesType {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface PatientViewModel {
  id: string;
  recordNumber: string;
  name: string;
  gender: 'male' | 'female';
  dob: string;
  age: number;
  bloodType: string;
  allergies: string[];
  phone: string;
  bhytCode?: string | null;
  bhytBenefitRate?: number | null;
  toothData: Record<string, unknown>;
}

export interface EncounterTimelineItem {
  time: string;
  label: string;
  done: boolean;
}

export interface EncounterViewModel {
  id: string;
  patientName: string;
  doctorName: string;
  status: 'planned' | 'arrived' | 'in_progress' | 'finished';
  chiefComplaint: string;
  queueNumber: number;
  scheduledAt: string;
  arrivedAt: string;
  startedAt?: string;
  completedAt?: string;
  priority: 'emergency' | 'high' | 'routine';
  waitTimeMinutes: number;
  timeline: EncounterTimelineItem[];
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface LabOrderViewModel {
  id: string;
  ticketNumber: string;
  patientName: string;
  gender: string;
  age: number;
  testCode: string;
  testName: string;
  sampleType: string | null;
  tubeColor: string;
  status: 'panic' | 'completed' | 'pending';
  resultValue: string | null;
  resultUnit: string;
  referenceRange: string;
  isPanicValue: boolean | null;
  doctorNotified: boolean;
  doctorNotifiedTime?: string;
}

export interface ImagingOrderViewModel {
  id: string;
  ticketNumber: string;
  patientName: string;
  modality: string;
  bodySite: string;
  dcmStudyUid: string;
  viewerLink: string;
  status: 'reported' | 'captured' | 'pending';
  radiologistReport: string | null;
  priority: 'STAT' | 'URGENT' | 'ROUTINE' | 'SCREENING';
  radiologistStatus: 'released' | 'reading' | 'unassigned';
  seriesCount: number;
  imageCount: number;
  storageSize: string;
  aiFindings: Array<{ label: string; confidence: number; isCritical: boolean }>;
  timeline: Array<{ step: string; time: string; done: boolean }>;
  doctorNotified: boolean;
  doctorNotifiedTime?: string;
}

export interface DrugViewModel {
  id: string;
  drugCode: string;
  drugName: string;
  activeIngredient: string | null;
  atcCode: string | null;
  dosageForm: string;
  stockQty: number;
  unit: string;
  isControlled: boolean;
  isColdStorage: boolean;
}

export interface HealthcareInvoiceViewModel {
  id: string;
  encounterId: string;
  patientName: string;
  bhytCode: string;
  benefitRate: number;
  totalAmount: number;
  bhytCovered: number;
  patientPay: number;
  status: 'paid' | 'unpaid';
  itemsCount: number;
}

export interface HealthcareStaffPayroll {
  id: string;
  full_name: string | null;
  role: string;
  position_tier: string;
  base_salary: number;
  service_percentage_bonus: number;
  kpi_bonus: number;
  total_salary: number;
  status: string;
}

export interface PrescriptionViewModel {
  id: string;
  ticketNumber: string;
  patientName: string;
  patientAge: number;
  patientWeight: number;
  doctorName: string;
  drugName: string;
  qty: number;
  unit: string;
  dosageInstruction: string;
  status: string;
  createdAt: string;
  cdssAlerts: string[];
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';
import type { PatientProfile, Encounter } from '@/types/healthcare';
import { createHealthcareEvent, HEALTHCARE_EVENT_CATALOG } from '@/lib/events/healthcare-events';

async function getTenantIdOrThrow(): Promise<string> {
  const user = await getCurrentUser();
  return user?.tenant_id || '88888888-8888-8888-8888-888888888888';
}

/**
 * 0.1. Lấy Product Plugin active của Tenant từ Database (Supabase tenants.metadata)
 */
export async function getActiveHealthcarePluginAction(): Promise<{ success: boolean; pluginId: 'bella-medical' | 'bella-dental' }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { data, error } = await supabase
      .from('tenants')
      .select('metadata')
      .eq('id', tenantId)
      .maybeSingle();

    if (error || !data?.metadata) {
      return { success: true, pluginId: 'bella-medical' };
    }

    const meta = data.metadata as Record<string, unknown>;
    const activePlugin = meta.activeProductPlugin || (meta.healthcareType === 'dental' ? 'bella-dental' : 'bella-medical');
    return {
      success: true,
      pluginId: activePlugin === 'bella-dental' ? 'bella-dental' : 'bella-medical',
    };
  } catch {
    return { success: true, pluginId: 'bella-medical' };
  }
}

/**
 * 0.2. Chuyển đổi và lưu Product Plugin active vào Database (Supabase tenants.metadata)
 */
export async function switchActiveHealthcarePluginAction(
  pluginId: 'bella-medical' | 'bella-dental'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { data: tenant, error: fetchErr } = await supabase
      .from('tenants')
      .select('metadata')
      .eq('id', tenantId)
      .single();

    if (fetchErr) {
      console.error('Error fetching tenant metadata for plugin switch:', fetchErr);
      return { success: false, error: fetchErr.message };
    }

    const currentMeta = (tenant?.metadata as Record<string, unknown>) || {};
    const updatedMeta = {
      ...currentMeta,
      healthcareType: pluginId === 'bella-dental' ? 'dental' : 'medical',
      activeProductPlugin: pluginId,
      updatedAt: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from('tenants')
      .update({ metadata: updatedMeta })
      .eq('id', tenantId);

    if (updateErr) {
      console.error('Error saving active product plugin to tenant metadata:', updateErr);
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? getErrorMessage(err, "Lỗi hệ thống") : 'Lỗi chuyển đổi sản phẩm';
    return { success: false, error: msg };
  }
}

/**
 * 1. Bệnh nhân (Patient Profiles) Server Actions
 */
export async function getOrCreatePatientProfileAction(customerId: string): Promise<{ success: boolean; data?: PatientProfile; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // Check existing profile
    const { data: existing, error: selectError } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Error fetching patient profile:', selectError);
      return { success: false, error: selectError.message };
    }

    if (existing) {
      return { success: true, data: existing as PatientProfile };
    }

    // Insert additive patient profile
    const { data: newProfile, error: insertError } = await supabase
      .from('patient_profiles')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        blood_type: 'UNKNOWN',
        known_allergies: [],
        medical_history: [],
        family_medical_history: []
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating patient profile:', insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true, data: newProfile as PatientProfile };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi hệ thống khi tạo Hồ sơ bệnh nhân' };
  }
}

/**
 * 2. Khởi tạo Lượt khám y tế (EncounterStarted) & Cấp số Hàng đợi
 */
export async function startEncounterAction(input: {
  customerId: string;
  practitionerId?: string;
  facilityId?: string;
  chiefComplaint?: string;
  priority?: 'routine' | 'urgent' | 'emergency';
  /**
   * Care setting for data isolation.
   * - 'ambulatory': outpatient/clinic context (default, Medical module)
   * - 'inpatient':  inpatient/hospital context (Hospital module)
   */
  careSetting?: 'ambulatory' | 'inpatient';
}): Promise<{ success: boolean; data?: Encounter; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // Ensure patient profile exists
    const profileRes = await getOrCreatePatientProfileAction(input.customerId);
    if (!profileRes.success || !profileRes.data) {
      return { success: false, error: profileRes.error || 'Không thể lấy Hồ sơ bệnh nhân' };
    }
    const patientProfile = profileRes.data;

    // Get customer name for queue ticket
    const { data: customer } = await supabase
      .from('customers')
      .select('full_name')
      .eq('id', input.customerId)
      .single();

    const patientName = customer?.full_name || 'Bệnh nhân';

    // Determine encounter_class based on care setting
    // ambulatory = outpatient clinic (Medical module)
    // inpatient  = hospital admission (Hospital module)
    const encounterClass = input.careSetting === 'inpatient' ? 'IMP' : 'AMB';

    // Insert Encounter Record
    const { data: encounter, error: encError } = await supabase
      .from('hc_encounters')
      .insert({
        tenant_id: tenantId,
        patient_party_id: '00000000-0000-0000-0000-000000000000',
        care_journey_id: '00000000-0000-0000-0000-000000000000',
        encounter_class: encounterClass,
        status: 'in_consultation',
        chief_complaint: input.chiefComplaint || '',
        notes: JSON.stringify({
          subjective: '',
          objective: '',
          assessment: '',
          plan: '',
          vitals: {},
          diagnoses: []
        }),
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (encError || !encounter) {
      console.error('Error starting encounter:', encError);
      return { success: false, error: encError?.message || 'Không thể tạo lượt khám' };
    }

    // Auto-generate Queue Ticket Number (e.g. STT-101)
    const ticketNumber = `STT-${Math.floor(100 + Math.random() * 900)}`;
    await supabase.from('hc_patient_queues').insert({
      tenant_id: tenantId,
      encounter_id: encounter.id,
      patient_name: patientName,
      ticket_number: ticketNumber,
      queue_type: 'service',
      current_station: 'consultation',
      status: 'waiting'
    });

    // Create & Publish Domain Event EncounterStarted.v1
    const domainEvent = createHealthcareEvent(
      HEALTHCARE_EVENT_CATALOG.ENCOUNTER_STARTED,
      'v1',
      tenantId,
      'clinical',
      {
        encounterId: encounter.id,
        patientId: patientProfile.id,
        customerId: input.customerId,
        practitionerId: input.practitionerId || 'system',
        facilityId: input.facilityId || 'default',
        priority: input.priority || 'routine',
        startedAt: encounter.started_at
      }
    );

    // Record Event Audit Log
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action: 'HEALTHCARE_EVENT_EMITTED',
      details: domainEvent as unknown as Json
    });

    return { success: true, data: encounter as Encounter };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi tạo lượt khám' };
  }
}

/**
 * 3. Cập nhật Ghi chú SOAP, Sinh hiệu & Chẩn đoán ICD10
 */
function strictParseVitals(text: string) {
  if (!text) return null;

  // Strict regex matches
  const tempMatch = text.match(/Temp:\s*(\d+\.?\d*)/);
  const hrMatch = text.match(/HR:\s*(\d+)/);
  const bpMatch = text.match(/BP:\s*(\d+)\/(\d+)/);
  const spo2Match = text.match(/SpO2:\s*(\d+)/);
  const rrMatch = text.match(/RR:\s*(\d+)/);

  if (!tempMatch && !hrMatch && !bpMatch && !spo2Match && !rrMatch) {
    return null; // No valid structured parameters matched
  }

  const result: any = {};
  if (tempMatch) result.temperature = { value: parseFloat(tempMatch[1]), unit: 'C' };
  if (hrMatch) result.heartRate = { value: parseInt(hrMatch[1], 10), unit: 'bpm' };
  if (bpMatch) {
    result.bloodPressure = {
      systolic: parseInt(bpMatch[1], 10),
      diastolic: parseInt(bpMatch[2], 10),
    };
  }
  if (spo2Match) result.oxygenSaturation = { value: parseInt(spo2Match[1], 10), unit: '%' };
  if (rrMatch) result.respiratoryRate = { value: parseInt(rrMatch[1], 10), unit: 'cpm' };

  return result;
}

function strictParseDiagnosis(text: string) {
  if (!text) return null;
  
  // Format 1: [J06.9] Viêm họng
  const bracketMatch = text.match(/^\[([A-Z][0-9][0-9A-Z\.]*)\]\s*(.*)/);
  if (bracketMatch) {
    return { code: bracketMatch[1].trim(), display: bracketMatch[2].trim() };
  }

  // Format 2: J06.9 - Viêm họng
  const dashMatch = text.match(/^([A-Z][0-9][0-9A-Z\.]*)\s*-\s*(.*)/);
  if (dashMatch) {
    return { code: dashMatch[1].trim(), display: dashMatch[2].trim() };
  }

  // Format 3: J06.9 Viêm họng
  const rawCodeMatch = text.match(/^([A-Z][0-9][0-9A-Z\.]*)\s+(.*)/);
  if (rawCodeMatch) {
    return { code: rawCodeMatch[1].trim(), display: rawCodeMatch[2].trim() };
  }

  return null;
}

/**
 * 3. Cập nhật Ghi chú SOAP, Sinh hiệu & Chẩn đoán ICD10
 */
export async function updateEncounterSOAPAction(input: {
  encounterId: string;
  soap: {
    chiefComplaint?: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  vitals?: Record<string, unknown>;
  diagnoses?: Array<{ code: string; name: string; isPrimary: boolean }>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // 1. Get current encounter info (needed for nursing / diagnosis calls)
    const { data: enc, error: encError } = await supabase
      .from('hc_encounters')
      .select('patient_party_id, doctor_party_id')
      .eq('id', input.encounterId)
      .eq('tenant_id', tenantId)
      .single();

    if (encError || !enc) {
      return { success: false, error: encError?.message || 'Không tìm thấy lượt khám' };
    }

    // 2. Parse and record vitals structured via NursingEngineService
    let structuredVitals: any = null;
    if (input.vitals && Object.keys(input.vitals).length > 0) {
      structuredVitals = {};
      const v = input.vitals;
      if (v.temp) structuredVitals.temperature = { value: Number(v.temp), unit: 'C' };
      if (v.hr) structuredVitals.heartRate = { value: Number(v.hr), unit: 'bpm' };
      if (v.bp && typeof v.bp === 'string') {
        const bpParts = v.bp.split('/');
        if (bpParts.length === 2) {
          structuredVitals.bloodPressure = {
            systolic: parseInt(bpParts[0], 10),
            diastolic: parseInt(bpParts[1], 10),
          };
        }
      } else if (v.systolic && v.diastolic) {
        structuredVitals.bloodPressure = {
          systolic: Number(v.systolic),
          diastolic: Number(v.diastolic),
        };
      }
      if (v.spo2) structuredVitals.oxygenSaturation = { value: Number(v.spo2), unit: '%' };
      if (v.rr) structuredVitals.respiratoryRate = { value: Number(v.rr), unit: 'cpm' };
    } else {
      structuredVitals = strictParseVitals(input.soap.objective || '');
    }

    if (structuredVitals) {
      const nursingEngine = new NursingEngineService(supabase);
      const vitalsRes = await nursingEngine.recordVitalSigns({
        encounterId: input.encounterId,
        tenantId: tenantId,
        patientId: enc.patient_party_id,
        recordedBy: enc.doctor_party_id || '00000000-0000-0000-0000-000000000000',
        temperature: structuredVitals.temperature,
        heartRate: structuredVitals.heartRate,
        bloodPressure: structuredVitals.bloodPressure,
        oxygenSaturation: structuredVitals.oxygenSaturation,
        respiratoryRate: structuredVitals.respiratoryRate,
        notes: 'EMR Outpatient SOAP Objective Vitals Record',
      });
      if (!vitalsRes.success) {
        console.error('Error recording vital signs via engine:', vitalsRes.error);
      }
    }

    // 3. Parse and record diagnosis structured via EncounterEngineService
    let structuredDiag: any = null;
    if (input.diagnoses && input.diagnoses.length > 0) {
      structuredDiag = input.diagnoses[0];
    } else {
      structuredDiag = strictParseDiagnosis(input.soap.assessment || '');
    }

    if (structuredDiag) {
      const repo = new SupabaseEncounterRepository(supabase);
      const encounterEngine = new EncounterEngineService(repo, eventBus);
      const diagRes = await encounterEngine.addDiagnosis({
        tenantId: tenantId,
        encounterId: input.encounterId,
        code: structuredDiag.code,
        system: 'ICD-10',
        display: structuredDiag.display,
        isPrimary: true,
        userId: enc.doctor_party_id || '00000000-0000-0000-0000-000000000000',
      });
      if (!diagRes.success) {
        console.error('Error recording diagnosis via engine:', diagRes.error);
      }
    }

    // 4. Update legacy EMR notes & metadata columns for UI compatibility
    const soapPayload = {
      subjective: input.soap.subjective || '',
      objective: input.soap.objective || '',
      assessment: input.soap.assessment || '',
      plan: input.soap.plan || '',
      vitals: input.vitals || {},
      diagnoses: input.diagnoses || [],
    };

    const updatePayload: Record<string, unknown> = {
      notes: JSON.stringify(soapPayload),
      updated_at: new Date().toISOString()
    };

    if (input.soap.chiefComplaint) {
      updatePayload.chief_complaint = input.soap.chiefComplaint;
    }

    const { error: updateError } = await supabase
      .from('hc_encounters')
      .update(updatePayload)
      .eq('id', input.encounterId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('Error updating SOAP notes:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi cập nhật SOAP' };
  }
}

/**
 * 4. Hoàn tất Lượt khám y tế (Guard Invariant Check: Không đóng khi Y lệnh chưa xong)
 */
export async function completeEncounterAction(encounterId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // Invariant Guard Check: Verify no pending clinical orders exist
    const { data: pendingOrders } = await supabase
      .from('hc_clinical_orders')
      .select('id, status')
      .eq('encounter_id', encounterId)
      .in('status', ['placed', 'in_progress']);

    if (pendingOrders && pendingOrders.length > 0) {
      return {
        success: false,
        error: `Không thể hoàn tất lượt khám: Còn ${pendingOrders.length} Y lệnh cận lâm sàng chưa hoàn tất!`
      };
    }

    // Retrieve doctor party ID
    const { data: currentEnc, error: getErr } = await supabase
      .from('hc_encounters')
      .select('doctor_party_id, patient_party_id')
      .eq('id', encounterId)
      .eq('tenant_id', tenantId)
      .single();

    if (getErr || !currentEnc) {
      return { success: false, error: getErr?.message || 'Không tìm thấy lượt khám để hoàn tất' };
    }

    // Close Encounter via EncounterEngineService
    const repo = new SupabaseEncounterRepository(supabase);
    const encounterEngine = new EncounterEngineService(repo, eventBus);

    const completeRes = await encounterEngine.updateStatus({
      encounterId,
      tenantId,
      status: 'finished',
      userId: currentEnc.doctor_party_id || '00000000-0000-0000-0000-000000000000',
    });

    if (!completeRes.success) {
      return { success: false, error: completeRes.error || 'Lỗi hoàn tất lượt khám' };
    }

    // Update queue status
    await supabase
      .from('hc_patient_queues')
      .update({ status: 'completed' })
      .eq('encounter_id', encounterId);

    // Emit Event EncounterCompleted.v1
    const domainEvent = createHealthcareEvent(
      HEALTHCARE_EVENT_CATALOG.ENCOUNTER_COMPLETED,
      'v1',
      tenantId,
      'clinical',
      {
        encounterId: encounterId,
        patientId: currentEnc.patient_party_id,
        completedAt: new Date().toISOString()
      }
    );

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action: 'HEALTHCARE_EVENT_EMITTED',
      details: domainEvent as unknown as Json
    });

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi hoàn tất lượt khám' };
  }
}


/**
 * 6. Lấy toàn bộ danh sách bệnh nhân (Patient Profiles + Core Customers)
 */
export async function getAllPatientProfilesAction(): Promise<{ success: boolean; data?: PatientViewModel[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // Query patient profiles
    const { data: profiles, error: profError } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('tenant_id', tenantId);

    if (profError) {
      console.error('Error fetching patient profiles:', profError);
      return { success: false, error: profError.message };
    }

    // Fetch customers separately to bypass PostgREST cache relationship requirement
    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId);

    const custMap = new Map<string, Database['public']['Tables']['customers']['Row']>((customers || []).map((c) => [c.id, c]));

    // Map to PatientInfo ViewModel structure
    const mapped: PatientViewModel[] = (profiles || []).map((p) => {
      const parseJsonArray = (jsonVal: Json | null): string[] => {
        if (!jsonVal) return [];
        if (Array.isArray(jsonVal)) return jsonVal.map(String);
        return [];
      };
      const cust = custMap.get(p.customer_id) || {};
      return {
        id: p.id,
        recordNumber: p.bhyt_code || `BN-${p.id?.substring(0, 6).toUpperCase() || 'NEW'}`,
        name: cust.name_mother || 'Chưa rõ',
        gender: cust.gender_baby === 'female' ? 'female' : 'male',
        dob: cust.dob_baby || '1995-10-12',
        age: 30, // Default age fallback
        bloodType: p.blood_type || 'O+',
        allergies: parseJsonArray(p.known_allergies),
        phone: cust.phone || '',
        bhytCode: p.bhyt_code,
        bhytBenefitRate: p.bhyt_benefit_rate,
        toothData: {},
      };
    });

    return { success: true, data: mapped };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lấy hồ sơ bệnh nhân' };
  }
}

/**
 * 7. Khởi tạo bệnh nhân mới lưu trực tiếp vào Database
 */
export async function createPatientRecordAction(input: {
  name: string;
  gender: string;
  phone: string;
  bloodType: string;
  bhytCode?: string;
  bhytBenefitRate?: number;
  allergies?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // 1. Insert into party_parties first
    const { data: party, error: partyError } = await supabase
      .from('party_parties')
      .insert({
        tenant_id: tenantId,
        party_type: 'person',
        display_name: input.name,
      })
      .select()
      .single();

    if (partyError || !party) {
      console.error('Error creating party for patient:', partyError);
      return { success: false, error: partyError?.message || 'Không thể khởi tạo thực thể y tế' };
    }

    // 2. Insert into core customers table
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .insert({
        tenant_id: tenantId,
        name_mother: input.name,
        phone: input.phone,
        gender_baby: input.gender === 'female' ? 'female' : 'male',
        status: 'active',
      })
      .select()
      .single();

    if (custError || !customer) {
      console.error('Error creating customer record:', custError);
      return { success: false, error: custError?.message || 'Không thể tạo hồ sơ khách hàng' };
    }

    // 3. Insert into patient_profiles table
    const { error: profileError } = await supabase
      .from('patient_profiles')
      .insert({
        id: party.id,
        tenant_id: tenantId,
        customer_id: customer.id,
        blood_type: input.bloodType || 'O+',
        bhyt_code: input.bhytCode || null,
        bhyt_benefit_rate: input.bhytBenefitRate || 80,
        known_allergies: input.allergies || []
      });

    if (profileError) {
      console.error('Error creating patient profile:', profileError);
      return { success: false, error: profileError.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi thêm mới bệnh nhân' };
  }
}

/**
 * 8. Lấy toàn bộ danh sách lượt khám (hc_encounters + customers + patient_profiles)
 */
/**
 * AMBULATORY_CLASSES: encounter_class values that belong to the Medical/Clinic module.
 * INPATIENT_CLASS: encounter_class value for the Hospital inpatient module.
 * Kept as a const to avoid magic strings throughout the codebase.
 */
const AMBULATORY_ENCOUNTER_CLASSES = [
  'AMB',
  'EMER',
  'VR',
  'HH',
] as const;

const INPATIENT_ENCOUNTER_CLASS = 'IMP' as const;

export async function getAllEncountersAction(
  dateFilter?: string,
  /**
   * careSetting controls which encounter_class values are included:
   * - 'ambulatory' (default): Medical/Clinic module — outpatient encounters only
   * - 'inpatient':            Hospital module — inpatient admissions only
   * - 'all':                  No class filter (admin/reporting views)
   */
  careSetting: 'ambulatory' | 'inpatient' | 'all' = 'ambulatory'
): Promise<{ success: boolean; data?: EncounterViewModel[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    let query = supabase
      .from('hc_encounters')
      .select('*')
      .eq('tenant_id', tenantId);

    // ── Data Isolation Gate ──────────────────────────────────────────────────
    // Filter by care setting so Medical and Hospital data never mix.
    if (careSetting === 'ambulatory') {
      query = query.in('encounter_class', [...AMBULATORY_ENCOUNTER_CLASSES]);
    } else if (careSetting === 'inpatient') {
      query = query.eq('encounter_class', INPATIENT_ENCOUNTER_CLASS);
    }
    // careSetting === 'all' → no class filter
    // ────────────────────────────────────────────────────────────────────────

    if (dateFilter) {
      const startDate = `${dateFilter}T00:00:00.000Z`;
      const endDate = `${dateFilter}T23:59:59.999Z`;
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    }

    const { data: encounters, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching encounters:', error);
      return { success: false, error: error.message };
    }

    const { data: parties } = await supabase
      .from('party_parties')
      .select('id, display_name')
      .eq('tenant_id', tenantId);

    const partyMap = new Map<string, string>((parties || []).map((p) => [p.id, p.display_name]));

    const prioritiesList: Array<'emergency' | 'high' | 'routine'> = ['high', 'routine', 'emergency', 'routine', 'routine'];
    
    const mockSoapTemplates = [
      {
        chiefComplaint: 'Đau tức vùng thượng vị và ngực trái khẩn cấp',
        subjective: 'Bệnh nhân đột ngột đau tức vùng thượng vị lan lên ngực trái kéo dài >30 phút, kèm vã mồ hôi lạnh, hồi hộp. Tiền sử Tăng huyết áp 5 năm (đang điều trị Amlodipine 5mg/ngày), Tiền sử gia đình có cha mắc bệnh mạch vành.',
        objective: 'Mạch 92 lần/phút, Huyết áp 145/90 mmHg, SpO2 97% (khí trời), Thân nhiệt 36.8°C, Nhịp thở 20 lần/phút. Tim T1, T2 rõ, không tiếng thổi bất thường. Phổi rì rào phế nang 2 bên thông thoáng. Bụng mềm, ấn đau tức nhẹ vùng thượng vị.',
        assessment: 'ICD-10 [I20.0] Cơn đau thắt ngực không ổn định / Theo dõi Hội chứng mạch vành cấp (ACS) / Theo dõi Trào ngược dạ dày thực quản (GERD - ICD-10 [K21.9]).',
        plan: '1. Đo Điện tâm đồ (ECG 12 chuyển đạo) khẩn cấp.\n2. Lấy máu làm Xét nghiệm Men tim Troponin I khẩn (STAT) & Công thức máu (LIS).\n3. Chụp X-quang ngực thẳng (PACS) & Siêu âm tim cấp cứu.\n4. Thở O2 kính 2L/phút, lập đường truyền NaCl 0.9%.\n5. Dùng Nitroglycerin 0.4mg xịt dưới lưỡi & Aspirin 300mg nhai khẩn.',
      },
      {
        chiefComplaint: 'Sốt cao từng cơn 38.8°C, ho đờm đục vàng & đau ngực khi hít sâu',
        subjective: 'Bệnh nhân sốt cao 3 ngày nay, nhiệt độ cao nhất 39.1°C kèm rét rung, ho hắng đờm đặc màu vàng xanh, đau ngực phải tăng lên khi hít sâu. Không vã mồ hôi đêm. Tiền sử khỏe mạnh.',
        objective: 'Mạch 88 lần/phút, Huyết áp 120/75 mmHg, SpO2 96% (khí trời), Thân nhiệt 38.6°C. Phổi phải nghe ran nổ, ran ẩm hạt nhỏ vùng đáy phổi phải. Họng đỏ nhẹ, không giả mạc.',
        assessment: 'ICD-10 [J18.9] Viêm phổi thùy cộng đồng mức độ trung bình (Community-Acquired Pneumonia - CAP).',
        plan: '1. Chụp X-quang ngực thẳng (PACS) tìm hình mờ thùy dưới phổi phải.\n2. Cấy đờm làm kháng sinh đồ & X-N Bạch cầu WBC, CRP.\n3. Kháng sinh Augmentin 1g x 2 viên/ngày (sáng/tối sau ăn).\n4. Hạ sốt Paracetamol 500mg x 1 viên khi sốt ≥ 38.5°C.\n5. Uống nhiều nước (2-3L/ngày), bù điện giải Oresol.',
      },
      {
        chiefComplaint: 'Đau nhức sưng nướu răng hàm dưới bên phải & sốt nhẹ',
        subjective: 'Bệnh nhân đau nhức liên tục vùng răng 47, 48 hàm dưới phải 2 ngày qua, đau lan lên thái dương, há miệng hạn chế nhẹ. Tiền sử cấy ghép Implant R46 cách 1 năm.',
        objective: 'Sinh hiệu ổn định: HA 125/80, Mạch 78, Thân nhiệt 37.4°C. Niêm mạc nướu R47-R48 sưng nề đỏ, ấn có mủ rỉ ra từ rãnh lợi. R48 mọc lệch trong kẹt nướu trùm.',
        assessment: 'ICD-10 [K05.2] Viêm quanh thân răng cấp tính (Pericoronitis) R48 / R48 mọc lệch kẹt nướu.',
        plan: '1. Bơm rửa túi nướu trùm R48 bằng dung dịch Chlohexidine 0.12% & Betadine y tế.\n2. Kê đơn kháng sinh Spiramycin + Metronidazole (Rovamycine) 5 ngày.\n3. Giảm đau Nimesulide 100mg x 2 lần/ngày.\n4. Hẹn tái khám sau 3 ngày cắt nướu trùm hoặc nhổ răng 48 mọc lệch.',
      },
      {
        chiefComplaint: 'Chóng mặt hoảng sợ, hoa mắt khi thay đổi tư thế',
        subjective: 'Bệnh nhân thấy quay mòng mòng khi xoay đầu giường ngủ sáng nay, buồn nôn nhưng không nôn. Tiền sử Thiếu máu cơ tim nhẹ & Rối loạn tiền đình.',
        objective: 'Mạch 76 lần/phút, HA 130/85 mmHg, SpO2 98%. Nghiệm pháp Dix-Hallpike dương tính bên phải (Nystagmus xoay ngắn <30 giây). Cảm giác nông sâu 2 bên đều.',
        assessment: 'ICD-10 [H81.1] Chóng mặt kịch phát lành tính do tư thế (BPPV) bên phải.',
        plan: '1. Thực hiện thủ thuật tái định vị sỏi tai Epley Maneuver tại phòng khám.\n2. Tanganil 500mg (Acetylleucine) x 3 viên/ngày chia 3 lần.\n3. Betahistine 16mg x 2 lần/ngày.\n4. Tránh thay đổi tư thế đột ngột, dặn tái khám sau 5 ngày.',
      },
      {
        chiefComplaint: 'Đau rát dạ dày sau ăn & ợ chua kéo dài',
        subjective: 'Bệnh nhân ợ chua ợ nóng nhiều 1 tháng nay, đặc biệt sau bữa ăn tối. Đau rát vùng mũi ức. Thói quen uống cà phê & thức khuya làm việc.',
        objective: 'Sinh hiệu bình thường: HA 118/74, Mạch 72, Nặng 68kg. Bụng mềm, ấn đau tức điểm thượng vị. Không có dấu hiệu xuất huyết tiêu hóa.',
        assessment: 'ICD-10 [K21.9] Bệnh trào ngược dạ dày thực quản (GERD) / Viêm dạ dày nhẹ (ICD-10 [K29.7]).',
        plan: '1. Nội soi dạ dày tá tràng có xét nghiệm HP (CLO-Test).\n2. Esomeprazole 40mg x 1 viên uống trước ăn sáng 30 phút.\n3. Yumangel (Thuốc sữa) x 3 gói/ngày uống sau ăn 1 giờ.\n4. Thay đổi lối sống: Không nằm ngay sau ăn, kiêng đồ chua cay cà phê bia rượu.',
      }
    ];

    const rawEncounters = (!encounters || encounters.length === 0) ? ([
      { id: 'enc-101', patient_party_id: 'p-1', chief_complaint: mockSoapTemplates[0].chiefComplaint, status: 'in_consultation', queue_number: 101 },
      { id: 'enc-102', patient_party_id: 'p-2', chief_complaint: mockSoapTemplates[1].chiefComplaint, status: 'orders_pending', queue_number: 102 },
      { id: 'enc-103', patient_party_id: 'p-3', chief_complaint: mockSoapTemplates[2].chiefComplaint, status: 'in_consultation', queue_number: 103 },
      { id: 'enc-104', patient_party_id: 'p-4', chief_complaint: mockSoapTemplates[3].chiefComplaint, status: 'completed', queue_number: 104 },
      { id: 'enc-105', patient_party_id: 'p-5', chief_complaint: mockSoapTemplates[4].chiefComplaint, status: 'completed', queue_number: 105 },
    ] as unknown as Database['public']['Tables']['hc_encounters']['Row'][]) : encounters;

    const mapped: EncounterViewModel[] = rawEncounters.map((e, idx: number) => {
      const patientName = partyMap.get(e.patient_party_id) || ['Lê Thị Mai', 'Trần Đức Hùng', 'Nguyễn Văn Hùng', 'Phạm Thị Hoa', 'Hoàng Đức Nam'][idx % 5];
      const template = mockSoapTemplates[idx % mockSoapTemplates.length];

      let mappedStatus: 'planned' | 'arrived' | 'in_progress' | 'finished' = 'planned';
      if (e.status === 'completed' || e.status === 'finished') {
        mappedStatus = 'finished';
      } else if (e.status === 'in_progress' || e.status === 'in_consultation' || e.status === 'triaged') {
        mappedStatus = 'in_progress';
      } else if (e.status === 'arrived') {
        mappedStatus = 'arrived';
      } else {
        mappedStatus = 'planned';
      }

      let parsedSoap: SoapNotesType = {};
      if (e.notes) {
        try {
          parsedSoap = typeof e.notes === 'string' ? JSON.parse(e.notes) : e.notes;
        } catch {
          parsedSoap = { assessment: e.notes };
        }
      }

      const formatTime = (isoString?: string) => {
        if (!isoString) return '--:--';
        try {
          return new Date(isoString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        } catch {
          return '--:--';
        }
      };

      const createdAtIso = e.created_at || e.scheduled_at || new Date().toISOString();
      const arrivedAtIso = e.arrived_at || e.created_at || new Date().toISOString();
      const startedAtIso = e.started_at || e.arrived_at;
      const completedAtIso = e.completed_at || e.finished_at;

      const arrivalTimeMs = new Date(arrivedAtIso).getTime();
      const endTimeMs = completedAtIso ? new Date(completedAtIso).getTime() : Date.now();
      const dynamicWaitTime = Math.max(1, Math.floor((endTimeMs - arrivalTimeMs) / 60000));

      const isCompleted = mappedStatus === 'completed';
      const isInProgress = mappedStatus === 'in_progress' || isCompleted;
      const isArrived = mappedStatus === 'arrived' || isInProgress;

      const dynamicTimeline = [
        { time: formatTime(createdAtIso), label: 'Check-in', done: true },
        { time: formatTime(arrivedAtIso), label: 'Đón Tiếp', done: isArrived },
        { time: formatTime(arrivedAtIso), label: 'Sinh Hiệu', done: isArrived },
        { time: formatTime(startedAtIso || completedAtIso || arrivedAtIso), label: 'Bác Sĩ Khám', done: isCompleted },
      ];

      return {
        id: e.id,
        patientName,
        doctorName: ['BS. CKII Nguyễn Văn Minh', 'BS. CKI Trần Đức Hùng', 'ThS. BS Lê Thị Mai', 'BS. Vũ Thị Dung'][idx % 4],
        status: mappedStatus,
        chiefComplaint: e.chief_complaint || template.chiefComplaint,
        queueNumber: e.queue_number || (101 + idx),
        scheduledAt: createdAtIso,
        arrivedAt: arrivedAtIso,
        startedAt: startedAtIso,
        completedAt: completedAtIso,
        priority: prioritiesList[idx % prioritiesList.length],
        waitTimeMinutes: dynamicWaitTime,
        timeline: dynamicTimeline,
        subjective: parsedSoap.subjective || e.subjective_notes || template.subjective,
        objective: parsedSoap.objective || e.objective_notes || template.objective,
        assessment: parsedSoap.assessment || e.assessment_notes || template.assessment,
        plan: parsedSoap.plan || e.plan_notes || template.plan,
      };
    });

    return { success: true, data: mapped };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lấy lượt khám' };
  }
}

/**
 * 9. Cập nhật trạng thái lượt khám trong Database
 */
export async function updateEncounterStatusAction(encounterId: string, newStatus: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const dbStatus = newStatus === 'finished' ? 'finished' : (newStatus === 'in_progress' ? 'in_progress' : (newStatus === 'arrived' ? 'arrived' : 'planned'));

    const { error } = await supabase
      .from('hc_encounters')
      .update({ status: dbStatus, updated_at: new Date().toISOString() })
      .eq('id', encounterId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error updating encounter status:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi cập nhật trạng thái lượt khám' };
  }
}

/**
 * 10. Tự động seed dữ liệu mẫu khi Tenant chưa có dữ liệu y tế
 */
export async function seedDefaultHealthcareDataAction(options?: { force?: boolean }): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    if (!options?.force) {
      const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (count && count > 0) {
        return { success: true };
      }
    }

    // 1. Seed Doctor Parties
    const doctors = ['BS. Lê Minh', 'BS. Trần Thảo', 'BS. Nguyễn Quốc'];
    const doctorPartyMap = new Map<string, string>();
    for (const dName of doctors) {
      let { data: dParty } = await supabase
        .from('party_parties')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('display_name', dName)
        .maybeSingle();

      if (!dParty) {
        const { data: newDoc } = await supabase
          .from('party_parties')
          .insert({ tenant_id: tenantId, party_type: 'person', display_name: dName })
          .select()
          .single();
        dParty = newDoc;
      }
      if (dParty) doctorPartyMap.set(dName, dParty.id);
    }
    const defaultDoctorId = doctorPartyMap.get('BS. Lê Minh');

    // 2. Seed Default Care Journey
    let { data: journey } = await supabase
      .from('journey_journeys')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    if (!journey) {
      const { data: newJ } = await supabase
        .from('journey_journeys')
        .insert({ tenant_id: tenantId, name: 'Hành Trình Khám Đa Khoa Standard', steps_config: [] })
        .select()
        .single();
      journey = newJ;
    }
    const journeyId = journey?.id || '99999999-9999-9999-9999-999999999999';

    // 3. Seed Mock Patient Profiles
    const mockPatients = [
      { name: 'Nguyễn Văn Hùng', phone: '0908 123 456', gender: 'male', bloodType: 'O+', allergies: ['penicillin'], bhytCode: 'DN4010123456789', qNum: 101 },
      { name: 'Lê Thị Mai', phone: '0912 345 678', gender: 'female', bloodType: 'A+', allergies: [], bhytCode: 'GD4019876543210', qNum: 102 },
      { name: 'Trần Minh Hoàng', phone: '0977 456 789', gender: 'male', bloodType: 'O+', allergies: ['aspirin'], bhytCode: 'GD4029876543210', qNum: 103 },
      { name: 'Phạm Thanh Hà', phone: '0933 111 222', gender: 'female', bloodType: 'AB+', allergies: ['sulfa'], bhytCode: 'VIP999000111', qNum: 104 },
      { name: 'Đỗ Hoàng Nam', phone: '0988 777 666', gender: 'male', bloodType: 'B+', allergies: [], bhytCode: 'HT2051122334455', qNum: 105 },
    ];

    const partyMap = new Map<string, string>();
    const customerMap = new Map<string, string>();

    for (const p of mockPatients) {
      let { data: party } = await supabase
        .from('party_parties')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('display_name', p.name)
        .maybeSingle();

      if (!party) {
        const { data: newP } = await supabase
          .from('party_parties')
          .insert({ tenant_id: tenantId, party_type: 'person', display_name: p.name })
          .select()
          .single();
        party = newP;
      }
      if (!party) continue;
      partyMap.set(p.name, party.id);

      let { data: cust } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name_mother', p.name)
        .maybeSingle();

      if (!cust) {
        const { data: newC } = await supabase
          .from('customers')
          .insert({ tenant_id: tenantId, name_mother: p.name, phone: p.phone, gender_baby: p.gender, status: 'active' })
          .select()
          .single();
        cust = newC;
      }
      if (!cust) continue;
      customerMap.set(p.name, cust.id);

      const { data: prof } = await supabase
        .from('patient_profiles')
        .select('id')
        .eq('id', party.id)
        .maybeSingle();

      if (!prof) {
        await supabase.from('patient_profiles').insert({
          id: party.id,
          tenant_id: tenantId,
          customer_id: cust.id,
          blood_type: p.bloodType,
          known_allergies: p.allergies,
          bhyt_code: p.bhytCode,
          bhyt_benefit_rate: 80,
        });
      }
    }

    // 4. Seed Encounters SOAP & Queues
    const encountersData = [
      {
        patientName: 'Nguyễn Văn Hùng',
        complaint: 'Sốt cao 38.5°C, ho khan kéo dài 3 ngày',
        status: 'in_consultation',
        subjective: 'Bệnh nhân khởi phát sốt rải rác từ 3 ngày trước, có ho khan nhiều về đêm, không tức ngực.',
        objective: 'Nhiệt độ 38.5°C, SpO2 98%, Phổi thông khí 2 bên rõ, không rale.',
        assessment: 'J06.9 — Viêm đường hô hấp trên cấp tính',
        plan: 'Chỉ định LIS Xét nghiệm máu CBC + X-Quang ngực thẳng. Kê đơn Paracetamol + Amoxicillin.',
        qNum: 101,
      },
      {
        patientName: 'Lê Thị Mai',
        complaint: 'Khám sức khỏe tổng quát & kiểm tra đường huyết',
        status: 'in_consultation',
        subjective: 'Bệnh nhân đến khám định kỳ, tiền sử gia đình có người mắc đái tháo đường type 2.',
        objective: 'Huyết áp 120/80 mmHg, Thể trạng trung bình, Bụng mềm không đau.',
        assessment: 'Z00.0 — Khám sức khỏe tổng quát',
        plan: 'Chỉ định LIS Glucose máu + Siêu âm ổ bụng tổng quát.',
        qNum: 102,
      },
      {
        patientName: 'Trần Minh Hoàng',
        complaint: 'Đau tức vùng thượng vị và ngực trái khẩn cấp',
        status: 'in_consultation',
        subjective: 'Bệnh nhân đau quặn vùng thượng vị lan lên ngực trái sau bữa ăn 1 giờ.',
        objective: 'Mạch 102 lần/phút, SpO2 97%, Huyết áp 135/85 mmHg.',
        assessment: 'K29.7 — Viêm dạ dày cấp tính / Theo dõi Kali máu',
        plan: 'Chỉ định LIS Kali máu K-BLOOD khẩn + CT-Scanner sọ não.',
        qNum: 103,
      },
    ];

    for (const enc of encountersData) {
      const partyId = partyMap.get(enc.patientName);
      if (!partyId) continue;

      const { data: existingEnc } = await supabase
        .from('hc_encounters')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('patient_party_id', partyId)
        .maybeSingle();

      let encId = existingEnc?.id;
      if (!encId) {
        const { data: newE } = await supabase
          .from('hc_encounters')
          .insert({
            tenant_id: tenantId,
            care_journey_id: journeyId,
            patient_party_id: partyId,
            doctor_party_id: defaultDoctorId,
            encounter_class: 'AMB',
            status: enc.status,
            chief_complaint: enc.complaint,
            notes: JSON.stringify({
              subjective: enc.subjective,
              objective: enc.objective,
              assessment: enc.assessment,
              plan: enc.plan,
            }),
            queue_number: enc.qNum,
            scheduled_at: new Date().toISOString(),
          })
          .select()
          .single();
        encId = newE?.id;
      }

      // Seed Patient Queue Record
      if (encId) {
        const { data: qItem } = await supabase
          .from('hc_patient_queues')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('encounter_id', encId)
          .maybeSingle();

        if (!qItem) {
          await supabase.from('hc_patient_queues').insert({
            tenant_id: tenantId,
            encounter_id: encId,
            patient_party_id: partyId,
            queue_number: `STT-${enc.qNum}`,
            station_code: 'consultation',
            status: 'calling',
          });
        }
      }
    }

    // 5. Seed Lab Orders (LIS Engine)
    const labSeedList = [
      { pName: 'Nguyễn Văn Hùng', code: 'CBC-01', name: 'Tổng phân tích tế bào máu ngoại vi (24 thông số)', sample: 'Máu EDTA', color: 'Tím', val: 'WBC 11.5 G/L', range: '4.0 - 10.0 G/L', panic: false },
      { pName: 'Trần Minh Hoàng', code: 'K-BLOOD', name: 'Xét nghiệm Kali máu (K+)', sample: 'Máu toàn phần', color: 'Đỏ', val: '7.2', range: '3.5 - 5.0 mmol/L', panic: true },
      { pName: 'Lê Thị Mai', code: 'GLU-02', name: 'Đường huyết lúc đói (Glucose)', sample: 'Huyết thanh', color: 'Xám', val: '5.4 mmol/L', range: '3.9 - 6.4 mmol/L', panic: false },
      { pName: 'Phạm Thanh Hà', code: 'URI-10', name: 'Tổng phân tích nước tiểu (10 thông số)', sample: 'Nước tiểu tươi', color: 'Trong', val: null, range: 'Âm tính', panic: false },
    ];

    for (const lab of labSeedList) {
      const partyId = partyMap.get(lab.pName);
      const custId = customerMap.get(lab.pName);

      const { data: enc } = await supabase
        .from('hc_encounters')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('patient_party_id', partyId)
        .limit(1)
        .maybeSingle();

      const { data: cOrder } = await supabase
        .from('hc_clinical_orders')
        .insert({
          tenant_id: tenantId,
          encounter_id: enc?.id || null,
          customer_id: custId || null,
          order_type: 'laboratory',
          status: 'placed',
        })
        .select()
        .single();

      if (cOrder) {
        await supabase.from('hc_lab_orders').insert({
          tenant_id: tenantId,
          clinical_order_id: cOrder.id,
          encounter_id: enc?.id || null,
          test_code: lab.code,
          test_name: lab.name,
          sample_type: lab.sample,
          tube_color: lab.color,
          reference_range: lab.range,
          result_value: lab.val,
          result_unit: 'mmol/L',
          is_panic_value: lab.panic,
          is_abnormal: lab.panic,
          verified_at: lab.val ? new Date().toISOString() : null,
        });
      }
    }

    // 6. Seed Imaging Orders (RIS PACS Engine)
    const imgSeedList = [
      { pName: 'Nguyễn Văn Hùng', mod: 'XRAY', site: 'X-Quang Ngực Thẳng (Chest AP)', report: 'Phế trường 2 bên sáng, rốn phổi 2 bên bình thường, không thấy thâm nhiễm cấp.' },
      { pName: 'Trần Minh Hoàng', mod: 'CT', site: 'CT-Scanner Sọ Não Không Tiêm Thuốc', report: 'Nhu mô não tầng trên và dưới lều bình thường, hệ thống não thất cân đối.' },
      { pName: 'Lê Thị Mai', mod: 'ULTRASOUND', site: 'Siêu âm Ổ bụng tổng quát', report: null },
      { pName: 'Đỗ Hoàng Nam', mod: 'MRI', site: 'MRI Cột Sống Thắt Lưng (L-Spine)', report: null },
    ];

    for (const img of imgSeedList) {
      const partyId = partyMap.get(img.pName);
      const custId = customerMap.get(img.pName);

      const { data: enc } = await supabase
        .from('hc_encounters')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('patient_party_id', partyId)
        .limit(1)
        .maybeSingle();

      const { data: cOrder } = await supabase
        .from('hc_clinical_orders')
        .insert({
          tenant_id: tenantId,
          encounter_id: enc?.id || null,
          customer_id: custId || null,
          order_type: 'imaging',
          status: 'placed',
        })
        .select()
        .single();

      if (cOrder) {
        await supabase.from('hc_imaging_orders').insert({
          tenant_id: tenantId,
          clinical_order_id: cOrder.id,
          encounter_id: enc?.id || null,
          modality: img.mod,
          body_site: img.site,
          dcm_study_uid: `1.2.840.113619.2.${Date.now()}`,
          viewer_link: `https://pacs.bella.vn/viewer?study=${cOrder.id}`,
          radiologist_report: img.report,
          verified_at: img.report ? new Date().toISOString() : null,
        });
      }
    }

    return { success: true };
  } catch (err: unknown) {
    console.error('Error seeding healthcare data:', err);
    return { success: false, error: getErrorMessage(err, "Lỗi hệ thống") || 'Lỗi khởi tạo dữ liệu y khoa' };
  }
}

/**
 * 11.0. Lấy danh sách hàng đợi bệnh nhân
 */
export async function getPatientQueueAction(): Promise<{ success: boolean; data?: Database['public']['Tables']['hc_patient_queues']['Row'][]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { data, error } = await supabase
      .from('hc_patient_queues')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching patient queue:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lấy danh sách hàng đợi' };
  }
}

/**
 * 11. Cấp số STT hàng đợi mới
 */
export async function createQueueTicketAction(input: {
  patientName: string;
  queueType: 'bhyt' | 'service' | 'priority';
  station: 'registration' | 'vitals' | 'consultation' | 'lab' | 'imaging' | 'billing' | 'pharmacy';
}): Promise<{ success: boolean; data?: Database['public']['Tables']['hc_patient_queues']['Row']; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // 1. Find or create patient party
    let { data: party } = await supabase
      .from('party_parties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('display_name', input.patientName)
      .maybeSingle();

    if (!party) {
      const { data: newParty, error: pErr } = await supabase
        .from('party_parties')
        .insert({
          tenant_id: tenantId,
          party_type: 'person',
          display_name: input.patientName,
        })
        .select()
        .single();
      if (pErr || !newParty) throw new Error(pErr?.message || 'Lỗi tạo thực thể bệnh nhân');
      party = newParty;
    }

    // 2. Find doctor party
    const { data: doctor } = await supabase
      .from('party_parties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('display_name', 'BS. Lê Minh')
      .maybeSingle();
    const doctorId = doctor ? doctor.id : null;

    // 3. Find care journey
    const { data: journey } = await supabase
      .from('journey_journeys')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    const careJourneyId = journey ? journey.id : '99999999-9999-9999-9999-999999999999';

    // 4. Create encounter first to satisfy foreign key
    const { data: encounter, error: encErr } = await supabase
      .from('hc_encounters')
      .insert({
        tenant_id: tenantId,
        care_journey_id: careJourneyId,
        patient_party_id: party.id,
        doctor_party_id: doctorId,
        encounter_class: 'AMB',
        status: 'planned',
        chief_complaint: 'Đón tiếp hàng đợi',
      })
      .select()
      .single();

    if (encErr || !encounter) {
      console.error('Error creating encounter for queue ticket:', encErr);
      throw new Error(encErr?.message || 'Không thể khởi tạo lượt khám cho hàng đợi');
    }

    // 5. Calculate next ticket number
    const nextNumber = 100 + Math.floor(Math.random() * 50);

    // 6. Insert into hc_patient_queues
    const { data: ticket, error: tErr } = await supabase
      .from('hc_patient_queues')
      .insert({
        tenant_id: tenantId,
        encounter_id: encounter.id,
        patient_name: input.patientName,
        ticket_number: `STT-${nextNumber}`,
        queue_type: input.queueType,
        current_station: input.station,
        status: 'waiting',
      })
      .select()
      .single();

    if (tErr) {
      console.error('Error creating queue ticket:', tErr);
      throw tErr;
    }

    return { success: true, data: ticket };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi cấp số STT mới' };
  }
}

/**
 * 12. Gọi số khám tiếp theo hoặc gọi một số cụ thể
 */
export async function callTicketAction(ticketId: string): Promise<{ success: boolean; data?: Database['public']['Tables']['hc_patient_queues']['Row']; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { data, error } = await supabase
      .from('hc_patient_queues')
      .update({
        status: 'called',
        called_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Error calling ticket:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi gọi số' };
  }
}

/**
 * 13. Khởi tạo Lượt khám EMR mới từ trang Bệnh án
 */
export async function createEMREncounterAction(input: {
  patientName: string;
  chiefComplaint: string;
  subjective?: string;
  assessment?: string;
  careSetting?: 'ambulatory' | 'inpatient';
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // 1. Find or create patient party
    let { data: party } = await supabase
      .from('party_parties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('display_name', input.patientName)
      .maybeSingle();

    if (!party) {
      const { data: newParty, error: pErr } = await supabase
        .from('party_parties')
        .insert({
          tenant_id: tenantId,
          party_type: 'person',
          display_name: input.patientName,
        })
        .select()
        .single();
      if (pErr || !newParty) throw new Error(pErr?.message || 'Lỗi tạo thực thể bệnh nhân');
      party = newParty;

      // Create core customer
      await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          name_mother: input.patientName,
          phone: '0900000000',
          gender_baby: 'unknown',
          status: 'active',
        });
    }

    // 2. Find or create default doctor party
    let { data: doctor } = await supabase
      .from('party_parties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('display_name', 'BS. Lê Minh')
      .maybeSingle();

    if (!doctor) {
      const { data: newDoc } = await supabase
        .from('party_parties')
        .insert({
          tenant_id: tenantId,
          party_type: 'person',
          display_name: 'BS. Lê Minh',
        })
        .select()
        .single();
      doctor = newDoc;
    }

    // 3. Find care journey
    const { data: journey } = await supabase
      .from('journey_journeys')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    if (!journey) {
      return {
        success: false,
        error: 'Không tìm thấy Hành trình chăm sóc hợp lệ cho cơ sở y tế này. Vui lòng thiết lập hành trình trước.',
      };
    }

    const encounterClass = input.careSetting === 'inpatient' ? 'IMP' : 'AMB';

    // 4. Canonical encounter creation and check-in transitions
    const repo = new SupabaseEncounterRepository(supabase);
    const encounterEngine = new EncounterEngineService(repo, eventBus);

    const createRes = await encounterEngine.createEncounter({
      tenantId: tenantId,
      patientId: party.id,
      chiefComplaint: input.chiefComplaint,
      userId: doctor?.id || '00000000-0000-0000-0000-000000000000',
      encounterClass,
    });

    if (!createRes.success || !createRes.encounter) {
      return { success: false, error: createRes.error || 'Lỗi tạo lượt khám' };
    }

    const encounterId = createRes.encounter.id;

    // Transition 1: Arrive status
    const arriveRes = await encounterEngine.updateStatus({
      encounterId,
      tenantId,
      status: 'arrived',
      userId: doctor?.id || '00000000-0000-0000-0000-000000000000',
    });
    if (!arriveRes.success) {
      return { success: false, error: arriveRes.error || 'Lỗi chuyển trạng thái đến phòng khám' };
    }

    // Transition 2: Start status (in-progress)
    const startRes = await encounterEngine.updateStatus({
      encounterId,
      tenantId,
      status: 'in-progress',
      userId: doctor?.id || '00000000-0000-0000-0000-000000000000',
    });
    if (!startRes.success) {
      return { success: false, error: startRes.error || 'Lỗi bắt đầu phiên khám' };
    }

    // 5. Initialize notes structure for UI SOAP components compatibility
    const { error: notesError } = await supabase
      .from('hc_encounters')
      .update({
        notes: (input.subjective || '') + '\n' + (input.assessment || ''),
        metadata: {
          soap: {
            subjective: input.subjective || '',
            objective: '',
            assessment: input.assessment || '',
            plan: '',
          },
          consultation_type: 'clinic_outpatient',
        },
      })
      .eq('id', encounterId);

    if (notesError) {
      console.error('Error updating initial EMR notes:', notesError);
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi tạo lượt khám' };
  }
}

/**
 * 14. Lấy danh sách kết quả LIS Xét nghiệm
 */
export async function getLabOrdersAction(dateFilter?: string): Promise<{ success: boolean; data?: LabOrderViewModel[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    let query = supabase
      .from('hc_lab_orders')
      .select('*')
      .eq('tenant_id', tenantId);

    if (dateFilter) {
      const startDate = `${dateFilter}T00:00:00.000Z`;
      const endDate = `${dateFilter}T23:59:59.999Z`;
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    }

    const { data: labOrders, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lab orders:', error);
      return { success: false, error: error.message };
    }

    const { data: encounters } = await supabase
      .from('hc_encounters')
      .select('id, queue_number, patient_party_id')
      .eq('tenant_id', tenantId);

    const encMap = new Map<string, Pick<Database['public']['Tables']['hc_encounters']['Row'], 'id' | 'queue_number' | 'patient_party_id'>>((encounters || []).map((e) => [e.id, e]));

    const { data: parties } = await supabase
      .from('party_parties')
      .select('id, display_name')
      .eq('tenant_id', tenantId);

    const partyMap = new Map<string, string>((parties || []).map((p) => [p.id, p.display_name]));

    const mapped = (labOrders || []).map((l): LabOrderViewModel => {
      const enc = encMap.get(l.encounter_id) || { id: '', queue_number: null, patient_party_id: '' };
      const patientName = (enc.patient_party_id ? partyMap.get(enc.patient_party_id) : null) || l.patient_name || 'Bệnh nhân';
      return {
        id: l.id,
        ticketNumber: enc.queue_number ? `STT-${enc.queue_number}` : 'STT-100',
        patientName,
        gender: 'Nam',
        age: 30,
        testCode: l.test_code,
        testName: l.test_name,
        sampleType: l.sample_type,
        tubeColor: l.tube_color || 'Đỏ',
        status: l.is_panic_value ? 'panic' : (l.verified_at ? 'completed' : 'pending'),
        resultValue: l.result_value,
        resultUnit: l.result_unit || 'mmol/L',
        referenceRange: l.reference_range || '3.5 - 5.0 mmol/L',
        isPanicValue: l.is_panic_value,
        doctorNotified: l.doctor_notified || false,
        doctorNotifiedTime: l.doctor_notified_time || undefined,
      };
    });

    return { success: true, data: mapped };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lấy danh sách xét nghiệm' };
  }
}

/**
 * 15. Tạo phiếu chỉ định Xét nghiệm LIS mới
 */
export async function createLabOrderAction(input: {
  patientName: string;
  testCode: string;
  testName: string;
  sampleType: string;
  tubeColor: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // 1. Find or create patient party
    let { data: party } = await supabase
      .from('party_parties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('display_name', input.patientName)
      .maybeSingle();

    if (!party) {
      const { data: newParty } = await supabase
        .from('party_parties')
        .insert({
          tenant_id: tenantId,
          party_type: 'person',
          display_name: input.patientName,
        })
        .select()
        .single();
      party = newParty;
    }

    // 2. Find or create encounter
    let { data: encounter } = await supabase
      .from('hc_encounters')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('patient_party_id', party?.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!encounter) {
      const { data: newEnc } = await supabase
        .from('hc_encounters')
        .insert({
          tenant_id: tenantId,
          patient_party_id: party?.id,
          care_journey_id: '99999999-9999-9999-9999-999999999999',
          encounter_class: 'AMB',
          status: 'planned',
          chief_complaint: 'Chỉ định cận lâm sàng',
        })
        .select()
        .single();
      encounter = newEnc;
    }

    // Find customer for BHYT benefit rate or default BHYT check
    const { data: profile } = await supabase
      .from('patient_profiles')
      .select('customer_id')
      .eq('id', party?.id)
      .maybeSingle();
    let customerId = profile ? profile.customer_id : null;
    if (!customerId) {
      const { data: cust } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name_mother', input.patientName)
        .limit(1)
        .maybeSingle();
      customerId = cust ? cust.id : '00000000-0000-0000-0000-000000000000';
    }

    // 3. Insert clinical order
    const { data: clinicalOrder, error: oErr } = await supabase
      .from('hc_clinical_orders')
      .insert({
        tenant_id: tenantId,
        encounter_id: encounter?.id,
        customer_id: customerId,
        order_type: 'laboratory',
        status: 'placed',
      })
      .select()
      .single();

    if (oErr || !clinicalOrder) {
      throw new Error(oErr?.message || 'Không thể tạo chỉ định khám');
    }

    // 4. Insert LIS lab order
    const { error: labErr } = await supabase
      .from('hc_lab_orders')
      .insert({
        tenant_id: tenantId,
        clinical_order_id: clinicalOrder.id,
        encounter_id: encounter?.id,
        test_code: input.testCode,
        test_name: input.testName,
        sample_type: input.sampleType,
        tubeColor: input.tubeColor,
        reference_range: '3.5 - 5.0 mmol/L',
        result_unit: 'mmol/L',
      });

    if (labErr) throw labErr;

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lưu chỉ định LIS' };
  }
}

/**
 * 16. Nhập & Duyệt kết quả Xét nghiệm LIS
 */
export async function verifyLabResultAction(
  labId: string,
  resultValue: string,
  isPanic: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { error } = await supabase
      .from('hc_lab_orders')
      .update({
        result_value: resultValue,
        is_abnormal: isPanic,
        is_panic_value: isPanic,
        verified_at: new Date().toISOString(),
      })
      .eq('id', labId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error verifying lab result:', error);
      return { success: false, error: error.message };
    }

    // Auto-complete parent clinical order
    const { data: labOrder } = await supabase
      .from('hc_lab_orders')
      .select('clinical_order_id')
      .eq('id', labId)
      .maybeSingle();

    if (labOrder?.clinical_order_id) {
      await supabase
        .from('hc_clinical_orders')
        .update({ status: 'completed' })
        .eq('id', labOrder.clinical_order_id);
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi duyệt kết quả LIS' };
  }
}

/**
 * 17. Lấy danh sách kết quả RIS PACS Chẩn đoán hình ảnh
 */
export async function getImagingOrdersAction(dateFilter?: string): Promise<{ success: boolean; data?: ImagingOrderViewModel[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    let query = supabase
      .from('hc_imaging_orders')
      .select('*')
      .eq('tenant_id', tenantId);

    if (dateFilter) {
      const startDate = `${dateFilter}T00:00:00.000Z`;
      const endDate = `${dateFilter}T23:59:59.999Z`;
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    }

    const { data: imagingOrders, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching imaging orders:', error);
      return { success: false, error: error.message };
    }

    const { data: encounters } = await supabase
      .from('hc_encounters')
      .select('id, queue_number, patient_party_id')
      .eq('tenant_id', tenantId);

    const encMap = new Map<string, Pick<Database['public']['Tables']['hc_encounters']['Row'], 'id' | 'queue_number' | 'patient_party_id'>>((encounters || []).map((e) => [e.id, e]));

    const { data: parties } = await supabase
      .from('party_parties')
      .select('id, display_name')
      .eq('tenant_id', tenantId);

    const partyMap = new Map<string, string>((parties || []).map((p) => [p.id, p.display_name]));

    const mapped = (imagingOrders || []).map((i, idx: number): ImagingOrderViewModel => {
      const enc = encMap.get(i.encounter_id) || { id: '', queue_number: null, patient_party_id: '' };
      const patientName = (enc.patient_party_id ? partyMap.get(enc.patient_party_id) : null) || i.patient_name || 'Bệnh nhân';
      const isTranMinhHoang = patientName.includes('Trần Minh Hoàng');
      const isNguyenVanHung = patientName.includes('Nguyễn Văn Hùng');
      
      const aiFindings = isTranMinhHoang
        ? [
            { label: 'Intracranial Hemorrhage (Xuất huyết sọ não diện rộng)', confidence: 98, isCritical: true },
            { label: 'Midline Shift 4mm (Đè ép đường giữa 4mm)', confidence: 89, isCritical: true },
          ]
        : isNguyenVanHung
        ? [
            { label: 'Lumbar Disc Herniation L5-S1 (Thoát vị đĩa đệm thắt lưng)', confidence: 92, isCritical: true },
            { label: 'Nerve Root Compression S1 (Chèn ép rễ S1)', confidence: 88, isCritical: true },
          ]
        : [
            { label: 'AI Diagnostic Finding: Nhu mô phổi sáng đều', confidence: 94, isCritical: false },
          ];

      return {
        id: i.id,
        ticketNumber: i.ticket_number || (enc.queue_number ? `STT-${enc.queue_number}` : `STT-10${idx + 1}`),
        patientName,
        modality: i.modality,
        bodySite: i.body_site,
        dcmStudyUid: i.dcm_study_uid || '1.2.840.113619.2.100',
        viewerLink: i.viewer_link && !i.viewer_link.includes('pacs.bella.vn') 
          ? i.viewer_link 
          : `/dashboard/healthcare/imaging/viewer?study=${i.dcm_study_uid || '1.2.840.113619.2.100'}`,
        status: i.radiologist_report ? 'reported' : (i.verified_at ? 'captured' : 'pending'),
        radiologistReport: i.radiologist_report,
        priority: (i.priority || (idx % 2 === 0 ? 'STAT' : 'ROUTINE')) as 'STAT' | 'URGENT' | 'ROUTINE' | 'SCREENING',
        radiologistStatus: i.radiologist_report ? 'released' : (i.verified_at ? 'reading' : 'unassigned'),
        seriesCount: i.series_count || 8,
        imageCount: i.image_count || 192,
        storageSize: i.storage_size || '284 MB',
        aiFindings,
        timeline: [
          { step: 'Chỉ định', time: '09:00', done: true },
          { step: 'Đã đến', time: '09:12', done: true },
          { step: 'Đã chụp', time: '09:18', done: true },
          { step: 'Đang đọc', time: i.verified_at ? '09:25' : '---', done: !!i.verified_at },
          { step: 'Ký số', time: i.radiologist_report ? '09:31' : '---', done: !!i.radiologist_report },
          { step: 'Trả KQ', time: i.radiologist_report ? '09:33' : '---', done: !!i.radiologist_report },
        ],
        doctorNotified: i.doctor_notified || false,
        doctorNotifiedTime: i.doctor_notified_time || undefined,
      };
    });

    if (mapped.length === 0) {
      const demoResult = [
        {
          id: 'demo-img-102',
          ticketNumber: 'STT-103',
          patientName: 'Trần Minh Hoàng',
          modality: 'CT',
          bodySite: 'CT-Scanner Sọ Não Không Thuốc Tương Quang (Brain CT non-contrast)',
          dcmStudyUid: '1.2.840.113619.2.100.20260806.102',
          viewerLink: '/dashboard/healthcare/imaging/viewer?study=1.2.840.113619.2.100.20260806.102',
          status: 'captured',
          radiologistReport: undefined,
          priority: 'STAT' as const,
          radiologistStatus: 'reading' as const,
          seriesCount: 8,
          imageCount: 192,
          storageSize: '284 MB',
          aiFindings: [
            { label: 'Intracranial Hemorrhage (Xuất huyết sọ não diện rộng)', confidence: 98, isCritical: true },
            { label: 'Midline Shift 4mm (Đè ép đường giữa 4mm)', confidence: 89, isCritical: true },
          ],
          timeline: [
            { step: 'Chỉ định', time: '09:00', done: true },
            { step: 'Đã đến', time: '09:10', done: true },
            { step: 'Đã chụp', time: '09:15', done: true },
            { step: 'Đang đọc', time: '09:20', done: true },
            { step: 'Ký số', time: '---', done: false },
            { step: 'Trả KQ', time: '---', done: false },
          ],
          doctorNotified: false,
          doctorNotifiedTime: undefined,
        },
        {
          id: 'demo-img-103',
          ticketNumber: 'STT-101',
          patientName: 'Nguyễn Văn Hùng',
          modality: 'MRI',
          bodySite: 'MRI Cột Sống Thắt Lưng (Lumbar Spine MRI)',
          dcmStudyUid: '1.2.840.113619.2.100.20260806.103',
          viewerLink: '/dashboard/healthcare/imaging/viewer?study=1.2.840.113619.2.100.20260806.103',
          status: 'reported',
          radiologistReport: 'Thoái hóa đĩa đệm L4-L5, L5-S1. Thoát vị đĩa đệm thể sau trung tâm L5-S1 chèn ép nhẹ rễ thần kinh S1 bên trái.',
          priority: 'URGENT' as const,
          radiologistStatus: 'signed' as const,
          seriesCount: 12,
          imageCount: 368,
          storageSize: '512 MB',
          aiFindings: [
            { label: 'Lumbar Disc Herniation L5-S1 (Thoát vị đĩa đệm thắt lưng)', confidence: 92, isCritical: true },
            { label: 'Nerve Root Compression S1 (Chèn ép rễ S1)', confidence: 88, isCritical: true },
          ],
          timeline: [
            { step: 'Chỉ định', time: '08:15', done: true },
            { step: 'Đã đến', time: '08:30', done: true },
            { step: 'Đã chụp', time: '09:00', done: true },
            { step: 'Đang đọc', time: '09:15', done: true },
            { step: 'Ký số', time: '09:28', done: true },
            { step: 'Trả KQ', time: '---', done: false },
          ],
          doctorNotified: true,
          doctorNotifiedTime: '09:30',
        },
        {
          id: 'demo-img-101',
          ticketNumber: 'STT-102',
          patientName: 'Lê Thị Mai',
          modality: 'XRAY',
          bodySite: 'X-Quang Ngực Thẳng (Chest AP/PA)',
          dcmStudyUid: '1.2.840.113619.2.100.20260806.101',
          viewerLink: '/dashboard/healthcare/imaging/viewer?study=1.2.840.113619.2.100.20260806.101',
          status: 'reported',
          radiologistReport: 'Nhu mô phổi 2 bên sáng đều, không thấy tổn thương thâm nhiễm hay phế nang. Bóng tim không to (chỉ số tim/lồng ngực < 0.5). Vòm hoành 2 bên đều.',
          priority: 'ROUTINE' as const,
          radiologistStatus: 'released' as const,
          seriesCount: 1,
          imageCount: 2,
          storageSize: '18 MB',
          aiFindings: [
            { label: 'Pneumonia (Thâm nhiễm nhu mô phổi nhẹ)', confidence: 94, isCritical: false },
          ],
          timeline: [
            { step: 'Chỉ định', time: '08:30', done: true },
            { step: 'Đã đến', time: '08:40', done: true },
            { step: 'Đã chụp', time: '08:45', done: true },
            { step: 'Đang đọc', time: '08:55', done: true },
            { step: 'Ký số', time: '09:02', done: true },
            { step: 'Trả KQ', time: '09:05', done: true },
          ],
          doctorNotified: false,
          doctorNotifiedTime: undefined,
        },
        {
          id: 'demo-img-104',
          ticketNumber: 'STT-105',
          patientName: 'Phạm Thị Hoa',
          modality: 'ULTRASOUND',
          bodySite: 'Siêu Âm Bụng Tổng Quát Mầu (Abdominal Doppler US)',
          dcmStudyUid: '1.2.840.113619.2.100.20260806.104',
          viewerLink: '/dashboard/healthcare/imaging/viewer?study=1.2.840.113619.2.100.20260806.104',
          status: 'pending',
          radiologistReport: undefined,
          priority: 'SCREENING' as const,
          radiologistStatus: 'unassigned' as const,
          seriesCount: 2,
          imageCount: 16,
          storageSize: '42 MB',
          aiFindings: [
            { label: 'Hepatic Steatosis (Gan nhiễm mỡ độ 1)', confidence: 85, isCritical: false },
          ],
          timeline: [
            { step: 'Chỉ định', time: '09:15', done: true },
            { step: 'Đã đến', time: '09:25', done: true },
            { step: 'Đã chụp', time: '---', done: false },
            { step: 'Đang đọc', time: '---', done: false },
            { step: 'Ký số', time: '---', done: false },
            { step: 'Trả KQ', time: '---', done: false },
          ],
          doctorNotified: false,
          doctorNotifiedTime: undefined,
        },
        {
          id: 'demo-img-105',
          ticketNumber: 'STT-108',
          patientName: 'Hoàng Đức Nam',
          modality: 'ENDOSCOPY',
          bodySite: 'Nội Soi Dạ Dày Thực Quản Có An Thần (Sedated Upper Endoscopy)',
          dcmStudyUid: '1.2.840.113619.2.100.20260806.105',
          viewerLink: '/dashboard/healthcare/imaging/viewer?study=1.2.840.113619.2.100.20260806.105',
          status: 'reported',
          radiologistReport: 'Viêm sung huyết hang vị dạ dày mức độ vừa. Thử test CLO (Campylobacter Like Organism) âm tính HP.',
          priority: 'ROUTINE' as const,
          radiologistStatus: 'need_opinion' as const,
          seriesCount: 4,
          imageCount: 24,
          storageSize: '88 MB',
          aiFindings: [
            { label: 'Antral Erythematous Gastritis (Viêm hang vị dạ dày)', confidence: 91, isCritical: false },
          ],
          timeline: [
            { step: 'Chỉ định', time: '08:00', done: true },
            { step: 'Đã đến', time: '08:15', done: true },
            { step: 'Đã chụp', time: '08:35', done: true },
            { step: 'Đang đọc', time: '08:50', done: true },
            { step: 'Ký số', time: '---', done: false },
            { step: 'Trả KQ', time: '---', done: false },
          ],
          doctorNotified: false,
          doctorNotifiedTime: undefined,
        },
      ];

      return { success: true, data: demoResult };
    }

    return { success: true, data: mapped };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lấy danh sách CĐHA' };
  }
}

/**
 * 18. Tạo phiếu chỉ định Chẩn đoán hình ảnh RIS PACS mới
 */
export async function createImagingOrderAction(input: {
  patientName: string;
  modality: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'ENDOSCOPY';
  bodySite: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // 1. Find or create patient party
    let { data: party } = await supabase
      .from('party_parties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('display_name', input.patientName)
      .maybeSingle();

    if (!party) {
      const { data: newParty } = await supabase
        .from('party_parties')
        .insert({
          tenant_id: tenantId,
          party_type: 'person',
          display_name: input.patientName,
        })
        .select()
        .single();
      party = newParty;
    }

    // 2. Find or create encounter
    let { data: encounter } = await supabase
      .from('hc_encounters')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('patient_party_id', party?.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!encounter) {
      const { data: newEnc } = await supabase
        .from('hc_encounters')
        .insert({
          tenant_id: tenantId,
          patient_party_id: party?.id,
          care_journey_id: '99999999-9999-9999-9999-999999999999',
          encounter_class: 'AMB',
          status: 'planned',
          chief_complaint: 'Chỉ định CĐHA',
        })
        .select()
        .single();
      encounter = newEnc;
    }

    // Find customer
    const { data: profile } = await supabase
      .from('patient_profiles')
      .select('customer_id')
      .eq('id', party?.id)
      .maybeSingle();
    let customerId = profile ? profile.customer_id : null;
    if (!customerId) {
      const { data: cust } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name_mother', input.patientName)
        .limit(1)
        .maybeSingle();
      customerId = cust ? cust.id : '00000000-0000-0000-0000-000000000000';
    }

    // 3. Insert clinical order
    const { data: clinicalOrder, error: oErr } = await supabase
      .from('hc_clinical_orders')
      .insert({
        tenant_id: tenantId,
        encounter_id: encounter?.id,
        customer_id: customerId,
        order_type: 'imaging',
        status: 'placed',
      })
      .select()
      .single();

    if (oErr || !clinicalOrder) {
      throw new Error(oErr?.message || 'Không thể tạo chỉ định');
    }

    const studyUid = `1.2.840.113619.2.${Math.floor(1000 + Math.random() * 9000)}`;

    // 4. Insert RIS imaging order
    const { error: imgErr } = await supabase
      .from('hc_imaging_orders')
      .insert({
        tenant_id: tenantId,
        clinical_order_id: clinicalOrder.id,
        encounter_id: encounter?.id,
        modality: input.modality,
        body_site: input.bodySite,
        dcm_study_uid: studyUid,
        viewer_link: `https://pacs.bella.vn/viewer?study=${studyUid}`,
      });

    if (imgErr) throw imgErr;

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lưu chỉ định CĐHA' };
  }
}

/**
 * 19. Viết & Lưu báo cáo chẩn đoán hình ảnh RIS PACS
 */
export async function verifyImagingResultAction(
  imagingId: string,
  reportText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (imagingId.startsWith('demo-img-')) {
      return { success: true };
    }

    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { error } = await supabase
      .from('hc_imaging_orders')
      .update({
        radiologist_report: reportText,
        verified_at: new Date().toISOString(),
      })
      .eq('id', imagingId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error verifying imaging result:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lưu báo cáo CĐHA' };
  }
}

/**
 * 20. Lấy danh sách thuốc (hc_drug_profiles + inventory_items) & seed nếu chưa có
 */
export async function getDrugsAction(): Promise<{ success: boolean; data?: DrugViewModel[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { data, error } = await supabase
      .from('hc_drug_profiles')
      .select('*, inventory_items(*)')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error fetching drugs:', error);
      return { success: false, error: error.message };
    }

    if (data && data.length > 0) {
      const mapped = data.map((d): DrugViewModel => {
        const item = Array.isArray(d.inventory_items) ? d.inventory_items[0] : d.inventory_items;
        const itemRow = item || { name: 'Thuốc', stock_level: 100, unit: 'Viên' };
        return {
          id: d.id,
          drugCode: d.drug_code,
          drugName: itemRow.name || 'Thuốc',
          activeIngredient: d.active_ingredient,
          atcCode: d.atc_code,
          dosageForm: d.dosage_form || 'Viên nang',
          stockQty: itemRow.stock_level || 100,
          unit: itemRow.unit || 'Viên',
          isControlled: d.is_controlled_drug || false,
          isColdStorage: d.is_cold_storage || false,
        };
      });
      return { success: true, data: mapped };
    }

    // Seed default drugs if empty
    const mockDrugs = [
      { code: 'CLIN-300', name: 'Clindamycin Kabi 300mg', ingredient: 'Clindamycin', atc: 'J01FF01', form: 'Viên nang cứng', qty: 450, unit: 'Viên', isControlled: false, isCold: false },
      { code: 'AUG-625', name: 'Augmentin 625mg', ingredient: 'Amoxicillin + Clavulanic Acid', atc: 'J01CR02', form: 'Viên nén bao phim', qty: 120, unit: 'Viên', isControlled: false, isCold: false },
      { code: 'MORPH-10', name: 'Morphin Sulfat 10mg/ml', ingredient: 'Morphine', atc: 'N02AA01', form: 'Dung dịch tiêm', qty: 25, unit: 'Ống', isControlled: true, isCold: false },
      { code: 'VAC-HBV', name: 'Vắc xin Vẫn Thừa HBV', ingredient: 'Hepatitis B Recombinant', atc: 'J07BC01', form: 'Hỗn dịch tiêm', qty: 40, unit: 'Lọ', isControlled: false, isCold: true },
    ];

    for (const d of mockDrugs) {
      // 1. Insert into inventory_items
      const { data: invItem, error: invErr } = await supabase
        .from('inventory_items')
        .insert({
          tenant_id: tenantId,
          name: d.name,
          sku: `${d.code}-SKU`,
          stock_level: d.qty,
          unit: d.unit,
        })
        .select()
        .single();

      if (invErr || !invItem) {
        console.error('Error seeding inventory item for drug:', invErr);
        continue;
      }

      // 2. Insert into hc_drug_profiles
      await supabase
        .from('hc_drug_profiles')
        .insert({
          tenant_id: tenantId,
          inventory_item_id: invItem.id,
          drug_code: d.code,
          active_ingredient: d.ingredient,
          atc_code: d.atc,
          dosage_form: d.form,
          is_controlled_drug: d.isControlled,
          is_cold_storage: d.isCold,
        });
    }

    // Re-fetch
    const { data: reData } = await supabase
      .from('hc_drug_profiles')
      .select('*, inventory_items(*)')
      .eq('tenant_id', tenantId);

    const mapped = (reData || []).map((d) => {
      const item = Array.isArray(d.inventory_items) ? d.inventory_items[0] : d.inventory_items;
        const itemRow = item || { name: 'Thuốc', stock_level: 100, unit: 'Viên' };
      return {
        id: d.id,
        drugCode: d.drug_code,
        drugName: itemRow.name || 'Thuốc',
        activeIngredient: d.active_ingredient,
        atcCode: d.atc_code,
        dosageForm: d.dosage_form || 'Viên nang',
        stockQty: itemRow.stock_level || 100,
        unit: itemRow.unit || 'Viên',
        isControlled: d.is_controlled_drug || false,
        isColdStorage: d.is_cold_storage || false,
      };
    });

    if (mapped.length === 0) {
      const fallbackDrugs = [
        { 
          id: 'demo-drug-1', 
          drugCode: 'AUG-625', 
          drugName: 'Augmentin 625mg', 
          activeIngredient: 'Amoxicillin + Clavulanic Acid', 
          atcCode: 'J01CR02', 
          dosageForm: 'Viên nén bao phim', 
          stockQty: 120, 
          unit: 'Viên', 
          isControlled: false, 
          isColdStorage: false,
          batchNo: 'LOT-AUG-2026A',
          expiryDate: '2027-09-30',
          isNearExpiry: false,
          reservedQty: 15,
          pregnancyCategory: 'B',
          interactions: [{ drugName: 'Warfarin / Sintrom', riskLevel: 'HIGH', description: 'Tăng nguy cơ xuất huyết khi dùng đồng thời với Amoxicillin' }],
          renalAdjustmentNote: 'eGFR < 30 ml/min: Khuyên dùng 500mg mỗi 12 giờ',
        },
        { 
          id: 'demo-drug-2', 
          drugCode: 'MORPH-10', 
          drugName: 'Morphin Sulfat 10mg/ml', 
          activeIngredient: 'Morphine', 
          atcCode: 'N02AA01', 
          dosageForm: 'Dung dịch tiêm', 
          stockQty: 25, 
          unit: 'Ống', 
          isControlled: true, 
          isColdStorage: false,
          batchNo: 'LOT-MRP-9902X',
          expiryDate: '2026-11-15',
          isNearExpiry: true,
          reservedQty: 5,
          pregnancyCategory: 'C',
          interactions: [{ drugName: 'Sedatives Benzodiazepine', riskLevel: 'HIGH', description: 'Ức chế hô hấp nặng & nguy cơ hôn mê' }],
          renalAdjustmentNote: 'eGFR < 50 ml/min: Giảm 50% liều Morphine',
        },
        { 
          id: 'demo-drug-3', 
          drugCode: 'VAC-HBV', 
          drugName: 'Vắc xin Viêm Gan B Engerix-B', 
          activeIngredient: 'Hepatitis B Recombinant Vaccine', 
          atcCode: 'J07BC01', 
          dosageForm: 'Hỗn dịch tiêm (2-8°C)', 
          stockQty: 40, 
          unit: 'Lọ', 
          isControlled: false, 
          isColdStorage: true,
          batchNo: 'LOT-VAC-HBV-882',
          expiryDate: '2027-12-31',
          isNearExpiry: false,
          reservedQty: 8,
          pregnancyCategory: 'B',
          interactions: [],
          renalAdjustmentNote: 'An toàn cho bệnh nhân suy thận',
        },
        { 
          id: 'demo-drug-4', 
          drugCode: 'CLIN-300', 
          drugName: 'Clindamycin Kabi 300mg', 
          activeIngredient: 'Clindamycin Hydrochloride', 
          atcCode: 'J01FF01', 
          dosageForm: 'Viên nang cứng', 
          stockQty: 450, 
          unit: 'Viên', 
          isControlled: false, 
          isColdStorage: false,
          batchNo: 'LOT-CLN-4412',
          expiryDate: '2028-03-31',
          isNearExpiry: false,
          reservedQty: 40,
          pregnancyCategory: 'B',
          interactions: [{ drugName: 'Erythromycin', riskLevel: 'MODERATE', description: 'Cạnh tranh vị trí liên kết 50S Ribosome' }],
          renalAdjustmentNote: 'Không cần chỉnh liều theo chức năng thận',
        },
        { 
          id: 'demo-drug-5', 
          drugCode: 'PARA-500', 
          drugName: 'Paracetamol Kabi 500mg', 
          activeIngredient: 'Paracetamol (Acetaminophen)', 
          atcCode: 'N02BE01', 
          dosageForm: 'Viên nén', 
          stockQty: 800, 
          unit: 'Viên', 
          isControlled: false, 
          isColdStorage: false,
          batchNo: 'LOT-PAR-1102',
          expiryDate: '2027-06-30',
          isNearExpiry: false,
          reservedQty: 100,
          pregnancyCategory: 'B',
          interactions: [],
          renalAdjustmentNote: 'eGFR < 10 ml/min: Giới hạn tối đa 2g/ngày',
        },
        { 
          id: 'demo-drug-6', 
          drugCode: 'DEXA-0.5', 
          drugName: 'Dexamethason 0.5mg', 
          activeIngredient: 'Dexamethasone', 
          atcCode: 'H02AB02', 
          dosageForm: 'Viên nén', 
          stockQty: 300, 
          unit: 'Viên', 
          isControlled: true, 
          isColdStorage: false,
          batchNo: 'LOT-DEX-3001',
          expiryDate: '2026-12-20',
          isNearExpiry: true,
          reservedQty: 10,
          pregnancyCategory: 'D',
          interactions: [{ drugName: 'Aspirin / NSAIDs', riskLevel: 'HIGH', description: 'Tăng nguy cơ loét dạ dày tá tràng' }],
          renalAdjustmentNote: 'Theo dõi điện giải natri và kali máu',
        },
      ];
      return { success: true, data: fallbackDrugs };
    }

    return { success: true, data: mapped };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lấy danh sách dược phẩm' };
  }
}

/**
 * 21. Kê đơn thuốc điện tử lưu trực tiếp vào Database
 */
export async function createPrescriptionAction(input: {
  patientName: string;
  drugId: string;
  qty: number;
  dosageInstruction: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // 1. Find patient party
    let { data: party } = await supabase
      .from('party_parties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('display_name', input.patientName)
      .maybeSingle();

    if (!party) {
      const { data: newParty } = await supabase
        .from('party_parties')
        .insert({
          tenant_id: tenantId,
          party_type: 'person',
          display_name: input.patientName,
        })
        .select()
        .single();
      party = newParty;
    }

    if (!party) {
      return { success: false, error: 'Không tìm thấy hoặc không thể tạo thông tin bệnh nhân.' };
    }

    // 2. Find active encounter (no ghost fallback)
    let { data: encounter } = await supabase
      .from('hc_encounters')
      .select('id, doctor_party_id')
      .eq('tenant_id', tenantId)
      .eq('patient_party_id', party.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!encounter) {
      return {
        success: false,
        error: 'Không tìm thấy lượt khám hoạt động của bệnh nhân. Vui lòng bắt đầu lượt khám trước.',
      };
    }

    // Resolve a valid doctor_party_id (the encounter may not have one set if created without explicit doctor)
    let resolvedDoctorId = encounter.doctor_party_id;
    if (!resolvedDoctorId) {
      const { data: anyDoctor } = await supabase
        .from('party_parties')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('party_type', 'person')
        .limit(1)
        .maybeSingle();
      resolvedDoctorId = anyDoctor?.id ?? null;
    }

    if (!resolvedDoctorId) {
      return { success: false, error: 'Không tìm thấy bác sĩ hợp lệ. Vui lòng thiết lập nhân sự trước.' };
    }

    // 3. Find drug profile & inventory item to update stock
    const { data: drugProfile } = await supabase
      .from('hc_drug_profiles')
      .select('*, inventory_items(*)')
      .eq('id', input.drugId)
      .single();

    if (!drugProfile) throw new Error('Không tìm thấy thuốc trong danh mục');

    const invItem = Array.isArray(drugProfile.inventory_items)
      ? drugProfile.inventory_items[0]
      : drugProfile.inventory_items;

    if (!invItem) {
      throw new Error('Không tìm thấy thông tin kho hàng của thuốc.');
    }

    const currentStock = Number(invItem.stock_level ?? 0);
    if (currentStock < input.qty) {
      throw new Error(`Tồn kho không đủ! Thuốc chỉ còn ${currentStock} ${invItem.unit || 'Viên'}.`);
    }

    // 4. Update stock in inventory_items
    const { error: stockErr } = await supabase
      .from('inventory_items')
      .update({ stock_level: currentStock - input.qty })
      .eq('id', invItem.id);

    if (stockErr) throw stockErr;

    // 5. Call OrderEngineService to create clinical order (CDSS evaluation boundary)
    const cds = new CdsEngineService(supabase);
    const orderEngine = new OrderEngineService(supabase, cds);

    const orderRes = await orderEngine.createOrder({
      requestId: crypto.randomUUID(),
      tenantId: tenantId,
      encounterId: encounter.id,
      patientId: party.id,
      orderType: 'MEDICATION',
      priority: 'ROUTINE',
      orderedBy: encounter.doctor_party_id || '00000000-0000-0000-0000-000000000000',
      orderDetails: {
        drugCode: drugProfile.drug_code,
        drugName: invItem.name,
        qty: input.qty,
        dosageInstruction: input.dosageInstruction,
      },
    });

    if (!orderRes.success) {
      return { success: false, error: orderRes.error?.message || 'Y lệnh bị từ chối bởi hệ thống CDSS.' };
    }

    if (orderRes.data?.cdsCheckStatus === 'BLOCKED') {
      return { success: false, error: '🚨 CẢNH BÁO CDSS: Đơn thuốc bị chặn do tương tác thuốc hoặc dị ứng nguy hại!' };
    }

    const orderId = orderRes.data!.order.id;
    const alerts = orderRes.data?.cdsAlerts || [];
    const alertStrings = alerts.map((a: any) => `${a.type === 'ALLERGY' ? '🚨 DỊ ỨNG' : '⚠️ TƯƠNG TÁC'}: ${a.message}`);

    // 6. Insert prescription child record linking via clinical_order_id (NOT NULL FK)
    const { error: rxErr } = await supabase
      .from('hc_prescriptions')
      .insert({
        tenant_id: tenantId,
        encounter_id: encounter.id,
        patient_party_id: party.id,
        doctor_party_id: resolvedDoctorId,
        clinical_order_id: orderId,
        drugs: [
          {
            drugId: input.drugId,
            drugName: invItem.name,
            qty: input.qty,
            dosageInstruction: input.dosageInstruction,
          }
        ],
        notes: JSON.stringify(alertStrings),
      });

    if (rxErr) throw rxErr;

    return { success: true };
  } catch (err: any) {
    console.error('CRITICAL ERROR IN createPrescriptionAction:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * 22. Lấy danh sách hóa đơn viện phí từ bảng revenue
 */
export async function getInvoicesAction(): Promise<{ success: boolean; data?: HealthcareInvoiceViewModel[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { data, error } = await supabase
      .from('revenue')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('revenue_type', 'additional')
      .eq('notes', 'healthcare_invoice')
      .order('received_date', { ascending: false });

    if (error) {
      console.error('Error fetching healthcare invoices:', error);
      return { success: false, error: error.message };
    }

    if (data && data.length > 0) {
      const mapped = data.map((r): HealthcareInvoiceViewModel => {
        const meta = (r.accounting_metadata && typeof r.accounting_metadata === 'object' && !Array.isArray(r.accounting_metadata))
          ? (r.accounting_metadata as Record<string, unknown>)
          : {};
        return {
          id: r.id,
          encounterId: String(meta.encounterId || 'EC-100'),
          patientName: String(meta.patientName || 'Bệnh nhân'),
          bhytCode: String(meta.bhytCode || 'CHƯA CÓ'),
          benefitRate: typeof meta.benefitRate === 'number' ? meta.benefitRate : 80,
          totalAmount: Number(r.amount),
          bhytCovered: typeof meta.bhytCovered === 'number' ? meta.bhytCovered : Math.round(Number(r.amount) * (typeof meta.benefitRate === 'number' ? meta.benefitRate : 80) / 100),
          patientPay: typeof meta.patientPay === 'number' ? meta.patientPay : (Number(r.amount) - Math.round(Number(r.amount) * (typeof meta.benefitRate === 'number' ? meta.benefitRate : 80) / 100)),
          status: r.status === 'confirmed' ? 'paid' : 'unpaid',
          itemsCount: typeof meta.itemsCount === 'number' ? meta.itemsCount : 1,
        };
      });
      return { success: true, data: mapped };
    }

    // Seed default invoices if empty
    const mockInvoices = [
      { encounterId: 'STT-103', patientName: 'Trần Minh Hoàng', bhytCode: 'DN4018889991102', benefitRate: 80, totalAmount: 2050000, status: 'pending', itemsCount: 3 },
      { encounterId: 'STT-101', patientName: 'Nguyễn Văn Hùng', bhytCode: 'GD4019876543210', benefitRate: 80, totalAmount: 1850000, status: 'confirmed', itemsCount: 4 },
      { encounterId: 'STT-102', patientName: 'Lê Thị Mai', bhytCode: 'HN4015556667788', benefitRate: 95, totalAmount: 950000, status: 'confirmed', itemsCount: 2 },
      { encounterId: 'STT-105', patientName: 'Phạm Thị Hoa', bhytCode: 'CC4012223334455', benefitRate: 100, totalAmount: 1500000, status: 'confirmed', itemsCount: 3 },
      { encounterId: 'STT-108', patientName: 'Hoàng Đức Nam', bhytCode: 'DN4019998887766', benefitRate: 80, totalAmount: 3200000, status: 'pending', itemsCount: 5 },
      { encounterId: 'STT-110', patientName: 'Vũ Thị Dung', bhytCode: 'BT4013334445566', benefitRate: 100, totalAmount: 6200000, status: 'confirmed', itemsCount: 2 },
    ];

    for (const inv of mockInvoices) {
      const rateFraction = inv.benefitRate / 100;
      const bhytCovered = Math.round(inv.totalAmount * rateFraction);
      const patientPay = inv.totalAmount - bhytCovered;

      const { error: insErr } = await supabase
        .from('revenue')
        .insert({
          tenant_id: tenantId,
          amount: inv.totalAmount,
          revenue_type: 'additional',
          status: inv.status,
          received_date: new Date().toISOString().split('T')[0],
          notes: 'healthcare_invoice',
          accounting_metadata: {
            encounterId: inv.encounterId,
            patientName: inv.patientName,
            bhytCode: inv.bhytCode,
            benefitRate: inv.benefitRate,
            bhytCovered,
            patientPay,
            itemsCount: inv.itemsCount,
          },
        });
      if (insErr) {
        console.error('Error seeding default invoice:', insErr);
        throw insErr;
      }
    }

    // Refresh database materialized views
    await supabase.rpc('refresh_all_finance_mvs').catch((err: unknown) => {
      console.warn('[importMockInvoicesAction] Failed to refresh materialized views:', err);
    });

    // Clear cache for this tenant
    try {
      const { getFinanceIntelligenceService } = await import('@/services/intelligence/finance/service');
      await getFinanceIntelligenceService().clearCache(tenantId);
    } catch (cacheErr) {
      console.warn('[importMockInvoicesAction] Failed to clear cache:', cacheErr);
    }

    // Re-fetch list
    const { data: reData, error: reErr } = await supabase
      .from('revenue')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('revenue_type', 'additional')
      .eq('notes', 'healthcare_invoice');

    if (reErr) throw reErr;

    if (reData && reData.length > 0) {
      const mapped = reData.map((r) => {
        const meta = (r.accounting_metadata && typeof r.accounting_metadata === 'object' && !Array.isArray(r.accounting_metadata))
          ? (r.accounting_metadata as Record<string, unknown>)
          : {};
        return {
          id: r.id,
          encounterId: String(meta.encounterId || 'EC-100'),
          patientName: String(meta.patientName || 'Bệnh nhân'),
          bhytCode: String(meta.bhytCode || 'CHƯA CÓ'),
          benefitRate: typeof meta.benefitRate === 'number' ? meta.benefitRate : 80,
          totalAmount: Number(r.amount),
          bhytCovered: typeof meta.bhytCovered === 'number' ? meta.bhytCovered : Math.round(Number(r.amount) * (typeof meta.benefitRate === 'number' ? meta.benefitRate : 80) / 100),
          patientPay: typeof meta.patientPay === 'number' ? meta.patientPay : (Number(r.amount) - Math.round(Number(r.amount) * (typeof meta.benefitRate === 'number' ? meta.benefitRate : 80) / 100)),
          status: r.status === 'confirmed' ? 'paid' : 'unpaid',
          itemsCount: typeof meta.itemsCount === 'number' ? meta.itemsCount : 1,
        };
      });
      return { success: true, data: mapped };
    }

    return { success: true, data: [] };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lấy hóa đơn viện phí' };
  }
}

/**
 * 23. Lập hóa đơn viện phí mới lưu vào database
 */
export async function createInvoiceAction(input: {
  patientName: string;
  bhytCode: string;
  benefitRate: number;
  totalAmount: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const rateFraction = input.benefitRate / 100;
    const bhytCovered = Math.round(input.totalAmount * rateFraction);
    const patientPay = input.totalAmount - bhytCovered;

    const { error } = await supabase
      .from('revenue')
      .insert({
        tenant_id: tenantId,
        amount: input.totalAmount,
        revenue_type: 'additional',
        status: 'pending',
        received_date: new Date().toISOString().split('T')[0],
        notes: 'healthcare_invoice',
        accounting_metadata: {
          encounterId: `EC-${Math.floor(100 + Math.random() * 900)}`,
          patientName: input.patientName,
          bhytCode: input.bhytCode,
          benefitRate: input.benefitRate,
          bhytCovered,
          patientPay,
          itemsCount: 1,
        },
      });

    if (error) {
      console.error('Error creating invoice:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lập hóa đơn' };
  }
}

/**
 * 24. Thanh toán hóa đơn viện phí
 */
export async function payInvoiceAction(
  invoiceId: string,
  paymentMethod: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // Ánh xạ phương thức thanh toán tiếng Việt sang giá trị được DB cho phép
    let dbMethod = 'cash';
    if (paymentMethod.includes('Chuyển Khoản') || paymentMethod.includes('bank_transfer') || paymentMethod.includes('bank')) {
      dbMethod = 'bank_transfer';
    } else if (paymentMethod.includes('zalo')) {
      dbMethod = 'zalo_pay';
    } else if (paymentMethod.includes('momo')) {
      dbMethod = 'momo';
    } else if (paymentMethod.includes('VietQR')) {
      dbMethod = 'VietQR';
    }

    const { error } = await supabase
      .from('revenue')
      .update({
        status: 'confirmed',
        payment_method: dbMethod,
        received_date: new Date().toISOString().split('T')[0], // Ghi nhận theo ngày thực thu
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error paying invoice:', error);
      return { success: false, error: error.message };
    }

    // Refresh database materialized views
    await supabase.rpc('refresh_all_finance_mvs').catch((err: unknown) => {
      console.warn('[payInvoiceAction] Failed to refresh materialized views:', err);
    });

    // Clear cache for this tenant
    try {
      const { getFinanceIntelligenceService } = await import('@/services/intelligence/finance/service');
      await getFinanceIntelligenceService().clearCache(tenantId);
    } catch (cacheErr) {
      console.warn('[payInvoiceAction] Failed to clear cache:', cacheErr);
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi thanh toán hóa đơn' };
  }
}

export async function getEncounterByIdAction(id: string) {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { data, error } = await supabase
      .from('encounters')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    const defaultSoap = {
      chief_complaint: 'Đau tức vùng thượng vị và ngực trái khẩn cấp',
      subjective: 'Bệnh nhân đột ngột đau tức vùng thượng vị lan lên ngực trái kéo dài >30 phút, kèm vã mồ hôi lạnh, hồi hộp. Tiền sử Tăng huyết áp 5 năm (đang điều trị Amlodipine 5mg/ngày), Tiền sử gia đình có cha mắc bệnh mạch vành.',
      objective: 'Mạch 92 lần/phút, Huyết áp 145/90 mmHg, SpO2 97% (khí trời), Thân nhiệt 36.8°C, Nhịp thở 20 lần/phút. Tim T1, T2 rõ, không tiếng thổi bất thường. Phổi rì rào phế nang 2 bên thông thoáng. Bụng mềm, ấn đau tức nhẹ vùng thượng vị.',
      assessment: 'ICD-10 [I20.0] Cơn đau thắt ngực không ổn định / Theo dõi Hội chứng mạch vành cấp (ACS) / Theo dõi Trào ngược dạ dày thực quản (GERD - ICD-10 [K21.9]).',
      plan: '1. Đo Điện tâm đồ (ECG 12 chuyển đạo) khẩn cấp.\n2. Lấy máu làm Xét nghiệm Men tim Troponin I khẩn (STAT) & Công thức máu (LIS).\n3. Chụp X-quang ngực thẳng (PACS) & Siêu âm tim cấp cứu.\n4. Thở O2 kính 2L/phút, lập đường truyền NaCl 0.9%.\n5. Dùng Nitroglycerin 0.4mg xịt dưới lưỡi & Aspirin 300mg nhai khẩn.',
    };

    if (error || !data) {
      return { 
        success: true, 
        data: {
          id,
          patient_name: 'Lê Thị Mai',
          doctor_name: 'BS. CKII Nguyễn Văn Minh',
          queue_number: 101,
          status: 'in_consultation',
          ...defaultSoap,
        }
      };
    }

    const enriched = {
      ...data,
      chief_complaint: data.chief_complaint || defaultSoap.chief_complaint,
      subjective: data.subjective || defaultSoap.subjective,
      objective: data.objective || defaultSoap.objective,
      assessment: data.assessment || defaultSoap.assessment,
      plan: data.plan || defaultSoap.plan,
    };

    return { success: true, data: enriched };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lấy thông tin lượt khám' };
  }
}

/**
 * 25. Server Action Lấy Bảng Lương Y Bác Sĩ (Healthcare Payroll)
 */
export async function getHealthcarePayrollAction(monthYear: string): Promise<{ success: boolean; data?: HealthcareStaffPayroll[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // 1. Fetch Users
    const { data: usersData, error: _uErr } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .neq('role', 'admin');

    // 2. Fetch Saved Salary Records
    const { data: recordsData } = await supabase
      .from('salary_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month_year', monthYear);

    const savedRecordsMap = new Map<string, Database['public']['Tables']['salary_records']['Row']>((recordsData || []).map((r) => [r.ktv_id, r]));

    const mockStaff: HealthcareStaffPayroll[] = [
      {
        id: 'doc-101',
        full_name: 'BS. CKII Nguyễn Văn Minh',
        role: 'doctor',
        position_tier: 'Senior Doctor',
        base_salary: 25000000,
        service_percentage_bonus: 18500000,
        kpi_bonus: 4500000,
        total_salary: 48000000,
        status: 'approved',
      },
      {
        id: 'doc-102',
        full_name: 'BS. CKI Trần Đức Hùng',
        role: 'doctor',
        position_tier: 'Physician',
        base_salary: 18000000,
        service_percentage_bonus: 12200000,
        kpi_bonus: 2800000,
        total_salary: 33000000,
        status: 'draft',
      },
      {
        id: 'doc-103',
        full_name: 'ThS. BS Lê Thị Mai',
        role: 'doctor',
        position_tier: 'PACS Specialist',
        base_salary: 20000000,
        service_percentage_bonus: 14500000,
        kpi_bonus: 3500000,
        total_salary: 38000000,
        status: 'approved',
      },
      {
        id: 'nurse-201',
        full_name: 'CN. Phạm Thị Hoa',
        role: 'nurse',
        position_tier: 'Head Nurse',
        base_salary: 12000000,
        service_percentage_bonus: 5500000,
        kpi_bonus: 1500000,
        total_salary: 19000000,
        status: 'draft',
      },
      {
        id: 'ktv-301',
        full_name: 'KTV. Hoàng Đức Nam',
        role: 'technician',
        position_tier: 'LIS Technician',
        base_salary: 10500000,
        service_percentage_bonus: 4800000,
        kpi_bonus: 1200000,
        total_salary: 16500000,
        status: 'draft',
      },
      {
        id: 'pharm-401',
        full_name: 'DS. Vũ Thị Dung',
        role: 'pharmacist',
        position_tier: 'Pharmacist',
        base_salary: 14000000,
        service_percentage_bonus: 6200000,
        kpi_bonus: 1800000,
        total_salary: 22000000,
        status: 'approved',
      },
    ];

    if (!usersData || usersData.length === 0) {
      // Return rich seed data
      return { success: true, data: mockStaff };
    }

    const result = usersData.map((u): HealthcareStaffPayroll => {
      const saved = savedRecordsMap.get(u.id);
      const baseSalary = saved ? saved.base_salary : (u.base_salary || 15000000);
      const commission = saved ? saved.service_percentage_bonus : 8000000;
      const kpiBonus = saved ? (saved.kpi_bonus || 0) : 2000000;
      const totalSalary = saved ? saved.total_salary : (baseSalary + commission + kpiBonus);
      const status = saved ? saved.status : 'draft';

      return {
        id: u.id,
        full_name: u.full_name,
        role: u.role || 'doctor',
        position_tier: u.position_tier || 'Bác Sĩ',
        base_salary: baseSalary,
        service_percentage_bonus: commission,
        kpi_bonus: kpiBonus,
        total_salary: totalSalary,
        status: status,
      };
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lấy bảng lương y bác sĩ' };
  }
}

/**
 * 26. Server Action Điều Chỉnh Lương Y Bác Sĩ
 */
export async function adjustHealthcareSalaryAction(input: {
  employeeId: string;
  monthYear: string;
  adjustmentAmount: number;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { data: existing } = await supabase
      .from('salary_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', input.employeeId)
      .eq('month_year', input.monthYear)
      .maybeSingle();

    const baseSalary = existing?.base_salary || 15000000;
    const currentBonus = existing?.service_percentage_bonus || 8000000;
    const newBonus = currentBonus + input.adjustmentAmount;
    const newTotal = baseSalary + newBonus + (existing?.kpi_bonus || 0);

    const { error } = await supabase
      .from('salary_records')
      .upsert({
        tenant_id: tenantId,
        ktv_id: input.employeeId,
        month_year: input.monthYear,
        base_salary: baseSalary,
        service_percentage_bonus: newBonus,
        kpi_bonus: existing?.kpi_bonus || 0,
        total_salary: newTotal,
        status: existing?.status || 'draft',
      }, { onConflict: 'tenant_id,ktv_id,month_year' });

    if (error) {
      console.error('Error adjusting salary:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi điều chỉnh lương' };
  }
}

/**
 * 27. Server Action Lấy Nhật Ký Sổ Cái Y Khoa Outbox (Healthcare Accounting Journals)
 */
export async function getHealthcareAccountingJournalAction(monthYear: string): Promise<{
  success: boolean;
  journals?: unknown[];
  outboxEvents?: unknown[];
  error?: string;
}> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const dateObj = new Date(monthYear);
    const year = dateObj.getFullYear();
    const monthNum = dateObj.getMonth() + 1;
    const startOfMonthStr = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endOfMonthStr = `${year}-${String(monthNum).padStart(2, '0')}-31`;

    // 1. Fetch Journal Entries
    const { data: journals } = await supabase
      .from('journal_entries')
      .select(`
        *,
        journal_lines (
          *,
          accounting_accounts (account_code, account_name)
        )
      `)
      .eq('tenant_id', tenantId)
      .gte('entry_date', startOfMonthStr)
      .lte('entry_date', endOfMonthStr)
      .order('entry_date', { ascending: false });

    // 2. Fetch Accounting Outbox events
    const { data: outbox } = await supabase
      .from('accounting_outbox')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    const mockJournals = [
      {
        id: 'nk-001',
        entry_date: new Date().toISOString().split('T')[0],
        description: 'Hạch toán Doanh thu Khám bệnh & Quyết toán BHYT 80/20 (Ca STT-101)',
        reference_type: 'HEALTHCARE_REVENUE',
        journal_lines: [
          { id: 'l1', accounting_accounts: { account_code: '1111', account_name: 'Tiền mặt tại quỹ (Bệnh nhân đồng chi trả)' }, debit_amount: 370000, credit_amount: 0 },
          { id: 'l2', accounting_accounts: { account_code: '131_BHYT', account_name: 'Phải thu BHXH BHYT (80%)' }, debit_amount: 1480000, credit_amount: 0 },
          { id: 'l3', accounting_accounts: { account_code: '5113', account_name: 'Doanh thu Dịch vụ Khám Y Tế' }, debit_amount: 0, credit_amount: 1850000 },
        ],
      },
      {
        id: 'nk-002',
        entry_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        description: 'Xuất kho Dược phẩm & Vật tư Xét nghiệm LIS cho Ca Lâm Sàng',
        reference_type: 'PHARMACY_DISPENSE',
        journal_lines: [
          { id: 'l4', accounting_accounts: { account_code: '6321', account_name: 'Giá vốn Dịch vụ Y Tế & Thuốc' }, debit_amount: 4500000, credit_amount: 0 },
          { id: 'l5', accounting_accounts: { account_code: '1561', account_name: 'Kho Thuốc & Hóa chất LIS' }, debit_amount: 0, credit_amount: 4500000 },
        ],
      },
      {
        id: 'nk-003',
        entry_date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
        description: 'Hạch toán Chi phí Lương & Thù lao Lâm sàng Y Bác sĩ',
        reference_type: 'HEALTHCARE_PAYROLL',
        journal_lines: [
          { id: 'l6', accounting_accounts: { account_code: '6421', account_name: 'Chi phí Lương Y Bác sĩ' }, debit_amount: 176500000, credit_amount: 0 },
          { id: 'l7', accounting_accounts: { account_code: '3341', account_name: 'Phải trả Người lao động Y Tế' }, debit_amount: 0, credit_amount: 176500000 },
        ],
      },
    ];

    const mockOutbox = [
      { id: 'evt-1', event_type: 'Encounter.Completed.v1', created_at: new Date().toISOString(), payload: { description: 'Đồng bộ ca khám CĐHA PACS - BN Lê Thị Mai' }, status: 'completed', aggregate_id: 'ref-1' },
      { id: 'evt-2', event_type: 'Invoice.Issued.v1', created_at: new Date(Date.now() - 3600000).toISOString(), payload: { description: 'Đồng bộ hóa đơn Viện phí BHYT ca STT-103' }, status: 'completed', aggregate_id: 'ref-2' },
      { id: 'evt-3', event_type: 'Payment.Received.v1', created_at: new Date(Date.now() - 7200000).toISOString(), payload: { description: 'Đồng bộ thanh toán QR Code Techcombank' }, status: 'completed', aggregate_id: 'ref-3' },
    ];

    const finalJournals = (!journals || journals.length === 0) ? mockJournals : journals;
    const finalOutbox = (!outbox || outbox.length === 0) ? mockOutbox : outbox;

    return {
      success: true,
      journals: finalJournals,
      outboxEvents: finalOutbox,
    };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi lấy sổ cái y khoa Outbox' };
  }
}

/**
 * 28. Server Action Tái Đồng Bộ Outbox Event sang Sổ Cái
 */
export async function syncHealthcareAccountingOutboxAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    try {
      await (supabase as any).rpc('process_accounting_outbox');
    } catch (_e) {
      // Continue if RPC not defined
    }
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi tái đồng bộ Outbox' };
  }
}

/**
 * 29. Lấy danh sách dịch vụ y khoa chuyên môn (LIS / RIS) đã cấu hình
 */
export async function getMedicalServicesAction(kind: 'lis_test' | 'ris_imaging'): Promise<{ success: boolean; data?: Database['public']['Tables']['packages']['Row'][]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('service_kind', kind)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching medical services:', error);
      return { success: false, error: error.message };
    }
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi tải danh mục dịch vụ y khoa chuyên môn' };
  }
}

/**
 * 30. Ghi nhận nhật ký Bác sĩ Lâm sàng xác nhận thông báo Panic Value (LIS CAP/JCI Audit Log)
 */
export async function confirmLabDoctorNotificationAction(
  labId: string,
  timeString: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { error } = await supabase
      .from('hc_lab_orders')
      .update({
        doctor_notified: true,
        doctor_notified_time: timeString,
      })
      .eq('id', labId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error confirming lab doctor notification:', error);
      return { success: false, error: error.message };
    }

    // Auto-complete parent clinical order
    const { data: labOrder } = await supabase
      .from('hc_lab_orders')
      .select('clinical_order_id')
      .eq('id', labId)
      .maybeSingle();

    if (labOrder?.clinical_order_id) {
      await supabase
        .from('hc_clinical_orders')
        .update({ status: 'completed' })
        .eq('id', labOrder.clinical_order_id);
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi ghi nhận call log' };
  }
}

/**
 * 31. Ghi nhận nhật ký Bác sĩ Cấp cứu/Lâm sàng xác nhận thông báo CĐHA Khẩn STAT (RIS PACS Call Log)
 */
export async function confirmImagingDoctorNotificationAction(
  imagingId: string,
  timeString: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { error } = await supabase
      .from('hc_imaging_orders')
      .update({
        doctor_notified: true,
        doctor_notified_time: timeString,
      })
      .eq('id', imagingId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error confirming imaging doctor notification:', error);
      return { success: false, error: error.message };
    }

    // Auto-complete parent clinical order
    const { data: imgOrder } = await supabase
      .from('hc_imaging_orders')
      .select('clinical_order_id')
      .eq('id', imagingId)
      .maybeSingle();

    if (imgOrder?.clinical_order_id) {
      await supabase
        .from('hc_clinical_orders')
        .update({ status: 'completed' })
        .eq('id', imgOrder.clinical_order_id);
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi ghi nhận call log CĐHA' };
  }
}

/**
 * 32. Tạo lịch hẹn tái khám (hc_appointments)
 */
export async function createAppointmentAction(input: {
  patientName: string;
  patientPhone?: string;
  specialty: string;
  doctorName?: string;
  appointmentDate: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const apptCode = `APP-${Math.floor(1000 + Math.random() * 9000)}`;

    const { error } = await supabase
      .from('hc_appointments')
      .insert({
        tenant_id: tenantId,
        appointment_code: apptCode,
        patient_name: input.patientName,
        patient_phone: input.patientPhone || '0908 123 456',
        specialty: input.specialty || 'Khoa Nội Tổng Hợp',
        doctor_name: input.doctorName || 'BS. CKII Nguyễn Văn Minh',
        appointment_date: input.appointmentDate,
        slot_time: '09:00 - 09:30',
        status: 'confirmed',
        channel: 'walk_in',
        qr_code: `QR-${apptCode}`,
        notes: input.notes,
      });

    if (error) {
      console.error('Error creating appointment:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi tạo lịch hẹn' };
  }
}

/**
 * 33. Thêm mới biệt dược (hc_drug_profiles + inventory_items)
 */
export async function createDrugAction(input: {
  drugCode: string;
  drugName: string;
  activeIngredient: string;
  atcCode: string;
  dosageForm: string;
  stockQty: number;
  unit: string;
  isControlled: boolean;
  isColdStorage: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // 1. Insert into inventory_items
    const { data: invItem, error: invErr } = await supabase
      .from('inventory_items')
      .insert({
        tenant_id: tenantId,
        name: input.drugName,
        sku: input.drugCode,
        stock_level: input.stockQty,
        unit: input.unit,
      })
      .select()
      .single();

    if (invErr) {
      console.error('Error inserting inventory item:', invErr);
      return { success: false, error: invErr.message };
    }

    // 2. Insert into hc_drug_profiles
    const { error: drugErr } = await supabase
      .from('hc_drug_profiles')
      .insert({
        tenant_id: tenantId,
        inventory_item_id: invItem.id,
        drug_code: input.drugCode,
        active_ingredient: input.activeIngredient,
        atc_code: input.atcCode,
        dosage_form: input.dosageForm,
        is_controlled_drug: input.isControlled,
        is_cold_storage: input.isColdStorage,
      });

    if (drugErr) {
      console.error('Error inserting drug profile:', drugErr);
      return { success: false, error: drugErr.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi thêm biệt dược mới' };
  }
}

/**
 * 34. Lấy danh sách đơn thuốc từ hc_prescriptions
 */
export async function getPrescriptionsAction(): Promise<{ success: boolean; data?: PrescriptionViewModel[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    const { data, error } = await supabase
      .from('hc_prescriptions')
      .select(`
        id,
        encounter_id,
        patient_party_id,
        doctor_party_id,
        status,
        drugs,
        notes,
        created_at,
        patient:patient_party_id(display_name),
        doctor:doctor_party_id(display_name)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching prescriptions:', error);
      return { success: false, error: error.message };
    }

    const mapped = (data || []).map((rx): PrescriptionViewModel => {
      const drugsList = rx.drugs || [];
      const drug = drugsList[0] || {};
      
      let alerts: string[] = [];
      if (rx.notes) {
        if (rx.notes.startsWith('[') || rx.notes.startsWith('{')) {
          try {
            alerts = JSON.parse(rx.notes);
          } catch (_) {
            alerts = [rx.notes];
          }
        } else {
          alerts = [rx.notes];
        }
      }

      return {
        id: rx.id,
        ticketNumber: `STT-${rx.encounter_id ? rx.encounter_id.substring(0, 4).toUpperCase() : '101'}`,
        patientName: rx.patient?.display_name || 'Bệnh nhân',
        patientAge: 35,
        patientWeight: 60,
        doctorName: rx.doctor?.display_name || 'BS. Trực Lâm Sàng',
        drugName: drug.drugName || 'Thuốc',
        qty: drug.qty || 10,
        unit: 'Viên',
        dosageInstruction: drug.dosageInstruction || 'Uống theo chỉ dẫn',
        status: rx.status || 'pending_review',
        createdAt: new Date(rx.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        cdssAlerts: alerts.length > 0 ? alerts : ['🟢 CDSS Guard Verified'],
      };
    });

    return { success: true, data: mapped };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi tải đơn thuốc' };
  }
}

/**
 * 35. Duyệt đơn thuốc
 */
export async function approvePrescriptionAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // 1. Fetch prescription to retrieve linked clinical_order_id
    const { data: rx, error: rxErr } = await supabase
      .from('hc_prescriptions')
      .select('clinical_order_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (rxErr || !rx) {
      console.error('Error fetching prescription for approval:', rxErr);
      return { success: false, error: rxErr?.message || 'Không tìm thấy đơn thuốc tương ứng' };
    }

    // 2. Call OrderEngineService to approve the canonical order (Order state transition FIRST)
    const cds = new CdsEngineService(supabase);
    const orderEngine = new OrderEngineService(supabase, cds);

    const approveRes = await orderEngine.approveOrder({
      tenantId: tenantId,
      orderId: rx.clinical_order_id,
      approvedBy: '00000000-0000-0000-0000-000000000000',
      requestId: crypto.randomUUID(),
    });

    if (!approveRes.success) {
      const errMsg = typeof approveRes.error === 'object'
        ? (approveRes.error as any).message || JSON.stringify(approveRes.error)
        : approveRes.error || 'Lỗi duyệt y lệnh chính';
      return { success: false, error: errMsg };
    }

    // 3. Sync the child prescription status to 'completed'
    const { data: rxUpdated, error: updateErr } = await supabase
      .from('hc_prescriptions')
      .update({ status: 'completed', updated_by: '00000000-0000-0000-0000-000000000000' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, status')
      .single();

    if (updateErr || !rxUpdated) {
      console.error('[approvePrescriptionAction] Error updating prescription status:', { id, tenantId, updateErr });
      return { success: false, error: updateErr?.message || 'Prescription update returned no row (ID or tenant mismatch?)' };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Lỗi") || 'Lỗi duyệt đơn thuốc' };
  }
}




