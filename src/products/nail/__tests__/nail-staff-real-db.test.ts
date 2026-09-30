import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

let mockSupabaseAdminClient: SupabaseClient<Database>;

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
import { getKTVTodayAttendance, ktvCheckIn, ktvCheckOut } from '@/services/attendance-actions';
import { completeSession, createBooking } from '@/core/services/order';

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

describeWithRealSupabase('Bella Nail Staff real DB proof', () => {
  const marker = `nail-staff-${Date.now()}`;
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
    mockRevalidatePath.mockReset();
  });

  async function cleanupBestEffort(
    label: string,
    cleanup: PromiseLike<{ error: { message: string } | null }>
  ) {
    const { error } = await cleanup;
    if (error) {
      console.warn(`[Bella Nail Staff cleanup] ${label} cleanup needs external scoped cleanup: ${error.message}`);
    }
  }

  afterAll(async () => {
    if (!mockSupabaseAdminClient) return;

    for (const tenantId of created.tenants) {
      await cleanupBestEffort('accounting_outbox', mockSupabaseAdminClient.from('accounting_outbox').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('session_reviews', mockSupabaseAdminClient.from('session_reviews').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('salary_records', mockSupabaseAdminClient.from('salary_records').delete().eq('tenant_id', tenantId));
      await cleanupBestEffort('attendance', mockSupabaseAdminClient.from('attendance').delete().eq('tenant_id', tenantId));
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
          payroll: false,
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
        full_name: `Nail ${label}`,
        role,
        phone: `07${Math.floor(Math.random() * 90000000 + 10000000)}`,
        base_salary: 0,
        status: 'active',
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
        name: `${marker} Nail staff proof service`,
        description: 'Real package for Bella Nail staff proof',
        price: 180_000,
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
      name_mother: `${marker} staff customer`,
      phone: `06${Math.floor(Math.random() * 90000000 + 10000000)}`,
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

  it('proves staff attendance, booking assignment, and completed service attribution', async () => {
    const tenantId = await insertTenant();
    const admin = await insertUser(tenantId, 'admin', 'admin');
    const technician = await insertUser(tenantId, 'ktv', 'technician');
    const packageId = await insertPackage(tenantId);

    mockGetCurrentUser.mockResolvedValue(technician);

    const checkIn = await ktvCheckIn();
    expect(checkIn).toEqual(expect.objectContaining({ success: true }));

    const todayAttendance = await getKTVTodayAttendance();
    expect(todayAttendance).toEqual(expect.objectContaining({
      ktv_id: technician.id,
      tenant_id: tenantId,
    }));

    const checkOut = await ktvCheckOut();
    expect(checkOut).toEqual(expect.objectContaining({ success: true }));

    const { data: attendanceReadback, error: attendanceReadbackError } = await mockSupabaseAdminClient
      .from('attendance')
      .select('id, ktv_id, tenant_id, status, checkin_time, checkout_time')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', technician.id)
      .single();

    expect(attendanceReadbackError).toBeNull();
    expect(attendanceReadback).toEqual(expect.objectContaining({
      ktv_id: technician.id,
      tenant_id: tenantId,
    }));
    expect(attendanceReadback?.checkin_time).toBeTruthy();
    expect(attendanceReadback?.checkout_time).toBeTruthy();

    mockGetCurrentUser.mockResolvedValue(admin);

    const customerId = await createNailCustomer();
    const booking = await createBooking({
      customer_id: customerId,
      package_id: packageId,
      package_name: `${marker} Nail staff proof service`,
      full_price: 180_000,
      deposit_amount: 0,
      total_sessions: 1,
      start_date: new Date().toISOString().slice(0, 10),
      assigned_ktv_id: technician.id,
      ktv_commission: 0,
      discount_percent: 0,
      preferred_time: '15:00',
      metadata: { product_key: 'bella_nail', proof: marker },
    });

    expect(booking.error).toBeFalsy();
    const bookingId = String(booking.data!.id);
    created.bookings.push(bookingId);

    const { data: bookingReadback, error: bookingReadbackError } = await mockSupabaseAdminClient
      .from('bookings')
      .select('id, tenant_id, assigned_ktv_id')
      .eq('id', bookingId)
      .single();

    expect(bookingReadbackError).toBeNull();
    expect(bookingReadback).toEqual(expect.objectContaining({
      id: bookingId,
      tenant_id: tenantId,
      assigned_ktv_id: technician.id,
    }));

    const session = await getFirstSession(bookingId);
    const completion = await completeSession(
      session.id,
      bookingId,
      'Bella Nail staff attribution proof completed',
    );
    expect(completion.error).toBeFalsy();

    const { data: completedSession, error: completedSessionError } = await mockSupabaseAdminClient
      .from('session_logs')
      .select('id, tenant_id, status, completed_by_ktv_id')
      .eq('id', session.id)
      .single();

    expect(completedSessionError).toBeNull();
    expect(completedSession).toEqual(expect.objectContaining({
      id: session.id,
      tenant_id: tenantId,
      status: 'completed',
      completed_by_ktv_id: technician.id,
    }));
  });
});
