import { randomUUID } from 'crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { CdsEngineService } from '../engines/cds-engine/cds-engine.service';
import type { Database } from '@/types/database.types';

jest.mock('server-only', () => ({}), { virtual: true });

jest.setTimeout(60_000);

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

type CalculationRecordParams = {
  id?: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  algorithmId: string;
  inputSnapshot: Record<string, unknown>;
  output: Record<string, unknown>;
  decision: string;
  enforcement: string;
  correlationId?: string;
  causationId?: string;
  sourceObservationReferences?: Array<Record<string, string>>;
};

type CdsCalculationWriter = {
  writeCalculationRecord(params: CalculationRecordParams): Promise<string>;
};

function calculationWriter(service: CdsEngineService): CdsCalculationWriter {
  return service as unknown as CdsCalculationWriter;
}

describeWithRealSupabase('CDS calculation persistence contract', () => {
  let supabase: SupabaseClient<Database>;
  let calculationId = '';

  beforeEach(() => {
    supabase = createSupabaseClient<Database>(getSupabaseAdminUrl(), getSupabaseAdminKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    calculationId = randomUUID();
  });

  afterEach(async () => {
    if (calculationId) {
      await supabase.from('hc_clinical_calculations').delete().eq('id', calculationId);
    }
  });

  it('persists a valid calculation id before returning it', async () => {
    const service = new CdsEngineService(supabase);
    const writer = calculationWriter(service);
    const encounterId = randomUUID();
    const patientId = randomUUID();

    const returnedId = await writer.writeCalculationRecord({
      id: calculationId,
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      encounterId,
      patientId,
      algorithmId: 'CDS_SUMMARY',
      inputSnapshot: {
        proposedDrug: 'HOSP-CDS-PERSISTENCE',
      },
      output: {
        alerts: [],
        alertCount: 0,
      },
      decision: 'PASSED',
      enforcement: 'INFORMATIONAL',
      correlationId: randomUUID(),
      causationId: randomUUID(),
    });

    expect(returnedId).toBe(calculationId);

    const { data, error } = await supabase
      .from('hc_clinical_calculations')
      .select('id, tenant_id, algorithm_id, input_data, output_data')
      .eq('id', calculationId)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: calculationId,
      tenant_id: HEALTHCARE_TEST_TENANT_ID,
      algorithm_id: 'CDS_SUMMARY',
    });
    expect(data?.input_data).toMatchObject({
      encounterId,
      patientId,
      inputSnapshot: {
        proposedDrug: 'HOSP-CDS-PERSISTENCE',
      },
    });
    expect(data?.output_data).toMatchObject({
      decision: 'PASSED',
      enforcement: 'INFORMATIONAL',
      algorithmCategory: 'CDS_CHECK',
      calculationStatus: 'COMPLETED',
    });
  });

  it('does not return an unusable calculation id when persistence fails', async () => {
    const failingSupabase = {
      from: (_table: string) => ({
        insert: async (_payload: unknown) => ({
          data: null,
          error: {
            message: 'forced calculation insert failure',
          },
        }),
      }),
    };

    const service = new CdsEngineService(
      failingSupabase as unknown as ConstructorParameters<typeof CdsEngineService>[0]
    );
    const writer = calculationWriter(service);

    await expect(writer.writeCalculationRecord({
      id: calculationId,
      tenantId: HEALTHCARE_TEST_TENANT_ID,
      encounterId: randomUUID(),
      patientId: randomUUID(),
      algorithmId: 'CDS_SUMMARY',
      inputSnapshot: {},
      output: {},
      decision: 'PASSED',
      enforcement: 'INFORMATIONAL',
    })).rejects.toThrow('Failed to persist CDS calculation: forced calculation insert failure');
  });
});
