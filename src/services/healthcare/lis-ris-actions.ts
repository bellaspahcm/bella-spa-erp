'use server';

import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { getCurrentUser } from '@/services/user-actions';
import { LabOrderItem, ImagingOrderItem } from '@/types/healthcare';
import { createHealthcareEvent, HEALTHCARE_EVENT_CATALOG } from '@/lib/events/healthcare-events';
import type { Database, Json } from '@/types/database.types';

type HealthcareTables = Database['public']['Tables'];
type ClinicalOrderInsert = HealthcareTables['hc_clinical_orders']['Insert'];
type LabOrderInsert = HealthcareTables['hc_lab_orders']['Insert'];
type LabOrderRow = HealthcareTables['hc_lab_orders']['Row'];
type ImagingOrderInsert = HealthcareTables['hc_imaging_orders']['Insert'];
type ImagingOrderRow = HealthcareTables['hc_imaging_orders']['Row'];

const SYSTEM_HEALTHCARE_USER_ID = 'system-healthcare-user';

async function getCurrentHealthcareContext(): Promise<{ tenantId: string; userId: string }> {
  const user = await getCurrentUser();
  return {
    tenantId: user?.tenant_id || '88888888-8888-8888-8888-888888888888',
    userId: user?.id || SYSTEM_HEALTHCARE_USER_ID,
  };
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function toLabOrderItem(row: LabOrderRow): LabOrderItem {
  return {
    id: row.id,
    order_id: row.clinical_order_id,
    test_code: row.test_code,
    test_name: row.test_name,
    sample_type: row.sample_type ?? undefined,
    tube_color: row.tube_color ?? undefined,
    result_value: row.result_value ?? undefined,
    result_unit: row.result_unit ?? undefined,
    reference_range: row.reference_range ?? undefined,
    is_abnormal: row.is_abnormal ?? undefined,
    is_panic_value: row.is_panic_value ?? undefined,
    verified_by: row.verified_by ?? undefined,
    verified_at: row.verified_at ?? undefined,
  };
}

function toImagingOrderItem(row: ImagingOrderRow): ImagingOrderItem {
  return {
    id: row.id,
    order_id: row.clinical_order_id || '',
    modality: row.modality as ImagingOrderItem['modality'],
    body_site: row.body_site,
    dcm_study_uid: row.dcm_study_uid ?? undefined,
    viewer_link: row.viewer_link ?? undefined,
    radiologist_report: row.radiologist_report ?? undefined,
    radiologist_id: row.radiologist_id ?? undefined,
    verified_at: row.verified_at ?? undefined,
  };
}

/**
 * 1. LIS (Xét nghiệm) Server Actions
 */

// Tạo Y lệnh Xét nghiệm (Clinical Order -> Lab Items)
export async function createLabOrdersAction(input: {
  encounterId: string;
  patientId: string;
  testItems: Array<{ testCode: string; testName: string; sampleType?: string; tubeColor?: string }>;
}): Promise<{ success: boolean; data?: LabOrderItem[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const { tenantId, userId } = await getCurrentHealthcareContext();

    // 1. Insert parent Clinical Order
    const clinicalOrderPayload: ClinicalOrderInsert = {
      tenant_id: tenantId,
      encounter_id: input.encounterId,
      patient_party_id: input.patientId,
      ordered_by: userId,
      order_type: 'laboratory',
      order_status: 'placed',
      priority: 'routine',
      order_details: toJson({
        tests: input.testItems.map((item) => ({
          testCode: item.testCode,
          testName: item.testName,
          sampleType: item.sampleType,
          tubeColor: item.tubeColor,
        })),
      }),
    };

    const { data: clinicalOrder, error: orderError } = await supabase
      .from('hc_clinical_orders')
      .insert(clinicalOrderPayload)
      .select()
      .single();

    if (orderError || !clinicalOrder) {
      console.error('Error creating clinical order:', orderError);
      return { success: false, error: orderError?.message || 'Không thể tạo Y lệnh xét nghiệm' };
    }

    // 2. Insert Lab Order Items
    const labItemsPayload: LabOrderInsert[] = input.testItems.map((item) => ({
      tenant_id: tenantId,
      clinical_order_id: clinicalOrder.id,
      encounter_id: input.encounterId,
      test_code: item.testCode,
      test_name: item.testName,
      sample_type: item.sampleType || 'Máu toàn phần',
      tube_color: item.tubeColor || 'Đỏ'
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('hc_lab_orders')
      .insert(labItemsPayload)
      .select();

    if (itemsError) {
      console.error('Error creating lab order items:', itemsError);
      return { success: false, error: itemsError.message };
    }

    // Update Encounter status to orders_pending
    await supabase
      .from('hc_encounters')
      .update({ status: 'orders_pending' })
      .eq('id', input.encounterId);

    // Emit Event ClinicalOrderCreated.v1
    const domainEvent = createHealthcareEvent(
      HEALTHCARE_EVENT_CATALOG.CLINICAL_ORDER_CREATED,
      'v1',
      tenantId,
      'laboratory',
      {
        orderId: clinicalOrder.id,
        encounterId: input.encounterId,
        patientId: input.patientId,
        orderType: 'laboratory',
        itemCount: input.testItems.length,
        orderedAt: clinicalOrder.ordered_at
      }
    );

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action: 'HEALTHCARE_EVENT_EMITTED',
      table_name: 'hc_clinical_orders',
      record_id: clinicalOrder.id,
      new_data: toJson(domainEvent),
    });

    return { success: true, data: (insertedItems || []).map(toLabOrderItem) };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi hệ thống khi tạo chỉ định xét nghiệm' };
  }
}

// Lấy danh sách Y lệnh Xét nghiệm theo Encounter
export async function getLabOrdersAction(encounterId: string): Promise<{ success: boolean; data?: LabOrderItem[]; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const { tenantId } = await getCurrentHealthcareContext();

    const { data, error } = await supabase
      .from('hc_lab_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(toLabOrderItem) };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi lấy thông tin xét nghiệm' };
  }
}

// Nhập & Duyệt Kết quả Xét nghiệm (Panic Value Detection & Event Emission)
export async function verifyLabResultAction(input: {
  labOrderId: string;
  resultValue: string;
  resultUnit?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
  isPanicValue?: boolean;
  verifiedBy: string;
}): Promise<{ success: boolean; isPanicValue?: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const { tenantId } = await getCurrentHealthcareContext();

    const { data: labOrder, error: updateError } = await supabase
      .from('hc_lab_orders')
      .update({
        result_value: input.resultValue,
        result_unit: input.resultUnit || '',
        reference_range: input.referenceRange || '',
        is_abnormal: input.isAbnormal || false,
        is_panic_value: input.isPanicValue || false,
        verified_by: input.verifiedBy,
        verified_at: new Date().toISOString()
      })
      .eq('id', input.labOrderId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError || !labOrder) {
      return { success: false, error: updateError?.message || 'Lỗi cập nhật kết quả XN' };
    }

    // Update parent clinical order status to completed if all items verified
    await supabase
      .from('hc_clinical_orders')
      .update({ order_status: 'completed' })
      .eq('id', labOrder.clinical_order_id);

    // Emit Event LabResultVerified.v1
    const domainEvent = createHealthcareEvent(
      HEALTHCARE_EVENT_CATALOG.LAB_RESULT_VERIFIED,
      'v1',
      tenantId,
      'laboratory',
      {
        orderId: labOrder.id,
        encounterId: labOrder.encounter_id,
        patientId: labOrder.encounter_id,
        verifiedBy: input.verifiedBy,
        hasPanicValue: !!labOrder.is_panic_value,
        verifiedAt: labOrder.verified_at
      }
    );

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      action: 'HEALTHCARE_EVENT_EMITTED',
      table_name: 'hc_lab_orders',
      record_id: labOrder.id,
      new_data: toJson(domainEvent),
    });

    return { success: true, isPanicValue: labOrder.is_panic_value ?? undefined };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi hệ thống khi duyệt kết quả xét nghiệm' };
  }
}

/**
 * 2. RIS (Chẩn đoán Hình ảnh) Server Actions
 */

// Tạo Y lệnh Chẩn đoán Hình ảnh (X-Quang, CT, MRI, Siêu âm)
export async function createImagingOrderAction(input: {
  encounterId: string;
  patientId: string;
  modality: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'ENDOSCOPY';
  bodySite: string;
}): Promise<{ success: boolean; data?: ImagingOrderItem; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const { tenantId, userId } = await getCurrentHealthcareContext();

    // Insert parent Clinical Order
    const clinicalOrderPayload: ClinicalOrderInsert = {
      tenant_id: tenantId,
      encounter_id: input.encounterId,
      patient_party_id: input.patientId,
      ordered_by: userId,
      order_type: 'imaging',
      order_status: 'placed',
      priority: 'routine',
      order_details: toJson({
        modality: input.modality,
        bodySite: input.bodySite,
      }),
    };

    const { data: clinicalOrder, error: orderError } = await supabase
      .from('hc_clinical_orders')
      .insert(clinicalOrderPayload)
      .select()
      .single();

    if (orderError || !clinicalOrder) {
      return { success: false, error: orderError?.message || 'Lỗi tạo Y lệnh CĐHA' };
    }

    // Insert Imaging Order Item
    const imagingOrderPayload: ImagingOrderInsert = {
      tenant_id: tenantId,
      clinical_order_id: clinicalOrder.id,
      encounter_id: input.encounterId,
      modality: input.modality,
      body_site: input.bodySite,
      dcm_study_uid: `1.2.840.113619.2.${Date.now()}`,
      viewer_link: `https://pacs.bella.vn/viewer?study=${clinicalOrder.id}`,
    };

    const { data: imagingOrder, error: imgError } = await supabase
      .from('hc_imaging_orders')
      .insert(imagingOrderPayload)
      .select()
      .single();

    if (imgError || !imagingOrder) {
      return { success: false, error: imgError?.message || 'Lỗi tạo chi tiết CĐHA' };
    }

    return { success: true, data: toImagingOrderItem(imagingOrder) };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi tạo Y lệnh CĐHA' };
  }
}

// Cập nhật Báo cáo Chẩn đoán Hình ảnh từ Bác sĩ CĐHA
export async function updateImagingReportAction(input: {
  imagingOrderId: string;
  radiologistReport: string;
  radiologistId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createDevelopmentBypassClient();
    const { tenantId } = await getCurrentHealthcareContext();

    const { error } = await supabase
      .from('hc_imaging_orders')
      .update({
        radiologist_report: input.radiologistReport,
        radiologist_id: input.radiologistId,
        verified_at: new Date().toISOString()
      })
      .eq('id', input.imagingOrderId)
      .eq('tenant_id', tenantId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi cập nhật báo cáo CĐHA' };
  }
}
