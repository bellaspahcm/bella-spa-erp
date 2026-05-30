import { createPackage, getPackages } from '../services/package-actions';

jest.mock('server-only', () => ({}), { virtual: true });

const mockRecordAuditLog = jest.fn();
jest.mock('../services/audit-actions', () => ({
  recordAuditLog: (...args: any[]) => mockRecordAuditLog(...args),
}));

jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

class MockQueryBuilder {
  public deleteCalled = false;

  constructor(private data: any = null, private error: any = null) {}

  insert() { return this; }
  select() { return this; }
  order() { return this; }
  eq() { return this; }
  delete() {
    this.deleteCalled = true;
    return this;
  }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

const mockSupabase = {
  from: jest.fn(),
};

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

describe('package actions transaction safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordAuditLog.mockResolvedValue({ success: true });
  });

  it('rolls back inserted package when audit logging fails', async () => {
    const packagesQueryBuilder = new MockQueryBuilder([{ id: 'pkg-1', name: 'VIP' }], null);
    mockRecordAuditLog.mockRejectedValue(new Error('Audit write failed'));
    mockSupabase.from.mockReturnValue(packagesQueryBuilder);

    const result = await createPackage({
      name: 'VIP',
      price: 1000000,
      sessions: 10,
    });

    expect(result.error).toBe('Audit write failed');
    expect(packagesQueryBuilder.deleteCalled).toBe(true);
  });

  it('propagates package query failures instead of returning an empty list', async () => {
    mockSupabase.from.mockReturnValue(new MockQueryBuilder(null, { message: 'package query failed' }));

    await expect(getPackages()).rejects.toThrow('Failed to fetch packages: package query failed');
  });
});
