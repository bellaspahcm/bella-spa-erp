import {
  getBeautyDashboardCustomerRatingDistribution,
  getBeautyDashboardTopTechnicians,
} from '../app/dashboard/beauty-dashboard-rating-actions';

jest.mock('server-only', () => ({}), { virtual: true });

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();
const queryFilters: Array<{ column: string; value: unknown }> = [];

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

class MockQueryBuilder {
  constructor(
    private data: unknown = null,
    private error: unknown = null
  ) {}

  select() { return this; }
  eq(column?: string, value?: unknown) {
    if (column) queryFilters.push({ column, value });
    return this;
  }
  gte(column?: string, value?: unknown) {
    if (column) queryFilters.push({ column, value });
    return this;
  }
  lt(column?: string, value?: unknown) {
    if (column) queryFilters.push({ column, value });
    return this;
  }

  then(onfulfilled: (value: { data: unknown; error: unknown }) => unknown) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

describe('beauty dashboard rating actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryFilters.length = 0;
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
    mockFrom.mockReturnValue(new MockQueryBuilder([]));
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it('keeps null KTV leaderboard rating as no-data instead of coercing it to zero', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          full_name: 'KTV Demo Body',
          sessions: 0,
          average_rating: null,
          total_kpi_bonus: 0,
        },
      ],
      error: null,
    });

    await expect(getBeautyDashboardTopTechnicians()).resolves.toEqual([
      {
        name: 'KTV Demo Body',
        sessions: 0,
        rating: '—',
        status: 'Chưa có dữ liệu',
        bonus: '+0',
      },
    ]);

    expect(mockRpc).toHaveBeenCalledWith('get_ktv_leaderboard', expect.objectContaining({
      p_tenant_id: 'tenant-1',
    }));
  });

  it('builds customer rating distribution from approved session reviews', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'session_reviews') {
        return new MockQueryBuilder([
          { rating: 5 },
          { rating: 5 },
          { rating: 4 },
          { rating: 3 },
        ]);
      }
      return new MockQueryBuilder([]);
    });

    await expect(getBeautyDashboardCustomerRatingDistribution('2026-10-01', '2026-11-01')).resolves.toEqual([
      { star: 5, count: 2, percentage: 50 },
      { star: 4, count: 1, percentage: 25 },
      { star: 3, count: 1, percentage: 25 },
      { star: 2, count: 0, percentage: 0 },
      { star: 1, count: 0, percentage: 0 },
    ]);

    expect(mockFrom).toHaveBeenCalledWith('session_reviews');
    expect(queryFilters).toEqual(expect.arrayContaining([
      { column: 'tenant_id', value: 'tenant-1' },
      { column: 'status', value: 'approved' },
      { column: 'created_at', value: '2026-10-01' },
      { column: 'created_at', value: '2026-11-01' },
    ]));
  });

  it('requires a tenant before loading beauty dashboard rating data', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', role: 'admin', tenant_id: null });

    await expect(getBeautyDashboardTopTechnicians()).rejects.toThrow(
      'Không xác định được đơn vị kinh doanh cho dashboard'
    );
    await expect(getBeautyDashboardCustomerRatingDistribution()).rejects.toThrow(
      'Không xác định được đơn vị kinh doanh cho dashboard'
    );

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
