import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

let mockSupabaseAdminClient: SupabaseClient<Database>;

const mockGetCurrentUser = jest.fn();
const mockGetAuthorizedTenantUser = jest.fn();
const mockRevalidatePath = jest.fn();

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));
jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/supabase-server', () => ({
  createClient: () => mockSupabaseAdminClient,
}));
jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: () => mockSupabaseAdminClient,
}));
jest.mock('@/core/services/auth', () => ({
  getAuthorizedTenantUser: (...args: unknown[]) => mockGetAuthorizedTenantUser(...args),
}));
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));
jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
  checkMonthLock: jest.fn().mockResolvedValue({ isLocked: false }),
}));
jest.mock('@/core/services/accounting/period-guards', () => ({
  assertOpenAccountingPeriod: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/subscription', () => ({
  checkSubscriptionLimit: jest.fn().mockResolvedValue({ isBlocked: false }),
}));
jest.mock('@/services/notification-helpers', () => ({
  createSystemNotification: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('@/app/api/bookings/check-ktv-availability/route', () => ({
  invalidateAvailabilityCache: jest.fn().mockResolvedValue(undefined),
}));

import {
  getSupabaseAdminKey,
  getSupabaseAdminUrl,
  requireSupabaseAdminEnv,
} from '@/lib/supabase-admin-env';
import { createCustomer } from '@/services/customer-actions';
import { completeSession, createBooking } from '@/core/services/order';
import {
  adminConfirmOnBehalf,
  finalizeSalaryRecord,
  publishSalaryRecord,
} from '@/modules/hr-salary/actions/admin-salary-actions';

jest.setTimeout(120_000);

type TestUser = {
  id: string;
  email: string;
  tenant_id: string;
  role: string;
  full_name: string;
};

function hasRealSupabaseAdminEnv() {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
}

function getMonthStartString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function getLocalDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

describeWithRealSupabase('Bella Nail Payroll real DB proof', () => {
  const marker = `nail-payroll-${Date.now()}`;
  const created = {
    tenants: [] as string[],
    users: [] as string[],
    customers: [] as string[],
    packages: [] as string[],
    bookings: [] as string[],
  };

  beforeAll(() => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    mockSupabaseAdminClient = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterEach(() => {
    mockGetCurrentUser.mockReset();
    mockGetAuthorizedTenantUser.mockReset();
    mockRevalidatePath.mockReset();
  });

  async function cleanupBestEffort(
    label: string,
    cleanup: PromiseLike<{ error: { message: string } | null }>
  ) {
    const { error } = await cleanup;
    if (error) {
      console.warn(`[Bella Nail Payroll cleanup] ${label} cleanup needs external scoped cleanup: ${error.message}`);
    }
  }

  afterAll(async () => {
    if (!mockSupabaseAdminClient) return;

    for (const tenantId of created.tenants) {
      await cleanupBestEffort('expenses', mockSupabaseAdminClient.from('expenses').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('accounting_outbox', mockSupabaseAdminClient.from('accounting_outbox').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('salary_records', mockSupabaseAdminClient.from('salary_records').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('salary_adjustments', mockSupabaseAdminClient.from('salary_adjustments').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('product_sales', mockSupabaseAdminClient.from('product_sales').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('booking_service_items', mockSupabaseAdminClient.from('booking_service_items').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('attendance', mockSupabaseAdminClient.from('attendance').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('session_reviews', mockSupabaseAdminClient.from('session_reviews').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('tenant_payroll_config_history', mockSupabaseAdminClient.from('tenant_payroll_config_history').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('tenant_payroll_config', mockSupabaseAdminClient.from('tenant_payroll_config').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('tenant_payroll_config_history after config delete', mockSupabaseAdminClient.from('tenant_payroll_config_history').delete().eq('tenant_id', tenantId));
    }

    for (const bookingId of created.bookings) {
      await cleanupBestEffort('session_logs', mockSupabaseAdminClient.from('session_logs').delete().eq('booking_id', bookingId));
      await cleanupBestEffort('revenue', mockSupabaseAdminClient.from('revenue').delete().eq('booking_id', bookingId));
      await cleanupBestEffort('bookings', mockSupabaseAdminClient.from('bookings').delete().eq('id', bookingId));
    }

    if (created.packages.length > 0) {
      await cleanupBestEffort('packages', mockSupabaseAdminClient.from('packages').delete().in('id', created.packages));
    }
    if (created.customers.length > 0) {
      await cleanupBestEffort('customers', mockSupabaseAdminClient.from('customers').delete().in('id', created.customers));
    }
    if (created.users.length > 0) {
      await cleanupBestEffort('users', mockSupabaseAdminClient.from('users').delete().in('id', created.users));
    }
    if (created.tenants.length > 0) {
      await cleanupBestEffort('tenants', mockSupabaseAdminClient.from('tenants').delete().in('id', created.tenants));
    }
  });

  async function insertTenant(): Promise<string> {
    const { data, error } = await mockSupabaseAdminClient
      .from('tenants')
      .insert({
        name: `${marker} tenant`,
        status: 'active',
        product_key: 'bella_nail',
        enabled_modules: {
          babycare: false,
          beauty_spa: true,
          payroll: true,
        },
        commission_config: {
          service_commission_default: { type: 'fixed', value: 30_000 },
          product_sales_commission_default: { type: 'percentage', value: 10 },
          position_multipliers: { junior: 1.0, senior: 1.2, lead: 1.5 },
          seniority_bonus_rates: {
            '0_to_1_year': 0,
            '1_to_3_years': 0.05,
            '3_to_5_years': 0.1,
            '5_plus_years': 0.15,
          },
        },
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.tenants.push(data!.id);
    return data!.id;
  }

  async function insertUser(tenantId: string, role: string, label: string): Promise<TestUser> {
    const { data, error } = await mockSupabaseAdminClient
      .from('users')
      .insert({
        tenant_id: tenantId,
        email: `${marker}-${label}@example.com`,
        full_name: `Nail Payroll ${label}`,
        role,
        phone: `05${Math.floor(Math.random() * 90000000 + 10000000)}`,
        base_salary: 0,
        status: 'active',
        position_tier: 'junior',
        hire_date: getLocalDateString(),
      })
      .select('id, email, tenant_id, role, full_name')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.users.push(data!.id);
    return data!;
  }

  async function insertPackage(tenantId: string): Promise<string> {
    const { data, error } = await mockSupabaseAdminClient
      .from('packages')
      .insert({
        tenant_id: tenantId,
        name: `${marker} Nail payroll proof service`,
        description: 'Real package for Bella Nail payroll proof',
        price: 320_000,
        total_sessions: 1,
        session_multiplier: 1,
        status: 'active',
        module_key: 'beauty_spa',
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.packages.push(data!.id);
    return data!.id;
  }

  async function createNailCustomer() {
    const result = await createCustomer({
      name_mother: `${marker} payroll customer`,
      phone: `04${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });

    expect(result.error).toBeFalsy();
    expect(result.data?.id).toBeTruthy();
    created.customers.push(result.data!.id);
    return result.data!.id;
  }

  async function getFirstSession(bookingId: string) {
    const { data, error } = await mockSupabaseAdminClient
      .from('session_logs')
      .select('id, booking_id, tenant_id, status, completed_by_ktv_id')
      .eq('booking_id', bookingId)
      .eq('session_number', 1)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    return data!;
  }

  it('proves payroll lifecycle and commission read-back for a bella_nail tenant', async () => {
    const tenantId = await insertTenant();
    const admin = await insertUser(tenantId, 'admin', 'admin');
    const technician = await insertUser(tenantId, 'ktv', 'technician');
    const packageId = await insertPackage(tenantId);
    const today = getLocalDateString();
    const monthYear = getMonthStartString();

    mockGetCurrentUser.mockResolvedValue(admin);
    mockGetAuthorizedTenantUser.mockResolvedValue({
      ok: true,
      user: admin,
      tenantId,
      role: admin.role,
    });

    const customerId = await createNailCustomer();

    const { error: attendanceError } = await mockSupabaseAdminClient
      .from('attendance')
      .insert({
        ktv_id: technician.id,
        tenant_id: tenantId,
        date: today,
        status: 'present',
        checkin_time: new Date().toISOString(),
        checkout_time: new Date().toISOString(),
      });
    expect(attendanceError).toBeNull();

    const booking = await createBooking({
      customer_id: customerId,
      package_id: packageId,
      package_name: `${marker} Nail payroll proof service`,
      full_price: 320_000,
      deposit_amount: 0,
      total_sessions: 1,
      start_date: today,
      assigned_ktv_id: technician.id,
      ktv_commission: 40_000,
      discount_percent: 0,
      preferred_time: '16:00',
      metadata: { product_key: 'bella_nail', proof: marker },
    });

    expect(booking.error).toBeFalsy();
    const bookingId = String(booking.data!.id);
    created.bookings.push(bookingId);

    const { error: serviceItemError } = await mockSupabaseAdminClient
      .from('booking_service_items')
      .insert({
        booking_id: bookingId,
        package_id: packageId,
        ktv_id: technician.id,
        tenant_id: tenantId,
        service_name: `${marker} Gel manicure`,
        service_category: 'nail',
        quantity: 1,
        unit_price: 320_000,
        subtotal: 320_000,
        calculated_commission: 30_000,
        status: 'completed',
        completed_date: today,
      });
    expect(serviceItemError).toBeNull();

    const { error: productSaleError } = await mockSupabaseAdminClient
      .from('product_sales')
      .insert({
        ktv_id: technician.id,
        customer_id: customerId,
        booking_id: bookingId,
        tenant_id: tenantId,
        product_name: `${marker} Cuticle oil`,
        product_category: 'retail',
        quantity: 1,
        unit_price: 100_000,
        total_sales_amount: 100_000,
        calculated_commission: 10_000,
        status: 'completed',
        payment_method: 'cash',
        sale_date: today,
      });
    expect(productSaleError).toBeNull();

    const { error: adjustmentError } = await mockSupabaseAdminClient
      .from('salary_adjustments')
      .insert({
        ktv_id: technician.id,
        month_year: monthYear,
        tenant_id: tenantId,
        adjustment_type: 'bonus',
        amount: 5_000,
        category: 'proof_bonus',
        reason: 'Bella Nail payroll proof adjustment',
        status: 'approved',
        approved_by_id: admin.id,
        approved_at: new Date().toISOString(),
        created_by_id: admin.id,
      });
    expect(adjustmentError).toBeNull();

    const session = await getFirstSession(bookingId);
    const completion = await completeSession(
      session.id,
      bookingId,
      'Bella Nail payroll proof completed',
    );
    expect(completion.error).toBeFalsy();

    const { data: draftSalary, error: draftSalaryError } = await mockSupabaseAdminClient
      .from('salary_records')
      .select('id, status, tenant_id, ktv_id, month_year, total_sessions, session_bonus, service_commission, product_sales_commission, manual_adjustments, total_salary')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', technician.id)
      .eq('month_year', monthYear)
      .single();

    expect(draftSalaryError).toBeNull();
    expect(draftSalary).toEqual(expect.objectContaining({
      tenant_id: tenantId,
      ktv_id: technician.id,
      month_year: monthYear,
      status: 'draft',
    }));
    expect(getNumber(draftSalary?.total_sessions)).toBeGreaterThanOrEqual(1);
    expect(getNumber(draftSalary?.session_bonus)).toBe(40_000);
    expect(getNumber(draftSalary?.service_commission)).toBe(30_000);
    expect(getNumber(draftSalary?.product_sales_commission)).toBe(10_000);
    expect(getNumber(draftSalary?.manual_adjustments)).toBe(5_000);
    expect(getNumber(draftSalary?.total_salary)).toBeGreaterThanOrEqual(85_000);

    const publish = await publishSalaryRecord(technician.id);
    expect(publish).toEqual(expect.objectContaining({ success: true }));

    const confirm = await adminConfirmOnBehalf(technician.id);
    expect(confirm).toEqual(expect.objectContaining({ success: true }));

    const finalize = await finalizeSalaryRecord(technician.id);
    expect(finalize).toEqual(expect.objectContaining({ success: true }));

    const { data: finalSalary, error: finalSalaryError } = await mockSupabaseAdminClient
      .from('salary_records')
      .select('id, status, is_locked, published_at, ktv_confirmed_at, confirmed_by_admin, finalized_at, total_salary')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', technician.id)
      .eq('month_year', monthYear)
      .single();

    expect(finalSalaryError).toBeNull();
    expect(finalSalary).toEqual(expect.objectContaining({
      id: draftSalary!.id,
      status: 'finalized',
      is_locked: true,
      confirmed_by_admin: true,
    }));
    expect(finalSalary?.published_at).toBeTruthy();
    expect(finalSalary?.ktv_confirmed_at).toBeTruthy();
    expect(finalSalary?.finalized_at).toBeTruthy();

    const { data: lockedSession, error: lockedSessionError } = await mockSupabaseAdminClient
      .from('session_logs')
      .select('id, status, completed_by_ktv_id, is_confirmed')
      .eq('id', session.id)
      .single();

    expect(lockedSessionError).toBeNull();
    expect(lockedSession).toEqual(expect.objectContaining({
      id: session.id,
      status: 'completed',
      completed_by_ktv_id: technician.id,
      is_confirmed: true,
    }));

    const { data: expenseRows, error: expenseError } = await mockSupabaseAdminClient
      .from('expenses')
      .select('id, amount, category, status, business_event_type, accounting_review_status, accounting_metadata')
      .eq('tenant_id', tenantId)
      .eq('category', 'salary');

    expect(expenseError).toBeNull();
    expect(expenseRows).toHaveLength(1);
    expect(expenseRows?.[0]).toEqual(expect.objectContaining({
      category: 'salary',
      status: 'submitted',
      business_event_type: 'EXPENSE_SALARY',
      accounting_review_status: 'UNREVIEWED',
    }));
    expect(getNumber(expenseRows?.[0]?.amount)).toBe(getNumber(finalSalary?.total_salary));
  });
});
