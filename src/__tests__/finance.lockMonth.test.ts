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
  getCurrentUser: mockGetCurrentUser,
}));

// Avoid "must be called in server context" errors
jest.mock('server-only', () => ({}), { virtual: true });

import { lockMonth, unlockMonth } from '../services/finance-actions';

const adminUser = { id: 'admin-1', role: 'admin', tenant_id: 'tenant-a' };
const ktvUser  = { id: 'ktv-1',   role: 'ktv',   tenant_id: 'tenant-a' };

type LockPayload = { is_locked: boolean };

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
      in: jest.fn(() => {
        usedInFilter = true;
        return chain;
      }),
      order: jest.fn(() => chain),
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
        eq: jest.fn(() => chain),
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
