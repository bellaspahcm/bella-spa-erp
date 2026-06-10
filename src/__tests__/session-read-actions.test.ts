import {
  getCalendarSessions,
  getSessionLogs,
  getSessionsWithDetails,
} from '../modules/booking/actions/session-actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();
const queryFilters: Array<{ column: string; value: unknown }> = [];

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
}));

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

class MockQueryBuilder {
  constructor(private data: any = null, private error: any = null) {}

  select() { return this; }
  eq(column?: string, value?: unknown) {
    if (column) queryFilters.push({ column, value });
    return this;
  }
  order() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

describe('session read actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryFilters.length = 0;
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', role: 'admin', tenant_id: 'tenant-1' });
  });

  it('scopes session logs to the current tenant and booking', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder([
      { id: 'session-1', booking_id: 'booking-1', tenant_id: 'tenant-1' },
    ], null));

    await expect(getSessionLogs('booking-1')).resolves.toHaveLength(1);

    expect(queryFilters).toEqual(expect.arrayContaining([
      { column: 'booking_id', value: 'booking-1' },
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('scopes session details to the current tenant', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder([], null));

    await expect(getSessionsWithDetails()).resolves.toEqual([]);

    expect(queryFilters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('scopes calendar sessions to the current tenant', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder([], null));

    await expect(getCalendarSessions()).resolves.toEqual([]);

    expect(queryFilters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('also scopes calendar sessions to the KTV when the current user is a KTV', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'ktv-1', role: 'ktv', tenant_id: 'tenant-1' });
    mockFrom.mockReturnValue(new MockQueryBuilder([], null));

    await expect(getCalendarSessions()).resolves.toEqual([]);

    expect(queryFilters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-1' },
      { column: 'bookings.assigned_ktv_id', value: 'ktv-1' },
    ]));
  });

  it('requires a tenant before reading session data', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', role: 'admin', tenant_id: null });

    await expect(getSessionLogs('booking-1')).rejects.toThrow('Failed to fetch session logs: missing tenant scope');
    await expect(getSessionsWithDetails()).rejects.toThrow('Failed to fetch sessions with details: missing tenant scope');
    await expect(getCalendarSessions()).rejects.toThrow('Failed to fetch calendar sessions: missing tenant scope');

    expect(mockFrom).not.toHaveBeenCalled();
    expect(queryFilters).toEqual([]);
  });

  it('propagates session log query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'session logs failed' }));

    await expect(getSessionLogs('booking-1')).rejects.toThrow(
      'Failed to fetch session logs for booking booking-1: session logs failed'
    );
  });

  it('propagates session details query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'session details failed' }));

    await expect(getSessionsWithDetails()).rejects.toThrow(
      'Failed to fetch sessions with details: session details failed'
    );
  });

  it('propagates calendar session query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'calendar sessions failed' }));

    await expect(getCalendarSessions()).rejects.toThrow(
      'Failed to fetch calendar sessions: calendar sessions failed'
    );
  });
});
