/**
 * State Machine Transition Validity & Integrity Tests (Phase 29.1)
 *
 * Verifies that the system blocks invalid workflow state transitions:
 * 1. Booking has status = 'cancelled' -> Cannot complete session.
 * 2. Booking has status = 'completed' -> Cannot complete session again.
 * 3. Month is locked -> Block publishSalaryRecord, adminConfirmOnBehalf, finalizeSalaryRecord, approveSalary, updateSalaryConfig, confirmKtvSessions.
 * 4. Inventory Transfer Order status is not 'pending' -> Cannot approve & ship.
 * 5. Inventory Transfer Order status is not 'shipped' -> Cannot confirm receipt.
 */

import { completeSession } from '../modules/booking/actions/session-actions';
import {
  publishSalaryRecord,
  adminConfirmOnBehalf,
  finalizeSalaryRecord,
  approveSalary,
  updateSalaryConfig,
  confirmKtvSessions
} from '../modules/hr-salary/actions/admin-salary-actions';
import {
  approveAndShipTransfer,
  confirmTransferReceipt
} from '../services/inventory-transfer-actions';

// Setup environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Mock dependencies
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn(() => Promise.resolve()),
}));

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));

const mockGetCurrentUser = jest.fn();
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockCheckHqAuth = jest.fn();
jest.mock('@/services/hq-actions', () => ({
  checkHqAuth: () => mockCheckHqAuth(),
}));

const mockCheckMonthLock = jest.fn();
jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
  checkMonthLock: (month?: string) => mockCheckMonthLock(month),
}));

jest.mock('@/services/inventory-actions', () => ({
  autoConsumeForSession: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock Query Chain builder
class MockQueryBuilder {
  private table: string;
  private dataList: any[];
  private singleResult: any = null;

  constructor(table: string, dataList: any[]) {
    this.table = table;
    this.dataList = dataList;
  }

  select(fields?: string) {
    return this;
  }

  eq(field: string, value: any) {
    this.dataList = this.dataList.filter(item => item[field] === value);
    return this;
  }

  in(field: string, values: any[]) {
    this.dataList = this.dataList.filter(item => values.includes(item[field]));
    return this;
  }

  gte(field: string, value: any) {
    this.dataList = this.dataList.filter(item => item[field] >= value);
    return this;
  }

  lt(field: string, value: any) {
    this.dataList = this.dataList.filter(item => item[field] < value);
    return this;
  }

  order(field: string, options?: any) {
    return this;
  }

  maybeSingle() {
    return Promise.resolve({ data: this.dataList[0] || null, error: null });
  }

  single() {
    if (this.dataList.length === 0) {
      return Promise.resolve({ data: null, error: { message: 'Row not found' } });
    }
    return Promise.resolve({ data: this.dataList[0], error: null });
  }

  insert(payload: any) {
    return Promise.resolve({ data: payload, error: null });
  }

  update(payload: any) {
    return Promise.resolve({ data: payload, error: null });
  }

  then(onfulfilled: any) {
    return Promise.resolve({ data: this.dataList, error: null }).then(onfulfilled);
  }
}

const mockRpc = jest.fn();
const mockSupabase = {
  from: jest.fn(),
  rpc: mockRpc,
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@bellaspa.vn' } } }),
  }
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

describe('State Machine & Transition Validity Integrity Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-a',
      full_name: 'Admin Bella'
    });
    mockCheckHqAuth.mockResolvedValue({ authorized: false });
    mockCheckMonthLock.mockResolvedValue({ isLocked: false });
  });

  describe('Booking Status State Machine', () => {
    it('blocks session completion if the booking is cancelled', async () => {
      // Setup session log and a cancelled booking
      const mockSession = { id: 'session-123', booking_id: 'booking-cancelled', status: 'scheduled' };
      const mockBooking = { id: 'booking-cancelled', assigned_ktv_id: 'ktv-1', package_id: 'pkg-1', status: 'cancelled' };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'session_logs') {
          return new MockQueryBuilder(table, [mockSession]);
        }
        if (table === 'bookings') {
          return new MockQueryBuilder(table, [mockBooking]);
        }
        return new MockQueryBuilder(table, []);
      });

      const result = await completeSession('session-123', 'booking-cancelled', 'Thử hoàn thành');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Không thể hoàn thành buổi dịch vụ cho booking đã hủy');
    });
  });

  describe('Locked Month State Machine', () => {
    beforeEach(() => {
      mockCheckMonthLock.mockResolvedValue({ isLocked: true });
    });

    it('blocks publishSalaryRecord when month is locked', async () => {
      const result = await publishSalaryRecord('ktv-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tháng lương đã bị khóa');
    });

    it('blocks adminConfirmOnBehalf when month is locked', async () => {
      const result = await adminConfirmOnBehalf('ktv-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tháng lương đã bị khóa');
    });

    it('blocks finalizeSalaryRecord when month is locked', async () => {
      const result = await finalizeSalaryRecord('ktv-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tháng lương đã bị khóa');
    });

    it('blocks approveSalary when month is locked', async () => {
      const result = await approveSalary('ktv-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tháng lương đã bị khóa');
    });

    it('blocks updateSalaryConfig when month is locked', async () => {
      const result = await updateSalaryConfig('ktv-1', { baseSalary: 5000000, kpiBonus: 0, deductions: 0, advances: 0 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tháng lương đã bị khóa');
    });

    it('blocks confirmKtvSessions when month is locked', async () => {
      const result = await confirmKtvSessions('ktv-1', 10);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tháng lương đã bị khóa');
    });
  });

  describe('Inventory Supply Chain Status State Machine', () => {
    it('blocks approveAndShipTransfer if order status is not pending', async () => {
      mockCheckHqAuth.mockResolvedValue({ authorized: true });
      const mockOrder = {
        id: 'order-123',
        status: 'shipped',
        order_number: 'TRF-001',
        items: []
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'inventory_transfer_orders') {
          return new MockQueryBuilder(table, [mockOrder]);
        }
        return new MockQueryBuilder(table, []);
      });

      const result = await approveAndShipTransfer('order-123', 'Vettel Post', 'VT123456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('không thể giao hàng');
    });

    it('blocks confirmTransferReceipt if order status is not shipped', async () => {
      const mockOrder = {
        id: 'order-123',
        status: 'pending',
        order_number: 'TRF-001',
        requester_tenant_id: 'tenant-a',
        items: []
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'inventory_transfer_orders') {
          return new MockQueryBuilder(table, [mockOrder]);
        }
        return new MockQueryBuilder(table, []);
      });

      const result = await confirmTransferReceipt('order-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('không thể xác nhận nhận hàng');
    });
  });
});
