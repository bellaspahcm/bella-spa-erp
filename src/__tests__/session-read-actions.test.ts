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
  order() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

describe('session read actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', role: 'admin', tenant_id: 'tenant-1' });
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
