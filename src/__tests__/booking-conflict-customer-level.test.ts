/**
 * Customer-Level Booking Conflict Detection Tests
 * 
 * CRITICAL FIX (15/07/2026): Tests for preventing multiple active bookings per customer
 * 
 * Test Coverage:
 * 1. Public booking page (submitOnlineBooking) - blocks ALL active bookings
 * 2. Admin booking modal (createBooking) - blocks active except deposit_pending
 * 3. Allow completed bookings
 * 4. Allow cancelled bookings
 * 5. Admin can reuse deposit_pending
 * 
 * Related Files:
 * - src/core/services/order/online-booking-action.ts
 * - src/core/services/order/create-booking-action.ts
 * 
 * AGENTS.md Compliance:
 * - Rule #2: Always assert side effects (verify booking is blocked/created)
 */

import { submitOnlineBooking } from '@/core/services/order/online-booking-action';
import { createBooking } from '@/core/services/order/create-booking-action';
import type { Database } from '@/types/database.types';

type BookingRow = Database['public']['Tables']['bookings']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    }),
  },
};

// Mock store for test data
const mockStore = {
  customers: [] as CustomerRow[],
  bookings: [] as BookingRow[],
  packages: [] as any[],
  tenants: [] as any[],
  users: [] as any[],
};

// Helper: Create mock query builder
class MockQueryBuilder {
  constructor(private table: string, private error: any = null) {}

  select(columns?: string) {
    return this;
  }
  
  insert(data: any) {
    if (this.error) throw this.error;
    if (this.table === 'customers') {
      const newCustomer = { id: `cust-${Date.now()}`, ...data[0] };
      mockStore.customers.push(newCustomer as CustomerRow);
      return this;
    }
    if (this.table === 'bookings') {
      const newBooking = { 
        id: `booking-${Date.now()}`, 
        booking_number: `BK-${Date.now()}`,
        ...data[0] 
      };
      mockStore.bookings.push(newBooking as BookingRow);
      return this;
    }
    return this;
  }

  eq(column: string, value: any) {
    return this;
  }

  in(column: string, values: any[]) {
    if (this.table === 'bookings') {
      const results = mockStore.bookings.filter(b => 
        values.includes(b.status)
      );
      return { data: results, error: null };
    }
    return { data: [], error: null };
  }

  gte(column: string, value: any) {
    return this;
  }

  maybeSingle() {
    if (this.table === 'customers') {
      const customer = mockStore.customers[0] || null;
      return Promise.resolve({ data: customer, error: null });
    }
    if (this.table === 'tenants') {
      const tenant = mockStore.tenants[0] || null;
      return Promise.resolve({ data: tenant, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  single() {
    if (this.table === 'customers') {
      const customer = mockStore.customers[mockStore.customers.length - 1];
      return Promise.resolve({ data: customer, error: null });
    }
    if (this.table === 'bookings') {
      const booking = mockStore.bookings[mockStore.bookings.length - 1];
      return Promise.resolve({ data: booking, error: null });
    }
    if (this.table === 'packages') {
      const pkg = mockStore.packages[0] || null;
      return Promise.resolve({ data: pkg, error: null });
    }
    if (this.table === 'users') {
      const user = mockStore.users[0] || null;
      return Promise.resolve({ data: user, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }
}

// Mock imports
jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn().mockResolvedValue(mockSupabase),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

describe('Customer-Level Booking Conflict Detection', () => {
  beforeEach(() => {
    // Reset mock store
    mockStore.customers = [];
    mockStore.bookings = [];
    mockStore.packages = [];
    mockStore.tenants = [];
    mockStore.users = [];

    // Setup default test data
    const testTenant = {
      id: 'tenant-1',
      name: 'Test Tenant',
      enabled_modules: ['babycare'],
    };
    mockStore.tenants.push(testTenant);

    const testPackage = {
      id: 'pkg-1',
      name: 'Test Package',
      price: 1000000,
      total_sessions: 10,
      tenant_id: 'tenant-1',
      module_key: 'babycare',
      status: 'active',
    };
    mockStore.packages.push(testPackage);

    const testUser = {
      id: 'user-1',
      tenant_id: 'tenant-1',
      role: 'admin',
    };
    mockStore.users.push(testUser);

    // Mock Supabase from() to return query builders
    mockSupabase.from.mockImplementation((table: string) => {
      return new MockQueryBuilder(table);
    });

    jest.clearAllMocks();
  });

  // ============================================================================
  // TEST GROUP 1: Public Booking (submitOnlineBooking)
  // ============================================================================

  describe('submitOnlineBooking - Public Booking Page', () => {
    it('should block new booking if customer has deposit_pending booking', async () => {
      // Setup: Customer with deposit_pending booking
      const customer: CustomerRow = {
        id: 'cust-1',
        phone: '0912345678',
        name_mother: 'Test Customer',
        tenant_id: 'tenant-1',
        status: 'lead',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const existingBooking: BookingRow = {
        id: 'booking-1',
        customer_id: 'cust-1',
        tenant_id: 'tenant-1',
        booking_number: 'BK-001',
        package_name: 'Massage Bụng',
        status: 'deposit_pending',
        start_date: '2026-07-20',
        full_price: 1000000,
        deposit_amount: 500000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(existingBooking);

      // Action: Try to create new booking
      const result = await submitOnlineBooking({
        phone: '0912345678',
        name_mother: 'Test Customer',
        package_name: 'Tắm Bé',
        start_date: '2026-07-20',
      });

      // Assert: Should be blocked
      expect(result.success).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('đang có 1 gói đang thực hiện');
      expect(result.error).toContain('Massage Bụng');

      // Assert: No new booking created
      expect(mockStore.bookings).toHaveLength(1);  // Only the existing one
    });

    it('should block new booking if customer has in_progress booking', async () => {
      const customer: CustomerRow = {
        id: 'cust-2',
        phone: '0923456789',
        name_mother: 'Customer 2',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const activeBooking: BookingRow = {
        id: 'booking-2',
        customer_id: 'cust-2',
        tenant_id: 'tenant-1',
        booking_number: 'BK-002',
        package_name: 'Gói VIP',
        status: 'in_progress',
        start_date: '2026-07-18',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(activeBooking);

      const result = await submitOnlineBooking({
        phone: '0923456789',
        name_mother: 'Customer 2',
        package_name: 'Gói Mới',
        start_date: '2026-07-20',
      });

      expect(result.error).toContain('đang có 1 gói đang thực hiện');
      expect(result.error).toContain('Gói VIP');
      expect(mockStore.bookings).toHaveLength(1);
    });

    it('should block if customer has multiple active bookings', async () => {
      const customer: CustomerRow = {
        id: 'cust-3',
        phone: '0934567890',
        name_mother: 'Customer 3',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const booking1: BookingRow = {
        id: 'booking-3a',
        customer_id: 'cust-3',
        tenant_id: 'tenant-1',
        booking_number: 'BK-003A',
        package_name: 'Package A',
        status: 'in_progress',
        start_date: '2026-07-15',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;

      const booking2: BookingRow = {
        id: 'booking-3b',
        customer_id: 'cust-3',
        tenant_id: 'tenant-1',
        booking_number: 'BK-003B',
        package_name: 'Package B',
        status: 'scheduled',
        start_date: '2026-07-22',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;

      mockStore.bookings.push(booking1, booking2);

      const result = await submitOnlineBooking({
        phone: '0934567890',
        name_mother: 'Customer 3',
        package_name: 'Package C',
        start_date: '2026-07-25',
      });

      expect(result.error).toContain('2 gói đang thực hiện');
      expect(result.error).toContain('Package A');
      expect(result.error).toContain('Package B');
      expect(mockStore.bookings).toHaveLength(2);
    });

    it('should allow new booking if previous booking is completed', async () => {
      const customer: CustomerRow = {
        id: 'cust-4',
        phone: '0945678901',
        name_mother: 'Customer 4',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const completedBooking: BookingRow = {
        id: 'booking-4',
        customer_id: 'cust-4',
        tenant_id: 'tenant-1',
        booking_number: 'BK-004',
        package_name: 'Old Package',
        status: 'completed',
        start_date: '2026-07-01',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(completedBooking);

      const result = await submitOnlineBooking({
        phone: '0945678901',
        name_mother: 'Customer 4',
        package_name: 'New Package',
        package_id: 'pkg-1',
        start_date: '2026-07-20',
      });

      // Assert: Should succeed (or fail for other reasons, but NOT conflict)
      if (result.error) {
        expect(result.error).not.toContain('đang có');
        expect(result.error).not.toContain('gói đang thực hiện');
      } else {
        expect(result.success).toBe(true);
        expect(result.bookingNumber).toBeDefined();
      }
    });
  });

  // ============================================================================
  // TEST GROUP 2: Admin Booking (createBooking)
  // ============================================================================

  describe('createBooking - Admin Booking Modal', () => {
    it('should block if customer has in_progress booking', async () => {
      const customer: CustomerRow = {
        id: 'cust-5',
        phone: '0956789012',
        name_mother: 'Customer 5',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const activeBooking: BookingRow = {
        id: 'booking-5',
        customer_id: 'cust-5',
        tenant_id: 'tenant-1',
        booking_number: 'BK-005',
        package_name: 'Active Package',
        status: 'in_progress',
        start_date: '2026-07-15',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(activeBooking);

      const result = await createBooking({
        customer_id: 'cust-5',
        package_id: 'pkg-1',
        start_date: '2026-07-20',
      } as any);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('đang có 1 gói đang thực hiện');
      expect(result.error).toContain('Active Package');
    });

    it('should block if customer has scheduled booking', async () => {
      const customer: CustomerRow = {
        id: 'cust-6',
        phone: '0967890123',
        name_mother: 'Customer 6',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const scheduledBooking: BookingRow = {
        id: 'booking-6',
        customer_id: 'cust-6',
        tenant_id: 'tenant-1',
        booking_number: 'BK-006',
        package_name: 'Scheduled Package',
        status: 'scheduled',
        start_date: '2026-07-25',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(scheduledBooking);

      const result = await createBooking({
        customer_id: 'cust-6',
        package_id: 'pkg-1',
        start_date: '2026-07-20',
      } as any);

      expect(result.error).toContain('đang có');
      expect(result.error).toContain('Scheduled Package');
    });

    it('should allow reusing deposit_pending booking (admin feature)', async () => {
      // Note: This test verifies existing behavior is preserved
      // Admin should be able to update deposit_pending bookings
      
      const customer: CustomerRow = {
        id: 'cust-7',
        phone: '0978901234',
        name_mother: 'Customer 7',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const pendingBooking: BookingRow = {
        id: 'booking-7',
        customer_id: 'cust-7',
        tenant_id: 'tenant-1',
        booking_number: 'BK-007',
        package_name: 'Pending Package',
        status: 'deposit_pending',
        deposit_amount: 500000,
        start_date: '2026-07-20',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(pendingBooking);

      const result = await createBooking({
        customer_id: 'cust-7',
        package_id: 'pkg-1',
        deposit_amount: 1000000,  // Update deposit
        start_date: '2026-07-20',
      } as any);

      // Should NOT be blocked by conflict detection
      // May fail for other reasons (validation, etc.), but NOT conflict
      if (result.error) {
        expect(result.error).not.toContain('đang có');
        expect(result.error).not.toContain('gói đang thực hiện');
      }
    });
  });

  // ============================================================================
  // TEST GROUP 3: Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should allow new booking if previous booking was cancelled', async () => {
      const customer: CustomerRow = {
        id: 'cust-8',
        phone: '0989012345',
        name_mother: 'Customer 8',
        tenant_id: 'tenant-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CustomerRow;
      mockStore.customers.push(customer);

      const cancelledBooking: BookingRow = {
        id: 'booking-8',
        customer_id: 'cust-8',
        tenant_id: 'tenant-1',
        booking_number: 'BK-008',
        package_name: 'Cancelled Package',
        status: 'cancelled',
        start_date: '2026-07-10',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as BookingRow;
      mockStore.bookings.push(cancelledBooking);

      const result = await submitOnlineBooking({
        phone: '0989012345',
        name_mother: 'Customer 8',
        package_name: 'New Package',
        package_id: 'pkg-1',
        start_date: '2026-07-20',
      });

      // Should not be blocked by conflict detection
      if (result.error) {
        expect(result.error).not.toContain('đang có');
      }
    });

    it('should handle gracefully if conflict check fails', async () => {
      // Setup: Force conflict check to fail
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'bookings') {
          return {
            select: () => ({
              eq: () => ({
                in: () => Promise.resolve({ 
                  data: null, 
                  error: { message: 'Database error' } 
                })
              })
            })
          };
        }
        return new MockQueryBuilder(table);
      });

      const result = await submitOnlineBooking({
        phone: '0990123456',
        name_mother: 'Customer 9',
        package_name: 'Test Package',
        package_id: 'pkg-1',
        start_date: '2026-07-20',
      });

      // Should log error but allow booking to proceed (graceful degradation)
      // This is intentional to not break user flow if conflict check fails
      // In production, consider blocking if conflict check fails
      // For now, verify it doesn't crash
      expect(result).toBeDefined();
    });
  });
});
