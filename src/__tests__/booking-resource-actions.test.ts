import {
  createBookingResource,
  getBookingResources,
} from '@/services/booking-resource-actions';
import type { Database } from '@/types/database.types';

jest.mock('server-only', () => ({}), { virtual: true });

const mockGetAuthorizedTenantUser = jest.fn();
const mockRecordAuditLog = jest.fn();
const mockSafeRevalidatePath = jest.fn();

jest.mock('@/services/auth-guards', () => ({
  getAuthorizedTenantUser: (options: unknown) => mockGetAuthorizedTenantUser(options),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: (payload: unknown) => mockRecordAuditLog(payload),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
}));

type BookingResourceRow = Database['public']['Tables']['booking_resources']['Row'];
type QueryError = { message: string };
type QueryResult = { data: unknown; error: QueryError | null };
type DbOperationMethod = 'select' | 'insert' | 'update' | 'delete';
type DbOperation = {
  table: string;
  method: DbOperationMethod;
  payload?: unknown;
  filters: Array<{ column: string; value: unknown }>;
};

const operations: DbOperation[] = [];
let queryResults: QueryResult[] = [];

class MockQueryBuilder {
  private operation: DbOperation | null = null;

  constructor(
    private readonly table: string,
    private readonly result: QueryResult,
  ) {}

  select(): this {
    if (!this.operation) {
      this.operation = { table: this.table, method: 'select', filters: [] };
      operations.push(this.operation);
    }
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

  order(): this {
    return this;
  }

  single(): this {
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

const mockFrom = jest.fn((table: string) => {
  const result = queryResults.shift() || { data: null, error: null };
  return new MockQueryBuilder(table, result);
});

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

function queueResult(data: unknown, error: QueryError | null = null) {
  queryResults.push({ data, error });
}

function createResource(overrides: Partial<BookingResourceRow> = {}): BookingResourceRow {
  return {
    branch_tenant_id: null,
    capacity: 1,
    created_at: '2026-06-08T00:00:00.000Z',
    id: 'resource-1',
    location_note: null,
    metadata: {},
    name: 'Giường Facial 01',
    resource_type: 'bed',
    status: 'available',
    tenant_id: 'tenant-1',
    updated_at: '2026-06-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('booking resource actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    operations.length = 0;
    queryResults = [];
    mockGetAuthorizedTenantUser.mockResolvedValue({
      ok: true,
      tenantId: 'tenant-1',
      user: { id: 'admin-1', role: 'admin', tenant_id: 'tenant-1' },
      error: null,
      reason: null,
    });
    mockRecordAuditLog.mockResolvedValue({ success: true });
  });

  it('loads tenant-scoped booking resources', async () => {
    const resource = createResource();
    queueResult([resource]);

    const result = await getBookingResources();

    expect(result).toEqual({ success: true, data: [resource] });
    expect(operations[0]).toEqual(expect.objectContaining({
      table: 'booking_resources',
      method: 'select',
      filters: [{ column: 'tenant_id', value: 'tenant-1' }],
    }));
  });

  it('creates a typed booking resource payload and records audit', async () => {
    const resource = createResource({ resource_type: 'room', capacity: 2 });
    queueResult(resource);

    const result = await createBookingResource({
      name: ' Phòng Facial VIP ',
      resource_type: 'room',
      capacity: '2',
      location_note: ' Tầng 2 ',
    });

    expect(result.success).toBe(true);
    expect(operations[0]).toEqual(expect.objectContaining({
      table: 'booking_resources',
      method: 'insert',
      payload: [expect.objectContaining({
        tenant_id: 'tenant-1',
        name: 'Phòng Facial VIP',
        resource_type: 'room',
        status: 'available',
        capacity: 2,
        location_note: 'Tầng 2',
      })],
    }));
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'INSERT',
      table_name: 'booking_resources',
      record_id: 'resource-1',
    }));
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/services');
  });

  it('blocks unauthorized users before database writes', async () => {
    mockGetAuthorizedTenantUser.mockResolvedValueOnce({
      ok: false,
      tenantId: null,
      user: null,
      error: 'Không có quyền quản lý tài nguyên đặt lịch.',
      reason: 'FORBIDDEN',
    });

    const result = await createBookingResource({ name: 'Bed 01' });

    expect(result).toEqual({
      success: false,
      error: 'Không có quyền quản lý tài nguyên đặt lịch.',
    });
    expect(operations).toHaveLength(0);
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('rolls back created resource when audit logging fails', async () => {
    const resource = createResource();
    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit down'));
    queueResult(resource);
    queueResult(null);

    const result = await createBookingResource({ name: 'Bed 01' });

    expect(result).toEqual({ success: false, error: 'audit down' });
    expect(operations.some((operation) => (
      operation.method === 'delete'
      && operation.filters.some((filter) => filter.column === 'id' && filter.value === 'resource-1')
      && operation.filters.some((filter) => filter.column === 'tenant_id' && filter.value === 'tenant-1')
    ))).toBe(true);
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });
});
