import { confirmKtvSessions, updateSalaryConfig } from '../modules/hr-salary/actions/admin-salary-actions';

const mockFrom = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockRecordAuditLog = jest.fn();
const mockCheckMonthLock = jest.fn();
const mockRevalidatePath = jest.fn();
const mockRecalculateAndSaveSalaryRecordEngine = jest.fn();

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: mockFrom,
  })),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: (payload: unknown) => mockRecordAuditLog(payload),
  checkMonthLock: (month?: string) => mockCheckMonthLock(month),
}));

jest.mock('@/services/accounting/period-guards', () => ({
  assertOpenAccountingPeriod: jest.fn(),
}));

jest.mock('@/services/accounting/template-rules', () => ({
  findMissingRequiredFields: jest.fn(() => []),
  inferBusinessEventType: jest.fn(() => 'salary_payment'),
}));

jest.mock('../modules/hr-salary/actions/salary-recalculation-engine', () => ({
  recalculateAndSaveSalaryRecordEngine: (...args: unknown[]) => mockRecalculateAndSaveSalaryRecordEngine(...args),
}));

type DbOperation = 'select' | 'update' | 'delete';

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

  select() {
    this.startCall('select');
    return this;
  }

  update(payload: unknown) {
    this.startCall('update', payload);
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

const salarySnapshot = {
  accounting_metadata: { source: 'previous' },
  accounting_review_status: 'UNREVIEWED',
  accounting_template_id: 'template-1',
  base_salary: 5000000,
  business_event_type: 'salary_payment',
  confirmed_by_admin: false,
  dispute_reason: null,
  dispute_resolved_at: null,
  finalized_at: null,
  id: 'salary-1',
  is_locked: false,
  kpi_bonus: 300000,
  ktv_confirmed_at: null,
  ktv_id: 'ktv-1',
  month_year: '2026-06-01',
  notes: 'previous notes',
  paid_date: null,
  paid_method: null,
  published_at: null,
  rating_bonus: 100000,
  service_percentage_bonus: 200000,
  session_bonus: 900000,
  status: 'draft',
  tenant_id: 'tenant-1',
  total_salary: 6100000,
  total_sessions: 12.5,
  violations_deduction: 100000,
};

function setupDb(scripts: ScriptedResult[]) {
  const calls: DbCall[] = [];
  mockFrom.mockImplementation((table: string) => new ScriptedQueryBuilder(table, scripts, calls));
  return calls;
}

describe('updateSalaryConfig audit rollback', () => {
  const payload = { baseSalary: 6000000, kpiBonus: 500000, deductions: 150000, advances: 250000 };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T08:00:00.000Z'));
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
      full_name: 'Admin Bella',
    });
    mockCheckMonthLock.mockResolvedValue({ isLocked: false });
    mockRecordAuditLog.mockResolvedValue({ success: true });
    mockRecalculateAndSaveSalaryRecordEngine.mockResolvedValue({ totalSalary: 6500000 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('records old and new salary data when audit succeeds', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: salarySnapshot },
    ]);

    const result = await updateSalaryConfig('ktv-1', payload);

    expect(result).toEqual({ success: true });
    expect(mockRecalculateAndSaveSalaryRecordEngine).toHaveBeenCalledWith(
      expect.anything(),
      'ktv-1',
      '2026-06-01',
      'tenant-1',
      {
        base_salary: 6000000,
        kpi_bonus: 500000,
        violations_deduction: 150000,
        service_percentage_bonus: 250000,
        status: 'pending_approval',
      }
    );
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'salary_records',
      record_id: 'ktv-1',
      old_data: salarySnapshot,
      new_data: payload,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/salary');
    expect(calls).toHaveLength(1);
  });

  it('restores the previous salary row when audit fails after recalculation', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: salarySnapshot },
      { table: 'salary_records', op: 'update', data: salarySnapshot },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit insert failed'));

    const result = await updateSalaryConfig('ktv-1', payload);

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit insert failed');
    expect(calls[1]).toEqual({
      table: 'salary_records',
      op: 'update',
      payload: salarySnapshot,
      filters: [{ field: 'id', value: 'salary-1' }],
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('deletes the generated current-month row when audit fails and no prior row existed', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: null },
      { table: 'salary_records', op: 'delete', data: null },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit insert failed'));

    const result = await updateSalaryConfig('ktv-1', payload);

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit insert failed');
    expect(calls[1]).toEqual({
      table: 'salary_records',
      op: 'delete',
      payload: undefined,
      filters: [
        { field: 'ktv_id', value: 'ktv-1' },
        { field: 'month_year', value: '2026-06-01' },
        { field: 'tenant_id', value: 'tenant-1' },
      ],
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('reports rollback failure when restoring the previous salary row fails', async () => {
    setupDb([
      { table: 'salary_records', op: 'select', data: salarySnapshot },
      { table: 'salary_records', op: 'update', error: { message: 'restore failed' } },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit insert failed'));

    const result = await updateSalaryConfig('ktv-1', payload);

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit insert failed');
    expect(result.error).toContain('restore failed');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('does not audit or rollback when salary recalculation fails', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: salarySnapshot },
    ]);
    mockRecalculateAndSaveSalaryRecordEngine.mockRejectedValue(new Error('recalc failed'));

    const result = await updateSalaryConfig('ktv-1', payload);

    expect(result.success).toBe(false);
    expect(result.error).toContain('recalc failed');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe('confirmKtvSessions salary rollback', () => {
  const sessionSnapshots = [
    { id: 'session-1', is_confirmed: false },
    { id: 'session-2', is_confirmed: null },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T08:00:00.000Z'));
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
      full_name: 'Admin Bella',
    });
    mockCheckMonthLock.mockResolvedValue({ isLocked: false });
    mockRecordAuditLog.mockResolvedValue({ success: true });
    mockRecalculateAndSaveSalaryRecordEngine.mockResolvedValue({ totalSalary: 6500000 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('confirms sessions and recalculates salary when all side effects succeed', async () => {
    const calls = setupDb([
      { table: 'session_logs', op: 'select', data: sessionSnapshots },
      { table: 'session_logs', op: 'update', data: null },
    ]);

    const result = await confirmKtvSessions('ktv-1', 12.5);

    expect(result).toEqual({ success: true });
    expect(calls[0]).toEqual({
      table: 'session_logs',
      op: 'select',
      payload: undefined,
      filters: [
        { field: 'completed_by_ktv_id', value: 'ktv-1' },
        { field: 'status', value: 'completed' },
      ],
    });
    expect(calls[1]).toEqual({
      table: 'session_logs',
      op: 'update',
      payload: { is_confirmed: true },
      filters: [
        { field: 'completed_by_ktv_id', value: 'ktv-1' },
        { field: 'status', value: 'completed' },
      ],
    });
    expect(mockRecalculateAndSaveSalaryRecordEngine).toHaveBeenCalledWith(
      expect.anything(),
      'ktv-1',
      '2026-06-01',
      'tenant-1',
      {
        total_sessions: 12.5,
        status: 'pending_approval',
      }
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/salary');
  });

  it('restores previous session confirmation states when salary recalculation fails', async () => {
    const calls = setupDb([
      { table: 'session_logs', op: 'select', data: sessionSnapshots },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'session_logs', op: 'update', data: null },
    ]);
    mockRecalculateAndSaveSalaryRecordEngine.mockRejectedValue(new Error('recalc failed'));

    const result = await confirmKtvSessions('ktv-1', 12.5);

    expect(result.success).toBe(false);
    expect(result.error).toContain('recalc failed');
    expect(calls[2]).toEqual({
      table: 'session_logs',
      op: 'update',
      payload: { is_confirmed: false },
      filters: [{ field: 'id', value: 'session-1' }],
    });
    expect(calls[3]).toEqual({
      table: 'session_logs',
      op: 'update',
      payload: { is_confirmed: null },
      filters: [{ field: 'id', value: 'session-2' }],
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('reports rollback failure when restoring session confirmation state fails', async () => {
    setupDb([
      { table: 'session_logs', op: 'select', data: sessionSnapshots },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'session_logs', op: 'update', error: { message: 'restore session failed' } },
      { table: 'session_logs', op: 'update', data: null },
    ]);
    mockRecalculateAndSaveSalaryRecordEngine.mockRejectedValue(new Error('recalc failed'));

    const result = await confirmKtvSessions('ktv-1', 12.5);

    expect(result.success).toBe(false);
    expect(result.error).toContain('recalc failed');
    expect(result.error).toContain('restore session failed');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('does not recalculate salary when session confirmation update fails', async () => {
    setupDb([
      { table: 'session_logs', op: 'select', data: sessionSnapshots },
      { table: 'session_logs', op: 'update', error: { message: 'session update failed' } },
    ]);

    const result = await confirmKtvSessions('ktv-1', 12.5);

    expect(result.success).toBe(false);
    expect(result.error).toContain('session update failed');
    expect(mockRecalculateAndSaveSalaryRecordEngine).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
