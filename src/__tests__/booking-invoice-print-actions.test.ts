jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('../services/user-actions', () => ({
  getCurrentUser: jest.fn(),
}));

import { recordInvoicePrintLog } from '../modules/booking/actions/invoice-print-actions';
import { getCurrentUser } from '../services/user-actions';

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

type QueryCall = {
  table: string;
  operation: 'select' | 'insert';
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

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
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
});
