jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn(() => Promise.resolve()),
}));

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();
const updatePayloads: any[] = [];

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
}));

const mockRecordAuditLog = jest.fn();
jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: (...args: any[]) => mockRecordAuditLog(...args),
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
  update(payload?: any) {
    updatePayloads.push(payload);
    return this;
  }
  insert() { return this; }
  single() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error, count: this.count }).then(onfulfilled);
  }
}

import { checkHqAuth, getAllTenants, getHqDashboardStats, toggleTenantStatus } from '@/services/hq-actions';

describe('HQ actions data loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'hq-admin',
      role: 'admin',
      tenant_id: 'hq-tenant',
    });
    mockRecordAuditLog.mockResolvedValue({ success: true });
    updatePayloads.length = 0;
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

  it('rolls back tenant status update when audit logging fails', async () => {
    const tenant = {
      id: 'branch-1',
      name: 'Bella Spa HCM',
      status: 'active',
      updated_at: 'old-date',
    };

    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit unavailable'));
    mockFrom
      .mockReturnValueOnce(new MockQueryBuilder({ name: 'Bella Spa Headquarter' }, null))
      .mockReturnValueOnce(new MockQueryBuilder(tenant, null))
      .mockReturnValueOnce(new MockQueryBuilder(null, null))
      .mockReturnValueOnce(new MockQueryBuilder(null, null));

    const res = await toggleTenantStatus('branch-1', 'suspended');

    expect(res.success).toBe(false);
    expect(res.error).toContain('Audit log failed after tenant status update: audit unavailable');
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'tenants',
      record_id: 'branch-1',
      old_data: expect.objectContaining({ status: 'active', updated_at: 'old-date' }),
      new_data: expect.objectContaining({ status: 'suspended' }),
    });
    expect(updatePayloads).toEqual([
      expect.objectContaining({ status: 'suspended' }),
      { status: 'active', updated_at: 'old-date' },
    ]);
  });
});
