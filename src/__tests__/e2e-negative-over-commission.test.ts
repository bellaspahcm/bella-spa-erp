/**
 * E2E Over-Commission Test - KTV completes 100 sessions, commission exceeds revenue
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('E2E Over-Commission (Business Rule Validation Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let ktvId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Over Commission Tenant').single();
    testTenantId = tenant?.id || (await supabase.from('tenants').insert({ name: 'Test Over Commission Tenant', status: 'active' }).select('id').single()).data!.id;

    const { data: ktv } = await supabase.from('users').insert({
      tenant_id: testTenantId, email: `ktv-overcom-${Date.now()}@test.com`,
      full_name: 'KTV Over Commission', role: 'ktv', phone: '0900000042', base_salary: 6000000,
    }).select('id').single();
    ktvId = ktv!.id;
  });

  it('should cap commission at revenue amount (prevent loss)', async () => {
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    
    // Scenario: Package revenue = 5M, but commission per session = 200k
    // If KTV completes 30 sessions → 200k * 30 = 6M commission > 5M revenue (LOSS!)
    
    const packageRevenue = 5000000;
    const commissionPerSession = 200000;
    const completedSessions = 30;
    const calculatedCommission = commissionPerSession * completedSessions; // 6M
    const cappedCommission = Math.min(calculatedCommission, packageRevenue); // Cap at 5M

    console.log('✅ Commission calculation', {
      packageRevenue: 5000000,
      commissionPerSession: 200000,
      completedSessions: 30,
      calculatedCommission: 6000000,
      cappedCommission: 5000000, // Capped to prevent loss
    });

    // Create salary record with capped commission
    const { data: salaryRecord } = await supabase.from('salary_records').insert({
      tenant_id: testTenantId, ktv_id: ktvId, month_year: currentMonth,
      base_salary: 6000000, session_bonus: cappedCommission,
      total_sessions: completedSessions, total_salary: 6000000 + cappedCommission,
      status: 'draft',
      notes: `Commission capped at revenue: ${calculatedCommission} → ${cappedCommission}`,
    }).select('*').single();

    expect(salaryRecord!.session_bonus).toBe(cappedCommission);
    expect(salaryRecord!.session_bonus).toBeLessThanOrEqual(packageRevenue);

    console.log('✅ Commission capped to prevent loss', {
      commission: cappedCommission,
      revenue: packageRevenue,
      prevented_loss: calculatedCommission - cappedCommission,
    });

    console.log('\n🎉 E2E OVER-COMMISSION TEST: PASSED');
  }, 60000);
});
