jest.mock('server-only', () => ({}), { virtual: true });

const mockGetCurrentUser = jest.fn();
const mockRecordAuditLog = jest.fn();
const mockRevalidatePath = jest.fn();

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: (payload: unknown) => mockRecordAuditLog(payload),
}));

jest.mock('next/cache', () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};
type QueryOperation = 'select' | 'update';
type QueryCall = {
  table: string;
  operation: QueryOperation;
  payload?: unknown;
  selectColumns?: string;
  filters: { column: string; value: unknown }[];
};

const queryCalls: QueryCall[] = [];
let scriptedResults: QueryResult[] = [];

class QueryBuilder implements PromiseLike<QueryResult> {
  private operation: QueryOperation = 'select';
  private payload?: unknown;
  private selectColumns?: string;
  private filters: { column: string; value: unknown }[] = [];

  constructor(private readonly table: string) {}

  select(columns?: string) {
    this.selectColumns = columns;
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

  single() {
    return this.resolve();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private resolve() {
    queryCalls.push({
      table: this.table,
      operation: this.operation,
      payload: this.payload,
      selectColumns: this.selectColumns,
      filters: [...this.filters],
    });

    return Promise.resolve(scriptedResults.shift() ?? { data: null, error: null });
  }
}

const mockSupabase = {
  from: jest.fn((table: string) => new QueryBuilder(table)),
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => Promise.resolve(mockSupabase),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { getTenantSettings, saveTenantSettings } from '@/services/tenant-actions';

const mockCreateSupabaseJsClient = jest.mocked(createSupabaseJsClient);

const mockAdminSupabase = {
  from: jest.fn((table: string) => new QueryBuilder(table)),
};

function tenantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    name: 'Bella Old',
    contact_phone: '0900000000',
    email: 'old@bella.vn',
    address: 'Old address',
    qr_bank_code: 'OLD',
    qr_account_number: '111',
    qr_account_name: 'Old Account',
    salary_config: { kpi: 1 },
    role_permissions: { admin: { settings: true } },
    updated_at: '2026-06-01T00:00:00.000Z',
    status: 'active',
    subscription_tier: 'pro',
    royalty_type: 'percentage',
    zalo_access_token: 'secret-token',
    ...overrides,
  };
}

describe('tenant settings actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCalls.length = 0;
    scriptedResults = [];
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      tenant_id: 'tenant-1',
      role: 'admin',
    });
    mockCreateSupabaseJsClient.mockReturnValue(
      mockAdminSupabase as unknown as ReturnType<typeof createSupabaseJsClient>,
    );
    mockRecordAuditLog.mockResolvedValue({ success: true });
  });

  it('returns null without querying when current user has no tenant id', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 'admin-1',
      tenant_id: null,
      role: 'admin',
    });

    await expect(getTenantSettings()).resolves.toBeNull();

    expect(queryCalls).toHaveLength(0);
    expect(mockCreateSupabaseJsClient).not.toHaveBeenCalled();
  });

  it('returns tenant settings from the auth client read path', async () => {
    const tenant = tenantRow({ name: 'Bella Settings' });
    scriptedResults = [
      { data: tenant, error: null },
    ];

    await expect(getTenantSettings()).resolves.toEqual(tenant);

    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'tenants',
        operation: 'select',
        selectColumns: '*',
        filters: [{ column: 'id', value: 'tenant-1' }],
      }),
    ]);
    expect(mockCreateSupabaseJsClient).not.toHaveBeenCalled();
  });

  it('rejects tenant settings read failures instead of returning silent null', async () => {
    scriptedResults = [
      { data: null, error: { message: 'rls blocked' } },
    ];

    await expect(getTenantSettings()).rejects.toThrow(
      '[getTenantSettings] Failed to load tenant settings: rls blocked',
    );

    expect(queryCalls).toHaveLength(1);
    expect(mockCreateSupabaseJsClient).not.toHaveBeenCalled();
  });

  it('returns tenant settings when admin fallback recovers an auth read failure', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://bella.test';
    const tenant = tenantRow({ name: 'Bella Admin Fallback' });
    scriptedResults = [
      { data: null, error: { message: 'rls blocked' } },
      { data: tenant, error: null },
    ];

    await expect(getTenantSettings()).resolves.toEqual(tenant);

    expect(mockCreateSupabaseJsClient).toHaveBeenCalledWith('https://bella.test', 'service-role');
    expect(queryCalls.map((call) => call.operation)).toEqual(['select', 'select']);
  });

  it('rejects tenant settings when auth read and admin fallback both fail', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://bella.test';
    scriptedResults = [
      { data: null, error: { message: 'rls blocked' } },
      { data: null, error: { message: 'admin denied' } },
    ];

    await expect(getTenantSettings()).rejects.toThrow(
      '[getTenantSettings] Failed to load tenant settings: admin denied',
    );

    expect(queryCalls.map((call) => call.operation)).toEqual(['select', 'select']);
  });

  it('updates tenant settings, records audit, and revalidates after audit succeeds', async () => {
    const oldTenant = tenantRow();
    const updatedTenant = tenantRow({ name: 'Bella New', contact_phone: '0911111111' });
    scriptedResults = [
      { data: oldTenant, error: null },
      { data: [updatedTenant], error: null },
    ];

    const result = await saveTenantSettings({
      name: 'Bella New',
      phone: '0911111111',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(updatedTenant);
    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'tenants',
        operation: 'select',
        selectColumns: '*',
        filters: [{ column: 'id', value: 'tenant-1' }],
      }),
      expect.objectContaining({
        table: 'tenants',
        operation: 'update',
        payload: expect.objectContaining({
          name: 'Bella New',
          contact_phone: '0911111111',
          updated_at: expect.any(String),
        }),
        filters: [{ column: 'id', value: 'tenant-1' }],
      }),
    ]);
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'tenants',
      record_id: 'tenant-1',
      old_data: oldTenant,
      new_data: updatedTenant,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
    expect(mockRecordAuditLog.mock.invocationCallOrder[0]).toBeLessThan(
      mockRevalidatePath.mock.invocationCallOrder[0],
    );
  });

  it('fails closed when tenant snapshot cannot be loaded', async () => {
    scriptedResults = [
      { data: null, error: { message: 'snapshot unavailable' } },
    ];

    const result = await saveTenantSettings({ name: 'Bella New' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to snapshot tenant settings: snapshot unavailable');
    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0].operation).toBe('select');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns update failures without audit or revalidation', async () => {
    scriptedResults = [
      { data: tenantRow(), error: null },
      { data: null, error: { message: 'update denied' } },
    ];

    const result = await saveTenantSettings({ email: 'new@bella.vn' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('update denied');
    expect(queryCalls.map((call) => call.operation)).toEqual(['select', 'update']);
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('rolls back tenant settings when audit logging fails', async () => {
    const oldTenant = tenantRow();
    const updatedTenant = tenantRow({ name: 'Bella New', qr_bank_code: 'NEW' });
    scriptedResults = [
      { data: oldTenant, error: null },
      { data: [updatedTenant], error: null },
      { data: null, error: null },
    ];
    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit down'));

    const result = await saveTenantSettings({
      name: 'Bella New',
      qr_bank_code: 'NEW',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to record tenant settings audit log: audit down');
    expect(queryCalls.map((call) => call.operation)).toEqual(['select', 'update', 'update']);
    expect(queryCalls[2]).toEqual(expect.objectContaining({
      table: 'tenants',
      operation: 'update',
      filters: [{ column: 'id', value: 'tenant-1' }],
      payload: {
        name: 'Bella Old',
        contact_phone: '0900000000',
        email: 'old@bella.vn',
        address: 'Old address',
        qr_bank_code: 'OLD',
        qr_account_number: '111',
        qr_account_name: 'Old Account',
        salary_config: { kpi: 1 },
        role_permissions: { admin: { settings: true } },
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    }));
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('reports rollback failure when audit and rollback both fail', async () => {
    scriptedResults = [
      { data: tenantRow(), error: null },
      { data: [tenantRow({ name: 'Bella New' })], error: null },
      { data: null, error: { message: 'rollback denied' } },
    ];
    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit down'));

    const result = await saveTenantSettings({ name: 'Bella New' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to record tenant settings audit log: audit down');
    expect(result.error).toContain('rollback failed: rollback denied');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
