'use server';

import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';
import { 
  PatientProfile, 
  Encounter, 
  ClinicalOrder, 
  LabOrderItem, 
  ImagingOrderItem, 
  PrescriptionItem,
  PatientJourneyQueueItem 
} from '@/types/healthcare';
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
    const supabase = (await createDevelopmentBypassClient()) as any;
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
  } catch (err) {
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
    const supabase = (await createDevelopmentBypassClient()) as any;
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
    const msg = err instanceof Error ? err.message : 'Lỗi chuyển đổi sản phẩm';
    return { success: false, error: msg };
  }
}

/**
 * 1. Bệnh nhân (Patient Profiles) Server Actions
 */
export async function getOrCreatePatientProfileAction(customerId: string): Promise<{ success: boolean; data?: PatientProfile; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
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
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi hệ thống khi tạo Hồ sơ bệnh nhân' };
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
}): Promise<{ success: boolean; data?: Encounter; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
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

    // Insert Encounter Record
    const { data: encounter, error: encError } = await supabase
      .from('hc_encounters')
      .insert({
        tenant_id: tenantId,
        patient_id: patientProfile.id,
        customer_id: input.customerId,
        practitioner_id: input.practitionerId || null,
        facility_id: input.facilityId || null,
        status: 'in_consultation',
        priority: input.priority || 'routine',
        chief_complaint: input.chiefComplaint || '',
        subjective_notes: '',
        objective_notes: '',
        assessment_notes: '',
        plan_notes: '',
        vitals: {},
        diagnoses: [],
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
      details: domainEvent as any
    });

    return { success: true, data: encounter as Encounter };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi tạo lượt khám' };
  }
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
  vitals?: Record<string, any>;
  diagnoses?: Array<{ code: string; name: string; isPrimary: boolean }>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
    const tenantId = await getTenantIdOrThrow();

    const { error: updateError } = await supabase
      .from('hc_encounters')
      .update({
        chief_complaint: input.soap.chiefComplaint,
        subjective_notes: input.soap.subjective,
        objective_notes: input.soap.objective,
        assessment_notes: input.soap.assessment,
        plan_notes: input.soap.plan,
        vitals: input.vitals || {},
        diagnoses: input.diagnoses || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', input.encounterId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('Error updating SOAP notes:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi cập nhật SOAP' };
  }
}

/**
 * 4. Hoàn tất Lượt khám y tế (Guard Invariant Check: Không đóng khi Y lệnh chưa xong)
 */
export async function completeEncounterAction(encounterId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
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

    // Close Encounter
    const { data: encounter, error: updateError } = await supabase
      .from('hc_encounters')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', encounterId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError || !encounter) {
      return { success: false, error: updateError?.message || 'Lỗi hoàn tất lượt khám' };
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
        encounterId: encounter.id,
        patientId: encounter.patient_id,
        completedAt: encounter.completed_at
      }
    );

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action: 'HEALTHCARE_EVENT_EMITTED',
      details: domainEvent as any
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi hoàn tất lượt khám' };
  }
}


/**
 * 6. Lấy toàn bộ danh sách bệnh nhân (Patient Profiles + Core Customers)
 */
export async function getAllPatientProfilesAction(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
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

    const custMap = new Map((customers || []).map((c: any) => [c.id, c]));

    // Map to PatientInfo ViewModel structure
    const mapped = (profiles || []).map((p: any) => {
      const cust = custMap.get(p.customer_id) || {};
      return {
        id: p.id,
        recordNumber: p.bhyt_code || `BN-${p.id?.substring(0, 6).toUpperCase() || 'NEW'}`,
        name: cust.name_mother || 'Chưa rõ',
        gender: cust.gender_baby === 'female' ? 'female' : 'male',
        dob: cust.dob_baby || '1995-10-12',
        age: 30, // Default age fallback
        bloodType: p.blood_type || 'O+',
        allergies: Array.isArray(p.known_allergies) ? p.known_allergies : [],
        phone: cust.phone || '',
        bhytCode: p.bhyt_code,
        bhytBenefitRate: p.bhyt_benefit_rate,
        toothData: {},
      };
    });

    return { success: true, data: mapped };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lấy hồ sơ bệnh nhân' };
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
    const supabase = (await createDevelopmentBypassClient()) as any;
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
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi thêm mới bệnh nhân' };
  }
}

/**
 * 8. Lấy toàn bộ danh sách lượt khám (hc_encounters + customers + patient_profiles)
 */
export async function getAllEncountersAction(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
    const tenantId = await getTenantIdOrThrow();

    const { data: encounters, error } = await supabase
      .from('hc_encounters')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching encounters:', error);
      return { success: false, error: error.message };
    }

    const { data: parties } = await supabase
      .from('party_parties')
      .select('id, display_name')
      .eq('tenant_id', tenantId);

    const partyMap = new Map((parties || []).map((p: any) => [p.id, p.display_name]));

    const prioritiesList: Array<'emergency' | 'high' | 'routine'> = ['high', 'routine', 'emergency', 'routine', 'routine'];
    const waitTimesList = [22, 12, 5, 14, 8];

    const mapped = (encounters || []).map((e: any, idx: number) => {
      const patientName = partyMap.get(e.patient_party_id) || 'Bệnh nhân';

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

      return {
        id: e.id,
        patientName,
        doctorName: 'BS. Lê Minh',
        status: mappedStatus,
        chiefComplaint: e.chief_complaint || 'Khám lâm sàng',
        queueNumber: e.queue_number || (101 + idx),
        scheduledAt: e.scheduled_at,
        priority: prioritiesList[idx % prioritiesList.length],
        waitTimeMinutes: waitTimesList[idx % waitTimesList.length],
        subjective: e.subjective_notes,
        objective: e.objective_notes,
        assessment: e.assessment_notes,
        plan: e.plan_notes,
      };
    });

    return { success: true, data: mapped };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lấy lượt khám' };
  }
}

/**
 * 9. Cập nhật trạng thái lượt khám trong Database
 */
export async function updateEncounterStatusAction(encounterId: string, newStatus: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
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
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi cập nhật trạng thái lượt khám' };
  }
}

/**
 * 10. Tự động seed dữ liệu mẫu khi Tenant chưa có dữ liệu y tế
 */
export async function seedDefaultHealthcareDataAction(options?: { force?: boolean }): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
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

      let { data: prof } = await supabase
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

      let { data: existingEnc } = await supabase
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
            encounter_class: 'walk_in',
            status: enc.status,
            chief_complaint: enc.complaint,
            subjective_notes: enc.subjective,
            objective_notes: enc.objective,
            assessment_notes: enc.assessment,
            plan_notes: enc.plan,
            queue_number: enc.qNum,
            scheduled_at: new Date().toISOString(),
          })
          .select()
          .single();
        encId = newE?.id;
      }

      // Seed Patient Queue Record
      if (encId) {
        let { data: qItem } = await supabase
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

      let { data: enc } = await supabase
        .from('hc_encounters')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('patient_party_id', partyId)
        .limit(1)
        .maybeSingle();

      let { data: cOrder } = await supabase
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

      let { data: enc } = await supabase
        .from('hc_encounters')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('patient_party_id', partyId)
        .limit(1)
        .maybeSingle();

      let { data: cOrder } = await supabase
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
  } catch (err: any) {
    console.error('Error seeding healthcare data:', err);
    return { success: false, error: err.message || 'Lỗi khởi tạo dữ liệu y khoa' };
  }
}

/**
 * 11.0. Lấy danh sách hàng đợi bệnh nhân
 */
export async function getPatientQueueAction(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
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
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lấy danh sách hàng đợi' };
  }
}

/**
 * 11. Cấp số STT hàng đợi mới
 */
export async function createQueueTicketAction(input: {
  patientName: string;
  queueType: 'bhyt' | 'service' | 'priority';
  station: 'registration' | 'vitals' | 'consultation' | 'lab' | 'imaging' | 'billing' | 'pharmacy';
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
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
        encounter_class: 'walk_in',
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
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi cấp số STT mới' };
  }
}

/**
 * 12. Gọi số khám tiếp theo hoặc gọi một số cụ thể
 */
export async function callTicketAction(ticketId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
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
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi gọi số' };
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
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
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
    const careJourneyId = journey ? journey.id : '99999999-9999-9999-9999-999999999999';

    // 4. Insert Encounter Record
    const { error: encError } = await supabase
      .from('hc_encounters')
      .insert({
        tenant_id: tenantId,
        care_journey_id: careJourneyId,
        patient_party_id: party.id,
        doctor_party_id: doctor ? doctor.id : null,
        encounter_class: 'walk_in',
        status: 'in_consultation',
        chief_complaint: input.chiefComplaint,
        subjective_notes: input.subjective || '',
        assessment_notes: input.assessment || '',
      });

    if (encError) {
      console.error('Error creating EMR encounter:', encError);
      return { success: false, error: encError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi tạo lượt khám' };
  }
}

/**
 * 14. Lấy danh sách kết quả LIS Xét nghiệm
 */
export async function getLabOrdersAction(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
    const tenantId = await getTenantIdOrThrow();

    const { data: labOrders, error } = await supabase
      .from('hc_lab_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lab orders:', error);
      return { success: false, error: error.message };
    }

    const { data: encounters } = await supabase
      .from('hc_encounters')
      .select('id, queue_number, patient_party_id')
      .eq('tenant_id', tenantId);

    const encMap = new Map((encounters || []).map((e: any) => [e.id, e]));

    const { data: parties } = await supabase
      .from('party_parties')
      .select('id, display_name')
      .eq('tenant_id', tenantId);

    const partyMap = new Map((parties || []).map((p: any) => [p.id, p.display_name]));

    const mapped = (labOrders || []).map((l: any) => {
      const enc = encMap.get(l.encounter_id) || {};
      const patientName = partyMap.get(enc.patient_party_id) || l.patient_name || 'Bệnh nhân';
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
      };
    });

    return { success: true, data: mapped };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lấy danh sách xét nghiệm' };
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
    const supabase = (await createDevelopmentBypassClient()) as any;
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
          encounter_class: 'walk_in',
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
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lưu chỉ định LIS' };
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
    const supabase = (await createDevelopmentBypassClient()) as any;
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

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi duyệt kết quả LIS' };
  }
}

/**
 * 17. Lấy danh sách kết quả RIS PACS Chẩn đoán hình ảnh
 */
export async function getImagingOrdersAction(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
    const tenantId = await getTenantIdOrThrow();

    const { data: imagingOrders, error } = await supabase
      .from('hc_imaging_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching imaging orders:', error);
      return { success: false, error: error.message };
    }

    const { data: encounters } = await supabase
      .from('hc_encounters')
      .select('id, queue_number, patient_party_id')
      .eq('tenant_id', tenantId);

    const encMap = new Map((encounters || []).map((e: any) => [e.id, e]));

    const { data: parties } = await supabase
      .from('party_parties')
      .select('id, display_name')
      .eq('tenant_id', tenantId);

    const partyMap = new Map((parties || []).map((p: any) => [p.id, p.display_name]));

    const mapped = (imagingOrders || []).map((i: any) => {
      const enc = encMap.get(i.encounter_id) || {};
      const patientName = partyMap.get(enc.patient_party_id) || i.patient_name || 'Bệnh nhân';
      return {
        id: i.id,
        ticketNumber: enc.queue_number ? `STT-${enc.queue_number}` : 'STT-100',
        patientName,
        modality: i.modality,
        bodySite: i.body_site,
        dcmStudyUid: i.dcm_study_uid || '1.2.840.113619.2.100',
        viewerLink: i.viewer_link || `https://pacs.bella.vn/viewer?study=${i.dcm_study_uid || '1.2.840.113619.2.100'}`,
        status: i.radiologist_report ? 'reported' : (i.verified_at ? 'captured' : 'pending'),
        radiologistReport: i.radiologist_report,
      };
    });

    if (mapped.length === 0) {
      const demoSeedOrders = [
        {
          tenant_id: tenantId,
          modality: 'XRAY',
          body_site: 'X-Quang Ngực Thẳng (Chest AP/PA)',
          dcm_study_uid: '1.2.840.113619.2.100.20260806.101',
          viewer_link: 'https://pacs.bella.vn/viewer?study=1.2.840.113619.2.100.20260806.101',
          radiologist_report: 'Nhu mô phổi 2 bên sáng đều, không thấy tổn thương thâm nhiễm hay phế nang. Bóng tim không to (chỉ số tim/lồng ngực < 0.5). Vòm hoành 2 bên đều.',
          verified_at: new Date().toISOString(),
        },
        {
          tenant_id: tenantId,
          modality: 'CT',
          body_site: 'CT-Scanner Sọ Não Không Thuốc Tương Quang (Brain CT non-contrast)',
          dcm_study_uid: '1.2.840.113619.2.100.20260806.102',
          viewer_link: 'https://pacs.bella.vn/viewer?study=1.2.840.113619.2.100.20260806.102',
          radiologist_report: null,
          verified_at: new Date().toISOString(),
        },
        {
          tenant_id: tenantId,
          modality: 'MRI',
          body_site: 'MRI Cột Sống Thắt Lưng (Lumbar Spine MRI)',
          dcm_study_uid: '1.2.840.113619.2.100.20260806.103',
          viewer_link: 'https://pacs.bella.vn/viewer?study=1.2.840.113619.2.100.20260806.103',
          radiologist_report: 'Thoái hóa đĩa đệm L4-L5, L5-S1. Thoát vị đĩa đệm thể sau trung tâm L5-S1 chèn ép nhẹ rễ thần kinh S1 bên trái.',
          verified_at: new Date().toISOString(),
        },
        {
          tenant_id: tenantId,
          modality: 'ULTRASOUND',
          body_site: 'Siêu Âm Bụng Tổng Quát Mầu (Abdominal Doppler US)',
          dcm_study_uid: '1.2.840.113619.2.100.20260806.104',
          viewer_link: 'https://pacs.bella.vn/viewer?study=1.2.840.113619.2.100.20260806.104',
          radiologist_report: null,
          verified_at: null,
        },
        {
          tenant_id: tenantId,
          modality: 'ENDOSCOPY',
          body_site: 'Nội Soi Dạ Dày Thực Quản Có An Thần (Sedated Upper Endoscopy)',
          dcm_study_uid: '1.2.840.113619.2.100.20260806.105',
          viewer_link: 'https://pacs.bella.vn/viewer?study=1.2.840.113619.2.100.20260806.105',
          radiologist_report: 'Viêm sung huyết hang vị dạ dày mức độ vừa. Thử test CLO (Campylobacter Like Organism) âm tính HP.',
          verified_at: new Date().toISOString(),
        },
      ];

      // Insert for DB persistence
      await supabase.from('hc_imaging_orders').insert(demoSeedOrders);

      const demoResult = [
        {
          id: 'demo-img-101',
          ticketNumber: 'STT-102',
          patientName: 'Lê Thị Mai',
          modality: 'XRAY',
          bodySite: 'X-Quang Ngực Thẳng (Chest AP/PA)',
          dcmStudyUid: '1.2.840.113619.2.100.20260806.101',
          viewerLink: 'https://pacs.bella.vn/viewer?study=1.2.840.113619.2.100.20260806.101',
          status: 'reported',
          radiologistReport: 'Nhu mô phổi 2 bên sáng đều, không thấy tổn thương thâm nhiễm hay phế nang. Bóng tim không to (chỉ số tim/lồng ngực < 0.5). Vòm hoành 2 bên đều.',
        },
        {
          id: 'demo-img-102',
          ticketNumber: 'STT-103',
          patientName: 'Trần Minh Hoàng',
          modality: 'CT',
          bodySite: 'CT-Scanner Sọ Não Không Thuốc Tương Quang (Brain CT non-contrast)',
          dcmStudyUid: '1.2.840.113619.2.100.20260806.102',
          viewerLink: 'https://pacs.bella.vn/viewer?study=1.2.840.113619.2.100.20260806.102',
          status: 'captured',
          radiologistReport: undefined,
        },
        {
          id: 'demo-img-103',
          ticketNumber: 'STT-101',
          patientName: 'Nguyễn Văn Hùng',
          modality: 'MRI',
          bodySite: 'MRI Cột Sống Thắt Lưng (Lumbar Spine MRI)',
          dcmStudyUid: '1.2.840.113619.2.100.20260806.103',
          viewerLink: 'https://pacs.bella.vn/viewer?study=1.2.840.113619.2.100.20260806.103',
          status: 'reported',
          radiologistReport: 'Thoái hóa đĩa đệm L4-L5, L5-S1. Thoát vị đĩa đệm thể sau trung tâm L5-S1 chèn ép nhẹ rễ thần kinh S1 bên trái.',
        },
        {
          id: 'demo-img-104',
          ticketNumber: 'STT-105',
          patientName: 'Phạm Thị Hoa',
          modality: 'ULTRASOUND',
          bodySite: 'Siêu Âm Bụng Tổng Quát Mầu (Abdominal Doppler US)',
          dcmStudyUid: '1.2.840.113619.2.100.20260806.104',
          viewerLink: 'https://pacs.bella.vn/viewer?study=1.2.840.113619.2.100.20260806.104',
          status: 'pending',
          radiologistReport: undefined,
        },
        {
          id: 'demo-img-105',
          ticketNumber: 'STT-108',
          patientName: 'Hoàng Đức Nam',
          modality: 'ENDOSCOPY',
          bodySite: 'Nội Soi Dạ Dày Thực Quản Có An Thần (Sedated Upper Endoscopy)',
          dcmStudyUid: '1.2.840.113619.2.100.20260806.105',
          viewerLink: 'https://pacs.bella.vn/viewer?study=1.2.840.113619.2.100.20260806.105',
          status: 'reported',
          radiologistReport: 'Viêm sung huyết hang vị dạ dày mức độ vừa. Thử test CLO (Campylobacter Like Organism) âm tính HP.',
        },
      ];

      return { success: true, data: demoResult };
    }

    return { success: true, data: mapped };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lấy danh sách CĐHA' };
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
    const supabase = (await createDevelopmentBypassClient()) as any;
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
          encounter_class: 'walk_in',
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
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lưu chỉ định CĐHA' };
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

    const supabase = (await createDevelopmentBypassClient()) as any;
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
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lưu báo cáo CĐHA' };
  }
}

/**
 * 20. Lấy danh sách thuốc (hc_drug_profiles + inventory_items) & seed nếu chưa có
 */
export async function getDrugsAction(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
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
      const mapped = data.map((d: any) => {
        const item = d.inventory_items || {};
        return {
          id: d.id,
          drugCode: d.drug_code,
          drugName: item.name || 'Thuốc',
          activeIngredient: d.active_ingredient,
          atcCode: d.atc_code,
          dosageForm: d.dosage_form || 'Viên nang',
          stockQty: item.stock_qty || 100,
          unit: item.unit || 'Viên',
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
          stock_qty: d.qty,
          unit: d.unit,
        } as any)
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

    const mapped = (reData || []).map((d: any) => {
      const item = d.inventory_items || {};
      return {
        id: d.id,
        drugCode: d.drug_code,
        drugName: item.name || 'Thuốc',
        activeIngredient: d.active_ingredient,
        atcCode: d.atc_code,
        dosageForm: d.dosage_form || 'Viên nang',
        stockQty: item.stock_qty || 100,
        unit: item.unit || 'Viên',
        isControlled: d.is_controlled_drug || false,
        isColdStorage: d.is_cold_storage || false,
      };
    });

    return { success: true, data: mapped };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lấy danh sách dược phẩm' };
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
    const supabase = (await createDevelopmentBypassClient()) as any;
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
          encounter_class: 'walk_in',
          status: 'planned',
          chief_complaint: 'Kê đơn thuốc',
        })
        .select()
        .single();
      encounter = newEnc;
    }

    // 3. Find drug profile & inventory item to update stock
    const { data: drugProfile } = await supabase
      .from('hc_drug_profiles')
      .select('*, inventory_items(*)')
      .eq('id', input.drugId)
      .single();

    if (!drugProfile) throw new Error('Không tìm thấy thuốc trong danh mục');

    const invItem = drugProfile.inventory_items;
    if (invItem.stock_qty < input.qty) {
      throw new Error(`Tồn kho không đủ! Thuốc chỉ còn ${invItem.stock_qty} ${invItem.unit}.`);
    }

    // 4. Update stock in inventory_items
    const { error: stockErr } = await supabase
      .from('inventory_items')
      .update({ stock_qty: invItem.stock_qty - input.qty })
      .eq('id', invItem.id);

    if (stockErr) throw stockErr;

    // 5. Insert prescription
    const { error: rxErr } = await supabase
      .from('hc_prescriptions')
      .insert({
        tenant_id: tenantId,
        encounter_id: encounter?.id,
        patient_party_id: party?.id,
        drugs: [
          {
            drugId: input.drugId,
            drugName: invItem.name,
            qty: input.qty,
            dosageInstruction: input.dosageInstruction,
          }
        ],
      });

    if (rxErr) throw rxErr;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lưu đơn thuốc' };
  }
}

/**
 * 22. Lấy danh sách hóa đơn viện phí từ bảng revenue
 */
export async function getInvoicesAction(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const supabase = (await createDevelopmentBypassClient()) as any;
    const tenantId = await getTenantIdOrThrow();

    const { data, error } = await supabase
      .from('revenue')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('revenue_type', 'healthcare')
      .order('received_date', { ascending: false });

    if (error) {
      console.error('Error fetching healthcare invoices:', error);
      return { success: false, error: error.message };
    }

    if (data && data.length > 0) {
      const mapped = data.map((r: any) => {
        const meta = r.accounting_metadata || {};
        return {
          id: r.id,
          encounterId: meta.encounterId || 'EC-100',
          patientName: meta.patientName || 'Bệnh nhân',
          bhytCode: meta.bhytCode || 'CHƯA CÓ',
          benefitRate: meta.benefitRate || 80,
          totalAmount: Number(r.amount),
          bhytCovered: meta.bhytCovered || 0,
          patientPay: meta.patientPay || Number(r.amount),
          status: r.status === 'confirmed' ? 'paid' : 'unpaid',
          itemsCount: meta.itemsCount || 1,
        };
      });
      return { success: true, data: mapped };
    }

    // Seed default invoices if empty
    const mockInvoices = [
      { patientName: 'Nguyễn Văn Hùng', bhytCode: 'DN4010123456789', benefitRate: 80, totalAmount: 1200000, status: 'unpaid' },
      { patientName: 'Lê Thị Mai', bhytCode: 'GD4019876543210', benefitRate: 80, totalAmount: 850000, status: 'confirmed' },
    ];

    for (const inv of mockInvoices) {
      const rateFraction = inv.benefitRate / 100;
      const bhytCovered = Math.round(inv.totalAmount * rateFraction);
      const patientPay = inv.totalAmount - bhytCovered;

      await supabase
        .from('revenue')
        .insert({
          tenant_id: tenantId,
          amount: inv.totalAmount,
          revenue_type: 'healthcare',
          status: inv.status,
          received_date: new Date().toISOString().split('T')[0],
          accounting_metadata: {
            encounterId: `EC-${Math.floor(100 + Math.random() * 900)}`,
            patientName: inv.patientName,
            bhytCode: inv.bhytCode,
            benefitRate: inv.benefitRate,
            bhytCovered,
            patientPay,
            itemsCount: 2,
          },
        });
    }

    // Re-fetch
    const { data: reData } = await supabase
      .from('revenue')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('revenue_type', 'healthcare');

    const mapped = (reData || []).map((r: any) => {
      const meta = r.accounting_metadata || {};
      return {
        id: r.id,
        encounterId: meta.encounterId || 'EC-100',
        patientName: meta.patientName || 'Bệnh nhân',
        bhytCode: meta.bhytCode || 'CHƯA CÓ',
        benefitRate: meta.benefitRate || 80,
        totalAmount: Number(r.amount),
        bhytCovered: meta.bhytCovered || 0,
        patientPay: meta.patientPay || Number(r.amount),
        status: r.status === 'confirmed' ? 'paid' : 'unpaid',
        itemsCount: meta.itemsCount || 1,
      };
    });

    return { success: true, data: mapped };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lấy hóa đơn viện phí' };
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
    const supabase = (await createDevelopmentBypassClient()) as any;
    const tenantId = await getTenantIdOrThrow();

    const rateFraction = input.benefitRate / 100;
    const bhytCovered = Math.round(input.totalAmount * rateFraction);
    const patientPay = input.totalAmount - bhytCovered;

    const { error } = await supabase
      .from('revenue')
      .insert({
        tenant_id: tenantId,
        amount: input.totalAmount,
        revenue_type: 'healthcare',
        status: 'unpaid',
        received_date: new Date().toISOString().split('T')[0],
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
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lập hóa đơn' };
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
    const supabase = (await createClient()) as any;
    const tenantId = await getTenantIdOrThrow();

    const { error } = await supabase
      .from('revenue')
      .update({
        status: 'confirmed',
        payment_method: paymentMethod,
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error paying invoice:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi thanh toán hóa đơn' };
  }
}

export async function getEncounterByIdAction(id: string) {
  try {
    const supabase = (await createClient()) as any;
    const tenantId = await getTenantIdOrThrow();

    const { data, error } = await supabase
      .from('encounters')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      console.error('Error fetching encounter by id:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Lỗi lấy thông tin lượt khám' };
  }
}

