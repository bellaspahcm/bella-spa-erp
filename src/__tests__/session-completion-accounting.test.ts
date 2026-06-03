jest.mock('server-only', () => ({}), { virtual: true });

const mockEnqueueWithAutoClient = jest.fn();

jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: (...args: unknown[]) => mockEnqueueWithAutoClient(...args),
}));

import {
  enqueueSessionDoneAccountingOutbox,
  ensureSessionReviewPlaceholder,
} from '../modules/booking/actions/session-completion-helpers';

type DbCall = {
  table: string;
  op: 'delete' | 'insert' | 'select' | 'update';
  payload?: unknown;
  filters: Array<[string, unknown]>;
};

function createSupabaseMock(results: Array<{ data?: unknown; error?: { message: string } }> = []) {
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

    then(onfulfilled: (value: { data: unknown; error: unknown }) => unknown) {
      return this.resolve().then(onfulfilled);
    }

    private resolve() {
      const next = results.shift() ?? {};
      return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
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
  });

  it('rolls back single-session revenue and booking progress when SESSION_DONE enqueue returns false', async () => {
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);
    const { calls, supabase } = createSupabaseMock();

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
        tenant_id: 'tenant-1',
        full_price: 500000,
        deposit_amount: 200000,
        discount_percent: 0,
      },
      isInventoryConsumed: false,
      isRevenueCreated: true,
    });

    expect(result).toEqual({
      error: expect.stringContaining('Failed to enqueue SESSION_DONE accounting event'),
    });
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'revenue',
        op: 'delete',
        filters: expect.arrayContaining([
          ['booking_id', 'booking-1'],
          ['amount', 350000],
          ['notes', 'Tự động: Thu phí dịch vụ lẻ - Gói dịch vụ lẻ'],
        ]),
      }),
      expect.objectContaining({
        table: 'bookings',
        op: 'update',
        payload: { completed_sessions: 1, status: 'booked' },
        filters: [['id', 'booking-1']],
      }),
    ]));
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
      expect.objectContaining({ table: 'session_reviews', op: 'select' }),
      expect.objectContaining({
        table: 'session_reviews',
        op: 'insert',
        payload: [expect.objectContaining({ session_log_id: 'session-1', status: 'pending_review' })],
      }),
    ]);
  });
});
