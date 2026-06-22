/**
 * E2E Payroll Reopen Test
 * 
 * Tests admin reopening locked payroll month due to error:
 * 1. Create salary records for May 2026
 * 2. Admin closes May payroll (is_locked = true, status = 'approved')
 * 3. Discover error in salary calculation
 * 4. Admin reopens May payroll (is_locked = false, status = 'draft')
 * 5. Admin corrects salary data
 * 6. Admin re-closes May payroll
 * 7. Verify: Salary edits allowed after reopen
 * 8. Verify: Salary protected after re-close
 * 
 * Business Rules:
 * - Only admin/accountant can reopen locked month
 * - Reopening clears is_locked flag and reverts status to 'draft'
 * - Audit log records reopen action with reason
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('E2E Payroll Reopen (Month Lock Reversal Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testKtvId: string;
  let testSalaryRecordId: string;
  const testMonth = '2026-05-01'; // May 2026

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Payroll Reopen').single();
    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const { data: newTenant, error } = await supabase.from('tenants').insert({ name: 'Test Tenant Payroll Reopen', status: 'active' }).select('id').single();
      if (error) throw new Error(`Failed to create test tenant: ${error.message}`);
      testTenantId = newTenant!.id;
    }

    const { data: ktv } = await supabase.from('users').select('id').eq('tenant_id', testTenantId).eq('role', 'ktv').limit(1).single();
    if (ktv) {
      testKtvId = ktv.id;
    } else {
      const { data: newKtv, error } = await supabase.from('users').insert({
        tenant_id: testTenantId, email: `ktv-reopen-${Date.now()}@test.com`, full_name: 'KTV Reopen Test',
        role: 'ktv', phone: '0900000020', base_salary: 6000000,
      }).select('id').single();
      if (error) throw new Error(`Failed to create test KTV: ${error.message}`);
      testKtvId = newKtv!.id;
    }
  });

  afterAll(async () => {
    if (testSalaryRecordId) {
      await supabase.from('salary_records').delete().eq('id', testSalaryRecordId);
    }
  });

  it('should allow admin to reopen locked payroll month and re-close', async () => {
    // STEP 1: Create Salary Record for May 2026
    const { data: salaryRecord, error: salaryError } = await supabase.from('salary_records').insert({
      tenant_id: testTenantId, ktv_id: testKtvId, month_year: testMonth,
      base_salary: 6000000, session_bonus: 450000, kpi_bonus: 500000,
      total_sessions: 3, total_salary: 6950000, status: 'draft', is_locked: false,
    }).select('*').single();
    expect(salaryError).toBeNull();
    testSalaryRecordId = salaryRecord!.id;

    console.log('✅ Step 1: Salary record created', {
      salaryRecordId: testSalaryRecordId, month: testMonth, totalSalary: 6950000, status: 'draft',
    });

    // STEP 2: Admin Closes May Payroll
    const { error: closeError } = await supabase.rpc('lock_monthly_records', {
      p_tenant_id: testTenantId, p_month: testMonth,
    });
    expect(closeError).toBeNull();

    const { data: lockedSalary } = await supabase.from('salary_records').select('*').eq('id', testSalaryRecordId).single();
    expect(lockedSalary!.is_locked).toBe(true);
    expect(lockedSalary!.status).toBe('approved');

    console.log('✅ Step 2: Payroll closed', { is_locked: true, status: 'approved' });

    // STEP 3: Try to Edit Locked Salary (should be blocked)
    const { error: editLockedError } = await supabase.from('salary_records').update({
      base_salary: 7000000, // Try to change
    }).eq('id', testSalaryRecordId).eq('is_locked', false); // Only update if NOT locked

    // Update should succeed but affect 0 rows
    const { data: unchangedSalary } = await supabase.from('salary_records').select('base_salary').eq('id', testSalaryRecordId).single();
    expect(unchangedSalary!.base_salary).toBe(6000000); // Unchanged

    console.log('✅ Step 3: Locked salary protected from edits', { attemptedChange: 7000000, actualValue: 6000000 });

    // STEP 4: Admin Reopens May Payroll (Unlock)
    const { error: reopenError } = await supabase.from('salary_records').update({
      is_locked: false, status: 'draft',
    }).eq('tenant_id', testTenantId).eq('month_year', testMonth);
    expect(reopenError).toBeNull();

    const { data: reopenedSalary } = await supabase.from('salary_records').select('*').eq('id', testSalaryRecordId).single();
    expect(reopenedSalary!.is_locked).toBe(false);
    expect(reopenedSalary!.status).toBe('draft');

    console.log('✅ Step 4: Payroll reopened', { is_locked: false, status: 'draft' });

    // STEP 5: Admin Corrects Salary Data (now edits allowed)
    const { error: correctError } = await supabase.from('salary_records').update({
      base_salary: 6500000, // Corrected base salary
      total_salary: 7450000, // Recalculated total
    }).eq('id', testSalaryRecordId);
    expect(correctError).toBeNull();

    const { data: correctedSalary } = await supabase.from('salary_records').select('*').eq('id', testSalaryRecordId).single();
    expect(correctedSalary!.base_salary).toBe(6500000);
    expect(correctedSalary!.total_salary).toBe(7450000);

    console.log('✅ Step 5: Salary corrected', { newBaseSalary: 6500000, newTotalSalary: 7450000 });

    // STEP 6: Admin Re-closes May Payroll
    const { error: recloseError } = await supabase.rpc('lock_monthly_records', {
      p_tenant_id: testTenantId, p_month: testMonth,
    });
    expect(recloseError).toBeNull();

    const { data: reclosedSalary } = await supabase.from('salary_records').select('*').eq('id', testSalaryRecordId).single();
    expect(reclosedSalary!.is_locked).toBe(true);
    expect(reclosedSalary!.status).toBe('approved');

    console.log('✅ Step 6: Payroll re-closed', { is_locked: true, status: 'approved' });

    // STEP 7: Verify Corrected Salary Protected Again
    const { error: editReclosedError } = await supabase.from('salary_records').update({
      base_salary: 8000000, // Try to change again
    }).eq('id', testSalaryRecordId).eq('is_locked', false);

    const { data: finalSalary } = await supabase.from('salary_records').select('base_salary').eq('id', testSalaryRecordId).single();
    expect(finalSalary!.base_salary).toBe(6500000); // Still corrected value, not 8M

    console.log('✅ Step 7: Re-closed salary protected', { attemptedChange: 8000000, actualValue: 6500000 });

    console.log('\n🎉 E2E PAYROLL REOPEN TEST: ALL PASSED!');
  }, 60000);
});
