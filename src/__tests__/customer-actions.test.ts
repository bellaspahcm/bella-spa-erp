import {
  addLoyaltyPoints,
  getCustomerBookingByToken,
  getCustomerById,
  getCustomers,
  submitCustomerRating,
} from '../services/customer-actions';

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockGetCurrentUser = jest.fn();

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

jest.mock('../services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
}));

class MockQueryBuilder {
  public updateSpy = jest.fn().mockReturnThis();

  constructor(private data: any = null, private error: any = null) {}

  select() { return this; }
  order() { return this; }
  limit() { return this; }
  eq() { return this; }
  maybeSingle() { return this; }
  single() { return this; }
  insert() { return this; }
  update(...args: any[]) {
    this.updateSpy(...args);
    return this;
  }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

describe('customer actions fail-fast behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'customer-1', role: 'customer', tenant_id: 'tenant-1' });
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it('propagates customer list query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'customers failed' }));

    await expect(getCustomers()).rejects.toThrow('Failed to fetch customers: customers failed');
  });

  it('propagates customer detail query failures while preserving not-found as null', async () => {
    mockFrom.mockReturnValueOnce(new MockQueryBuilder(null, { message: 'customer detail failed' }));
    await expect(getCustomerById('cust-1')).rejects.toThrow(
      'Failed to fetch customer cust-1: customer detail failed'
    );

    mockFrom.mockReturnValueOnce(new MockQueryBuilder(null, null));
    await expect(getCustomerById('missing-cust')).resolves.toBeNull();
  });

  it('propagates customer portal booking query failures', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'portal query failed' }));

    await expect(getCustomerBookingByToken('token-1')).rejects.toThrow(
      'Failed to fetch customer booking: portal query failed'
    );
  });

  it('propagates loyalty RPC failures', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'loyalty rpc failed' } });

    await expect(addLoyaltyPoints('cust-1', 200000)).rejects.toThrow(
      'Failed to add loyalty points: loyalty rpc failed'
    );
  });

  it('rolls back session rating when review lookup fails', async () => {
    const sessionQuery = new MockQueryBuilder({
      completed_by_ktv_id: 'ktv-1',
      tenant_id: 'tenant-1',
      rating: null,
      rating_comment: null,
      bookings: { customer_id: 'cust-1' },
    });
    const updateQuery = new MockQueryBuilder(null, null);
    const reviewQuery = new MockQueryBuilder(null, { message: 'review lookup failed' });
    const rollbackQuery = new MockQueryBuilder(null, null);

    mockFrom
      .mockReturnValueOnce(sessionQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(reviewQuery)
      .mockReturnValueOnce(rollbackQuery);

    await expect(submitCustomerRating('session-1', 5, 'Good')).rejects.toThrow(
      'Failed to fetch existing session review: review lookup failed'
    );

    expect(rollbackQuery.updateSpy).toHaveBeenCalledWith({
      rating: null,
      rating_comment: null,
    });
  });
});
