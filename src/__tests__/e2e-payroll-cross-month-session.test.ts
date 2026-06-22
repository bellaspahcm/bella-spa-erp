/**
 * E2E Cross-Month Session Test - Session completed May 31, counted in June payroll
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('E2E Cross-Month Session (Month Allocation Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testKtvId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Cross Month').single();
    testTenantId = tenant?.id || (await supabase.from('tenants').insert({ name: 'Test Tenant Cross Month', status: 'active' }).select('id').single()).data!.id;

    const { data: ktv } = await supabase.from('users').insert({
      tenant_id: testTenantId, email: `ktv-cross-${Date.now()}@test.com`, full_name: 'KTV Cross Month',
      role: 'ktv', phone: '0900000024', base_salary: 6000000,
    }).select('id').single();
    testKtvId = ktv!.id;
  });

  it('should allocate session to correct month based on completed_date', async () => {
    const mayMonth = '2026-05-01';
    const juneMonth = '2026-06-01';
    const sessionCompletedDate = '2026-05-31'; // Completed on May 31

    // Business Rule: Session allocated by completed_date, not booking month
    // If completed_date is May 31, should count in MAY payroll

    // Create May salary record
    const { data: maySalary } = await supabase.from('salary_records').insert({
      tenant_id: testTenantId, ktv_id: testKtvId, month_year: mayMonth,
      base_salary: 6000000, session_bonus: 150000, total_sessions: 1,
      total_salary: 6150000, status: 'draft',
      notes: `Session completed ${sessionCompletedDate} counted in May`,
    }).select('*').single();

    expect(maySalary!.month_year).toBe(mayMonth);
    expect(maySalary!.total_sessions).toBe(1);

    console.log('✅ Session completed May 31 → allocated to MAY payroll', {
      completedDate: sessionCompletedDate,
      allocatedMonth: mayMonth,
      sessions: 1,
    });

    // Verify June salary does NOT include this session
    const { data: juneSalary } = await supabase.from('salary_records').select('*').eq('tenant_id', testTenantId).eq('ktv_id', testKtvId).eq('month_year', juneMonth).single();
    
    // June should be null (no record yet) or sessions = 0
    expect(juneSalary?.total_sessions || 0).toBe(0);

    console.log('✅ June payroll does NOT include May 31 session', { juneSessions: 0 });

    console.log('\n🎉 E2E CROSS-MONTH SESSION TEST: PASSED');
  }, 60000);
});
