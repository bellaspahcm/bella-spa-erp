const mockCreateClient = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockGetLocalDateString = jest.fn((date: Date) => date.toISOString().slice(0, 10));

jest.mock('@/lib/supabase-server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

jest.mock('@/lib/utils', () => ({
  getLocalDateString: (date: Date) => mockGetLocalDateString(date),
}));

type QueryResult = {
  data?: unknown;
  count?: number | null;
  error: { message: string } | null;
};

type QueryCall = {
  table: string;
  selectColumns?: string;
  selectOptions?: unknown;
  filters: Array<{ method: string; args: unknown[] }>;
  orders: Array<{ column: string; options?: unknown }>;
};

const queryCalls: QueryCall[] = [];
let scriptedResults: QueryResult[] = [];

class QueryBuilder implements PromiseLike<QueryResult> {
  private selectColumns?: string;
  private selectOptions?: unknown;
  private filters: Array<{ method: string; args: unknown[] }> = [];
  private orders: Array<{ column: string; options?: unknown }> = [];

  constructor(private readonly table: string) {}

  select(columns?: string, options?: unknown) {
    this.selectColumns = columns;
    this.selectOptions = options;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ method: 'eq', args: [column, value] });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.filters.push({ method: 'not', args: [column, operator, value] });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ method: 'in', args: [column, values] });
    return this;
  }

  order(column: string, options?: unknown) {
    this.orders.push({ column, options });
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    queryCalls.push({
      table: this.table,
      selectColumns: this.selectColumns,
      selectOptions: this.selectOptions,
      filters: [...this.filters],
      orders: [...this.orders],
    });

    return Promise.resolve(scriptedResults.shift() ?? { data: null, count: null, error: null })
      .then(onfulfilled, onrejected);
  }
}

const mockSupabase = {
  from: jest.fn((table: string) => new QueryBuilder(table)),
};

import { getCRMStats, getUpcomingSessions } from '@/services/crm/stats';

describe('CRM stats read actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-02T05:00:00.000Z'));
    queryCalls.length = 0;
    scriptedResults = [];
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      tenant_id: 'tenant-1',
      role: 'admin',
    });
    mockGetLocalDateString.mockImplementation((date: Date) => date.toISOString().slice(0, 10));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns CRM stats when all read queries succeed', async () => {
    scriptedResults = [
      { count: 7, error: null },
      { count: 3, error: null },
      {
        data: [
          { dob_baby: '2024-06-02T05:00:00.000Z' },
          { dob_baby: '2024-06-15T05:00:00.000Z' },
          { dob_baby: '2024-07-02T05:00:00.000Z' },
        ],
        error: null,
      },
    ];

    await expect(getCRMStats()).resolves.toEqual({
      totalRemindersSent: 7,
      pendingRemindersToday: 3,
      totalBirthdaysToday: 1,
      totalBirthdaysMonth: 2,
    });

    expect(queryCalls.map((call) => call.table)).toEqual(['session_logs', 'session_logs', 'customers']);
    expect(queryCalls[1].filters).toEqual(expect.arrayContaining([
      { method: 'eq', args: ['assigned_date', '2026-06-02'] },
      { method: 'eq', args: ['zalo_reminder_sent', false] },
    ]));
  });

  it('returns the empty CRM stats snapshot when current user has no tenant id', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 'admin-1',
      tenant_id: null,
      role: 'admin',
    });

    await expect(getCRMStats()).resolves.toEqual({
      totalRemindersSent: 0,
      pendingRemindersToday: 0,
      totalBirthdaysToday: 0,
      totalBirthdaysMonth: 0,
    });

    expect(queryCalls).toHaveLength(0);
  });

  it('rejects sent reminder count failures instead of returning zero stats', async () => {
    scriptedResults = [
      { count: null, error: { message: 'sent count failed' } },
    ];

    await expect(getCRMStats()).rejects.toThrow(
      '[getCRMStats] session_logs sent-reminders count failed: sent count failed',
    );

    expect(queryCalls).toHaveLength(1);
  });

  it('rejects pending reminder count failures instead of returning zero stats', async () => {
    scriptedResults = [
      { count: 7, error: null },
      { count: null, error: { message: 'pending count failed' } },
    ];

    await expect(getCRMStats()).rejects.toThrow(
      '[getCRMStats] session_logs pending-reminders count failed: pending count failed',
    );

    expect(queryCalls).toHaveLength(2);
  });

  it('rejects birthday query failures instead of returning zero birthday counts', async () => {
    scriptedResults = [
      { count: 7, error: null },
      { count: 3, error: null },
      { data: null, error: { message: 'birthdays blocked' } },
    ];

    await expect(getCRMStats()).rejects.toThrow(
      '[getCRMStats] customers birthday query failed: birthdays blocked',
    );

    expect(queryCalls).toHaveLength(3);
  });

  it('returns upcoming sessions when the read query succeeds', async () => {
    const sessions = [
      { id: 'session-1', assigned_date: '2026-06-02' },
      { id: 'session-2', assigned_date: '2026-06-03' },
    ];
    scriptedResults = [
      { data: sessions, error: null },
    ];
    mockGetLocalDateString
      .mockReturnValueOnce('2026-06-02')
      .mockReturnValueOnce('2026-06-03');

    await expect(getUpcomingSessions()).resolves.toEqual(sessions);

    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0]).toEqual(expect.objectContaining({
      table: 'session_logs',
      filters: expect.arrayContaining([
        { method: 'eq', args: ['tenant_id', 'tenant-1'] },
        { method: 'in', args: ['assigned_date', ['2026-06-02', '2026-06-03']] },
      ]),
    }));
  });

  it('returns an empty upcoming session list when current user has no tenant id', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 'admin-1',
      tenant_id: null,
      role: 'admin',
    });

    await expect(getUpcomingSessions()).resolves.toEqual([]);

    expect(queryCalls).toHaveLength(0);
  });

  it('rejects upcoming session read failures instead of returning an empty list', async () => {
    scriptedResults = [
      { data: null, error: { message: 'upcoming blocked' } },
    ];

    await expect(getUpcomingSessions()).rejects.toThrow(
      '[getUpcomingSessions] session_logs upcoming query failed: upcoming blocked',
    );

    expect(queryCalls).toHaveLength(1);
  });
});
