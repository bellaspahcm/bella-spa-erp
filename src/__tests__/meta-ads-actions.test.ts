import { readFileSync } from 'fs';

jest.mock('server-only', () => ({}), { virtual: true });

const mockGetCurrentUser = jest.fn();

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryOperation = 'select' | 'insert' | 'upsert' | 'update' | 'delete';
type QueryCall = {
  table: string;
  operation: QueryOperation;
  payload?: unknown;
  options?: unknown;
  selectColumns?: string;
  filters: { method: 'eq' | 'gte' | 'lte'; column: string; value: unknown }[];
  orderBy: { column: string; options?: unknown }[];
};

const queryCalls: QueryCall[] = [];
let scriptedResults: QueryResult[] = [];

class QueryBuilder implements PromiseLike<QueryResult> {
  private operation: QueryOperation = 'select';
  private payload?: unknown;
  private options?: unknown;
  private selectColumns?: string;
  private filters: QueryCall['filters'] = [];
  private orderBy: QueryCall['orderBy'] = [];

  constructor(private readonly table: string) {}

  select(columns?: string) {
    this.selectColumns = columns;
    return this;
  }

  insert(payload: unknown) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  upsert(payload: unknown, options?: unknown) {
    this.operation = 'upsert';
    this.payload = payload;
    this.options = options;
    return this;
  }

  update(payload: unknown) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ method: 'eq', column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ method: 'gte', column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ method: 'lte', column, value });
    return this;
  }

  order(column: string, options?: unknown) {
    this.orderBy.push({ column, options });
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
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private resolve() {
    queryCalls.push({
      table: this.table,
      operation: this.operation,
      payload: this.payload,
      options: this.options,
      selectColumns: this.selectColumns,
      filters: [...this.filters],
      orderBy: [...this.orderBy],
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

import {
  deleteUnusedMetaAdAccountConnection,
  getMetaAdsDailyInsights,
  saveMetaAdAccountConnection,
  syncMetaAdsInsights,
} from '@/services/marketing/meta-ads';
import { encrypt } from '@/lib/crypto';

const mockFetch = jest.fn();

describe('Meta Ads Phase 1 actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCalls.length = 0;
    scriptedResults = [];
    delete process.env.META_MARKETING_ACCESS_TOKEN;
    delete process.env.META_MARKETING_API_VERSION;
    delete process.env.DB_ENCRYPTION_KEY;
    global.fetch = mockFetch as unknown as typeof fetch;
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      tenant_id: 'tenant-1',
      role: 'admin',
    });
  });

  it('keeps Meta access tokens out of database migrations', () => {
    const sql = readFileSync(
      'supabase/migrations/20260608090000_create_meta_ads_phase1.sql',
      'utf8',
    );

    expect(sql).not.toMatch(/access_token/i);
    expect(sql).not.toMatch(/token_encrypted/i);
  });

  it('stores Meta tokens in a separate admin-only table migration', () => {
    const sql = readFileSync(
      'supabase/migrations/20260608100000_add_meta_ads_account_tokens.sql',
      'utf8',
    );

    expect(sql).toContain('marketing_meta_ad_account_tokens');
    expect(sql).toContain('access_token_encrypted TEXT NOT NULL');
    expect(sql).toContain("lower(u.role) IN ('admin', 'super_admin')");
  });

  it('blocks non-admin users before saving ad account mappings', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 'ktv-1',
      tenant_id: 'tenant-1',
      role: 'ktv',
    });

    const result = await saveMetaAdAccountConnection({
      adAccountId: 'act_123',
      accountName: 'Bella Ads',
    });

    expect(result).toEqual({ success: false, error: 'Chi admin moi duoc cau hinh Meta Ads.' });
    expect(queryCalls).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('records an explicit failed sync when the server token is missing', async () => {
    scriptedResults = [
      {
        data: { id: 'connection-1', tenant_id: 'tenant-1', ad_account_id: 'act_123', is_active: true },
        error: null,
      },
      { data: { id: 'run-1' }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ];

    const result = await syncMetaAdsInsights({
      adAccountId: '123',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
    });

    expect(result).toEqual({
      success: false,
      error: 'Chua co Meta access token cho tai khoan nay. Vui long cap nhat token trong Cai dat > Meta Ads.',
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'marketing_meta_ad_accounts',
        operation: 'select',
        filters: expect.arrayContaining([
          { method: 'eq', column: 'tenant_id', value: 'tenant-1' },
          { method: 'eq', column: 'ad_account_id', value: 'act_123' },
          { method: 'eq', column: 'is_active', value: true },
        ]),
      }),
      expect.objectContaining({
        table: 'marketing_meta_ads_sync_runs',
        operation: 'insert',
        payload: expect.objectContaining({
          tenant_id: 'tenant-1',
          ad_account_id: 'act_123',
          status: 'running',
        }),
      }),
      expect.objectContaining({
        table: 'marketing_meta_ad_account_tokens',
        operation: 'select',
        filters: expect.arrayContaining([
          { method: 'eq', column: 'tenant_id', value: 'tenant-1' },
          { method: 'eq', column: 'meta_ad_account_id', value: 'connection-1' },
        ]),
      }),
      expect.objectContaining({
        table: 'marketing_meta_ads_sync_runs',
        operation: 'update',
        payload: expect.objectContaining({
          status: 'failed',
          rows_synced: 0,
          error_message: 'Chua co Meta access token cho tai khoan nay. Vui long cap nhat token trong Cai dat > Meta Ads.',
        }),
      }),
    ]);
  });

  it('saves a per-account Meta token encrypted and returns only safe metadata', async () => {
    process.env.DB_ENCRYPTION_KEY = 'test-db-encryption-key';
    scriptedResults = [
      {
        data: {
          id: 'connection-1',
          tenant_id: 'tenant-1',
          ad_account_id: 'act_123',
          account_name: 'Bella Ads',
          currency: 'VND',
          timezone_name: 'Asia/Ho_Chi_Minh',
          is_active: true,
          last_synced_at: null,
          token_last_four: null,
          token_updated_at: null,
          created_at: '2026-06-08T00:00:00.000Z',
          updated_at: '2026-06-08T00:00:00.000Z',
        },
        error: null,
      },
      { data: null, error: null },
      {
        data: {
          id: 'connection-1',
          tenant_id: 'tenant-1',
          ad_account_id: 'act_123',
          account_name: 'Bella Ads',
          currency: 'VND',
          timezone_name: 'Asia/Ho_Chi_Minh',
          is_active: true,
          last_synced_at: null,
          token_last_four: 'c123',
          token_updated_at: '2026-06-08T00:00:00.000Z',
          created_at: '2026-06-08T00:00:00.000Z',
          updated_at: '2026-06-08T00:00:00.000Z',
        },
        error: null,
      },
    ];

    const result = await saveMetaAdAccountConnection({
      adAccountId: '123',
      accountName: 'Bella Ads',
      currency: 'VND',
      timezoneName: 'Asia/Ho_Chi_Minh',
      accessToken: 'secret-meta-token-abc123',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token_last_four).toBe('c123');
      expect(JSON.stringify(result.data)).not.toContain('secret-meta-token-abc123');
      expect(JSON.stringify(result.data)).not.toContain('access_token_encrypted');
    }

    const accountUpsert = queryCalls.find(
      (call) => call.table === 'marketing_meta_ad_accounts' && call.operation === 'upsert',
    );
    expect(accountUpsert?.selectColumns).not.toContain('access_token_encrypted');
    expect(JSON.stringify(accountUpsert?.payload)).not.toContain('secret-meta-token-abc123');

    const tokenUpsert = queryCalls.find(
      (call) => call.table === 'marketing_meta_ad_account_tokens' && call.operation === 'upsert',
    );
    expect(tokenUpsert?.payload).toEqual(expect.objectContaining({
      tenant_id: 'tenant-1',
      meta_ad_account_id: 'connection-1',
      token_last_four: 'c123',
    }));
    expect(JSON.stringify(tokenUpsert?.payload)).not.toContain('secret-meta-token-abc123');
    expect(JSON.stringify(tokenUpsert?.payload)).toContain('access_token_encrypted');
  });

  it('deletes only unused Meta ad account mappings and their stored token', async () => {
    scriptedResults = [
      {
        data: { id: 'connection-1', ad_account_id: 'act_123', last_synced_at: null },
        error: null,
      },
      { data: null, error: null },
      { data: null, error: null },
    ];

    const result = await deleteUnusedMetaAdAccountConnection({ adAccountId: '123' });

    expect(result).toEqual({ success: true, data: { adAccountId: 'act_123' } });
    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'marketing_meta_ad_accounts',
        operation: 'select',
        filters: expect.arrayContaining([
          { method: 'eq', column: 'tenant_id', value: 'tenant-1' },
          { method: 'eq', column: 'ad_account_id', value: 'act_123' },
        ]),
      }),
      expect.objectContaining({
        table: 'marketing_meta_ad_account_tokens',
        operation: 'delete',
        filters: expect.arrayContaining([
          { method: 'eq', column: 'tenant_id', value: 'tenant-1' },
          { method: 'eq', column: 'meta_ad_account_id', value: 'connection-1' },
        ]),
      }),
      expect.objectContaining({
        table: 'marketing_meta_ad_accounts',
        operation: 'delete',
        filters: expect.arrayContaining([
          { method: 'eq', column: 'tenant_id', value: 'tenant-1' },
          { method: 'eq', column: 'id', value: 'connection-1' },
        ]),
      }),
    ]);
  });

  it('refuses to delete Meta ad accounts that already synced data', async () => {
    scriptedResults = [
      {
        data: {
          id: 'connection-1',
          ad_account_id: 'act_123',
          last_synced_at: '2026-06-08T02:00:00.000Z',
        },
        error: null,
      },
    ];

    const result = await deleteUnusedMetaAdAccountConnection({ adAccountId: 'act_123' });

    expect(result).toEqual({
      success: false,
      error: 'Tai khoan Meta Ads da tung dong bo du lieu nen khong xoa truc tiep de tranh mat dau bao cao.',
    });
    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0]).toEqual(expect.objectContaining({
      table: 'marketing_meta_ad_accounts',
      operation: 'select',
    }));
  });

  it('syncs daily ad insights without persisting the Meta API token', async () => {
    process.env.META_MARKETING_ACCESS_TOKEN = 'secret-meta-token';
    process.env.META_MARKETING_API_VERSION = 'v24.0';
    scriptedResults = [
      {
        data: { id: 'connection-1', tenant_id: 'tenant-1', ad_account_id: 'act_123', is_active: true },
        error: null,
      },
      { data: { id: 'run-1' }, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          {
            date_start: '2026-06-01',
            date_stop: '2026-06-01',
            campaign_id: 'cmp-1',
            campaign_name: 'Me va be',
            adset_id: 'adset-1',
            adset_name: 'HCM',
            ad_id: 'ad-1',
            ad_name: 'Landing form',
            spend: '123456.78',
            impressions: '1000',
            reach: '800',
            clicks: '50',
            ctr: '5',
            cpc: '2469.1356',
            cpm: '123456.78',
            actions: [{ action_type: 'lead', value: '3' }],
          },
        ],
      }),
      status: 200,
    });

    const result = await syncMetaAdsInsights({
      adAccountId: 'act_123',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-01',
    });

    expect(result).toEqual({ success: true, data: { rowsSynced: 1, runId: 'run-1' } });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(requestedUrl.pathname).toBe('/v24.0/act_123/insights');
    expect(requestedUrl.searchParams.get('access_token')).toBe('secret-meta-token');

    const upsertCall = queryCalls.find(
      (call) => call.table === 'marketing_meta_ads_insights_daily' && call.operation === 'upsert',
    );
    expect(upsertCall?.options).toEqual({
      onConflict: 'tenant_id,ad_account_id,date_start,campaign_id,adset_id,ad_id',
    });
    expect(upsertCall?.payload).toEqual([
      expect.objectContaining({
        tenant_id: 'tenant-1',
        ad_account_id: 'act_123',
        date_start: '2026-06-01',
        campaign_id: 'cmp-1',
        adset_id: 'adset-1',
        ad_id: 'ad-1',
        spend: 123456.78,
        impressions: 1000,
        reach: 800,
        clicks: 50,
        actions: [{ action_type: 'lead', value: '3' }],
      }),
    ]);
    expect(JSON.stringify(upsertCall?.payload)).not.toContain('secret-meta-token');
  });

  it('prefers the encrypted per-account Meta token over the legacy env token', async () => {
    process.env.DB_ENCRYPTION_KEY = 'test-db-encryption-key';
    process.env.META_MARKETING_ACCESS_TOKEN = 'legacy-env-token';
    process.env.META_MARKETING_API_VERSION = 'v24.0';
    scriptedResults = [
      {
        data: { id: 'connection-1', tenant_id: 'tenant-1', ad_account_id: 'act_123', is_active: true },
        error: null,
      },
      { data: { id: 'run-1' }, error: null },
      {
        data: { access_token_encrypted: encrypt('stored-account-token') },
        error: null,
      },
      { data: null, error: null },
      { data: null, error: null },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
      status: 200,
    });

    const result = await syncMetaAdsInsights({
      adAccountId: 'act_123',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-01',
    });

    expect(result).toEqual({ success: true, data: { rowsSynced: 0, runId: 'run-1' } });
    const requestedUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(requestedUrl.searchParams.get('access_token')).toBe('stored-account-token');
    expect(requestedUrl.searchParams.get('access_token')).not.toBe('legacy-env-token');
  });

  it('allows accountants to read tenant-scoped Meta Ads insights only', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 'accountant-1',
      tenant_id: 'tenant-1',
      role: 'accountant',
    });
    scriptedResults = [{ data: [], error: null }];

    const result = await getMetaAdsDailyInsights({
      adAccountId: '123',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
    });

    expect(result).toEqual({ success: true, data: [] });
    expect(queryCalls).toEqual([
      expect.objectContaining({
        table: 'marketing_meta_ads_insights_daily',
        operation: 'select',
        filters: expect.arrayContaining([
          { method: 'eq', column: 'tenant_id', value: 'tenant-1' },
          { method: 'gte', column: 'date_start', value: '2026-06-01' },
          { method: 'lte', column: 'date_start', value: '2026-06-07' },
          { method: 'eq', column: 'ad_account_id', value: 'act_123' },
        ]),
      }),
    ]);
  });
});
