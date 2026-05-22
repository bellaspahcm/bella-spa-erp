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
  // Default: successful chainable query builder
  const mockQueryChain: any = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
  };
  
  // Make the promise itself chainable or return chainable methods
  const mockResolve = { data: null, error: null };
  const mockPromise: any = Promise.resolve(mockResolve);
  Object.assign(mockPromise, mockQueryChain);
  
  Object.keys(mockQueryChain).forEach(key => {
    mockQueryChain[key].mockReturnValue(mockPromise);
  });
  
  mockFrom.mockReturnValue(mockQueryChain);
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
});
