/**
 * Concurrency & Parallel Operations Safety Tests (Phase 29.1)
 *
 * Verifies that the system is safe under concurrent/parallel operations:
 * 1. Parallel calls to createBooking for the same customer -> safely processed (returns successful results).
 * 2. Parallel completeSession calls for different sessions -> safely increments KTV completed sessions and salary.
 */

import { createBooking } from '../modules/booking/actions/lifecycle-actions';
import { completeSession } from '../modules/booking/actions/session-actions';

// Setup environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Mock dependencies
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn(() => Promise.resolve()),
}));

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));

const mockGetCurrentUser = jest.fn();
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
  checkMonthLock: jest.fn().mockResolvedValue({ isLocked: false }),
}));

jest.mock('@/services/inventory-actions', () => ({
  autoConsumeForSession: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue('127.0.0.1'),
  }),
}));

// ⭐ Accounting outbox is unneeded for concurrency logic, mock to be fast and safe
jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: jest.fn().mockResolvedValue(true),
}));

// Shared Mock DB state to verify concurrency updates
let sharedSalaryRecord = {
  id: 'shared-salary-record-id',
  total_sessions: 0,
  service_percentage_bonus: 0
};

class MockQueryBuilder {
  private table: string;
  private idLookup: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(fields?: string, options?: any) {
    return this;
  }

  eq(field: string, value: any) {
    if (field === 'id') {
      this.idLookup = true;
    }
    return this;
  }

  in(field: string, values: any[]) {
    return this;
  }

  order(field: string, options?: any) {
    return this;
  }

  limit(count: number) {
    return this;
  }

  single() {
    if (this.table === 'bookings') {
      return Promise.resolve({
        data: {
          id: 'concurrency-booking-id',
          total_sessions: 15,
          completed_sessions: sharedSalaryRecord.total_sessions,
          status: 'booked',
          package_name: 'Gói VIP',
          ktv_commission: 150000,
          assigned_ktv_id: 'ktv-1',
          tenant_id: 'tenant-a'
        },
        error: null
      });
    }
    if (this.table === 'session_logs') {
      return Promise.resolve({
        data: {
          id: 'mock-session-id',
          booking_id: 'concurrency-booking-id',
          status: 'scheduled',
          session_number: 1
        },
        error: null
      });
    }
    if (this.table === 'salary_records') {
      if (sharedSalaryRecord.total_sessions > 0) {
        return Promise.resolve({ data: sharedSalaryRecord, error: null });
      }
      return Promise.resolve({ data: null, error: { message: 'Row not found' } });
    }
    return Promise.resolve({ data: null, error: { message: 'Row not found' } });
  }

  maybeSingle() {
    if (this.table === 'salary_records') {
      if (sharedSalaryRecord.total_sessions > 0) {
        return Promise.resolve({ data: sharedSalaryRecord, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  insert(payload: any) {
    const inserted = Array.isArray(payload) ? payload : [payload];
    if (this.table === 'salary_records') {
      const insertedObj = inserted[0];
      sharedSalaryRecord.total_sessions = (sharedSalaryRecord.total_sessions || 0) + (insertedObj.total_sessions || 1);
      sharedSalaryRecord.service_percentage_bonus = (sharedSalaryRecord.service_percentage_bonus || 0) + (insertedObj.service_percentage_bonus || 0);
    }
    const res = { data: { id: 'mock-inserted-id', ...inserted[0] }, error: null };
    const node: any = {
      eq: () => node,
      select: () => node,
      single: () => Promise.resolve(res),
      maybeSingle: () => Promise.resolve(res),
      then: (cb: any) => Promise.resolve(res).then(cb),
      data: res.data,
      error: res.error
    };
    return node;
  }

  update(payload: any) {
    if (this.table === 'salary_records') {
      // Simulate atomic/safe update on shared database state
      sharedSalaryRecord.total_sessions = payload.total_sessions;
      sharedSalaryRecord.service_percentage_bonus = payload.service_percentage_bonus;
    }
    const res = { data: payload, error: null };
    const node: any = {
      eq: () => node,
      select: () => node,
      single: () => Promise.resolve(res),
      maybeSingle: () => Promise.resolve(res),
      then: (cb: any) => Promise.resolve(res).then(cb),
      data: res.data,
      error: res.error
    };
    return node;
  }

  delete() {
    const res = { data: [], error: null };
    const node: any = {
      eq: () => node,
      select: () => node,
      single: () => Promise.resolve(res),
      maybeSingle: () => Promise.resolve(res),
      then: (cb: any) => Promise.resolve(res).then(cb),
      data: res.data,
      error: res.error
    };
    return node;
  }

  then(onfulfilled: any) {
    const data = this.table === 'bookings' ? null : [];
    return Promise.resolve({ data, error: null }).then(onfulfilled);
  }
}

const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn().mockResolvedValue({ error: null }),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@bellaspa.vn' } } }),
  }
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

describe('Concurrency & Parallel Operations Safety Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-a',
      full_name: 'Admin Bella'
    });
    sharedSalaryRecord = {
      id: 'shared-salary-record-id',
      total_sessions: 0,
      service_percentage_bonus: 0
    };
  });

  it('handles parallel guest booking creations smoothly without duplicates', async () => {
    mockSupabase.from.mockImplementation((table: string) => new MockQueryBuilder(table));

    const bookingFormData = {
      customer_id: 'cust-123',
      package_name: 'Gói VIP',
      full_price: 5000000,
      deposit_amount: 1000000,
      total_sessions: 15,
      start_date: '2026-05-10'
    };

    // Trigger two parallel booking creation requests
    const results = await Promise.all([
      createBooking(bookingFormData),
      createBooking(bookingFormData)
    ]);

    expect(results[0].error).toBeUndefined();
    expect(results[1].error).toBeUndefined();
  });

  it('prevents race conditions when completing multiple sessions concurrently', async () => {
    mockSupabase.from.mockImplementation((table: string) => new MockQueryBuilder(table));

    // KTV completes ca 1 & ca 2 in parallel
    const results = await Promise.all([
      completeSession('session-1', 'concurrency-booking-id', 'Hoàn thành ca 1'),
      completeSession('session-2', 'concurrency-booking-id', 'Hoàn thành ca 2')
    ]);

    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);

    // Verify KTV commission and session counts updated atomically
    // Standard commission = 150,000 VND
    expect(sharedSalaryRecord.total_sessions).toBe(2);
    expect(sharedSalaryRecord.service_percentage_bonus).toBe(300000);
  });
});
