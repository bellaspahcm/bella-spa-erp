/**
 * Supabase Connection Smoke Test
 * 
 * Minimal test to verify Supabase credentials before running full integration tests.
 * 
 * Tests:
 * 1. Client creation
 * 2. Authentication
 * 3. Simple query (count)
 * 4. Insert test row
 * 5. Cleanup
 * 
 * If this test fails, all integration tests will fail.
 * 
 * @module platform/healthcare/engines/encounter-engine/__tests__
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Skip if no credentials
const describeSmoke = SUPABASE_URL && SUPABASE_KEY ? describe : describe.skip;

describeSmoke('Supabase Connection Smoke Test', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  const TEST_TENANT = 'smoke-test-tenant';
  const TEST_PATIENT = 'smoke-test-patient';
  let testEncounterId: string | null = null;

  beforeAll(() => {
    console.log('\n[Smoke Test] Supabase URL:', SUPABASE_URL);
    console.log('[Smoke Test] Key format:', SUPABASE_KEY.substring(0, 20) + '...');
    console.log('[Smoke Test] Key length:', SUPABASE_KEY.length);
    
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testEncounterId) {
      await supabase
        .from('hc_encounters')
        .delete()
        .eq('id', testEncounterId);
    }
  });

  it('should create Supabase client successfully', () => {
    expect(supabase).toBeDefined();
    expect(supabase.from).toBeDefined();
  });

  it('should authenticate and query database (count)', async () => {
    const { data, error, count } = await supabase
      .from('hc_encounters')
      .select('*', { count: 'exact', head: true });

    console.log('[Smoke Test] Query result:', { error: error?.message, count });

    if (error) {
      console.error('[Smoke Test] ERROR:', error);
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(0);
  }, 10000);

  it('should insert a test encounter', async () => {
    const testEncounter = {
      tenant_id: TEST_TENANT,
      patient_id: TEST_PATIENT,
      encounter_class: 'AMB' as const,
      encounter_type: 'smoke-test',
      status: 'planned' as const,
      start_date_time: new Date().toISOString(),
      created_by: 'smoke-test-user',
      updated_by: 'smoke-test-user',
    };

    const { data, error } = await supabase
      .from('hc_encounters')
      .insert(testEncounter)
      .select('id')
      .single();

    console.log('[Smoke Test] Insert result:', { error: error?.message, id: data?.id });

    if (error) {
      console.error('[Smoke Test] Insert ERROR:', error);
      throw new Error(`Insert failed: ${error.message}`);
    }

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.id).toBeDefined();

    testEncounterId = data!.id;
  }, 10000);

  it('should query the inserted encounter', async () => {
    expect(testEncounterId).not.toBeNull();

    const { data, error } = await supabase
      .from('hc_encounters')
      .select('*')
      .eq('id', testEncounterId!)
      .single();

    console.log('[Smoke Test] Select result:', { error: error?.message, found: !!data });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.patient_id).toBe(TEST_PATIENT);
    expect(data!.encounter_type).toBe('smoke-test');
  }, 10000);

  it('should delete the test encounter', async () => {
    expect(testEncounterId).not.toBeNull();

    const { error } = await supabase
      .from('hc_encounters')
      .delete()
      .eq('id', testEncounterId!);

    console.log('[Smoke Test] Delete result:', { error: error?.message });

    expect(error).toBeNull();

    // Verify deletion
    const { data: verifyData } = await supabase
      .from('hc_encounters')
      .select('id')
      .eq('id', testEncounterId!)
      .maybeSingle();

    expect(verifyData).toBeNull();
  }, 10000);
});
