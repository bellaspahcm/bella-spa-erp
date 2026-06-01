import {
  adminConfirmOnBehalf,
  approveSalary,
  checkAndAutoConfirm,
  confirmKtvSessions,
  finalizeAllSalaryRecords,
  finalizeSalaryRecord,
  publishAllSalaryRecords,
  publishSalaryRecord,
  updateSalaryConfig,
} from '../modules/hr-salary/actions/admin-salary-actions';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
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
    rpc: mockRpc,
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

type DbOperation = 'select' | 'insert' | 'update' | 'delete';

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

  insert(payload: unknown) {
    this.startCall('insert', payload);
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

  in(field: string, values: unknown[]) {
    this.call?.filters.push({ field, value: values });
    return this;
  }

  maybeSingle() {
    return this.resolve();
  }

  single() {
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

describe('publishSalaryRecord audit rollback', () => {
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

  it('publishes through the salary engine and records status audit when audit succeeds', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: salarySnapshot },
    ]);

    const result = await publishSalaryRecord('ktv-1');

    expect(result).toEqual({ success: true });
    expect(mockRecalculateAndSaveSalaryRecordEngine).toHaveBeenCalledWith(
      expect.anything(),
      'ktv-1',
      '2026-06-01',
      'tenant-1',
      { status: 'published' }
    );
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'salary_records',
      record_id: 'ktv-1',
      new_data: {
        status: 'published',
        totalSalary: 6500000,
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/salary');
    expect(calls).toHaveLength(1);
  });

  it('restores the previous salary row when publish audit fails', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: salarySnapshot },
      { table: 'salary_records', op: 'update', data: salarySnapshot },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await publishSalaryRecord('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit failed');
    expect(calls[1]).toEqual({
      table: 'salary_records',
      op: 'update',
      payload: salarySnapshot,
      filters: [{ field: 'id', value: 'salary-1' }],
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('deletes the generated row when publish audit fails and no prior row existed', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: null },
      { table: 'salary_records', op: 'delete', data: null },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await publishSalaryRecord('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit failed');
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

  it('reports rollback failure when restoring publish snapshot fails', async () => {
    setupDb([
      { table: 'salary_records', op: 'select', data: salarySnapshot },
      { table: 'salary_records', op: 'update', error: { message: 'restore failed' } },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await publishSalaryRecord('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit failed');
    expect(result.error).toContain('restore failed');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('does not audit or rollback when publish recalculation fails', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: salarySnapshot },
    ]);
    mockRecalculateAndSaveSalaryRecordEngine.mockRejectedValue(new Error('publish recalc failed'));

    const result = await publishSalaryRecord('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('publish recalc failed');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

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

describe('adminConfirmOnBehalf audit and no-op handling', () => {
  const confirmSnapshot = {
    id: 'salary-confirm-1',
    status: 'published',
    ktv_confirmed_at: null,
    confirmed_by_admin: false,
  };

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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('updates an eligible salary row and records audit data', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: confirmSnapshot },
      { table: 'salary_records', op: 'update', data: null },
    ]);

    const result = await adminConfirmOnBehalf('ktv-1');

    expect(result).toEqual({ success: true });
    expect(calls[0]).toEqual({
      table: 'salary_records',
      op: 'select',
      payload: undefined,
      filters: [
        { field: 'ktv_id', value: 'ktv-1' },
        { field: 'month_year', value: '2026-06-01' },
        { field: 'tenant_id', value: 'tenant-1' },
        { field: 'status', value: ['published', 'disputed'] },
      ],
    });
    expect(calls[1]).toEqual({
      table: 'salary_records',
      op: 'update',
      payload: {
        status: 'confirmed',
        ktv_confirmed_at: '2026-06-15T08:00:00.000Z',
        confirmed_by_admin: true,
      },
      filters: [{ field: 'id', value: 'salary-confirm-1' }],
    });
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'salary_records',
      record_id: 'salary-confirm-1',
      old_data: confirmSnapshot,
      new_data: {
        id: 'salary-confirm-1',
        status: 'confirmed',
        ktv_confirmed_at: '2026-06-15T08:00:00.000Z',
        confirmed_by_admin: true,
        confirmed_on_behalf_of_ktv_id: 'ktv-1',
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/salary');
  });

  it('returns failure without update or audit when no eligible salary row exists', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: null },
    ]);

    const result = await adminConfirmOnBehalf('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Không tìm thấy bảng lương');
    expect(calls).toHaveLength(1);
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns failure without audit when confirmation update fails', async () => {
    setupDb([
      { table: 'salary_records', op: 'select', data: confirmSnapshot },
      { table: 'salary_records', op: 'update', error: { message: 'confirm update failed' } },
    ]);

    const result = await adminConfirmOnBehalf('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('confirm update failed');
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('rolls back the status fields when audit fails after confirmation update', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: confirmSnapshot },
      { table: 'salary_records', op: 'update', data: null },
      { table: 'salary_records', op: 'update', data: null },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await adminConfirmOnBehalf('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit failed');
    expect(calls[2]).toEqual({
      table: 'salary_records',
      op: 'update',
      payload: {
        status: 'published',
        ktv_confirmed_at: null,
        confirmed_by_admin: false,
      },
      filters: [{ field: 'id', value: 'salary-confirm-1' }],
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('reports rollback failure when audit rollback fails', async () => {
    setupDb([
      { table: 'salary_records', op: 'select', data: confirmSnapshot },
      { table: 'salary_records', op: 'update', data: null },
      { table: 'salary_records', op: 'update', error: { message: 'rollback failed' } },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await adminConfirmOnBehalf('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit failed');
    expect(result.error).toContain('rollback failed');
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

describe('finalizeSalaryRecord side-effect rollback', () => {
  const confirmedSalaryRecord = {
    id: 'salary-finalize-1',
    ktv_id: 'ktv-1',
    month_year: '2026-06-01',
    status: 'confirmed',
    finalized_at: null,
    total_salary: 6500000,
    tenant_id: 'tenant-1',
    users: { full_name: 'KTV One' },
  };
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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('finalizes salary, confirms sessions, creates expense, audits, and revalidates on success', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: confirmedSalaryRecord },
      { table: 'session_logs', op: 'select', data: sessionSnapshots },
      { table: 'salary_records', op: 'update', data: null },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'expenses', op: 'insert', data: null },
    ]);

    const result = await finalizeSalaryRecord('ktv-1');

    expect(result).toEqual({ success: true });
    expect(calls[0]).toEqual({
      table: 'salary_records',
      op: 'select',
      payload: undefined,
      filters: [
        { field: 'ktv_id', value: 'ktv-1' },
        { field: 'month_year', value: '2026-06-01' },
        { field: 'tenant_id', value: 'tenant-1' },
        { field: 'status', value: 'confirmed' },
      ],
    });
    expect(calls[2]).toEqual({
      table: 'salary_records',
      op: 'update',
      payload: {
        status: 'finalized',
        finalized_at: '2026-06-15T08:00:00.000Z',
      },
      filters: [{ field: 'id', value: 'salary-finalize-1' }],
    });
    expect(calls[3]).toEqual({
      table: 'session_logs',
      op: 'update',
      payload: { is_confirmed: true },
      filters: [
        { field: 'completed_by_ktv_id', value: 'ktv-1' },
        { field: 'status', value: 'completed' },
      ],
    });
    expect(calls[4].payload).toEqual(expect.objectContaining({
      amount: 6500000,
      category: 'salary',
      status: 'submitted',
      tenant_id: 'tenant-1',
    }));
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'salary_records',
      record_id: 'ktv-1',
      new_data: {
        status: 'finalized',
        amount: 6500000,
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/salary');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/finance');
  });

  it('restores salary and sessions when session confirmation fails after finalizing salary', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: confirmedSalaryRecord },
      { table: 'session_logs', op: 'select', data: sessionSnapshots },
      { table: 'salary_records', op: 'update', data: null },
      { table: 'session_logs', op: 'update', error: { message: 'session update failed' } },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'salary_records', op: 'update', data: null },
    ]);

    const result = await finalizeSalaryRecord('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('session update failed');
    expect(calls[4]).toEqual({
      table: 'session_logs',
      op: 'update',
      payload: { is_confirmed: false },
      filters: [{ field: 'id', value: 'session-1' }],
    });
    expect(calls[5]).toEqual({
      table: 'session_logs',
      op: 'update',
      payload: { is_confirmed: null },
      filters: [{ field: 'id', value: 'session-2' }],
    });
    expect(calls[6]).toEqual({
      table: 'salary_records',
      op: 'update',
      payload: {
        status: 'confirmed',
        finalized_at: null,
      },
      filters: [{ field: 'id', value: 'salary-finalize-1' }],
    });
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('restores sessions and salary when expense creation fails after finalization updates', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: confirmedSalaryRecord },
      { table: 'session_logs', op: 'select', data: sessionSnapshots },
      { table: 'salary_records', op: 'update', data: null },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'expenses', op: 'insert', error: { message: 'expense insert failed' } },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'salary_records', op: 'update', data: null },
    ]);

    const result = await finalizeSalaryRecord('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('expense insert failed');
    expect(calls[5].payload).toEqual({ is_confirmed: false });
    expect(calls[6].payload).toEqual({ is_confirmed: null });
    expect(calls[7].payload).toEqual({
      status: 'confirmed',
      finalized_at: null,
    });
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('deletes generated expense and restores prior state when finalize audit fails', async () => {
    const calls = setupDb([
      { table: 'salary_records', op: 'select', data: confirmedSalaryRecord },
      { table: 'session_logs', op: 'select', data: sessionSnapshots },
      { table: 'salary_records', op: 'update', data: null },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'expenses', op: 'insert', data: null },
      { table: 'expenses', op: 'delete', data: null },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'salary_records', op: 'update', data: null },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await finalizeSalaryRecord('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit failed');
    expect(calls[5]).toEqual({
      table: 'expenses',
      op: 'delete',
      payload: undefined,
      filters: [
        { field: 'tenant_id', value: 'tenant-1' },
        { field: 'category', value: 'salary' },
        {
          field: 'description',
          value: expect.stringContaining('[salary_record_id:salary-finalize-1]'),
        },
      ],
    });
    expect(calls[8].payload).toEqual({
      status: 'confirmed',
      finalized_at: null,
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('reports rollback failures when audit rollback cannot fully restore state', async () => {
    setupDb([
      { table: 'salary_records', op: 'select', data: confirmedSalaryRecord },
      { table: 'session_logs', op: 'select', data: sessionSnapshots },
      { table: 'salary_records', op: 'update', data: null },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'expenses', op: 'insert', data: null },
      { table: 'expenses', op: 'delete', error: { message: 'expense delete failed' } },
      { table: 'session_logs', op: 'update', error: { message: 'session restore failed' } },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'salary_records', op: 'update', error: { message: 'salary restore failed' } },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await finalizeSalaryRecord('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit failed');
    expect(result.error).toContain('expense delete failed');
    expect(result.error).toContain('session restore failed');
    expect(result.error).toContain('salary restore failed');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe('approveSalary audit rollback', () => {
  const ktvRecord = {
    full_name: 'KTV One',
    tenant_id: 'tenant-1',
  };
  const approvedRecord = {
    id: 'salary-approved-1',
  };

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

  it('approves salary, creates expense, audits, and revalidates approved views on success', async () => {
    const calls = setupDb([
      { table: 'users', op: 'select', data: ktvRecord },
      { table: 'salary_records', op: 'select', data: salarySnapshot },
      { table: 'salary_records', op: 'select', data: approvedRecord },
      { table: 'expenses', op: 'insert', data: null },
    ]);

    const result = await approveSalary('ktv-1');

    expect(result).toEqual({ success: true });
    expect(calls[0]).toEqual({
      table: 'users',
      op: 'select',
      payload: undefined,
      filters: [
        { field: 'id', value: 'ktv-1' },
        { field: 'tenant_id', value: 'tenant-1' },
      ],
    });
    expect(calls[1]).toEqual({
      table: 'salary_records',
      op: 'select',
      payload: undefined,
      filters: [
        { field: 'ktv_id', value: 'ktv-1' },
        { field: 'month_year', value: '2026-06-01' },
        { field: 'tenant_id', value: 'tenant-1' },
      ],
    });
    expect(mockRecalculateAndSaveSalaryRecordEngine).toHaveBeenCalledWith(
      expect.anything(),
      'ktv-1',
      '2026-06-01',
      'tenant-1',
      { status: 'approved' }
    );
    expect(calls[2]).toEqual({
      table: 'salary_records',
      op: 'select',
      payload: undefined,
      filters: [
        { field: 'ktv_id', value: 'ktv-1' },
        { field: 'month_year', value: '2026-06-01' },
        { field: 'tenant_id', value: 'tenant-1' },
      ],
    });
    expect(calls[3].payload).toEqual(expect.objectContaining({
      amount: 6500000,
      category: 'salary',
      status: 'submitted',
      tenant_id: 'tenant-1',
      description: expect.stringContaining('[salary_record_id:salary-approved-1]'),
    }));
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'salary_records',
      record_id: 'ktv-1',
      new_data: {
        status: 'approved',
        amount: 6500000,
        ktv_name: 'KTV One',
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/finance', 'page');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/salary', 'page');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('restores the previous salary row when approved record fetch fails after recalculation', async () => {
    const calls = setupDb([
      { table: 'users', op: 'select', data: ktvRecord },
      { table: 'salary_records', op: 'select', data: salarySnapshot },
      { table: 'salary_records', op: 'select', error: { message: 'approved row fetch failed' } },
      { table: 'salary_records', op: 'update', data: null },
    ]);

    const result = await approveSalary('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('approved row fetch failed');
    expect(calls[3]).toEqual({
      table: 'salary_records',
      op: 'update',
      payload: salarySnapshot,
      filters: [{ field: 'id', value: 'salary-1' }],
    });
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('restores the previous salary row when expense creation fails after approval', async () => {
    const calls = setupDb([
      { table: 'users', op: 'select', data: ktvRecord },
      { table: 'salary_records', op: 'select', data: salarySnapshot },
      { table: 'salary_records', op: 'select', data: approvedRecord },
      { table: 'expenses', op: 'insert', error: { message: 'expense insert failed' } },
      { table: 'salary_records', op: 'update', data: null },
    ]);

    const result = await approveSalary('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('expense insert failed');
    expect(calls[4]).toEqual({
      table: 'salary_records',
      op: 'update',
      payload: salarySnapshot,
      filters: [{ field: 'id', value: 'salary-1' }],
    });
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('deletes generated expense and restores salary row when approval audit fails', async () => {
    const calls = setupDb([
      { table: 'users', op: 'select', data: ktvRecord },
      { table: 'salary_records', op: 'select', data: salarySnapshot },
      { table: 'salary_records', op: 'select', data: approvedRecord },
      { table: 'expenses', op: 'insert', data: null },
      { table: 'expenses', op: 'delete', data: null },
      { table: 'salary_records', op: 'update', data: null },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await approveSalary('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit failed');
    expect(calls[4]).toEqual({
      table: 'expenses',
      op: 'delete',
      payload: undefined,
      filters: [
        { field: 'tenant_id', value: 'tenant-1' },
        { field: 'category', value: 'salary' },
        {
          field: 'description',
          value: expect.stringContaining('[salary_record_id:salary-approved-1]'),
        },
      ],
    });
    expect(calls[5]).toEqual({
      table: 'salary_records',
      op: 'update',
      payload: salarySnapshot,
      filters: [{ field: 'id', value: 'salary-1' }],
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('reports rollback failures when approval audit rollback cannot fully restore state', async () => {
    setupDb([
      { table: 'users', op: 'select', data: ktvRecord },
      { table: 'salary_records', op: 'select', data: salarySnapshot },
      { table: 'salary_records', op: 'select', data: approvedRecord },
      { table: 'expenses', op: 'insert', data: null },
      { table: 'expenses', op: 'delete', error: { message: 'expense delete failed' } },
      { table: 'salary_records', op: 'update', error: { message: 'salary restore failed' } },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await approveSalary('ktv-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('audit failed');
    expect(result.error).toContain('expense delete failed');
    expect(result.error).toContain('salary restore failed');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe('checkAndAutoConfirm RPC handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
      full_name: 'Admin Bella',
    });
  });

  it('returns failure without calling RPC when current user has no tenant', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', role: 'admin', tenant_id: null });

    const result = await checkAndAutoConfirm();

    expect(result).toEqual({
      success: false,
      count: 0,
      error: 'Không xác định được chi nhánh của người dùng',
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns success and revalidates salary page when RPC confirms stale records', async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null });

    const result = await checkAndAutoConfirm();

    expect(result).toEqual({ success: true, count: 3 });
    expect(mockRpc).toHaveBeenCalledWith('auto_confirm_stale_salary_records', {
      p_tenant_id: 'tenant-1',
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/salary');
  });

  it('returns success without revalidation when RPC confirms zero records', async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });

    const result = await checkAndAutoConfirm();

    expect(result).toEqual({ success: true, count: 0 });
    expect(mockRpc).toHaveBeenCalledWith('auto_confirm_stale_salary_records', {
      p_tenant_id: 'tenant-1',
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns explicit failure without revalidation when RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });

    const result = await checkAndAutoConfirm();

    expect(result).toEqual({
      success: false,
      count: 0,
      error: 'auto_confirm_stale_salary_records failed: rpc failed',
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe('bulk salary action partial failure reporting', () => {
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

  it('returns a complete success summary when all publish targets succeed', async () => {
    setupDb([
      { table: 'users', op: 'select', data: [{ id: 'ktv-1' }, { id: 'ktv-2' }] },
      { table: 'salary_records', op: 'select', data: salarySnapshot },
      { table: 'salary_records', op: 'select', data: { ...salarySnapshot, id: 'salary-2', ktv_id: 'ktv-2' } },
    ]);

    const result = await publishAllSalaryRecords();

    expect(result).toEqual({
      success: true,
      count: 2,
      total: 2,
      failedCount: 0,
      failures: [],
    });
    expect(mockRecalculateAndSaveSalaryRecordEngine).toHaveBeenCalledTimes(2);
  });

  it('returns partial failure details when one publish target fails', async () => {
    setupDb([
      { table: 'users', op: 'select', data: [{ id: 'ktv-1' }, { id: 'ktv-2' }] },
      { table: 'salary_records', op: 'select', data: salarySnapshot },
      { table: 'salary_records', op: 'select', data: { ...salarySnapshot, id: 'salary-2', ktv_id: 'ktv-2' } },
    ]);
    mockRecalculateAndSaveSalaryRecordEngine
      .mockResolvedValueOnce({ totalSalary: 6500000 })
      .mockRejectedValueOnce(new Error('publish recalc failed'));

    const result = await publishAllSalaryRecords();

    expect(result.success).toBe(false);
    expect(result.count).toBe(1);
    expect(result.total).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.failures).toEqual([{ ktvId: 'ktv-2', error: 'publish recalc failed' }]);
    expect(result.error).toContain('ktv-2: publish recalc failed');
  });

  it('returns explicit failure when publish target fetch fails', async () => {
    setupDb([
      { table: 'users', op: 'select', error: { message: 'users fetch failed' } },
    ]);

    const result = await publishAllSalaryRecords();

    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
    expect(result.total).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.error).toContain('users fetch failed');
    expect(mockRecalculateAndSaveSalaryRecordEngine).not.toHaveBeenCalled();
  });

  it('returns partial failure details when one finalize target throws', async () => {
    setupDb([
      { table: 'salary_records', op: 'select', data: [{ ktv_id: 'ktv-1' }, { ktv_id: 'ktv-2' }] },
      {
        table: 'salary_records',
        op: 'select',
        data: {
          id: 'salary-1',
          ktv_id: 'ktv-1',
          status: 'confirmed',
          finalized_at: null,
          total_salary: 6500000,
          tenant_id: 'tenant-1',
          users: { full_name: 'KTV One' },
        },
      },
      { table: 'session_logs', op: 'select', data: [] },
      { table: 'salary_records', op: 'update', data: null },
      { table: 'session_logs', op: 'update', data: null },
      { table: 'expenses', op: 'insert', data: null },
      { table: 'salary_records', op: 'select', error: { message: 'confirmed salary missing' } },
    ]);

    const result = await finalizeAllSalaryRecords();

    expect(result.success).toBe(false);
    expect(result.count).toBe(1);
    expect(result.total).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.failures).toEqual([{ ktvId: 'ktv-2', error: 'confirmed salary missing' }]);
    expect(result.error).toContain('ktv-2: confirmed salary missing');
  });

  it('returns explicit failure when finalize target fetch fails', async () => {
    setupDb([
      { table: 'salary_records', op: 'select', error: { message: 'confirmed fetch failed' } },
    ]);

    const result = await finalizeAllSalaryRecords();

    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
    expect(result.total).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.error).toContain('confirmed fetch failed');
  });
});
