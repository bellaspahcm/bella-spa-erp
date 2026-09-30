jest.mock('server-only', () => ({}), { virtual: true });

const mockEnqueueWithAutoClient = jest.fn();
const mockAssertOpenAccountingPeriod = jest.fn();
const mockAutoConsumeForSession = jest.fn();
const mockRollbackInventoryConsumption = jest.fn();
const mockRecalculateAndSaveSalaryRecord = jest.fn();
const mockGetSupabaseAdminUrl = jest.fn(() => '');
const mockGetSupabaseAdminKey = jest.fn(() => '');
const mockCreateSupabaseJsClient = jest.fn();

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

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => mockGetSupabaseAdminUrl(),
  getSupabaseAdminKey: () => mockGetSupabaseAdminKey(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateSupabaseJsClient(...args),
}));

import { processSessionCompletion } from '../core/services/order/session-completion-engine';
import {
  buildCompletedSessionAccountingUpdate,
  enqueueSessionDoneAccountingOutbox,
  ensureSessionReviewPlaceholder,
  isPayrollCapabilityEnabled,
  recordSingleSessionRevenueIfNeeded,
  syncKtvSalaryAfterCompletion,
} from '../core/services/order/session-completion-helpers';
import {
  isRevertingCompletedSession,
  reverseCompletedSessionSideEffects,
} from '../core/services/order/update-session-log-helpers';

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

    in(column: string, values: unknown[]) {
      this.call?.filters.push([column, values]);
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
    mockGetSupabaseAdminUrl.mockReturnValue('');
    mockGetSupabaseAdminKey.mockReturnValue('');
    mockCreateSupabaseJsClient.mockReset();
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

  it('parses payroll capability from tenant enabled_modules without product-specific checks', () => {
    expect(isPayrollCapabilityEnabled({ payroll: true, beauty_spa: true })).toBe(true);
    expect(isPayrollCapabilityEnabled({ payroll: false, beauty_spa: true })).toBe(false);
    expect(isPayrollCapabilityEnabled(['beauty_spa', 'payroll'])).toBe(true);
    expect(isPayrollCapabilityEnabled('beauty_spa,payroll')).toBe(true);
    expect(isPayrollCapabilityEnabled(null)).toBe(false);
  });

  it('skips KTV salary sync when tenant payroll capability is disabled', async () => {
    const { calls, supabase } = createSupabaseMock([
      { data: { enabled_modules: { payroll: false, beauty_spa: true } } },
    ]);

    const result = await syncKtvSalaryAfterCompletion({
      supabase: supabase as never,
      ktvId: 'ktv-1',
      tenantId: 'tenant-1',
      today: '2026-06-03',
      sessionId: 'session-1',
      bookingId: 'booking-1',
      currentBooking: {
        package_name: 'Gói dịch vụ lẻ',
        completed_sessions: 1,
        status: 'booked',
        total_sessions: 1,
        ktv_commission: 30000,
        assigned_ktv_id: 'ktv-1',
        customer_id: 'customer-1',
        tenant_id: 'tenant-1',
        full_price: 500000,
        deposit_amount: 0,
        discount_percent: 0,
      },
      isInventoryConsumed: false,
      isRevenueCreated: false,
    });

    expect(result).toEqual({ success: true, skipped: 'PAYROLL_DISABLED' });
    expect(mockRecalculateAndSaveSalaryRecord).not.toHaveBeenCalled();
    expect(calls).toEqual([
      expect.objectContaining({
        table: 'tenants',
        op: 'select',
        filters: [['id', 'tenant-1']],
      }),
    ]);
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

  it('identifies only completed-to-non-completed session reversions', () => {
    expect(isRevertingCompletedSession(
      { status: 'scheduled' },
      { status: 'completed' } as never
    )).toBe(true);

    expect(isRevertingCompletedSession(
      { status: 'completed' },
      { status: 'completed' } as never
    )).toBe(false);

    expect(isRevertingCompletedSession(
      { notes: 'reschedule only' },
      { status: 'completed' } as never
    )).toBe(false);
  });

  it('reverses completed-session salary and unposted SESSION_DONE outbox for the exact session', async () => {
    const { calls, supabase } = createSupabaseMock([{}]);

    const result = await reverseCompletedSessionSideEffects({
      supabase: supabase as never,
      sessionId: 'session-1',
      tenantId: 'tenant-1',
      existingLog: {
        status: 'completed',
        completed_by_ktv_id: 'ktv-1',
        completed_date: '2026-09-29',
      } as never,
    });

    expect(result).toEqual({ success: true });
    expect(mockRecalculateAndSaveSalaryRecord).toHaveBeenCalledWith(
      supabase,
      'ktv-1',
      '2026-09-01',
      'tenant-1'
    );
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'accounting_outbox',
        op: 'delete',
        filters: [
          ['tenant_id', 'tenant-1'],
          ['event_type', 'SESSION_DONE'],
          ['reference_type', 'SESSION_LOG'],
          ['reference_id', 'session-1'],
          ['status', ['PENDING', 'FAILED', 'DEAD']],
        ],
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
    expect(calls).toEqual(expect.arrayContaining([
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
    ]));
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

  it('uses the session review operation client when service-role env is configured', async () => {
    const standardClient = createSupabaseMock();
    const operationClient = createSupabaseMock([
      { data: null },
      { data: { id: 'review-1' } },
    ]);
    mockGetSupabaseAdminUrl.mockReturnValue('https://bella.supabase.co');
    mockGetSupabaseAdminKey.mockReturnValue('service-role-key');
    mockCreateSupabaseJsClient.mockReturnValue(operationClient.supabase);

    const result = await ensureSessionReviewPlaceholder({
      supabase: standardClient.supabase as never,
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

    expect(result).toEqual({ success: true, createdReviewId: 'review-1' });
    expect(mockCreateSupabaseJsClient).toHaveBeenCalledWith(
      'https://bella.supabase.co',
      'service-role-key',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect(standardClient.calls).toEqual([]);
    expect(operationClient.calls).toEqual(expect.arrayContaining([
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
    ]));
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
        total_sessions: 1,
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
          amount: 500000,
          revenue_type: 'package_payment',
          payment_method: 'bank_transfer',
          received_date: '2026-06-03',
          status: 'confirmed',
          tenant_id: 'tenant-1',
          accounting_metadata: expect.objectContaining({
            amount: 500000,
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
          totalAmount: 500000,
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
        total_sessions: 1,
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
      is_in_care: true,
      total_sessions: 1,
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
      { data: { enabled_modules: { payroll: true, beauty_spa: true } } },
      { data: null },
      { data: { id: 'review-1' } },
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
          status: 'completed',
          is_in_care: false,
        }),
        filters: [['id', 'booking-1']],
      }),
      expect.objectContaining({
        table: 'revenue',
        op: 'insert',
        payload: [expect.objectContaining({
          booking_id: 'booking-1',
          amount: 500000,
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
          earnedRevenueAmount: 500000,
          deferredRevenueAmount: 0,
          receivableAmount: 500000,
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
      is_in_care: true,
      total_sessions: 1,
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
      { data: { enabled_modules: { payroll: true, beauty_spa: true } } },
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
        payload: { completed_sessions: 1, status: 'booked', is_in_care: true },
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

  it('cleans up completion-created PACKAGE_SALE outbox when salary sync fails after revenue creation', async () => {
    mockRecalculateAndSaveSalaryRecord.mockRejectedValueOnce(new Error('locked salary'));
    const currentBooking = {
      package_name: 'G\u00f3i d\u1ecbch v\u1ee5 l\u1ebb',
      completed_sessions: 1,
      status: 'booked',
      total_sessions: 1,
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
      { data: { enabled_modules: { payroll: true, beauty_spa: true } } },
      {},
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

    expect(result).toEqual({
      error: expect.stringContaining('Không thể ghi nhận lương cho KTV'),
    });
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'accounting_outbox',
        op: 'delete',
        filters: [
          ['tenant_id', 'tenant-1'],
          ['event_type', 'PACKAGE_SALE'],
          ['reference_type', 'REVENUE'],
          ['reference_id', 'revenue-1'],
          ['status', ['PENDING', 'FAILED']],
        ],
      }),
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

  it('cleans up completion-created review when SESSION_DONE enqueue fails', async () => {
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);
    const currentBooking = {
      package_name: 'Li\u1ec7u tr\u00ecnh ch\u0103m s\u00f3c',
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
      { data: { enabled_modules: { payroll: true, beauty_spa: true } } },
      { data: null },
      { data: { id: 'review-1' } },
      { data: [{ amount: 200000, status: 'confirmed', revenue_type: 'deposit' }] },
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

    expect(result).toEqual({
      error: expect.stringContaining('Failed to enqueue SESSION_DONE accounting event'),
    });
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'session_reviews',
        op: 'delete',
        filters: [
          ['id', 'review-1'],
          ['tenant_id', 'tenant-1'],
        ],
      }),
      expect.objectContaining({
        table: 'bookings',
        op: 'update',
        payload: { completed_sessions: 1, status: 'booked' },
        filters: [['id', 'booking-1']],
      }),
    ]));
  });
});
