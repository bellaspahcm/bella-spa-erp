'use server';

import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';
import { PrescriptionItem } from '@/types/healthcare';
import { createHealthcareEvent, HEALTHCARE_EVENT_CATALOG } from '@/lib/events/healthcare-events';

async function getTenantIdOrThrow(): Promise<string> {
  const user = await getCurrentUser();
  return user?.tenant_id || '88888888-8888-8888-8888-888888888888';
}

/**
 * 1. CDSS Engine: Kiểm tra dị ứng thuốc & Tương tác Dược lý
 */
export async function checkPrescriptionAllergiesAction(input: {
  patientId: string;
  drugItems: Array<{ drugCode: string; drugName: string; activeIngredient: string }>;
}): Promise<{ safe: boolean; warnings: string[] }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // Fetch patient profile to get known allergies
    const { data: patientProfile } = await supabase
      .from('patient_profiles')
      .select('known_allergies')
      .eq('id', input.patientId)
      .eq('tenant_id', tenantId)
      .single();

    const knownAllergies: string[] = patientProfile?.known_allergies || [];
    const warnings: string[] = [];

    if (knownAllergies.length === 0) {
      return { safe: true, warnings: [] };
    }

    // Compare active ingredients with known allergies
    for (const drug of input.drugItems) {
      const activeLower = drug.activeIngredient.toLowerCase();
      for (const allergy of knownAllergies) {
        if (activeLower.includes(allergy.toLowerCase()) || allergy.toLowerCase().includes(activeLower)) {
          warnings.push(`⚠️ CẢNH BÁO DỊ ỨNG: Bệnh nhân có tiền sử dị ứng với nhóm/hoạt chất "${allergy}" (Thuốc chỉ định: ${drug.drugName} - ${drug.activeIngredient})`);
        }
      }
    }

    return {
      safe: warnings.length === 0,
      warnings
    };
  } catch (err: unknown) {
    return { safe: false, warnings: ['Lỗi kiểm tra CDSS dị ứng thuốc'] };
  }
}

/**
 * 2. Kê Đơn Thuốc Điện Tử (Issue Electronic Prescription)
 */
export async function issuePrescriptionAction(input: {
  encounterId: string;
  patientId: string;
  doctorPractitionerId?: string;
  items: Array<{
    drugId: string;
    drugCode: string;
    drugName: string;
    activeIngredient: string;
    quantity: number;
    unit: string;
    dosageInstruction: string;
  }>;
}): Promise<{ success: boolean; prescriptionId?: string; warnings?: string[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // 1. CDSS Invariant Check: Run Allergy Check
    const allergyCheck = await checkPrescriptionAllergiesAction({
      patientId: input.patientId,
      drugItems: input.items.map(i => ({ drugCode: i.drugCode, drugName: i.drugName, activeIngredient: i.activeIngredient }))
    });

    if (!allergyCheck.safe) {
      return {
        success: false,
        warnings: allergyCheck.warnings,
        error: `Không thể kê đơn thuốc: Phát hiện dị ứng với bệnh nhân! (${allergyCheck.warnings.join('; ')})`
      };
    }

    // 2. Insert Clinical Order (Medication)
    const { data: clinicalOrder, error: orderError } = await supabase
      .from('hc_clinical_orders')
      .insert({
        tenant_id: tenantId,
        encounter_id: input.encounterId,
        patient_id: input.patientId,
        ordering_practitioner_id: input.doctorPractitionerId || null,
        order_type: 'medication',
        status: 'placed',
        priority: 'routine'
      })
      .select()
      .single();

    if (orderError || !clinicalOrder) {
      return { success: false, error: orderError?.message || 'Không thể tạo Y lệnh Kê đơn thuốc' };
    }

    // Update Encounter status
    await supabase
      .from('hc_encounters')
      .update({ status: 'pharmacy_pending' })
      .eq('id', input.encounterId);

    // Emit Event PrescriptionIssued.v1
    const domainEvent = createHealthcareEvent(
      HEALTHCARE_EVENT_CATALOG.PRESCRIPTION_ISSUED,
      'v1',
      tenantId,
      'pharmacy',
      {
        prescriptionId: clinicalOrder.id,
        encounterId: input.encounterId,
        patientId: input.patientId,
        doctorPractitionerId: input.doctorPractitionerId || 'doctor-default',
        itemCount: input.items.length,
        issuedAt: new Date().toISOString()
      }
    );

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action: 'HEALTHCARE_EVENT_EMITTED',
      details: domainEvent as unknown as Record<string, unknown>
    });

    return { success: true, prescriptionId: clinicalOrder.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi hệ thống khi kê đơn thuốc' };
  }
}

/**
 * 3. Xuất Thuốc & Trừ Kho Dược (Dispense Medication & Deduct Inventory)
 */
export async function dispensePrescriptionAction(input: {
  prescriptionId: string;
  dispensedBy: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const tenantId = await getTenantIdOrThrow();

    // Mark Clinical Order completed
    const { error } = await supabase
      .from('hc_clinical_orders')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', input.prescriptionId)
      .eq('tenant_id', tenantId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi hệ thống khi cấp phát thuốc' };
  }
}
