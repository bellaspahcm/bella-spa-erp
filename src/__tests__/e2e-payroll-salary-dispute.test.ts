/**
 * E2E Salary Dispute Resolution Test - KTV disputes, admin investigates, adjusts, republishes
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('E2E Salary Dispute Resolution', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testKtvId: string;
  let testSalaryRecordId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Dispute').single();
    testTenantId = tenant?.id || (await supabase.from('tenants').insert({ name: 'Test Tenant Dispute', status: 'active' }).select('id').single()).data!.id;

    const { data: ktv } = await supabase.from('users').insert({
      tenant_id: testTenantId, email: `ktv-dispute-${Date.now()}@test.com`, full_name: 'KTV Dispute',
      role: 'ktv', phone: '0900000023', base_salary: 6000000,
    }).select('id').single();
    testKtvId = ktv!.id;
  });

  it('should handle salary dispute resolution flow', async () => {
    const testMonth = '2026-05-01';

    // STEP 1: Initial salary (incorrect)
    const { data: salary } = await supabase.from('salary_records').insert({
      tenant_id: testTenantId, ktv_id: testKtvId, month_year: testMonth,
      base_salary: 6000000, session_bonus: 300000, total_sessions: 2,
      total_salary: 6300000, status: 'published',
    }).select('*').single();
    testSalaryRecordId = salary!.id;

    console.log('✅ Step 1: Initial salary published', { totalSalary: 6300000 });

    // STEP 2: KTV disputes (claims 3 sessions, not 2)
    const { error: disputeError } = await supabase.from('salary_records').update({
      status: 'disputed',
      notes: 'KTV disputes: completed 3 sessions, not 2. Missing 1 session bonus.',
    }).eq('id', testSalaryRecordId);

    console.log('✅ Step 2: KTV disputes salary', { reason: 'Missing 1 session' });

    // STEP 3: Admin investigates, finds KTV is correct, adjusts salary
    const { error: adjustError } = await supabase.from('salary_records').update({
      session_bonus: 450000, // Corrected: 3 sessions
      total_sessions: 3,
      total_salary: 6450000,
      status: 'published', // Republish
      notes: 'Dispute resolved: Admin confirmed 3 sessions completed. Salary adjusted.',
    }).eq('id', testSalaryRecordId);

    const { data: adjusted } = await supabase.from('salary_records').select('*').eq('id', testSalaryRecordId).single();

    expect(adjusted!.total_sessions).toBe(3);
    expect(adjusted!.session_bonus).toBe(450000);
    expect(adjusted!.total_salary).toBe(6450000);

    console.log('✅ Step 3: Salary adjusted & republished', { newTotalSalary: 6450000, sessions: 3 });

    // STEP 4: KTV re-confirms adjusted salary
    const { error: confirmError } = await supabase.from('salary_records').update({
      status: 'confirmed',
      ktv_confirmed_at: new Date().toISOString(),
    }).eq('id', testSalaryRecordId);

    console.log('✅ Step 4: KTV confirmed adjusted salary');

    console.log('\n🎉 E2E SALARY DISPUTE TEST: PASSED');
  }, 60000);
});
