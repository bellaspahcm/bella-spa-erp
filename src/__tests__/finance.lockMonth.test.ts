/**
 * Tests for lockMonth / unlockMonth server actions.
 * Mocks: next/cache, @supabase/ssr, user-actions, supabase-server
 */

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSupabase = { rpc: mockRpc, from: mockFrom };
jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

const mockGetCurrentUser = jest.fn();
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

// Avoid "must be called in server context" errors
jest.mock('server-only', () => ({}), { virtual: true });

import { lockMonth, unlockMonth } from '../services/finance-actions';

const adminUser = { id: 'admin-1', role: 'admin', tenant_id: 'tenant-a' };
const ktvUser  = { id: 'ktv-1',   role: 'ktv',   tenant_id: 'tenant-a' };

type LockPayload = { is_locked: boolean };

type LockMonthFlowOptions = {
  royaltyInsertFailure?: string;
  clearingInsertFailure?: string;
  restoreFailure?: { table: string; message: string };
  existingInvoiceStatus?: string | null;
  existingClearingStatus?: string | null;
};

function mockUnlockMonthUpdateFlow(options: {
  unlockFailure?: { table: string; message: string; reject?: boolean };
  rollbackFailure?: { table: string; message: string; reject?: boolean };
}) {
  const updateCalls: Array<{ table: string; payload: LockPayload }> = [];
  const filterCalls: Array<{ table: string; payload: LockPayload | null; method: string; args: unknown[] }> = [];

  mockFrom.mockImplementation((table: string) => {
    let operation: 'select' | 'update' = 'select';
    let updatePayload: LockPayload | null = null;
    const chain: any = {
      select: jest.fn(() => {
        operation = 'select';
        return chain;
      }),
      update: jest.fn((payload: LockPayload) => {
        operation = 'update';
        updatePayload = payload;
        updateCalls.push({ table, payload });
        return chain;
      }),
      eq: jest.fn((field: string, value: unknown) => {
        filterCalls.push({ table, payload: updatePayload, method: 'eq', args: [field, value] });
        return chain;
      }),
      gte: jest.fn((field: string, value: unknown) => {
        filterCalls.push({ table, payload: updatePayload, method: 'gte', args: [field, value] });
        return chain;
      }),
      lte: jest.fn((field: string, value: unknown) => {
        filterCalls.push({ table, payload: updatePayload, method: 'lte', args: [field, value] });
        return chain;
      }),
      in: jest.fn((field: string, value: unknown) => {
        filterCalls.push({ table, payload: updatePayload, method: 'in', args: [field, value] });
        return chain;
      }),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      then: (cb: any, onRejected?: any) => {
        if (operation === 'select') {
          return Promise.resolve({
            data: [
              { id: `${table}-locked`, is_locked: true },
              { id: `${table}-unlocked`, is_locked: false },
            ],
            error: null,
          }).then(cb, onRejected);
        }

        const failure = updatePayload?.is_locked ? options.rollbackFailure : options.unlockFailure;
        if (failure?.table === table) {
          if (failure.reject) {
            return Promise.reject(new Error(failure.message)).then(cb, onRejected);
          }
          return Promise.resolve({ data: null, error: { message: failure.message } }).then(cb, onRejected);
        }

        return Promise.resolve({ data: null, error: null }).then(cb, onRejected);
      },
    };
    return chain;
  });

  return { updateCalls, filterCalls };
}

function mockLockMonthSideEffectFlow(options: LockMonthFlowOptions = {}) {
  const updateCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const insertCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const filterCalls: Array<{ table: string; payload: Record<string, unknown> | null; method: string; args: unknown[] }> = [];

  mockFrom.mockImplementation((table: string) => {
    let operation: 'select' | 'update' | 'insert' = 'select';
    let selected = '';
    let payload: Record<string, unknown> | null = null;
    const chain: any = {
      select: jest.fn((fields?: string) => {
        operation = 'select';
        selected = fields ?? '';
        return chain;
      }),
      update: jest.fn((nextPayload: Record<string, unknown>) => {
        operation = 'update';
        payload = nextPayload;
        updateCalls.push({ table, payload: nextPayload });
        return chain;
      }),
      insert: jest.fn((nextPayload: Record<string, unknown>) => {
        operation = 'insert';
        payload = nextPayload;
        insertCalls.push({ table, payload: nextPayload });
        return chain;
      }),
      eq: jest.fn((field: string, value: unknown) => {
        filterCalls.push({ table, payload, method: 'eq', args: [field, value] });
        return chain;
      }),
      gte: jest.fn((field: string, value: unknown) => {
        filterCalls.push({ table, payload, method: 'gte', args: [field, value] });
        return chain;
      }),
      lte: jest.fn((field: string, value: unknown) => {
        filterCalls.push({ table, payload, method: 'lte', args: [field, value] });
        return chain;
      }),
      lt: jest.fn((field: string, value: unknown) => {
        filterCalls.push({ table, payload, method: 'lt', args: [field, value] });
        return chain;
      }),
      in: jest.fn((field: string, value: unknown) => {
        filterCalls.push({ table, payload, method: 'in', args: [field, value] });
        return chain;
      }),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      single: jest.fn(() => Promise.resolve(resolveQuery())),
      maybeSingle: jest.fn(() => Promise.resolve(resolveMaybeSingle())),
      then: (cb: any) => Promise.resolve(resolveQuery()).then(cb),
    };

    function snapshotRows() {
      return [
        { id: `${table}-locked`, is_locked: true, status: table === 'revenue' ? 'confirmed' : 'approved' },
        { id: `${table}-unlocked`, is_locked: false, status: 'draft' },
      ];
    }

    function resolveMaybeSingle() {
      if (table === 'franchise_royalty_invoices') {
        return {
          data: options.existingInvoiceStatus ? { id: 'invoice-existing', status: options.existingInvoiceStatus } : null,
          error: null,
        };
      }
      if (table === 'inter_branch_clearing_records') {
        return {
          data: options.existingClearingStatus ? { id: 'clearing-existing', status: options.existingClearingStatus } : null,
          error: null,
        };
      }
      return { data: null, error: null };
    }

    function resolveQuery() {
      if (operation === 'update' && payload?.is_locked === false && options.restoreFailure?.table === table) {
        return { data: null, error: { message: options.restoreFailure.message } };
      }
      if (operation === 'insert' && table === 'franchise_royalty_invoices' && options.royaltyInsertFailure) {
        return { data: null, error: { message: options.royaltyInsertFailure } };
      }
      if (operation === 'insert' && table === 'inter_branch_clearing_records' && options.clearingInsertFailure) {
        return { data: null, error: { message: options.clearingInsertFailure } };
      }
      if (operation === 'insert' || operation === 'update') {
        return { data: null, error: null };
      }
      if (table === 'tenants' && selected.includes('royalty_type')) {
        return {
          data: {
            name: 'Bella Branch A',
            royalty_type: 'percentage',
            royalty_rate: 5,
            royalty_fixed_amount: null,
          },
          error: null,
        };
      }
      if (table === 'tenants') {
        return {
          data: [
            { id: 'tenant-a', name: 'Bella Branch A', internal_clearing_rate: 150000 },
            { id: 'tenant-b', name: 'Bella Branch B', internal_clearing_rate: 180000 },
          ],
          error: null,
        };
      }
      if (table === 'revenue' && selected.includes('amount')) {
        return { data: [{ amount: 10000000 }], error: null };
      }
      if (table === 'session_logs') {
        return {
          data: [
            { id: 'session-1', tenant_id: 'tenant-b', bookings: { tenant_id: 'tenant-a' } },
          ],
          error: null,
        };
      }
      if (table === 'revenue' || table === 'expenses' || table === 'salary_records') {
        return { data: snapshotRows(), error: null };
      }
      return { data: null, error: null };
    }

    return chain;
  });

  return { updateCalls, insertCalls, filterCalls };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: successful RPC
  mockRpc.mockResolvedValue({ error: null });
  mockFrom.mockImplementation((table: string) => {
    let usedInFilter = false;
    const resolve = () => {
      if (table === 'tenants') {
        return {
          data: usedInFilter
            ? []
            : {
                name: 'Bella Spa',
                royalty_type: 'percentage',
                royalty_rate: 10,
                royalty_fixed_amount: null,
              },
          error: null,
        };
      }
      if (table === 'revenue' || table === 'session_logs') return { data: [], error: null };
      if (table === 'franchise_royalty_invoices' || table === 'inter_branch_clearing_records') return { data: null, error: null };
      return { data: null, error: null };
    };
    const chain: any = {
      select: jest.fn(() => chain),
      update: jest.fn(() => chain),
      insert: jest.fn(() => chain),
      single: jest.fn(() => Promise.resolve(resolve())),
      maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
      eq: jest.fn(() => chain),
      gte: jest.fn(() => chain),
      lte: jest.fn(() => chain),
      lt: jest.fn(() => chain),
      in: jest.fn(() => {
        usedInFilter = true;
        return chain;
      }),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      then: (cb: any) => Promise.resolve(resolve()).then(cb),
    };
    return chain;
  });
});

describe('lockMonth', () => {
  it('gọi RPC lock_monthly_records với đúng params khi Admin', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);

    const result = await lockMonth('2026-05-01');

    expect(mockRpc).toHaveBeenCalledWith('lock_monthly_records', {
      p_tenant_id: 'tenant-a',
      p_month: '2026-05-01',
    });
    expect(result.success).toBe(true);
    expect(result.month).toBe('2026-05-01');
  });

  it('trả về error khi user không phải Admin', async () => {
    mockGetCurrentUser.mockResolvedValue(ktvUser);

    const result = await lockMonth('2026-05-01');

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Admin/i);
  });

  it('trả về error khi user chưa đăng nhập', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await lockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/đăng nhập/i);
  });

  it('blocks before lock RPC when accounting preflight has failed outbox events', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        then: (cb: any, onRejected?: any) => {
          const data = table === 'accounting_outbox'
            ? [
                {
                  id: 'outbox-failed-1',
                  tenant_id: 'tenant-a',
                  status: 'FAILED',
                  event_type: 'PACKAGE_SALE',
                  reference_type: 'REVENUE',
                  reference_id: 'revenue-1',
                  retry_count: 1,
                  last_error: 'posting failed',
                  created_at: '2026-05-02T08:00:00Z',
                },
              ]
            : [];
          return Promise.resolve({ data, error: null }).then(cb, onRejected);
        },
      };
      return chain;
    });

    const result = await lockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Outbox FAILED/);
    expect(mockRpc).not.toHaveBeenCalledWith('lock_monthly_records', expect.anything());
  });

  it('trả về error khi RPC thất bại', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    mockRpc.mockResolvedValue({ error: { message: 'DB timeout' } });

    const result = await lockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toContain('DB timeout');
  });

  it('returns error when royalty tenant lookup fails', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {
        select: jest.fn(() => chain),
        update: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        gte: jest.fn(() => chain),
        lte: jest.fn(() => chain),
        lt: jest.fn(() => chain),
        in: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        then: (cb: any) => Promise.resolve({
          data: table === 'revenue' || table === 'expenses' || table === 'salary_records' ? [] : null,
          error: null,
        }).then(cb),
        single: jest.fn(() => Promise.resolve({
          data: null,
          error: table === 'tenants' ? { message: 'tenant unavailable' } : null,
        })),
      };
      return chain;
    });

    const result = await lockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/hệ thống|system/i);
  });

  it('restores previous lock state when royalty invoice insert fails after lock RPC succeeds', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...adminUser, tenant_id: 'tenant-a' });
    const { updateCalls, filterCalls } = mockLockMonthSideEffectFlow({
      royaltyInsertFailure: 'invoice insert failed',
    });

    const result = await lockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toContain('invoice insert failed');
    expect(updateCalls).toEqual(expect.arrayContaining([
      { table: 'revenue', payload: { is_locked: false, status: 'draft' } },
      { table: 'expenses', payload: { is_locked: false, status: 'draft' } },
      { table: 'salary_records', payload: { is_locked: false, status: 'draft' } },
    ]));
    expect(filterCalls).toEqual(expect.arrayContaining([
      { table: 'revenue', payload: { is_locked: false, status: 'draft' }, method: 'eq', args: ['tenant_id', 'tenant-a'] },
      { table: 'revenue', payload: { is_locked: false, status: 'draft' }, method: 'gte', args: ['received_date', '2026-05-01'] },
      { table: 'revenue', payload: { is_locked: false, status: 'draft' }, method: 'lt', args: ['received_date', '2026-06-01'] },
      { table: 'revenue', payload: { is_locked: false, status: 'draft' }, method: 'in', args: ['id', ['revenue-unlocked']] },
      { table: 'expenses', payload: { is_locked: false, status: 'draft' }, method: 'eq', args: ['tenant_id', 'tenant-a'] },
      { table: 'expenses', payload: { is_locked: false, status: 'draft' }, method: 'gte', args: ['expense_date', '2026-05-01'] },
      { table: 'expenses', payload: { is_locked: false, status: 'draft' }, method: 'lt', args: ['expense_date', '2026-06-01'] },
      { table: 'expenses', payload: { is_locked: false, status: 'draft' }, method: 'in', args: ['id', ['expenses-unlocked']] },
      { table: 'salary_records', payload: { is_locked: false, status: 'draft' }, method: 'eq', args: ['tenant_id', 'tenant-a'] },
      { table: 'salary_records', payload: { is_locked: false, status: 'draft' }, method: 'eq', args: ['month_year', '2026-05-01'] },
      { table: 'salary_records', payload: { is_locked: false, status: 'draft' }, method: 'in', args: ['id', ['salary_records-unlocked']] },
    ]));
  });

  it('restores previous lock state when clearing insert fails after royalty succeeds', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...adminUser, tenant_id: 'tenant-a' });
    const { updateCalls, insertCalls } = mockLockMonthSideEffectFlow({
      clearingInsertFailure: 'clearing insert failed',
    });

    const result = await lockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toContain('clearing insert failed');
    expect(insertCalls).toEqual(expect.arrayContaining([
      { table: 'franchise_royalty_invoices', payload: expect.objectContaining({ status: 'pending' }) },
    ]));
    expect(updateCalls).toEqual(expect.arrayContaining([
      { table: 'revenue', payload: { is_locked: false, status: 'draft' } },
      { table: 'expenses', payload: { is_locked: false, status: 'draft' } },
      { table: 'salary_records', payload: { is_locked: false, status: 'draft' } },
    ]));
  });

  it('reports restore failure details when side-effect failure compensation fails', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...adminUser, tenant_id: 'tenant-a' });
    mockLockMonthSideEffectFlow({
      royaltyInsertFailure: 'invoice insert failed',
      restoreFailure: { table: 'salary_records', message: 'restore salary failed' },
    });

    const result = await lockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toContain('invoice insert failed');
    expect(result.error).toContain('restore salary failed');
  });

  it('does not overwrite paid royalty invoice or cleared inter-branch record', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...adminUser, tenant_id: 'tenant-a' });
    const { updateCalls, insertCalls } = mockLockMonthSideEffectFlow({
      existingInvoiceStatus: 'paid',
      existingClearingStatus: 'cleared',
    });

    const result = await lockMonth('2026-05-01');

    expect(result.success).toBe(true);
    expect(updateCalls).not.toEqual(expect.arrayContaining([
      { table: 'franchise_royalty_invoices', payload: expect.any(Object) },
      { table: 'inter_branch_clearing_records', payload: expect.any(Object) },
    ]));
    expect(insertCalls).not.toEqual(expect.arrayContaining([
      { table: 'franchise_royalty_invoices', payload: expect.any(Object) },
      { table: 'inter_branch_clearing_records', payload: expect.any(Object) },
    ]));
  });

  it('revalidatePath được gọi sau khi lock thành công', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    const { revalidatePath } = require('next/cache');

    await lockMonth('2026-05-01');

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/finance');
  });
});

describe('unlockMonth', () => {
  it('unlock thành công với Admin', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);

    const result = await unlockMonth('2026-05-01');

    expect(result.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('revenue');
  });

  it('chặn non-admin unlock', async () => {
    mockGetCurrentUser.mockResolvedValue(ktvUser);

    const result = await unlockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Admin/i);
  });

  it('returns error when a table unlock update fails', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    const { updateCalls, filterCalls } = mockUnlockMonthUpdateFlow({
      unlockFailure: { table: 'expenses', message: 'unlock failed' },
    });

    const result = await unlockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toContain('unlock failed');
    expect(updateCalls).toEqual(expect.arrayContaining([
      { table: 'revenue', payload: { is_locked: true } },
      { table: 'expenses', payload: { is_locked: true } },
      { table: 'salary_records', payload: { is_locked: true } },
    ]));
    expect(filterCalls).toEqual(expect.arrayContaining([
      { table: 'revenue', payload: { is_locked: true }, method: 'eq', args: ['tenant_id', 'tenant-a'] },
      { table: 'revenue', payload: { is_locked: true }, method: 'gte', args: ['received_date', '2026-05-01'] },
      { table: 'revenue', payload: { is_locked: true }, method: 'lte', args: ['received_date', '2026-05-31T23:59:59'] },
      { table: 'revenue', payload: { is_locked: true }, method: 'in', args: ['id', ['revenue-locked']] },
      { table: 'expenses', payload: { is_locked: true }, method: 'eq', args: ['tenant_id', 'tenant-a'] },
      { table: 'expenses', payload: { is_locked: true }, method: 'gte', args: ['expense_date', '2026-05-01'] },
      { table: 'expenses', payload: { is_locked: true }, method: 'lte', args: ['expense_date', '2026-05-31T23:59:59'] },
      { table: 'expenses', payload: { is_locked: true }, method: 'in', args: ['id', ['expenses-locked']] },
      { table: 'salary_records', payload: { is_locked: true }, method: 'eq', args: ['tenant_id', 'tenant-a'] },
      { table: 'salary_records', payload: { is_locked: true }, method: 'eq', args: ['month_year', '2026-05-01'] },
      { table: 'salary_records', payload: { is_locked: true }, method: 'in', args: ['id', ['salary_records-locked']] },
    ]));
  });

  it('rolls back when a table unlock update rejects', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    const { updateCalls } = mockUnlockMonthUpdateFlow({
      unlockFailure: { table: 'expenses', message: 'network rejected', reject: true },
    });

    const result = await unlockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toContain('network rejected');
    expect(updateCalls).toEqual(expect.arrayContaining([
      { table: 'revenue', payload: { is_locked: true } },
      { table: 'expenses', payload: { is_locked: true } },
      { table: 'salary_records', payload: { is_locked: true } },
    ]));
  });

  it('reports rollback failure when unlock update and rollback both fail', async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser);
    const { updateCalls } = mockUnlockMonthUpdateFlow({
      unlockFailure: { table: 'expenses', message: 'unlock failed' },
      rollbackFailure: { table: 'salary_records', message: 'rollback failed', reject: true },
    });

    const result = await unlockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toContain('unlock failed');
    expect(result.error).toContain('rollback failed');
    expect(updateCalls).toEqual(expect.arrayContaining([
      { table: 'revenue', payload: { is_locked: true } },
      { table: 'expenses', payload: { is_locked: true } },
      { table: 'salary_records', payload: { is_locked: true } },
    ]));
  });
});
