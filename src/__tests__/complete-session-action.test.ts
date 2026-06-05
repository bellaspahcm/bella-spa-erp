jest.mock('server-only', () => ({}), { virtual: true });

const mockProcessSessionCompletion = jest.fn();
const mockSafeRevalidatePath = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockRecalculateAndSaveSalaryRecord = jest.fn();

jest.mock('@/modules/booking/actions/session-completion-engine', () => ({
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

import { completeSession } from '../modules/booking/actions/complete-session-action';

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
    status: 'scheduled',
    session_number: 1,
    tenant_id: 'tenant-1',
  };
  const booking = options.booking ?? {
    assigned_ktv_id: 'ktv-1',
    package_id: 'package-1',
    status: 'booked',
  };

  class QueryBuilder {
    private selectColumns = '';

    constructor(private table: string, private operation?: 'update', private payload?: unknown) {}

    select(columns = '*') {
      this.selectColumns = columns;
      return this;
    }

    update(payload: unknown) {
      return new QueryBuilder(this.table, 'update', payload);
    }

    eq(column: string, value: unknown) {
      if (this.operation === 'update') {
        updateCalls.push({
          table: this.table,
          payload: this.payload,
          filters: [[column, value]],
        });

        const isRollback =
          this.table === 'session_logs' &&
          typeof this.payload === 'object' &&
          this.payload !== null &&
          (this.payload as { status?: unknown }).status === sessionLog.status;

        return Promise.resolve({
          error: isRollback ? options.rollbackError ?? null : null,
        });
      }

      return this;
    }

    single() {
      if (this.table === 'session_logs') {
        return Promise.resolve({ data: sessionLog, error: null });
      }

      if (this.table === 'bookings') {
        return Promise.resolve({
          data: this.selectColumns.includes('assigned_ktv_id') ? booking : null,
          error: null,
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
        }),
        filters: [['id', 'session-1']],
      }),
      expect.objectContaining({
        table: 'session_logs',
        payload: {
          status: 'scheduled',
          completed_date: null,
          completed_by_ktv_id: null,
        },
        filters: [['id', 'session-1']],
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
    expect(mockSafeRevalidatePath).toHaveBeenCalledTimes(3);
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/bookings');
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/sessions');
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/customers');
  });
});
