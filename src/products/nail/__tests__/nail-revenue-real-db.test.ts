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
import { calculateBookingPaymentState } from '@/lib/business-rules/payment';
import { createCustomer } from '@/services/customer-actions';
import {
  completeSession,
  createBooking,
  recordRemainingPayment,
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

type RevenueReadback = Pick<
  Database['public']['Tables']['revenue']['Row'],
  'id' | 'amount' | 'status' | 'revenue_type' | 'payment_method' | 'accounting_metadata'
>;

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function buildPaymentState(input: {
  fullPrice: number;
  depositAmount: number;
  revenues: RevenueReadback[];
}) {
  return calculateBookingPaymentState({
    fullPrice: input.fullPrice,
    depositAmount: input.depositAmount,
    discountPercent: 0,
    bookingStatus: 'booked',
    revenues: input.revenues,
  });
}

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

describeWithRealSupabase('Bella Nail Revenue real DB proof', () => {
  const marker = `nail-revenue-${Date.now()}`;
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

  async function expectCleanupSuccess(
    label: string,
    cleanup: PromiseLike<{ error: { message: string } | null }>
  ) {
    const { error } = await cleanup;
    if (error) {
      throw new Error(`${label} cleanup failed: ${error.message}`);
    }
  }

  async function cleanupBestEffort(
    label: string,
    cleanup: PromiseLike<{ error: { message: string } | null }>
  ) {
    const { error } = await cleanup;
    if (error) {
      console.warn(`[Bella Nail Revenue cleanup] ${label} cleanup needs external scoped cleanup: ${error.message}`);
    }
  }

  afterAll(async () => {
    if (!mockSupabaseAdminClient) return;

    for (const tenantId of created.tenants) {
      await expectCleanupSuccess('finance_receivable_allocations', mockSupabaseAdminClient.from('finance_receivable_allocations').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('finance_receivable_ledger', mockSupabaseAdminClient.from('finance_receivable_ledger').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('finance_receivable_positions', mockSupabaseAdminClient.from('finance_receivable_positions').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('finance_cash_movements', mockSupabaseAdminClient.from('finance_cash_movements').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('finance_cash_positions', mockSupabaseAdminClient.from('finance_cash_positions').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('finance_outbox_events', mockSupabaseAdminClient.from('finance_outbox_events').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('finance_transaction_lines', mockSupabaseAdminClient.from('finance_transaction_lines').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('finance_transactions', mockSupabaseAdminClient.from('finance_transactions').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('accounting_outbox', mockSupabaseAdminClient.from('accounting_outbox').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('salary_records', mockSupabaseAdminClient.from('salary_records').delete().eq('tenant_id', tenantId));
      await expectCleanupSuccess('session_reviews', mockSupabaseAdminClient.from('session_reviews').delete().eq('tenant_id', tenantId));
    }

    for (const bookingId of created.bookings) {
      await expectCleanupSuccess('session_logs', mockSupabaseAdminClient.from('session_logs').delete().eq('booking_id', bookingId));
      await expectCleanupSuccess('revenue', mockSupabaseAdminClient.from('revenue').delete().eq('booking_id', bookingId));
      await expectCleanupSuccess('bookings', mockSupabaseAdminClient.from('bookings').delete().eq('id', bookingId));
    }

    if (created.packages.length > 0) {
      await expectCleanupSuccess('packages', mockSupabaseAdminClient.from('packages').delete().in('id', created.packages));
    }
    if (created.customers.length > 0) {
      await expectCleanupSuccess('customers', mockSupabaseAdminClient.from('customers').delete().in('id', created.customers));
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
        phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
        base_salary: 0,
      })
      .select('id, email, tenant_id, role, full_name')
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    created.users.push(data!.id);
    return data!;
  }

  async function insertPackage(input: {
    tenantId: string;
    name: string;
    price: number;
    totalSessions: number;
  }): Promise<string> {
    const { data, error } = await mockSupabaseAdminClient
      .from('packages')
      .insert({
        tenant_id: input.tenantId,
        name: input.name,
        description: 'Real package for Bella Nail revenue proof',
        price: input.price,
        total_sessions: input.totalSessions,
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

  async function createNailCustomer(label: string) {
    const result = await createCustomer({
      name_mother: `${marker} ${label}`,
      phone: `08${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });

    expect(result.error).toBeFalsy();
    expect(result.data?.id).toBeTruthy();
    created.customers.push(result.data!.id);
    return result.data!.id;
  }

  async function getSessionForBooking(bookingId: string, sessionNumber = 1) {
    const { data, error } = await mockSupabaseAdminClient
      .from('session_logs')
      .select('id, status, tenant_id')
      .eq('booking_id', bookingId)
      .eq('session_number', sessionNumber)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    return data!;
  }

  async function readRevenue(bookingId: string) {
    const { data, error } = await mockSupabaseAdminClient
      .from('revenue')
      .select('id, amount, status, revenue_type, payment_method, accounting_metadata')
      .eq('booking_id', bookingId)
      .order('received_date', { ascending: true })
      .order('id', { ascending: true });

    expect(error).toBeNull();
    return (data ?? []) as RevenueReadback[];
  }

  it('proves completed session revenue and payment debt read-back for a bella_nail tenant', async () => {
    const tenantId = await insertTenant();
    const admin = await insertUser(tenantId, 'admin', 'admin');
    const technician = await insertUser(tenantId, 'ktv', 'technician');
    mockGetCurrentUser.mockResolvedValue(admin);

    const singleSessionPackageId = await insertPackage({
      tenantId,
      name: `${marker} Nail le manicure`,
      price: 250_000,
      totalSessions: 1,
    });
    const singleSessionCustomerId = await createNailCustomer('single-session-customer');

    const singleSessionBooking = await createBooking({
      customer_id: singleSessionCustomerId,
      package_id: singleSessionPackageId,
      package_name: `${marker} Nail le manicure`,
      full_price: 250_000,
      deposit_amount: 0,
      total_sessions: 1,
      start_date: new Date().toISOString().slice(0, 10),
      assigned_ktv_id: technician.id,
      ktv_commission: 0,
      discount_percent: 0,
      preferred_time: '10:00',
      metadata: { product_key: 'bella_nail', proof: marker },
    });

    expect(singleSessionBooking.error).toBeFalsy();
    const singleSessionBookingId = String(singleSessionBooking.data!.id);
    created.bookings.push(singleSessionBookingId);

    const singleSession = await getSessionForBooking(singleSessionBookingId);
    const completeSingleSession = await completeSession(
      singleSession.id,
      singleSessionBookingId,
      'Bella Nail single-session service completed',
    );
    expect(completeSingleSession.error).toBeFalsy();

    const singleSessionRevenue = await readRevenue(singleSessionBookingId);
    const packagePayment = singleSessionRevenue.find((row) => row.revenue_type === 'package_payment');
    expect(packagePayment).toBeTruthy();
    expect(packagePayment?.status).toBe('confirmed');
    expect(getNumber(packagePayment?.amount)).toBe(250_000);
    expect(packagePayment?.payment_method).toBe('bank_transfer');

    const paidState = buildPaymentState({
      fullPrice: 250_000,
      depositAmount: 0,
      revenues: singleSessionRevenue,
    });
    expect(paidState.totalPaid).toBe(250_000);
    expect(paidState.remainingDebt).toBe(0);
    expect(paidState.hasOutstandingDebt).toBe(false);

    const { data: sessionDoneOutbox, error: sessionDoneOutboxError } = await mockSupabaseAdminClient
      .from('accounting_outbox')
      .select('id, event_type, reference_type, reference_id, payload')
      .eq('tenant_id', tenantId)
      .eq('event_type', 'SESSION_DONE')
      .eq('reference_type', 'SESSION_LOG')
      .eq('reference_id', singleSession.id)
      .single();
    expect(sessionDoneOutboxError).toBeNull();
    expect(sessionDoneOutbox?.id).toBeTruthy();

    const multiSessionPackageId = await insertPackage({
      tenantId,
      name: `${marker} Nail package manicure`,
      price: 300_000,
      totalSessions: 2,
    });
    const multiSessionCustomerId = await createNailCustomer('multi-session-customer');

    const multiSessionBooking = await createBooking({
      customer_id: multiSessionCustomerId,
      package_id: multiSessionPackageId,
      package_name: `${marker} Nail package manicure`,
      full_price: 300_000,
      deposit_amount: 100_000,
      total_sessions: 2,
      start_date: new Date().toISOString().slice(0, 10),
      assigned_ktv_id: technician.id,
      ktv_commission: 0,
      discount_percent: 0,
      preferred_time: '11:00',
      metadata: { product_key: 'bella_nail', proof: marker },
    });

    expect(multiSessionBooking.error).toBeFalsy();
    const multiSessionBookingId = String(multiSessionBooking.data!.id);
    created.bookings.push(multiSessionBookingId);

    const multiSession = await getSessionForBooking(multiSessionBookingId);
    const checkInResult = await updateSessionLog(multiSession.id, {
      status: 'in_progress',
      notes: 'Bella Nail customer checked in',
    });
    expect(checkInResult.error).toBeFalsy();

    const completeMultiSession = await completeSession(
      multiSession.id,
      multiSessionBookingId,
      'Bella Nail first package session completed',
    );
    expect(completeMultiSession.error).toBeFalsy();

    const revenueBeforeRemainingPayment = await readRevenue(multiSessionBookingId);
    const depositRevenue = revenueBeforeRemainingPayment.find((row) => row.revenue_type === 'deposit');
    expect(depositRevenue).toBeTruthy();
    expect(depositRevenue?.status).toBe('confirmed');
    expect(getNumber(depositRevenue?.amount)).toBe(100_000);

    const debtState = buildPaymentState({
      fullPrice: 300_000,
      depositAmount: 100_000,
      revenues: revenueBeforeRemainingPayment,
    });
    expect(debtState.totalPaid).toBe(100_000);
    expect(debtState.remainingDebt).toBe(200_000);
    expect(debtState.hasOutstandingDebt).toBe(true);

    const paymentIdempotencyKey = `${marker}-remaining-payment`;
    const remainingPayment = await recordRemainingPayment({
      booking_id: multiSessionBookingId,
      customer_id: multiSessionCustomerId,
      amount: debtState.remainingDebt,
      payment_method: 'cash',
      status: 'confirmed',
      revenue_type: 'remaining_payment',
      notes: 'Bella Nail remaining payment proof',
      idempotency_key: paymentIdempotencyKey,
    });

    expect(remainingPayment.error).toBeFalsy();

    const duplicatePayment = await recordRemainingPayment({
      booking_id: multiSessionBookingId,
      customer_id: multiSessionCustomerId,
      amount: debtState.remainingDebt,
      payment_method: 'cash',
      status: 'confirmed',
      revenue_type: 'remaining_payment',
      notes: 'Bella Nail remaining payment duplicate proof',
      idempotency_key: paymentIdempotencyKey,
    });
    expect(duplicatePayment.error).toBeFalsy();

    const finalRevenueRows = await readRevenue(multiSessionBookingId);
    const remainingPayments = finalRevenueRows.filter((row) => {
      const metadata = asRecord(row.accounting_metadata);
      return metadata?.manual_payment_idempotency_key === paymentIdempotencyKey;
    });
    expect(remainingPayments).toHaveLength(1);
    expect(getNumber(remainingPayments[0].amount)).toBe(200_000);
    expect(remainingPayments[0].status).toBe('confirmed');
    expect(remainingPayments[0].payment_method).toBe('cash');

    const finalPaidState = buildPaymentState({
      fullPrice: 300_000,
      depositAmount: 100_000,
      revenues: finalRevenueRows,
    });
    expect(finalPaidState.totalPaid).toBe(300_000);
    expect(finalPaidState.remainingDebt).toBe(0);
    expect(finalPaidState.hasOutstandingDebt).toBe(false);

    const paymentPayload = asRecord(remainingPayment.data);
    const financeAllocation = asRecord(paymentPayload?.finance_ar_allocation);
    if (financeAllocation) {
      expect(['ALLOCATED', 'SKIPPED', 'FAILED']).toContain(financeAllocation.status);
    }

    const { data: storedTenant, error: tenantError } = await mockSupabaseAdminClient
      .from('tenants')
      .select('id, product_key')
      .eq('id', tenantId)
      .single();
    expect(tenantError).toBeNull();
    expect(storedTenant).toMatchObject({
      id: tenantId,
      product_key: 'bella_nail',
    });
  });
});
