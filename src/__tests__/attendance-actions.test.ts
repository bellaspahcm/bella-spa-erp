import {
  approveLeaveRequest,
  getKTVConflictSessions,
  getKTVLeaveHistory,
  getKTVTodayAttendance,
  getMonthlyAttendanceSummary,
  getPendingLeaveRequests,
  getProcessedLeaveRequests,
} from '../services/attendance-actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('server-only', () => ({}), { virtual: true });

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();
const mockRecordAuditLog = jest.fn();

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
}));

jest.mock('../services/audit-actions', () => ({
  recordAuditLog: (...args: any[]) => mockRecordAuditLog(...args),
}));

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

class MockQueryBuilder {
  constructor(private data: any = null, private error: any = null) {}

  select() { return this; }
  eq() { return this; }
  in() { return this; }
  gte() { return this; }
  lt() { return this; }
  order() { return this; }
  maybeSingle() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

type ScriptedResult = {
  table: string;
  op: 'insert' | 'select' | 'update';
  data?: any;
  error?: { message: string };
};

type DbCall = {
  table: string;
  op: ScriptedResult['op'];
  payload?: any;
};

class ScriptedQueryBuilder {
  private op: ScriptedResult['op'] | '' = '';

  constructor(
    private table: string,
    private scripts: ScriptedResult[],
    private calls: DbCall[],
  ) {}

  select() {
    if (!this.op) {
      this.op = 'select';
      this.calls.push({ table: this.table, op: 'select' });
    }
    return this;
  }

  update(payload: any) {
    this.op = 'update';
    this.calls.push({ table: this.table, op: 'update', payload });
    return this;
  }

  insert(payload: any) {
    this.op = 'insert';
    this.calls.push({ table: this.table, op: 'insert', payload });
    return this;
  }

  eq() { return this; }
  in() { return this; }
  gte() { return this; }
  lt() { return this; }
  order() { return this; }
  maybeSingle() { return this.resolve(); }
  single() { return this.resolve(); }

  then(onfulfilled: (value: { data: any; error: any }) => unknown) {
    return this.resolve().then(onfulfilled);
  }

  private resolve() {
    const next = this.scripts.shift();
    if (!next) {
      throw new Error(`No scripted result for ${this.table}.${this.op}`);
    }
    if (next.table !== this.table || next.op !== this.op) {
      throw new Error(`Expected ${next.table}.${next.op}, got ${this.table}.${this.op}`);
    }
    return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
  }
}

describe('attendance read actions fail-fast behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'ktv-1',
      role: 'ktv',
      tenant_id: 'tenant-1',
    });
  });

  it('propagates today attendance query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'today attendance failed' }));

    await expect(getKTVTodayAttendance()).rejects.toThrow(
      "Failed to fetch today's KTV attendance: today attendance failed"
    );
  });

  it('propagates monthly attendance KTV query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'ktv summary failed' }));

    await expect(getMonthlyAttendanceSummary('2026-05')).rejects.toThrow(
      'Failed to fetch KTVs for monthly attendance summary: ktv summary failed'
    );
  });

  it('propagates leave history query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'leave history failed' }));

    await expect(getKTVLeaveHistory()).rejects.toThrow(
      'Failed to fetch KTV leave history: leave history failed'
    );
  });

  it('propagates pending leave query failures', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'pending leaves failed' }));

    await expect(getPendingLeaveRequests()).rejects.toThrow(
      'Failed to fetch pending leave requests: pending leaves failed'
    );
  });

  it('propagates processed leave query failures', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'processed leaves failed' }));

    await expect(getProcessedLeaveRequests('2026-07')).rejects.toThrow(
      'Failed to fetch processed leave requests: processed leaves failed'
    );
  });

  it('returns processed leave requests successfully', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
    const mockLeaves = [
      { id: 'leave-1', status: 'approved', leave_date: '2026-07-14' },
      { id: 'leave-2', status: 'rejected', leave_date: '2026-07-15' }
    ];
    mockFrom.mockReturnValue(new MockQueryBuilder(mockLeaves, null));

    const result = await getProcessedLeaveRequests('2026-07');
    expect(result).toEqual(mockLeaves);
  });

  it('propagates conflict session query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'conflicts failed' }));

    await expect(getKTVConflictSessions('ktv-1', '2026-05-30', 'full_day')).rejects.toThrow(
      'Failed to fetch KTV conflict sessions: conflicts failed'
    );
  });
});

describe('attendance leave approval side effects', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRecordAuditLog.mockResolvedValue({ success: true });
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  function installScriptedSupabase(scripts: ScriptedResult[]) {
    const calls: DbCall[] = [];
    mockFrom.mockImplementation((table: string) => new ScriptedQueryBuilder(table, scripts, calls));
    return calls;
  }

  it('inserts an absent attendance row when approving a full-day leave', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'staff_leaves',
        op: 'select',
        data: {
          id: 'leave-1',
          user_id: 'ktv-1',
          leave_date: '2026-06-02',
          leave_type: 'full_day',
          status: 'pending',
          approved_by: null,
          tenant_id: 'tenant-1',
        },
      },
      { table: 'staff_leaves', op: 'update' },
      { table: 'attendance', op: 'select', data: null },
      { table: 'attendance', op: 'insert' },
    ]);

    const result = await approveLeaveRequest('leave-1');

    expect(result).toEqual({ success: true });
    expect(calls.find(c => c.table === 'attendance' && c.op === 'insert')?.payload).toEqual({
      ktv_id: 'ktv-1',
      date: '2026-06-02',
      status: 'absent',
      tenant_id: 'tenant-1',
    });
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE',
      table_name: 'staff_leaves',
      record_id: 'leave-1',
    }));
  });

  it('inserts a half-day attendance row when approving a morning leave', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'staff_leaves',
        op: 'select',
        data: {
          id: 'leave-2',
          user_id: 'ktv-1',
          leave_date: '2026-06-03',
          leave_type: 'morning',
          status: 'pending',
          approved_by: null,
          tenant_id: 'tenant-1',
        },
      },
      { table: 'staff_leaves', op: 'update' },
      { table: 'attendance', op: 'select', data: null },
      { table: 'attendance', op: 'insert' },
    ]);

    const result = await approveLeaveRequest('leave-2');

    expect(result).toEqual({ success: true });
    expect(calls.find(c => c.table === 'attendance' && c.op === 'insert')?.payload).toMatchObject({
      ktv_id: 'ktv-1',
      date: '2026-06-03',
      status: 'half_day',
    });
  });

  it('updates reassigned sessions when leave approval and attendance write succeed', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'staff_leaves',
        op: 'select',
        data: {
          id: 'leave-reassign-1',
          user_id: 'ktv-1',
          leave_date: '2026-06-06',
          leave_type: 'full_day',
          status: 'pending',
          approved_by: null,
          tenant_id: 'tenant-1',
        },
      },
      {
        table: 'session_logs',
        op: 'select',
        data: { completed_by_ktv_id: 'ktv-1', notes: 'Original note' },
      },
      { table: 'session_logs', op: 'update' },
      { table: 'staff_leaves', op: 'update' },
      { table: 'attendance', op: 'select', data: null },
      { table: 'attendance', op: 'insert' },
    ]);

    const result = await approveLeaveRequest('leave-reassign-1', [
      { sessionLogId: 'session-1', newKtvId: 'ktv-2' },
    ]);

    expect(result).toEqual({ success: true });
    expect(calls.filter(c => c.table === 'session_logs' && c.op === 'update').map(c => c.payload)).toEqual([
      {
        completed_by_ktv_id: 'ktv-2',
        notes: '[🔄 Thay ca] Làm thay cho KTV chính',
      },
    ]);
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE',
      table_name: 'staff_leaves',
      record_id: 'leave-reassign-1',
    }));
  });

  it('rolls back reassigned sessions when leave approval update fails', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'staff_leaves',
        op: 'select',
        data: {
          id: 'leave-reassign-2',
          user_id: 'ktv-1',
          leave_date: '2026-06-07',
          leave_type: 'full_day',
          status: 'pending',
          approved_by: null,
          tenant_id: 'tenant-1',
        },
      },
      {
        table: 'session_logs',
        op: 'select',
        data: { completed_by_ktv_id: 'ktv-1', notes: 'Original note' },
      },
      { table: 'session_logs', op: 'update' },
      { table: 'staff_leaves', op: 'update', error: { message: 'leave approval failed' } },
      { table: 'session_logs', op: 'update' },
    ]);

    const result = await approveLeaveRequest('leave-reassign-2', [
      { sessionLogId: 'session-2', newKtvId: 'ktv-2' },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('leave approval failed');
    expect(calls.filter(c => c.table === 'session_logs' && c.op === 'update').map(c => c.payload)).toEqual([
      {
        completed_by_ktv_id: 'ktv-2',
        notes: '[🔄 Thay ca] Làm thay cho KTV chính',
      },
      {
        completed_by_ktv_id: 'ktv-1',
        notes: 'Original note',
      },
    ]);
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('rolls back leave approval when attendance insert fails', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'staff_leaves',
        op: 'select',
        data: {
          id: 'leave-3',
          user_id: 'ktv-1',
          leave_date: '2026-06-04',
          leave_type: 'full_day',
          status: 'pending',
          approved_by: null,
          tenant_id: 'tenant-1',
        },
      },
      { table: 'staff_leaves', op: 'update' },
      { table: 'attendance', op: 'select', data: null },
      { table: 'attendance', op: 'insert', error: { message: 'attendance insert failed' } },
      { table: 'staff_leaves', op: 'update' },
    ]);

    const result = await approveLeaveRequest('leave-3');

    expect(result.success).toBe(false);
    expect(result.error).toContain('attendance insert failed');
    expect(calls.filter(c => c.table === 'staff_leaves' && c.op === 'update').map(c => c.payload)).toEqual([
      { status: 'approved', approved_by: 'admin-1' },
      { status: 'pending', approved_by: null },
    ]);
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('rolls back leave approval and reassigned sessions when attendance insert fails', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'staff_leaves',
        op: 'select',
        data: {
          id: 'leave-reassign-3',
          user_id: 'ktv-1',
          leave_date: '2026-06-08',
          leave_type: 'full_day',
          status: 'pending',
          approved_by: null,
          tenant_id: 'tenant-1',
        },
      },
      {
        table: 'session_logs',
        op: 'select',
        data: { completed_by_ktv_id: null, notes: null },
      },
      { table: 'session_logs', op: 'update' },
      { table: 'staff_leaves', op: 'update' },
      { table: 'attendance', op: 'select', data: null },
      { table: 'attendance', op: 'insert', error: { message: 'attendance insert failed' } },
      { table: 'staff_leaves', op: 'update' },
      { table: 'session_logs', op: 'update' },
    ]);

    const result = await approveLeaveRequest('leave-reassign-3', [
      { sessionLogId: 'session-3', newKtvId: 'ktv-2' },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('attendance insert failed');
    expect(calls.filter(c => c.table === 'staff_leaves' && c.op === 'update').map(c => c.payload)).toEqual([
      { status: 'approved', approved_by: 'admin-1' },
      { status: 'pending', approved_by: null },
    ]);
    expect(calls.filter(c => c.table === 'session_logs' && c.op === 'update').map(c => c.payload)).toEqual([
      {
        completed_by_ktv_id: 'ktv-2',
        notes: '[🔄 Thay ca] Làm thay cho KTV chính',
      },
      {
        completed_by_ktv_id: null,
        notes: null,
      },
    ]);
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('reports rollback failure when leave approval rollback fails after attendance update failure', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'staff_leaves',
        op: 'select',
        data: {
          id: 'leave-4',
          user_id: 'ktv-1',
          leave_date: '2026-06-05',
          leave_type: 'afternoon',
          status: 'pending',
          approved_by: null,
          tenant_id: 'tenant-1',
        },
      },
      { table: 'staff_leaves', op: 'update' },
      { table: 'attendance', op: 'select', data: { id: 'att-1', status: 'absent' } },
      { table: 'attendance', op: 'update', error: { message: 'attendance update failed' } },
      { table: 'staff_leaves', op: 'update', error: { message: 'leave rollback failed' } },
    ]);

    const result = await approveLeaveRequest('leave-4');

    expect(result.success).toBe(false);
    expect(result.error).toContain('attendance update failed');
    expect(result.error).toContain('rollback failed: leave rollback failed');
    expect(calls.filter(c => c.table === 'staff_leaves' && c.op === 'update').map(c => c.payload)).toEqual([
      { status: 'approved', approved_by: 'admin-1' },
      { status: 'pending', approved_by: null },
    ]);
  });

  it('reports reassignment rollback failure when attendance rollback cannot restore a session', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'staff_leaves',
        op: 'select',
        data: {
          id: 'leave-reassign-4',
          user_id: 'ktv-1',
          leave_date: '2026-06-09',
          leave_type: 'morning',
          status: 'pending',
          approved_by: null,
          tenant_id: 'tenant-1',
        },
      },
      {
        table: 'session_logs',
        op: 'select',
        data: { completed_by_ktv_id: 'ktv-1', notes: 'Original note' },
      },
      { table: 'session_logs', op: 'update' },
      { table: 'staff_leaves', op: 'update' },
      { table: 'attendance', op: 'select', data: null },
      { table: 'attendance', op: 'insert', error: { message: 'attendance insert failed' } },
      { table: 'staff_leaves', op: 'update' },
      { table: 'session_logs', op: 'update', error: { message: 'session rollback failed' } },
    ]);

    const result = await approveLeaveRequest('leave-reassign-4', [
      { sessionLogId: 'session-4', newKtvId: 'ktv-2' },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('attendance insert failed');
    expect(result.error).toContain('reassignment rollback failed: session-4: session rollback failed');
    expect(calls.filter(c => c.table === 'session_logs' && c.op === 'update').map(c => c.payload)).toEqual([
      {
        completed_by_ktv_id: 'ktv-2',
        notes: '[🔄 Thay ca] Làm thay cho KTV chính',
      },
      {
        completed_by_ktv_id: 'ktv-1',
        notes: 'Original note',
      },
    ]);
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });
});
