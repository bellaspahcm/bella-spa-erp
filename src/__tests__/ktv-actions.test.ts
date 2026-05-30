import {
  getKTVActiveSessions,
  getKTVEarnings,
  getKTVNotifications,
  getKTVUpcomingSessions,
  startSession,
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
  public updateSpy = jest.fn().mockReturnThis();

  constructor(private data: any = null, private error: any = null) {}

  select() { return this; }
  update(...args: any[]) {
    this.updateSpy(...args);
    return this;
  }
  eq() { return this; }
  neq() { return this; }
  gte() { return this; }
  lt() { return this; }
  in() { return this; }
  order() { return this; }
  single() { return this; }

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

  it('rolls back session start when booking update fails', async () => {
    const session = {
      booking_id: 'booking-1',
      session_number: 1,
      status: 'scheduled',
      start_time: null,
      completed_by_ktv_id: null,
      checkin_lat: null,
      checkin_lon: null,
      bookings: {
        customer_id: 'cust-1',
        total_sessions: 10,
        completed_sessions: 0,
        status: 'booked',
        is_in_care: false,
        customers: { latitude: 10, longitude: 106 },
      },
    };
    const fetchSession = new MockQueryBuilder(session, null);
    const startUpdate = new MockQueryBuilder(null, null);
    const bookingUpdate = new MockQueryBuilder(null, { message: 'booking update failed' });
    const rollbackSession = new MockQueryBuilder(null, null);

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(startUpdate)
      .mockReturnValueOnce(bookingUpdate)
      .mockReturnValueOnce(rollbackSession);

    const result = await startSession('session-1', 10.5, 106.5);

    expect(result).toEqual({
      success: false,
      error: 'Failed to update booking after session start: booking update failed',
    });
    expect(rollbackSession.updateSpy).toHaveBeenCalledWith({
      status: 'scheduled',
      start_time: null,
      completed_by_ktv_id: null,
      checkin_lat: null,
      checkin_lon: null,
    });
  });

  it('does not roll back a started session when non-critical customer GPS capture fails', async () => {
    const session = {
      booking_id: 'booking-1',
      session_number: 1,
      status: 'scheduled',
      start_time: null,
      completed_by_ktv_id: null,
      checkin_lat: null,
      checkin_lon: null,
      bookings: {
        customer_id: 'cust-1',
        total_sessions: 10,
        completed_sessions: 0,
        status: 'booked',
        is_in_care: false,
        customers: { latitude: null, longitude: null },
      },
    };
    const fetchSession = new MockQueryBuilder(session, null);
    const startUpdate = new MockQueryBuilder(null, null);
    const bookingUpdate = new MockQueryBuilder(null, null);
    const customerGpsUpdate = new MockQueryBuilder(null, { message: 'gps update failed' });

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(startUpdate)
      .mockReturnValueOnce(bookingUpdate)
      .mockReturnValueOnce(customerGpsUpdate);

    const result = await startSession('session-1', 10.5, 106.5);

    expect(result).toEqual({
      success: true,
      warning: 'Session started, but customer GPS coordinates were not saved: gps update failed',
    });
    expect(mockFrom).toHaveBeenCalledTimes(4);
  });
});
