import { PayrollConfigService } from '../services/payroll-config.service';

const mockCreateClient = jest.fn();
const mockCreateDevelopmentBypassClient = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
}));

jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: () => mockCreateDevelopmentBypassClient(),
}));

type DbOperation = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

type ScriptedResult = {
  table: string;
  op: DbOperation;
  data?: unknown;
  error?: { message: string; code?: string };
};

type DbCall = {
  table: string;
  op: DbOperation;
  payload?: unknown;
  filters: Array<{ field: string; value: unknown }>;
};

class ScriptedQueryBuilder {
  private call: DbCall | null = null;

  constructor(
    private table: string,
    private scripts: ScriptedResult[],
    private calls: DbCall[],
  ) {}

  select(payload?: unknown) {
    this.startCall('select', payload);
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

  upsert(payload: unknown) {
    this.startCall('upsert', payload);
    return this;
  }

  delete() {
    this.startCall('delete');
    return this;
  }

  eq(field: string, value: unknown) {
    this.call?.filters.push({ field, value });
    return this;
  }

  single() {
    return this.resolve();
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
    return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
  }
}

function setupDb(scripts: ScriptedResult[]) {
  const calls: DbCall[] = [];
  mockFrom.mockImplementation((table: string) => new ScriptedQueryBuilder(table, scripts, calls));
  mockCreateDevelopmentBypassClient.mockResolvedValue({ from: mockFrom });
  mockCreateClient.mockResolvedValue({ from: mockFrom });
  return calls;
}

describe('PayrollConfigService provider lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PayrollConfigService.resetInstance();
  });

  it('returns persisted tenant commission config instead of the default fallback', async () => {
    const calls = setupDb([{
      table: 'tenant_payroll_config',
      op: 'select',
      data: {
        enabled: true,
        strategy: 'fixed',
        config: { rate: 135000, minSessions: 0 },
      },
    }]);

    const result = await PayrollConfigService.getInstance().getProviderConfig('tenant-haircut', 'commission');

    expect(result).toEqual({
      enabled: true,
      strategy: 'fixed',
      config: { rate: 135000, minSessions: 0 },
    });
    expect(result.config).not.toEqual(expect.objectContaining({ rate: 120000 }));
    expect(mockCreateDevelopmentBypassClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(calls).toEqual([{
      table: 'tenant_payroll_config',
      op: 'select',
      payload: 'enabled, strategy, config',
      filters: [
        { field: 'tenant_id', value: 'tenant-haircut' },
        { field: 'provider_key', value: 'commission' },
      ],
    }]);
  });

  it('falls back to the default commission config only when tenant config is genuinely missing', async () => {
    setupDb([{
      table: 'tenant_payroll_config',
      op: 'select',
      error: { message: 'No rows', code: 'PGRST116' },
    }]);

    const result = await PayrollConfigService.getInstance().getProviderConfig('tenant-missing', 'commission');

    expect(result).toEqual({
      enabled: true,
      strategy: 'fixed',
      config: { rate: 120000, minSessions: 0 },
    });
  });

  it('does not consume a foreign tenant config row', async () => {
    const calls = setupDb([{
      table: 'tenant_payroll_config',
      op: 'select',
      error: { message: 'No rows', code: 'PGRST116' },
    }]);

    const result = await PayrollConfigService.getInstance().getProviderConfig('tenant-a', 'commission');

    expect(result.config).toEqual({ rate: 120000, minSessions: 0 });
    expect(calls[0].filters).toEqual([
      { field: 'tenant_id', value: 'tenant-a' },
      { field: 'provider_key', value: 'commission' },
    ]);
    expect(calls[0].filters).not.toContainEqual({ field: 'tenant_id', value: 'tenant-b' });
  });

  it('keeps provider_key isolation and reads attendance config through the same boundary', async () => {
    const calls = setupDb([{
      table: 'tenant_payroll_config',
      op: 'select',
      data: {
        enabled: true,
        strategy: 'combined',
        config: { latePenalty: 50000, absentPenalty: 200000, lateGracePeriod: 15 },
      },
    }]);

    const result = await PayrollConfigService.getInstance().getProviderConfig('tenant-haircut', 'attendance');

    expect(result).toEqual({
      enabled: true,
      strategy: 'combined',
      config: { latePenalty: 50000, absentPenalty: 200000, lateGracePeriod: 15 },
    });
    expect(calls[0].filters).toContainEqual({ field: 'provider_key', value: 'attendance' });
    expect(calls[0].filters).not.toContainEqual({ field: 'provider_key', value: 'commission' });
  });

  it('does not mutate payroll config during provider reads', async () => {
    const calls = setupDb([{
      table: 'tenant_payroll_config',
      op: 'select',
      data: {
        enabled: true,
        strategy: 'fixed',
        config: { rate: 135000, minSessions: 0 },
      },
    }]);

    await PayrollConfigService.getInstance().getProviderConfig('tenant-haircut', 'commission');

    expect(calls.map((call) => call.op)).toEqual(['select']);
  });
});
