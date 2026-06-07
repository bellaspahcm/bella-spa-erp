import { recalculateAndSaveSalaryRecordEngine } from '@/modules/hr-salary/actions/salary-recalculation-engine';

jest.mock('@/modules/hr-salary/actions/base-salary-actions', () => ({
  calcProRataBaseSalary: jest.fn(async () => 0),
}));

type DbOperation = 'select' | 'update' | 'insert';

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
    this.startCall('select', payload);
    return this;
  }

  update(payload: unknown) {
    this.startCall('update', payload);
    return this;
  }

  insert(payload: unknown) {
    this.startCall('insert', payload);
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

  single() {
    return this.resolve();
  }

  maybeSingle() {
    return this.resolve();
  }

  then(onfulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) {
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
    return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
  }
}

const savedPublishedRecord = {
  id: 'salary-1',
  ktv_id: 'ktv-1',
  month_year: '2026-06-01',
  tenant_id: 'tenant-1',
  status: 'published',
  is_locked: false,
  total_sessions: 4,
  base_salary: 6_000_000,
  session_bonus: 400_000,
  rating_bonus: 75_000,
  kpi_bonus: 500_000,
  violations_deduction: 100_000,
  service_percentage_bonus: 50_000,
  total_salary: 6_825_000,
  published_at: '2026-06-06T00:00:00.000Z',
  notes: 'saved payroll snapshot',
};

function baseScripts(existingRecord: unknown, includeWrite = true): ScriptedResult[] {
  return [
    {
      table: 'users',
      op: 'select',
      data: {
        id: 'ktv-1',
        full_name: 'KTV One',
        base_salary: 9_000_000,
        resignation_date: null,
      },
    },
    { table: 'tenants', op: 'select', data: { salary_config: null } },
    {
      table: 'attendance',
      op: 'select',
      data: [
        { status: 'present', date: '2026-06-03' },
        { status: 'present', date: '2026-06-04' },
      ],
    },
    {
      table: 'session_logs',
      op: 'select',
      data: [
        {
          id: 'session-1',
          rating: 5,
          bookings: { ktv_commission: 300_000, package_name: 'VIP Package' },
          session_reviews: [{ rating: 5, status: 'published' }],
        },
        {
          id: 'session-2',
          rating: 5,
          bookings: { ktv_commission: 300_000, package_name: 'VIP Package' },
          session_reviews: [{ rating: 5, status: 'published' }],
        },
      ],
    },
    { table: 'packages', op: 'select', data: [{ name: 'VIP Package', session_multiplier: 2 }] },
    { table: 'kpi_records', op: 'select', data: [{ bonus_amount: 999_000 }] },
    { table: 'salary_records', op: 'select', data: existingRecord },
    ...(includeWrite ? [{ table: 'salary_records', op: 'update', data: null } satisfies ScriptedResult] : []),
  ];
}

function setupEngineDb(scripts: ScriptedResult[]) {
  const calls: DbCall[] = [];
  const supabase = {
    from: jest.fn((table: string) => new ScriptedQueryBuilder(table, scripts, calls)),
    rpc: jest.fn(() => Promise.resolve({
      data: [{
        ktv_id: 'ktv-1',
        average_rating: 5,
        late_days: 2,
        absent_days: 0,
      }],
      error: null,
    })),
  };

  return { supabase, calls };
}

function salaryUpdatePayload(calls: DbCall[]) {
  return calls.find((call) => call.table === 'salary_records' && call.op === 'update')?.payload as Record<string, unknown> | undefined;
}

describe('recalculateAndSaveSalaryRecordEngine lifecycle guards', () => {
  it('preserves saved published financials when live sessions, KPI, and attendance change later', async () => {
    const { supabase, calls } = setupEngineDb(baseScripts(savedPublishedRecord));

    const result = await recalculateAndSaveSalaryRecordEngine(
      supabase as never,
      'ktv-1',
      '2026-06-01',
      'tenant-1',
    );

    expect(result.totalSalary).toBe(6_825_000);
    expect(salaryUpdatePayload(calls)).toMatchObject({
      status: 'published',
      total_sessions: 4,
      base_salary: 6_000_000,
      session_bonus: 400_000,
      rating_bonus: 75_000,
      kpi_bonus: 500_000,
      violations_deduction: 100_000,
      service_percentage_bonus: 50_000,
      total_salary: 6_825_000,
      notes: 'saved payroll snapshot',
    });
  });

  it('allows explicit manual financial overrides before the record is locked or finalized', async () => {
    const { supabase, calls } = setupEngineDb(baseScripts(savedPublishedRecord));

    const result = await recalculateAndSaveSalaryRecordEngine(
      supabase as never,
      'ktv-1',
      '2026-06-01',
      'tenant-1',
      {
        base_salary: 5_000_000,
        kpi_bonus: 100_000,
        violations_deduction: 50_000,
        service_percentage_bonus: 0,
        status: 'pending_approval',
      },
    );

    expect(result.totalSalary).toBe(5_525_000);
    expect(salaryUpdatePayload(calls)).toMatchObject({
      status: 'pending_approval',
      total_sessions: 4,
      base_salary: 5_000_000,
      session_bonus: 400_000,
      rating_bonus: 75_000,
      kpi_bonus: 100_000,
      violations_deduction: 50_000,
      service_percentage_bonus: 0,
      total_salary: 5_525_000,
    });
  });

  it('blocks recalculation for locked salary records', async () => {
    const lockedRecord = { ...savedPublishedRecord, is_locked: true };
    const { supabase, calls } = setupEngineDb(baseScripts(lockedRecord, false));

    await expect(recalculateAndSaveSalaryRecordEngine(
      supabase as never,
      'ktv-1',
      '2026-06-01',
      'tenant-1',
    )).rejects.toThrow('Cannot recalculate locked salary record');

    expect(salaryUpdatePayload(calls)).toBeUndefined();
  });

  it('blocks recalculation for finalized salary records even when the period has not been month-locked yet', async () => {
    const finalizedRecord = { ...savedPublishedRecord, status: 'finalized', is_locked: false };
    const { supabase, calls } = setupEngineDb(baseScripts(finalizedRecord, false));

    await expect(recalculateAndSaveSalaryRecordEngine(
      supabase as never,
      'ktv-1',
      '2026-06-01',
      'tenant-1',
      { base_salary: 1 },
    )).rejects.toThrow('Cannot recalculate finalized salary record');

    expect(salaryUpdatePayload(calls)).toBeUndefined();
  });
});
