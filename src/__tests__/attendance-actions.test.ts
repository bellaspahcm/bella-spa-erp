import {
  getKTVConflictSessions,
  getKTVLeaveHistory,
  getKTVTodayAttendance,
  getMonthlyAttendanceSummary,
  getPendingLeaveRequests,
} from '../services/attendance-actions';

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
  gte() { return this; }
  lt() { return this; }
  order() { return this; }
  maybeSingle() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

describe('attendance read actions fail-fast behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'ktv-1',
      role: 'ktv',
      tenant_id: 'tenant-1',
    });
  });

  it('propagates today attendance query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'today attendance failed' }));

    await expect(getKTVTodayAttendance()).rejects.toThrow(
      "Failed to fetch today's KTV attendance: today attendance failed"
    );
  });

  it('propagates monthly attendance KTV query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'ktv summary failed' }));

    await expect(getMonthlyAttendanceSummary('2026-05')).rejects.toThrow(
      'Failed to fetch KTVs for monthly attendance summary: ktv summary failed'
    );
  });

  it('propagates leave history query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'leave history failed' }));

    await expect(getKTVLeaveHistory()).rejects.toThrow(
      'Failed to fetch KTV leave history: leave history failed'
    );
  });

  it('propagates pending leave query failures', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'pending leaves failed' }));

    await expect(getPendingLeaveRequests()).rejects.toThrow(
      'Failed to fetch pending leave requests: pending leaves failed'
    );
  });

  it('propagates conflict session query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'conflicts failed' }));

    await expect(getKTVConflictSessions('ktv-1', '2026-05-30', 'full_day')).rejects.toThrow(
      'Failed to fetch KTV conflict sessions: conflicts failed'
    );
  });
});
