import {
  createPackage,
  deletePackage,
  getPackages,
  updatePackage,
  type PackageActionInput,
} from '../services/package-actions';
import type { Database } from '../types/database.types';

jest.mock('server-only', () => ({}), { virtual: true });

const mockGetAuthorizedTenantUser = jest.fn(() => Promise.resolve({
  ok: true,
  user: {
    id: 'admin-1',
    email: 'admin@example.com',
    full_name: 'Admin',
    role: 'admin',
    tenant_id: 'tenant-1',
    avatar_url: null,
  },
  tenantId: 'tenant-1',
  error: null,
  reason: null,
}));
jest.mock('../services/auth-guards', () => ({
  getAuthorizedTenantUser: (options: unknown) => mockGetAuthorizedTenantUser(options),
}));

const mockRecordAuditLog = jest.fn((payload: unknown) => {
  void payload;
  return Promise.resolve({ success: true });
});
jest.mock('../services/audit-actions', () => ({
  recordAuditLog: (payload: unknown) => mockRecordAuditLog(payload),
}));

const mockSafeRevalidatePath = jest.fn();
jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
}));

type PackageRow = Database['public']['Tables']['packages']['Row'];
type PackageInsert = Database['public']['Tables']['packages']['Insert'];
type PackageUpdate = Database['public']['Tables']['packages']['Update'];

type QueryError = { message: string };
type QueryResult = { data: unknown; error: QueryError | null };
type DbOperationMethod = 'select' | 'insert' | 'update' | 'delete';
type DbOperation = {
  table: string;
  method: DbOperationMethod;
  payload?: unknown;
  filters: Array<{ column: string; value: unknown; operator?: 'eq' | 'in' }>;
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

  insert(payload: PackageInsert | PackageInsert[]): this {
    this.operation = { table: this.table, method: 'insert', payload, filters: [] };
    operations.push(this.operation);
    return this;
  }

  update(payload: PackageUpdate): this {
    this.operation = { table: this.table, method: 'update', payload, filters: [] };
    operations.push(this.operation);
    return this;
  }

  delete(): this {
    this.operation = { table: this.table, method: 'delete', filters: [] };
    operations.push(this.operation);
    return this;
  }

  order(): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.operation?.filters.push({ column, value, operator: 'eq' });
    return this;
  }

  in(column: string, value: unknown[]): this {
    this.operation?.filters.push({ column, value, operator: 'in' });
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

const mockSupabase = {
  from: mockFrom,
};

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

function queueResult(data: unknown, error: QueryError | null = null) {
  queryResults.push({ data, error });
}

function queueTenantModules(modules: unknown = { babycare: true, beauty_spa: false }) {
  queueResult({ enabled_modules: modules });
}

function findOperation(method: DbOperationMethod, predicate?: (operation: DbOperation) => boolean) {
  return operations.find(operation => (
    operation.method === method && (!predicate || predicate(operation))
  ));
}

function createPackageRow(overrides: Partial<PackageRow> = {}): PackageRow {
  return {
    allowed_franchise_override: null,
    before_after_required: false,
    care_note_template: null,
    created_at: '2026-06-01T00:00:00.000Z',
    default_duration_minutes: 90,
    default_resource_type: null,
    description: null,
    details: ['Massage body'],
    duration: '90 phút/buổi',
    full_price: 0,
    id: 'pkg-1',
    is_hq_template: null,
    ktv_commission: 150000,
    module_key: 'babycare',
    name: 'VIP',
    offer: '',
    price: 1000000,
    price_cap: null,
    price_floor: null,
    requires_resource: false,
    service_category: null,
    service_kind: 'treatment_package',
    session_multiplier: 1,
    status: 'active',
    template_id: null,
    tenant_id: 'tenant-1',
    total_sessions: 10,
    updated_at: null,
    ...overrides,
  };
}

describe('package actions transaction safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    operations.length = 0;
    queryResults = [];
    mockGetAuthorizedTenantUser.mockResolvedValue({
      ok: true,
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        full_name: 'Admin',
        role: 'admin',
        tenant_id: 'tenant-1',
        avatar_url: null,
      },
      tenantId: 'tenant-1',
      error: null,
      reason: null,
    });
    mockRecordAuditLog.mockResolvedValue({ success: true });
  });

  it('lists packages scoped to the authenticated tenant and enabled modules only', async () => {
    const tenantPackage = createPackageRow();
    queueTenantModules({ babycare: true, beauty_spa: false });
    queueResult([tenantPackage]);

    const result = await getPackages();

    expect(result).toEqual([tenantPackage]);
    const selectOperation = findOperation('select', operation => operation.table === 'packages');
    expect(selectOperation?.filters).toEqual(expect.arrayContaining([
      expect.objectContaining({ column: 'tenant_id', value: 'tenant-1' }),
      expect.objectContaining({ column: 'module_key', value: ['babycare'], operator: 'in' }),
    ]));
  });

  it('creates package with a typed payload and records audit log', async () => {
    const insertedPackage = createPackageRow();
    const input: PackageActionInput = {
      name: 'VIP',
      price: '1.000.000',
      sessions: '10',
      ktv_commission: '150.000',
      details: ['Massage body'],
    };
    queueTenantModules({ babycare: true, beauty_spa: false });
    queueResult([insertedPackage]);

    const result = await createPackage(input);

    expect(result.data?.id).toBe('pkg-1');
    const insertOperation = findOperation('insert');
    expect(insertOperation?.payload).toEqual([expect.objectContaining<Partial<PackageInsert>>({
      name: 'VIP',
      tenant_id: 'tenant-1',
      price: 1000000,
      total_sessions: 10,
      ktv_commission: 150000,
      module_key: 'babycare',
      status: 'active',
    })]);
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'INSERT',
      table_name: 'packages',
      record_id: 'pkg-1',
    }));
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/services');
  });

  it('defaults new packages to Beauty Spa for beauty-only tenants', async () => {
    const insertedPackage = createPackageRow({ module_key: 'beauty_spa' });
    queueTenantModules({ babycare: false, beauty_spa: true });
    queueResult([insertedPackage]);

    const result = await createPackage({
      name: 'Facial Signature',
      price: 1000000,
      sessions: 10,
    });

    expect(result.data?.module_key).toBe('beauty_spa');
    const insertOperation = findOperation('insert', operation => operation.table === 'packages');
    expect(insertOperation?.payload).toEqual([expect.objectContaining<Partial<PackageInsert>>({
      tenant_id: 'tenant-1',
      module_key: 'beauty_spa',
    })]);
  });

  it('rejects creating Babycare packages for beauty-only tenants', async () => {
    queueTenantModules({ babycare: false, beauty_spa: true });

    const result = await createPackage({
      name: 'Babycare should be blocked',
      module_key: 'babycare',
    });

    expect(result.error).toContain('Admin HQ');
    expect(findOperation('insert', operation => operation.table === 'packages')).toBeUndefined();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('rejects attempts to create a package for another tenant', async () => {
    const result = await createPackage({
      name: 'Cross tenant package',
      tenant_id: 'tenant-2',
    });

    expect(result.error).toBe('Không thể thao tác gói dịch vụ ngoài đơn vị kinh doanh hiện tại.');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('rejects updating packages to a module that HQ did not enable', async () => {
    const oldPackage = createPackageRow({ module_key: 'beauty_spa' });
    queueTenantModules({ babycare: false, beauty_spa: true });
    queueResult(oldPackage);

    const result = await updatePackage('pkg-1', {
      module_key: 'babycare',
      name: 'Blocked module switch',
    });

    expect(result.error).toContain('Admin HQ');
    expect(findOperation('update', operation => operation.table === 'packages')).toBeUndefined();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('rejects deleting packages outside the HQ enabled module scope', async () => {
    const oldPackage = createPackageRow({ module_key: 'babycare' });
    queueTenantModules({ babycare: false, beauty_spa: true });
    queueResult(oldPackage);

    const result = await deletePackage('pkg-1');

    expect(result.error).toContain('Admin HQ');
    expect(findOperation('delete', operation => operation.table === 'packages')).toBeUndefined();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('rolls back inserted package when audit logging fails', async () => {
    const insertedPackage = createPackageRow();
    mockRecordAuditLog.mockRejectedValue(new Error('Audit write failed'));
    queueTenantModules({ babycare: true, beauty_spa: false });
    queueResult([insertedPackage]);
    queueResult(null);

    const result = await createPackage({
      name: 'VIP',
      price: 1000000,
      sessions: 10,
    });

    expect(result.error).toBe('Audit write failed');
    const rollbackDelete = findOperation('delete', operation => (
      operation.filters.some(filter => filter.column === 'id' && filter.value === 'pkg-1')
      && operation.filters.some(filter => filter.column === 'tenant_id' && filter.value === 'tenant-1')
    ));
    expect(rollbackDelete).toBeDefined();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns rollback failure when create audit rollback delete fails', async () => {
    const insertedPackage = createPackageRow();
    mockRecordAuditLog.mockRejectedValue(new Error('Audit write failed'));
    queueTenantModules({ babycare: true, beauty_spa: false });
    queueResult([insertedPackage]);
    queueResult(null, { message: 'rollback delete failed' });

    const result = await createPackage({
      name: 'VIP',
      price: 1000000,
      sessions: 10,
    });

    expect(result.error).toContain('Audit write failed');
    expect(result.error).toContain('Rollback failed: rollback delete failed');
  });

  it('propagates package query failures instead of returning an empty list', async () => {
    queueTenantModules({ babycare: true, beauty_spa: false });
    queueResult(null, { message: 'package query failed' });

    await expect(getPackages()).rejects.toThrow('Failed to fetch packages: package query failed');
  });

  it('rolls back updated package when update audit logging fails', async () => {
    const oldPackage = createPackageRow();
    const updatedPackage = createPackageRow({ name: 'VIP Updated', price: 1200000 });
    mockRecordAuditLog.mockRejectedValue(new Error('Audit update failed'));
    queueTenantModules({ babycare: true, beauty_spa: false });
    queueResult(oldPackage);
    queueResult([updatedPackage]);
    queueResult(null);

    const result = await updatePackage('pkg-1', {
      name: 'VIP Updated',
      price: 1200000,
    });

    expect(result.error).toBe('Audit update failed');
    const rollbackUpdate = findOperation('update', operation => (
      operation.payload === oldPackage
      && operation.filters.some(filter => filter.column === 'id' && filter.value === 'pkg-1')
      && operation.filters.some(filter => filter.column === 'tenant_id' && filter.value === 'tenant-1')
    ));
    expect(rollbackUpdate).toBeDefined();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns update DB failures without writing audit log', async () => {
    const oldPackage = createPackageRow();
    queueTenantModules({ babycare: true, beauty_spa: false });
    queueResult(oldPackage);
    queueResult(null, { message: 'update failed' });

    const result = await updatePackage('pkg-1', {
      name: 'VIP Updated',
      price: 1200000,
    });

    expect(result.error).toBe('update failed');
    const oldPackageSelect = findOperation('select', operation => operation.table === 'packages');
    expect(oldPackageSelect?.filters).toEqual(expect.arrayContaining([
      expect.objectContaining({ column: 'id', value: 'pkg-1' }),
      expect.objectContaining({ column: 'tenant_id', value: 'tenant-1' }),
    ]));
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('rejects attempts to update a package for another tenant before querying', async () => {
    const result = await updatePackage('pkg-1', {
      name: 'Cross tenant update',
      tenant_id: 'tenant-2',
    });

    expect(result.error).toBe('Không thể thao tác gói dịch vụ ngoài đơn vị kinh doanh hiện tại.');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('rolls back deleted package when delete audit logging fails', async () => {
    const oldPackage = createPackageRow();
    mockRecordAuditLog.mockRejectedValue(new Error('Audit delete failed'));
    queueTenantModules({ babycare: true, beauty_spa: false });
    queueResult(oldPackage);
    queueResult(null);
    queueResult(null);

    const result = await deletePackage('pkg-1');

    expect(result.error).toBe('Audit delete failed');
    const rollbackInsert = findOperation('insert', operation => (
      Array.isArray(operation.payload) && operation.payload[0] === oldPackage
    ));
    expect(rollbackInsert).toBeDefined();
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns rollback failure when delete audit rollback insert fails', async () => {
    const oldPackage = createPackageRow();
    mockRecordAuditLog.mockRejectedValue(new Error('Audit delete failed'));
    queueTenantModules({ babycare: true, beauty_spa: false });
    queueResult(oldPackage);
    queueResult(null);
    queueResult(null, { message: 'rollback insert failed' });

    const result = await deletePackage('pkg-1');

    expect(result.error).toContain('Audit delete failed');
    expect(result.error).toContain('Rollback failed: rollback insert failed');
  });

  it('deletes packages with authenticated tenant scope', async () => {
    const oldPackage = createPackageRow();
    queueTenantModules({ babycare: true, beauty_spa: false });
    queueResult(oldPackage);
    queueResult(null);

    const result = await deletePackage('pkg-1');

    expect(result.success).toBe(true);
    const deleteOperation = findOperation('delete');
    expect(deleteOperation?.filters).toEqual(expect.arrayContaining([
      expect.objectContaining({ column: 'id', value: 'pkg-1' }),
      expect.objectContaining({ column: 'tenant_id', value: 'tenant-1' }),
    ]));
  });
});
