/**
 * Tests for Franchise Royalty Fee Auto-Billing & HQ Invoicing System.
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
let revenueQueryMock = new MockQueryBuilder();
let invoiceQueryMock = new MockQueryBuilder();

import { 
  getFranchiseRoyaltyInvoices, 
  payFranchiseRoyaltyInvoice, 
  updateFranchiseRoyaltyConfig, 
  simulateFranchiseRoyaltyPayment 
} from '../services/franchise-actions';
import { lockMonth } from '../services/finance-actions';

const adminUser = { id: 'admin-1', role: 'admin', tenant_id: 'branch-a-id', name: 'Branch Admin' };
const hqAdminUser = { id: 'hq-admin-1', role: 'admin', tenant_id: 'hq-tenant-id', name: 'HQ Super Admin' };

describe('Franchise Royalty System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default query builders
    tenantQueryMock = new MockQueryBuilder();
    revenueQueryMock = new MockQueryBuilder();
    invoiceQueryMock = new MockQueryBuilder();
    
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return tenantQueryMock;
      if (table === 'revenue') return revenueQueryMock;
      if (table === 'franchise_royalty_invoices') return invoiceQueryMock;
      return new MockQueryBuilder();
    });

    mockRpc.mockResolvedValue({ error: null });
  });

  describe('getFranchiseRoyaltyInvoices', () => {
    it('should return all royalty invoices for HQ Admin (no tenant isolation)', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdminUser);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });
      
      const expectedInvoices = [
        { id: '1', invoice_number: 'ROY-202605-A-1001', tenant_id: 'branch-a-id', calculated_amount: 500000 },
        { id: '2', invoice_number: 'ROY-202605-B-1002', tenant_id: 'branch-b-id', calculated_amount: 1000000 }
      ];
      invoiceQueryMock = new MockQueryBuilder(expectedInvoices);

      const result = await getFranchiseRoyaltyInvoices();

      expect(result).toEqual(expectedInvoices);
      expect(invoiceQueryMock.eqSpy).not.toHaveBeenCalledWith('tenant_id', expect.any(String));
    });

    it('should filter by tenant_id for Branch Admin (tenant isolation enforced)', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockCheckHqAuth.mockResolvedValue({ authorized: false });
      
      const branchAInvoices = [
        { id: '1', invoice_number: 'ROY-202605-A-1001', tenant_id: 'branch-a-id', calculated_amount: 500000 }
      ];
      invoiceQueryMock = new MockQueryBuilder(branchAInvoices);

      const result = await getFranchiseRoyaltyInvoices();

      expect(result).toEqual(branchAInvoices);
      expect(invoiceQueryMock.eqSpy).toHaveBeenCalledWith('tenant_id', 'branch-a-id');
    });

    it('should return an empty array if the user is not logged in', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      
      const result = await getFranchiseRoyaltyInvoices();
      expect(result).toEqual([]);
    });
  });

  describe('payFranchiseRoyaltyInvoice', () => {
    it('should allow gạch nợ payment if user is HQ Admin', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdminUser);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });
      
      const invoiceData = { id: '1', invoice_number: 'ROY-202605-A-1001', tenant_id: 'branch-a-id', status: 'pending' };
      invoiceQueryMock = new MockQueryBuilder(invoiceData);

      const result = await payFranchiseRoyaltyInvoice('ROY-202605-A-1001', 'VietQR');

      expect(result.success).toBe(true);
      expect(invoiceQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        status: 'paid',
        payment_method: 'VietQR'
      }));
    });

    it('should allow payment if user is Branch Admin of the same tenant', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockCheckHqAuth.mockResolvedValue({ authorized: false });
      
      const invoiceData = { id: '1', invoice_number: 'ROY-202605-A-1001', tenant_id: 'branch-a-id', status: 'pending' };
      invoiceQueryMock = new MockQueryBuilder(invoiceData);

      const result = await payFranchiseRoyaltyInvoice('ROY-202605-A-1001', 'VietQR');

      expect(result.success).toBe(true);
      expect(invoiceQueryMock.updateSpy).toHaveBeenCalled();
    });

    it('should block payment and enforce tenant isolation if user is Branch Admin of a DIFFERENT tenant', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser); // tenant_id: 'branch-a-id'
      mockCheckHqAuth.mockResolvedValue({ authorized: false });
      
      const otherInvoiceData = { id: '2', invoice_number: 'ROY-202605-B-1002', tenant_id: 'branch-b-id', status: 'pending' };
      invoiceQueryMock = new MockQueryBuilder(otherInvoiceData);

      const result = await payFranchiseRoyaltyInvoice('ROY-202605-B-1002', 'VietQR');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Quyền truy cập bị từ chối/i);
      expect(invoiceQueryMock.updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateFranchiseRoyaltyConfig', () => {
    it('should allow HQ Admin to update branch royalty configs', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: true });
      tenantQueryMock = new MockQueryBuilder({ success: true });

      const result = await updateFranchiseRoyaltyConfig('branch-a-id', 'percentage', 5, 0);

      expect(result.success).toBe(true);
      expect(tenantQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        royalty_type: 'percentage',
        royalty_rate: 5,
        royalty_fixed_amount: 0
      }));
    });

    it('should block non-HQ Admin from updating configs', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: false });

      const result = await updateFranchiseRoyaltyConfig('branch-a-id', 'percentage', 5, 0);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Chỉ Admin Tổng bộ mới có quyền/i);
      expect(tenantQueryMock.updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('simulateFranchiseRoyaltyPayment', () => {
    it('should call payFranchiseRoyaltyInvoice with VietQR Sandbox', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      mockCheckHqAuth.mockResolvedValue({ authorized: false });
      
      const invoiceData = { id: '1', invoice_number: 'ROY-202605-A-1001', tenant_id: 'branch-a-id', status: 'pending' };
      invoiceQueryMock = new MockQueryBuilder(invoiceData);

      const result = await simulateFranchiseRoyaltyPayment('ROY-202605-A-1001');

      expect(result.success).toBe(true);
      expect(invoiceQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        payment_method: 'VietQR Sandbox'
      }));
    });
  });

  describe('lockMonth Royalty Integration', () => {
    it('should calculate royalty based on percentage config and insert pending invoice', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser); // tenant_id: 'branch-a-id'
      
      // 1. Mock Tenant config: 5% royalty
      tenantQueryMock = new MockQueryBuilder({
        name: 'Bella Branch A',
        royalty_type: 'percentage',
        royalty_rate: 5,
        royalty_fixed_amount: 0
      });

      // 2. Mock Monthly revenues: total = 10,000,000 (confirmed only)
      revenueQueryMock = new MockQueryBuilder([
        { amount: 6000000 },
        { amount: 4000000 }
      ]);

      // 3. Mock existing invoices: none found
      invoiceQueryMock = new MockQueryBuilder(null);

      const result = await lockMonth('2026-05-01');

      expect(result.success).toBe(true);
      
      // Expected fee = 10,000,000 * 5% = 500,000
      expect(invoiceQueryMock.insertSpy).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 'branch-a-id',
        gross_revenue: 10000000,
        royalty_type: 'percentage',
        royalty_rate: 5,
        calculated_amount: 500000,
        status: 'pending'
      }));
    });

    it('should calculate royalty based on fixed config and insert pending invoice', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      
      // 1. Mock Tenant config: fixed fee of 2,500,000
      tenantQueryMock = new MockQueryBuilder({
        name: 'Bella Branch A',
        royalty_type: 'fixed',
        royalty_rate: null,
        royalty_fixed_amount: 2500000
      });

      // 2. Mock revenues: total = 10,000,000
      revenueQueryMock = new MockQueryBuilder([
        { amount: 10000000 }
      ]);

      // 3. Mock existing invoices: none
      invoiceQueryMock = new MockQueryBuilder(null);

      const result = await lockMonth('2026-05-01');

      expect(result.success).toBe(true);
      
      // Expected fee = fixed 2,500,000
      expect(invoiceQueryMock.insertSpy).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 'branch-a-id',
        gross_revenue: 10000000,
        royalty_type: 'fixed',
        royalty_fixed_amount: 2500000,
        calculated_amount: 2500000,
        status: 'pending'
      }));
    });

    it('should upsert (update) existing pending invoice if not paid yet', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      
      // 1. Mock Tenant config: 5% royalty
      tenantQueryMock = new MockQueryBuilder({
        name: 'Bella Branch A',
        royalty_type: 'percentage',
        royalty_rate: 5,
        royalty_fixed_amount: 0
      });

      // 2. Mock revenues: total = 10,000,000
      revenueQueryMock = new MockQueryBuilder([
        { amount: 10000000 }
      ]);

      // 3. Mock existing invoice: pending
      invoiceQueryMock = new MockQueryBuilder({
        id: 'invoice-123',
        status: 'pending'
      });

      const result = await lockMonth('2026-05-01');

      expect(result.success).toBe(true);
      expect(invoiceQueryMock.updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        gross_revenue: 10000000,
        calculated_amount: 500000,
        status: 'pending'
      }));
      expect(invoiceQueryMock.insertSpy).not.toHaveBeenCalled();
    });

    it('should NOT overwrite existing invoice if it has already been paid', async () => {
      mockGetCurrentUser.mockResolvedValue(adminUser);
      
      // 1. Mock Tenant config: 5% royalty
      tenantQueryMock = new MockQueryBuilder({
        name: 'Bella Branch A',
        royalty_type: 'percentage',
        royalty_rate: 5,
        royalty_fixed_amount: 0
      });

      // 2. Mock revenues: total = 10,000,000
      revenueQueryMock = new MockQueryBuilder([
        { amount: 10000000 }
      ]);

      // 3. Mock existing invoice: paid
      invoiceQueryMock = new MockQueryBuilder({
        id: 'invoice-123',
        status: 'paid'
      });

      const result = await lockMonth('2026-05-01');

      expect(result.success).toBe(true);
      expect(invoiceQueryMock.updateSpy).not.toHaveBeenCalled();
      expect(invoiceQueryMock.insertSpy).not.toHaveBeenCalled();
    });
  });
});
