import { supabase } from '@/lib/supabase';
import { accountingOutboxListener, OutboxClaimedEvent } from '../application/AccountingOutboxListener';

type QueryResult<T> = {
  data?: T;
  error: Error | null;
};

type AccountRow = {
  id: string;
  account_code: string;
};

type JournalEntryRow = {
  id: string;
};

type AccountsBuilder = {
  select: jest.MockedFunction<() => AccountsBuilder>;
  eq: jest.MockedFunction<(column: string, value: string) => AccountsBuilder>;
  in: jest.MockedFunction<(column: string, values: string[]) => Promise<QueryResult<AccountRow[]>>>;
};

type EntriesBuilder = {
  insert: jest.MockedFunction<(payload: Record<string, unknown>) => EntriesBuilder>;
  select: jest.MockedFunction<(columns: string) => EntriesBuilder>;
  single: jest.MockedFunction<() => Promise<QueryResult<JournalEntryRow>>>;
  update: jest.MockedFunction<(payload: Record<string, unknown>) => EntriesBuilder>;
  eq: jest.MockedFunction<(column: string, value: string) => Promise<QueryResult<unknown>>>;
};

type LinesBuilder = {
  insert: jest.MockedFunction<(payload: Record<string, unknown>[]) => Promise<QueryResult<unknown>>>;
};

type MockTableBuilder = AccountsBuilder | EntriesBuilder | LinesBuilder;

type SupabaseMockTarget = {
  from: (table: string) => MockTableBuilder;
  rpc: (functionName: string, args: Record<string, unknown>) => Promise<QueryResult<unknown>>;
};

function assertSupabaseMockTarget(value: unknown): asserts value is SupabaseMockTarget {
  if (!value || typeof value !== 'object') {
    throw new Error('Supabase mock target is not available');
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.from !== 'function' || typeof candidate.rpc !== 'function') {
    throw new Error('Supabase mock target is missing required methods');
  }
}

describe('AccountingOutboxListener', () => {
  const tenantId = 'tenant-123';
  const outboxId = 'outbox-456';
  const referenceId = 'ref-789';

  let spyFrom: jest.SpiedFunction<SupabaseMockTarget['from']>;
  let spyRpc: jest.SpiedFunction<SupabaseMockTarget['rpc']>;

  const accountsBuilder: AccountsBuilder = {
    select: jest.fn(() => accountsBuilder),
    eq: jest.fn(() => accountsBuilder),
    in: jest.fn(),
  };

  const entriesBuilder: EntriesBuilder = {
    insert: jest.fn(() => entriesBuilder),
    select: jest.fn(() => entriesBuilder),
    single: jest.fn(),
    update: jest.fn(() => entriesBuilder),
    eq: jest.fn(),
  };

  const linesBuilder: LinesBuilder = {
    insert: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    accountsBuilder.select.mockReturnThis();
    accountsBuilder.eq.mockReturnThis();

    entriesBuilder.insert.mockReturnThis();
    entriesBuilder.select.mockReturnThis();
    entriesBuilder.update.mockReturnThis();

    assertSupabaseMockTarget(supabase);
    spyFrom = jest.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'accounting_accounts') return accountsBuilder;
      if (table === 'journal_entries') return entriesBuilder;
      if (table === 'journal_lines') return linesBuilder;
      throw new Error(`Unexpected table mock: ${table}`);
    });

    spyRpc = jest.spyOn(supabase, 'rpc');
  });

  afterEach(() => {
    spyFrom.mockRestore();
    spyRpc.mockRestore();
  });

  const event: OutboxClaimedEvent = {
    id: outboxId,
    tenant_id: tenantId,
    event_type: 'PACKAGE_SALE',
    reference_type: 'BOOKING',
    reference_id: referenceId,
    payload: {
      saleType: 'RE_BOOKING_FEE',
      amount: 50000000,
      productId: 'prod-999',
      customerId: 'cust-888',
    },
  };

  it('should process booking fee outbox event, resolve accounts and post entry', async () => {
    // 1. mock resolve accounts
    accountsBuilder.in.mockResolvedValueOnce({
      data: [
        { id: 'acc-debit-112', account_code: '112' },
        { id: 'acc-credit-3387', account_code: '3387' },
      ],
      error: null,
    });

    // 2. mock insert header
    entriesBuilder.single.mockResolvedValueOnce({
      data: { id: 'entry-777' },
      error: null,
    });

    // 3. mock insert lines
    linesBuilder.insert.mockResolvedValueOnce({ error: null });

    // 4. mock update status to POSTED
    entriesBuilder.eq.mockResolvedValueOnce({ error: null });

    // 5. mock mark_outbox_completed RPC
    spyRpc.mockResolvedValueOnce({ error: null });

    const entryId = await accountingOutboxListener.processEvent(event);

    expect(entryId).toBe('entry-777');
    expect(spyFrom).toHaveBeenNthCalledWith(1, 'accounting_accounts');
    expect(spyFrom).toHaveBeenNthCalledWith(2, 'journal_entries');
    expect(spyFrom).toHaveBeenNthCalledWith(3, 'journal_lines');
    expect(spyFrom).toHaveBeenNthCalledWith(4, 'journal_entries');
    expect(spyRpc).toHaveBeenCalledWith('mark_outbox_completed', {
      p_outbox_id: outboxId,
      p_journal_entry_id: 'entry-777',
    });
  });

  it('should mark outbox as failed if accounts are missing', async () => {
    // mock resolve accounts returning empty array
    accountsBuilder.in.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    // mock mark_outbox_failed RPC
    spyRpc.mockResolvedValueOnce({ error: null });

    await expect(accountingOutboxListener.processEvent(event)).rejects.toThrow(
      'Accounting accounts not configured for codes: 112, 3387'
    );

    expect(spyRpc).toHaveBeenCalledWith('mark_outbox_failed', {
      p_outbox_id: outboxId,
      p_error: 'Accounting accounts not configured for codes: 112, 3387',
    });
  });
});
