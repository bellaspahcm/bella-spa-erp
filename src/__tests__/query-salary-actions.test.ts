import { getKtvSessionMatrix } from '../modules/hr-salary/actions/query-salary-actions';

const mockFrom = jest.fn();
const mockNoStore = jest.fn();

jest.mock('next/cache', () => ({
  unstable_noStore: () => mockNoStore(),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: mockFrom,
  })),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn(),
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

  gte(field: string, value: unknown) {
    this.call?.filters.push({ field, value });
    return this;
  }

  lt(field: string, value: unknown) {
    this.call?.filters.push({ field, value });
    return this;
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

describe('getKtvSessionMatrix query errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns package columns and KTV rows when all matrix queries succeed', async () => {
    const calls = setupDb([
      { table: 'users', op: 'select', data: [{ id: 'ktv-1', full_name: 'KTV One' }] },
      { table: 'salary_records', op: 'select', data: [{ ktv_id: 'ktv-1', total_sessions: 1, status: 'pending_approval' }] },
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
            packages: { name: 'Combo A' },
          },
        }],
      },
      { table: 'packages', op: 'select', data: [{ name: 'Combo A' }] },
    ]);

    const result = await getKtvSessionMatrix();

    expect(result.packageNames).toEqual(['Combo A', 'Dịch vụ lẻ']);
    expect(result.ktvs).toEqual([{
      id: 'ktv-1',
      name: 'KTV One',
      isConfirmed: true,
      'Combo A': 1,
      'Dịch vụ lẻ': 0,
    }]);
    expect(mockNoStore).toHaveBeenCalled();
    expect(calls[2].filters).toEqual([
      { field: 'status', value: 'completed' },
      { field: 'completed_date', value: '2026-06-01' },
      { field: 'completed_date', value: '2026-07-01' },
    ]);
  });

  it('throws instead of returning an empty matrix when the session query fails', async () => {
    const calls = setupDb([
      { table: 'users', op: 'select', data: [{ id: 'ktv-1', full_name: 'KTV One' }] },
      { table: 'salary_records', op: 'select', data: [] },
      { table: 'session_logs', op: 'select', error: { message: 'session query failed' } },
    ]);

    await expect(getKtvSessionMatrix()).rejects.toThrow('getKtvSessionMatrix session_logs query failed: session query failed');
    expect(calls).toHaveLength(3);
  });

  it('throws instead of returning partial data when the packages query fails', async () => {
    setupDb([
      { table: 'users', op: 'select', data: [{ id: 'ktv-1', full_name: 'KTV One' }] },
      { table: 'salary_records', op: 'select', data: [] },
      { table: 'session_logs', op: 'select', data: [] },
      { table: 'packages', op: 'select', error: { message: 'packages query failed' } },
    ]);

    await expect(getKtvSessionMatrix()).rejects.toThrow('getKtvSessionMatrix packages query failed: packages query failed');
  });
});
