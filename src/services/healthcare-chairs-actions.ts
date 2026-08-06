'use server';

import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getAuthorizedTenantUser } from '@/core/services/auth';
import type { Database } from '@/types/database.types';

export interface HealthcareChairVM {
  id: string;
  code: string;
  zone: string;
  status: 'occupied' | 'available' | 'sanitizing';
  currentPatientName?: string;
  currentDoctorName?: string;
  estimatedMinutesRemaining?: number;
}

type BookingResourceRow = Database['public']['Tables']['booking_resources']['Row'];
type BookingResourceInsert = Database['public']['Tables']['booking_resources']['Insert'];
type BookingResourceUpdate = Database['public']['Tables']['booking_resources']['Update'];

const CLINIC_CHAIR_ROLES = ['admin', 'super_admin', 'admin_staff', 'doctor', 'ktv_lead', 'ktv', 'nurse', 'accountant'] as const;

const DEFAULT_MOCK_CHAIRS: HealthcareChairVM[] = [
  { id: 'ch-1', code: 'Ghế #01', zone: 'Khu A - Ghế chính', status: 'occupied', currentPatientName: 'Nguyễn Văn Hùng', currentDoctorName: 'BS. Lê Minh', estimatedMinutesRemaining: 15 },
  { id: 'ch-2', code: 'Ghế #02', zone: 'Khu A - Ghế chính', status: 'available' },
  { id: 'ch-3', code: 'Ghế #03', zone: 'Khu B - Phục hình', status: 'sanitizing' },
  { id: 'ch-4', code: 'Ghế #04', zone: 'Khu B - Phục hình', status: 'occupied', currentPatientName: 'Lê Thị Mai', currentDoctorName: 'BS. Trần Thảo', estimatedMinutesRemaining: 30 },
];

function mapRowToChairVM(row: BookingResourceRow): HealthcareChairVM {
  const meta = (row.metadata as Record<string, any>) || {};
  return {
    id: row.id,
    code: row.name,
    zone: row.location_note || 'Khu A - Ghế chính',
    status: (row.status as HealthcareChairVM['status']) || 'available',
    currentPatientName: meta.currentPatientName || undefined,
    currentDoctorName: meta.currentDoctorName || undefined,
    estimatedMinutesRemaining: typeof meta.estimatedMinutesRemaining === 'number' ? meta.estimatedMinutesRemaining : undefined,
  };
}

export async function fetchHealthcareChairsAction(): Promise<{ success: true; data: HealthcareChairVM[] } | { success: false; error: string }> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: CLINIC_CHAIR_ROLES,
    errorMessage: 'Không có quyền truy cập sơ đồ ghế nha khoa.',
  });

  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const supabase = await createDevelopmentBypassClient();
  const { data, error } = await supabase
    .from('booking_resources')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('resource_type', 'chair')
    .order('name', { ascending: true });

  if (error) {
    console.error('[fetchHealthcareChairsAction] Supabase error:', error);
    return { success: false, error: error.message };
  }

  // Seed default chairs into database if tenant has no chairs yet
  if (!data || data.length === 0) {
    console.log('[fetchHealthcareChairsAction] 🌱 No chairs found, seeding default chairs for tenant:', auth.tenantId);
    
    const seedPayloads: BookingResourceInsert[] = DEFAULT_MOCK_CHAIRS.map((c) => ({
      id: c.id,
      tenant_id: auth.tenantId,
      name: c.code,
      resource_type: 'chair',
      location_note: c.zone,
      status: c.status,
      capacity: 1,
      metadata: {
        currentPatientName: c.currentPatientName || null,
        currentDoctorName: c.currentDoctorName || null,
        estimatedMinutesRemaining: c.estimatedMinutesRemaining || null,
      },
    }));

    const { data: seededData, error: seedError } = await supabase
      .from('booking_resources')
      .insert(seedPayloads)
      .select();

    if (seedError) {
      console.error('[fetchHealthcareChairsAction] ❌ Seed error:', seedError.message, seedError.details, seedError.hint);
      
      // Check if chairs already exist (maybe seeded by another request)
      const { data: retryData } = await supabase
        .from('booking_resources')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('resource_type', 'chair');
      
      if (retryData && retryData.length > 0) {
        console.log('[fetchHealthcareChairsAction] ✅ Chairs found on retry (race condition):', retryData.length);
        return { success: true, data: retryData.map(mapRowToChairVM) };
      }
      
      // Real seed failure - return error instead of mock data
      return { success: false, error: `Không thể tạo ghế khám: ${seedError.message}` };
    }

    console.log('[fetchHealthcareChairsAction] ✅ Seeded', seededData?.length || 0, 'chairs successfully');
    return { success: true, data: (seededData || []).map(mapRowToChairVM) };
  }

  console.log('[fetchHealthcareChairsAction] ✅ Found', data.length, 'existing chairs in database');
  return { success: true, data: data.map(mapRowToChairVM) };
}

export async function updateHealthcareChairAssignmentAction(
  targetChairId: string,
  patientName: string,
  doctorName?: string
): Promise<{ success: true; data: HealthcareChairVM[] } | { success: false; error: string }> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: CLINIC_CHAIR_ROLES,
    errorMessage: 'Không có quyền phân ghế điều trị nha khoa.',
  });

  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const supabase = await createDevelopmentBypassClient();

  console.log('[updateHealthcareChairAssignmentAction] 🔄 Assigning patient:', patientName, 'to chair:', targetChairId);

  // Fetch current chairs to enforce single-chair domain invariant
  const { data: existingRows, error: fetchErr } = await supabase
    .from('booking_resources')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('resource_type', 'chair');

  if (fetchErr) {
    console.error('[updateHealthcareChairAssignmentAction] ❌ Fetch error:', fetchErr);
    return { success: false, error: fetchErr.message };
  }

  console.log('[updateHealthcareChairAssignmentAction] ✅ Found', existingRows?.length || 0, 'existing chairs');

  const currentChairs = existingRows || [];

  // Step 1: Automatically release any other chair occupied by this patient
  for (const row of currentChairs) {
    const meta = (row.metadata as Record<string, any>) || {};
    if (meta.currentPatientName === patientName && row.id !== targetChairId) {
      const releasePayload: BookingResourceUpdate = {
        status: 'available',
        metadata: {
          currentPatientName: null,
          currentDoctorName: null,
          estimatedMinutesRemaining: null,
        },
        updated_at: new Date().toISOString(),
      };

      const { error: relErr } = await supabase
        .from('booking_resources')
        .update(releasePayload)
        .eq('id', row.id)
        .eq('tenant_id', auth.tenantId);

      if (relErr) {
        console.error('[updateHealthcareChairAssignmentAction] ❌ Release error:', relErr);
        return { success: false, error: `Lỗi giải phóng ghế cũ: ${relErr.message}` };
      }
      
      console.log('[updateHealthcareChairAssignmentAction] ✅ Released old chair:', row.id);
    }
  }

  // Step 2: Assign patient to the target chair
  const assignPayload: BookingResourceUpdate = {
    status: 'occupied',
    metadata: {
      currentPatientName: patientName,
      currentDoctorName: doctorName || 'BS. Lê Minh',
      estimatedMinutesRemaining: 25,
    },
    updated_at: new Date().toISOString(),
  };

  console.log('[updateHealthcareChairAssignmentAction] 📝 Assigning chair with payload:', assignPayload);

  const { error: assignErr } = await supabase
    .from('booking_resources')
    .update(assignPayload)
    .eq('id', targetChairId)
    .eq('tenant_id', auth.tenantId);

  if (assignErr) {
    console.error('[updateHealthcareChairAssignmentAction] ❌ Assign error:', assignErr.message, assignErr.details);
    return { success: false, error: `Lỗi phân ghế mới: ${assignErr.message}` };
  }

  console.log('[updateHealthcareChairAssignmentAction] ✅ Successfully assigned chair:', targetChairId);

  // Return fresh updated list of chairs
  return fetchHealthcareChairsAction();
}
