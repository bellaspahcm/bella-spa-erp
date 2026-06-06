/**
 * Accounting Engine Tests
 *
 * Verify double-entry bookkeeping invariants:
 *   1. Balanced entries post successfully
 *   2. Unbalanced entries throw at app layer (defense-in-depth, DB trigger is second line)
 *   3. Zero-line entries throw
 *   4. Header insert errors propagate
 *   5. Line insert errors trigger header rollback
 *   6. POST update errors propagate
 *   7. RevenueRecognitionService.handlePackageSale produces correct 3-line balanced entry with VAT
 *   8. RevenueRecognitionService.handleSessionDone produces correct 4-line balanced entry
 *   9. handlePackageSale without VAT produces 2-line entry
 *  10. getAccountByCode missing account throws clear error
 */

// ── Setup env BEFORE importing the service so getAdminClient() doesn't crash ──
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// ── Mock @supabase/supabase-js ──
const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockEqFinal = jest.fn(); // final eq in chain returns the result
const mockEqChain: any = jest.fn();
mockEqChain.mockImplementation(() => ({ eq: mockEqChain, single: mockSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockInsertLines = jest.fn();
const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
const mockDeleteLinesEq = jest.fn();
const mockDeleteLines = jest.fn(() => ({ eq: mockDeleteLinesEq }));
const mockDeleteEq = jest.fn();
const mockDelete = jest.fn(() => ({ eq: mockDeleteEq }));

const fromHandler = jest.fn();

const mockClient = {
  from: fromHandler,
  rpc: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockClient),
  SupabaseClient: class {},
}));

import { AccountingEngineService } from '../services/accounting-engine';
import { RevenueRecognitionService } from '../services/revenue-recognition';

// ── Test fixtures ──
const TENANT_ID = 'tenant-uuid-1';
const CASH_ID = 'acct-111';
const BANK_ID = 'acct-112';
const UNEARNED_ID = 'acct-3387';
const RECEIVABLE_ID = 'acct-131';
const VAT_ID = 'acct-3331';
const REV_ID = 'acct-5113';
const EXPENSE_ID = 'acct-6421';
const COGS_ID = 'acct-632';
const PAYABLE_ID = 'acct-334';

beforeEach(() => {
  jest.clearAllMocks();

  // Default: header insert returns { id: 'entry-uuid-1' }
  mockSingle.mockResolvedValue({ data: { id: 'entry-uuid-1' }, error: null });
  mockInsertLines.mockResolvedValue({ error: null });
  mockUpdateEq.mockResolvedValue({ error: null });
  mockDeleteEq.mockResolvedValue({ error: null });
  mockDeleteLinesEq.mockResolvedValue({ error: null });

  // Router: trả về API tương ứng tên bảng
  fromHandler.mockImplementation((table: string) => {
    if (table === 'journal_entries') {
      return {
        insert: mockInsert, // returns { select: { single } }
        update: mockUpdate, // returns { eq }
        delete: mockDelete, // returns { eq }
      };
    }
    if (table === 'journal_lines') {
      return {
        insert: mockInsertLines, // promise
        delete: mockDeleteLines, // returns { eq }
      };
    }
    if (table === 'accounting_accounts') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: mockSingle,
              })),
            })),
          })),
        })),
      };
    }
    return {} as any;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AccountingEngineService.postJournalEntry
// ═══════════════════════════════════════════════════════════════════════════

describe('AccountingEngineService.postJournalEntry', () => {
  it('posts a balanced entry and returns the entry id', async () => {
    const id = await AccountingEngineService.postJournalEntry({
      tenant_id: TENANT_ID,
      description: 'Test balanced',
      lines: [
        { account_id: CASH_ID, debit_amount: 100000, credit_amount: 0 },
        { account_id: REV_ID, debit_amount: 0, credit_amount: 100000 },
      ],
    });

    expect(id).toBe('entry-uuid-1');
    expect(fromHandler).toHaveBeenCalledWith('journal_entries');
    expect(fromHandler).toHaveBeenCalledWith('journal_lines');

    // Verify lines were inserted with correct entry_id
    expect(mockInsertLines).toHaveBeenCalledWith([
      expect.objectContaining({ entry_id: 'entry-uuid-1', account_id: CASH_ID, debit_amount: 100000 }),
      expect.objectContaining({ entry_id: 'entry-uuid-1', account_id: REV_ID, credit_amount: 100000 }),
    ]);

    // Verify status update to POSTED
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'POSTED' });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'entry-uuid-1');
  });

  it('throws on unbalanced entry (app-layer check before DB)', async () => {
    await expect(
      AccountingEngineService.postJournalEntry({
        tenant_id: TENANT_ID,
        description: 'Unbalanced',
        lines: [
          { account_id: CASH_ID, debit_amount: 100000, credit_amount: 0 },
          { account_id: REV_ID, debit_amount: 0, credit_amount: 50000 }, // lệch 50k
        ],
      })
    ).rejects.toThrow(/Unbalanced journal entry/);

    // Đảm bảo không gọi DB
    expect(fromHandler).not.toHaveBeenCalled();
  });

  it('throws on zero-total entry', async () => {
    await expect(
      AccountingEngineService.postJournalEntry({
        tenant_id: TENANT_ID,
        description: 'Zero',
        lines: [{ account_id: CASH_ID, debit_amount: 0, credit_amount: 0 }],
      })
    ).rejects.toThrow(/must have non-zero lines/);
  });

  it('propagates header insert error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });

    await expect(
      AccountingEngineService.postJournalEntry({
        tenant_id: TENANT_ID,
        description: 'Test',
        lines: [
          { account_id: CASH_ID, debit_amount: 100, credit_amount: 0 },
          { account_id: REV_ID, debit_amount: 0, credit_amount: 100 },
        ],
      })
    ).rejects.toThrow(/Insert failed/);
  });

  it('rolls back header when lines insert fails', async () => {
    mockInsertLines.mockResolvedValueOnce({ error: { message: 'Lines failed' } });

    await expect(
      AccountingEngineService.postJournalEntry({
        tenant_id: TENANT_ID,
        description: 'Test',
        lines: [
          { account_id: CASH_ID, debit_amount: 100, credit_amount: 0 },
          { account_id: REV_ID, debit_amount: 0, credit_amount: 100 },
        ],
      })
    ).rejects.toThrow(/Lines failed/);

    // Verify rollback (DELETE on journal_entries) was called
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'entry-uuid-1');
  });

  it('reports rollback failure when header delete fails after lines insert fails', async () => {
    mockInsertLines.mockResolvedValueOnce({ error: { message: 'Lines failed' } });
    mockDeleteEq.mockResolvedValueOnce({ error: { message: 'Header rollback failed' } });

    await expect(
      AccountingEngineService.postJournalEntry({
        tenant_id: TENANT_ID,
        description: 'Test',
        lines: [
          { account_id: CASH_ID, debit_amount: 100, credit_amount: 0 },
          { account_id: REV_ID, debit_amount: 0, credit_amount: 100 },
        ],
      })
    ).rejects.toThrow(/Lines failed; rollback failed: journal entry entry-uuid-1: Header rollback failed/);

    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'entry-uuid-1');
  });

  it('rolls back header and lines when POST update fails', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'Post failed' } });

    await expect(
      AccountingEngineService.postJournalEntry({
        tenant_id: TENANT_ID,
        description: 'Test',
        lines: [
          { account_id: CASH_ID, debit_amount: 100, credit_amount: 0 },
          { account_id: REV_ID, debit_amount: 0, credit_amount: 100 },
        ],
      })
    ).rejects.toThrow(/Failed to post journal entry.*Post failed/);

    expect(mockDeleteLines).toHaveBeenCalled();
    expect(mockDeleteLinesEq).toHaveBeenCalledWith('entry_id', 'entry-uuid-1');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'entry-uuid-1');
  });

  it('reports line and header rollback failures when POST update fails', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'Post failed' } });
    mockDeleteLinesEq.mockResolvedValueOnce({ error: { message: 'Line rollback failed' } });
    mockDeleteEq.mockResolvedValueOnce({ error: { message: 'Header rollback failed' } });

    await expect(
      AccountingEngineService.postJournalEntry({
        tenant_id: TENANT_ID,
        description: 'Test',
        lines: [
          { account_id: CASH_ID, debit_amount: 100, credit_amount: 0 },
          { account_id: REV_ID, debit_amount: 0, credit_amount: 100 },
        ],
      })
    ).rejects.toThrow(
      /Failed to post journal entry: Post failed; rollback failed: journal lines for entry-uuid-1: Line rollback failed; journal entry entry-uuid-1: Header rollback failed/
    );

    expect(mockDeleteLines).toHaveBeenCalled();
    expect(mockDeleteLinesEq).toHaveBeenCalledWith('entry_id', 'entry-uuid-1');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'entry-uuid-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RevenueRecognitionService.handlePackageSale
// ═══════════════════════════════════════════════════════════════════════════

describe('RevenueRecognitionService.handlePackageSale', () => {
  it('produces a balanced 3-line entry with VAT (Nợ 111 / Có 3387 + Có 3331)', async () => {
    // Mock account lookups: 111, 3387, 3331 in order
    mockSingle
      .mockResolvedValueOnce({ data: { id: CASH_ID }, error: null })       // 111
      .mockResolvedValueOnce({ data: { id: UNEARNED_ID }, error: null })   // 3387
      .mockResolvedValueOnce({ data: { id: VAT_ID }, error: null })        // 3331
      .mockResolvedValueOnce({ data: { id: 'entry-uuid-2' }, error: null }); // header

    const id = await RevenueRecognitionService.handlePackageSale({
      tenantId: TENANT_ID,
      packageSaleId: 'package-sale-1',
      totalAmount: 1080000, // bao gồm 8% VAT
      vatRate: 0.08,
      description: 'Gói Mẹ & Bé 10 buổi',
    });

    expect(id).toBe('entry-uuid-2');

    // Tổng VAT = 1080000 * (0.08 / 1.08) = 80000
    // Doanh thu chưa thực hiện = 1080000 - 80000 = 1000000
    const linesCall = mockInsertLines.mock.calls[0][0];
    expect(linesCall).toHaveLength(3);

    // Sum debit phải bằng sum credit
    const totalDebit = linesCall.reduce((s: number, l: any) => s + l.debit_amount, 0);
    const totalCredit = linesCall.reduce((s: number, l: any) => s + l.credit_amount, 0);
    expect(totalDebit).toBe(1080000);
    expect(totalCredit).toBeCloseTo(1080000, 2);
  });

  it('produces a 2-line entry without VAT', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: CASH_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: UNEARNED_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: 'entry-uuid-3' }, error: null });

    await RevenueRecognitionService.handlePackageSale({
      tenantId: TENANT_ID,
      packageSaleId: 'package-sale-2',
      totalAmount: 500000,
      description: 'Gói lẻ',
    });

    const linesCall = mockInsertLines.mock.calls[0][0];
    expect(linesCall).toHaveLength(2);
    expect(linesCall[0].debit_amount).toBe(500000);
    expect(linesCall[1].credit_amount).toBe(500000);
  });

  it('throws clear error when account code missing in COA', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    await expect(
      RevenueRecognitionService.handlePackageSale({
        tenantId: TENANT_ID,
        packageSaleId: 'package-sale-3',
        totalAmount: 100000,
        description: 'Test',
      })
    ).rejects.toThrow(/Account code 111 not found for tenant/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RevenueRecognitionService.handleSessionDone
// ═══════════════════════════════════════════════════════════════════════════

describe('RevenueRecognitionService.handleSessionDone', () => {
  it('produces a balanced 4-line entry (revenue recog + KTV commission)', async () => {
    // Mock 4 account lookups: 3387, 5111, 6421, 334
    mockSingle
      .mockResolvedValueOnce({ data: { id: UNEARNED_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: RECEIVABLE_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: REV_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: EXPENSE_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: PAYABLE_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: 'entry-uuid-4' }, error: null }); // header

    const id = await RevenueRecognitionService.handleSessionDone({
      tenantId: TENANT_ID,
      sessionLogId: 'session-log-1',
      earnedRevenueAmount: 100000, // doanh thu/buổi
      commissionAmount: 30000,     // hoa hồng KTV
      ktvId: 'ktv-uuid-1',
      description: 'Buổi 1/10',
    });

    expect(id).toBe('entry-uuid-4');

    const linesCall = mockInsertLines.mock.calls[0][0];
    expect(linesCall).toHaveLength(4);

    const totalDebit = linesCall.reduce((s: number, l: any) => s + l.debit_amount, 0);
    const totalCredit = linesCall.reduce((s: number, l: any) => s + l.credit_amount, 0);
    expect(totalDebit).toBe(130000);
    expect(totalCredit).toBe(130000);

    // KTV ID phải nằm trên 2 lines hoa hồng (6421 + 334)
    const ktvLines = linesCall.filter((l: any) => l.ktv_id === 'ktv-uuid-1');
    expect(ktvLines).toHaveLength(2);
  });

  it('splits completed session revenue between deferred revenue and receivables', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: UNEARNED_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: RECEIVABLE_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: REV_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: EXPENSE_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: PAYABLE_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: 'entry-uuid-5' }, error: null });

    await RevenueRecognitionService.handleSessionDone({
      tenantId: TENANT_ID,
      sessionLogId: 'session-log-split',
      earnedRevenueAmount: 180000,
      deferredRevenueAmount: 100000,
      receivableAmount: 80000,
      commissionAmount: 30000,
      ktvId: 'ktv-uuid-1',
      description: 'Buoi da lam nhung chua thu du tien',
    });

    const linesCall = mockInsertLines.mock.calls[0][0];
    expect(linesCall).toHaveLength(5);
    expect(linesCall).toEqual(expect.arrayContaining([
      expect.objectContaining({ account_id: UNEARNED_ID, debit_amount: 100000, credit_amount: 0 }),
      expect.objectContaining({ account_id: RECEIVABLE_ID, debit_amount: 80000, credit_amount: 0 }),
      expect.objectContaining({ account_id: REV_ID, debit_amount: 0, credit_amount: 180000 }),
    ]));
  });

  it('returns null when both revenue and commission are zero', async () => {
    // Mock 4 account lookups (vẫn fetch dù không dùng)
    mockSingle
      .mockResolvedValueOnce({ data: { id: UNEARNED_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: RECEIVABLE_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: REV_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: EXPENSE_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: PAYABLE_ID }, error: null });

    const result = await RevenueRecognitionService.handleSessionDone({
      tenantId: TENANT_ID,
      sessionLogId: 'session-log-2',
      earnedRevenueAmount: 0,
      commissionAmount: 0,
      ktvId: 'ktv-uuid-1',
      description: 'Empty',
    });

    expect(result).toBeNull();
    expect(mockInsertLines).not.toHaveBeenCalled();
  });
});

describe('RevenueRecognitionService.handleExpenseRecorded', () => {
  it('maps salary expenses to TT133 account 6421', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: EXPENSE_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: BANK_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: 'entry-uuid-expense-salary' }, error: null });

    const id = await RevenueRecognitionService.handleExpenseRecorded({
      tenantId: TENANT_ID,
      expenseId: 'expense-salary-1',
      amount: 7000000,
      category: 'salary',
      paymentMethod: 'bank_transfer',
      description: 'Luong nhan vien thang 05',
    });

    expect(id).toBe('entry-uuid-expense-salary');

    const linesCall = mockInsertLines.mock.calls[0][0];
    expect(linesCall).toEqual(expect.arrayContaining([
      expect.objectContaining({ account_id: EXPENSE_ID, debit_amount: 7000000, credit_amount: 0 }),
      expect.objectContaining({ account_id: BANK_ID, debit_amount: 0, credit_amount: 7000000 }),
    ]));
  });
});

describe('RevenueRecognitionService.handleInterBranchClearing', () => {
  it('posts debtor-side clearing as service cost paid by bank', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: COGS_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: BANK_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: 'entry-uuid-clearing-debtor' }, error: null });

    const id = await RevenueRecognitionService.handleInterBranchClearing({
      tenantId: 'branch-a-id',
      clearingRecordId: 'clearing-id',
      amount: 180000,
      role: 'debtor',
      paymentMethod: 'bank_transfer',
      debtorTenantId: 'branch-a-id',
      creditorTenantId: 'branch-b-id',
      description: 'CLR-2026-06',
    });

    expect(id).toBe('entry-uuid-clearing-debtor');
    expect(mockInsertLines).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ account_id: COGS_ID, debit_amount: 180000, credit_amount: 0 }),
      expect.objectContaining({ account_id: BANK_ID, debit_amount: 0, credit_amount: 180000 }),
    ]));
  });

  it('posts creditor-side clearing as bank receipt and service revenue', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: BANK_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: REV_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: 'entry-uuid-clearing-creditor' }, error: null });

    const id = await RevenueRecognitionService.handleInterBranchClearing({
      tenantId: 'branch-b-id',
      clearingRecordId: 'clearing-id',
      amount: 180000,
      role: 'creditor',
      paymentMethod: 'bank_transfer',
      debtorTenantId: 'branch-a-id',
      creditorTenantId: 'branch-b-id',
      description: 'CLR-2026-06',
    });

    expect(id).toBe('entry-uuid-clearing-creditor');
    expect(mockInsertLines).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ account_id: BANK_ID, debit_amount: 180000, credit_amount: 0 }),
      expect.objectContaining({ account_id: REV_ID, debit_amount: 0, credit_amount: 180000 }),
    ]));
  });

  it('rejects debtor events routed to the wrong tenant', async () => {
    await expect(
      RevenueRecognitionService.handleInterBranchClearing({
        tenantId: 'branch-b-id',
        clearingRecordId: 'clearing-id',
        amount: 180000,
        role: 'debtor',
        paymentMethod: 'bank_transfer',
        debtorTenantId: 'branch-a-id',
        creditorTenantId: 'branch-b-id',
        description: 'CLR-2026-06',
      })
    ).rejects.toThrow(/debtor tenant mismatch/i);
  });
});

describe('RevenueRecognitionService.handleRefundIssued', () => {
  it('defaults legacy refund payloads to reducing recognized service revenue', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: REV_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: CASH_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: 'entry-uuid-refund-1' }, error: null });

    const id = await RevenueRecognitionService.handleRefundIssued({
      tenantId: TENANT_ID,
      refundId: 'refund-legacy',
      amount: 300000,
      paymentMethod: 'cash',
      description: 'Legacy refund payload',
    });

    expect(id).toBe('entry-uuid-refund-1');

    const linesCall = mockInsertLines.mock.calls[0][0];
    expect(linesCall).toHaveLength(2);
    expect(linesCall).toEqual(expect.arrayContaining([
      expect.objectContaining({ account_id: REV_ID, debit_amount: 300000, credit_amount: 0 }),
      expect.objectContaining({ account_id: CASH_ID, debit_amount: 0, credit_amount: 300000 }),
    ]));
  });

  it('splits refunds between unearned revenue and recognized service revenue', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: UNEARNED_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: REV_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: BANK_ID }, error: null })
      .mockResolvedValueOnce({ data: { id: 'entry-uuid-refund-2' }, error: null });

    await RevenueRecognitionService.handleRefundIssued({
      tenantId: TENANT_ID,
      refundId: 'refund-split',
      amount: 300000,
      deferredRefundAmount: 120000,
      revenueReductionAmount: 180000,
      paymentMethod: 'bank_transfer',
      description: 'Split refund payload',
    });

    const linesCall = mockInsertLines.mock.calls[0][0];
    expect(linesCall).toHaveLength(3);
    expect(linesCall).toEqual(expect.arrayContaining([
      expect.objectContaining({ account_id: UNEARNED_ID, debit_amount: 120000, credit_amount: 0 }),
      expect.objectContaining({ account_id: REV_ID, debit_amount: 180000, credit_amount: 0 }),
      expect.objectContaining({ account_id: BANK_ID, debit_amount: 0, credit_amount: 300000 }),
    ]));

    const totalDebit = linesCall.reduce((s: number, l: any) => s + l.debit_amount, 0);
    const totalCredit = linesCall.reduce((s: number, l: any) => s + l.credit_amount, 0);
    expect(totalDebit).toBe(300000);
    expect(totalCredit).toBe(300000);
  });

  it('rejects refund splits that do not match the total refund amount', async () => {
    await expect(
      RevenueRecognitionService.handleRefundIssued({
        tenantId: TENANT_ID,
        refundId: 'refund-invalid-split',
        amount: 300000,
        deferredRefundAmount: 120000,
        revenueReductionAmount: 100000,
        paymentMethod: 'cash',
        description: 'Invalid refund split',
      })
    ).rejects.toThrow(/does not match refund amount/);

    expect(mockInsertLines).not.toHaveBeenCalled();
  });
});
