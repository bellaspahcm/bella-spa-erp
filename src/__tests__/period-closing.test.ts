/**
 * Period Closing Workflow Tests (Phase 29.1)
 *
 * Verify:
 *   1. previewClosingEntries returns 3-step preview from RPC
 *   2. closePeriodAction calls close_accounting_period RPC + audit log
 *   3. closePeriodAction rejects non-admin
 *   4. closePeriodAction propagates DRAFT-entries-remain error
 *   5. reopenPeriodAction calls reopen RPC + audit log
 *   6. reopenPeriodAction is HQ-only (RPC enforces, app forwards error)
 *   7. previewClosingEntries rejects non-admin
 */

// ── Setup env ───────────────────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// ── Mocks for Next.js + Supabase + dependencies ─────────────────────────────
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }), { virtual: true });
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }), { virtual: true });

// Audit log mock
const mockRecordAuditLog = jest.fn().mockResolvedValue({ success: true });
jest.mock('../services/audit-actions', () => ({
  recordAuditLog: (...args: any[]) => mockRecordAuditLog(...args),
}));

// safeRevalidatePath mock
jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

// Supabase server client mock
const mockRpc = jest.fn();
const mockSupabaseServer = {
  rpc: mockRpc,
};
jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseServer)),
}));

// getCurrentUser mock — controllable per-test
const mockGetCurrentUser = jest.fn();
jest.mock('../services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

import {
  previewClosingEntries,
  closePeriodAction,
  reopenPeriodAction,
} from '../services/accounting-actions';

const TENANT_ID = 'tenant-uuid-1';
const PERIOD_ID = 'period-uuid-1';
const ADMIN_USER = { id: 'user-uuid-admin', tenant_id: TENANT_ID, role: 'admin' };
const KTV_USER = { id: 'user-uuid-ktv', tenant_id: TENANT_ID, role: 'ktv' };

beforeEach(() => {
  jest.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
// previewClosingEntries
// ════════════════════════════════════════════════════════════════════════════

describe('previewClosingEntries', () => {
  it('returns the 3-step preview from preview_closing_entries RPC', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    const fakePreview = [
      { step: 1, step_name: 'Kết chuyển doanh thu', description: '...', debit_account_code: '5xx', credit_account_code: '911', amount: 5000000 },
      { step: 2, step_name: 'Kết chuyển chi phí', description: '...', debit_account_code: '911', credit_account_code: '6xx/8xx', amount: 3500000 },
      { step: 3, step_name: 'Kết chuyển lãi ròng', description: '...', debit_account_code: '911', credit_account_code: '421', amount: 1500000 },
    ];
    mockRpc.mockResolvedValueOnce({ data: fakePreview, error: null });

    const result = await previewClosingEntries(PERIOD_ID);

    expect(result).toEqual(fakePreview);
    expect(mockRpc).toHaveBeenCalledWith('preview_closing_entries', { p_period_id: PERIOD_ID });
  });

  it('rejects non-admin users (KTV)', async () => {
    mockGetCurrentUser.mockResolvedValue(KTV_USER);

    await expect(previewClosingEntries(PERIOD_ID)).rejects.toThrow(/Unauthorized.*branch admins/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects users without tenant_id', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'orphan', tenant_id: null, role: 'admin' });

    await expect(previewClosingEntries(PERIOD_ID)).rejects.toThrow(/Unauthorized/);
  });

  it('propagates RPC errors (e.g., period not found)', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Kỳ kế toán không tồn tại.' } });

    await expect(previewClosingEntries(PERIOD_ID)).rejects.toMatchObject({
      message: 'Kỳ kế toán không tồn tại.',
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// closePeriodAction
// ════════════════════════════════════════════════════════════════════════════

describe('closePeriodAction', () => {
  it('calls close_accounting_period RPC + audit log on success', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await closePeriodAction(PERIOD_ID);

    expect(result).toEqual({ success: true });
    expect(mockRpc).toHaveBeenCalledWith('close_accounting_period', { p_period_id: PERIOD_ID });
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        table_name: 'accounting_periods',
        record_id: PERIOD_ID,
        new_data: expect.objectContaining({ status: 'CLOSED', closed_by: ADMIN_USER.id }),
      })
    );
  });

  it('propagates "DRAFT entries remain" error from RPC', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Còn 3 bút toán DRAFT (chưa POST) trong kỳ.' },
    });

    await expect(closePeriodAction(PERIOD_ID)).rejects.toMatchObject({
      message: expect.stringContaining('DRAFT'),
    });

    // Audit log should NOT be called if RPC fails
    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('rejects non-admin users (KTV)', async () => {
    mockGetCurrentUser.mockResolvedValue(KTV_USER);

    await expect(closePeriodAction(PERIOD_ID)).rejects.toThrow(/Unauthorized/);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// reopenPeriodAction
// ════════════════════════════════════════════════════════════════════════════

describe('reopenPeriodAction', () => {
  it('calls reopen_accounting_period RPC + audit log on success', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'hq-admin-uuid', tenant_id: TENANT_ID, role: 'admin' });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await reopenPeriodAction(PERIOD_ID);

    expect(result).toEqual({ success: true });
    expect(mockRpc).toHaveBeenCalledWith('reopen_accounting_period', { p_period_id: PERIOD_ID });
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        table_name: 'accounting_periods',
        record_id: PERIOD_ID,
        new_data: expect.objectContaining({ status: 'OPEN' }),
      })
    );
  });

  it('propagates "only HQ super admin" error from RPC for non-HQ admins', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Unauthorized: chỉ HQ super admin được mở lại kỳ kế toán đã đóng.' },
    });

    await expect(reopenPeriodAction(PERIOD_ID)).rejects.toMatchObject({
      message: expect.stringContaining('HQ super admin'),
    });

    expect(mockRecordAuditLog).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated users', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(reopenPeriodAction(PERIOD_ID)).rejects.toThrow(/Unauthorized/);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
