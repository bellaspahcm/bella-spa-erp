jest.mock('server-only', () => ({}), { virtual: true });

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type MockChain = {
  select: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  update: jest.Mock;
  order: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
};

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

const mockRecordAuditLog = jest.fn();
jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

const mockSafeRevalidatePath = jest.fn();
jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: (...args: unknown[]) => mockSafeRevalidatePath(...args),
}));

import { getOutboxEvents, replayOutboxEvent } from '../services/accounting-actions';

const ADMIN_USER = { id: 'admin-1', role: 'admin', tenant_id: 'tenant-a' };
const POSTED_JOURNAL = { id: 'journal-posted-1', status: 'POSTED' };
const DRAFT_JOURNAL = { id: 'journal-draft-1', status: 'DRAFT' };

let queuedResults: Record<string, QueryResult[]>;
let queryLog: Array<{ table: string; chain: MockChain }>;

function queueResult(table: string, result: QueryResult) {
  queuedResults[table] = queuedResults[table] || [];
  queuedResults[table].push(result);
}

function createChain(table: string, result: QueryResult): MockChain {
  const chain = {} as MockChain;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.neq = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  chain.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  queryLog.push({ table, chain });
  return chain;
}

function setupFromMock() {
  mockFrom.mockImplementation((table: string) => {
    const result = queuedResults[table]?.shift() ?? { data: null, error: null };
    return createChain(table, result);
  });
}

function buildOutboxRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'outbox-1',
    tenant_id: 'tenant-a',
    status: 'FAILED',
    event_type: 'PACKAGE_SALE',
    reference_type: 'REVENUE',
    reference_id: 'revenue-1',
    retry_count: 2,
    max_retries: 5,
    last_error: 'missing COA account 3387',
    journal_entry_id: null,
    payload: { totalAmount: 1000000 },
    created_at: '2026-06-01T00:00:00.000Z',
    next_retry_at: '2026-06-01T00:01:00.000Z',
    processed_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  queuedResults = {};
  queryLog = [];
  mockGetCurrentUser.mockResolvedValue(ADMIN_USER);
  mockRecordAuditLog.mockResolvedValue({ success: true });
  mockSafeRevalidatePath.mockResolvedValue(undefined);
  mockRpc.mockResolvedValue({ data: null, error: null });
  setupFromMock();
});

describe('accounting outbox replay safety', () => {
  it('marks the outbox completed instead of replaying when a POSTED journal already exists', async () => {
    queueResult('accounting_outbox', { data: buildOutboxRow(), error: null });
    queueResult('journal_entries', { data: POSTED_JOURNAL, error: null });

    const result = await replayOutboxEvent('outbox-1');

    expect(result).toMatchObject({
      success: true,
      action: 'completed_existing_journal',
    });
    expect(mockRpc).toHaveBeenCalledWith('mark_outbox_completed', {
      p_outbox_id: 'outbox-1',
      p_journal_entry_id: 'journal-posted-1',
    });
    expect(queryLog.filter((entry) => entry.table === 'accounting_outbox')[0].chain.update).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      table_name: 'accounting_outbox',
      record_id: 'outbox-1',
      new_data: expect.objectContaining({
        status: 'COMPLETED',
        completed_from_existing_journal: 'journal-posted-1',
      }),
    }));
  });

  it('blocks replay when an active non-posted journal already exists', async () => {
    queueResult('accounting_outbox', { data: buildOutboxRow(), error: null });
    queueResult('journal_entries', { data: DRAFT_JOURNAL, error: null });

    await expect(replayOutboxEvent('outbox-1')).rejects.toThrow(/DRAFT/);

    expect(mockRpc).not.toHaveBeenCalledWith('mark_outbox_completed', expect.anything());
    expect(queryLog.filter((entry) => entry.table === 'accounting_outbox')[0].chain.update).not.toHaveBeenCalled();
  });

  it('queues failed or dead outbox events for replay when no active journal exists', async () => {
    const outbox = buildOutboxRow({ status: 'DEAD', retry_count: 5 });
    queueResult('accounting_outbox', { data: outbox, error: null });
    queueResult('journal_entries', { data: null, error: null });
    queueResult('accounting_outbox', {
      data: buildOutboxRow({ status: 'PENDING', retry_count: 0, last_error: null }),
      error: null,
    });

    const result = await replayOutboxEvent('outbox-1');
    const updateChain = queryLog.filter((entry) => entry.table === 'accounting_outbox')[1].chain;

    expect(result).toMatchObject({
      success: true,
      action: 'queued_replay',
    });
    expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'PENDING',
      retry_count: 0,
      last_error: null,
    }));
  });

  it('blocks replay while an event is being processed', async () => {
    queueResult('accounting_outbox', { data: buildOutboxRow({ status: 'PROCESSING' }), error: null });

    await expect(replayOutboxEvent('outbox-1')).rejects.toThrow(/worker/);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('decorates outbox events with monitoring diagnostics', async () => {
    queueResult('accounting_outbox', {
      data: [
        buildOutboxRow({
          status: 'FAILED',
          last_error: 'Invalid outbox payload: totalAmount must be a number.',
          next_retry_at: '2020-01-01T00:00:00.000Z',
        }),
      ],
      error: null,
    });

    const rows = await getOutboxEvents({ status: 'FAILED' });

    expect(rows[0]).toMatchObject({
      error_category: 'invalid_payload',
      error_category_label: 'Payload sai dinh dang',
      is_stale: true,
      replay_state: 'ready',
      origin_href: '/dashboard/finance?search=revenue-1',
      journal_reference_type: 'PACKAGE_SALE',
    });
  });
});
