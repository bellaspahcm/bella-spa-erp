import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import type { ImagingWorkflowStatus } from '../../../contracts/imaging-engine.contract';
import type { IImagingRepository, ImagingOrderRecord } from './imaging-repository.interface';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ImagingOrderRow = Database['public']['Tables']['hc_imaging_orders']['Row'];
type ImagingOrderInsert = Database['public']['Tables']['hc_imaging_orders']['Insert'];
type ImagingOrderUpdate = Database['public']['Tables']['hc_imaging_orders']['Update'];
type ClinicalOrderRow = Database['public']['Tables']['hc_clinical_orders']['Row'];

export class SupabaseImagingRepository implements IImagingRepository {
  private readonly TABLE = 'hc_imaging_orders';

  constructor(private readonly supabase: SupabaseServerClient) {}

  public async findById(tenantId: string, id: string): Promise<ImagingOrderRecord | null> {
    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return this.mapToRecord(data);
  }

  public async findByClinicalOrderId(tenantId: string, clinicalOrderId: string): Promise<ImagingOrderRecord[]> {
    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('clinical_order_id', clinicalOrderId);

    if (error) {
      throw error;
    }

    const records: ImagingOrderRecord[] = [];
    for (const row of data ?? []) {
      records.push(await this.mapToRecord(row));
    }

    return records;
  }

  public async save(record: ImagingOrderRecord): Promise<void> {
    const payload: ImagingOrderInsert = {
      id: record.id,
      tenant_id: record.tenantId,
      clinical_order_id: record.clinicalOrderId,
      encounter_id: record.encounterId,
      modality: record.modalityCode,
      body_site: record.bodyRegion,
      dcm_study_uid: record.dcmStudyUid ?? null,
      viewer_link: record.viewerLink ?? null,
      radiologist_report: record.radiologistReport ?? null,
      radiologist_id: record.radiologistId ?? null,
      verified_at: record.verifiedAt ?? null,
      priority: null,
      ticket_number: null,
      patient_name: null,
    };

    const { error } = await this.supabase
      .from(this.TABLE)
      .insert(payload);

    if (error) {
      throw error;
    }
  }

  public async recordResult(
    tenantId: string,
    imagingOrderId: string,
    radiologistReport: string,
    radiologistId: string,
    verifiedAt: string
  ): Promise<ImagingOrderRecord> {
    const payload: ImagingOrderUpdate = {
      radiologist_report: radiologistReport,
      radiologist_id: radiologistId,
      verified_at: verifiedAt,
    };

    const { data, error } = await this.supabase
      .from(this.TABLE)
      .update(payload)
      .eq('tenant_id', tenantId)
      .eq('id', imagingOrderId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapToRecord(data);
  }

  private async mapToRecord(row: ImagingOrderRow): Promise<ImagingOrderRecord> {
    const clinicalOrder = row.clinical_order_id
      ? await this.findClinicalOrder(row.tenant_id, row.clinical_order_id)
      : null;

    return {
      id: row.id,
      tenantId: row.tenant_id,
      patientId: clinicalOrder?.patient_party_id ?? '',
      encounterId: row.encounter_id ?? '',
      clinicalOrderId: row.clinical_order_id ?? '',
      modalityCode: row.modality,
      bodyRegion: row.body_site,
      dcmStudyUid: row.dcm_study_uid ?? undefined,
      viewerLink: row.viewer_link ?? undefined,
      radiologistReport: row.radiologist_report ?? undefined,
      radiologistId: row.radiologist_id ?? undefined,
      verifiedAt: row.verified_at ?? undefined,
      status: deriveStatus(row),
    };
  }

  private async findClinicalOrder(tenantId: string, clinicalOrderId: string): Promise<ClinicalOrderRow | null> {
    const { data, error } = await this.supabase
      .from('hc_clinical_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', clinicalOrderId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ?? null;
  }
}

function deriveStatus(row: ImagingOrderRow): ImagingWorkflowStatus {
  if (row.radiologist_report && row.verified_at) {
    return 'VERIFIED';
  }

  if (row.radiologist_report) {
    return 'REPORTED';
  }

  if (row.verified_at) {
    return 'CAPTURED';
  }

  return 'PENDING';
}
