import { randomUUID } from 'node:crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { completeSession } from '@/core/services/order';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { createAuthenticatedClient } from '../../tests/utils/test-jwt-helper';

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

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn(async () => mockCurrentUser),
}));

jest.setTimeout(90_000);

type SeedClient = SupabaseClient<Database>;

const hasRealSupabaseAdminEnv = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
};

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

describeWithRealSupabase('Beauty V2 go-live payroll and commission Real DB proof', () => {
  const marker = `beauty-v2-payroll-proof-${Date.now()}`;
  const adminUserId = '11111111-1111-4111-8111-111111111296';
  const ktvUserId = '11111111-1111-4111-8111-111111111297';
  const otherUserId = '22222222-2222-4222-8222-222222222296';
  const customerId = randomUUID();
  const bookingId = randomUUID();
  const sessionId = randomUUID();
  const attendanceId = randomUUID();
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
  let tenantId: string;
  let otherTenantId: string;

  async function ensureTenant(name: string) {
    const existing = await supabase
      .from('tenants')
      .select('id')
      .eq('name', name)
      .maybeSingle();
    if (existing.error) throw new Error(`tenant lookup failed: ${existing.error.message}`);
    if (existing.data?.id) return existing.data.id;

    const created = await supabase
      .from('tenants')
      .insert({
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
    return created.data.id;
  }

  async function cleanupStep(label: string, result: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await result;
    if (error) throw new Error(`${label} cleanup failed: ${error.message}`);
  }

  async function cleanup() {
    await cleanupStep('accounting_outbox', supabase.from('accounting_outbox').delete().eq('tenant_id', tenantId));
    await cleanupStep('session_reviews', supabase.from('session_reviews').delete().eq('tenant_id', tenantId));
    await cleanupStep('salary_records', supabase.from('salary_records').delete().eq('tenant_id', tenantId));
    await cleanupStep('attendance', supabase.from('attendance').delete().eq('tenant_id', tenantId));
    await cleanupStep('session_logs', supabase.from('session_logs').delete().eq('id', sessionId));
    await cleanupStep('bookings', supabase.from('bookings').delete().eq('id', bookingId));
    await cleanupStep('customers', supabase.from('customers').delete().eq('id', customerId));
    await cleanupStep('accounting_periods', supabase.from('accounting_periods').delete().eq('tenant_id', tenantId));
  }

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    tenantId = await ensureTenant('Beauty V2 Go Live Payroll Proof Tenant');
    otherTenantId = await ensureTenant('Beauty V2 Go Live Payroll Proof Other Tenant');
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

    const userInsert = await supabase.from('users').upsert([
      {
        id: adminUserId,
        tenant_id: tenantId,
        email: 'beauty-v2-payroll-proof-admin@example.test',
        full_name: 'Beauty Payroll Proof Admin',
        role: 'admin',
        status: 'active',
        position_tier: 'junior',
      },
      {
        id: ktvUserId,
        tenant_id: tenantId,
        email: 'beauty-v2-payroll-proof-ktv@example.test',
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
        email: 'beauty-v2-payroll-proof-other@example.test',
        full_name: 'Beauty Payroll Proof Other Admin',
        role: 'admin',
        status: 'active',
        position_tier: 'junior',
      },
    ], { onConflict: 'id' });
    expect(userInsert.error).toBeNull();

    mockCurrentUser = {
      id: adminUserId,
      tenant_id: tenantId,
      email: 'beauty-v2-payroll-proof-admin@example.test',
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
      .select('id, ktv_id, tenant_id, date, status')
      .eq('id', attendanceId)
      .single();
    expect(attendanceReadback.error).toBeNull();
    expect(attendanceReadback.data).toMatchObject({
      id: attendanceId,
      ktv_id: ktvUserId,
      tenant_id: tenantId,
      date: today,
      status: 'present',
    });

    const completedSession = await supabase
      .from('session_logs')
      .select('id, tenant_id, status, completed_by_ktv_id, completed_date')
      .eq('id', sessionId)
      .single();
    expect(completedSession.error).toBeNull();
    expect(completedSession.data).toMatchObject({
      id: sessionId,
      tenant_id: tenantId,
      status: 'completed',
      completed_by_ktv_id: ktvUserId,
      completed_date: today,
    });

    const salaryReadback = await supabase
      .from('salary_records')
      .select('id, tenant_id, ktv_id, month_year, total_sessions, session_bonus, base_salary, total_salary, status')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .eq('month_year', monthYear)
      .single();
    expect(salaryReadback.error).toBeNull();
    expect(salaryReadback.data).toMatchObject({
      tenant_id: tenantId,
      ktv_id: ktvUserId,
      month_year: monthYear,
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
      email: 'beauty-v2-payroll-proof-other@example.test',
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
