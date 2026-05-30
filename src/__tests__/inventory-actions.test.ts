import {
  getInventoryItems,
  getInventoryLogs,
  getInventoryLogsByDateRange,
  getInventorySummary,
  getPackageMaterials,
} from '../services/inventory-actions';

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
  order() { return this; }
  limit() { return this; }
  eq() { return this; }
  gte() { return this; }
  lte() { return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

describe('inventory read actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-1',
      tenant_id: 'tenant-1',
    });
  });

  it('propagates inventory item query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'items query failed' }));

    await expect(getInventoryItems()).rejects.toThrow('Failed to fetch inventory items: items query failed');
  });

  it('propagates inventory log query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'logs query failed' }));

    await expect(getInventoryLogs()).rejects.toThrow('Failed to fetch inventory logs: logs query failed');
  });

  it('propagates date-range inventory log query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'date logs query failed' }));

    await expect(getInventoryLogsByDateRange('2026-05-01', '2026-05-30')).rejects.toThrow(
      'Failed to fetch inventory logs by date range: date logs query failed'
    );
  });

  it('propagates inventory summary query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'summary query failed' }));

    await expect(getInventorySummary()).rejects.toThrow('Failed to fetch inventory summary: summary query failed');
  });

  it('propagates package material query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'materials query failed' }));

    await expect(getPackageMaterials('pkg-1')).rejects.toThrow(
      'Failed to fetch package materials for package pkg-1: materials query failed'
    );
  });
});
