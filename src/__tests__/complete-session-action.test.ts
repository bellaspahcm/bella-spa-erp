jest.mock('server-only', () => ({}), { virtual: true });

const mockProcessSessionCompletion = jest.fn();
const mockSafeRevalidatePath = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockRecalculateAndSaveSalaryRecord = jest.fn();

jest.mock('@/core/services/order/session-completion-engine', () => ({
  processSessionCompletion: (...args: unknown[]) => mockProcessSessionCompletion(...args),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/modules/hr-salary/actions/admin-salary-actions', () => ({
  recalculateAndSaveSalaryRecord: (...args: unknown[]) => mockRecalculateAndSaveSalaryRecord(...args),
}));

import { completeSession } from '@/core/services/order';

type UpdateCall = {
  table: string;
  payload: unknown;
  filters: Array<[string, unknown]>;
};

function createCompleteSessionSupabaseMock(options: {
  sessionLog?: Record<string, unknown>;
  booking?: Record<string, unknown>;
  rollbackError?: { message: string };
} = {}) {
  const updateCalls: UpdateCall[] = [];
  const sessionLog = options.sessionLog ?? {
    id: 'session-1',
    booking_id: 'booking-1',
    status: 'scheduled',
    session_number: 1,
    tenant_id: 'tenant-1',
  };
  const booking = options.booking ?? {
    assigned_ktv_id: 'ktv-1',
    package_id: 'package-1',
    status: 'booked',
    full_price: 6000000,
    discount_percent: 25,
    total_sessions: 30,
  };

  class QueryBuilder {
    private selectColumns = '';
    private filters: Array<[string, unknown]> = [];

    constructor(private table: string, private operation?: 'update', private payload?: unknown) {}

    select(columns = '*') {
      this.selectColumns = columns;
      return this;
    }

    update(payload: unknown) {
      return new QueryBuilder(this.table, 'update', payload);
    }

    eq(column: string, value: unknown) {
      this.filters.push([column, value]);
      return this;
    }

    private matchesFilters(row: Record<string, unknown> | null) {
      if (!row) return false;
      return this.filters.every(([column, value]) => row[column] === value);
    }

    then(onfulfilled: (value: { error: { message: string } | null }) => unknown) {
      if (this.operation === 'update') {
        updateCalls.push({
          table: this.table,
          payload: this.payload,
          filters: this.filters,
        });

        const isRollback =
          this.table === 'session_logs' &&
          typeof this.payload === 'object' &&
          this.payload !== null &&
          (this.payload as { status?: unknown }).status === sessionLog.status;

        return Promise.resolve({
          error: isRollback ? options.rollbackError ?? null : null,
        }).then(onfulfilled);
      }

      return Promise.resolve({ error: null }).then(onfulfilled);
    }

    single() {
      if (this.table === 'session_logs') {
        return Promise.resolve(
          this.matchesFilters(sessionLog)
            ? { data: sessionLog, error: null }
            : { data: null, error: { message: 'session not found in tenant' } }
        );
      }

      if (this.table === 'bookings') {
        const scopedBooking = {
          id: 'booking-1',
          tenant_id: 'tenant-1',
          ...booking,
        };
        return Promise.resolve({
          data: this.selectColumns.includes('assigned_ktv_id') && this.matchesFilters(scopedBooking)
            ? scopedBooking
            : null,
          error: this.matchesFilters(scopedBooking) ? null : { message: 'booking not found in tenant' },
        });
      }

      return Promise.resolve({ data: null, error: { message: 'Unexpected table' } });
    }
  }

  const supabase = {
    from: jest.fn((table: string) => new QueryBuilder(table)),
  };

  return { supabase, updateCalls };
}

const mockCreateClient = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
}));

describe('completeSession wrapper rollback and revalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
    mockProcessSessionCompletion.mockResolvedValue({ success: true });
    mockSafeRevalidatePath.mockResolvedValue(undefined);
    mockRecalculateAndSaveSalaryRecord.mockResolvedValue({ success: true });
  });

  it('rolls back session status and skips revalidation when completion engine fails', async () => {
    const { supabase, updateCalls } = createCompleteSessionSupabaseMock();
    mockCreateClient.mockResolvedValue(supabase);
    mockProcessSessionCompletion.mockResolvedValueOnce({ error: 'engine failed' });

    const result = await completeSession('session-1', 'booking-1', 'Hoan thanh');

    expect(result).toEqual({ error: 'engine failed' });
    expect(updateCalls).toEqual([
      expect.objectContaining({
        table: 'session_logs',
        payload: expect.objectContaining({
          status: 'completed',
          completed_by_ktv_id: 'ktv-1',
          notes: 'Hoan thanh',
          business_event_type: 'SESSION_REVENUE_RECOGNIZED',
          accounting_review_status: 'UNREVIEWED',
          accounting_metadata: expect.objectContaining({
            session_log_id: 'session-1',
            booking_id: 'booking-1',
            earned_revenue: 150000,
            completed_by_ktv_id: 'ktv-1',
            status: 'completed',
          }),
        }),
        filters: [
          ['id', 'session-1'],
          ['tenant_id', 'tenant-1'],
        ],
      }),
      expect.objectContaining({
        table: 'session_logs',
        payload: {
          status: 'scheduled',
          completed_date: null,
          completed_by_ktv_id: null,
          business_event_type: undefined,
          accounting_review_status: undefined,
          accounting_metadata: undefined,
        },
        filters: [
          ['id', 'session-1'],
          ['tenant_id', 'tenant-1'],
        ],
      }),
    ]);
    expect(mockRecalculateAndSaveSalaryRecord).toHaveBeenCalledWith(
      supabase,
      'ktv-1',
      expect.stringMatching(/^\d{4}-\d{2}-01$/),
      'tenant-1'
    );
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('does not complete a session outside the current tenant', async () => {
    const { supabase, updateCalls } = createCompleteSessionSupabaseMock({
      sessionLog: {
        id: 'session-1',
        booking_id: 'booking-1',
        status: 'scheduled',
        session_number: 1,
        tenant_id: 'tenant-2',
      },
    });
    mockCreateClient.mockResolvedValue(supabase);

    const result = await completeSession('session-1', 'booking-1', 'Hoan thanh');

    expect(result).toEqual({ error: 'session not found in tenant' });
    expect(updateCalls).toEqual([]);
    expect(mockProcessSessionCompletion).not.toHaveBeenCalled();
  });

  it('returns an explicit error when session rollback fails', async () => {
    const { supabase } = createCompleteSessionSupabaseMock({
      rollbackError: { message: 'rollback update failed' },
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockProcessSessionCompletion.mockResolvedValueOnce({ error: 'engine failed' });

    const result = await completeSession('session-1', 'booking-1', 'Hoan thanh');

    expect(result).toEqual({
      error: 'engine failed; rollback session failed: rollback update failed',
    });
    expect(mockRecalculateAndSaveSalaryRecord).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns an explicit error when rollback salary recalculation fails', async () => {
    const { supabase } = createCompleteSessionSupabaseMock();
    mockCreateClient.mockResolvedValue(supabase);
    mockProcessSessionCompletion.mockResolvedValueOnce({ error: 'engine failed' });
    mockRecalculateAndSaveSalaryRecord.mockRejectedValueOnce(new Error('salary rollback failed'));

    const result = await completeSession('session-1', 'booking-1', 'Hoan thanh');

    expect(result).toEqual({
      error: 'engine failed; rollback salary failed: salary rollback failed',
    });
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('revalidates booking, session, and customer dashboards only after success', async () => {
    const { supabase, updateCalls } = createCompleteSessionSupabaseMock();
    mockCreateClient.mockResolvedValue(supabase);

    const result = await completeSession('session-1', 'booking-1', 'Hoan thanh');

    expect(result).toEqual({ success: true });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.payload).toEqual(expect.objectContaining({
      business_event_type: 'SESSION_REVENUE_RECOGNIZED',
      accounting_review_status: 'UNREVIEWED',
      accounting_metadata: expect.objectContaining({
        session_log_id: 'session-1',
        booking_id: 'booking-1',
        earned_revenue: 150000,
      }),
    }));
    expect(mockSafeRevalidatePath).toHaveBeenCalledTimes(3);
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/bookings');
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/sessions');
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/customers');
  });
});
