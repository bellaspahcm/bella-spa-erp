import {
  getKTVActiveSessions,
  getKTVEarnings,
  getKTVNotifications,
  getKTVUpcomingSessions,
} from '../services/ktv-actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('server-only', () => ({}), { virtual: true });

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
}));

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

class MockQueryBuilder {
  constructor(private data: any = null, private error: any = null) {}

  select() { return this; }
  eq() { return this; }
  neq() { return this; }
  gte() { return this; }
  lt() { return this; }
  in() { return this; }
  order() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

describe('KTV read actions fail-fast behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'ktv-1',
      role: 'ktv',
      tenant_id: 'tenant-1',
    });
  });

  it('propagates active session query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'active sessions failed' }));

    await expect(getKTVActiveSessions()).rejects.toThrow(
      'Failed to fetch KTV active sessions: active sessions failed'
    );
  });

  it('propagates originally assigned upcoming session query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'original sessions failed' }));

    await expect(getKTVUpcomingSessions()).rejects.toThrow(
      'Failed to fetch originally assigned KTV sessions: original sessions failed'
    );
  });

  it('propagates all-session follow-up query failures for upcoming sessions', async () => {
    mockFrom
      .mockReturnValueOnce(new MockQueryBuilder([{ id: 's-1', booking_id: 'b-1' }], null))
      .mockReturnValueOnce(new MockQueryBuilder([], null))
      .mockReturnValueOnce(new MockQueryBuilder(null, { message: 'all sessions failed' }));

    await expect(getKTVUpcomingSessions()).rejects.toThrow(
      'Failed to fetch all sessions for KTV bookings: all sessions failed'
    );
  });

  it('propagates earnings query failures instead of returning zeroes', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'earnings failed' }));

    await expect(getKTVEarnings('2026-05')).rejects.toThrow(
      'Failed to fetch KTV earnings: earnings failed'
    );
  });

  it('propagates notification query failures instead of returning an empty list', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'notifications failed' }));

    await expect(getKTVNotifications()).rejects.toThrow(
      'Failed to fetch KTV notifications: notifications failed'
    );
  });
});
