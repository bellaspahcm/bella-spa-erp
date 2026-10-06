import { randomUUID } from 'node:crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  recalculateAndSaveSalaryRecordEngine,
} from '@/modules/hr-salary/actions/salary-recalculation-engine';
import { PAYROLL_BRANCH_MAPPING_ERRORS } from '@/modules/hr-salary/lib/salary-branch-mapping';
import { getSupabaseAdminKey, getSupabaseAdminUrl, requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { runRealDbSql } from './utils/real-db-sql';

jest.mock('server-only', () => ({}), { virtual: true });

jest.setTimeout(120_000);

type SeedClient = SupabaseClient<Database>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const hasRealSupabaseAdminEnv = () => {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
};

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

function requireUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return value;
}

describeWithRealSupabase('Beauty V2 Payroll branch Real DB proof', () => {
  const marker = `beauty-v2-payroll-branch-${Date.now()}`;
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const companyId = randomUUID();
  const regionId = randomUUID();
  const branchAId = randomUUID();
  const branchBId = randomUUID();
  const otherTenantBranchId = randomUUID();
  const successKtvEmail = `${marker}-success@example.test`;
  const mismatchKtvEmail = `${marker}-mismatch@example.test`;
  const nullBranchKtvEmail = `${marker}-null@example.test`;
  const multiBranchKtvEmail = `${marker}-multi@example.test`;
  let supabase: SeedClient;
  let successKtvId = '';
  let mismatchKtvId = '';
  let nullBranchKtvId = '';
  let multiBranchKtvId = '';
  let cleaned = false;

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const monthYear = `${today.slice(0, 7)}-01`;
  const firstDay = monthYear;
  const secondDay = `${today.slice(0, 7)}-02`;

  async function cleanupStep(label: string, result: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await result;
    if (error) throw new Error(`${label} cleanup failed: ${error.message}`);
  }

  async function createAuthUser(email: string) {
    const result = await supabase.auth.admin.createUser({
      email,
      password: randomUUID(),
      email_confirm: true,
    });
    if (result.error || !result.data.user) {
      throw new Error(`auth user fixture failed for ${email}: ${result.error?.message ?? 'missing auth user'}`);
    }

    return result.data.user.id;
  }

  async function insertAttendance(ktvId: string, date: string, branchId: string | null) {
    await cleanupStep('attendance insert', supabase.from('attendance').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      ktv_id: ktvId,
      date,
      branch_id: branchId,
      status: 'present',
      checkin_time: `${date}T08:45:00+07:00`,
      checkout_time: `${date}T18:00:00+07:00`,
    }));
  }

  async function salaryRowsFor(ktvId: string) {
    const result = await supabase
      .from('salary_records')
      .select('id, tenant_id, ktv_id, month_year, branch_id, status, total_salary')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear);
    if (result.error) throw new Error(`salary read failed: ${result.error.message}`);

    return result.data ?? [];
  }

  async function cleanup() {
    const currentTenantId = requireUuid(tenantId, 'tenant cleanup id');
    const currentOtherTenantId = requireUuid(otherTenantId, 'other tenant cleanup id');
    const authUserIds = [successKtvId, mismatchKtvId, nullBranchKtvId, multiBranchKtvId]
      .filter(Boolean)
      .map((id, index) => requireUuid(id, `auth user cleanup id ${index}`));
    const userIdsSql = authUserIds.map((id) => `'${id}'`).join(', ') || 'NULL';
    const orgUnitIdsSql = [companyId, regionId, branchAId, branchBId, otherTenantBranchId]
      .map((id, index) => requireUuid(id, `org unit cleanup id ${index}`))
      .map((id) => `'${id}'`)
      .join(', ');

    await runRealDbSql('current payroll proof SQL cleanup', `
      SET statement_timeout = '120s';
      DELETE FROM public.salary_records
      WHERE tenant_id IN ('${currentTenantId}', '${currentOtherTenantId}')
         OR ktv_id IN (${userIdsSql});
      DELETE FROM public.attendance
      WHERE tenant_id IN ('${currentTenantId}', '${currentOtherTenantId}')
         OR ktv_id IN (${userIdsSql});
      DELETE FROM public.users WHERE id IN (${userIdsSql});
      DELETE FROM public.org_units WHERE id IN (${orgUnitIdsSql});
    `);

    console.warn(
      `[Beauty V2 Payroll branch cleanup] retained tenant shells because public.timeline_events is append-only and may hold tenant FK rows: ${currentTenantId}, ${currentOtherTenantId}`,
    );

    for (const userId of authUserIds) {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error && !error.message.toLowerCase().includes('user not found')) {
        throw new Error(`auth user cleanup failed: ${error.message}`);
      }
    }

    cleaned = true;
  }

  async function assertCurrentProofResidualsZero() {
    const salaryRows = await supabase.from('salary_records').select('id').in('tenant_id', [tenantId, otherTenantId]);
    expect(salaryRows.error).toBeNull();
    expect(salaryRows.data).toEqual([]);

    const attendanceRows = await supabase.from('attendance').select('id').in('tenant_id', [tenantId, otherTenantId]);
    expect(attendanceRows.error).toBeNull();
    expect(attendanceRows.data).toEqual([]);

    const users = await supabase
      .from('users')
      .select('id')
      .in('id', [successKtvId, mismatchKtvId, nullBranchKtvId, multiBranchKtvId]);
    expect(users.error).toBeNull();
    expect(users.data).toEqual([]);

    const orgUnits = await supabase
      .from('org_units')
      .select('id')
      .in('id', [companyId, regionId, branchAId, branchBId, otherTenantBranchId]);
    expect(orgUnits.error).toBeNull();
    expect(orgUnits.data).toEqual([]);

    const orgUnitsAfterCleanup = await supabase
      .from('org_units')
      .select('id')
      .in('tenant_id', [tenantId, otherTenantId]);
    expect(orgUnitsAfterCleanup.error).toBeNull();
    expect(orgUnitsAfterCleanup.data).toEqual([]);
  }

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    successKtvId = await createAuthUser(successKtvEmail);
    mismatchKtvId = await createAuthUser(mismatchKtvEmail);
    nullBranchKtvId = await createAuthUser(nullBranchKtvEmail);
    multiBranchKtvId = await createAuthUser(multiBranchKtvEmail);

    await cleanupStep('tenant insert', supabase.from('tenants').insert([
      {
        id: tenantId,
        name: `${marker} tenant`,
        status: 'active',
        product_key: 'beauty_spa_v2',
        enabled_modules: { beauty_spa: true, payroll: true },
        salary_config: {
          bonus_5_star: 50000,
          bonus_4_5_star: 30000,
          bonus_4_star: 10000,
          kpi_target_sessions: 30,
          kpi_bonus_amount: 1000000,
          penalty_late_per_day: 50000,
          penalty_absent_per_day: 200000,
        },
      },
      {
        id: otherTenantId,
        name: `${marker} other tenant`,
        status: 'active',
        product_key: 'beauty_spa_v2',
        enabled_modules: { beauty_spa: true, payroll: true },
      },
    ]));

    await cleanupStep('org units insert', supabase.from('org_units').insert([
      {
        id: companyId,
        tenant_id: tenantId,
        unit_type: 'company',
        name: `${marker} company`,
        is_active: true,
      },
      {
        id: regionId,
        tenant_id: tenantId,
        unit_type: 'region',
        name: `${marker} region`,
        parent_id: companyId,
        is_active: true,
      },
      {
        id: branchAId,
        tenant_id: tenantId,
        unit_type: 'branch',
        name: `${marker} branch A`,
        parent_id: regionId,
        is_active: true,
      },
      {
        id: branchBId,
        tenant_id: tenantId,
        unit_type: 'branch',
        name: `${marker} branch B`,
        parent_id: regionId,
        is_active: true,
      },
      {
        id: otherTenantBranchId,
        tenant_id: otherTenantId,
        unit_type: 'branch',
        name: `${marker} other tenant branch`,
        is_active: true,
      },
    ]));

    await cleanupStep('users insert', supabase.from('users').insert([
      {
        id: successKtvId,
        tenant_id: tenantId,
        email: successKtvEmail,
        full_name: 'Beauty Payroll Branch Success KTV',
        role: 'ktv',
        status: 'active',
        base_salary: 6000000,
        position_tier: 'junior',
        hire_date: `${today.slice(0, 4)}-01-01`,
      },
      {
        id: mismatchKtvId,
        tenant_id: tenantId,
        email: mismatchKtvEmail,
        full_name: 'Beauty Payroll Branch Mismatch KTV',
        role: 'ktv',
        status: 'active',
        base_salary: 6000000,
        position_tier: 'junior',
        hire_date: `${today.slice(0, 4)}-01-01`,
      },
      {
        id: nullBranchKtvId,
        tenant_id: tenantId,
        email: nullBranchKtvEmail,
        full_name: 'Beauty Payroll Null Branch KTV',
        role: 'ktv',
        status: 'active',
        base_salary: 6000000,
        position_tier: 'junior',
        hire_date: `${today.slice(0, 4)}-01-01`,
      },
      {
        id: multiBranchKtvId,
        tenant_id: tenantId,
        email: multiBranchKtvEmail,
        full_name: 'Beauty Payroll Multi Branch KTV',
        role: 'ktv',
        status: 'active',
        base_salary: 6000000,
        position_tier: 'junior',
        hire_date: `${today.slice(0, 4)}-01-01`,
      },
    ]));
  });

  afterAll(async () => {
    if (!cleaned) {
      await cleanup();
    }
  });

  it('proves salary branch persistence and deny-before-write cases on real DB', async () => {
    await insertAttendance(successKtvId, firstDay, branchAId);
    const success = await recalculateAndSaveSalaryRecordEngine(
      supabase,
      successKtvId,
      monthYear,
      tenantId,
      { expectedBranchId: branchAId },
    );
    expect(success.success).toBe(true);

    const successSalaryRows = await salaryRowsFor(successKtvId);
    expect(successSalaryRows).toHaveLength(1);
    expect(successSalaryRows[0]).toMatchObject({
      tenant_id: tenantId,
      ktv_id: successKtvId,
      month_year: monthYear,
      branch_id: branchAId,
      status: 'draft',
    });
    expect(Number(successSalaryRows[0].total_salary ?? 0)).toBeGreaterThan(0);

    await insertAttendance(mismatchKtvId, firstDay, branchAId);
    await expect(recalculateAndSaveSalaryRecordEngine(
      supabase,
      mismatchKtvId,
      monthYear,
      tenantId,
      { expectedBranchId: otherTenantBranchId },
    )).rejects.toThrow(PAYROLL_BRANCH_MAPPING_ERRORS.BRANCH_CONTEXT_MISMATCH);
    expect(await salaryRowsFor(mismatchKtvId)).toEqual([]);

    await insertAttendance(nullBranchKtvId, firstDay, null);
    await expect(recalculateAndSaveSalaryRecordEngine(
      supabase,
      nullBranchKtvId,
      monthYear,
      tenantId,
    )).rejects.toThrow(PAYROLL_BRANCH_MAPPING_ERRORS.BRANCH_NOT_PROVEN);
    expect(await salaryRowsFor(nullBranchKtvId)).toEqual([]);

    await insertAttendance(multiBranchKtvId, firstDay, branchAId);
    await insertAttendance(multiBranchKtvId, secondDay, branchBId);
    await expect(recalculateAndSaveSalaryRecordEngine(
      supabase,
      multiBranchKtvId,
      monthYear,
      tenantId,
    )).rejects.toThrow(PAYROLL_BRANCH_MAPPING_ERRORS.MULTI_BRANCH_PERIOD_NOT_SUPPORTED);
    expect(await salaryRowsFor(multiBranchKtvId)).toEqual([]);
  });

  it('cleans up current proof rows with zero residual', async () => {
    await cleanup();
    await assertCurrentProofResidualsZero();
  });
});
