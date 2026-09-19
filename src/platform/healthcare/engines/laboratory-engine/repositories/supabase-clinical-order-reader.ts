import { createClient } from '@/lib/supabase-server';
import type { IClinicalOrderReader, ClinicalOrderSnapshot } from '../contracts/clinical-order-reader.interface';

export class SupabaseClinicalOrderReader implements IClinicalOrderReader {
  constructor(private readonly supabase: Awaited<ReturnType<typeof createClient>>) {}

  public async getOrderSnapshot(tenantId: string, orderId: string): Promise<ClinicalOrderSnapshot | null> {
    const { data, error } = await this.supabase
      .from('hc_clinical_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Since hc_clinical_orders table doesn't have a JSON column for test items,
    // we query the related items from hc_lab_orders as an Anti-Corruption Layer strategy.
    const { data: items, error: itemsError } = await this.supabase
      .from('hc_lab_orders')
      .select('test_code, test_name')
      .eq('tenant_id', tenantId)
      .eq('clinical_order_id', orderId);

    if (itemsError) {
      return null;
    }

    const testItems = (items || []).map((item) => ({
      testCode: item.test_code,
      testName: item.test_name,
    }));

    return {
      id: data.id,
      tenantId: data.tenant_id,
      encounterId: data.encounter_id,
      patientId: data.encounter_id, // Map encounter_id as patientId in schema
      orderType: data.order_type,
      status: data.order_status,
      priority: data.priority || 'routine',
      testItems: testItems.length > 0 ? testItems : undefined,
    };
  }
}
