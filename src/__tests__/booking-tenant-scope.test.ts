import {
  createCustomerForBookingIfNeeded,
  findPendingBookingForCustomer,
} from '@/modules/booking/actions/create-booking-helpers';
import {
  fetchBookingDetailsWithPayment,
  getBookingPaymentSnapshot,
  updateBookingShareToken,
} from '@/modules/booking/actions/payment-helpers';
import { reusePackage } from '@/modules/booking/actions/lifecycle-actions';

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

const mockGetCurrentUser = jest.fn();
const mockRecordAuditLog = jest.fn();

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: (payload: unknown) => mockRecordAuditLog(payload),
  checkMonthLock: jest.fn().mockResolvedValue({ isLocked: false }),
}));

type QueryResult = { data: unknown; error: { message: string } | null };
type Operation = {
  table: string;
  method: 'select' | 'insert' | 'update' | 'delete';
  payload?: unknown;
  filters: Array<{ column: string; value: unknown }>;
};

const operations: Operation[] = [];
let queuedResults: QueryResult[] = [];

class MockQueryBuilder {
  private operation: Operation | null = null;

  constructor(private readonly table: string) {}

  private ensureOperation(method: Operation['method'], payload?: unknown) {
    if (!this.operation) {
      this.operation = { table: this.table, method, payload, filters: [] };
      operations.push(this.operation);
    }
    return this.operation;
  }

  select(): this {
    this.ensureOperation('select');
    return this;
  }

  insert(payload: unknown): this {
    this.operation = { table: this.table, method: 'insert', payload, filters: [] };
    operations.push(this.operation);
    return this;
  }

  update(payload: unknown): this {
    this.operation = { table: this.table, method: 'update', payload, filters: [] };
    operations.push(this.operation);
    return this;
  }

  delete(): this {
    this.operation = { table: this.table, method: 'delete', filters: [] };
    operations.push(this.operation);
    return this;
  }

  eq(column: string, value: unknown): this {
    this.operation?.filters.push({ column, value });
    return this;
  }

  in(column: string, value: unknown): this {
    this.operation?.filters.push({ column, value });
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  gt(column: string, value: unknown): this {
    this.operation?.filters.push({ column, value });
    return this;
  }

  single(): Promise<QueryResult> {
    return Promise.resolve(queuedResults.shift() || { data: null, error: null });
  }

  maybeSingle(): Promise<QueryResult> {
    return Promise.resolve(queuedResults.shift() || { data: null, error: null });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(queuedResults.shift() || { data: null, error: null }).then(onfulfilled, onrejected);
  }
}

const mockClient = {
  from: jest.fn((table: string) => new MockQueryBuilder(table)),
  rpc: jest.fn(),
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockClient)),
}));

function queueResult(data: unknown, error: QueryResult['error'] = null) {
  queuedResults.push({ data, error });
}

function expectOperationFilters(table: string, method: Operation['method'], filters: Operation['filters']) {
  expect(operations).toEqual(expect.arrayContaining([
    expect.objectContaining({
      table,
      method,
      filters: expect.arrayContaining(filters),
    }),
  ]));
}

describe('booking tenant scope guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    operations.length = 0;
    queuedResults = [];
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
    mockRecordAuditLog.mockResolvedValue({ success: true });
  });

  it('creates a booking customer under the resolved tenant instead of trusting form tenant_id', async () => {
    queueResult({ id: 'customer-1', tenant_id: 'tenant-1' });

    const result = await createCustomerForBookingIfNeeded(
      mockClient as never,
      { customer_id: 'new' } as Parameters<typeof createCustomerForBookingIfNeeded>[1],
      {
        newCustomer: {
          name_mother: 'Customer A',
          phone: '0900000000',
          tenant_id: 'tenant-2',
        },
      },
      'tenant-1',
    );

    expect(result).toEqual({ customerId: 'customer-1' });
    expect(operations[0]).toEqual(expect.objectContaining({
      table: 'customers',
      method: 'insert',
      payload: [expect.objectContaining({ tenant_id: 'tenant-1' })],
    }));
  });

  it('scopes pending booking lookup by customer and tenant', async () => {
    queueResult({ id: 'booking-1', tenant_id: 'tenant-1' });

    await findPendingBookingForCustomer(mockClient as never, 'customer-1', 'tenant-1');

    expectOperationFilters('bookings', 'select', [
      { column: 'customer_id', value: 'customer-1' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]);
  });

  it('scopes payment booking reads and share-token updates by tenant', async () => {
    queueResult({ id: 'booking-1', tenant_id: 'tenant-1' });
    queueResult([{ id: 'booking-1', tenant_id: 'tenant-1', share_token: 'token-1' }]);
    queueResult({ id: 'booking-1', tenant_id: 'tenant-1' });

    await getBookingPaymentSnapshot(mockClient as never, 'booking-1', 'tenant-1');
    await updateBookingShareToken(mockClient as never, 'booking-1', 'token-1', 'tenant-1');
    await fetchBookingDetailsWithPayment(mockClient as never, 'booking-1', 'tenant-1');

    expectOperationFilters('bookings', 'select', [
      { column: 'id', value: 'booking-1' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]);
    expectOperationFilters('bookings', 'update', [
      { column: 'id', value: 'booking-1' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]);
  });

  it('scopes reuse-package source booking and generated booking to the current tenant', async () => {
    queueResult({
      id: 'booking-1',
      customer_id: 'customer-1',
      package_id: 'package-1',
      package_name: 'Package A',
      tenant_id: 'tenant-1',
      full_price: 1000000,
      total_sessions: 1,
    });
    queueResult({ id: 'package-1', tenant_id: 'tenant-1', module_key: 'beauty_spa', name: 'Package A' });
    queueResult({ id: 'tenant-1', enabled_modules: { beauty_spa: true } });
    queueResult([{
      id: 'booking-2',
      customer_id: 'customer-1',
      tenant_id: 'tenant-1',
      start_date: '2026-06-10',
      total_sessions: 1,
    }]);
    queueResult(null);

    const result = await reusePackage('booking-1');

    expect(result).toEqual(expect.objectContaining({
      data: expect.objectContaining({ id: 'booking-2', tenant_id: 'tenant-1' }),
    }));
    expectOperationFilters('bookings', 'select', [
      { column: 'id', value: 'booking-1' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]);
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'bookings',
        method: 'insert',
        payload: [expect.objectContaining({ tenant_id: 'tenant-1' })],
      }),
    ]));
  });
});
