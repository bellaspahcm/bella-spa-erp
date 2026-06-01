import {
  getKTVActiveSessions,
  getKTVEarnings,
  getKTVNotifications,
  getKTVUpcomingSessions,
  completeKTVSession,
  startSession,
} from '../services/ktv-actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('server-only', () => ({}), { virtual: true });

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();
const mockAutoConsumeForSession = jest.fn();
const mockRollbackInventoryConsumption = jest.fn();

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
}));

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

jest.mock('../services/inventory-actions', () => ({
  autoConsumeForSession: (...args: unknown[]) => mockAutoConsumeForSession(...args),
  rollbackInventoryConsumption: (...args: unknown[]) => mockRollbackInventoryConsumption(...args),
}));

class MockQueryBuilder {
  public updateSpy = jest.fn().mockReturnThis();

  constructor(private data: any = null, private error: any = null, private count: number | null = null) {}

  select() { return this; }
  update(...args: any[]) {
    this.updateSpy(...args);
    return this;
  }
  delete() { return this; }
  eq() { return this; }
  gt() { return this; }
  neq() { return this; }
  gte() { return this; }
  lt() { return this; }
  in() { return this; }
  order() { return this; }
  single() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error, count: this.count }).then(onfulfilled);
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
    mockAutoConsumeForSession.mockResolvedValue({ success: true, bypassed: true });
    mockRollbackInventoryConsumption.mockResolvedValue({ success: true });
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
    const sessionGpsUpdate = new MockQueryBuilder(null, null);
    const customerGpsUpdate = new MockQueryBuilder(null, { message: 'gps update failed' });

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(startUpdate)
      .mockReturnValueOnce(bookingUpdate)
      .mockReturnValueOnce(sessionGpsUpdate)
      .mockReturnValueOnce(customerGpsUpdate);

    const result = await startSession('session-1', 10.5, 106.5);

    expect(result).toEqual({
      success: true,
      warning: 'Session started, but customer GPS coordinates were not saved: gps update failed',
    });
    expect(mockFrom).toHaveBeenCalledTimes(5);
  });

  it('does not roll back a started session when non-critical session GPS save fails', async () => {
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
    const bookingUpdate = new MockQueryBuilder(null, null);
    const sessionGpsUpdate = new MockQueryBuilder(null, { message: 'session gps failed' });

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(startUpdate)
      .mockReturnValueOnce(bookingUpdate)
      .mockReturnValueOnce(sessionGpsUpdate);

    const result = await startSession('session-1', 10.5, 106.5);

    expect(result).toEqual({
      success: true,
      warning: 'Session started, but check-in GPS was not saved: session gps failed',
    });
    expect(mockFrom).toHaveBeenCalledTimes(4);
  });

  it('returns combined warnings without rollback when both start GPS writes fail', async () => {
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
    const sessionGpsUpdate = new MockQueryBuilder(null, { message: 'session gps failed' });
    const customerGpsUpdate = new MockQueryBuilder(null, { message: 'customer gps failed' });

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(startUpdate)
      .mockReturnValueOnce(bookingUpdate)
      .mockReturnValueOnce(sessionGpsUpdate)
      .mockReturnValueOnce(customerGpsUpdate);

    const result = await startSession('session-1', 10.5, 106.5);

    expect(result).toEqual({
      success: true,
      warning: 'Session started, but check-in GPS was not saved: session gps failed; customer GPS coordinates were not saved: customer gps failed',
    });
    expect(mockFrom).toHaveBeenCalledTimes(5);
  });

  it('does not fail checkout when non-critical checkout GPS save fails', async () => {
    const session = {
      booking_id: 'booking-1',
      start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'in_progress',
      end_time: null,
      completed_date: null,
      notes: null,
      standard_duration: null,
      actual_duration: null,
      time_deviation: null,
      duration_warning_type: null,
      ktv_checkout_note: null,
      checkout_lat: null,
      checkout_lon: null,
      bookings: {
        package_id: null,
        packages: { duration: '60 phut' },
      },
    };
    const fetchSession = new MockQueryBuilder(session, null);
    const completeUpdate = new MockQueryBuilder(null, null);
    const checkoutGpsUpdate = new MockQueryBuilder(null, { message: 'checkout gps failed' });
    const completedCount = new MockQueryBuilder(null, null, 1);
    const fetchBooking = new MockQueryBuilder({ total_sessions: 10 }, null);
    const bookingUpdate = new MockQueryBuilder(null, null);

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(completeUpdate)
      .mockReturnValueOnce(checkoutGpsUpdate)
      .mockReturnValueOnce(completedCount)
      .mockReturnValueOnce(fetchBooking)
      .mockReturnValueOnce(bookingUpdate);

    const result = await completeKTVSession('session-1', 'notes', 'checkout note', 10.5, 106.5);

    expect(result).toEqual({
      success: true,
      warning: 'Session completed, but checkout GPS was not saved: checkout gps failed',
    });
    expect(completeUpdate.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      notes: 'notes',
      ktv_checkout_note: 'checkout note',
    }));
    expect(completeUpdate.updateSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      checkout_lat: 10.5,
      checkout_lon: 106.5,
    }));
    expect(checkoutGpsUpdate.updateSpy).toHaveBeenCalledWith({
      checkout_lat: 10.5,
      checkout_lon: 106.5,
    });
  });

  it('rolls back completed session when booking update after checkout fails', async () => {
    const session = {
      booking_id: 'booking-1',
      start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'in_progress',
      end_time: null,
      completed_date: null,
      notes: 'old notes',
      standard_duration: null,
      actual_duration: null,
      time_deviation: null,
      duration_warning_type: null,
      ktv_checkout_note: null,
      checkout_lat: null,
      checkout_lon: null,
      bookings: {
        package_id: null,
        packages: { duration: '60 phut' },
      },
    };
    const fetchSession = new MockQueryBuilder(session, null);
    const completeUpdate = new MockQueryBuilder(null, null);
    const completedCount = new MockQueryBuilder(null, null, 1);
    const fetchBooking = new MockQueryBuilder({ total_sessions: 10 }, null);
    const bookingUpdate = new MockQueryBuilder(null, { message: 'booking update failed' });
    const rollbackSession = new MockQueryBuilder(null, null);

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(completeUpdate)
      .mockReturnValueOnce(completedCount)
      .mockReturnValueOnce(fetchBooking)
      .mockReturnValueOnce(bookingUpdate)
      .mockReturnValueOnce(rollbackSession);

    const result = await completeKTVSession('session-1', 'notes', 'checkout note');

    expect(result).toEqual({
      success: false,
      error: 'Failed to update booking after completing session: booking update failed',
    });
    expect(rollbackSession.updateSpy).toHaveBeenCalledWith({
      status: 'in_progress',
      end_time: null,
      completed_date: null,
      notes: 'old notes',
      standard_duration: null,
      actual_duration: null,
      time_deviation: null,
      duration_warning_type: null,
      ktv_checkout_note: null,
      checkout_lat: null,
      checkout_lon: null,
    });
  });

  it('rolls back inventory consumption when completed-session count fails after checkout', async () => {
    const session = {
      booking_id: 'booking-1',
      start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'in_progress',
      end_time: null,
      completed_date: null,
      notes: 'old notes',
      standard_duration: null,
      actual_duration: null,
      time_deviation: null,
      duration_warning_type: null,
      ktv_checkout_note: null,
      checkout_lat: null,
      checkout_lon: null,
      bookings: {
        package_id: 'pkg-1',
        packages: { duration: '60 phut' },
      },
    };
    const fetchSession = new MockQueryBuilder(session, null);
    const completeUpdate = new MockQueryBuilder(null, null);
    const completedCount = new MockQueryBuilder(null, { message: 'count failed' });
    const rollbackSession = new MockQueryBuilder(null, null);
    mockAutoConsumeForSession.mockResolvedValue({ success: true, processed: 2, totalCost: 3000 });

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(completeUpdate)
      .mockReturnValueOnce(completedCount)
      .mockReturnValueOnce(rollbackSession);

    const result = await completeKTVSession('session-1', 'notes', 'checkout note');

    expect(result).toEqual({
      success: false,
      error: 'Failed to count completed sessions: count failed',
    });
    expect(mockAutoConsumeForSession).toHaveBeenCalledWith('pkg-1', 'session-1');
    expect(mockRollbackInventoryConsumption).toHaveBeenCalledWith('session-1');
    expect(rollbackSession.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'in_progress',
      notes: 'old notes',
    }));
  });

  it('reports inventory rollback failure when booking update fails after auto-consume', async () => {
    const session = {
      booking_id: 'booking-1',
      start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'in_progress',
      end_time: null,
      completed_date: null,
      notes: 'old notes',
      standard_duration: null,
      actual_duration: null,
      time_deviation: null,
      duration_warning_type: null,
      ktv_checkout_note: null,
      checkout_lat: null,
      checkout_lon: null,
      bookings: {
        package_id: 'pkg-1',
        packages: { duration: '60 phut' },
      },
    };
    const fetchSession = new MockQueryBuilder(session, null);
    const completeUpdate = new MockQueryBuilder(null, null);
    const completedCount = new MockQueryBuilder(null, null, 1);
    const fetchBooking = new MockQueryBuilder({ total_sessions: 10 }, null);
    const bookingUpdate = new MockQueryBuilder(null, { message: 'booking update failed' });
    const rollbackSession = new MockQueryBuilder(null, null);
    mockAutoConsumeForSession.mockResolvedValue({ success: true, processed: 1, totalCost: 1000 });
    mockRollbackInventoryConsumption.mockResolvedValue({ success: false, error: 'inventory rollback failed' });

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(completeUpdate)
      .mockReturnValueOnce(completedCount)
      .mockReturnValueOnce(fetchBooking)
      .mockReturnValueOnce(bookingUpdate)
      .mockReturnValueOnce(rollbackSession);

    const result = await completeKTVSession('session-1', 'notes', 'checkout note');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to update booking after completing session: booking update failed');
    expect(result.error).toContain('failed to roll back inventory consumption: inventory rollback failed');
    expect(mockRollbackInventoryConsumption).toHaveBeenCalledWith('session-1');
    expect(rollbackSession.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'in_progress',
      notes: 'old notes',
    }));
  });

  it('does not roll back inventory when auto-consume is bypassed before a later failure', async () => {
    const session = {
      booking_id: 'booking-1',
      start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'in_progress',
      end_time: null,
      completed_date: null,
      notes: 'old notes',
      standard_duration: null,
      actual_duration: null,
      time_deviation: null,
      duration_warning_type: null,
      ktv_checkout_note: null,
      checkout_lat: null,
      checkout_lon: null,
      bookings: {
        package_id: 'pkg-1',
        packages: { duration: '60 phut' },
      },
    };
    const fetchSession = new MockQueryBuilder(session, null);
    const completeUpdate = new MockQueryBuilder(null, null);
    const completedCount = new MockQueryBuilder(null, { message: 'count failed' });
    const rollbackSession = new MockQueryBuilder(null, null);
    mockAutoConsumeForSession.mockResolvedValue({ success: true, bypassed: true });

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(completeUpdate)
      .mockReturnValueOnce(completedCount)
      .mockReturnValueOnce(rollbackSession);

    const result = await completeKTVSession('session-1', 'notes', 'checkout note');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to count completed sessions: count failed');
    expect(mockRollbackInventoryConsumption).not.toHaveBeenCalled();
    expect(rollbackSession.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'in_progress',
      notes: 'old notes',
    }));
  });

  it('rolls back completed session and inventory when extra scheduled cleanup fails', async () => {
    const session = {
      booking_id: 'booking-1',
      start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'in_progress',
      end_time: null,
      completed_date: null,
      notes: 'old notes',
      standard_duration: null,
      actual_duration: null,
      time_deviation: null,
      duration_warning_type: null,
      ktv_checkout_note: null,
      checkout_lat: null,
      checkout_lon: null,
      bookings: {
        package_id: 'pkg-1',
        packages: { duration: '60 phut' },
      },
    };
    const fetchSession = new MockQueryBuilder(session, null);
    const completeUpdate = new MockQueryBuilder(null, null);
    const completedCount = new MockQueryBuilder(null, null, 10);
    const fetchBooking = new MockQueryBuilder({
      total_sessions: 10,
      status: 'in_progress',
      is_in_care: true,
      updated_at: '2026-06-01T08:00:00.000Z',
    }, null);
    const bookingUpdate = new MockQueryBuilder(null, null);
    const cleanupDelete = new MockQueryBuilder(null, { message: 'cleanup delete failed' });
    const bookingRollback = new MockQueryBuilder(null, null);
    const rollbackSession = new MockQueryBuilder(null, null);
    mockAutoConsumeForSession.mockResolvedValue({ success: true, processed: 1, totalCost: 1000 });

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(completeUpdate)
      .mockReturnValueOnce(completedCount)
      .mockReturnValueOnce(fetchBooking)
      .mockReturnValueOnce(bookingUpdate)
      .mockReturnValueOnce(cleanupDelete)
      .mockReturnValueOnce(bookingRollback)
      .mockReturnValueOnce(rollbackSession);

    const result = await completeKTVSession('session-1', 'notes', 'checkout note');

    expect(result).toEqual({
      success: false,
      error: 'Failed to clean up extra scheduled sessions after completing booking: cleanup delete failed',
    });
    expect(mockRollbackInventoryConsumption).toHaveBeenCalledWith('session-1');
    expect(bookingRollback.updateSpy).toHaveBeenCalledWith({
      status: 'in_progress',
      is_in_care: true,
      updated_at: '2026-06-01T08:00:00.000Z',
    });
    expect(rollbackSession.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'in_progress',
      notes: 'old notes',
    }));
  });

  it('reports booking rollback failure when cleanup fails after booking update', async () => {
    const session = {
      booking_id: 'booking-1',
      start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'in_progress',
      end_time: null,
      completed_date: null,
      notes: 'old notes',
      standard_duration: null,
      actual_duration: null,
      time_deviation: null,
      duration_warning_type: null,
      ktv_checkout_note: null,
      checkout_lat: null,
      checkout_lon: null,
      bookings: {
        package_id: 'pkg-1',
        packages: { duration: '60 phut' },
      },
    };
    const fetchSession = new MockQueryBuilder(session, null);
    const completeUpdate = new MockQueryBuilder(null, null);
    const completedCount = new MockQueryBuilder(null, null, 10);
    const fetchBooking = new MockQueryBuilder({
      total_sessions: 10,
      status: 'in_progress',
      is_in_care: true,
      updated_at: '2026-06-01T08:00:00.000Z',
    }, null);
    const bookingUpdate = new MockQueryBuilder(null, null);
    const cleanupDelete = new MockQueryBuilder(null, { message: 'cleanup delete failed' });
    const bookingRollback = new MockQueryBuilder(null, { message: 'booking rollback failed' });
    const rollbackSession = new MockQueryBuilder(null, null);
    mockAutoConsumeForSession.mockResolvedValue({ success: true, processed: 1, totalCost: 1000 });

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(completeUpdate)
      .mockReturnValueOnce(completedCount)
      .mockReturnValueOnce(fetchBooking)
      .mockReturnValueOnce(bookingUpdate)
      .mockReturnValueOnce(cleanupDelete)
      .mockReturnValueOnce(bookingRollback)
      .mockReturnValueOnce(rollbackSession);

    const result = await completeKTVSession('session-1', 'notes', 'checkout note');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to clean up extra scheduled sessions after completing booking: cleanup delete failed');
    expect(result.error).toContain('failed to roll back booking: booking rollback failed');
    expect(mockRollbackInventoryConsumption).toHaveBeenCalledWith('session-1');
    expect(bookingRollback.updateSpy).toHaveBeenCalledWith({
      status: 'in_progress',
      is_in_care: true,
      updated_at: '2026-06-01T08:00:00.000Z',
    });
    expect(rollbackSession.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'in_progress',
      notes: 'old notes',
    }));
  });

  it('does not attempt extra scheduled cleanup when booking is still in progress', async () => {
    const session = {
      booking_id: 'booking-1',
      start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'in_progress',
      end_time: null,
      completed_date: null,
      notes: null,
      standard_duration: null,
      actual_duration: null,
      time_deviation: null,
      duration_warning_type: null,
      ktv_checkout_note: null,
      checkout_lat: null,
      checkout_lon: null,
      bookings: {
        package_id: null,
        packages: { duration: '60 phut' },
      },
    };
    const fetchSession = new MockQueryBuilder(session, null);
    const completeUpdate = new MockQueryBuilder(null, null);
    const completedCount = new MockQueryBuilder(null, null, 1);
    const fetchBooking = new MockQueryBuilder({ total_sessions: 10 }, null);
    const bookingUpdate = new MockQueryBuilder(null, null);

    mockFrom
      .mockReturnValueOnce(fetchSession)
      .mockReturnValueOnce(completeUpdate)
      .mockReturnValueOnce(completedCount)
      .mockReturnValueOnce(fetchBooking)
      .mockReturnValueOnce(bookingUpdate);

    const result = await completeKTVSession('session-1', 'notes', 'checkout note');

    expect(result).toEqual({ success: true });
    expect(mockFrom).toHaveBeenCalledTimes(5);
  });
});
