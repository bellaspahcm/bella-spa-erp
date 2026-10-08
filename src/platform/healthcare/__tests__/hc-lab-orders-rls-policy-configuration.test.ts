import { randomUUID } from 'crypto';

import jwt from 'jsonwebtoken';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { HealthcareTestFixtures, type HealthcareTestFixture } from '@/platform/healthcare/__tests__/fixtures/healthcare-test-fixtures';
import { LaboratoryEngineService } from '@/platform/healthcare/engines/laboratory-engine/laboratory-engine.service';
import { SupabaseLaboratoryRepository } from '@/platform/healthcare/engines/laboratory-engine/repositories/supabase-laboratory.repository';
import type { Database } from '@/types/database.types';

jest.mock('server-only', () => ({}), { virtual: true });

jest.setTimeout(90_000);

const hasRealSupabaseRlsEnv = () => {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key'
    && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    && process.env.SUPABASE_JWT_SECRET
  );
};

const describeWithRealSupabase = hasRealSupabaseRlsEnv() ? describe : describe.skip;

function createTenantRlsClient(tenantId: string, userId: string): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  if (!supabaseUrl || !anonKey || !jwtSecret) {
    throw new Error('Supabase anon URL/key and JWT secret are required for Healthcare RLS proof.');
  }

  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      sub: userId,
      role: 'authenticated',
      aud: 'authenticated',
      exp: now + 3600,
      iat: now,
      tenant_id: tenantId,
      app_metadata: {
        tenant_id: tenantId,
        role: 'admin',
      },
      user_metadata: {
        tenant_id: tenantId,
        role: 'admin',
      },
    },
    jwtSecret,
    { algorithm: 'HS256' }
  );

  return createSupabaseClient<Database>(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

describeWithRealSupabase('Healthcare Laboratory order RLS policy configuration', () => {
  let supabase: SupabaseClient<Database>;
  let fixtures: HealthcareTestFixture;
  let clinicalOrderId = '';
  let labOrderId = '';
  let userId = '';

  beforeEach(async () => {
    supabase = createSupabaseClient<Database>(getSupabaseAdminUrl(), getSupabaseAdminKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    fixtures = await HealthcareTestFixtures.setup();
    userId = randomUUID();

    const userResult = await supabase
      .from('users')
      .insert({
        id: userId,
        tenant_id: fixtures.tenantId,
        email: `hc-lab-rls-${userId}@example.test`,
        full_name: 'Healthcare Lab RLS Proof User',
        role: 'admin',
        status: 'active',
      });

    if (userResult.error) {
      throw new Error(`RLS proof user seed failed: ${userResult.error.message}`);
    }

    clinicalOrderId = randomUUID();
    const clinicalOrderResult = await supabase
      .from('hc_clinical_orders')
      .insert({
        id: clinicalOrderId,
        tenant_id: fixtures.tenantId,
        encounter_id: fixtures.encounterId,
        patient_party_id: fixtures.patientPartyId,
        order_type: 'LAB',
        order_status: 'APPROVED',
        priority: 'ROUTINE',
        ordered_by: fixtures.providerPartyId,
        approved_by: fixtures.providerPartyId,
        approved_at: new Date().toISOString(),
        order_details: {},
      });

    if (clinicalOrderResult.error) {
      throw new Error(`clinical order seed failed: ${clinicalOrderResult.error.message}`);
    }

    const laboratory = new LaboratoryEngineService(new SupabaseLaboratoryRepository(supabase));
    const bootstrap = await laboratory.bootstrapLabOrder({
      tenantId: fixtures.tenantId,
      patientId: fixtures.patientPartyId,
      encounterId: fixtures.encounterId,
      orderId: clinicalOrderId,
      testCode: 'K',
      testName: 'Potassium',
    });
    labOrderId = bootstrap.labOrderId;
  });

  afterEach(async () => {
    if (labOrderId) {
      await supabase.from('hc_lab_orders').delete().eq('id', labOrderId);
    }
    if (clinicalOrderId) {
      await supabase.from('hc_clinical_orders').delete().eq('id', clinicalOrderId);
    }
    if (userId) {
      await supabase.from('users').delete().eq('id', userId);
    }
    if (fixtures) {
      await fixtures.cleanup();
    }
  });

  it('allows same-tenant reads and denies cross-tenant reads for clinical and lab orders', async () => {
    const sameTenantClient = createTenantRlsClient(fixtures.tenantId, userId);
    const otherTenantClient = createTenantRlsClient(randomUUID(), randomUUID());

    const tenantContext = await sameTenantClient.rpc('get_auth_tenant_id');
    expect(tenantContext.error).toBeNull();
    expect(tenantContext.data).toBe(fixtures.tenantId);

    const sameTenantClinicalOrder = await sameTenantClient
      .from('hc_clinical_orders')
      .select('id, tenant_id, patient_party_id')
      .eq('id', clinicalOrderId);
    expect(sameTenantClinicalOrder.error).toBeNull();
    expect(sameTenantClinicalOrder.data).toHaveLength(1);
    expect(sameTenantClinicalOrder.data?.[0]?.patient_party_id).toBe(fixtures.patientPartyId);

    const sameTenantLabOrder = await sameTenantClient
      .from('hc_lab_orders')
      .select('id, tenant_id, clinical_order_id, encounter_id')
      .eq('id', labOrderId);
    expect(sameTenantLabOrder.error).toBeNull();
    expect(sameTenantLabOrder.data).toHaveLength(1);
    expect(sameTenantLabOrder.data?.[0]?.clinical_order_id).toBe(clinicalOrderId);

    const crossTenantClinicalOrder = await otherTenantClient
      .from('hc_clinical_orders')
      .select('id')
      .eq('id', clinicalOrderId);
    expect(crossTenantClinicalOrder.error).toBeNull();
    expect(crossTenantClinicalOrder.data).toHaveLength(0);

    const crossTenantLabOrder = await otherTenantClient
      .from('hc_lab_orders')
      .select('id')
      .eq('id', labOrderId);
    expect(crossTenantLabOrder.error).toBeNull();
    expect(crossTenantLabOrder.data).toHaveLength(0);
  });
});
