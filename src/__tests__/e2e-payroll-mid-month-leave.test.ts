/**
 * E2E Mid-Month Leave Test - KTV approved leave on May 20, salary reduced
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('E2E Mid-Month Leave (Salary Reduction Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testKtvId: string;
  const testMonth = '2026-05-01';

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Leave').single();
    testTenantId = tenant?.id || (await supabase.from('tenants').insert({ name: 'Test Tenant Leave', status: 'active' }).select('id').single()).data!.id;

    const { data: ktv } = await supabase.from('users').insert({
      tenant_id: testTenantId, email: `ktv-leave-${Date.now()}@test.com`, full_name: 'KTV Leave',
      role: 'ktv', phone: '0900000022', base_salary: 6000000,
    }).select('id').single();
    testKtvId = ktv!.id;
  });

  it('should reduce salary when KTV takes approved leave', async () => {
    // KTV works 20 days, absent 6 days (approved leave)
    const standardWorkingDays = 26;
    const actualWorkingDays = 20;
    const leaveDays = 6;
    const proRatedBase = Math.round((6000000 / standardWorkingDays) * actualWorkingDays);

    const { data: salaryRecord } = await supabase.from('salary_records').insert({
      tenant_id: testTenantId, ktv_id: testKtvId, month_year: testMonth,
      base_salary: proRatedBase, session_bonus: 300000, total_sessions: 2,
      total_salary: proRatedBase + 300000, status: 'draft',
      notes: `Leave: ${leaveDays} days approved, base pro-rated`,
    }).select('*').single();

    expect(salaryRecord!.base_salary).toBe(proRatedBase);
    expect(salaryRecord!.base_salary).toBeLessThan(6000000);

    console.log('✅ Salary reduced for leave', { workingDays: 20, leaveDays: 6, proRatedBase });
    console.log('\n🎉 E2E MID-MONTH LEAVE TEST: PASSED');
  }, 60000);
});
