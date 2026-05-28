/**
 * Transaction Safety & Rollback Integrity Tests (Phase 29.1)
 *
 * Verifies that partial failures result in clean rollbacks to keep the database consistent:
 * 1. createBooking succeeds but insert revenue fails -> rollback booking insert (delete the booking).
 * 2. completeSession succeeds but upsert salary fails -> rollback session completed status & bookings count.
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

// Mock Query Chain builder with full robust method chaining support
class MockQueryBuilder {
  private table: string;
  private forceError: boolean;
  public updatePayloads: any[] = [];
  public deleteCalled: boolean = false;
  public insertCalled: boolean = false;
  public updateCalled: boolean = false;
  public idLookup: boolean = false;

  constructor(table: string, forceError: boolean = false) {
    this.table = table;
    this.forceError = forceError;
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
      if (this.insertCalled || this.updateCalled || this.idLookup) {
        return Promise.resolve({
          data: {
            id: 'mock-booking-id',
            total_sessions: 15,
            completed_sessions: 0,
            status: 'booked',
            package_name: 'Gói VIP',
            ktv_commission: 150000,
            assigned_ktv_id: 'ktv-1',
            tenant_id: 'tenant-a'
          },
          error: null
        });
      }
      // Exist check
      return Promise.resolve({ data: null, error: { message: 'Row not found' } });
    }
    if (this.table === 'session_logs') {
      return Promise.resolve({
        data: {
          id: 'mock-session-id',
          booking_id: 'mock-booking-id',
          status: 'scheduled',
          session_number: 1
        },
        error: null
      });
    }
    return Promise.resolve({ data: null, error: { message: 'Row not found' } });
  }

  maybeSingle() {
    if (this.table === 'salary_records') {
      return Promise.resolve({
        data: {
          id: 'mock-salary-record-id',
          total_sessions: 5,
          service_percentage_bonus: 750000
        },
        error: null
      });
    }
    return Promise.resolve({ data: null, error: null });
  }

  insert(payload: any) {
    this.insertCalled = true;
    const inserted = Array.isArray(payload) ? payload : [payload];
    const res = this.forceError
      ? { data: null, error: { message: 'Forced DB Insert Error' } }
      : { data: { id: 'mock-inserted-id', ...inserted[0] }, error: null };

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
    this.updatePayloads.push(payload);
    const res = this.forceError 
      ? { data: null, error: { message: 'Forced DB Update Error' } }
      : { data: payload, error: null };
    
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
    this.deleteCalled = true;
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

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'revenue') return new MockQueryBuilder(table, true);
      return new MockQueryBuilder(table);
    }),
  })),
}));

describe('Transaction Safety & Rollback Integrity Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-a',
      full_name: 'Admin Bella'
    });
  });

  it('rolls back booking insertion when revenue registration fails', async () => {
    const bookingQueryBuilder = new MockQueryBuilder('bookings');
    const revenueQueryBuilder = new MockQueryBuilder('revenue', true); // Force error here!

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'bookings') return bookingQueryBuilder;
      if (table === 'revenue') return revenueQueryBuilder;
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
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Không thể ghi nhận doanh thu đặt cọc');
    
    // Assert rollback happened (booking delete was called)
    expect(bookingQueryBuilder.deleteCalled).toBe(true);
  });

  it('rolls back session completed status and completed count in booking when salary update fails', async () => {
    const sessionLogsQueryBuilder = new MockQueryBuilder('session_logs');
    const bookingsQueryBuilder = new MockQueryBuilder('bookings');
    const salaryRecordsQueryBuilder = new MockQueryBuilder('salary_records', true); // Force error here!

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'session_logs') return sessionLogsQueryBuilder;
      if (table === 'bookings') return bookingsQueryBuilder;
      if (table === 'salary_records') return salaryRecordsQueryBuilder;
      return new MockQueryBuilder(table);
    });

    const result = await completeSession('mock-session-id', 'mock-booking-id', 'Thành ca');
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Không thể ghi nhận lương cho KTV');

    // Verify session log rolled back to original scheduled state
    // First update was status: completed, second update was rollback: scheduled
    expect(sessionLogsQueryBuilder.updatePayloads).toContainEqual(expect.objectContaining({
      status: 'scheduled',
      completed_date: null,
      completed_by_ktv_id: null
    }));

    // Verify bookings completed count rolled back to 0
    expect(bookingsQueryBuilder.updatePayloads).toContainEqual(expect.objectContaining({
      completed_sessions: 0,
      status: 'booked'
    }));
  });
});
