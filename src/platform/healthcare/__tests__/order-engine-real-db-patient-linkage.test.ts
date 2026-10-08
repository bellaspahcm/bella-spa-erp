import { randomUUID } from 'crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { clearServiceCache, getHealthcareService } from '@/platform/healthcare/service-locator';
import type { OrderEngineContract } from '@/platform/healthcare/contracts/order-engine.contract';
import type { Database } from '@/types/database.types';

jest.mock('server-only', () => ({}), { virtual: true });

jest.setTimeout(90_000);

const HEALTHCARE_TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const hasRealSupabaseEnv = () => {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key'
  );
};

const describeWithRealSupabase = hasRealSupabaseEnv() ? describe : describe.skip;

async function insertOrThrow(
  supabase: SupabaseClient<Database>,
  table: 'party_parties' | 'journey_journeys' | 'hc_encounters',
  row: Record<string, string>
): Promise<void> {
  const { error } = await supabase.from(table).insert(row);

  if (error) {
    throw new Error(`${table} seed failed: ${error.message}`);
  }
}

describeWithRealSupabase('Order Engine Real DB patient linkage persistence', () => {
  let supabase: SupabaseClient<Database>;
  let patientPartyId = '';
  let providerPartyId = '';
  let journeyId = '';
  let encounterId = '';
  let orderId = '';
  let requestId = '';

  beforeEach(async () => {
    supabase = createSupabaseClient<Database>(getSupabaseAdminUrl(), getSupabaseAdminKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    patientPartyId = randomUUID();
    providerPartyId = randomUUID();
    journeyId = randomUUID();
    encounterId = randomUUID();
    orderId = '';
    requestId = randomUUID();

    await insertOrThrow(supabase, 'party_parties', {
      id: patientPartyId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      party_type: 'person',
      display_name: 'Order Engine Real DB Patient',
    });

    await insertOrThrow(supabase, 'party_parties', {
      id: providerPartyId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      party_type: 'person',
      display_name: 'Order Engine Real DB Provider',
    });

    await insertOrThrow(supabase, 'journey_journeys', {
      id: journeyId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      primary_party_id: patientPartyId,
      journey_type: 'clinical_journey',
      vertical: 'healthcare',
      status: 'active',
    });

    await insertOrThrow(supabase, 'hc_encounters', {
      id: encounterId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      patient_party_id: patientPartyId,
      doctor_party_id: providerPartyId,
      care_journey_id: journeyId,
      encounter_class: 'AMB',
      encounter_type: 'outpatient',
      status: 'in-progress',
      scheduled_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      period_start: new Date().toISOString(),
    });

    clearServiceCache();
  });

  afterEach(async () => {
    if (orderId) {
      await supabase.from('hc_clinical_orders').delete().eq('id', orderId);
    }
    if (requestId) {
      await supabase.from('hc_idempotency_keys').delete().eq('id', requestId);
    }
    if (encounterId) {
      await supabase.from('hc_encounters').delete().eq('id', encounterId);
    }
    if (journeyId) {
      await supabase.from('journey_journeys').delete().eq('id', journeyId);
    }
    if (patientPartyId || providerPartyId) {
      await supabase
        .from('party_parties')
        .delete()
        .in('id', [patientPartyId, providerPartyId].filter(Boolean));
    }
    clearServiceCache();
  });

  it('persists CreateOrderRequest.patientId into hc_clinical_orders.patient_party_id', async () => {
    const orderEngine = getHealthcareService<OrderEngineContract>('order-engine', supabase);

    const result = await orderEngine.createOrder({
      requestId,
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      encounterId,
      patientId: patientPartyId,
      orderType: 'LAB',
      priority: 'ROUTINE',
      orderedBy: providerPartyId,
      orderDetails: {
        testCode: 'K',
        testName: 'Potassium',
        specimenType: 'Serum',
      },
    });

    if (!result.success) {
      throw new Error(`${result.error?.code ?? 'ORDER_ENGINE_ERROR'}: ${result.error?.message ?? 'unknown error'}`);
    }

    expect(result.data?.order.id).toBeTruthy();
    orderId = result.data?.order.id ?? '';

    const { data, error } = await supabase
      .from('hc_clinical_orders')
      .select('id, tenant_id, encounter_id, patient_party_id')
      .eq('id', orderId)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: orderId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      encounter_id: encounterId,
      patient_party_id: patientPartyId,
    });
  });
});
