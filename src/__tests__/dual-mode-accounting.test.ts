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
const mockIs = jest.fn();
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

import {
  getAccountingMode,
  getLegacyLedgerSyncPreview,
  updateAccountingMode,
  syncLegacyToLedger,
} from '../services/accounting-actions';
import fs from 'fs';
import path from 'path';
import { recordTransaction, confirmTransaction } from '../services/finance-actions';
import { allocateOrphanedRevenue, collectDebtPayment } from '../services/reconciliation-actions';
import { safeRevalidatePath } from '../lib/revalidate';

const TENANT_ID = 'tenant-uuid-123';
const ADMIN_USER = { id: 'admin-1', tenant_id: TENANT_ID, role: 'admin' };
const KTV_USER = { id: 'ktv-1', tenant_id: TENANT_ID, role: 'ktv' };
const READY_ACCOUNTING_ROWS = [
  {
    source_table: 'revenue',
    total_records: 10,
    classified_records: 10,
    missing_business_event: 0,
    needs_review: 0,
    posting_failed: 0,
  },
];

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
  chain.is = mockIs.mockImplementation(() => Promise.resolve({ data: null, error: null }));
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
  mockRpc.mockImplementation((fnName: string) => {
    if (fnName === 'get_accounting_readiness') {
      return Promise.resolve({ data: READY_ACCOUNTING_ROWS, error: null });
    }
    if (fnName === 'sync_legacy_to_ledger_atomic') {
      return Promise.resolve({
        data: [
          {
            synced_revenue_count: 1,
            synced_expense_count: 0,
            synced_salary_count: 0,
          },
        ],
        error: null,
      });
    }
    if (fnName === 'preview_legacy_ledger_sync') {
      return Promise.resolve({
        data: [
          {
            pending_revenue_count: 1,
            pending_expense_count: 0,
            pending_salary_count: 0,
            journal_entries_to_create: 1,
            revenue_amount: 500000,
            expense_amount: 0,
            salary_amount: 0,
          },
        ],
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });
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
    expect(mockRpc).toHaveBeenCalledWith('get_accounting_readiness', {
      p_tenant_id: TENANT_ID,
    });
  });

  it('returns an explicit failure when accounting readiness blocks PROFESSIONAL mode', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockImplementationOnce((fnName: string) => {
      if (fnName === 'get_accounting_readiness') {
        return Promise.resolve({
          data: [
            {
              source_table: 'expenses',
              total_records: 4,
              classified_records: 2,
              missing_business_event: 1,
              needs_review: 1,
              posting_failed: 0,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await updateAccountingMode('PROFESSIONAL');

    expect(res.success).toBe(false);
    if (res.success) throw new Error('Expected readiness gate to block PROFESSIONAL mode');
    expect(res.error).toMatch(/Professional Core/);
    expect(res.blockingReasons.join(' ')).toMatch(/chưa phân loại nghiệp vụ kế toán/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('blocks non-admin users from changing accounting mode', async () => {
    mockGetCurrentUser.mockResolvedValue(KTV_USER);
    await expect(updateAccountingMode('PROFESSIONAL')).rejects.toThrow(/Unauthorized/);
  });

  it('returns legacy ledger sync preview for admin users', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);

    const preview = await getLegacyLedgerSyncPreview();

    expect(preview).toMatchObject({
      pending_revenue_count: 1,
      journal_entries_to_create: 1,
      revenue_amount: 500000,
    });
    expect(mockRpc).toHaveBeenCalledWith('preview_legacy_ledger_sync', {
      p_tenant_id: TENANT_ID,
    });
  });
});

describe('Legacy Syncing Engine', () => {
  it('syncs legacy data to ledger idempotent-safely and upgrades tenant to PROFESSIONAL', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);

    const res = await syncLegacyToLedger();
    expect(res.success).toBe(true);
    expect(res.syncedRevenueCount).toBe(1);
    expect(res.syncedExpenseCount).toBe(0);
    expect(mockRpc).toHaveBeenCalledWith('sync_legacy_to_ledger_atomic', {
      p_tenant_id: TENANT_ID,
      p_created_by: ADMIN_USER.id,
    });
    expect(safeRevalidatePath).toHaveBeenCalledWith('/dashboard/accounting/reconciliation');
    expect(safeRevalidatePath).toHaveBeenCalledWith('/dashboard/accounting/readiness');
  });

  it('returns an explicit failure when readiness gate blocks legacy sync', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_accounting_readiness') {
        return Promise.resolve({
          data: [
            {
              source_table: 'revenue',
              total_records: 4,
              classified_records: 0,
              missing_business_event: 4,
              needs_review: 0,
              posting_failed: 0,
            },
          ],
          error: null,
        });
      }
      if (fnName === 'sync_legacy_to_ledger_atomic') {
        throw new Error('sync should not run when readiness blocks');
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await syncLegacyToLedger();

    expect(res.success).toBe(false);
    if (res.success) throw new Error('Expected readiness gate to block legacy sync');
    expect(res.error).toMatch(/Professional Core/);
    expect(res.readinessScore).toBeLessThan(95);
    expect(res.blockingReasons.join(' ')).toMatch(/4/);
    expect(mockRpc).not.toHaveBeenCalledWith('sync_legacy_to_ledger_atomic', expect.anything());
    expect(safeRevalidatePath).not.toHaveBeenCalled();
  });

  it('propagates atomic sync RPC failures without silently succeeding', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_accounting_readiness') {
        return Promise.resolve({ data: READY_ACCOUNTING_ROWS, error: null });
      }
      if (fnName === 'sync_legacy_to_ledger_atomic') {
        return Promise.resolve({
          data: null,
          error: { message: 'Missing required COA accounts 111, 112, 5113 or 3387.' },
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await expect(syncLegacyToLedger()).rejects.toMatchObject({
      message: 'Missing required COA accounts 111, 112, 5113 or 3387.',
    });
  });
});

describe('Legacy revenue sync SQL migration', () => {
  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260603040000_branch_legacy_revenue_sync_by_type.sql'),
    'utf8'
  );

  it('branches historical package payments to deferred revenue 3387', () => {
    expect(migrationSql).toContain("IN ('deposit', 'remaining_payment', 'package_payment', 'package_sale') THEN 'PACKAGE_SALE'");
    expect(migrationSql).toContain("account_code = '3387'");
    expect(migrationSql).toContain('(v_entry_id, v_unearned_revenue_acc, 0, v_amount)');
  });

  it('branches historical direct service revenue to TT133 service revenue 5113', () => {
    expect(migrationSql).toContain("account_code = '5113'");
    expect(migrationSql).toContain("ELSE 'REVENUE'");
    expect(migrationSql).toContain('(v_entry_id, v_service_revenue_acc, 0, v_amount)');
    expect(migrationSql).not.toContain("account_code = '5111'");
    expect(migrationSql).not.toContain('111, 112 or 5111');
  });

  it('branches historical refund rows to debit 5113 and credit the payment account', () => {
    expect(migrationSql).toContain("= 'refund' THEN 'REFUND'");
    expect(migrationSql).toContain("IF rec.legacy_reference_type = 'REFUND' THEN");
    expect(migrationSql).toContain('(v_entry_id, v_service_revenue_acc, v_amount, 0)');
    expect(migrationSql).toContain('(v_entry_id, v_payment_account_id, 0, v_amount)');
  });

  it('uses branch-specific idempotency in preview and sync', () => {
    expect(migrationSql).toContain('AND je.reference_type = r.legacy_reference_type');
    expect(migrationSql).toContain('AND je.reference_type = CASE');
  });
});

describe('Legacy expense paid-status sync SQL migration', () => {
  const paidExpenseStatusMigrationSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260603070000_tt133_legacy_expense_paid_status.sql'),
    'utf8'
  );

  it('upgrades legacy sync and preview to include paid expenses', () => {
    expect(paidExpenseStatusMigrationSql).toContain("e.status IN (''approved'', ''paid'')");
    expect(paidExpenseStatusMigrationSql).toContain('sync_legacy_to_ledger_atomic');
    expect(paidExpenseStatusMigrationSql).toContain('preview_legacy_ledger_sync');
  });
});

describe('Professional readiness scope SQL migration', () => {
  const readinessScopeMigrationSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260604160000_scope_professional_readiness_to_legacy_sync.sql'),
    'utf8'
  );

  it('scopes readiness to rows the legacy sync can actually post', () => {
    expect(readinessScopeMigrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_accounting_readiness');
    expect(readinessScopeMigrationSql).toContain("AND status = 'confirmed'");
    expect(readinessScopeMigrationSql).toContain("AND status IN ('approved', 'paid')");
    expect(readinessScopeMigrationSql).toContain("AND status = 'paid'");
    expect(readinessScopeMigrationSql).toContain('Session logs and inventory logs can still need metadata review');
  });

  it('updates sync_legacy_to_ledger_atomic to use the same scoped readiness gate', () => {
    expect(readinessScopeMigrationSql).toContain("pg_get_functiondef('public.sync_legacy_to_ledger_atomic(uuid, uuid)'::regprocedure)");
    expect(readinessScopeMigrationSql).toContain('v_old_readiness_sql');
    expect(readinessScopeMigrationSql).toContain('v_new_readiness_sql');
    expect(readinessScopeMigrationSql).toContain('readiness gate is scoped to rows this sync actually posts');
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
    ).rejects.toThrow(/Professional Core/);
  });

  it('blocks manually confirmTransaction if mode is PROFESSIONAL', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    // Mock accounting_mode is PROFESSIONAL
    mockSingle.mockResolvedValueOnce({ data: { accounting_mode: 'PROFESSIONAL' }, error: null });

    await expect(confirmTransaction('rev-1', 'revenue')).rejects.toThrow(/Professional Core/);
  });

  it('blocks manually recordTransaction if the accounting period is closed', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'ensure_open_period') {
        return Promise.resolve({
          data: null,
          error: { message: 'Accounting period is closed' },
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await expect(
      recordTransaction({
        amount: 200000,
        type: 'expense',
        category: 'other_admin',
        notes: 'Mua khan giay',
      })
    ).rejects.toThrow(/accounting period is closed/i);

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('blocks reconciliation debt collection if mode is PROFESSIONAL', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockSingle.mockResolvedValueOnce({ data: { accounting_mode: 'PROFESSIONAL' }, error: null });

    const res = await collectDebtPayment({
      bookingId: 'booking-1',
      amount: 100000,
      paymentMethod: 'bank_transfer',
      customerName: 'Me Linh',
      packageName: 'Goi cham soc',
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Professional Core/);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('blocks orphan revenue allocation if mode is PROFESSIONAL', async () => {
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
    mockSingle.mockResolvedValueOnce({ data: { accounting_mode: 'PROFESSIONAL' }, error: null });

    const res = await allocateOrphanedRevenue('rev-1', 'booking-1');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Professional Core/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
