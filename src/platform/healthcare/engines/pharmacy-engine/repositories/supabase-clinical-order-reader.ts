import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { IClinicalOrderReader, ClinicalOrderSnapshot } from '../contracts/clinical-order-reader.interface';

type OrderRow = Database['public']['Tables']['hc_clinical_orders']['Row'];

export class SupabaseClinicalOrderReader implements IClinicalOrderReader {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getOrderSnapshot(tenantId: string, orderId: string): Promise<ClinicalOrderSnapshot | null> {
    const { data, error } = await this.supabase
      .from('hc_clinical_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .single();

    if (error || !data) {
      return null;
    }

    const row = data as OrderRow;
    const details = row.order_details as {
      drugCode?: string;
      drugName?: string;
      dose?: number;
      doseUnit?: string;
      route?: string;
      frequency?: string;
      durationDays?: number;
    };

    return {
      id: row.id,
      tenantId: row.tenant_id,
      encounterId: row.encounter_id,
      patientId: row.patient_party_id,
      orderType: row.order_type,
      orderStatus: row.order_status,
      drugCode: details.drugCode ?? '',
      drugName: details.drugName ?? '',
      dose: details.dose ?? 0,
      doseUnit: details.doseUnit ?? '',
      route: details.route ?? '',
      frequency: details.frequency ?? '',
      durationDays: details.durationDays ?? 0,
    };
  }
}
