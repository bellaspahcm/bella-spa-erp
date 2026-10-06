import { randomUUID } from 'node:crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { assignBeautyStaffToBranch, createBeautyBranch, createBeautyCompany } from '@/services/beauty-chain-actions';
import { getBeautyRuntimeBranchContext, selectBeautyRuntimeBranch } from '@/services/beauty-runtime-branch-actions';
import { ktvCheckIn } from '@/services/attendance-actions';
import { getSupabaseAdminKey, getSupabaseAdminUrl, requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));
jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
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
let ktvSupabase: SupabaseClient<Database>;
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

describeWithRealSupabase('Beauty V2 Tenant Chain Runtime Real DB E2E', () => {
  const marker = `beauty-v2-chain-runtime-${Date.now()}`;
  const tenantId = randomUUID();
  const adminEmail = `${marker}-admin@example.test`;
  const ktvEmail = `${marker}-ktv@example.test`;
  const adminPassword = `${randomUUID()}A1!`;
  const ktvPassword = `${randomUUID()}A1!`;
  let adminUserId = '';
  let ktvUserId = '';
  let branchAId = '';
  let branchBId = '';

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  async function cleanup() {
    const currentTenantId = requireUuid(tenantId, 'tenant cleanup id');
    const userIds = [adminUserId, ktvUserId].filter(Boolean).map((id, index) => requireUuid(id, `user cleanup id ${index}`));

    await adminSupabase.from('attendance').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('org_relationships').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('people_directory').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('users').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('org_units').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('tenants').delete().eq('id', currentTenantId);

    for (const userId of userIds) {
      const { error } = await adminSupabase.auth.admin.deleteUser(userId);
      if (error && !error.message.toLowerCase().includes('user not found')) {
        throw new Error(`auth user cleanup failed: ${error.message}`);
      }
    }
  }

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY is required for runtime auth proof');
    }

    adminSupabase = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    supabase = adminSupabase;

    const [adminAuth, ktvAuth] = await Promise.all([
      adminSupabase.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true }),
      adminSupabase.auth.admin.createUser({ email: ktvEmail, password: ktvPassword, email_confirm: true }),
    ]);
    if (adminAuth.error || !adminAuth.data.user) {
      throw new Error(`admin auth user fixture failed: ${adminAuth.error?.message ?? 'missing auth user'}`);
    }
    if (ktvAuth.error || !ktvAuth.data.user) {
      throw new Error(`ktv auth user fixture failed: ${ktvAuth.error?.message ?? 'missing auth user'}`);
    }

    adminUserId = adminAuth.data.user.id;
    ktvUserId = ktvAuth.data.user.id;

    const { error: tenantError } = await adminSupabase.from('tenants').insert({
      id: tenantId,
      name: `${marker} tenant`,
      status: 'active',
      product_key: 'beauty_spa_v2',
      enabled_modules: { beauty_spa: true },
    });
    if (tenantError) throw new Error(`tenant fixture failed: ${tenantError.message}`);

    const { error: usersError } = await adminSupabase.from('users').insert([
      {
        id: adminUserId,
        tenant_id: tenantId,
        email: adminEmail,
        full_name: 'Beauty Chain Runtime Admin',
        role: 'admin',
        status: 'active',
      },
      {
        id: ktvUserId,
        tenant_id: tenantId,
        email: ktvEmail,
        full_name: 'Beauty Chain Runtime KTV',
        role: 'ktv',
        status: 'active',
      },
    ]);
    if (usersError) throw new Error(`users fixture failed: ${usersError.message}`);

    ktvSupabase = createSupabaseClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ktvSignIn = await ktvSupabase.auth.signInWithPassword({
      email: ktvEmail,
      password: ktvPassword,
    });
    if (ktvSignIn.error) {
      throw new Error(`ktv auth sign-in failed: ${ktvSignIn.error.message}`);
    }
  });

  afterAll(async () => {
    await cleanup();
    mockCurrentUser = null;
  });

  it('creates chain, resolves allowed branch, writes business record, and denies another branch', async () => {
    mockCurrentUser = {
      id: adminUserId,
      tenant_id: tenantId,
      email: adminEmail,
      full_name: 'Beauty Chain Runtime Admin',
      role: 'admin',
      status: 'active',
    };
    supabase = adminSupabase;

    const companyResult = await createBeautyCompany({ name: `${marker} company`, code: `${marker}-co` });
    expect(companyResult.success).toBe(true);
    if (!companyResult.success) throw new Error(companyResult.error);

    const branchAResult = await createBeautyBranch({
      companyId: companyResult.data.id,
      name: `${marker} Branch A`,
      code: `${marker}-a`,
    });
    expect(branchAResult.success).toBe(true);
    if (!branchAResult.success) throw new Error(branchAResult.error);
    branchAId = branchAResult.data.id;

    const branchBResult = await createBeautyBranch({
      companyId: companyResult.data.id,
      name: `${marker} Branch B`,
      code: `${marker}-b`,
    });
    expect(branchBResult.success).toBe(true);
    if (!branchBResult.success) throw new Error(branchBResult.error);
    branchBId = branchBResult.data.id;

    const assignmentResult = await assignBeautyStaffToBranch({ userId: ktvUserId, branchId: branchAId });
    expect(assignmentResult).toEqual({
      success: true,
      data: {
        relationshipId: expect.any(String),
        personId: expect.any(String),
        branchId: branchAId,
      },
    });

    supabase = ktvSupabase;
    const access = await supabase
      .from('user_org_unit_access')
      .select('user_id, tenant_id, org_unit_id, root_org_unit_id, access_source')
      .eq('tenant_id', tenantId)
      .eq('user_id', ktvUserId)
      .eq('org_unit_id', branchAId)
      .maybeSingle();
    expect(access.error).toBeNull();
    expect(access.data).toMatchObject({
      user_id: ktvUserId,
      tenant_id: tenantId,
      org_unit_id: branchAId,
    });

    mockCurrentUser = {
      id: ktvUserId,
      tenant_id: tenantId,
      email: ktvEmail,
      full_name: 'Beauty Chain Runtime KTV',
      role: 'ktv',
      status: 'active',
    };

    const runtimeContext = await getBeautyRuntimeBranchContext();
    expect(runtimeContext).toEqual({
      success: true,
      data: {
        branches: [expect.objectContaining({ id: branchAId })],
        activeBranchId: branchAId,
        requiresSelection: false,
      },
    });

    await expect(selectBeautyRuntimeBranch(branchBId)).resolves.toEqual({
      success: false,
      error: 'Không có quyền thao tác tại chi nhánh này.',
    });

    const deniedCheckIn = await ktvCheckIn(branchBId);
    expect(deniedCheckIn).toEqual({
      success: false,
      error: 'Không có quyền chấm công tại chi nhánh này',
    });

    const allowedCheckIn = await ktvCheckIn(branchAId);
    expect(allowedCheckIn.success).toBe(true);

    const attendance = await supabase
      .from('attendance')
      .select('id, ktv_id, tenant_id, branch_id, date')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .eq('branch_id', branchAId)
      .eq('date', today)
      .single();
    expect(attendance.error).toBeNull();
    expect(attendance.data).toMatchObject({
      ktv_id: ktvUserId,
      tenant_id: tenantId,
      branch_id: branchAId,
      date: today,
    });

    const branchBAttendance = await supabase
      .from('attendance')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .eq('branch_id', branchBId);
    expect(branchBAttendance.error).toBeNull();
    expect(branchBAttendance.data).toEqual([]);
  });
});
