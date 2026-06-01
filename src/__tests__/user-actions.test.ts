import { updateUser, updateUserStatus } from '../services/user-actions';

const mockFrom = jest.fn();
const mockRecordAuditLog = jest.fn();
const mockSafeRevalidatePath = jest.fn();

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

jest.mock('../services/audit-actions', () => ({
  recordAuditLog: (payload: unknown) => mockRecordAuditLog(payload),
}));

jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
}));

type ScriptedResult = {
  table: string;
  op: 'select' | 'update';
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

  update(payload: unknown) {
    this.op = 'update';
    this.calls.push({ table: this.table, op: 'update', payload });
    return this;
  }

  eq() { return this; }
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

describe('user update audit rollback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordAuditLog.mockResolvedValue({ success: true });
    mockSafeRevalidatePath.mockResolvedValue(undefined);
  });

  function installScriptedSupabase(scripts: ScriptedResult[]) {
    const calls: DbCall[] = [];
    mockFrom.mockImplementation((table: string) => new ScriptedQueryBuilder(table, scripts, calls));
    return calls;
  }

  it('updates user status and records old/new audit data on success', async () => {
    const calls = installScriptedSupabase([
      { table: 'users', op: 'select', data: { status: 'active' } },
      { table: 'users', op: 'update' },
    ]);

    const result = await updateUserStatus('user-1', 'inactive');

    expect(result).toEqual({ success: true });
    expect(calls.filter(c => c.table === 'users' && c.op === 'update').map(c => c.payload)).toEqual([
      { status: 'inactive' },
    ]);
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'users',
      record_id: 'user-1',
      old_data: { status: 'active' },
      new_data: { status: 'inactive' },
    });
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
  });

  it('rolls back user status when audit logging fails', async () => {
    const calls = installScriptedSupabase([
      { table: 'users', op: 'select', data: { status: 'active' } },
      { table: 'users', op: 'update' },
      { table: 'users', op: 'update' },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await updateUserStatus('user-1', 'inactive');

    expect(result.error).toContain('audit failed');
    expect(calls.filter(c => c.table === 'users' && c.op === 'update').map(c => c.payload)).toEqual([
      { status: 'inactive' },
      { status: 'active' },
    ]);
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('reports rollback failure when user status audit rollback fails', async () => {
    const calls = installScriptedSupabase([
      { table: 'users', op: 'select', data: { status: 'active' } },
      { table: 'users', op: 'update' },
      { table: 'users', op: 'update', error: { message: 'rollback failed' } },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await updateUserStatus('user-1', 'inactive');

    expect(result.error).toContain('audit failed');
    expect(result.error).toContain('rollback failed: rollback failed');
    expect(calls.filter(c => c.table === 'users' && c.op === 'update').map(c => c.payload)).toEqual([
      { status: 'inactive' },
      { status: 'active' },
    ]);
  });

  it('rolls back user profile fields when audit logging fails', async () => {
    const calls = installScriptedSupabase([
      { table: 'users', op: 'select', data: { full_name: 'Old Name', role: 'ktv' } },
      { table: 'users', op: 'update' },
      { table: 'users', op: 'update' },
    ]);
    mockRecordAuditLog.mockRejectedValue(new Error('audit failed'));

    const result = await updateUser('user-1', { full_name: 'New Name', role: 'manager' });

    expect(result.error).toContain('audit failed');
    expect(calls.filter(c => c.table === 'users' && c.op === 'update').map(c => c.payload)).toEqual([
      { full_name: 'New Name', role: 'manager' },
      { full_name: 'Old Name', role: 'ktv' },
    ]);
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });
});
