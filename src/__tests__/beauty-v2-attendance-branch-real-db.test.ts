import { randomUUID } from 'node:crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdminKey, getSupabaseAdminUrl, requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import { ktvCheckIn, ktvCheckOut } from '@/services/attendance-actions';
import type { Database } from '@/types/database.types';
import { runRealDbSql } from './utils/real-db-sql';
import { createUserOrgUnitAccessRuntimeClient } from './utils/user-org-unit-access-runtime-client';

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));
jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
}));

type CurrentUserStub = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  tenant_id: string;
};

let supabase: SupabaseClient<Database>;
let adminSupabase: SupabaseClient<Database>;
let mockCurrentUser: CurrentUserStub | null = null;

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn(async () => mockCurrentUser),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => supabase,
}));
jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: () => supabase,
}));

jest.setTimeout(120_000);

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return value;
}

describeWithRealSupabase('Beauty V2 Attendance branch Real DB proof', () => {
  const marker = `beauty-v2-attendance-${Date.now()}`;
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const companyId = randomUUID();
  const regionId = randomUUID();
  const branchAId = randomUUID();
  const branchBId = randomUUID();
  const otherBranchId = randomUUID();
  const personId = randomUUID();
  const relationshipId = randomUUID();
  const email = `${marker}-ktv@example.test`;
  let ktvUserId = '';

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  async function cleanupStep(label: string, result: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await result;
    if (error) throw new Error(`${label} cleanup failed: ${error.message}`);
  }

  async function cleanup() {
    const currentProofTenantId = requireUuid(tenantId, 'tenant cleanup id');
    const currentProofOtherTenantId = requireUuid(otherTenantId, 'other tenant cleanup id');
    const currentProofUserId = ktvUserId ? requireUuid(ktvUserId, 'user cleanup id') : null;
    const orgUnitIds = [companyId, regionId, branchAId, branchBId, otherBranchId]
      .map((id, index) => requireUuid(id, `org unit cleanup id ${index}`))
      .map((id) => `'${id}'`)
      .join(', ');
    const userCleanupSql = currentProofUserId
      ? `DELETE FROM public.users WHERE id = '${currentProofUserId}';`
      : '';

    await runRealDbSql('current proof SQL cleanup', `
      SET statement_timeout = '120s';
      DELETE FROM public.attendance
      WHERE tenant_id IN ('${currentProofTenantId}', '${currentProofOtherTenantId}')
         OR ${currentProofUserId ? `ktv_id = '${currentProofUserId}'` : 'false'};
      DELETE FROM public.org_relationships
      WHERE tenant_id IN ('${currentProofTenantId}', '${currentProofOtherTenantId}');
      DELETE FROM public.people_directory
      WHERE tenant_id IN ('${currentProofTenantId}', '${currentProofOtherTenantId}');
      ${userCleanupSql}
      DELETE FROM public.org_units WHERE id IN (${orgUnitIds});
      DELETE FROM public.tenants WHERE id IN ('${currentProofTenantId}', '${currentProofOtherTenantId}');
    `);

    if (ktvUserId) {
      const { error } = await adminSupabase.auth.admin.deleteUser(ktvUserId);
      if (error && !error.message.toLowerCase().includes('user not found')) {
        throw new Error(`auth user cleanup failed: ${error.message}`);
      }
    }
  }

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    adminSupabase = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    supabase = adminSupabase;

    const authUser = await supabase.auth.admin.createUser({
      email,
      password: randomUUID(),
      email_confirm: true,
    });
    if (authUser.error || !authUser.data.user) {
      throw new Error(`auth user fixture failed: ${authUser.error?.message ?? 'missing auth user'}`);
    }
    ktvUserId = authUser.data.user.id;
    supabase = createUserOrgUnitAccessRuntimeClient(adminSupabase, { tenantId, userId: ktvUserId });

    await cleanupStep('tenant insert', supabase.from('tenants').insert([
      {
        id: tenantId,
        name: `${marker} tenant`,
        status: 'active',
        product_key: 'beauty_spa_v2',
        enabled_modules: { beauty_spa: true },
      },
      {
        id: otherTenantId,
        name: `${marker} other tenant`,
        status: 'active',
        product_key: 'beauty_spa_v2',
        enabled_modules: { beauty_spa: true },
      },
    ]));

    await cleanupStep('users insert', supabase.from('users').insert({
      id: ktvUserId,
      tenant_id: tenantId,
      email,
      full_name: 'Beauty Attendance Proof KTV',
      role: 'ktv',
      status: 'active',
    }));

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
        id: otherBranchId,
        tenant_id: otherTenantId,
        unit_type: 'branch',
        name: `${marker} other branch`,
        is_active: true,
      },
    ]));

    await cleanupStep('people insert', supabase.from('people_directory').insert({
      id: personId,
      tenant_id: tenantId,
      user_id: ktvUserId,
      person_type: 'employee',
      display_name: 'Beauty Attendance Proof KTV',
      is_active: true,
    }));

    await cleanupStep('relationship insert', supabase.from('org_relationships').insert({
      id: relationshipId,
      tenant_id: tenantId,
      from_id: personId,
      from_type: 'person',
      to_id: branchAId,
      to_type: 'unit',
      rel_type: 'belongs_to',
      role: 'KTV',
    }));

    mockCurrentUser = {
      id: ktvUserId,
      tenant_id: tenantId,
      email,
      full_name: 'Beauty Attendance Proof KTV',
      role: 'ktv',
      status: 'active',
    };
  });

  afterAll(async () => {
    await cleanup();
    mockCurrentUser = null;
  });

  it('proves branch-aware attendance write/read and isolation on real DB', async () => {
    const checkInResult = await ktvCheckIn(branchAId);
    expect(checkInResult.success).toBe(true);

    const attendanceA = await adminSupabase
      .from('attendance')
      .select('id, ktv_id, tenant_id, branch_id, date, status, checkout_time')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .eq('branch_id', branchAId)
      .eq('date', today)
      .single();
    expect(attendanceA.error).toBeNull();
    expect(attendanceA.data).toMatchObject({
      ktv_id: ktvUserId,
      tenant_id: tenantId,
      branch_id: branchAId,
      date: today,
    });
    expect(attendanceA.data?.checkout_time).toBeNull();

    const branchBDenied = await ktvCheckIn(branchBId);
    expect(branchBDenied).toEqual({
      success: false,
      error: 'Không có quyền chấm công tại chi nhánh này',
    });

    const otherTenantDenied = await ktvCheckIn(otherBranchId);
    expect(otherTenantDenied).toEqual({
      success: false,
      error: 'Không có quyền chấm công tại chi nhánh này',
    });

    const deniedRows = await adminSupabase
      .from('attendance')
      .select('id')
      .or(`branch_id.eq.${branchBId},branch_id.eq.${otherBranchId}`);
    expect(deniedRows.error).toBeNull();
    expect(deniedRows.data).toEqual([]);

    const checkOutResult = await ktvCheckOut(branchAId);
    expect(checkOutResult.success).toBe(true);

    const checkedOut = await adminSupabase
      .from('attendance')
      .select('tenant_id, branch_id, checkout_time')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .eq('branch_id', branchAId)
      .eq('date', today)
      .single();
    expect(checkedOut.error).toBeNull();
    expect(checkedOut.data).toMatchObject({
      tenant_id: tenantId,
      branch_id: branchAId,
    });
    expect(checkedOut.data?.checkout_time).toBeTruthy();
  });
});
