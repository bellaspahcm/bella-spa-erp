import { randomUUID } from 'crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { HealthcareTestFixtures, type HealthcareTestFixture } from '@/platform/healthcare/__tests__/fixtures/healthcare-test-fixtures';
import { LaboratoryEngineService } from '@/platform/healthcare/engines/laboratory-engine/laboratory-engine.service';
import { SupabaseLaboratoryRepository } from '@/platform/healthcare/engines/laboratory-engine/repositories/supabase-laboratory.repository';
import type { Database } from '@/types/database.types';

jest.mock('server-only', () => ({}), { virtual: true });

jest.setTimeout(90_000);

const hasRealSupabaseAdminEnv = () => {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key'
  );
};

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

describeWithRealSupabase('Laboratory Real DB patient linkage proof', () => {
  let supabase: SupabaseClient<Database>;
  let fixtures: HealthcareTestFixture;
  let repository: SupabaseLaboratoryRepository;
  let service: LaboratoryEngineService;
  let clinicalOrderId = '';
  let labOrderId = '';
  let technicianUserId = '';

  beforeEach(async () => {
    const url = getSupabaseAdminUrl();
    const adminKey = getSupabaseAdminKey();

    supabase = createSupabaseClient<Database>(url, adminKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    fixtures = await HealthcareTestFixtures.setup();
    repository = new SupabaseLaboratoryRepository(supabase);
    service = new LaboratoryEngineService(repository);

    technicianUserId = randomUUID();
    const userEmail = `lab-tech-${technicianUserId}@example.test`;
    const userResult = await supabase
      .from('users')
      .insert({
        id: technicianUserId,
        tenant_id: fixtures.tenantId,
        email: userEmail,
        full_name: 'Laboratory Linkage Proof Technician',
        role: 'admin',
        status: 'active',
      });

    if (userResult.error) {
      throw new Error(`technician user seed failed: ${userResult.error.message}`);
    }

    clinicalOrderId = randomUUID();
    const { error } = await supabase
      .from('hc_clinical_orders')
      .insert({
        id: clinicalOrderId,
        tenant_id: fixtures.tenantId,
        encounter_id: fixtures.encounterId,
        patient_party_id: fixtures.patientPartyId,
        order_type: 'LAB',
        order_status: 'APPROVED',
        ordered_by: fixtures.providerPartyId,
        approved_by: fixtures.providerPartyId,
        approved_at: new Date().toISOString(),
        priority: 'ROUTINE',
        order_details: {},
      });

    if (error) {
      throw new Error(`clinical order seed failed: ${error.message}`);
    }
  });

  afterEach(async () => {
    if (labOrderId) {
      await supabase.from('hc_lab_orders').delete().eq('id', labOrderId);
    }
    if (clinicalOrderId) {
      await supabase.from('hc_clinical_orders').delete().eq('id', clinicalOrderId);
    }
    if (technicianUserId) {
      await supabase.from('users').delete().eq('id', technicianUserId);
    }
    if (fixtures) {
      await fixtures.cleanup();
    }
  });

  it('hydrates LabOrder.patientId from canonical clinical order patient_party_id', async () => {
    const bootstrap = await service.bootstrapLabOrder({
      tenantId: fixtures.tenantId,
      patientId: fixtures.patientPartyId,
      encounterId: fixtures.encounterId,
      orderId: clinicalOrderId,
      testCode: 'K',
      testName: 'Potassium',
    });
    labOrderId = bootstrap.labOrderId;

    expect(bootstrap.patientId).toBe(fixtures.patientPartyId);
    expect(bootstrap.patientId).not.toBe(fixtures.encounterId);

    await service.collectSpecimen(fixtures.tenantId, labOrderId, 'Serum', 'Gold');
    await service.receiveSpecimen(fixtures.tenantId, labOrderId);
    await service.startProcessing(fixtures.tenantId, labOrderId);
    await service.recordResult(fixtures.tenantId, labOrderId, '4.2', 'mEq/L');
    const verified = await service.verifyResult(fixtures.tenantId, labOrderId, technicianUserId);

    expect(verified.status).toBe('VERIFIED');
    expect(verified.patientId).toBe(fixtures.patientPartyId);
    expect(verified.patientId).not.toBe(fixtures.encounterId);

    const readBack = await repository.findById(fixtures.tenantId, labOrderId);
    expect(readBack?.patientId).toBe(fixtures.patientPartyId);
    expect(readBack?.clinicalOrderId).toBe(clinicalOrderId);
    expect(readBack?.encounterId).toBe(fixtures.encounterId);

    const reused = await service.bootstrapLabOrder({
      tenantId: fixtures.tenantId,
      patientId: fixtures.patientPartyId,
      encounterId: fixtures.encounterId,
      orderId: clinicalOrderId,
      testCode: 'K',
      testName: 'Potassium',
    });

    expect(reused.reusedExisting).toBe(true);
    expect(reused.labOrderId).toBe(labOrderId);
    expect(reused.patientId).toBe(fixtures.patientPartyId);
  });
});
