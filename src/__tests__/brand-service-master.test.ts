/**
 * Tests for Phase 2 Brand Service Master standard package templates & distribution.
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

jest.mock('server-only', () => ({}), { virtual: true });

// Setup global proxies to bypass Jest hoisting
const mockGetCurrentUser = jest.fn();
const mockCheckHqAuth = jest.fn();
const mockFrom = jest.fn();

(global as any).mockGetCurrentUser = mockGetCurrentUser;
(global as any).mockCheckHqAuth = mockCheckHqAuth;
(global as any).mockFrom = mockFrom;

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: (...args: any[]) => (global as any).mockGetCurrentUser(...args),
}));

jest.mock('@/services/hq-actions', () => ({
  checkHqAuth: (...args: any[]) => (global as any).mockCheckHqAuth(...args),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => Promise.resolve({
    from: (...args: any[]) => (global as any).mockFrom(...args),
  }),
}));

// Helper class for mock query builders
class MockQueryBuilder {
  public data: any;
  public error: any;
  public eqSpy = jest.fn().mockReturnThis();
  public notSpy = jest.fn().mockReturnThis();
  public orderSpy = jest.fn().mockReturnThis();
  public insertSpy = jest.fn().mockReturnThis();
  public updateSpy = jest.fn().mockReturnThis();
  public deleteSpy = jest.fn().mockReturnThis();
  public selectSpy = jest.fn().mockReturnThis();
  public singleSpy = jest.fn().mockReturnThis();
  public maybeSingleSpy = jest.fn().mockReturnThis();

  constructor(data: any = null, error: any = null) {
    this.data = data;
    this.error = error;
  }

  select(...args: any[]) { this.selectSpy(...args); return this; }
  eq(...args: any[]) { this.eqSpy(...args); return this; }
  not(...args: any[]) { this.notSpy(...args); return this; }
  order(...args: any[]) { this.orderSpy(...args); return this; }
  insert(...args: any[]) { this.insertSpy(...args); return this; }
  update(...args: any[]) { this.updateSpy(...args); return this; }
  delete(...args: any[]) { this.deleteSpy(...args); return this; }
  single(...args: any[]) { this.singleSpy(...args); return this; }
  maybeSingle(...args: any[]) { this.maybeSingleSpy(...args); return this; }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

import {
  getHqPackageTemplates,
  createHqPackageTemplate,
  updateHqPackageTemplate,
  deleteHqPackageTemplate,
  distributeTemplateToTenants,
  overrideTenantPackagePrice,
  getBrandDistributionMatrix
} from '../services/brand-service-actions';

const hqAdminUser = { id: 'hq-admin-1', role: 'admin', tenant_id: 'hq-tenant-id', name: 'HQ Super Admin' };
const tenantAdminUser = { id: 'branch-admin-1', role: 'admin', tenant_id: 'branch-a-id', name: 'Branch Admin' };

describe('Brand Service Master System (Phase 2)', () => {
  let packageQueryMock: MockQueryBuilder;
  let tenantQueryMock: MockQueryBuilder;

  beforeEach(() => {
    jest.clearAllMocks();

    packageQueryMock = new MockQueryBuilder();
    tenantQueryMock = new MockQueryBuilder();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'packages') return packageQueryMock;
      if (table === 'tenants') return tenantQueryMock;
      return new MockQueryBuilder();
    });
  });

  describe('getHqPackageTemplates', () => {
    it('should block non-HQ admins', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: false, error: 'Unauthorized' });
      const result = await getHqPackageTemplates();
      expect(result).toEqual([]);
    });

    it('should fetch package templates where is_hq_template is true', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: true, user: hqAdminUser });
      const mockTemplates = [
        { id: 't-1', name: 'Standard Massage', price: 500000, is_hq_template: true }
      ];
      packageQueryMock = new MockQueryBuilder(mockTemplates);

      const result = await getHqPackageTemplates();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Standard Massage');
      expect(packageQueryMock.eqSpy).toHaveBeenCalledWith('is_hq_template', true);
    });
  });

  describe('createHqPackageTemplate', () => {
    it('should create template package successfully', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: true, user: hqAdminUser });
      
      const newTemplateData = {
        name: 'Tắm trắng phi thuyền VIP',
        price: 1500000,
        price_floor: 1200000,
        price_cap: 2000000,
        allowed_franchise_override: true
      };

      const insertedRecord = { id: 't-2', ...newTemplateData, is_hq_template: true, tenant_id: 'hq-tenant-id' };
      packageQueryMock = new MockQueryBuilder(insertedRecord);

      const result = await createHqPackageTemplate(newTemplateData);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Tắm trắng phi thuyền VIP');
      expect(packageQueryMock.insertSpy).toHaveBeenCalled();
    });

    it('should reject creation if price_floor is greater than price_cap', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: true, user: hqAdminUser });

      const invalidData = {
        name: 'Invalid pricing',
        price: 1000000,
        price_floor: 1200000,
        price_cap: 800000
      };

      const result = await createHqPackageTemplate(invalidData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Giá sàn không được lớn hơn giá trần');
    });
  });

  describe('overrideTenantPackagePrice', () => {
    it('should allow price override if override is allowed and price is within bounds', async () => {
      mockGetCurrentUser.mockResolvedValue(tenantAdminUser);

      const tenantPkg = {
        id: 'pkg-123',
        name: 'VIP Facial',
        price: 800000,
        tenant_id: 'branch-a-id',
        template_id: 't-vip',
        price_floor: 600000,
        price_cap: 1000000,
        allowed_franchise_override: true
      };

      packageQueryMock = new MockQueryBuilder(tenantPkg);

      const result = await overrideTenantPackagePrice('pkg-123', 750000);
      expect(result.success).toBe(true);
      expect(packageQueryMock.updateSpy).toHaveBeenCalled();
    });

    it('should reject override if override is not allowed by HQ', async () => {
      mockGetCurrentUser.mockResolvedValue(tenantAdminUser);

      const lockedPkg = {
        id: 'pkg-123',
        name: 'Fixed Price Massage',
        price: 500000,
        tenant_id: 'branch-a-id',
        template_id: 't-fixed',
        price_floor: 500000,
        price_cap: 500000,
        allowed_franchise_override: false
      };

      packageQueryMock = new MockQueryBuilder(lockedPkg);

      const result = await overrideTenantPackagePrice('pkg-123', 550000);
      expect(result.success).toBe(false);
      expect(result.error).toContain('được khóa giá cố định bởi HQ');
    });

    it('should reject override if price is below price_floor', async () => {
      mockGetCurrentUser.mockResolvedValue(tenantAdminUser);

      const pkg = {
        id: 'pkg-123',
        name: 'VIP Facial',
        price: 800000,
        tenant_id: 'branch-a-id',
        template_id: 't-vip',
        price_floor: 600000,
        price_cap: 1000000,
        allowed_franchise_override: true
      };

      packageQueryMock = new MockQueryBuilder(pkg);

      const result = await overrideTenantPackagePrice('pkg-123', 500000);
      expect(result.success).toBe(false);
      expect(result.error).toContain('không được thấp hơn giá sàn quy định');
    });

    it('should reject override if price is above price_cap', async () => {
      mockGetCurrentUser.mockResolvedValue(tenantAdminUser);

      const pkg = {
        id: 'pkg-123',
        name: 'VIP Facial',
        price: 800000,
        tenant_id: 'branch-a-id',
        template_id: 't-vip',
        price_floor: 600000,
        price_cap: 1000000,
        allowed_franchise_override: true
      };

      packageQueryMock = new MockQueryBuilder(pkg);

      const result = await overrideTenantPackagePrice('pkg-123', 1200000);
      expect(result.success).toBe(false);
      expect(result.error).toContain('không được vượt quá giá trần quy định');
    });
  });
});
