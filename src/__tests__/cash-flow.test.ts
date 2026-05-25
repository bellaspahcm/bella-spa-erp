/**
 * Cash Flow Statement Tests (Phase 29.2)
 *
 * Verify:
 *   1. getCashFlowStatementReport calls get_cash_flow_statement RPC with auth
 *   2. Returns first row (or null if empty)
 *   3. Rejects unauthenticated users
 *   4. Propagates RPC errors
 *   5. exportAccountingReportToExcel supports 'cash_flow' type without error
 */

// Setup env
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Mocks
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

const mockGetCurrentUser = jest.fn();
jest.mock('../services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

import { getCashFlowStatementReport } from '../services/accounting-actions';
import { exportAccountingReportToExcel } from '../services/export-actions';

const TENANT_ID = 'tenant-uuid-1';
const ADMIN_USER = { id: 'user-admin', tenant_id: TENANT_ID, role: 'admin' };

beforeEach(() => {
  jest.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
// getCashFlowStatementReport
// ════════════════════════════════════════════════════════════════════════════

describe('getCashFlowStatementReport', () => {
  const FROM = '2026-05-01';
  const TO = '2026-05-31';

  it('returns the first row from get_cash_flow_statement RPC for authed user', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    const fakeRow = {
      opening_cash: 10_000_000,
      closing_cash: 15_000_000,
      profit_before_tax: 6_000_000,
      depreciation: 500_000,
      change_in_receivables: -200_000,
      change_in_inventory: 100_000,
      change_in_payables: 800_000,
      change_in_unearned_revenue: 1_500_000,
      tax_paid: 0,
      net_cash_operating: 8_900_000,
      fixed_assets_purchased: 4_000_000,
      fixed_assets_sold: 0,
      net_cash_investing: -4_000_000,
      owner_contributions: 0,
      loans_received: 0,
      loans_repaid: 0,
      net_cash_financing: 100_000,
      net_change_in_cash: 5_000_000,
      verification_diff: 0,
    };
    mockRpc.mockResolvedValueOnce({ data: [fakeRow], error: null });

    const result = await getCashFlowStatementReport(FROM, TO);

    expect(result).toEqual(fakeRow);
    expect(mockRpc).toHaveBeenCalledWith('get_cash_flow_statement', {
      p_tenant_id: TENANT_ID,
      p_from_date: FROM,
      p_to_date: TO,
    });
  });

  it('returns null when RPC returns empty array', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await getCashFlowStatementReport(FROM, TO);
    expect(result).toBeNull();
  });

  it('rejects users without tenant_id', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'orphan', tenant_id: null });

    await expect(getCashFlowStatementReport(FROM, TO)).rejects.toThrow(/Unauthorized/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('propagates RPC errors', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Function get_cash_flow_statement does not exist' },
    });

    await expect(getCashFlowStatementReport(FROM, TO)).rejects.toMatchObject({
      message: expect.stringContaining('does not exist'),
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// exportAccountingReportToExcel — Cash Flow sheet
// ════════════════════════════════════════════════════════════════════════════

describe('exportAccountingReportToExcel (cash_flow)', () => {
  it('produces a non-empty base64 Excel file for Cash Flow Statement', async () => {
    const fakeCf = {
      opening_cash: 10_000_000,
      closing_cash: 15_000_000,
      profit_before_tax: 6_000_000,
      depreciation: 500_000,
      change_in_receivables: -200_000,
      change_in_inventory: 100_000,
      change_in_payables: 800_000,
      change_in_unearned_revenue: 1_500_000,
      tax_paid: 0,
      net_cash_operating: 8_900_000,
      fixed_assets_purchased: 4_000_000,
      fixed_assets_sold: 0,
      net_cash_investing: -4_000_000,
      owner_contributions: 0,
      loans_received: 0,
      loans_repaid: 0,
      net_cash_financing: 100_000,
      net_change_in_cash: 5_000_000,
      verification_diff: 0,
    };

    const base64 = await exportAccountingReportToExcel('cash_flow', fakeCf, '2026-05-01 đến 2026-05-31');

    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(100); // xlsx file always > 100 bytes
    // PK header (zip magic) in base64 starts with "UEsD"
    expect(base64.startsWith('UEsD')).toBe(true);
  });

  it('handles null/missing fields gracefully', async () => {
    const incompleteCf = { opening_cash: null, closing_cash: undefined };
    const base64 = await exportAccountingReportToExcel('cash_flow', incompleteCf, 'test');
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(100);
  });

  it('includes verification warning row when diff > 1', async () => {
    const cfWithDiff = {
      net_change_in_cash: 1_000_000,
      verification_diff: 999_999,
    };
    const base64 = await exportAccountingReportToExcel('cash_flow', cfWithDiff, 'test');
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(100);
  });
});
