import { updateBooking } from '@/core/services/order/update-booking-action';
import type { Database } from '@/types/database.types';

type BookingRow = Database['public']['Tables']['bookings']['Row'];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];

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
  bookings: [] as BookingRow[],
  sessionLogs: [] as SessionLogRow[],
  tenants: [] as any[],
  users: [] as any[],
};

// Mock query builder
class MockQueryBuilder {
  constructor(private table: string) {}

  select(columns?: string) {
    return this;
  }

  eq(column: string, value: any) {
    return this;
  }

  in(column: string, values: any[]) {
    return this;
  }

  gt(column: string, value: any) {
    return this;
  }

  order(column: string, options?: any) {
    return this;
  }

  single() {
    if (this.table === 'bookings') {
      // Return a shallow copy so MockQueryBuilder.update() mutations don't corrupt oldBooking reference
      const booking = mockStore.bookings[0] ? { ...mockStore.bookings[0] } : null;
      return Promise.resolve({ data: booking, error: null });
    }
    if (this.table === 'tenants') {
      const tenant = mockStore.tenants[0] ? { ...mockStore.tenants[0] } : null;
      return Promise.resolve({ data: tenant, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  update(payload: any) {
    if (this.table === 'bookings') {
      const booking = mockStore.bookings[0];
      if (booking) {
        Object.assign(booking, payload);
      }
      return {
        eq: () => ({
          eq: () => ({
            select: () => ({ data: [{ ...booking }], error: null })
          })
        })
      };
    }
    return this;
  }

  async selectOrFilter() {
    if (this.table === 'session_logs') {
      return { data: mockStore.sessionLogs, error: null };
    }
    return { data: [], error: null };
  }
}

// Mock imports
jest.mock('@/app/api/bookings/check-ktv-availability/route', () => ({
  invalidateAvailabilityCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn().mockResolvedValue(mockSupabase),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

// Mock user actions
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn().mockResolvedValue({
    id: 'user-1',
    tenant_id: 'tenant-1',
    role: 'admin',
  }),
}));

// Mock create-booking-helpers to avoid hitting Decision Engine adapter in tests
jest.mock('@/core/services/order/create-booking-helpers', () => ({
  constructTenantContextForBooking: jest.fn().mockResolvedValue({
    context: {
      tenantId: 'tenant-1',
      tenantName: 'Test Tenant',
      enabledModules: ['spa'],
      subscriptionPlan: 'basic',
      featureFlags: {},
      settings: {},
    },
  }),
  invokeAdapterValidation: jest.fn().mockResolvedValue({ success: true }),
  validateBookingPackageScope: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock checkBookingConflicts
const mockCheckBookingConflicts = jest.fn();
jest.mock('@/services/decision-actions/booking-decisions', () => ({
  checkBookingConflicts: (...args: any[]) => mockCheckBookingConflicts(...args),
}));

describe('updateBooking Conflict Verification', () => {
  beforeEach(() => {
    mockStore.bookings = [];
    mockStore.sessionLogs = [];
    mockStore.tenants = [];
    mockStore.users = [];

    // Setup tenant
    mockStore.tenants.push({
      id: 'tenant-1',
      name: 'Test Tenant',
    });

    // Setup active booking to be updated
    mockStore.bookings.push({
      id: 'booking-1',
      customer_id: 'cust-1',
      tenant_id: 'tenant-1',
      assigned_ktv_id: 'ktv-old',
      start_date: '2026-07-17',
      preferred_time: '09:00',
      status: 'in_progress',
      total_sessions: 5,
    } as BookingRow);

    // Setup scheduled session logs
    mockStore.sessionLogs.push({
      id: 'session-1',
      booking_id: 'booking-1',
      assigned_date: '2026-07-19',
      assigned_time: '09:00',
      status: 'scheduled',
      tenant_id: 'tenant-1',
    } as SessionLogRow);

    // Setup Supabase query chain mocking
    mockSupabase.from.mockImplementation((table: string) => {
      const qb = new MockQueryBuilder(table);
      // Chain method overrides to return the correct mock result for select queries
      if (table === 'session_logs') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          order: () => chain,
        } as any;
        chain.then = (onfulfilled: any) => {
          return Promise.resolve(onfulfilled({ data: mockStore.sessionLogs, error: null }));
        };
        return chain;
      }
      return qb;
    });

    mockCheckBookingConflicts.mockReset();
    jest.clearAllMocks();
  });

  it('should block updating KTV if there is a conflict in any scheduled session', async () => {
    // Setup mock conflict response: REJECT
    mockCheckBookingConflicts.mockResolvedValue({
      decision: 'REJECT',
      message: 'Kỹ thuật viên đã có lịch chăm sóc khác trùng vào khung giờ này.',
    });

    // Action: Update KTV
    const result = await updateBooking('booking-1', { assigned_ktv_id: 'ktv-new' });

    // Assertions
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Trùng lịch vào ngày 2026-07-19');
    expect(result.error).toContain('Kỹ thuật viên đã có lịch chăm sóc khác trùng vào khung giờ này.');

    // Assert side effect: Database update should NOT have happened on booking-1 with 'ktv-new'
    expect(mockStore.bookings[0].assigned_ktv_id).toBe('ktv-old');
  });

  it('should allow updating KTV if there is no conflict in scheduled sessions', async () => {
    // Setup mock conflict response: APPROVE
    mockCheckBookingConflicts.mockResolvedValue({
      decision: 'APPROVE',
      message: 'Không phát hiện xung đột',
    });

    // Action: Update KTV
    const result = await updateBooking('booking-1', { assigned_ktv_id: 'ktv-new' });

    // Assertions
    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();

    // Assert side effect: Database update happened successfully
    expect(mockStore.bookings[0].assigned_ktv_id).toBe('ktv-new');
  });

  it('should reschedule scheduled sessions sequentially when start_date is updated', async () => {
    // Setup multiple sessions with some completed and some scheduled
    mockStore.sessionLogs = [
      {
        id: 'session-1',
        booking_id: 'booking-1',
        assigned_date: '2026-06-12',
        session_number: 1,
        status: 'completed', // Already completed!
        tenant_id: 'tenant-1',
      } as SessionLogRow,
      {
        id: 'session-2',
        booking_id: 'booking-1',
        assigned_date: '2026-06-13',
        session_number: 2,
        status: 'scheduled',
        tenant_id: 'tenant-1',
      } as SessionLogRow,
      {
        id: 'session-3',
        booking_id: 'booking-1',
        assigned_date: '2026-06-14',
        session_number: 3,
        status: 'scheduled',
        tenant_id: 'tenant-1',
      } as SessionLogRow,
    ];

    // Mock checkBookingConflicts to approve
    mockCheckBookingConflicts.mockResolvedValue({
      decision: 'APPROVE',
      message: 'Không phát hiện xung đột',
    });

    // Mock update on session_logs in MockQueryBuilder or directly
    const updatedDates: Record<string, string> = {};
    mockSupabase.from.mockImplementation((table: string) => {
      const qb = new MockQueryBuilder(table);
      if (table === 'session_logs') {
        const chain = {
          select: () => chain,
          order: () => chain,
          eq: (col: string, val: any) => {
            return chain;
          },
          update: (payload: any) => {
            return {
              eq: (col: string, val: any) => {
                updatedDates[val] = payload.assigned_date;
                return Promise.resolve({ error: null });
              }
            };
          }
        } as any;
        chain.then = (onfulfilled: any) => {
          return Promise.resolve(onfulfilled({ data: mockStore.sessionLogs, error: null }));
        };
        return chain;
      }
      return qb;
    });

    // Action: Update start_date of booking to '2026-07-19'
    const result = await updateBooking('booking-1', { start_date: '2026-07-19' });

    // Assertions
    expect(result.error).toBeUndefined();
    
    // Check that dates were rescheduled sequentially
    expect(updatedDates['session-1']).toBeUndefined(); // Completed session should not be modified
    expect(updatedDates['session-2']).toBe('2026-07-20');
    expect(updatedDates['session-3']).toBe('2026-07-21');

  });
});
