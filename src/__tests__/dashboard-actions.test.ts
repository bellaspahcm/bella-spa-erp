import {
  getDashboardStats,
  getImportantAlerts,
  getMonthlyPerformance,
  getUpcomingSessions,
} from '../services/dashboard-actions';

jest.mock('server-only', () => ({}), { virtual: true });

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();
const queryFilters: Array<{ column: string; value: unknown }> = [];

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
  eq(column?: string, value?: unknown) {
    if (column) queryFilters.push({ column, value });
    return this;
  }
  gte() { return this; }
  lt() { return this; }
  not(column?: string, _operator?: string, value?: unknown) {
    if (column) queryFilters.push({ column, value });
    return this;
  }
  order() { return this; }
  limit() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error, count: this.count }).then(onfulfilled);
  }
}

describe('dashboard read actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryFilters.length = 0;
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
    expect(queryFilters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('propagates monthly performance query failures instead of returning an empty chart', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'monthly revenue failed' }));

    await expect(getMonthlyPerformance()).rejects.toThrow(
      'Failed to fetch monthly dashboard revenue: monthly revenue failed'
    );
    expect(queryFilters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('propagates important alert query failures instead of returning an empty alert list', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'completed alert failed' }));

    await expect(getImportantAlerts()).rejects.toThrow(
      'Failed to fetch completed session alerts: completed alert failed'
    );
    expect(queryFilters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-1' },
    ]));
  });

  it('requires a tenant before loading dashboard data', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'admin-1', role: 'admin', tenant_id: null });
    await expect(getDashboardStats()).rejects.toThrow('Không xác định được đơn vị kinh doanh cho dashboard');

    mockGetCurrentUser.mockResolvedValueOnce({ id: 'admin-1', role: 'admin', tenant_id: null });
    await expect(getMonthlyPerformance()).rejects.toThrow('Không xác định được đơn vị kinh doanh cho dashboard');

    mockGetCurrentUser.mockResolvedValueOnce({ id: 'admin-1', role: 'admin', tenant_id: null });
    await expect(getImportantAlerts()).rejects.toThrow('Không xác định được đơn vị kinh doanh cho dashboard');

    mockGetCurrentUser.mockResolvedValueOnce({ id: 'admin-1', role: 'admin', tenant_id: null });
    await expect(getUpcomingSessions('2026-06-10')).rejects.toThrow('Không xác định được đơn vị kinh doanh cho dashboard');

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(queryFilters).toEqual([]);
  });

  it('loads upcoming sessions through a direct tenant-scoped day query', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'session_logs') {
        return new MockQueryBuilder([
          {
            id: 'today-open',
            assigned_date: '2026-06-10',
            status: 'scheduled',
            assigned_time: '09:00',
            bookings: {
              package_name: 'Tắm bé',
              packages: null,
            },
          },
        ]);
      }
      return new MockQueryBuilder([]);
    });

    await expect(getUpcomingSessions('2026-06-10')).resolves.toEqual([
      expect.objectContaining({
        id: 'today-open',
        bookings: expect.objectContaining({ package_name: 'Tắm bé' }),
      }),
    ]);

    expect(mockFrom).toHaveBeenCalledWith('session_logs');
    expect(queryFilters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-1' },
      { column: 'assigned_date', value: '2026-06-10' },
      { column: 'status', value: 'completed' },
    ]));
  });

  it('propagates upcoming session read failures instead of hiding tenant-scope issues', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'tenant scoped calendar failed' }));

    await expect(getUpcomingSessions('2026-06-10')).rejects.toThrow(
      'Failed to fetch dashboard upcoming sessions: tenant scoped calendar failed'
    );
  });
});
