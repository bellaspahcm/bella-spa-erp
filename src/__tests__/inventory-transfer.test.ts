/**
 * Tests for Internal Supply Chain & Inventory Transfer Order System (Chuyển kho Nội bộ)
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

// Mock Database State
let mockDb: {
  inventory_transfer_orders: any[];
  tenants: any[];
  inventory_items: any[];
  inventory_logs: any[];
} = {
  inventory_transfer_orders: [],
  tenants: [],
  inventory_items: [],
  inventory_logs: []
};

// Helper class for mock query builders interacting with in-memory mockDb
class MockQueryBuilder {
  private table: string;
  private filters: Record<string, any> = {};
  private updateData: any = null;
  private insertData: any = null;
  private sortField: string = '';
  private sortAscending: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(fields?: string) {
    return this;
  }

  eq(field: string, value: any) {
    this.filters[field] = value;
    return this;
  }

  order(field: string, options?: { ascending: boolean }) {
    this.sortField = field;
    this.sortAscending = options?.ascending ?? false;
    return this;
  }

  insert(data: any) {
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.updateData = data;
    return this;
  }

  private execute() {
    let list = [...(mockDb[this.table as keyof typeof mockDb] || [])];

    // Apply Filters
    for (const [field, val] of Object.entries(this.filters)) {
      list = list.filter(item => {
        // If query is matching requester relationship or nested details, mock behavior
        if (field === 'requester_tenant_id' && item.requester_tenant_id !== val) {
          return false;
        }
        if (field === 'id' && item.id !== val) {
          return false;
        }
        if (field === 'name' && item.name !== val) {
          return false;
        }
        if (field === 'sku' && item.sku !== val) {
          return false;
        }
        if (field === 'tenant_id' && item.tenant_id !== val) {
          return false;
        }
        return true;
      });
    }

    // Apply Sorting
    if (this.sortField) {
      list.sort((a, b) => {
        const valA = a[this.sortField];
        const valB = b[this.sortField];
        if (valA < valB) return this.sortAscending ? -1 : 1;
        if (valA > valB) return this.sortAscending ? 1 : -1;
        return 0;
      });
    }

    if (this.insertData) {
      const records = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const inserted = records.map(r => {
        const newRecord = {
          id: r.id || `mock-${this.table}-${Math.floor(Math.random() * 100000)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...r
        };
        (mockDb[this.table as keyof typeof mockDb] as any[]).push(newRecord);
        return newRecord;
      });
      return { data: Array.isArray(this.insertData) ? inserted : inserted[0], error: null };
    }

    if (this.updateData) {
      const updated = list.map(item => {
        // Find matching item in global database and mutate it
        const dbItem = (mockDb[this.table as keyof typeof mockDb] as any[]).find(i => i.id === item.id);
        if (dbItem) {
          Object.assign(dbItem, this.updateData, { updated_at: new Date().toISOString() });
          Object.assign(item, this.updateData, { updated_at: new Date().toISOString() });
        }
        return item;
      });
      return { data: updated.length === 1 ? updated[0] : updated, error: null };
    }

    return { data: list, error: null };
  }

  async single() {
    const { data, error } = this.execute();
    if (error) return { data: null, error };
    const list = Array.isArray(data) ? data : [data];
    return { data: list[0] || null, error: list[0] ? null : new Error('Not found') };
  }

  async maybeSingle() {
    const { data, error } = this.execute();
    if (error) return { data: null, error };
    const list = Array.isArray(data) ? data : [data];
    return { data: list[0] || null, error: null };
  }

  then(onfulfilled: any) {
    const { data, error } = this.execute();
    return Promise.resolve({ data, error }).then(onfulfilled);
  }
}

import {
  createInventoryRequest,
  getInventoryTransferOrders,
  approveAndShipTransfer,
  confirmTransferReceipt,
  cancelTransferOrder
} from '../services/inventory-transfer-actions';

const branchAAdmin = { id: 'admin-a', role: 'admin', tenant_id: 'tenant-branch-a', name: 'Branch A Admin' };
const branchBAdmin = { id: 'admin-b', role: 'admin', tenant_id: 'tenant-branch-b', name: 'Branch B Admin' };
const hqAdmin = { id: 'admin-hq', role: 'admin', tenant_id: 'tenant-hq-id', name: 'HQ Super Admin' };

describe('Internal Supply Chain & Inventory Transfer Order System', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset Mock Database State
    mockDb = {
      inventory_transfer_orders: [],
      tenants: [
        { id: 'tenant-hq-id', name: 'Bella Spa Headquarter' },
        { id: 'tenant-branch-a', name: 'Bella Spa Branch A' },
        { id: 'tenant-branch-b', name: 'Bella Spa Branch B' }
      ],
      inventory_items: [
        // HQ inventory
        {
          id: 'item-hq-oil',
          name: 'Dầu Massage Vy Vy',
          sku: 'OIL-001',
          unit: 'chai',
          stock_level: 50,
          tenant_id: 'tenant-hq-id'
        },
        {
          id: 'item-hq-cream',
          name: 'Kem Dưỡng Da Vy Vy',
          sku: 'CRM-002',
          unit: 'hũ',
          stock_level: 5,
          tenant_id: 'tenant-hq-id'
        },
        // Branch A inventory (item exists)
        {
          id: 'item-branch-a-oil',
          name: 'Dầu Massage Vy Vy',
          sku: 'OIL-001',
          unit: 'chai',
          stock_level: 2,
          tenant_id: 'tenant-branch-a'
        }
        // Branch A doesn't have cream (CRM-002) - will test auto-insertion
      ],
      inventory_logs: []
    };

    mockFrom.mockImplementation((table: string) => {
      return new MockQueryBuilder(table);
    });

    mockRpc.mockResolvedValue({ error: null });
  });

  describe('createInventoryRequest', () => {
    it('should return error if requested items list is empty', async () => {
      mockGetCurrentUser.mockResolvedValue(branchAAdmin);
      const result = await createInventoryRequest([]);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Danh sách vật tư yêu cầu không được để trống/i);
    });

    it('should return error if user is not logged in', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await createInventoryRequest([{ name: 'Dầu Massage Vy Vy', sku: 'OIL-001', qty: 10, unit: 'chai' }]);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Chưa đăng nhập/i);
    });

    it('should successfully create a pending transfer order with order number', async () => {
      mockGetCurrentUser.mockResolvedValue(branchAAdmin);
      const items = [{ name: 'Dầu Massage Vy Vy', sku: 'OIL-001', qty: 10, unit: 'chai' }];
      const result = await createInventoryRequest(items, 'Cần bổ sung gấp');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.order_number).toMatch(/^TRF-\d{6}-\d{4}$/);
      expect(result.data.requester_tenant_id).toBe('tenant-branch-a');
      expect(result.data.status).toBe('pending');
      expect(result.data.items).toEqual(items);
      expect(result.data.notes).toBe('Cần bổ sung gấp');

      // Verify insertion in mock database
      expect(mockDb.inventory_transfer_orders.length).toBe(1);
      expect(mockDb.inventory_transfer_orders[0].order_number).toBe(result.data.order_number);
    });
  });

  describe('getInventoryTransferOrders', () => {
    beforeEach(() => {
      mockDb.inventory_transfer_orders = [
        {
          id: 'trf-1',
          order_number: 'TRF-202605-1001',
          requester_tenant_id: 'tenant-branch-a',
          status: 'pending',
          items: [{ name: 'Dầu Massage Vy Vy', sku: 'OIL-001', qty: 10, unit: 'chai' }],
          created_at: '2026-05-22T00:00:00Z'
        },
        {
          id: 'trf-2',
          order_number: 'TRF-202605-1002',
          requester_tenant_id: 'tenant-branch-b',
          status: 'shipped',
          items: [{ name: 'Kem Dưỡng Da Vy Vy', sku: 'CRM-002', qty: 5, unit: 'hũ' }],
          created_at: '2026-05-22T01:00:00Z'
        }
      ];
    });

    it('should return all transfer orders for HQ Admin without tenant isolation', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdmin);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });

      const result = await getInventoryTransferOrders();
      expect(result.length).toBe(2);
      // HQ can see both Branch A and Branch B
      expect(result.map(o => o.id)).toContain('trf-1');
      expect(result.map(o => o.id)).toContain('trf-2');
    });

    it('should filter results by tenant_id for Branch Admins enforcing tenant isolation', async () => {
      mockGetCurrentUser.mockResolvedValue(branchAAdmin);
      mockCheckHqAuth.mockResolvedValue({ authorized: false });

      const result = await getInventoryTransferOrders();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('trf-1');
      expect(result[0].requester_tenant_id).toBe('tenant-branch-a');
    });

    it('should return empty list if user is not logged in', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getInventoryTransferOrders();
      expect(result).toEqual([]);
    });
  });

  describe('approveAndShipTransfer', () => {
    beforeEach(() => {
      mockDb.inventory_transfer_orders = [
        {
          id: 'trf-pending-a',
          order_number: 'TRF-202605-1001',
          requester_tenant_id: 'tenant-branch-a',
          status: 'pending',
          items: [{ name: 'Dầu Massage Vy Vy', sku: 'OIL-001', qty: 10, unit: 'chai' }]
        },
        {
          id: 'trf-pending-b-insufficient',
          order_number: 'TRF-202605-1002',
          requester_tenant_id: 'tenant-branch-a',
          status: 'pending',
          items: [{ name: 'Kem Dưỡng Da Vy Vy', sku: 'CRM-002', qty: 10, unit: 'hũ' }] // HQ only has 5
        },
        {
          id: 'trf-shipped-already',
          order_number: 'TRF-202605-1003',
          requester_tenant_id: 'tenant-branch-a',
          status: 'shipped',
          items: [{ name: 'Dầu Massage Vy Vy', sku: 'OIL-001', qty: 5, unit: 'chai' }]
        }
      ];
    });

    it('should reject if carrier or tracking number is missing', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdmin);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });

      const result1 = await approveAndShipTransfer('trf-pending-a', '', 'TRK123');
      expect(result1.success).toBe(false);
      expect(result1.error).toMatch(/Vui lòng cung cấp đơn vị vận chuyển và mã vận đơn/i);

      const result2 = await approveAndShipTransfer('trf-pending-a', 'GHTK', '');
      expect(result2.success).toBe(false);
      expect(result2.error).toMatch(/Vui lòng cung cấp đơn vị vận chuyển và mã vận đơn/i);
    });

    it('should block non-HQ Admins from shipping orders', async () => {
      mockGetCurrentUser.mockResolvedValue(branchAAdmin);
      mockCheckHqAuth.mockResolvedValue({ authorized: false });

      const result = await approveAndShipTransfer('trf-pending-a', 'GHTK', 'TRK123');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Chỉ Admin Tổng bộ mới có quyền/i);
    });

    it('should fail if the transfer order does not exist', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdmin);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });

      const result = await approveAndShipTransfer('non-existent-trf', 'GHTK', 'TRK123');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Không tìm thấy lệnh chuyển kho/i);
    });

    it('should fail if order is not in pending status', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdmin);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });

      const result = await approveAndShipTransfer('trf-shipped-already', 'GHTK', 'TRK123');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/không thể giao hàng/i);
    });

    it('should fail if HQ inventory has insufficient stock', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdmin);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });

      const result = await approveAndShipTransfer('trf-pending-b-insufficient', 'GHTK', 'TRK123');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Số lượng tồn kho tại Tổng bộ không đủ/i);

      // Verify no changes to HQ inventory levels
      const creamItem = mockDb.inventory_items.find(i => i.id === 'item-hq-cream');
      expect(creamItem?.stock_level).toBe(5);
    });

    it('should successfully approve and ship: decrement HQ stock, write audit log, update status, and track shipment', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdmin);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });

      const result = await approveAndShipTransfer('trf-pending-a', 'Viettel Post', 'VTP987654');
      expect(result.success).toBe(true);

      // Verify HQ stock is decremented: 50 -> 40
      const oilItem = mockDb.inventory_items.find(i => i.id === 'item-hq-oil');
      expect(oilItem?.stock_level).toBe(40);

      // Verify audit log has been written
      const hqLogs = mockDb.inventory_logs.filter(l => l.tenant_id === 'tenant-hq-id');
      expect(hqLogs.length).toBe(1);
      expect(hqLogs[0].change_amount).toBe(-10);
      expect(hqLogs[0].reason).toBe('transfer_shipment');
      expect(hqLogs[0].item_id).toBe('item-hq-oil');
      expect(hqLogs[0].notes).toContain('TRF-202605-1001');

      // Verify order status update
      const order = mockDb.inventory_transfer_orders.find(o => o.id === 'trf-pending-a');
      expect(order?.status).toBe('shipped');
      expect(order?.shipping_carrier).toBe('Viettel Post');
      expect(order?.tracking_number).toBe('VTP987654');
      expect(order?.approved_at).toBeDefined();
      expect(order?.shipped_at).toBeDefined();
    });
  });

  describe('confirmTransferReceipt', () => {
    beforeEach(() => {
      mockDb.inventory_transfer_orders = [
        {
          id: 'trf-shipped-a-oil',
          order_number: 'TRF-202605-2001',
          requester_tenant_id: 'tenant-branch-a',
          status: 'shipped',
          items: [{ name: 'Dầu Massage Vy Vy', sku: 'OIL-001', qty: 15, unit: 'chai' }]
        },
        {
          id: 'trf-shipped-a-cream-new',
          order_number: 'TRF-202605-2002',
          requester_tenant_id: 'tenant-branch-a',
          status: 'shipped',
          items: [{ name: 'Kem Dưỡng Da Vy Vy', sku: 'CRM-002', qty: 5, unit: 'hũ' }] // Branch A doesn't have this item yet
        },
        {
          id: 'trf-pending-receipt',
          order_number: 'TRF-202605-2003',
          requester_tenant_id: 'tenant-branch-a',
          status: 'pending',
          items: [{ name: 'Dầu Massage Vy Vy', sku: 'OIL-001', qty: 5, unit: 'chai' }]
        }
      ];
    });

    it('should reject if user is not logged in', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await confirmTransferReceipt('trf-shipped-a-oil');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Chưa đăng nhập/i);
    });

    it('should reject if transfer order does not exist', async () => {
      mockGetCurrentUser.mockResolvedValue(branchAAdmin);
      const result = await confirmTransferReceipt('non-existent-trf');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Không tìm thấy lệnh chuyển kho/i);
    });

    it('should block if a different branch admin tries to confirm receipt (tenant isolation)', async () => {
      mockGetCurrentUser.mockResolvedValue(branchBAdmin); // branch B admin trying to confirm branch A's order
      const result = await confirmTransferReceipt('trf-shipped-a-oil');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Quyền truy cập bị từ chối/i);
    });

    it('should block if order is not in shipped status', async () => {
      mockGetCurrentUser.mockResolvedValue(branchAAdmin);
      const result = await confirmTransferReceipt('trf-pending-receipt');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/không thể xác nhận nhận hàng/i);
    });

    it('should increment existing item stock and record audit logs for branch on receipt', async () => {
      mockGetCurrentUser.mockResolvedValue(branchAAdmin);

      // Current Branch A oil stock is 2
      const result = await confirmTransferReceipt('trf-shipped-a-oil');
      expect(result.success).toBe(true);

      // Verify stock incremented: 2 + 15 = 17
      const branchOil = mockDb.inventory_items.find(
        i => i.tenant_id === 'tenant-branch-a' && i.sku === 'OIL-001'
      );
      expect(branchOil?.stock_level).toBe(17);

      // Verify audit log
      const branchLogs = mockDb.inventory_logs.filter(l => l.tenant_id === 'tenant-branch-a');
      expect(branchLogs.length).toBe(1);
      expect(branchLogs[0].change_amount).toBe(15);
      expect(branchLogs[0].reason).toBe('transfer_receipt');
      expect(branchLogs[0].item_id).toBe('item-branch-a-oil');
      expect(branchLogs[0].notes).toContain('TRF-202605-2001');

      // Verify order status
      const order = mockDb.inventory_transfer_orders.find(o => o.id === 'trf-shipped-a-oil');
      expect(order?.status).toBe('completed');
      expect(order?.completed_at).toBeDefined();
    });

    it('should automatically initialize new inventory item at the branch if it does not exist', async () => {
      mockGetCurrentUser.mockResolvedValue(branchAAdmin);

      // Branch A does not have 'Kem Dưỡng Da Vy Vy' (CRM-002) in their inventory
      const existingCream = mockDb.inventory_items.find(
        i => i.tenant_id === 'tenant-branch-a' && i.sku === 'CRM-002'
      );
      expect(existingCream).toBeUndefined();

      const result = await confirmTransferReceipt('trf-shipped-a-cream-new');
      expect(result.success).toBe(true);

      // Verify that item was automatically initialized for Branch A with correct stock
      const newBranchCream = mockDb.inventory_items.find(
        i => i.tenant_id === 'tenant-branch-a' && i.sku === 'CRM-002'
      );
      expect(newBranchCream).toBeDefined();
      expect(newBranchCream?.name).toBe('Kem Dưỡng Da Vy Vy');
      expect(newBranchCream?.stock_level).toBe(5);
      expect(newBranchCream?.unit).toBe('hũ');
      expect(newBranchCream?.category).toBe('Cấp từ HQ');

      // Verify audit log
      const branchLogs = mockDb.inventory_logs.filter(
        l => l.tenant_id === 'tenant-branch-a' && l.item_id === newBranchCream?.id
      );
      expect(branchLogs.length).toBe(1);
      expect(branchLogs[0].change_amount).toBe(5);
      expect(branchLogs[0].reason).toBe('transfer_receipt');

      // Verify order status
      const order = mockDb.inventory_transfer_orders.find(o => o.id === 'trf-shipped-a-cream-new');
      expect(order?.status).toBe('completed');
    });
  });

  describe('cancelTransferOrder', () => {
    beforeEach(() => {
      mockDb.inventory_transfer_orders = [
        {
          id: 'trf-pending-cancel-a',
          order_number: 'TRF-202605-3001',
          requester_tenant_id: 'tenant-branch-a',
          status: 'pending',
          items: [{ name: 'Dầu Massage Vy Vy', sku: 'OIL-001', qty: 10, unit: 'chai' }]
        },
        {
          id: 'trf-shipped-cancel-fail',
          order_number: 'TRF-202605-3002',
          requester_tenant_id: 'tenant-branch-a',
          status: 'shipped',
          items: [{ name: 'Dầu Massage Vy Vy', sku: 'OIL-001', qty: 5, unit: 'chai' }]
        }
      ];
    });

    it('should allow Branch Admin to cancel their own pending request', async () => {
      mockGetCurrentUser.mockResolvedValue(branchAAdmin);
      mockCheckHqAuth.mockResolvedValue({ authorized: false });

      const result = await cancelTransferOrder('trf-pending-cancel-a', 'Khách hàng hủy dịch vụ');
      expect(result.success).toBe(true);

      const order = mockDb.inventory_transfer_orders.find(o => o.id === 'trf-pending-cancel-a');
      expect(order?.status).toBe('cancelled');
      expect(order?.rejection_reason).toBe('Khách hàng hủy dịch vụ');
      expect(order?.cancelled_at).toBeDefined();
    });

    it('should reject branch cancellation if order is not in pending status', async () => {
      mockGetCurrentUser.mockResolvedValue(branchAAdmin);
      mockCheckHqAuth.mockResolvedValue({ authorized: false });

      const result = await cancelTransferOrder('trf-shipped-cancel-fail', 'Hủy gấp');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/không thể hủy/i);
    });

    it('should block branch admin from cancelling other branches\' orders (tenant isolation)', async () => {
      mockGetCurrentUser.mockResolvedValue(branchBAdmin); // branch B admin trying to cancel branch A's order
      mockCheckHqAuth.mockResolvedValue({ authorized: false });

      const result = await cancelTransferOrder('trf-pending-cancel-a', 'Hủy bừa');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Quyền truy cập bị từ chối/i);
    });

    it('should allow HQ Admin to reject/cancel a branch\'s order even if from a different tenant', async () => {
      mockGetCurrentUser.mockResolvedValue(hqAdmin);
      mockCheckHqAuth.mockResolvedValue({ authorized: true });

      const result = await cancelTransferOrder('trf-pending-cancel-a', 'Không duyệt vì lý do riêng');
      expect(result.success).toBe(true);

      const order = mockDb.inventory_transfer_orders.find(o => o.id === 'trf-pending-cancel-a');
      expect(order?.status).toBe('cancelled');
      expect(order?.rejection_reason).toBe('Không duyệt vì lý do riêng');
    });
  });
});
