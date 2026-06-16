jest.mock('server-only', () => ({}), { virtual: true });

const mockEnqueueWithAutoClient = jest.fn();
const mockAssertOpenAccountingPeriod = jest.fn();
const mockAutoConsumeForSession = jest.fn();
const mockRollbackInventoryConsumption = jest.fn();
const mockRecalculateAndSaveSalaryRecord = jest.fn();

jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: (...args: unknown[]) => mockEnqueueWithAutoClient(...args),
}));

jest.mock('@/core/services/accounting/period-guards', () => ({
  assertOpenAccountingPeriod: (...args: unknown[]) => mockAssertOpenAccountingPeriod(...args),
}));

jest.mock('@/services/inventory-actions', () => ({
  autoConsumeForSession: (...args: unknown[]) => mockAutoConsumeForSession(...args),
  rollbackInventoryConsumption: (...args: unknown[]) => mockRollbackInventoryConsumption(...args),
}));

jest.mock('@/modules/hr-salary/actions/admin-salary-actions', () => ({
  recalculateAndSaveSalaryRecord: (...args: unknown[]) => mockRecalculateAndSaveSalaryRecord(...args),
}));

import { processSessionCompletion } from '../core/services/order/session-completion-engine';
import {
  buildCompletedSessionAccountingUpdate,
  enqueueSessionDoneAccountingOutbox,
  ensureSessionReviewPlaceholder,
  recordSingleSessionRevenueIfNeeded,
} from '../core/services/order/session-completion-helpers';

type DbCall = {
  table: string;
  op: 'delete' | 'insert' | 'select' | 'update';
  payload?: unknown;
  filters: Array<[string, unknown]>;
};

function createSupabaseMock(results: Array<{ data?: unknown; count?: number; error?: { message: string } }> = []) {
  const calls: DbCall[] = [];

  class QueryBuilder {
    private call: DbCall | null = null;

    constructor(private table: string) {}

    select() {
      this.call = { table: this.table, op: 'select', filters: [] };
      calls.push(this.call);
      return this;
    }

    insert(payload: unknown) {
      this.call = { table: this.table, op: 'insert', payload, filters: [] };
      calls.push(this.call);
      return this;
    }

    update(payload: unknown) {
      this.call = { table: this.table, op: 'update', payload, filters: [] };
      calls.push(this.call);
      return this;
    }

    delete() {
      this.call = { table: this.table, op: 'delete', filters: [] };
      calls.push(this.call);
      return this;
    }

    eq(column: string, value: unknown) {
      this.call?.filters.push([column, value]);
      return this;
    }

    maybeSingle() {
      return this.resolve();
    }

    single() {
      return this.resolve();
    }

    then(onfulfilled: (value: { data: unknown; error: unknown }) => unknown) {
      return this.resolve().then(onfulfilled);
    }

    private resolve() {
      const next = results.shift() ?? {};
      return Promise.resolve({ data: next.data ?? null, count: next.count ?? null, error: next.error ?? null });
    }
  }

  return {
    calls,
    supabase: {
      from: jest.fn((table: string) => new QueryBuilder(table)),
    },
  };
}

describe('session completion accounting side effects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueueWithAutoClient.mockResolvedValue(true);
    mockAssertOpenAccountingPeriod.mockResolvedValue(undefined);
    mockAutoConsumeForSession.mockResolvedValue({ success: true, bypassed: true });
    mockRollbackInventoryConsumption.mockResolvedValue({ success: true });
    mockRecalculateAndSaveSalaryRecord.mockResolvedValue({ success: true });
  });

  it('builds completed session accounting metadata from booking value and discount', () => {
    const patch = buildCompletedSessionAccountingUpdate({
      sessionId: 'session-1',
      bookingId: 'booking-1',
      completedByKtvId: 'ktv-1',
      completedDate: '2026-06-11',
      fullPrice: 6000000,
      discountPercent: 25,
      totalSessions: 30,
      existingAccountingMetadata: {
        source: 'manual-update',
      },
    });

    expect(patch).toEqual({
      business_event_type: 'SESSION_REVENUE_RECOGNIZED',
      accounting_review_status: 'UNREVIEWED',
      accounting_metadata: expect.objectContaining({
        source: 'manual-update',
        session_log_id: 'session-1',
        booking_id: 'booking-1',
        earned_revenue: 150000,
        completed_by_ktv_id: 'ktv-1',
        completed_date: '2026-06-11',
        status: 'completed',
      }),
    });
  });

  it('rolls back single-session revenue and booking progress when SESSION_DONE enqueue returns false', async () => {
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);
    const { calls, supabase } = createSupabaseMock([
      { data: [{ amount: 200000, status: 'confirmed', revenue_type: 'deposit' }] },
    ]);

    const result = await enqueueSessionDoneAccountingOutbox({
      supabase: supabase as never,
      sessionId: 'session-1',
      bookingId: 'booking-1',
      tenantId: 'tenant-1',
      ktvId: 'ktv-1',
      today: '2026-06-03',
      existingLog: { session_number: 2 },
      currentBooking: {
        package_name: 'Gói dịch vụ lẻ',
        completed_sessions: 1,
        status: 'booked',
        total_sessions: 5,
        ktv_commission: 30000,
        assigned_ktv_id: 'ktv-1',
        customer_id: 'customer-1',
        tenant_id: 'tenant-1',
        full_price: 500000,
        deposit_amount: 200000,
        discount_percent: 0,
      },
      isInventoryConsumed: false,
      isRevenueCreated: true,
      createdRevenueId: 'revenue-1',
    });

    expect(result).toEqual({
      error: expect.stringContaining('Failed to enqueue SESSION_DONE accounting event'),
    });
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'revenue',
        op: 'delete',
        filters: [['id', 'revenue-1']],
      }),
      expect.objectContaining({
        table: 'bookings',
        op: 'update',
        payload: { completed_sessions: 1, status: 'booked' },
        filters: [['id', 'booking-1']],
      }),
    ]));
  });

  it('reports rollback failures when inventory rollback cannot be restored', async () => {
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);
    mockRollbackInventoryConsumption.mockResolvedValueOnce({
      success: false,
      error: 'inventory rollback failed',
    });
    const { calls, supabase } = createSupabaseMock([
      { data: [{ amount: 200000, status: 'confirmed', revenue_type: 'deposit' }] },
    ]);

    const result = await enqueueSessionDoneAccountingOutbox({
      supabase: supabase as never,
      sessionId: 'session-1',
      bookingId: 'booking-1',
      tenantId: 'tenant-1',
      ktvId: 'ktv-1',
      today: '2026-06-03',
      existingLog: { session_number: 2 },
      currentBooking: {
        package_name: 'G\u00f3i d\u1ecbch v\u1ee5 l\u1ebb',
        completed_sessions: 1,
        status: 'booked',
        total_sessions: 5,
        ktv_commission: 30000,
        assigned_ktv_id: 'ktv-1',
        customer_id: 'customer-1',
        tenant_id: 'tenant-1',
        full_price: 500000,
        deposit_amount: 200000,
        discount_percent: 0,
      },
      isInventoryConsumed: true,
      isRevenueCreated: true,
      createdRevenueId: 'revenue-1',
    });

    expect(result).toEqual({
      error: expect.stringContaining('rollback failed: inventory rollback failed'),
    });
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'revenue',
        op: 'delete',
        filters: [['id', 'revenue-1']],
      }),
      expect.objectContaining({
        table: 'bookings',
        op: 'update',
        payload: { completed_sessions: 1, status: 'booked' },
        filters: [['id', 'booking-1']],
      }),
    ]));
    expect(mockRollbackInventoryConsumption).toHaveBeenCalledWith('session-1');
  });

  it('returns an explicit error when the review placeholder insert fails', async () => {
    const { calls, supabase } = createSupabaseMock([
      { data: null },
      { error: { message: 'review insert failed' } },
    ]);

    const result = await ensureSessionReviewPlaceholder({
      supabase: supabase as never,
      sessionId: 'session-1',
      ktvId: 'ktv-1',
      tenantId: 'tenant-1',
      currentBooking: {
        package_name: 'Gói dịch vụ',
        completed_sessions: 1,
        status: 'booked',
        total_sessions: 5,
        ktv_commission: 30000,
        assigned_ktv_id: 'ktv-1',
        customer_id: 'customer-1',
        tenant_id: 'tenant-1',
        full_price: 500000,
        deposit_amount: 200000,
        discount_percent: 0,
      },
    });

    expect(result).toEqual({
      error: 'Không thể tạo review chờ đánh giá: review insert failed',
    });
    expect(calls).toEqual([
      expect.objectContaining({
        table: 'session_reviews',
        op: 'select',
        filters: [
          ['session_log_id', 'session-1'],
          ['tenant_id', 'tenant-1'],
        ],
      }),
      expect.objectContaining({
        table: 'session_reviews',
        op: 'insert',
        payload: [expect.objectContaining({
          session_log_id: 'session-1',
          reviewer_id: 'customer-1',
          ktv_id: 'ktv-1',
          status: 'pending_review',
          tenant_id: 'tenant-1',
        })],
      }),
    ]);
  });

  it('blocks review placeholder creation when booking belongs to another tenant', async () => {
    const { calls, supabase } = createSupabaseMock();

    const result = await ensureSessionReviewPlaceholder({
      supabase: supabase as never,
      sessionId: 'session-1',
      ktvId: 'ktv-1',
      tenantId: 'bella-tenant',
      currentBooking: {
        package_name: 'Gói dịch vụ',
        completed_sessions: 1,
        status: 'booked',
        total_sessions: 5,
        ktv_commission: 30000,
        assigned_ktv_id: 'ktv-1',
        customer_id: 'beauty-customer-1',
        tenant_id: 'beauty-tenant',
        full_price: 500000,
        deposit_amount: 200000,
        discount_percent: 0,
      },
    });

    expect(result).toEqual({
      error: 'Booking không thuộc chi nhánh hiện tại, không thể tạo review chờ đánh giá.',
    });
    expect(calls).toEqual([]);
  });

  it('creates confirmed revenue and PACKAGE_SALE outbox for single-session packages', async () => {
    const { calls, supabase } = createSupabaseMock([
      { data: { id: 'revenue-1' } },
    ]);

    const result = await recordSingleSessionRevenueIfNeeded({
      supabase: supabase as never,
      bookingId: 'booking-1',
      tenantId: 'tenant-1',
      today: '2026-06-03',
      sessionId: 'session-1',
      isInventoryConsumed: false,
      currentBooking: {
        package_name: 'G\u00f3i d\u1ecbch v\u1ee5 l\u1ebb',
        completed_sessions: 1,
        status: 'booked',
        total_sessions: 5,
        ktv_commission: 30000,
        assigned_ktv_id: 'ktv-1',
        customer_id: 'customer-1',
        tenant_id: 'tenant-1',
        full_price: 500000,
        deposit_amount: 200000,
        discount_percent: 0,
      },
    });

    expect(result).toEqual({ isRevenueCreated: true, createdRevenueId: 'revenue-1' });
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'revenue',
        op: 'insert',
        payload: [expect.objectContaining({
          booking_id: 'booking-1',
          amount: 350000,
          revenue_type: 'package_payment',
          payment_method: 'bank_transfer',
          received_date: '2026-06-03',
          status: 'confirmed',
          tenant_id: 'tenant-1',
          accounting_metadata: expect.objectContaining({
            amount: 350000,
            booking_id: 'booking-1',
          }),
        })],
      }),
    ]));
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        tenantId: 'tenant-1',
        eventType: 'PACKAGE_SALE',
        referenceType: 'REVENUE',
        referenceId: 'revenue-1',
        payload: expect.objectContaining({
          totalAmount: 350000,
          branchId: 'tenant-1',
        }),
      }),
      '[processSessionCompletion:single-session-revenue]'
    );
  });

  it('rolls back single-session revenue and booking progress when PACKAGE_SALE enqueue fails', async () => {
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);
    const { calls, supabase } = createSupabaseMock([
      { data: { id: 'revenue-1' } },
      {},
      {},
    ]);

    const result = await recordSingleSessionRevenueIfNeeded({
      supabase: supabase as never,
      bookingId: 'booking-1',
      tenantId: 'tenant-1',
      today: '2026-06-03',
      sessionId: 'session-1',
      isInventoryConsumed: false,
      currentBooking: {
        package_name: 'G\u00f3i d\u1ecbch v\u1ee5 l\u1ebb',
        completed_sessions: 1,
        status: 'booked',
        total_sessions: 5,
        ktv_commission: 30000,
        assigned_ktv_id: 'ktv-1',
        customer_id: 'customer-1',
        tenant_id: 'tenant-1',
        full_price: 500000,
        deposit_amount: 200000,
        discount_percent: 0,
      },
    });

    expect(result).toEqual({ error: expect.any(String) });
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'revenue',
        op: 'delete',
        filters: [['id', 'revenue-1']],
      }),
      expect.objectContaining({
        table: 'bookings',
        op: 'update',
        payload: { completed_sessions: 1, status: 'booked' },
        filters: [['id', 'booking-1']],
      }),
    ]));
  });

  it('processes booking progress, single-session revenue, salary, review, and SESSION_DONE outbox end to end', async () => {
    mockAutoConsumeForSession.mockResolvedValueOnce({ success: true, bypassed: false });
    const currentBooking = {
      package_name: 'G\u00f3i d\u1ecbch v\u1ee5 l\u1ebb',
      completed_sessions: 1,
      status: 'booked',
      total_sessions: 5,
      ktv_commission: 30000,
      assigned_ktv_id: 'ktv-1',
      customer_id: 'customer-1',
      tenant_id: 'tenant-1',
      full_price: 500000,
      deposit_amount: 0,
      discount_percent: 0,
    };
    const { calls, supabase } = createSupabaseMock([
      { count: 2 },
      { data: currentBooking },
      {},
      { data: { id: 'revenue-1' } },
      { data: null },
      {},
      { data: [{ amount: 200000, status: 'confirmed', revenue_type: 'deposit' }] },
    ]);

    const result = await processSessionCompletion(
      supabase as never,
      'session-1',
      'booking-1',
      'tenant-1',
      'ktv-1',
      '2026-06-03',
      'package-1',
      { session_number: 2 },
      { id: 'user-1' }
    );

    expect(result).toEqual({ success: true });
    expect(mockAssertOpenAccountingPeriod).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        tenantId: 'tenant-1',
        date: '2026-06-03',
        context: 'Complete booking session',
      })
    );
    expect(mockAutoConsumeForSession).toHaveBeenCalledWith('package-1', 'session-1');
    expect(mockRecalculateAndSaveSalaryRecord).toHaveBeenCalledWith(
      supabase,
      'ktv-1',
      '2026-06-01',
      'tenant-1'
    );
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'bookings',
        op: 'update',
        payload: expect.objectContaining({
          completed_sessions: 2,
          last_updated_date: '2026-06-03',
          status: 'in_progress',
        }),
        filters: [['id', 'booking-1']],
      }),
      expect.objectContaining({
        table: 'revenue',
        op: 'insert',
        payload: [expect.objectContaining({
          booking_id: 'booking-1',
          amount: 350000,
          status: 'confirmed',
        })],
      }),
      expect.objectContaining({
        table: 'session_reviews',
        op: 'insert',
        payload: [expect.objectContaining({
          session_log_id: 'session-1',
          reviewer_id: 'customer-1',
          ktv_id: 'ktv-1',
          status: 'pending_review',
          tenant_id: 'tenant-1',
        })],
      }),
    ]));
    expect(mockEnqueueWithAutoClient).toHaveBeenNthCalledWith(
      1,
      supabase,
      expect.objectContaining({ eventType: 'PACKAGE_SALE', referenceId: 'revenue-1' }),
      '[processSessionCompletion:single-session-revenue]'
    );
    expect(mockEnqueueWithAutoClient).toHaveBeenNthCalledWith(
      2,
      supabase,
      expect.objectContaining({
        eventType: 'SESSION_DONE',
        referenceType: 'SESSION_LOG',
        referenceId: 'session-1',
        payload: expect.objectContaining({
          bookingId: 'booking-1',
          ktvId: 'ktv-1',
          earnedRevenueAmount: 100000,
          deferredRevenueAmount: 100000,
          receivableAmount: 0,
          commissionAmount: 30000,
        }),
      }),
      '[processSessionCompletion]'
    );
  });

  it('rolls back revenue, booking progress, and inventory when review placeholder fails in the engine', async () => {
    mockAutoConsumeForSession.mockResolvedValueOnce({ success: true, bypassed: false });
    const currentBooking = {
      package_name: 'G\u00f3i d\u1ecbch v\u1ee5 l\u1ebb',
      completed_sessions: 1,
      status: 'booked',
      total_sessions: 5,
      ktv_commission: 30000,
      assigned_ktv_id: 'ktv-1',
      customer_id: 'customer-1',
      tenant_id: 'tenant-1',
      full_price: 500000,
      deposit_amount: 200000,
      discount_percent: 0,
    };
    const { calls, supabase } = createSupabaseMock([
      { count: 2 },
      { data: currentBooking },
      {},
      { data: { id: 'revenue-1' } },
      { data: null },
      { error: { message: 'review insert failed' } },
      {},
      {},
    ]);

    const result = await processSessionCompletion(
      supabase as never,
      'session-1',
      'booking-1',
      'tenant-1',
      'ktv-1',
      '2026-06-03',
      'package-1',
      { session_number: 2 },
      { id: 'user-1' }
    );

    expect(result).toEqual({ error: expect.stringContaining('review insert failed') });
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'revenue',
        op: 'delete',
        filters: [['id', 'revenue-1']],
      }),
      expect.objectContaining({
        table: 'bookings',
        op: 'update',
        payload: { completed_sessions: 1, status: 'booked' },
        filters: [['id', 'booking-1']],
      }),
    ]));
    expect(mockRollbackInventoryConsumption).toHaveBeenCalledWith('session-1');
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledTimes(1);
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ eventType: 'PACKAGE_SALE', referenceId: 'revenue-1' }),
      '[processSessionCompletion:single-session-revenue]'
    );
  });
});
