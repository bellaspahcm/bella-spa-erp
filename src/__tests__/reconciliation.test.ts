/**
 * Reconciliation Report Tests (Phase 29.5)
 *
 * Verify:
 *   1. getReconciliationReport calls get_reconciliation_report RPC with auth
 *   2. Rejects non-admin users
 *   3. Rejects users without tenant_id
 *   4. Propagates RPC errors
 *   5. Returns empty array gracefully on null
 *   6. Returns typed rows preserving status enum
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }), { virtual: true });
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }), { virtual: true });

jest.mock('../services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

const mockRpc = jest.fn();
jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ rpc: mockRpc })),
}));

// Mock the admin client (service-role) used after H4 refactor
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ rpc: mockRpc })),
}));

const mockGetCurrentUser = jest.fn();
jest.mock('../services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

import { getReconciliationReport } from '../services/accounting-actions';

const TENANT_ID = 'tenant-uuid-1';
const ADMIN_USER = { id: 'user-admin', tenant_id: TENANT_ID, role: 'admin' };
const KTV_USER = { id: 'user-ktv', tenant_id: TENANT_ID, role: 'ktv' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getReconciliationReport', () => {
  const FROM = '2026-05-01';
  const TO = '2026-05-31';

  it('returns typed reconciliation rows from RPC for admin user', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    const fakeRows = [
      {
        category: 'REVENUE_TOTAL',
        category_label: 'Tổng doanh thu',
        legacy_amount: 10_000_000,
        ledger_amount: 10_000_000,
        diff_amount: 0,
        diff_percent: 0,
        status: 'MATCH',
      },
      {
        category: 'EXPENSE_TOTAL',
        category_label: 'Tổng chi phí (gồm lương)',
        legacy_amount: 7_000_000,
        ledger_amount: 7_005_000,
        diff_amount: -5_000,
        diff_percent: 0.07,
        status: 'MINOR_DIFF',
      },
      {
        category: 'NET_PROFIT',
        category_label: 'Lợi nhuận ròng',
        legacy_amount: 3_000_000,
        ledger_amount: 2_995_000,
        diff_amount: 5_000,
        diff_percent: 0.17,
        status: 'MINOR_DIFF',
      },
    ];
    mockRpc.mockResolvedValueOnce({ data: fakeRows, error: null });

    const result = await getReconciliationReport(FROM, TO);

    expect(result).toHaveLength(3);
    expect(result[0].status).toBe('MATCH');
    expect(result[1].status).toBe('MINOR_DIFF');
    expect(result[2].diff_amount).toBe(5_000);

    expect(mockRpc).toHaveBeenCalledWith('get_reconciliation_report', {
      p_tenant_id: TENANT_ID,
      p_from_date: FROM,
      p_to_date: TO,
    });
  });

  it('detects MAJOR_DIFF status when mismatch > 1%', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    const fakeRows = [
      {
        category: 'REVENUE_TOTAL',
        category_label: 'Tổng doanh thu',
        legacy_amount: 10_000_000,
        ledger_amount: 8_000_000,
        diff_amount: 2_000_000,
        diff_percent: 20,
        status: 'MAJOR_DIFF',
      },
    ];
    mockRpc.mockResolvedValueOnce({ data: fakeRows, error: null });

    const result = await getReconciliationReport(FROM, TO);
    expect(result[0].status).toBe('MAJOR_DIFF');
    expect(result[0].diff_percent).toBe(20);
  });

  it('returns empty array gracefully when RPC returns null', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await getReconciliationReport(FROM, TO);
    expect(result).toEqual([]);
  });

  it('rejects KTV users (non-admin)', async () => {
    mockGetCurrentUser.mockResolvedValue(KTV_USER);

    await expect(getReconciliationReport(FROM, TO)).rejects.toThrow(/Unauthorized.*admin/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects users without tenant_id', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'orphan', tenant_id: null, role: 'admin' });

    await expect(getReconciliationReport(FROM, TO)).rejects.toThrow(/Unauthorized/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('propagates RPC errors with original message', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Function get_reconciliation_report does not exist' },
    });

    await expect(getReconciliationReport(FROM, TO)).rejects.toMatchObject({
      message: expect.stringContaining('does not exist'),
    });
  });
});
