import { randomUUID } from 'node:crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { completeSession } from '@/core/services/order';
import { getSupabaseAdminKey, getSupabaseAdminUrl, requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { createAuthenticatedClient } from '../../tests/utils/test-jwt-helper';
import { runRealDbSql } from './utils/real-db-sql';
import { createUserOrgUnitAccessRuntimeClient } from './utils/user-org-unit-access-runtime-client';

jest.mock('server-only', () => ({}), { virtual: true });

type CurrentUserStub = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  tenant_id: string;
};

let mockCurrentUser: CurrentUserStub | null = null;
let supabaseForRuntime: SupabaseClient<Database>;

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn(async () => mockCurrentUser),
}));

jest.setTimeout(90_000);

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

jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: jest.fn(async () => supabaseForRuntime),
}));

describeWithRealSupabase('Beauty V2 go-live payroll and commission Real DB proof', () => {
  const marker = `beauty-v2-payroll-proof-${Date.now()}`;
  const adminEmail = `${marker}-admin@example.test`;
  const ktvEmail = `${marker}-ktv@example.test`;
  const otherEmail = `${marker}-other@example.test`;
  const customerId = randomUUID();
  const bookingId = randomUUID();
  const sessionId = randomUUID();
  const attendanceId = randomUUID();
  const branchId = randomUUID();
  const ktvPersonId = randomUUID();
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const monthYear = `${today.slice(0, 7)}-01`;
  const lastDayOfMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)
    .getDate()
    .toString()
    .padStart(2, '0');

  let supabase: SeedClient;
  let adminUserId = '';
  let ktvUserId = '';
  let otherUserId = '';

  async function createProofTenant(id: string, name: string) {
    const created = await supabase
      .from('tenants')
      .insert({
        id,
        name,
        status: 'active',
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
      })
      .select('id')
      .single();
    if (created.error || !created.data) {
      throw new Error(`tenant create failed: ${created.error?.message || 'missing tenant id'}`);
    }
  }

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

  async function deleteAuthUser(userId: string) {
    if (!userId) return;
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error && !error.message.toLowerCase().includes('user not found')) {
      throw new Error(`auth user cleanup failed: ${error.message}`);
    }
  }

  async function cleanup() {
    const userIds = [adminUserId, ktvUserId, otherUserId].filter(Boolean);
    const currentUserIds = userIds
      .map((id, index) => requireUuid(id, `user cleanup id ${index}`))
      .map((id) => `'${id}'`)
      .join(', ');
    const currentUserFilter = currentUserIds
      ? `id IN (${currentUserIds}) OR email IN ('${adminEmail}', '${ktvEmail}', '${otherEmail}')`
      : `email IN ('${adminEmail}', '${ktvEmail}', '${otherEmail}')`;

    await runRealDbSql('current go-live payroll proof SQL cleanup', `
      SET statement_timeout = '120s';
      DELETE FROM public.accounting_outbox
      WHERE tenant_id = '${requireUuid(tenantId, 'tenant cleanup id')}'
         OR reference_id = '${requireUuid(sessionId, 'session cleanup id')}';
      DELETE FROM public.session_reviews
      WHERE tenant_id = '${requireUuid(tenantId, 'tenant cleanup id')}';
      DELETE FROM public.salary_records
      WHERE tenant_id = '${requireUuid(tenantId, 'tenant cleanup id')}'
         OR ${currentUserIds ? `ktv_id IN (${currentUserIds})` : 'false'};
      DELETE FROM public.attendance
      WHERE tenant_id = '${requireUuid(tenantId, 'tenant cleanup id')}'
         OR ${currentUserIds ? `ktv_id IN (${currentUserIds})` : 'false'};
      DELETE FROM public.session_logs
      WHERE id = '${requireUuid(sessionId, 'session cleanup id')}'
         OR booking_id = '${requireUuid(bookingId, 'booking cleanup id')}';
      DELETE FROM public.bookings
      WHERE id = '${requireUuid(bookingId, 'booking cleanup id')}';
      DELETE FROM public.customers
      WHERE id = '${requireUuid(customerId, 'customer cleanup id')}';
      DELETE FROM public.accounting_periods
      WHERE tenant_id = '${requireUuid(tenantId, 'tenant cleanup id')}'
        AND name LIKE '${marker}%';
      DELETE FROM public.org_relationships
      WHERE from_id = '${requireUuid(ktvPersonId, 'person cleanup id')}'
         OR to_id = '${requireUuid(branchId, 'branch cleanup id')}';
      DELETE FROM public.people_directory
      WHERE id = '${requireUuid(ktvPersonId, 'person cleanup id')}';
      DELETE FROM public.users WHERE ${currentUserFilter};
      DELETE FROM public.org_units
      WHERE id = '${requireUuid(branchId, 'branch cleanup id')}';
    `);

    if (userIds.length > 0) {
      for (const userId of userIds) {
        await deleteAuthUser(userId);
      }
    }
  }

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    supabaseForRuntime = supabase;
    await createProofTenant(tenantId, `${marker} tenant`);
    await createProofTenant(otherTenantId, `${marker} other tenant`);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    mockCurrentUser = null;
  });

  it('proves completed Beauty service reads attendance, recalculates payroll, and records session commission', async () => {
    const tenantUpdate = await supabase
      .from('tenants')
      .update({
        status: 'active',
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
      })
      .in('id', [tenantId, otherTenantId]);
    expect(tenantUpdate.error).toBeNull();

    adminUserId = await createAuthUser(adminEmail);
    ktvUserId = await createAuthUser(ktvEmail);
    otherUserId = await createAuthUser(otherEmail);
    supabaseForRuntime = createUserOrgUnitAccessRuntimeClient(supabase, { tenantId, userId: ktvUserId });

    const userInsert = await supabase.from('users').upsert([
      {
        id: adminUserId,
        tenant_id: tenantId,
        email: adminEmail,
        full_name: 'Beauty Payroll Proof Admin',
        role: 'admin',
        status: 'active',
        position_tier: 'junior',
      },
      {
        id: ktvUserId,
        tenant_id: tenantId,
        email: ktvEmail,
        full_name: 'Beauty Payroll Proof KTV',
        role: 'ktv',
        status: 'active',
        base_salary: 6000000,
        position_tier: 'junior',
        hire_date: `${today.slice(0, 4)}-01-01`,
      },
      {
        id: otherUserId,
        tenant_id: otherTenantId,
        email: otherEmail,
        full_name: 'Beauty Payroll Proof Other Admin',
        role: 'admin',
        status: 'active',
        position_tier: 'junior',
      },
    ], { onConflict: 'id' });
    expect(userInsert.error).toBeNull();

    const branchInsert = await supabase.from('org_units').insert({
      id: branchId,
      tenant_id: tenantId,
      unit_type: 'branch',
      name: `${marker} branch`,
      is_active: true,
    });
    expect(branchInsert.error).toBeNull();

    const personInsert = await supabase.from('people_directory').insert({
      id: ktvPersonId,
      tenant_id: tenantId,
      user_id: ktvUserId,
      display_name: 'Beauty Payroll Proof KTV',
      person_type: 'employee',
      is_active: true,
    });
    expect(personInsert.error).toBeNull();

    const relationshipInsert = await supabase.from('org_relationships').insert({
      tenant_id: tenantId,
      from_id: ktvPersonId,
      from_type: 'person',
      to_id: branchId,
      to_type: 'unit',
      rel_type: 'belongs_to',
    });
    expect(relationshipInsert.error).toBeNull();

    mockCurrentUser = {
      id: adminUserId,
      tenant_id: tenantId,
      email: adminEmail,
      full_name: 'Beauty Payroll Proof Admin',
      role: 'admin',
      status: 'active',
    };

    const accountingPeriodInsert = await supabase.from('accounting_periods').insert({
      tenant_id: tenantId,
      name: `${marker}-open-period`,
      start_date: monthYear,
      end_date: `${today.slice(0, 7)}-${lastDayOfMonth}`,
      status: 'OPEN',
    });
    expect(accountingPeriodInsert.error).toBeNull();

    const customerInsert = await supabase.from('customers').insert({
      id: customerId,
      tenant_id: tenantId,
      name_mother: 'Beauty Payroll Proof Customer',
      phone: `08${Date.now().toString().slice(-8)}`,
      status: 'active',
    });
    expect(customerInsert.error).toBeNull();

    const bookingInsert = await supabase.from('bookings').insert({
      id: bookingId,
      tenant_id: tenantId,
      booking_number: `PAYROLL-PROOF-${Date.now()}`,
      customer_id: customerId,
      package_name: `${marker} service`,
      assigned_ktv_id: ktvUserId,
      start_date: today,
      full_price: 1200000,
      deposit_amount: 0,
      discount_percent: 0,
      status: 'booked',
      total_sessions: 1,
      completed_sessions: 0,
      ktv_commission: 120000,
    });
    expect(bookingInsert.error).toBeNull();

    const attendanceInsert = await supabase.from('attendance').insert({
      id: attendanceId,
      tenant_id: tenantId,
      ktv_id: ktvUserId,
      branch_id: branchId,
      date: today,
      status: 'present',
      checkin_time: `${today}T08:45:00+07:00`,
      checkout_time: `${today}T18:00:00+07:00`,
    });
    expect(attendanceInsert.error).toBeNull();

    const sessionInsert = await supabase.from('session_logs').insert({
      id: sessionId,
      tenant_id: tenantId,
      booking_id: bookingId,
      session_number: 1,
      assigned_date: today,
      branch_id: branchId,
      status: 'scheduled',
    });
    expect(sessionInsert.error).toBeNull();

    const beforeSalary = await supabase
      .from('salary_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .eq('month_year', monthYear);
    expect(beforeSalary.error).toBeNull();
    expect(beforeSalary.data).toEqual([]);

    const result = await completeSession(sessionId, bookingId, 'Beauty V2 payroll and commission Real DB proof');
    expect(result).toEqual({ success: true });

    const attendanceReadback = await supabase
      .from('attendance')
      .select('id, ktv_id, tenant_id, branch_id, date, status')
      .eq('id', attendanceId)
      .single();
    expect(attendanceReadback.error).toBeNull();
    expect(attendanceReadback.data).toMatchObject({
      id: attendanceId,
      ktv_id: ktvUserId,
      tenant_id: tenantId,
      branch_id: branchId,
      date: today,
      status: 'present',
    });

    const completedSession = await supabase
      .from('session_logs')
      .select('id, tenant_id, branch_id, status, completed_by_ktv_id, completed_date')
      .eq('id', sessionId)
      .single();
    expect(completedSession.error).toBeNull();
    expect(completedSession.data).toMatchObject({
      id: sessionId,
      tenant_id: tenantId,
      branch_id: branchId,
      status: 'completed',
      completed_by_ktv_id: ktvUserId,
      completed_date: today,
    });

    const salaryReadback = await supabase
      .from('salary_records')
      .select('id, tenant_id, ktv_id, month_year, branch_id, total_sessions, session_bonus, base_salary, total_salary, status')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .eq('month_year', monthYear)
      .single();
    expect(salaryReadback.error).toBeNull();
    expect(salaryReadback.data).toMatchObject({
      tenant_id: tenantId,
      ktv_id: ktvUserId,
      month_year: monthYear,
      branch_id: branchId,
      total_sessions: 1,
      session_bonus: 120000,
      status: 'draft',
    });
    expect(Number(salaryReadback.data?.base_salary ?? 0)).toBeGreaterThan(0);
    expect(Number(salaryReadback.data?.total_salary ?? 0)).toBeGreaterThanOrEqual(120000);

    const outboxReadback = await supabase
      .from('accounting_outbox')
      .select('tenant_id, event_type, reference_type, reference_id, payload')
      .eq('tenant_id', tenantId)
      .eq('event_type', 'SESSION_DONE')
      .eq('reference_id', sessionId)
      .single();
    expect(outboxReadback.error).toBeNull();
    expect(outboxReadback.data).toMatchObject({
      tenant_id: tenantId,
      event_type: 'SESSION_DONE',
      reference_id: sessionId,
    });
    expect(outboxReadback.data?.payload).toMatchObject({
      commissionAmount: 120000,
      ktvId: ktvUserId,
    });

    mockCurrentUser = {
      id: otherUserId,
      tenant_id: otherTenantId,
      email: otherEmail,
      full_name: 'Beauty Payroll Proof Other Admin',
      role: 'admin',
      status: 'active',
    };
    const crossTenantCompletion = await completeSession(sessionId, bookingId, 'Cross tenant payroll proof');
    expect(crossTenantCompletion).toHaveProperty('error');
    expect(crossTenantCompletion).not.toHaveProperty('success');

    if (process.env.SUPABASE_JWT_SECRET && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const tenantClient = createAuthenticatedClient(tenantId, adminUserId) as SupabaseClient<Database>;
      const otherTenantClient = createAuthenticatedClient(otherTenantId, otherUserId) as SupabaseClient<Database>;

      const visibleToOwner = await tenantClient
        .from('salary_records')
        .select('id, tenant_id, ktv_id, session_bonus')
        .eq('id', salaryReadback.data!.id);
      expect(visibleToOwner.error).toBeNull();
      expect(visibleToOwner.data).toHaveLength(1);
      expect(visibleToOwner.data?.[0]).toMatchObject({
        tenant_id: tenantId,
        ktv_id: ktvUserId,
        session_bonus: 120000,
      });

      const hiddenFromOtherTenant = await otherTenantClient
        .from('salary_records')
        .select('id')
        .eq('id', salaryReadback.data!.id);
      expect(hiddenFromOtherTenant.error).toBeNull();
      expect(hiddenFromOtherTenant.data).toEqual([]);

      const otherTenantUpdate = await otherTenantClient
        .from('salary_records')
        .update({ session_bonus: 999999 })
        .eq('id', salaryReadback.data!.id)
        .select('id');
      expect(otherTenantUpdate.error).toBeNull();
      expect(otherTenantUpdate.data).toEqual([]);
    }
  });
});
