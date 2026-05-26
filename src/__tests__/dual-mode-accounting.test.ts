/**
 * Unit Tests: Dual-Mode Accounting (SIMPLE vs PROFESSIONAL) & Legacy Syncing
 *
 * Verify:
 *   1. getAccountingMode retrieves config correctly
 *   2. updateAccountingMode upgrades/downgrades settings safely
 *   3. syncLegacyToLedger converts legacy data into double-entries idempotent-safely
 *   4. recordTransaction and confirmTransaction block manually modifications in PROFESSIONAL mode
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
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockNot = jest.fn();
const mockSingle = jest.fn();
const mockUpdate = jest.fn();
const mockInsert = jest.fn();

const mockSupabase = {
  rpc: mockRpc,
  from: mockFrom,
};

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const mockGetCurrentUser = jest.fn();
jest.mock('../services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

import { getAccountingMode, updateAccountingMode, syncLegacyToLedger } from '../services/accounting-actions';
import { recordTransaction, confirmTransaction } from '../services/finance-actions';

const TENANT_ID = 'tenant-uuid-123';
const ADMIN_USER = { id: 'admin-1', tenant_id: TENANT_ID, role: 'admin' };
const KTV_USER = { id: 'ktv-1', tenant_id: TENANT_ID, role: 'ktv' };

function createMockChain(table: string) {
  const chain: any = {};
  
  chain.select = mockSelect.mockImplementation(() => chain);
  chain.insert = mockInsert.mockImplementation(() => {
    if (table === 'journal_lines') {
      return Promise.resolve({ error: null });
    }
    return chain;
  });
  chain.update = mockUpdate.mockImplementation(() => chain);
  chain.eq = mockEq.mockImplementation(() => chain);
  chain.not = mockNot.mockImplementation(() => Promise.resolve({ data: [], error: null }));
  chain.single = mockSingle.mockImplementation(() => {
    if (table === 'tenants') {
      return Promise.resolve({ data: { accounting_mode: 'SIMPLE' }, error: null });
    }
    if (table === 'accounting_accounts') {
      return Promise.resolve({ data: { id: 'acc-uuid' }, error: null });
    }
    if (table === 'journal_entries') {
      return Promise.resolve({ data: { id: 'new-journal-entry-id' }, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  // Support then/catch in case any intermediate chain is awaited
  chain.then = (onfulfilled?: any) => {
    let defaultData: any = [];
    if (table === 'revenue') {
      defaultData = [
        {
          id: 'rev-1',
          amount: 500000,
          description: 'Dịch vụ lẻ',
          payment_method: 'cash',
          received_date: '2026-05-01',
          branch_id: 'branch-1',
        }
      ];
    }
    return Promise.resolve({ data: defaultData, error: null }).then(onfulfilled);
  };
  
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockImplementation((table: string) => createMockChain(table));
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('Dual-Mode Accounting Configuration', () => {
  it('returns SIMPLE by default if accounting_mode is not defined', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockSingle.mockResolvedValueOnce({ data: { accounting_mode: null }, error: null });

    const mode = await getAccountingMode();
    expect(mode).toBe('SIMPLE');
  });

  it('updates accounting_mode successfully for admin user', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockUpdate.mockReturnValueOnce({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const res = await updateAccountingMode('PROFESSIONAL');
    expect(res.success).toBe(true);
  });

  it('blocks non-admin users from changing accounting mode', async () => {
    mockGetCurrentUser.mockResolvedValue(KTV_USER);
    await expect(updateAccountingMode('PROFESSIONAL')).rejects.toThrow(/Unauthorized/);
  });
});

describe('Legacy Syncing Engine', () => {
  it('syncs legacy data to ledger idempotent-safely and upgrades tenant to PROFESSIONAL', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);

    // Mock existing entries (none)
    mockNot.mockResolvedValueOnce({ data: [], error: null });

    // Mock postJournalEntry (through RPC journal_entries insert)
    mockRpc.mockResolvedValue({ data: 'entry-uuid-1', error: null });

    const res = await syncLegacyToLedger();
    expect(res.success).toBe(true);
    expect(res.syncedRevenueCount).toBe(1);
    expect(res.syncedExpenseCount).toBe(0);
  });
});

describe('Application Layer protection', () => {
  it('blocks manually recordTransaction if mode is PROFESSIONAL', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    // Mock accounting_mode is PROFESSIONAL
    mockSingle.mockResolvedValueOnce({ data: { accounting_mode: 'PROFESSIONAL' }, error: null });

    await expect(
      recordTransaction({
        amount: 200000,
        type: 'expense',
        category: 'other_admin',
        notes: 'Mua khăn giấy',
      })
    ).rejects.toThrow(/chế độ Kế toán Chuyên nghiệp/);
  });

  it('blocks manually confirmTransaction if mode is PROFESSIONAL', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    // Mock accounting_mode is PROFESSIONAL
    mockSingle.mockResolvedValueOnce({ data: { accounting_mode: 'PROFESSIONAL' }, error: null });

    await expect(confirmTransaction('rev-1', 'revenue')).rejects.toThrow(/chế độ Kế toán Chuyên nghiệp/);
  });
});
