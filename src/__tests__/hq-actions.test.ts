jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn(() => Promise.resolve()),
}));

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => Promise.resolve({
    from: (...args: any[]) => mockFrom(...args),
  }),
}));

class MockQueryBuilder {
  constructor(
    private data: any = null,
    private error: any = null,
    private count: number | null = null
  ) {}

  select() { return this; }
  eq() { return this; }
  order() { return this; }
  update() { return this; }
  single() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error, count: this.count }).then(onfulfilled);
  }
}

import { checkHqAuth, getAllTenants, getHqDashboardStats } from '@/services/hq-actions';

describe('HQ actions data loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'hq-admin',
      role: 'admin',
      tenant_id: 'hq-tenant',
    });
  });

  it('propagates HQ tenant verification query failures', async () => {
    mockFrom.mockReturnValueOnce(new MockQueryBuilder(null, { message: 'tenant lookup failed' }));

    await expect(checkHqAuth()).rejects.toThrow(
      'Failed to verify HQ tenant: tenant lookup failed'
    );
  });

  it('counts the same tenant set returned to the HQ branch table', async () => {
    const hqTenant = { id: 'hq-tenant', name: 'Bella Spa Headquarter', status: 'active', created_at: '2026-05-01' };
    const branchTenant = { id: 'branch-1', name: 'Bella Spa HCM', status: 'suspended', created_at: '2026-05-02' };

    mockFrom
      .mockReturnValueOnce(new MockQueryBuilder({ name: 'Bella Spa Headquarter' }, null))
      .mockReturnValueOnce(new MockQueryBuilder([hqTenant, branchTenant], null))
      .mockReturnValueOnce(new MockQueryBuilder([{ amount: 1000000 }], null))
      .mockReturnValueOnce(new MockQueryBuilder(null, null, 7))
      .mockReturnValueOnce(new MockQueryBuilder(null, null, 3));

    const stats = await getHqDashboardStats();

    expect(stats.totalSpas).toBe(2);
    expect(stats.activeSpas).toBe(1);
    expect(stats.suspendedSpas).toBe(1);
    expect(stats.totalRevenue).toBe(1000000);
    expect(stats.totalSessions).toBe(7);
  });

  it('propagates aggregate failures instead of returning tenants with fake zero counts', async () => {
    const hqTenant = { id: 'hq-tenant', name: 'Bella Spa Headquarter', status: 'active', created_at: '2026-05-01' };

    mockFrom
      .mockReturnValueOnce(new MockQueryBuilder({ name: 'Bella Spa Headquarter' }, null))
      .mockReturnValueOnce(new MockQueryBuilder([hqTenant], null))
      .mockReturnValueOnce(new MockQueryBuilder(null, { message: 'staff count failed' }));

    await expect(getAllTenants()).rejects.toThrow(
      'Failed to count staff for tenant hq-tenant: staff count failed'
    );
  });
});
