import { getKtvSessionMatrix, getSalaryData } from '../modules/hr-salary/actions/query-salary-actions';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockNoStore = jest.fn();

jest.mock('next/cache', () => ({
  unstable_noStore: () => mockNoStore(),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('../modules/hr-salary/actions/base-salary-actions', () => ({
  calcProRataBaseSalary: jest.fn(),
}));

type DbOperation = 'select';

type ScriptedResult = {
  table: string;
  op: DbOperation;
  data?: unknown;
  error?: { message: string };
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
    this.call = { table: this.table, op: 'select', payload, filters: [] };
    this.calls.push(this.call);
    return this;
  }

  eq(field: string, value: unknown) {
    this.call?.filters.push({ field, value });
    return this;
  }

  in(field: string, value: unknown) {
    this.call?.filters.push({ field, value });
    return this;
  }

  gte(field: string, value: unknown) {
    this.call?.filters.push({ field, value });
    return this;
  }

  lt(field: string, value: unknown) {
    this.call?.filters.push({ field, value });
    return this;
  }

  single() {
    return this.resolve();
  }

  maybeSingle() {
    return this.resolve();
  }

  then(onfulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) {
    return this.resolve().then(onfulfilled);
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
  return calls;
}

describe('getSalaryData query errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T08:00:00.000Z'));
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
    mockRpc.mockResolvedValue({
      data: [{
        ktv_id: 'ktv-1',
        average_rating: 5,
        late_days: 0,
        absent_days: 0,
        total_kpi_bonus: null,
      }],
      error: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns computed salary rows when all salary queries succeed', async () => {
    const calls = setupDb([
      { table: 'tenants', op: 'select', data: { salary_config: null } },
      { table: 'tenant_payroll_config', op: 'select', data: null },
      {
        table: 'users',
        op: 'select',
        data: [{
          id: 'ktv-1',
          full_name: 'KTV One',
          role: 'ktv',
          base_salary: 2600000,
          hire_date: '2026-01-01',
          resignation_date: null,
          status: 'active',
        }],
      },
      { table: 'salary_records', op: 'select', data: [] },
      {
        table: 'session_logs',
        op: 'select',
        data: [{
          id: 'session-1',
          completed_by_ktv_id: 'ktv-1',
          status: 'completed',
          is_confirmed: false,
          rating: 5,
          bookings: { ktv_commission: 200000, package_name: 'Combo VIP' },
          session_reviews: [],
        }],
      },
      {
        table: 'attendance',
        op: 'select',
        data: [{ id: 'att-1', ktv_id: 'ktv-1', date: '2026-06-02', status: 'present' }],
      },
      { table: 'packages', op: 'select', data: [{ name: 'Combo VIP', session_multiplier: 1.5 }] },
      { table: 'kpi_records', op: 'select', data: [{ ktv_id: 'ktv-1', bonus_amount: 123000 }] },
      { table: 'product_sales', op: 'select', data: [] },
      { table: 'booking_service_items', op: 'select', data: [] },
      { table: 'salary_adjustments', op: 'select', data: [] },
    ]);

    const result = await getSalaryData();

    expect(result).toEqual([expect.objectContaining({
      id: 'ktv-1',
      name: 'KTV One',
      sessions: 1.5,
      baseSalary: 100000,
      sessionBonus: 200000,
      ratingBonus: 75000,
      kpiBonus: 123000,
      totalSalary: 498000,
      actualDays: 1,
    })]);
    expect(mockRpc).toHaveBeenCalledWith('get_ktv_leaderboard', {
      p_tenant_id: 'tenant-1',
      p_month: '2026-06-01',
    });
    expect(calls[2].filters).toEqual([
      { field: 'role', value: 'ktv' },
      { field: 'tenant_id', value: 'tenant-1' },
    ]);
    expect(calls[4].filters).toContainEqual({ field: 'tenant_id', value: 'tenant-1' });
    expect(calls[5].filters).toContainEqual({ field: 'tenant_id', value: 'tenant-1' });
  });

  it('does not default draft salary rows to full-month attendance when no attendance logs exist', async () => {
    setupDb([
      { table: 'tenants', op: 'select', data: { salary_config: null } },
      { table: 'tenant_payroll_config', op: 'select', data: null },
      {
        table: 'users',
        op: 'select',
        data: [{
          id: 'ktv-1',
          full_name: 'KTV One',
          role: 'ktv',
          base_salary: 2600000,
          hire_date: '2026-01-01',
          resignation_date: null,
          status: 'active',
        }],
      },
      { table: 'salary_records', op: 'select', data: [] },
      { table: 'session_logs', op: 'select', data: [] },
      { table: 'attendance', op: 'select', data: [] },
      { table: 'packages', op: 'select', data: [] },
      { table: 'kpi_records', op: 'select', data: [] },
      { table: 'product_sales', op: 'select', data: [] },
      { table: 'booking_service_items', op: 'select', data: [] },
      { table: 'salary_adjustments', op: 'select', data: [] },
    ]);

    const result = await getSalaryData();

    expect(result).toEqual([expect.objectContaining({
      id: 'ktv-1',
      baseSalary: 0,
      totalSalary: 0,
      actualDays: 0,
      status: 'draft',
    })]);
  });

  it('preserves saved non-draft salary amounts while showing live attendance days', async () => {
    setupDb([
      { table: 'tenants', op: 'select', data: { salary_config: null } },
      { table: 'tenant_payroll_config', op: 'select', data: null },
      {
        table: 'users',
        op: 'select',
        data: [{
          id: 'ktv-1',
          full_name: 'KTV One',
          role: 'ktv',
          base_salary: 2600000,
          hire_date: '2026-01-01',
          resignation_date: null,
          status: 'active',
        }],
      },
      {
        table: 'salary_records',
        op: 'select',
        data: [{
          ktv_id: 'ktv-1',
          total_sessions: 0,
          session_bonus: 111000,
          rating_bonus: 222000,
          base_salary: 2600000,
          kpi_bonus: 0,
          violations_deduction: 0,
          service_percentage_bonus: 0,
          total_salary: 2933000,
          status: 'published',
        }],
      },
      { table: 'session_logs', op: 'select', data: [] },
      { table: 'attendance', op: 'select', data: [] },
      { table: 'packages', op: 'select', data: [] },
      { table: 'kpi_records', op: 'select', data: [] },
      { table: 'product_sales', op: 'select', data: [] },
      { table: 'booking_service_items', op: 'select', data: [] },
      { table: 'salary_adjustments', op: 'select', data: [] },
    ]);

    const result = await getSalaryData();

    expect(result).toEqual([expect.objectContaining({
      id: 'ktv-1',
      baseSalary: 2600000,
      sessionBonus: 111000,
      ratingBonus: 222000,
      totalSalary: 2933000,
      actualDays: 0,
      status: 'published',
    })]);
  });

  it('throws instead of returning an empty salary list when a required query fails', async () => {
    setupDb([
      { table: 'tenants', op: 'select', data: { salary_config: null } },
      { table: 'tenant_payroll_config', op: 'select', data: null },
      { table: 'users', op: 'select', error: { message: 'users query failed' } },
    ]);

    await expect(getSalaryData()).rejects.toThrow('[getSalaryData] users query failed: users query failed');
  });

  it('throws before querying when the current user has no tenant', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', role: 'admin', tenant_id: null });
    const calls = setupDb([]);

    await expect(getSalaryData()).rejects.toThrow('[getSalaryData] Missing tenantId for current user');
    expect(calls).toHaveLength(0);
  });
});

describe('getKtvSessionMatrix query errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T08:00:00.000Z'));
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns package columns and KTV rows when all matrix queries succeed', async () => {
    const calls = setupDb([
      { table: 'tenants', op: 'select', data: { enabled_modules: ['beauty_spa'] } },
      { table: 'users', op: 'select', data: [{ id: 'ktv-1', full_name: 'KTV One' }] },
      { table: 'salary_records', op: 'select', data: [{ ktv_id: 'ktv-1', total_sessions: 1.5, status: 'pending_approval' }] },
      {
        table: 'session_logs',
        op: 'select',
        data: [{
          id: 'session-1',
          completed_by_ktv_id: 'ktv-1',
          status: 'completed',
          is_confirmed: true,
          bookings: {
            id: 'booking-1',
            package_name: 'Combo A',
            full_price: 1000000,
            packages: { name: 'Combo A', session_multiplier: 1.5 },
          },
        }],
      },
      { table: 'packages', op: 'select', data: [{ name: 'Combo A', session_multiplier: 1.5 }] },
    ]);

    const result = await getKtvSessionMatrix();

    expect(result.packageNames).toEqual(['Combo A', 'Dịch vụ lẻ']);
    expect(result.ktvs).toEqual([{
      id: 'ktv-1',
      name: 'KTV One',
      isConfirmed: true,
      'Combo A': 1.5,
      'Dịch vụ lẻ': 0,
    }]);
    expect(mockNoStore).toHaveBeenCalled();
    expect(calls[3].filters).toEqual([
      { field: 'status', value: 'completed' },
      { field: 'completed_date', value: '2026-06-01' },
      { field: 'completed_date', value: '2026-07-01' },
      { field: 'tenant_id', value: 'tenant-1' },
    ]);
    expect(calls[4].filters).toContainEqual({ field: 'tenant_id', value: 'tenant-1' });
  });

  it('throws instead of returning an empty matrix when the session query fails', async () => {
    const calls = setupDb([
      { table: 'tenants', op: 'select', data: { enabled_modules: ['beauty_spa'] } },
      { table: 'users', op: 'select', data: [{ id: 'ktv-1', full_name: 'KTV One' }] },
      { table: 'salary_records', op: 'select', data: [] },
      { table: 'session_logs', op: 'select', error: { message: 'session query failed' } },
    ]);

    await expect(getKtvSessionMatrix()).rejects.toThrow('getKtvSessionMatrix session_logs query failed: session query failed');
    expect(calls).toHaveLength(4);
  });

  it('throws instead of returning partial data when the packages query fails', async () => {
    setupDb([
      { table: 'tenants', op: 'select', data: { enabled_modules: ['beauty_spa'] } },
      { table: 'users', op: 'select', data: [{ id: 'ktv-1', full_name: 'KTV One' }] },
      { table: 'salary_records', op: 'select', data: [] },
      { table: 'session_logs', op: 'select', data: [] },
      { table: 'packages', op: 'select', error: { message: 'packages query failed' } },
    ]);

    await expect(getKtvSessionMatrix()).rejects.toThrow('getKtvSessionMatrix packages query failed: packages query failed');
  });
});
