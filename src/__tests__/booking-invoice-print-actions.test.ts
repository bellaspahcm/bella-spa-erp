jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../services/user-actions', () => ({
  getCurrentUser: jest.fn(),
}));

import {
  getInvoicePrintLogsForBooking,
  recordInvoicePrintLog,
  voidLatestInvoicePrintLog,
} from '../modules/booking/actions/invoice-print-actions';
import { getCurrentUser } from '../services/user-actions';

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

type QueryCall = {
  table: string;
  operation: 'select' | 'insert' | 'update';
  payload?: unknown;
  filters: { column: string; value: unknown }[];
};

const queryCalls: QueryCall[] = [];
let scriptedResults: QueryResult[] = [];

class QueryBuilder implements PromiseLike<QueryResult> {
  private operation: QueryCall['operation'] = 'select';
  private payload?: unknown;
  private filters: { column: string; value: unknown }[] = [];

  constructor(private readonly table: string) {}

  select() {
    return this;
  }

  insert(payload: unknown) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  single() {
    return this.resolve();
  }

  maybeSingle() {
    return this.resolve();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private resolve() {
    queryCalls.push({
      table: this.table,
      operation: this.operation,
      payload: this.payload,
      filters: [...this.filters],
    });

    return Promise.resolve(scriptedResults.shift() ?? { data: null, error: null });
  }
}

const mockSupabase = {
  from: jest.fn((table: string) => new QueryBuilder(table)),
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;

describe('booking invoice print actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCalls.length = 0;
    scriptedResults = [];
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    } as Awaited<ReturnType<typeof getCurrentUser>>);
  });

  it('records invoice print side effect with tenant, user, booking, and print count', async () => {
    scriptedResults = [
      { data: { id: 'booking-1' }, error: null },
      { data: null, error: null, count: 1 },
      { data: { id: 'log-1', print_count: 2 }, error: null },
    ];

    const result = await recordInvoicePrintLog({
      bookingId: 'booking-1',
      sessionLogId: 'session-1',
      invoiceNumber: 'INV-BK-1',
      amountDue: 120000,
      transferMemo: 'BELLA BK-1',
      reason: 'Khách cần bản giấy',
    });

    expect(result.success).toBe(true);
    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'bookings',
        operation: 'select',
        filters: [
          { column: 'id', value: 'booking-1' },
          { column: 'tenant_id', value: 'tenant-1' },
        ],
      }),
      expect.objectContaining({
        table: 'invoice_print_logs',
        operation: 'select',
        filters: [
          { column: 'tenant_id', value: 'tenant-1' },
          { column: 'invoice_number', value: 'INV-BK-1' },
        ],
      }),
      expect.objectContaining({
        table: 'invoice_print_logs',
        operation: 'insert',
        payload: expect.objectContaining({
          tenant_id: 'tenant-1',
          booking_id: 'booking-1',
          session_log_id: 'session-1',
          invoice_number: 'INV-BK-1',
          printed_by: 'user-1',
          print_count: 2,
          print_type: 'reprint',
          reason: 'Khách cần bản giấy',
          amount_due: 120000,
          transfer_memo: 'BELLA BK-1',
        }),
      }),
    ]);
  });

  it('stores reprint reason when recording another active invoice print', async () => {
    scriptedResults = [
      { data: { id: 'booking-1' }, error: null },
      { data: null, error: null, count: 2 },
      { data: { id: 'log-3', print_count: 3, reason: 'Khách làm mất bill' }, error: null },
    ];

    const result = await recordInvoicePrintLog({
      bookingId: 'booking-1',
      invoiceNumber: 'INV-BK-1',
      amountDue: 120000,
      transferMemo: 'BELLA BK-1',
      reason: 'Khách làm mất bill',
    });

    expect(result.success).toBe(true);
    expect(queryCalls[2]).toEqual(expect.objectContaining({
      table: 'invoice_print_logs',
      operation: 'insert',
      payload: expect.objectContaining({
        print_count: 3,
        print_type: 'reprint',
        reason: 'Khách làm mất bill',
      }),
    }));
  });

  it('returns invoice print logs scoped to the current tenant booking', async () => {
    scriptedResults = [
      { data: { id: 'booking-1' }, error: null },
      {
        data: [
          {
            id: 'log-1',
            invoice_number: 'INV-BK-1',
            booking_id: 'booking-1',
            tenant_id: 'tenant-1',
            print_count: 1,
            printed_by_user: { full_name: 'Thu ngân A', role: 'admin_staff' },
          },
        ],
        error: null,
      },
    ];

    const result = await getInvoicePrintLogsForBooking('booking-1');

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'bookings',
        operation: 'select',
        filters: [
          { column: 'id', value: 'booking-1' },
          { column: 'tenant_id', value: 'tenant-1' },
        ],
      }),
      expect.objectContaining({
        table: 'invoice_print_logs',
        operation: 'select',
        filters: [
          { column: 'tenant_id', value: 'tenant-1' },
          { column: 'booking_id', value: 'booking-1' },
        ],
      }),
    ]);
  });

  it('does not insert a print log when booking is outside the current tenant', async () => {
    scriptedResults = [{ data: null, error: null }];

    const result = await recordInvoicePrintLog({
      bookingId: 'booking-other',
      invoiceNumber: 'INV-BK-OTHER',
      amountDue: 90000,
    });

    expect(result).toEqual({
      success: false,
      error: 'Không tìm thấy booking thuộc chi nhánh hiện tại.',
    });
    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0]).toEqual(expect.objectContaining({
      table: 'bookings',
      operation: 'select',
    }));
  });

  it('voids the latest active invoice print log with reason and user side effect', async () => {
    scriptedResults = [
      { data: { id: 'booking-1' }, error: null },
      { data: { id: 'log-1', invoice_number: 'INV-BK-1', print_count: 1 }, error: null },
      { data: { id: 'log-1', void_reason: 'Sai voucher' }, error: null },
    ];

    const result = await voidLatestInvoicePrintLog({
      bookingId: 'booking-1',
      reason: 'Sai voucher',
    });

    expect(result.success).toBe(true);
    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'bookings',
        operation: 'select',
        filters: [
          { column: 'id', value: 'booking-1' },
          { column: 'tenant_id', value: 'tenant-1' },
        ],
      }),
      expect.objectContaining({
        table: 'invoice_print_logs',
        operation: 'select',
        filters: [
          { column: 'tenant_id', value: 'tenant-1' },
          { column: 'booking_id', value: 'booking-1' },
          { column: 'voided_at', value: null },
        ],
      }),
      expect.objectContaining({
        table: 'invoice_print_logs',
        operation: 'update',
        payload: expect.objectContaining({
          voided_by: 'user-1',
          void_reason: 'Sai voucher',
        }),
        filters: [
          { column: 'id', value: 'log-1' },
          { column: 'tenant_id', value: 'tenant-1' },
        ],
      }),
    ]);
  });

  it('blocks KTV users from voiding invoice print logs', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'ktv-1',
      role: 'ktv',
      tenant_id: 'tenant-1',
    } as Awaited<ReturnType<typeof getCurrentUser>>);

    const result = await voidLatestInvoicePrintLog({
      bookingId: 'booking-1',
      reason: 'Sai voucher',
    });

    expect(result).toEqual({
      success: false,
      error: 'Bạn không có quyền hủy bill đã in.',
    });
    expect(queryCalls).toHaveLength(0);
  });
});
