/**
 * Salary Reconciliation Report Tests (M2)
 *
 * Verify:
 *   1. getSalaryReconciliationReport calls salary reconciliation RPC with authenticated user context
 *   2. Rejects non-admin users (KTV)
 *   3. Allows accountant role (M2 extended RBAC)
 *   4. Rejects users without tenant_id
 *   5. Propagates RPC errors
 *   6. Status enum preservation (MATCH / MINOR_DIFF / MAJOR_DIFF / PENDING_LEGACY)
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
const mockCreateRpcClient = () => ({
  rest: {},
  rpc(this: { rest?: unknown }, fn: string, args: unknown) {
    if (!this?.rest) {
      throw new TypeError("Cannot read properties of undefined (reading 'rest')");
    }
    return mockRpc(fn, args);
  },
});
jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockCreateRpcClient())),
}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockCreateRpcClient()),
}));

const mockGetCurrentUser = jest.fn();
jest.mock('../services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

import { getSalaryReconciliationReport } from '../services/accounting-actions';

const TENANT_ID = 'tenant-uuid-1';
const ADMIN_USER = { id: 'user-admin', tenant_id: TENANT_ID, role: 'admin' };
const ACCOUNTANT_USER = { id: 'user-acct', tenant_id: TENANT_ID, role: 'accountant' };
const KTV_USER = { id: 'user-ktv', tenant_id: TENANT_ID, role: 'ktv' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getSalaryReconciliationReport', () => {
  const MONTH = '2026-05-01';

  it('returns typed rows preserving status enum for admin', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    const fakeRows = [
      {
        ktv_id: 'ktv-1',
        ktv_name: 'KTV Alpha',
        legacy_base_salary: 5000000, legacy_session_bonus: 2000000, legacy_kpi_bonus: 1000000,
        legacy_deductions: 0, legacy_total: 8000000, legacy_status: 'paid',
        ai_base_salary: 5000000, ai_session_bonus: 2000000, ai_kpi_bonus: 1000000,
        ai_deductions: 0, ai_total: 8000000, diff_total: 0, diff_percent: 0,
        status: 'MATCH',
      },
      {
        ktv_id: 'ktv-2',
        ktv_name: 'KTV Beta',
        legacy_base_salary: 5000000, legacy_session_bonus: 1500000, legacy_kpi_bonus: 0,
        legacy_deductions: 100000, legacy_total: 6400000, legacy_status: 'paid',
        ai_base_salary: 5000000, ai_session_bonus: 1500000, ai_kpi_bonus: 0,
        ai_deductions: 100000, ai_total: 6403000, diff_total: -3000, diff_percent: 0.05,
        status: 'MINOR_DIFF',
      },
      {
        ktv_id: 'ktv-3',
        ktv_name: 'KTV Gamma',
        legacy_base_salary: 0, legacy_session_bonus: 0, legacy_kpi_bonus: 0,
        legacy_deductions: 0, legacy_total: 0, legacy_status: 'missing',
        ai_base_salary: 5000000, ai_session_bonus: 1800000, ai_kpi_bonus: 0,
        ai_deductions: 0, ai_total: 6800000, diff_total: -6800000, diff_percent: 100,
        status: 'PENDING_LEGACY',
      },
    ];

    mockRpc.mockResolvedValueOnce({ data: fakeRows, error: null });

    const result = await getSalaryReconciliationReport(MONTH);

    expect(result).toHaveLength(3);
    expect(result[0].status).toBe('MATCH');
    expect(result[1].status).toBe('MINOR_DIFF');
    expect(result[2].status).toBe('PENDING_LEGACY');
    expect(result[1].diff_total).toBe(-3000);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_salary_reconciliation_report', {
      p_tenant_id: TENANT_ID,
      p_month_year: MONTH,
    });
  });

  it('allows accountant role (M2 extended RBAC)', async () => {
    mockGetCurrentUser.mockResolvedValue(ACCOUNTANT_USER);
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await getSalaryReconciliationReport(MONTH);
    expect(result).toEqual([]);
  });

  it('rejects KTV users', async () => {
    mockGetCurrentUser.mockResolvedValue(KTV_USER);
    await expect(getSalaryReconciliationReport(MONTH)).rejects.toThrow(/Unauthorized.*admin\/kế toán/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects users without tenant_id', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'orphan', tenant_id: null, role: 'admin' });
    await expect(getSalaryReconciliationReport(MONTH)).rejects.toThrow(/Unauthorized/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('propagates RPC errors from get_salary_reconciliation_report', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Function does not exist' } });

    await expect(getSalaryReconciliationReport(MONTH)).rejects.toMatchObject({
      message: expect.stringContaining('does not exist'),
    });
  });

  it('does not call set_session_tenant because PostgREST RPC context is per request', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    await expect(getSalaryReconciliationReport(MONTH)).resolves.toEqual([]);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).not.toHaveBeenCalledWith('set_session_tenant', expect.anything());
  });

  it('returns empty array when RPC data is null', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await getSalaryReconciliationReport(MONTH);
    expect(result).toEqual([]);
  });
});
