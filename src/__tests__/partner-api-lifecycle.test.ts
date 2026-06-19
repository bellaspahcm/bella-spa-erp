jest.mock('server-only', () => ({}), { virtual: true });

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

import {
  addScopes,
  createPartner,
  deletePartner,
  getPartnerById,
  listPartners,
  regenerateApiKey,
  removeScopes,
  updatePartner,
} from '@/services/api-gateway/partner.service';
import { APIError, type APIPartner } from '@/types/api-gateway';

type DbOperation = 'insert' | 'select' | 'update';

type ScriptedResult = {
  table: string;
  op: DbOperation;
  data?: unknown;
  count?: number | null;
  error?: { message: string; code?: string };
};

type DbCall = {
  table: string;
  op: DbOperation;
  payload?: unknown;
  filters: Array<{ method: string; args: unknown[] }>;
};

class ScriptedQueryBuilder {
  private call: DbCall | null = null;

  constructor(
    private table: string,
    private scripts: ScriptedResult[],
    private calls: DbCall[],
  ) {}

  select(_columns?: string, _options?: unknown) {
    if (!this.call) this.startCall('select');
    return this;
  }

  insert(payload: unknown) {
    this.startCall('insert', payload);
    return this;
  }

  update(payload: unknown) {
    this.startCall('update', payload);
    return this;
  }

  eq(...args: unknown[]) {
    this.call?.filters.push({ method: 'eq', args });
    return this;
  }

  order(...args: unknown[]) {
    this.call?.filters.push({ method: 'order', args });
    return this;
  }

  range(...args: unknown[]) {
    this.call?.filters.push({ method: 'range', args });
    return this;
  }

  single() {
    return this.resolve();
  }

  then(onfulfilled: (value: { data: unknown; error: { message: string; code?: string } | null; count?: number | null }) => unknown) {
    return this.resolve().then(onfulfilled);
  }

  private startCall(op: DbOperation, payload?: unknown) {
    this.call = { table: this.table, op, payload, filters: [] };
    this.calls.push(this.call);
  }

  private resolve() {
    const next = this.scripts.shift();
    if (!next || !this.call) {
      throw new Error(`No scripted result for ${this.table}.${this.call?.op ?? 'unknown'}`);
    }
    if (next.table !== this.table || next.op !== this.call.op) {
      throw new Error(`Expected ${next.table}.${next.op}, got ${this.table}.${this.call.op}`);
    }

    return Promise.resolve({
      data: next.data ?? null,
      error: next.error ?? null,
      count: next.count ?? null,
    });
  }
}

const partnerBase: APIPartner = {
  id: 'partner-1',
  tenant_id: 'tenant-1',
  partner_name: 'Bella POS Partner',
  partner_type: 'pos',
  partner_description: 'POS integration',
  contact_email: 'pos@example.com',
  api_key: 'pk_test_old',
  allowed_scopes: ['order:read', 'payment:read'],
  is_active: true,
  is_sandbox: true,
  rate_limit_tier: 'basic',
  rate_limit_per_minute: 100,
  rate_limit_per_day: 5000,
  rate_limit_burst: 200,
  total_requests_count: 0,
  failed_requests_count: 0,
  metadata: { source: 'test' },
  created_at: '2026-06-19T00:00:00.000Z',
  updated_at: '2026-06-19T00:00:00.000Z',
};

function installScriptedSupabase(scripts: ScriptedResult[]) {
  const calls: DbCall[] = [];
  mockFrom.mockImplementation((table: string) => new ScriptedQueryBuilder(table, scripts, calls));
  return calls;
}

describe('partner API service lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-19T08:00:00.000Z'));
    mockRpc.mockResolvedValue({ data: 'pk_test_generated', error: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates, lists, updates, rotates, scopes, and soft-deletes a partner with tenant-safe filters', async () => {
    const calls = installScriptedSupabase([
      { table: 'api_partners', op: 'insert', data: { ...partnerBase, api_key: 'pk_test_generated' } },
      { table: 'api_partners', op: 'select', data: [{ ...partnerBase, api_key: 'pk_test_generated' }], count: 1 },
      { table: 'api_partners', op: 'select', data: { ...partnerBase, api_key: 'pk_test_generated' } },
      { table: 'api_partners', op: 'select', data: { ...partnerBase, api_key: 'pk_test_generated' } },
      { table: 'api_partners', op: 'update', data: { ...partnerBase, partner_name: 'Bella POS Partner v2' } },
      { table: 'api_partners', op: 'select', data: partnerBase },
      { table: 'api_partners', op: 'update', data: { ...partnerBase, api_key: 'pk_test_rotated', metadata: { source: 'test', api_key_regenerated_at: '2026-06-19T08:00:00.000Z', previous_key_rotated: true } } },
      { table: 'api_partners', op: 'select', data: partnerBase },
      { table: 'api_partners', op: 'update', data: { ...partnerBase, allowed_scopes: ['order:read', 'payment:read', 'order:write'] } },
      { table: 'api_partners', op: 'select', data: { ...partnerBase, allowed_scopes: ['order:read', 'payment:read', 'order:write'] } },
      { table: 'api_partners', op: 'update', data: { ...partnerBase, allowed_scopes: ['order:read', 'order:write'] } },
      { table: 'api_partners', op: 'update', data: { ...partnerBase, is_active: false } },
    ]);
    mockRpc
      .mockResolvedValueOnce({ data: 'pk_test_generated', error: null })
      .mockResolvedValueOnce({ data: 'pk_test_rotated', error: null });

    const created = await createPartner({
      tenant_id: 'tenant-1',
      partner_name: 'Bella POS Partner',
      partner_type: 'pos',
      allowed_scopes: ['order:read', 'payment:read'],
      is_sandbox: true,
    }, 'admin-1');
    const listed = await listPartners({ tenant_id: 'tenant-1', partner_type: 'pos', is_active: true, limit: 10, offset: 20 });
    const fetched = await getPartnerById('partner-1', 'tenant-1');
    const updated = await updatePartner('partner-1', { partner_name: 'Bella POS Partner v2' }, 'admin-2');
    const rotated = await regenerateApiKey('partner-1', 'admin-3');
    const withAddedScope = await addScopes('partner-1', ['order:write', 'payment:read']);
    const withRemovedScope = await removeScopes('partner-1', ['payment:read']);
    const deleted = await deletePartner('partner-1');

    expect(created.api_key).toBe('pk_test_generated');
    expect(listed).toEqual({ partners: [{ ...partnerBase, api_key: 'pk_test_generated' }], total: 1 });
    expect(fetched?.tenant_id).toBe('tenant-1');
    expect(updated.partner_name).toBe('Bella POS Partner v2');
    expect(rotated).toEqual({
      partner: expect.objectContaining({
        api_key: 'pk_test_rotated',
        metadata: expect.objectContaining({
          previous_key_rotated: true,
        }),
      }),
      new_api_key: 'pk_test_rotated',
    });
    expect(withAddedScope.allowed_scopes).toEqual(['order:read', 'payment:read', 'order:write']);
    expect(withRemovedScope.allowed_scopes).toEqual(['order:read', 'order:write']);
    expect(deleted).toBe(true);

    expect(mockRpc).toHaveBeenNthCalledWith(1, 'generate_api_key', { is_test: true });
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'generate_api_key', { is_test: true });
    expect(calls[0]).toEqual(expect.objectContaining({
      table: 'api_partners',
      op: 'insert',
      payload: expect.objectContaining({
        tenant_id: 'tenant-1',
        api_key: 'pk_test_generated',
        allowed_scopes: ['order:read', 'payment:read'],
        created_by: 'admin-1',
        updated_by: 'admin-1',
      }),
    }));
    expect(calls[1].filters).toEqual([
      { method: 'eq', args: ['tenant_id', 'tenant-1'] },
      { method: 'eq', args: ['partner_type', 'pos'] },
      { method: 'eq', args: ['is_active', true] },
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'range', args: [20, 29] },
    ]);
    expect(calls[2].filters).toEqual([
      { method: 'eq', args: ['id', 'partner-1'] },
      { method: 'eq', args: ['tenant_id', 'tenant-1'] },
    ]);
    expect(calls[4]).toEqual(expect.objectContaining({
      table: 'api_partners',
      op: 'update',
      payload: expect.objectContaining({
        partner_name: 'Bella POS Partner v2',
        updated_by: 'admin-2',
        updated_at: '2026-06-19T08:00:00.000Z',
      }),
    }));
    expect(calls[6].payload).toEqual(expect.objectContaining({
      api_key: 'pk_test_rotated',
      updated_by: 'admin-3',
      metadata: {
        source: 'test',
        api_key_regenerated_at: '2026-06-19T08:00:00.000Z',
        previous_key_rotated: true,
      },
    }));
    expect(calls[11]).toEqual({
      table: 'api_partners',
      op: 'update',
      payload: { is_active: false },
      filters: [{ method: 'eq', args: ['id', 'partner-1'] }],
    });
  });

  it('rejects partners without scopes before writing or generating a key', async () => {
    installScriptedSupabase([]);

    await expect(createPartner({
      tenant_id: 'tenant-1',
      partner_name: 'No Scope Partner',
      partner_type: 'other',
      allowed_scopes: [],
    })).rejects.toMatchObject({
      name: 'APIError',
      code: 'VAL_001',
      statusCode: 400,
    });

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns null for tenant-filtered partner lookups that miss', async () => {
    const calls = installScriptedSupabase([
      { table: 'api_partners', op: 'select', error: { code: 'PGRST116', message: 'No rows found' } },
    ]);

    await expect(getPartnerById('partner-missing', 'tenant-1')).resolves.toBeNull();
    expect(calls[0].filters).toEqual([
      { method: 'eq', args: ['id', 'partner-missing'] },
      { method: 'eq', args: ['tenant_id', 'tenant-1'] },
    ]);
  });

  it('blocks removing the last partner scope', async () => {
    installScriptedSupabase([
      { table: 'api_partners', op: 'select', data: { ...partnerBase, allowed_scopes: ['order:read'] } },
    ]);

    await expect(removeScopes('partner-1', ['order:read'])).rejects.toMatchObject({
      name: 'APIError',
      code: 'VAL_001',
      statusCode: 400,
    });
    expect(mockFrom).toHaveBeenCalledWith('api_partners');
  });

  it('surfaces duplicate API key violations as explicit partner create failures', async () => {
    installScriptedSupabase([
      {
        table: 'api_partners',
        op: 'insert',
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      },
    ]);

    await expect(createPartner({
      tenant_id: 'tenant-1',
      partner_name: 'Duplicate Key Partner',
      partner_type: 'pos',
      api_key: 'pk_test_existing',
      allowed_scopes: ['order:read'],
    })).rejects.toMatchObject({
      name: 'APIError',
      code: 'VAL_003',
      statusCode: 409,
    });
  });
});
