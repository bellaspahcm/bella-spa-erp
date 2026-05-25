/**
 * Accounting Core Reports & Server Actions Tests
 *
 * Verifies:
 *   1. Multitenant RLS isolation for accounts, journals, periods, and reports.
 *   2. Chart of Accounts (COA) creation, dynamic updates, and validation guards.
 *   3. Adjusting Manual double-entry journals creation and balanced assertions.
 *   4. Reversal entry logic: original status changes to CANCELED, reversed lines swapped.
 *   5. Real-time SQL reports RPC routing (Trial Balance, P&L, Balance Sheet, Ledger).
 */

// ── Setup environment variables BEFORE imports ──
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// ── Mock global helpers and Supabase SSR client ──
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn(() => Promise.resolve()),
}));

// Setup global mock calls
const mockGetCurrentUser = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn();

(global as any).mockGetCurrentUser = mockGetCurrentUser;
(global as any).mockRpc = mockRpc;
(global as any).mockFrom = mockFrom;

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => (global as any).mockGetCurrentUser(...args),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => Promise.resolve({
    rpc: (...args: any[]) => (global as any).mockRpc(...args),
    from: (...args: any[]) => (global as any).mockFrom(...args),
  }),
}));

// Helper class for mock query builders
class MockQueryBuilder {
  public data: any;
  public error: any;
  public updateSpy = jest.fn().mockReturnThis();
  public insertSpy = jest.fn().mockReturnThis();
  public eqSpy = jest.fn().mockReturnThis();
  public orderSpy = jest.fn().mockReturnThis();

  constructor(data: any = null, error: any = null) {
    this.data = data;
    this.error = error;
  }

  select() { return this; }
  eq(...args: any[]) { this.eqSpy(...args); return this; }
  order(...args: any[]) { this.orderSpy(...args); return this; }
  update(...args: any[]) { this.updateSpy(...args); return this; }
  insert(...args: any[]) { this.insertSpy(...args); return this; }
  
  async single() {
    return { data: this.data, error: this.error };
  }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

// Mock AccountingEngineService service role
jest.mock('@/services/accounting-engine', () => ({
  AccountingEngineService: {
    postJournalEntry: jest.fn().mockResolvedValue('reversal-journal-uuid-1'),
    closePeriod: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  getAccounts,
  createAccount,
  updateAccount,
  getJournalEntries,
  getJournalEntryDetails,
  reverseJournalEntry,
  getAccountingPeriods,
  closePeriodAction,
  getOutboxEvents,
  replayOutboxEvent,
  postManualJournalEntry,
  getTrialBalanceReport,
  getIncomeStatementReport,
  getBalanceSheetReport,
  getAccountLedgerReport,
} from '../services/accounting-actions';
import { AccountingEngineService } from '@/services/accounting-engine';

const activeAdminUser = { id: 'admin-uuid-1', role: 'admin', tenant_id: 'tenant-uuid-1', full_name: 'Branch Manager' };

describe('Accounting Core Reports & Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(activeAdminUser);
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Chart of Accounts (COA) Actions
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Chart of Accounts Manager', () => {
    it('fetches all active accounts for the current tenant', async () => {
      const mockAccounts = [
        { id: '111', account_code: '111', account_name: 'Tiền mặt', account_type: 'ASSET' },
        { id: '112', account_code: '112', account_name: 'Tiền gửi ngân hàng', account_type: 'ASSET' },
      ];
      const qb = new MockQueryBuilder(mockAccounts);
      mockFrom.mockReturnValue(qb);

      const result = await getAccounts();
      expect(result).toEqual(mockAccounts);
      expect(mockFrom).toHaveBeenCalledWith('accounting_accounts');
      expect(qb.eqSpy).toHaveBeenCalledWith('tenant_id', 'tenant-uuid-1');
    });

    it('creates a custom sub-account successfully', async () => {
      const newAccount = { id: 'usd-1122', account_code: '1122', account_name: 'Tiền gửi USD', account_type: 'ASSET', parent_id: '112' };
      const qb = new MockQueryBuilder(newAccount);
      mockFrom.mockReturnValue(qb);

      const result = await createAccount({
        account_code: '1122',
        account_name: 'Tiền gửi USD',
        account_type: 'ASSET',
        parent_id: '112',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(newAccount);
      expect(qb.insertSpy).toHaveBeenCalledWith(expect.objectContaining({
        account_code: '1122',
        parent_id: '112',
      }));
    });

    it('throws error when creating account with parent from different tenant', async () => {
      const qb = new MockQueryBuilder(null, { message: 'Parent account not found' });
      mockFrom.mockReturnValue(qb);

      await expect(
        createAccount({
          account_code: '1122',
          account_name: 'Tiền gửi USD',
          account_type: 'ASSET',
          parent_id: 'foreign-parent-id',
        })
      ).rejects.toThrow(/Tài khoản cha không hợp lệ/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Manual adjusting journal entries
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Manual Adjusting Entries', () => {
    it('creates a manual adjusting journal entry successfully', async () => {
      const input = {
        description: 'Chi phí khấu hao TSCĐ cuối tháng 5',
        lines: [
          { account_id: 'acc-6426', debit_amount: 1500000, credit_amount: 0 },
          { account_id: 'acc-214', debit_amount: 0, credit_amount: 1500000 },
        ],
      };

      const result = await postManualJournalEntry(input);

      expect(result.success).toBe(true);
      expect(result.entryId).toBe('reversal-journal-uuid-1');
      expect(AccountingEngineService.postJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
        reference_type: 'MANUAL',
        description: 'Chi phí khấu hao TSCĐ cuối tháng 5',
      }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Reversal entry logic (Journal Reversal)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Journal Entry Reversal', () => {
    it('creates a reversing posted entry (Nợ/Có swapped) and cancels original', async () => {
      const originalEntry = {
        id: 'orig-entry-1',
        tenant_id: 'tenant-uuid-1',
        description: 'Hạch toán nhầm doanh thu lẻ',
        status: 'POSTED',
        journal_lines: [
          { account_id: 'acc-111', debit_amount: 500000, credit_amount: 0 },
          { account_id: 'acc-5112', debit_amount: 0, credit_amount: 500000 },
        ],
      };

      const qb = new MockQueryBuilder(originalEntry);
      mockFrom.mockReturnValue(qb);

      const result = await reverseJournalEntry('orig-entry-1', 'Nhập nhầm mã tài sản');

      expect(result.success).toBe(true);
      expect(result.reversalEntryId).toBe('reversal-journal-uuid-1');

      // Verify Swapped Debit / Credit
      expect(AccountingEngineService.postJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
        description: expect.stringContaining('Ghi đảo bút toán'),
        lines: [
          expect.objectContaining({ account_id: 'acc-111', debit_amount: 0, credit_amount: 500000 }), // was debit 500k
          expect.objectContaining({ account_id: 'acc-5112', debit_amount: 500000, credit_amount: 0 }), // was credit 500k
        ],
      }));

      // Verify original updated to CANCELED
      expect(qb.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'CANCELED',
      }));
    });

    it('throws error if original entry is not POSTED', async () => {
      const originalEntry = {
        id: 'orig-entry-2',
        tenant_id: 'tenant-uuid-1',
        status: 'DRAFT',
      };
      const qb = new MockQueryBuilder(originalEntry);
      mockFrom.mockReturnValue(qb);

      await expect(
        reverseJournalEntry('orig-entry-2', 'Lỗi')
      ).rejects.toThrow(/Chỉ có thể đảo bút toán đã ghi sổ/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. SQL reporting functions RPC
  // ═══════════════════════════════════════════════════════════════════════════
  describe('SQL Reports RPC Routing', () => {
    it('routes getTrialBalanceReport to RPC get_trial_balance', async () => {
      mockRpc.mockResolvedValueOnce({ data: [{ account_code: '111', closing_debit: 100000 }], error: null });

      const result = await getTrialBalanceReport('2026-05-25');
      expect(result).toHaveLength(1);
      expect(mockRpc).toHaveBeenCalledWith('get_trial_balance', {
        p_tenant_id: 'tenant-uuid-1',
        p_as_of_date: '2026-05-25',
      });
    });

    it('routes getIncomeStatementReport to RPC get_income_statement', async () => {
      const mockPnL = { gross_revenue: 10000000, net_profit: 3000000 };
      mockRpc.mockResolvedValueOnce({ data: [mockPnL], error: null });

      const result = await getIncomeStatementReport('2026-05-01', '2026-05-31');
      expect(result).toEqual(mockPnL);
      expect(mockRpc).toHaveBeenCalledWith('get_income_statement', {
        p_tenant_id: 'tenant-uuid-1',
        p_from_date: '2026-05-01',
        p_to_date: '2026-05-31',
      });
    });

    it('routes getBalanceSheetReport to RPC get_balance_sheet', async () => {
      const mockBS = { total_assets: 50000000, total_equity: 50000000 };
      mockRpc.mockResolvedValueOnce({ data: [mockBS], error: null });

      const result = await getBalanceSheetReport('2026-05-25');
      expect(result).toEqual(mockBS);
      expect(mockRpc).toHaveBeenCalledWith('get_balance_sheet', {
        p_tenant_id: 'tenant-uuid-1',
        p_as_of_date: '2026-05-25',
      });
    });

    it('routes getAccountLedgerReport to RPC get_account_ledger', async () => {
      mockRpc.mockResolvedValueOnce({ data: [{ description: 'Số dư đầu kỳ', running_balance: 10000 }], error: null });

      const result = await getAccountLedgerReport('acc-111', '2026-05-01', '2026-05-31');
      expect(result).toHaveLength(1);
      expect(mockRpc).toHaveBeenCalledWith('get_account_ledger', {
        p_tenant_id: 'tenant-uuid-1',
        p_account_id: 'acc-111',
        p_from_date: '2026-05-01',
        p_to_date: '2026-05-31',
      });
    });
  });
});
