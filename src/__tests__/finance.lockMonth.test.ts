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
    mockFrom.mockImplementation((table: string) => {
      const chain: any = {
        update: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        gte: jest.fn(() => chain),
        lte: jest.fn(() => chain),
        then: (cb: any) => Promise.resolve({
          data: null,
          error: table === 'revenue' ? { message: 'unlock failed' } : null,
        }).then(cb),
      };
      return chain;
    });

    const result = await unlockMonth('2026-05-01');

    expect(result.success).toBe(false);
    expect(result.error).toContain('unlock failed');
  });
});
