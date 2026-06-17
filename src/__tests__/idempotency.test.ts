/**
 * Idempotency & Repeat Operations Integrity Tests (Phase 29.1)
 *
 * Verifies that duplicate operations do not cause side effects:
 * 1. createBooking is called twice -> first inserts, second updates existing booking instead of inserting again.
 * 2. completeSession is called twice on the same session -> first succeeds, second fails with Idempotent error.
 */

import { createBooking } from '../core/services/order/lifecycle-actions';
import { completeSession } from '../core/services/order/session-actions';

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

jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: jest.fn().mockResolvedValue(true),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue('127.0.0.1'),
  }),
}));

class MockQueryBuilder {
  private table: string;
  private hasExisting: boolean;
  public insertCalled: boolean = false;
  public updateCalled: boolean = false;

  constructor(table: string, hasExisting: boolean = false) {
    this.table = table;
    this.hasExisting = hasExisting;
  }

  select(fields?: string, options?: any) {
    return this;
  }

  eq(field: string, value: any) {
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
      if (this.hasExisting) {
        return Promise.resolve({
          data: {
            id: 'existing-booking-id',
            booking_number: 'BK-100',
            deposit_amount: 1000000,
            total_sessions: 15,
            status: 'deposit_pending'
          },
          error: null
        });
      }
      return Promise.resolve({ data: null, error: { message: 'Row not found' } });
    }
    if (this.table === 'session_logs') {
      return Promise.resolve({
        data: {
          id: 'mock-session-id',
          booking_id: 'mock-booking-id',
          status: 'completed', // Already completed!
          session_number: 1
        },
        error: null
      });
    }
    return Promise.resolve({ data: null, error: { message: 'Row not found' } });
  }

  maybeSingle() {
    return Promise.resolve({ data: null, error: null });
  }

  insert(payload: any) {
    this.insertCalled = true;
    const inserted = Array.isArray(payload) ? payload : [payload];
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
    this.updateCalled = true;
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
    // If hasExisting is true, return the existing booking to emulate duplicate detection
    const data = this.table === 'bookings' && this.hasExisting
      ? { id: 'existing-booking-id', booking_number: 'BK-100' }
      : null;
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

describe('Idempotency & Repeat Operations Integrity Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-a',
      full_name: 'Admin Bella'
    });
  });

  it('updates instead of inserting when booking is created twice (idempotent duplicate prevention)', async () => {
    const bookingQueryBuilder = new MockQueryBuilder('bookings', true); // Existing booking exists!

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'bookings') return bookingQueryBuilder;
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  id: 'tenant-a',
                  name: 'Bella Spa Test',
                  status: 'active',
                  module_id: 'spa',
                  subscription_tier: 'premium'
                },
                error: null
              })
            })
          })
        };
      }
      return new MockQueryBuilder(table);
    });

    const bookingFormData = {
      customer_id: 'cust-123',
      package_name: 'Gói VIP',
      full_price: 5000000,
      deposit_amount: 1000000,
      total_sessions: 15,
      start_date: '2026-05-10'
    };

    const result = await createBooking(bookingFormData);
    expect(result.error).toBeUndefined();
    
    // Should call update on bookings, NOT insert!
    expect(bookingQueryBuilder.updateCalled).toBe(true);
    expect(bookingQueryBuilder.insertCalled).toBe(false);
  });

  it('fails with Idempotent error when completeSession is called on already completed session', async () => {
    const sessionLogsQueryBuilder = new MockQueryBuilder('session_logs');

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'session_logs') return sessionLogsQueryBuilder;
      return new MockQueryBuilder(table);
    });

    const result = await completeSession('mock-session-id', 'mock-booking-id', 'Hoàn thành lại');
    expect(result.error).toBeDefined();
    expect(result.error).toContain('đã hoàn thành trước đó (Idempotent)');
  });
});
