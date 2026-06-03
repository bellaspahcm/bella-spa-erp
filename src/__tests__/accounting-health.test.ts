jest.mock('server-only', () => ({}), { virtual: true });

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSupabase = { rpc: mockRpc, from: mockFrom };

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

const mockGetCurrentUser = jest.fn();
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

import {
  assertMonthClosePreflight,
  getAccountingHealthSummary,
} from '../services/accounting-actions';

const ADMIN_USER = { id: 'admin-1', role: 'admin', tenant_id: 'tenant-a' };

let tableRows: Record<string, unknown[] | null>;
let tableErrors: Record<string, { message: string } | null>;
let readinessRows: unknown[];
let legacyPreviewRows: unknown[];

function setupTableMocks() {
  mockFrom.mockImplementation((table: string) => {
    const chain: any = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      then: (cb: any, onRejected?: any) => Promise.resolve({
        data: tableRows[table] ?? [],
        error: tableErrors[table] ?? null,
      }).then(cb, onRejected),
    };
    return chain;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
  tableRows = {
    accounting_outbox: [],
    journal_entries: [],
  };
  tableErrors = {
    accounting_outbox: null,
    journal_entries: null,
  };
  readinessRows = [
    {
      source_table: 'revenue',
      total_records: 10,
      classified_records: 10,
      missing_business_event: 0,
      needs_review: 0,
      posting_failed: 0,
    },
  ];
  legacyPreviewRows = [
    {
      pending_revenue_count: 0,
      pending_expense_count: 0,
      pending_salary_count: 0,
      journal_entries_to_create: 0,
    },
  ];
  setupTableMocks();
  mockRpc.mockImplementation((fnName: string) => {
    if (fnName === 'get_accounting_readiness') {
      return Promise.resolve({ data: readinessRows, error: null });
    }
    if (fnName === 'preview_legacy_ledger_sync') {
      return Promise.resolve({ data: legacyPreviewRows, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
});

describe('accounting health summary', () => {
  it('reports month-close blockers, warnings, and duplicate active journal references', async () => {
    tableRows.accounting_outbox = [
      {
        id: 'outbox-1',
        tenant_id: 'tenant-a',
        status: 'FAILED',
        event_type: 'PACKAGE_SALE',
        reference_type: 'REVENUE',
        reference_id: '11111111-1111-1111-1111-111111111111',
        retry_count: 2,
        last_error: 'missing account 3387',
        created_at: '2026-05-02T08:00:00Z',
      },
      {
        id: 'outbox-2',
        tenant_id: 'tenant-a',
        status: 'DEAD',
        event_type: 'SESSION_DONE',
        reference_type: 'SESSION_LOG',
        reference_id: '22222222-2222-2222-2222-222222222222',
        retry_count: 5,
        last_error: 'session no longer completed',
        created_at: '2026-05-03T08:00:00Z',
      },
      {
        id: 'outbox-3',
        tenant_id: 'tenant-a',
        status: 'PENDING',
        event_type: 'EXPENSE_RECORDED',
        reference_type: 'EXPENSE',
        reference_id: '33333333-3333-3333-3333-333333333333',
        retry_count: 0,
        last_error: null,
        created_at: '2026-05-04T08:00:00Z',
      },
    ];
    tableRows.journal_entries = [
      {
        id: 'journal-draft-may',
        tenant_id: 'tenant-a',
        status: 'DRAFT',
        reference_type: 'MANUAL',
        reference_id: '44444444-4444-4444-4444-444444444444',
        entry_date: '2026-05-05',
        description: 'Adjusting entry',
      },
      {
        id: 'journal-posted-a',
        tenant_id: 'tenant-a',
        status: 'POSTED',
        reference_type: 'PACKAGE_SALE',
        reference_id: '55555555-5555-5555-5555-555555555555',
        entry_date: '2026-05-06',
        description: 'Package sale',
      },
      {
        id: 'journal-posted-b',
        tenant_id: 'tenant-a',
        status: 'POSTED',
        reference_type: 'PACKAGE_SALE',
        reference_id: '55555555-5555-5555-5555-555555555555',
        entry_date: '2026-05-06',
        description: 'Duplicate package sale',
      },
      {
        id: 'journal-draft-june',
        tenant_id: 'tenant-a',
        status: 'DRAFT',
        reference_type: 'MANUAL',
        reference_id: '66666666-6666-6666-6666-666666666666',
        entry_date: '2026-06-01',
        description: 'Next month draft',
      },
    ];
    readinessRows = [
      {
        source_table: 'expenses',
        total_records: 4,
        classified_records: 2,
        missing_business_event: 1,
        needs_review: 1,
        posting_failed: 0,
      },
    ];
    legacyPreviewRows = [
      {
        pending_revenue_count: 1,
        pending_expense_count: 1,
        pending_salary_count: 0,
        journal_entries_to_create: 2,
      },
    ];

    const summary = await getAccountingHealthSummary('2026-05-01');

    expect(summary.severity).toBe('critical');
    expect(summary.can_close_month).toBe(false);
    expect(summary.metrics.outbox_failed).toBe(1);
    expect(summary.metrics.outbox_dead).toBe(1);
    expect(summary.metrics.outbox_pending).toBe(1);
    expect(summary.metrics.journal_draft).toBe(1);
    expect(summary.metrics.duplicate_active_references).toBe(1);
    expect(summary.metrics.legacy_journal_entries_to_create).toBe(2);
    expect(summary.blockers.map((check) => check.id)).toEqual(expect.arrayContaining([
      'outbox_dead',
      'outbox_failed',
      'journal_draft',
      'duplicate_active_references',
    ]));
    expect(summary.warnings.map((check) => check.id)).toEqual(expect.arrayContaining([
      'outbox_pending_processing',
      'readiness_advisory',
      'legacy_sync_advisory',
    ]));
    expect(summary.duplicate_journal_references).toEqual([
      expect.objectContaining({
        reference_type: 'PACKAGE_SALE',
        reference_id: '55555555-5555-5555-5555-555555555555',
        active_count: 2,
        entry_ids: ['journal-posted-a', 'journal-posted-b'],
      }),
    ]);
  });

  it('month-close preflight throws before advisory RPC checks when blockers exist', async () => {
    tableRows.accounting_outbox = [
      {
        id: 'outbox-failed',
        tenant_id: 'tenant-a',
        status: 'FAILED',
        event_type: 'PACKAGE_SALE',
        reference_type: 'REVENUE',
        reference_id: '77777777-7777-7777-7777-777777777777',
        retry_count: 1,
        last_error: 'posting failed',
        created_at: '2026-05-02T08:00:00Z',
      },
    ];

    await expect(assertMonthClosePreflight('2026-05-01')).rejects.toThrow(/Outbox FAILED/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('propagates database failures instead of silently returning a healthy summary', async () => {
    tableErrors.accounting_outbox = { message: 'permission denied for accounting_outbox' };

    await expect(getAccountingHealthSummary('2026-05-01')).rejects.toThrow(
      /permission denied for accounting_outbox/
    );
  });
});
