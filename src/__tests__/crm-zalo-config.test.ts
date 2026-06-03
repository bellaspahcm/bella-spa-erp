const mockCreateClient = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockDecrypt = jest.fn((value: string) => value ? `decrypted:${value}` : '');

jest.mock('@/lib/supabase-server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

jest.mock('../services/audit-actions', () => ({
  recordAuditLog: jest.fn(),
}));

jest.mock('@/lib/crypto', () => ({
  encrypt: (value: string) => `encrypted:${value}`,
  decrypt: (value: string) => mockDecrypt(value),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryCall = {
  table: string;
  selectColumns?: string;
  filters: Array<{ method: string; args: unknown[] }>;
  orders: Array<{ column: string; options?: unknown }>;
  limitCount?: number;
};

const queryCalls: QueryCall[] = [];
let scriptedResults: QueryResult[] = [];

class QueryBuilder implements PromiseLike<QueryResult> {
  private selectColumns?: string;
  private filters: Array<{ method: string; args: unknown[] }> = [];
  private orders: Array<{ column: string; options?: unknown }> = [];
  private limitCount?: number;

  constructor(private readonly table: string) {}

  select(columns?: string) {
    this.selectColumns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ method: 'eq', args: [column, value] });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ method: 'in', args: [column, values] });
    return this;
  }

  order(column: string, options?: unknown) {
    this.orders.push({ column, options });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    queryCalls.push({
      table: this.table,
      selectColumns: this.selectColumns,
      filters: [...this.filters],
      orders: [...this.orders],
      limitCount: this.limitCount,
    });

    return Promise.resolve(scriptedResults.shift() ?? { data: null, error: null })
      .then(onfulfilled, onrejected);
  }
}

const mockSupabase = {
  from: jest.fn((table: string) => new QueryBuilder(table)),
};

import { getZaloConfig, getZaloZnsLogs } from '@/services/crm/zalo-config';

describe('CRM Zalo config read actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCalls.length = 0;
    scriptedResults = [];
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      tenant_id: 'tenant-1',
      role: 'admin',
    });
  });

  it('returns decrypted Zalo config when the tenant query succeeds', async () => {
    scriptedResults = [
      {
        data: {
          zalo_app_id: 'app-1',
          zalo_secret_key: 'secret-key',
          zalo_oa_id: 'oa-1',
          zalo_access_token: 'access-token',
          zalo_refresh_token: 'refresh-token',
          zalo_token_expires_at: '2026-06-03T00:00:00.000Z',
          zalo_template_reminder_id: 'reminder-template',
          zalo_template_birthday_id: 'birthday-template',
          zalo_auto_scan: false,
        },
        error: null,
      },
    ];

    await expect(getZaloConfig()).resolves.toEqual({
      zalo_app_id: 'app-1',
      zalo_secret_key: 'decrypted:secret-key',
      zalo_oa_id: 'oa-1',
      zalo_access_token: 'decrypted:access-token',
      zalo_refresh_token: 'decrypted:refresh-token',
      zalo_token_expires_at: '2026-06-03T00:00:00.000Z',
      zalo_template_reminder_id: 'reminder-template',
      zalo_template_birthday_id: 'birthday-template',
      zalo_auto_scan: false,
    });

    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'tenants',
        filters: [{ method: 'eq', args: ['id', 'tenant-1'] }],
      }),
    ]);
    expect(mockDecrypt).toHaveBeenCalledWith('secret-key');
    expect(mockDecrypt).toHaveBeenCalledWith('access-token');
    expect(mockDecrypt).toHaveBeenCalledWith('refresh-token');
  });

  it('returns blank fields only when the tenant config row loads successfully with null fields', async () => {
    scriptedResults = [
      {
        data: {
          zalo_app_id: null,
          zalo_secret_key: null,
          zalo_oa_id: null,
          zalo_access_token: null,
          zalo_refresh_token: null,
          zalo_token_expires_at: null,
          zalo_template_reminder_id: null,
          zalo_template_birthday_id: null,
          zalo_auto_scan: null,
        },
        error: null,
      },
    ];

    await expect(getZaloConfig()).resolves.toEqual({
      zalo_app_id: '',
      zalo_secret_key: '',
      zalo_oa_id: '',
      zalo_access_token: '',
      zalo_refresh_token: '',
      zalo_token_expires_at: '',
      zalo_template_reminder_id: '',
      zalo_template_birthday_id: '',
      zalo_auto_scan: true,
    });
  });

  it('rejects Zalo config DB failures instead of returning a blank config', async () => {
    scriptedResults = [
      { data: null, error: { message: 'tenant config blocked' } },
    ];

    await expect(getZaloConfig()).rejects.toThrow(
      '[getZaloConfig] tenants Zalo config query failed: tenant config blocked',
    );
  });

  it('rejects missing tenant config rows instead of returning a blank config', async () => {
    scriptedResults = [
      { data: null, error: null },
    ];

    await expect(getZaloConfig()).rejects.toThrow(
      '[getZaloConfig] Tenant Zalo config not found',
    );
  });

  it('rejects Zalo config reads without tenant context', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 'admin-1',
      tenant_id: null,
      role: 'admin',
    });

    await expect(getZaloConfig()).rejects.toThrow('Unauthorized: Tenant ID is required');

    expect(queryCalls).toHaveLength(0);
  });

  it('returns ZNS logs when the notification query succeeds', async () => {
    const logs = [
      { id: 'log-1', type: 'zalo_zns' },
      { id: 'log-2', type: 'zalo_birthday' },
    ];
    scriptedResults = [
      { data: logs, error: null },
    ];

    await expect(getZaloZnsLogs()).resolves.toEqual(logs);

    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'Notification',
        filters: expect.arrayContaining([
          { method: 'eq', args: ['tenantId', 'tenant-1'] },
          { method: 'in', args: ['type', ['zalo_zns', 'zalo_birthday']] },
        ]),
        limitCount: 30,
      }),
    ]);
  });

  it('returns an empty ZNS log list when the query succeeds with no rows', async () => {
    scriptedResults = [
      { data: null, error: null },
    ];

    await expect(getZaloZnsLogs()).resolves.toEqual([]);
  });

  it('rejects ZNS log DB failures instead of returning an empty list', async () => {
    scriptedResults = [
      { data: null, error: { message: 'logs blocked' } },
    ];

    await expect(getZaloZnsLogs()).rejects.toThrow(
      '[getZaloZnsLogs] Notification ZNS logs query failed: logs blocked',
    );
  });

  it('returns an empty ZNS log list when current user has no tenant id', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 'admin-1',
      tenant_id: null,
      role: 'admin',
    });

    await expect(getZaloZnsLogs()).resolves.toEqual([]);

    expect(queryCalls).toHaveLength(0);
  });
});
