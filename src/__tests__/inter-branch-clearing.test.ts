/**
 * Tests for Inter-Branch Redemption & Internal Financial Clearing Engine.
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
  public updateSpy = jest.fn().mockReturnThis();
  public insertSpy = jest.fn().mockReturnThis();
  public eqSpy = jest.fn().mockReturnThis();
  public orderSpy = jest.fn().mockReturnThis();
  public gteSpy = jest.fn().mockReturnThis();
  public lteSpy = jest.fn().mockReturnThis();
  public ltSpy = jest.fn().mockReturnThis();
  public inSpy = jest.fn().mockReturnThis();
  public orSpy = jest.fn().mockReturnThis();

  constructor(data: any = null, error: any = null) {
    this.data = data;
    this.error = error;
  }

  select() { return this; }
  eq(...args: any[]) { this.eqSpy(...args); return this; }
  order(...args: any[]) { this.orderSpy(...args); return this; }
  gte(...args: any[]) { this.gteSpy(...args); return this; }
  lte(...args: any[]) { this.lteSpy(...args); return this; }
  lt(...args: any[]) { this.ltSpy(...args); return this; }
  in(...args: any[]) { this.inSpy(...args); return this; }
  or(...args: any[]) { this.orSpy(...args); return this; }
  update(...args: any[]) { this.updateSpy(...args); return this; }
  insert(...args: any[]) { this.insertSpy(...args); return this; }
  
  async single() {
    return { data: this.data, error: this.error };
  }
  
  async maybeSingle() {
    return { data: this.data, error: this.error };
  }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

let tenantQueryMock = new MockQueryBuilder();
let sessionLogQueryMock = new MockQueryBuilder();
let clearingQueryMock = new MockQueryBuilder();

import { 
  getInterBranchClearingRecords,
  clearInterBranchRecord,
  updateTenantClearingRate,
  simulateInterBranchClearing
} from '../services/clearing-actions';
import { lockMonth } from '../services/finance-actions';

const adminUser = { id: 'admin-1', role: 'admin', tenant_id: 'branch-a-id', name: 'Branch Admin' };
const hqAdminUser = { id: 'hq-admin-1', role: 'admin', tenant_id: 'hq-tenant-id', name: 'HQ Super Admin' };

describe('Inter-Branch Clearing System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default query builders
    tenantQueryMock = new MockQueryBuilder();
    sessionLogQueryMock = new MockQueryBuilder();
    clearingQueryMock = new MockQueryBuilder();
    
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return tenantQueryMock;
      if (table === 'session_logs') return sessionLogQueryMock;
      if (table === 'inter_branch_clearing_records') return clearingQueryMock;
      return new MockQueryBuilder();
    });

    mockRpc.mockResolvedValue({ error: null });
  });

  describe('getInterBranchClearingRecords', () => {
    it('should return all inter-branch clearing records for HQ Admin', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdminUser);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });
      
      const mockRecords = [
        { id: '1', clearing_number: 'CLR-1', debtor_tenant_id: 'branch-a-id', creditor_tenant_id: 'branch-b-id' },
        { id: '2', clearing_number: 'CLR-2', debtor_tenant_id: 'branch-c-id', creditor_tenant_id: 'branch-d-id' }
      ];
      clearingQueryMock = new MockQueryBuilder(mockRecords);

      const result = await getInterBranchClearingRecords();

      expect(result).toEqual(mockRecords);
      expect(clearingQueryMock.orSpy).not.toHaveBeenCalled();
    });

    it('should enforce role-based isolation / tenant filtration for Branch Admin', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser); // tenant_id: branch-a-id
      mockCheckHqAuth.mockResolvedValue({ authorized: false });
      
      const mockRecords = [
        { id: '1', clearing_number: 'CLR-1', debtor_tenant_id: 'branch-a-id', creditor_tenant_id: 'branch-b-id' }
      ];
      clearingQueryMock = new MockQueryBuilder(mockRecords);

      const result = await getInterBranchClearingRecords();

      expect(result).toEqual(mockRecords);
      expect(clearingQueryMock.orSpy).toHaveBeenCalledWith('debtor_tenant_id.eq.branch-a-id,creditor_tenant_id.eq.branch-a-id');
    });

    it('should return empty list if user is not logged in', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getInterBranchClearingRecords();
      expect(result).toEqual([]);
    });
  });

  describe('clearInterBranchRecord', () => {
    it('should allow HQ Admin to clear/gạch nợ any record', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdminUser);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });

      const record = { id: '1', debtor_tenant_id: 'branch-a-id', creditor_tenant_id: 'branch-b-id', status: 'pending' };
      clearingQueryMock = new MockQueryBuilder(record);

      const result = await clearInterBranchRecord('1', 'VietQR');

      expect(result.success).toBe(true);
      expect(clearingQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'cleared',
        payment_method: 'VietQR'
      }));
    });

    it('should allow Debtor Admin to clear/gạch nợ their own payable record', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser); // tenant_id: branch-a-id
      mockCheckHqAuth.mockResolvedValue({ authorized: false });

      const record = { id: '1', debtor_tenant_id: 'branch-a-id', creditor_tenant_id: 'branch-b-id', status: 'pending' };
      clearingQueryMock = new MockQueryBuilder(record);

      const result = await clearInterBranchRecord('1', 'VietQR');

      expect(result.success).toBe(true);
      expect(clearingQueryMock.updateSpy).toHaveBeenCalled();
    });

    it('should allow Creditor Admin to clear/gạch nợ their own receivable record', async () => {
      mockGetCurrentUser.mockResolvedValue({ ...adminUser, tenant_id: 'branch-b-id' }); // tenant_id: branch-b-id
      mockCheckHqAuth.mockResolvedValue({ authorized: false });

      const record = { id: '1', debtor_tenant_id: 'branch-a-id', creditor_tenant_id: 'branch-b-id', status: 'pending' };
      clearingQueryMock = new MockQueryBuilder(record);

      const result = await clearInterBranchRecord('1', 'VietQR');

      expect(result.success).toBe(true);
      expect(clearingQueryMock.updateSpy).toHaveBeenCalled();
    });

    it('should block and reject branch admins from other unrelated tenants', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser); // tenant_id: branch-a-id
      mockCheckHqAuth.mockResolvedValue({ authorized: false });

      const unrelatedRecord = { id: '2', debtor_tenant_id: 'branch-y-id', creditor_tenant_id: 'branch-z-id', status: 'pending' };
      clearingQueryMock = new MockQueryBuilder(unrelatedRecord);

      const result = await clearInterBranchRecord('2', 'VietQR');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Quyền truy cập bị từ chối/i);
      expect(clearingQueryMock.updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateTenantClearingRate', () => {
    it('should allow HQ Admin to update any branch clearing rate', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: true });
      tenantQueryMock = new MockQueryBuilder({ success: true });

      const result = await updateTenantClearingRate('branch-a-id', 200000);

      expect(result.success).toBe(true);
      expect(tenantQueryMock.updateSpy).toHaveBeenCalledWith({ internal_clearing_rate: 200000 });
    });

    it('should block non-HQ Admin from updating internal clearing rates', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: false });
      tenantQueryMock = new MockQueryBuilder();

      const result = await updateTenantClearingRate('branch-a-id', 200000);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Chỉ Admin Tổng bộ mới có quyền/i);
      expect(tenantQueryMock.updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('simulateInterBranchClearing', () => {
    it('should call clearInterBranchRecord with VietQR Sandbox payment method', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockCheckHqAuth.mockResolvedValue({ authorized: false });

      const record = { id: '1', debtor_tenant_id: 'branch-a-id', creditor_tenant_id: 'branch-b-id', status: 'pending' };
      clearingQueryMock = new MockQueryBuilder(record);

      const result = await simulateInterBranchClearing('1');

      expect(result.success).toBe(true);
      expect(clearingQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        payment_method: 'VietQR Sandbox'
      }));
    });
  });

  describe('lockMonth Inter-Branch Redemption Integration', () => {
    it('should calculate inter-branch session logs and insert pending clearing record', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser); // actor branch: branch-a-id

      // 1. Mock session_logs:
      // - session 1: debtor = branch-a-id (selling), creditor = branch-b-id (treatment). Active relationship: debtor or creditor matches active actor branch.
      // - session 2: debtor = branch-a-id, creditor = branch-b-id.
      // Both completed in month, so session_count = 2 for branch-a -> branch-b.
      sessionLogQueryMock = new MockQueryBuilder([
        { id: 's1', tenant_id: 'branch-b-id', bookings: { tenant_id: 'branch-a-id' } },
        { id: 's2', tenant_id: 'branch-b-id', bookings: { tenant_id: 'branch-a-id' } }
      ]);

      // 2. Mock tenants query:
      // Return details for branch-a-id and branch-b-id. branch-b-id (creditor) clearing rate = 180,000 VND
      tenantQueryMock = new MockQueryBuilder([
        { id: 'branch-a-id', name: 'Bella Branch A', internal_clearing_rate: 150000 },
        { id: 'branch-b-id', name: 'Bella Branch B', internal_clearing_rate: 180000 }
      ]);

      // 3. Mock existing clearing record: none
      clearingQueryMock = new MockQueryBuilder(null);

      const result = await lockMonth('2026-05-01');

      expect(result.success).toBe(true);

      // Expected amount = 2 sessions * 180,000 = 360,000 VND. Debtor = branch-a-id, Creditor = branch-b-id
      expect(clearingQueryMock.insertSpy).toHaveBeenCalledWith(expect.objectContaining({
        debtor_tenant_id: 'branch-a-id',
        creditor_tenant_id: 'branch-b-id',
        session_count: 2,
        clearing_rate: 180000,
        calculated_amount: 360000,
        status: 'pending'
      }));
    });

    it('should upsert (update) existing pending clearing record if not paid yet', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);

      sessionLogQueryMock = new MockQueryBuilder([
        { id: 's1', tenant_id: 'branch-b-id', bookings: { tenant_id: 'branch-a-id' } }
      ]);

      tenantQueryMock = new MockQueryBuilder([
        { id: 'branch-a-id', name: 'Bella Branch A', internal_clearing_rate: 150000 },
        { id: 'branch-b-id', name: 'Bella Branch B', internal_clearing_rate: 180000 }
      ]);

      // Mock existing record: pending
      clearingQueryMock = new MockQueryBuilder({
        id: 'clr-exist-1',
        status: 'pending'
      });

      const result = await lockMonth('2026-05-01');

      expect(result.success).toBe(true);
      expect(clearingQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        session_count: 1,
        clearing_rate: 180000,
        calculated_amount: 180000,
        status: 'pending'
      }));
      expect(clearingQueryMock.insertSpy).not.toHaveBeenCalled();
    });

    it('should NOT overwrite existing clearing record if it is already cleared/paid', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);

      sessionLogQueryMock = new MockQueryBuilder([
        { id: 's1', tenant_id: 'branch-b-id', bookings: { tenant_id: 'branch-a-id' } }
      ]);

      tenantQueryMock = new MockQueryBuilder([
        { id: 'branch-a-id', name: 'Bella Branch A', internal_clearing_rate: 150000 },
        { id: 'branch-b-id', name: 'Bella Branch B', internal_clearing_rate: 180000 }
      ]);

      // Mock existing record: cleared (paid)
      clearingQueryMock = new MockQueryBuilder({
        id: 'clr-exist-1',
        status: 'cleared'
      });

      const result = await lockMonth('2026-05-01');

      expect(result.success).toBe(true);
      expect(clearingQueryMock.updateSpy).not.toHaveBeenCalled();
      expect(clearingQueryMock.insertSpy).not.toHaveBeenCalled();
    });
  });
});
