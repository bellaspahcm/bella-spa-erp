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
  operation: 'select' | 'update';
  payload?: unknown;
  selectColumns?: string;
  filters: Array<{ method: string; args: unknown[] }>;
  orders: Array<{ column: string; options?: unknown }>;
  limitCount?: number;
};

const queryCalls: QueryCall[] = [];
let scriptedResults: QueryResult[] = [];

class QueryBuilder implements PromiseLike<QueryResult> {
  private operation: 'select' | 'update' = 'select';
  private payload?: unknown;
  private selectColumns?: string;
  private filters: Array<{ method: string; args: unknown[] }> = [];
  private orders: Array<{ column: string; options?: unknown }> = [];
  private limitCount?: number;

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
      operation: this.operation,
      payload: this.payload,
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
import { getOrRefreshZaloToken } from '@/services/crm/zalo-config';

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
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('uses the first tenant Zalo config row when Supabase returns an array result', async () => {
    scriptedResults = [
      {
        data: [
          {
            zalo_app_id: 'active-app',
            zalo_secret_key: 'active-secret',
            zalo_oa_id: 'active-oa',
            zalo_access_token: 'active-access',
            zalo_refresh_token: 'active-refresh',
            zalo_token_expires_at: '2026-06-03T00:00:00.000Z',
            zalo_template_reminder_id: 'active-reminder-template',
            zalo_template_birthday_id: 'active-birthday-template',
            zalo_auto_scan: true,
          },
          {
            zalo_app_id: 'duplicate-app',
            zalo_secret_key: 'duplicate-secret',
            zalo_oa_id: 'duplicate-oa',
            zalo_access_token: 'duplicate-access',
            zalo_refresh_token: 'duplicate-refresh',
            zalo_token_expires_at: '2026-06-04T00:00:00.000Z',
            zalo_template_reminder_id: 'duplicate-reminder-template',
            zalo_template_birthday_id: 'duplicate-birthday-template',
            zalo_auto_scan: false,
          },
        ],
        error: null,
      },
    ];

    await expect(getZaloConfig()).resolves.toEqual({
      zalo_app_id: 'active-app',
      zalo_secret_key: 'decrypted:active-secret',
      zalo_oa_id: 'active-oa',
      zalo_access_token: 'decrypted:active-access',
      zalo_refresh_token: 'decrypted:active-refresh',
      zalo_token_expires_at: '2026-06-03T00:00:00.000Z',
      zalo_template_reminder_id: 'active-reminder-template',
      zalo_template_birthday_id: 'active-birthday-template',
      zalo_auto_scan: true,
    });

    expect(queryCalls[0]).toEqual(expect.objectContaining({
      table: 'tenants',
      filters: [{ method: 'eq', args: ['id', 'tenant-1'] }],
      limitCount: 1,
    }));
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

  it('returns an empty Zalo config when no tenant config row is visible', async () => {
    scriptedResults = [
      { data: null, error: null },
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

  it('returns the current Zalo access token when it is still valid', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T00:00:00.000Z'));
    scriptedResults = [
      {
        data: {
          zalo_app_id: 'app-1',
          zalo_secret_key: 'secret-key',
          zalo_access_token: 'access-token',
          zalo_refresh_token: 'refresh-token',
          zalo_token_expires_at: '2026-06-03T00:10:01.000Z',
        },
        error: null,
      },
    ];

    await expect(getOrRefreshZaloToken('tenant-1')).resolves.toBe('decrypted:access-token');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0].operation).toBe('select');
    expect(queryCalls[0].limitCount).toBe(1);
  });

  it('returns null when required Zalo credential config is missing', async () => {
    scriptedResults = [
      {
        data: {
          zalo_app_id: 'app-1',
          zalo_secret_key: null,
          zalo_access_token: 'access-token',
          zalo_refresh_token: 'refresh-token',
          zalo_token_expires_at: '2026-06-03T00:10:01.000Z',
        },
        error: null,
      },
    ];

    await expect(getOrRefreshZaloToken('tenant-1')).resolves.toBeNull();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(queryCalls).toHaveLength(1);
  });

  it('rejects token tenant query failures instead of returning null', async () => {
    scriptedResults = [
      { data: null, error: { message: 'token query blocked' } },
    ];

    await expect(getOrRefreshZaloToken('tenant-1')).rejects.toThrow(
      '[getOrRefreshZaloToken] tenants token query failed for tenant tenant-1: token query blocked',
    );

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects missing tenant token rows instead of returning null', async () => {
    scriptedResults = [
      { data: null, error: null },
    ];

    await expect(getOrRefreshZaloToken('tenant-1')).rejects.toThrow(
      '[getOrRefreshZaloToken] tenant token row not found for tenant tenant-1',
    );
  });

  it('rejects OAuth HTTP failures during token refresh', async () => {
    scriptedResults = [
      {
        data: {
          zalo_app_id: 'app-1',
          zalo_secret_key: 'secret-key',
          zalo_access_token: 'access-token',
          zalo_refresh_token: 'refresh-token',
          zalo_token_expires_at: '2026-06-02T00:00:00.000Z',
        },
        error: null,
      },
    ];
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
    } as Response));

    await expect(getOrRefreshZaloToken('tenant-1')).rejects.toThrow(
      '[getOrRefreshZaloToken] Zalo OAuth refresh failed for tenant tenant-1: HTTP 503',
    );

    expect(queryCalls).toHaveLength(1);
  });

  it('rejects OAuth responses without an access token', async () => {
    scriptedResults = [
      {
        data: {
          zalo_app_id: 'app-1',
          zalo_secret_key: 'secret-key',
          zalo_access_token: 'access-token',
          zalo_refresh_token: 'refresh-token',
          zalo_token_expires_at: '2026-06-02T00:00:00.000Z',
        },
        error: null,
      },
    ];
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ error_code: 190 }),
    } as Response));

    await expect(getOrRefreshZaloToken('tenant-1')).rejects.toThrow(
      '[getOrRefreshZaloToken] Zalo OAuth response missing access_token for tenant tenant-1: 190',
    );

    expect(queryCalls).toHaveLength(1);
  });

  it('rejects save failures after OAuth refresh instead of returning the new token', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T00:00:00.000Z'));
    scriptedResults = [
      {
        data: {
          zalo_app_id: 'app-1',
          zalo_secret_key: 'secret-key',
          zalo_access_token: 'access-token',
          zalo_refresh_token: 'refresh-token',
          zalo_token_expires_at: '2026-06-02T00:00:00.000Z',
        },
        error: null,
      },
      { data: null, error: { message: 'save denied' } },
    ];
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 7200,
      }),
    } as Response));

    await expect(getOrRefreshZaloToken('tenant-1')).rejects.toThrow(
      '[getOrRefreshZaloToken] failed to save refreshed token for tenant tenant-1: save denied',
    );

    expect(queryCalls.map((call) => call.operation)).toEqual(['select', 'update']);
  });

  it('returns the refreshed token after OAuth refresh and tenant save both succeed', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T00:00:00.000Z'));
    scriptedResults = [
      {
        data: {
          zalo_app_id: 'app-1',
          zalo_secret_key: 'secret-key',
          zalo_access_token: 'access-token',
          zalo_refresh_token: 'refresh-token',
          zalo_token_expires_at: '2026-06-02T00:00:00.000Z',
        },
        error: null,
      },
      { data: null, error: null },
    ];
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 7200,
      }),
    } as Response));

    await expect(getOrRefreshZaloToken('tenant-1')).resolves.toBe('new-access-token');

    expect(queryCalls.map((call) => call.operation)).toEqual(['select', 'update']);
    expect(queryCalls[1].payload).toEqual({
      zalo_access_token: 'encrypted:new-access-token',
      zalo_refresh_token: 'encrypted:new-refresh-token',
      zalo_token_expires_at: '2026-06-03T02:00:00.000Z',
    });
  });
});
