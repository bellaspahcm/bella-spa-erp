import {
  getDashboardStats,
  getImportantAlerts,
  getMonthlyPerformance,
} from '../services/dashboard-actions';

jest.mock('server-only', () => ({}), { virtual: true });

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
}));

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

class MockQueryBuilder {
  constructor(
    private data: any = null,
    private error: any = null,
    private count: number | null = null
  ) {}

  select() { return this; }
  eq() { return this; }
  gte() { return this; }
  lt() { return this; }
  not() { return this; }
  order() { return this; }
  limit() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error, count: this.count }).then(onfulfilled);
  }
}

describe('dashboard read actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it('propagates dashboard stats query failures instead of returning zeroes', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'customer count failed' }));

    await expect(getDashboardStats()).rejects.toThrow(
      'Failed to fetch dashboard customer count: customer count failed'
    );
  });

  it('propagates monthly performance query failures instead of returning an empty chart', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'monthly revenue failed' }));

    await expect(getMonthlyPerformance()).rejects.toThrow(
      'Failed to fetch monthly dashboard revenue: monthly revenue failed'
    );
  });

  it('propagates important alert query failures instead of returning an empty alert list', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'completed alert failed' }));

    await expect(getImportantAlerts()).rejects.toThrow(
      'Failed to fetch completed session alerts: completed alert failed'
    );
  });
});
