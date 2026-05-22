/**
 * Tests for HQ Audit Logs Explorer System.
 * Mocks: next/cache, @sentry/nextjs, @/lib/supabase-server, user-actions, hq-actions, revalidate
 */

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn(() => Promise.resolve()),
}));

// Avoid "must be called in server context" errors in Next.js environment
jest.mock('server-only', () => ({}), { virtual: true });

// Setup global proxies to completely bypass Jest TDZ hoisting issues
const mockGetCurrentUser = jest.fn();
const mockCheckHqAuth = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn();

(global as any).mockGetCurrentUser = mockGetCurrentUser;
(global as any).mockCheckHqAuth = mockCheckHqAuth;
(global as any).mockRpc = mockRpc;
(global as any).mockFrom = mockFrom;

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => (global as any).mockGetCurrentUser(...args),
}));

jest.mock('@/services/hq-actions', () => ({
  checkHqAuth: (...args: any[]) => (global as any).mockCheckHqAuth(...args),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => Promise.resolve({
    rpc: (...args: any[]) => (global as any).mockRpc(...args),
    from: (...args: any[]) => (global as any).mockFrom(...args),
  }),
}));

// Helper class for mock query builders
class MockQueryBuilder {
  public data: any;
  public error: any;
  public eqSpy = jest.fn().mockReturnThis();
  public orderSpy = jest.fn().mockReturnThis();
  public gteSpy = jest.fn().mockReturnThis();
  public lteSpy = jest.fn().mockReturnThis();
  public rangeSpy = jest.fn().mockReturnThis();

  constructor(data: any = null, error: any = null) {
    this.data = data;
    this.error = error;
  }

  select() { return this; }
  eq(...args: any[]) { this.eqSpy(...args); return this; }
  order(...args: any[]) { this.orderSpy(...args); return this; }
  gte(...args: any[]) { this.gteSpy(...args); return this; }
  lte(...args: any[]) { this.lteSpy(...args); return this; }
  range(...args: any[]) { this.rangeSpy(...args); return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

let auditLogQueryMock = new MockQueryBuilder();
let userQueryMock = new MockQueryBuilder();

import { getHqAuditLogs, getAuditTables, getAuditUsers } from '../services/audit-actions';

const hqAdminUser = { id: 'hq-admin-1', role: 'admin', tenant_id: 'hq-tenant-id', name: 'HQ Super Admin' };
const regularUser = { id: 'user-1', role: 'ktv', tenant_id: 'branch-a-id', name: 'Branch KTV' };

describe('HQ Audit Explorer System', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    auditLogQueryMock = new MockQueryBuilder();
    userQueryMock = new MockQueryBuilder();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'audit_logs') return auditLogQueryMock;
      if (table === 'users') return userQueryMock;
      return new MockQueryBuilder();
    });
  });

  describe('getHqAuditLogs', () => {
    it('should block non-HQ Super Admins from querying system-wide audit logs', async () => {
      mockGetCurrentUser.mockResolvedValue(regularUser);
      mockCheckHqAuth.mockResolvedValue({ authorized: false, error: 'Quyền truy cập bị từ chối' });

      const result = await getHqAuditLogs({});
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should retrieve audit logs with proper filters for HQ Super Admin', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdminUser);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });

      const mockLogs = [
        {
          id: 'log-1',
          created_at: '2026-05-22T08:00:00Z',
          changed_by_id: 'hq-admin-1',
          users: { full_name: 'HQ Super Admin' },
          action: 'UPDATE',
          table_name: 'franchise_royalty_invoices',
          record_id: 'invoice-1',
          old_data: { status: 'pending' },
          new_data: { status: 'paid' },
          tenant_id: 'branch-a-id',
          tenants: { name: 'Bella Spa Quận 1' }
        }
      ];

      auditLogQueryMock = new MockQueryBuilder(mockLogs);

      const result = await getHqAuditLogs({
        tenantId: 'branch-a-id',
        userId: 'hq-admin-1',
        action: 'UPDATE',
        tableName: 'franchise_royalty_invoices',
        startDate: '2026-05-20',
        endDate: '2026-05-23',
        page: 1,
        limit: 15
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'log-1',
        created_at: '2026-05-22T08:00:00Z',
        changed_by_id: 'hq-admin-1',
        user_name: 'HQ Super Admin',
        action: 'UPDATE',
        table_name: 'franchise_royalty_invoices',
        record_id: 'invoice-1',
        old_data: { status: 'pending' },
        new_data: { status: 'paid' },
        tenant_id: 'branch-a-id',
        tenant_name: 'Bella Spa Quận 1'
      });

      expect(auditLogQueryMock.eqSpy).toHaveBeenCalledWith('tenant_id', 'branch-a-id');
      expect(auditLogQueryMock.eqSpy).toHaveBeenCalledWith('changed_by_id', 'hq-admin-1');
      expect(auditLogQueryMock.eqSpy).toHaveBeenCalledWith('action', 'UPDATE');
      expect(auditLogQueryMock.eqSpy).toHaveBeenCalledWith('table_name', 'franchise_royalty_invoices');
      expect(auditLogQueryMock.gteSpy).toHaveBeenCalledWith('created_at', expect.any(String));
      expect(auditLogQueryMock.lteSpy).toHaveBeenCalledWith('created_at', expect.any(String));
      expect(auditLogQueryMock.rangeSpy).toHaveBeenCalledWith(0, 14);
    });
  });

  describe('getAuditTables', () => {
    it('should block unauthorized users from listing audit tables', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: false });
      const result = await getAuditTables();
      expect(result).toEqual([]);
    });

    it('should list and sort all unique tables present in audit logs', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: true });
      const mockRawTables = [
        { table_name: 'packages' },
        { table_name: 'tenants' },
        { table_name: 'packages' },
        { table_name: 'users' }
      ];
      auditLogQueryMock = new MockQueryBuilder(mockRawTables);

      const result = await getAuditTables();
      expect(result).toEqual(['packages', 'tenants', 'users']);
    });
  });

  describe('getAuditUsers', () => {
    it('should block unauthorized users from listing system users', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: false });
      const result = await getAuditUsers();
      expect(result).toEqual([]);
    });

    it('should return all users ordered by full_name', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: true });
      const mockRawUsers = [
        { id: 'user-a', full_name: 'Alex' },
        { id: 'user-b', full_name: 'Betty' }
      ];
      userQueryMock = new MockQueryBuilder(mockRawUsers);

      const result = await getAuditUsers();
      expect(result).toEqual([
        { id: 'user-a', name: 'Alex' },
        { id: 'user-b', name: 'Betty' }
      ]);
      expect(userQueryMock.orderSpy).toHaveBeenCalledWith('full_name', { ascending: true });
    });
  });
});
