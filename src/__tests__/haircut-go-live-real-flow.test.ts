import type { SupabaseClient } from '@supabase/supabase-js';

import { randomUUID } from 'node:crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';

let mockSupabaseAdminClient: SupabaseClient<Database>;
let mockActionSupabaseClient: SupabaseClient<Database>;

const mockGetCurrentUser = jest.fn();
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
  createDevelopmentBypassClient: () => Promise.resolve(mockActionSupabaseClient),
}));
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));
jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
  checkMonthLock: jest.fn().mockResolvedValue({ isLocked: false }),
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
import {
  completeSession,
  createBooking,
  createSessionLog,
  recordRemainingPayment,
  updateBooking,
  updateSessionLog,
} from '@/core/services/order';

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

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

describeWithRealSupabase('Haircut Go-Live real operational flow', () => {
  const marker = `haircut-go-live-${Date.now()}`;
  const created = {
    tenants: [] as string[],
    branches: [] as string[],
    people: [] as string[],
    authUsers: [] as string[],
    users: [] as string[],
    customers: [] as string[],
    packages: [] as string[],
    bookings: [] as string[],
    attendance: [] as string[],
  };
  const branchByTenant = new Map<string, string>();
  const passwordByUserId = new Map<string, string>();

  beforeAll(() => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    mockSupabaseAdminClient = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false },
    });
  });

  afterEach(() => {
    mockGetCurrentUser.mockReset();
    mockRevalidatePath.mockReset();
  });

  afterAll(async () => {
    if (!mockSupabaseAdminClient) {
      return;
    }

    for (const bookingId of created.bookings) {
      await mockSupabaseAdminClient.from('session_reviews').delete().eq('booking_id', bookingId);
      await mockSupabaseAdminClient.from('session_logs').delete().eq('booking_id', bookingId);
      await mockSupabaseAdminClient.from('revenue').delete().eq('booking_id', bookingId);
      await mockSupabaseAdminClient.from('bookings').delete().eq('id', bookingId);
    }

    if (created.attendance.length > 0) {
      await mockSupabaseAdminClient.from('attendance').delete().in('id', created.attendance);
    }
    if (created.packages.length > 0) {
      await mockSupabaseAdminClient.from('packages').delete().in('id', created.packages);
    }
    if (created.customers.length > 0) {
      await mockSupabaseAdminClient.from('customers').delete().in('id', created.customers);
    }
    if (created.people.length > 0) {
      await mockSupabaseAdminClient.from('org_relationships').delete().in('from_id', created.people);
      await mockSupabaseAdminClient.from('people_directory').delete().in('id', created.people);
    }
    if (created.users.length > 0) {
      await mockSupabaseAdminClient.from('users').delete().in('id', created.users);
    }
    if (created.branches.length > 0) {
      await mockSupabaseAdminClient.from('branches').delete().in('id', created.branches);
      await mockSupabaseAdminClient.from('org_units').delete().in('id', created.branches);
    }
    if (created.tenants.length > 0) {
      await mockSupabaseAdminClient.from('tenants').delete().in('id', created.tenants);
    }
    for (const userId of created.authUsers) {
      await mockSupabaseAdminClient.auth.admin.deleteUser(userId);
    }
  });

  async function insertTenant(label: string): Promise<string> {
    const { data, error } = await mockSupabaseAdminClient
      .from('tenants')
      .insert({
        name: `${marker}-${label}`,
        status: 'active',
        product_key: 'bella_haircut',
        enabled_modules: {
          babycare: false,
          beauty_spa: true,
          inventory: false,
          payroll: true,
        },
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.tenants.push(data!.id);

    const branchId = randomUUID();
    branchByTenant.set(data!.id, branchId);
    created.branches.push(branchId);

    const { error: orgUnitError } = await mockSupabaseAdminClient
      .from('org_units')
      .insert({
        id: branchId,
        tenant_id: data!.id,
        unit_type: 'branch',
        name: `${marker}-${label} Branch`,
        code: `ORG-${label.toUpperCase()}-${Math.floor(Math.random() * 10000)}`,
        is_active: true,
      });
    expect(orgUnitError).toBeNull();

    return data!.id;
  }

  async function insertUser(tenantId: string, role: string, label: string): Promise<TestUser> {
    const email = `${marker}-${label}@example.com`;
    const fullName = `Haircut ${label}`;
    const password = `${randomUUID()}A1!`;
    const authResult = await mockSupabaseAdminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(authResult.error).toBeNull();
    expect(authResult.data.user?.id).toBeTruthy();
    const userId = authResult.data.user!.id;
    created.authUsers.push(userId);
    passwordByUserId.set(userId, password);

    const { data, error } = await mockSupabaseAdminClient
      .from('users')
      .insert({
        id: userId,
        tenant_id: tenantId,
        email,
        full_name: fullName,
        role,
        phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
        base_salary: 6_000_000,
      })
      .select('id, email, tenant_id, role, full_name')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.users.push(data!.id);
    if (role === 'ktv' || role === 'admin') {
      const branchId = branchByTenant.get(tenantId);
      expect(branchId).toBeTruthy();
      const { data: personData, error: personError } = await mockSupabaseAdminClient
        .from('people_directory')
        .insert({
          tenant_id: tenantId,
          user_id: data!.id,
          person_type: 'employee',
          display_name: fullName,
          is_active: true,
        })
        .select('id')
        .single();
      expect(personError).toBeNull();
      expect(personData?.id).toBeTruthy();
      created.people.push(personData!.id);

      const { error: relationshipError } = await mockSupabaseAdminClient
        .from('org_relationships')
        .insert({
          tenant_id: tenantId,
          from_id: personData!.id,
          from_type: 'person',
          to_id: branchId!,
          to_type: 'unit',
          rel_type: 'belongs_to',
          since: new Date().toISOString().slice(0, 10),
        });
      expect(relationshipError).toBeNull();
    }
    return data!;
  }

  async function setCurrentUser(user: TestUser) {
    mockGetCurrentUser.mockResolvedValue(user);
    const url = getSupabaseAdminUrl();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const password = passwordByUserId.get(user.id);
    expect(url).toBeTruthy();
    expect(anonKey).toBeTruthy();
    expect(password).toBeTruthy();
    const client = createSupabaseClient<Database>(url, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signIn = await client.auth.signInWithPassword({
      email: user.email,
      password: password!,
    });
    expect(signIn.error).toBeNull();
    expect(signIn.data.session?.access_token).toBeTruthy();
    mockActionSupabaseClient = client;
  }

  async function insertPackage(tenantId: string): Promise<string> {
    const { data, error } = await mockSupabaseAdminClient
      .from('packages')
      .insert({
        tenant_id: tenantId,
        name: `${marker} Haircut package`,
        description: 'Real package for Haircut Go-Live operational test',
        price: 300_000,
        total_sessions: 2,
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

  it('persists customer, booking, assignment, session completion, package usage, payment, and tenant isolation', async () => {
    const tenantA = await insertTenant('tenant-a');
    const tenantB = await insertTenant('tenant-b');
    const adminA = await insertUser(tenantA, 'admin', 'admin-a');
    const ktvA = await insertUser(tenantA, 'ktv', 'ktv-a');
    const adminB = await insertUser(tenantB, 'admin', 'admin-b');
    const ktvB = await insertUser(tenantB, 'ktv', 'ktv-b');
    const packageId = await insertPackage(tenantA);

    await setCurrentUser(adminA);

    const customerResult = await createCustomer({
      name_mother: `${marker} customer`,
      phone: `08${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });

    expect(customerResult.error).toBeFalsy();
    expect(customerResult.data?.id).toBeTruthy();

    const customerId = customerResult.data!.id;
    created.customers.push(customerId);

    const bookingResult = await createBooking({
      customer_id: customerId,
      package_id: packageId,
      package_name: `${marker} Haircut package`,
      full_price: 300_000,
      deposit_amount: 100_000,
      total_sessions: 2,
      start_date: new Date().toISOString().slice(0, 10),
      assigned_ktv_id: ktvA.id,
      ktv_commission: 30_000,
      discount_percent: 0,
      preferred_time: '10:00',
    });

    expect(bookingResult.error).toBeFalsy();
    expect(bookingResult.data?.id).toBeTruthy();

    const bookingId = String(bookingResult.data!.id);
    created.bookings.push(bookingId);
    const tenantABranchId = branchByTenant.get(tenantA);
    expect(tenantABranchId).toBeTruthy();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const attendanceId = randomUUID();
    const attendanceInsert = await mockSupabaseAdminClient
      .from('attendance')
      .insert({
        id: attendanceId,
        tenant_id: tenantA,
        ktv_id: ktvA.id,
        branch_id: tenantABranchId!,
        date: today,
        status: 'present',
        checkin_time: `${today}T08:45:00+07:00`,
        checkout_time: `${today}T18:00:00+07:00`,
      });
    expect(attendanceInsert.error).toBeNull();
    created.attendance.push(attendanceId);

    const { data: storedBooking } = await mockSupabaseAdminClient
      .from('bookings')
      .select('id, tenant_id, customer_id, package_id, assigned_ktv_id, completed_sessions, total_sessions')
      .eq('id', bookingId)
      .single();

    expect(storedBooking).toMatchObject({
      id: bookingId,
      tenant_id: tenantA,
      customer_id: customerId,
      package_id: packageId,
      assigned_ktv_id: ktvA.id,
      completed_sessions: 0,
      total_sessions: 2,
    });

    const { data: existingSessions } = await mockSupabaseAdminClient
      .from('session_logs')
      .select('id, status, booking_id, tenant_id, completed_by_ktv_id')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    expect(existingSessions).toHaveLength(2);

    const sessionId = existingSessions![0].id;

    const checkInResult = await updateSessionLog(sessionId, {
      status: 'in_progress',
      notes: 'Haircut customer checked in',
    });

    expect(checkInResult.error).toBeFalsy();

    const { data: checkedInSession } = await mockSupabaseAdminClient
      .from('session_logs')
      .select('id, status, tenant_id')
      .eq('id', sessionId)
      .single();

    expect(checkedInSession).toMatchObject({
      id: sessionId,
      tenant_id: tenantA,
      status: 'in_progress',
    });

    const completionResult = await completeSession(
      sessionId,
      bookingId,
      'Haircut service completed by assigned professional',
    );

    expect(completionResult.error).toBeFalsy();

    const { data: completedSession } = await mockSupabaseAdminClient
      .from('session_logs')
      .select('id, status, completed_by_ktv_id, tenant_id')
      .eq('id', sessionId)
      .single();

    expect(completedSession).toMatchObject({
      id: sessionId,
      tenant_id: tenantA,
      status: 'completed',
      completed_by_ktv_id: ktvA.id,
    });

    const { data: bookingAfterCompletion } = await mockSupabaseAdminClient
      .from('bookings')
      .select('completed_sessions, total_sessions, assigned_ktv_id, tenant_id')
      .eq('id', bookingId)
      .single();

    expect(bookingAfterCompletion).toMatchObject({
      tenant_id: tenantA,
      assigned_ktv_id: ktvA.id,
      completed_sessions: 1,
      total_sessions: 2,
    });

    const duplicateCompletionResult = await completeSession(
      sessionId,
      bookingId,
      'Duplicate completion attempt',
    );

    expect(duplicateCompletionResult.error).toBeTruthy();

    const { count: completedSessionCount } = await mockSupabaseAdminClient
      .from('session_logs')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', bookingId)
      .eq('status', 'completed');

    expect(completedSessionCount).toBe(1);

    const paymentIdempotencyKey = `${marker}-remaining-payment`;
    const paymentResult = await recordRemainingPayment({
      booking_id: bookingId,
      customer_id: customerId,
      amount: 200_000,
      payment_method: 'cash',
      status: 'confirmed',
      notes: 'Haircut go-live remaining payment',
      idempotency_key: paymentIdempotencyKey,
    });

    expect(paymentResult.error).toBeFalsy();

    const duplicatePaymentResult = await recordRemainingPayment({
      booking_id: bookingId,
      customer_id: customerId,
      amount: 200_000,
      payment_method: 'cash',
      status: 'confirmed',
      notes: 'Haircut go-live duplicate remaining payment',
      idempotency_key: paymentIdempotencyKey,
    });

    expect(duplicatePaymentResult.error).toBeFalsy();

    const { data: revenueRows } = await mockSupabaseAdminClient
      .from('revenue')
      .select('id, booking_id, amount, accounting_metadata')
      .eq('booking_id', bookingId);

    const remainingPayments = (revenueRows ?? []).filter((row) => {
      const metadata = row.accounting_metadata;
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return false;
      }

      return (metadata as Record<string, unknown>).manual_payment_idempotency_key === paymentIdempotencyKey;
    });

    expect(remainingPayments).toHaveLength(1);
    expect(remainingPayments[0].amount).toBe(200_000);

    await setCurrentUser(adminB);

    const crossTenantBookingUpdate = await updateBooking(bookingId, {
      assigned_ktv_id: ktvB.id,
    });

    expect(crossTenantBookingUpdate.error).toBeTruthy();

    const crossTenantSessionCreate = await createSessionLog({
      booking_id: bookingId,
      session_date: new Date().toISOString(),
      session_number: 99,
      service_type: 'haircut',
      notes: 'Cross-tenant write attempt',
    });

    expect(crossTenantSessionCreate.error).toBeTruthy();

    const crossTenantPayment = await recordRemainingPayment({
      booking_id: bookingId,
      customer_id: customerId,
      amount: 1,
      payment_method: 'cash',
      status: 'confirmed',
      notes: 'Cross-tenant payment attempt',
      idempotency_key: `${marker}-cross-tenant-payment`,
    });

    expect(crossTenantPayment.error).toBeTruthy();

    const { data: finalBooking } = await mockSupabaseAdminClient
      .from('bookings')
      .select('tenant_id, assigned_ktv_id, completed_sessions')
      .eq('id', bookingId)
      .single();

    expect(finalBooking).toMatchObject({
      tenant_id: tenantA,
      assigned_ktv_id: ktvA.id,
      completed_sessions: 1,
    });
  });
});
