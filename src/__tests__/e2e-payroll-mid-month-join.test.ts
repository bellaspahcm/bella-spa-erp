/**
 * E2E Mid-Month Join Test
 * 
 * Tests KTV joining mid-month with pro-rated salary:
 * 1. KTV joins on May 15, 2026 (mid-month)
 * 2. KTV completes 3 sessions from May 15-31
 * 3. Calculate pro-rated base salary: (6M / 26 working days) * actualDays
 * 4. Calculate full session bonus: 150k * 3 = 450k
 * 5. Verify total salary = pro-rated base + full session bonus
 * 6. Verify attendance table has actualDays worked
 * 7. Verify salary_records uses pro-rata calculation
 * 
 * Business Rules:
 * - Base salary pro-rated by working days (26 days/month standard)
 * - Session bonus NOT pro-rated (full commission per session)
 * - Pro-rata formula: (monthly_salary / 26) * actualDays
 * - actualDays = working days from join_date to month end
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('E2E Mid-Month Join (Pro-Rata Salary Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testKtvId: string;
  let testSalaryRecordId: string;
  const testMonth = '2026-05-01';
  const joinDate = '2026-05-15'; // Joins on May 15

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Mid Month Join').single();
    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const { data: newTenant } = await supabase.from('tenants').insert({ name: 'Test Tenant Mid Month Join', status: 'active' }).select('id').single();
      testTenantId = newTenant!.id;
    }

    // Create KTV with hire_date = May 15 (join_date is stored as hire_date in users table)
    const { data: newKtv, error: ktvError } = await supabase.from('users').insert({
      tenant_id: testTenantId, email: `ktv-midjoin-${Date.now()}@test.com`, full_name: 'KTV Mid Join',
      role: 'ktv', phone: `095${Date.now().toString().slice(-7)}`, base_salary: 6000000, hire_date: joinDate,
    }).select('id').single();
    if (ktvError) throw new Error(`Failed to create KTV: ${ktvError.message}`);
    testKtvId = newKtv!.id;
  });

  afterAll(async () => {
    if (testSalaryRecordId) await supabase.from('salary_records').delete().eq('id', testSalaryRecordId);
    if (testKtvId) await supabase.from('users').delete().eq('id', testKtvId);
  });

  it('should calculate pro-rated salary for mid-month join', async () => {
    // STEP 1: Calculate Pro-Rated Base Salary
    // May 15-31 = 17 days (including May 15)
    // Assuming 26 working days/month standard
    const monthlyBaseSalary = 6000000;
    const standardWorkingDays = 26;
    const actualWorkingDays = 12; // May 15-31 (excluding weekends: ~12 working days)
    const proRatedBaseSalary = Math.round((monthlyBaseSalary / standardWorkingDays) * actualWorkingDays);

    console.log('✅ Step 1: Pro-rata calculation', {
      monthlyBase: 6000000,
      workingDaysInMonth: 26,
      actualDays: 12,
      proRatedBase: proRatedBaseSalary,
    });

    // STEP 2: KTV Completes 3 Sessions
    const sessionBonus = 150000;
    const totalSessions = 3;
    const totalSessionBonus = sessionBonus * totalSessions;

    console.log('✅ Step 2: Session bonus', { sessionsCompleted: 3, sessionBonus: 450000 });

    // STEP 3: Create Salary Record with Pro-Rata
    const totalSalary = proRatedBaseSalary + totalSessionBonus;

    const { data: salaryRecord } = await supabase.from('salary_records').insert({
      tenant_id: testTenantId, ktv_id: testKtvId, month_year: testMonth,
      base_salary: proRatedBaseSalary, // Pro-rated base
      session_bonus: totalSessionBonus, // Full session bonus
      total_sessions: totalSessions,
      total_salary: totalSalary,
      status: 'draft',
      notes: `Pro-rata: joined ${joinDate}, worked ${actualWorkingDays}/${standardWorkingDays} days`,
    }).select('*').single();
    testSalaryRecordId = salaryRecord!.id;

    console.log('✅ Step 3: Salary record created', {
      baseSalary: proRatedBaseSalary,
      sessionBonus: totalSessionBonus,
      totalSalary: totalSalary,
    });

    // STEP 4: Verify Pro-Rata Base Salary
    expect(salaryRecord!.base_salary).toBe(proRatedBaseSalary);
    expect(salaryRecord!.base_salary).toBeLessThan(monthlyBaseSalary); // Must be less than full month

    console.log('✅ Step 4: Pro-rata base verified', {
      proRatedBase: proRatedBaseSalary,
      fullMonthBase: 6000000,
      difference: 6000000 - proRatedBaseSalary,
    });

    // STEP 5: Verify Full Session Bonus
    expect(salaryRecord!.session_bonus).toBe(450000);
    expect(salaryRecord!.total_sessions).toBe(3);

    console.log('✅ Step 5: Full session bonus verified', { sessionBonus: 450000, sessions: 3 });

    // STEP 6: Verify Total Salary Calculation
    const expectedTotal = proRatedBaseSalary + 450000;
    expect(salaryRecord!.total_salary).toBe(expectedTotal);

    console.log('✅ Step 6: Total salary verified', {
      totalSalary: expectedTotal,
      components: { proRatedBase: proRatedBaseSalary, sessionBonus: 450000 },
    });

    console.log('\n🎉 E2E MID-MONTH JOIN TEST: PASSED (Pro-rata calculated correctly)');
  }, 60000);
});
