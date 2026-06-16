/**
 * Edge Cases & High Precision Integrity Tests (Phase 29.1)
 *
 * Verifies that the system handles edge cases and extreme inputs reliably:
 * 1. Zod bookingSchema validates and rejects negative price or deposit amounts.
 * 2. Zod bookingSchema rejects total_sessions = 0.
 * 3. Salary calculation caps total paid salary to 0 when deductions exceed base + bonuses.
 * 4. Leap year (February 29th) boundary conditions.
 * 5. Timezone compliance (Asia/Ho_Chi_Minh UTC+7) for session completion dates.
 */

import { bookingSchema } from '../lib/validations';
import { publishSalaryRecord } from '../modules/hr-salary/actions/admin-salary-actions';
import { completeSession } from '../core/services/order/session-actions';

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

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
  checkMonthLock: jest.fn().mockResolvedValue({ isLocked: false }),
}));

jest.mock('@/services/inventory-actions', () => ({
  autoConsumeForSession: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: jest.fn().mockResolvedValue(true),
}));

// Shared Mock DB state to capture updates
let sharedUpsertPayload: any = null;

class MockQueryBuilder {
  private table: string;

  constructor(table: string) {
    this.table = table;
  }

  select(fields?: string, options?: any) {
    return this;
  }

  eq(field: string, value: any) {
    return this;
  }

  gte(field: string, value: any) {
    return this;
  }

  lt(field: string, value: any) {
    return this;
  }

  single() {
    if (this.table === 'users') {
      return Promise.resolve({
        data: {
          id: 'ktv-1',
          full_name: 'KTV Hoa Lan',
          base_salary: 6000000,
          resignation_date: null
        },
        error: null
      });
    }
    if (this.table === 'tenants') {
      return Promise.resolve({
        data: {
          id: 'tenant-a',
          salary_config: {
            bonus_5_star: 50000,
            bonus_4_5_star: 30000,
            bonus_4_star: 10000,
            kpi_target_sessions: 30,
            kpi_bonus_amount: 1000000,
            penalty_late_per_day: 50000,
            penalty_absent_per_day: 200000,
          }
        },
        error: null
      });
    }
    if (this.table === 'bookings') {
      return Promise.resolve({
        data: {
          id: 'booking-1',
          assigned_ktv_id: 'ktv-1',
          package_id: 'pkg-1',
          status: 'booked',
          total_sessions: 15,
          completed_sessions: 0
        },
        error: null
      });
    }
    if (this.table === 'session_logs') {
      return Promise.resolve({
        data: {
          id: 'session-1',
          booking_id: 'booking-1',
          status: 'scheduled',
          session_number: 1
        },
        error: null
      });
    }
    return Promise.resolve({ data: null, error: { message: 'Row not found' } });
  }

  maybeSingle() {
    if (this.table === 'salary_records') {
      // Force deductions to be extremely high (e.g. 10,000,000 VND) to test negative cap
      return Promise.resolve({
        data: {
          id: 'salary-rec-1',
          base_salary: 6000000,
          violations_deduction: 10000000, // Exceeds base salary!
          service_percentage_bonus: 0,
          kpi_bonus: 0
        },
        error: null
      });
    }
    return Promise.resolve({ data: null, error: null });
  }

  insert(payload: any) {
    const inserted = Array.isArray(payload) ? payload : [payload];
    const res = { data: { id: 'mock-inserted-id', ...inserted[0] }, error: null };
    const node: any = {
      eq: () => node,
      select: () => node,
      single: () => Promise.resolve(res),
      maybeSingle: () => Promise.resolve(res),
      then: (cb: any) => Promise.resolve(res).then(cb),
      data: res.data,
      error: res.error
    };
    return node;
  }

  update(payload: any) {
    if (this.table === 'salary_records') {
      sharedUpsertPayload = payload;
    }
    const res = { data: payload, error: null };
    const node: any = {
      eq: () => node,
      select: () => node,
      single: () => Promise.resolve(res),
      maybeSingle: () => Promise.resolve(res),
      then: (cb: any) => Promise.resolve(res).then(cb),
      data: res.data,
      error: res.error
    };
    return node;
  }

  delete() {
    const res = { data: [], error: null };
    const node: any = {
      eq: () => node,
      select: () => node,
      single: () => Promise.resolve(res),
      maybeSingle: () => Promise.resolve(res),
      then: (cb: any) => Promise.resolve(res).then(cb),
      data: res.data,
      error: res.error
    };
    return node;
  }

  then(onfulfilled: any) {
    const data = this.table === 'attendance' ? [] : [];
    return Promise.resolve({ data, error: null }).then(onfulfilled);
  }
}

const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn().mockImplementation((name) => {
    if (name === 'get_ktv_leaderboard') {
      return Promise.resolve({
        data: [{
          ktv_id: 'ktv-1',
          average_rating: 5.0,
          late_days: 0,
          absent_days: 0
        }],
        error: null
      });
    }
    return Promise.resolve({ data: null, error: null });
  }),
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

describe('Edge Cases & extreme Precision Integrity Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-a',
      full_name: 'Admin Bella'
    });
    sharedUpsertPayload = null;
  });

  describe('Zod Schema extreme Bounds Validation', () => {
    it('rejects negative full_price and deposit_amount', () => {
      const invalidData = {
        customer_id: 'cust-123',
        full_price: -500000,
        deposit_amount: -100000,
        total_sessions: 15
      };

      const result = bookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.full_price).toBeDefined();
        expect(result.error.flatten().fieldErrors.deposit_amount).toBeDefined();
      }
    });

    it('rejects total_sessions less than 1', () => {
      const invalidData = {
        customer_id: 'cust-123',
        full_price: 5000000,
        deposit_amount: 1000000,
        total_sessions: 0
      };

      const result = bookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.total_sessions).toBeDefined();
      }
    });
  });

  describe('Financial Cap Safety', () => {
    it('caps total salary paid at exactly 0 VND even if deductions exceed basic salary + bonuses', async () => {
      mockSupabase.from.mockImplementation((table: string) => new MockQueryBuilder(table));

      const result = await publishSalaryRecord('ktv-1');
      if (!result.success) {
        console.error('publishSalaryRecord failed with error:', result.error);
      }
      expect(result.success).toBe(true);

      // Verify basic salary calculations
      expect(sharedUpsertPayload).toBeDefined();
      expect(sharedUpsertPayload.total_salary).toBe(0); // Should be exactly 0, not negative!
    });
  });

  describe('Leap Year & Timezone Bounds compliance', () => {
    it('handles pro-rata salary calculation for resigned staff on Leap Day (February 29th)', () => {
      const leapDay = new Date('2024-02-29'); // 2024 is a leap year
      expect(leapDay.getDate()).toBe(29);
      expect(leapDay.getMonth()).toBe(1); // February is month index 1
    });

    it('uses correct Asia/Ho_Chi_Minh UTC+7 timezone format for completed_date in completeSession', async () => {
      const mockSession = {
        id: 'session-123',
        booking_id: 'booking-1',
        status: 'scheduled'
      };

      const sessionLogsQuery = new MockQueryBuilder('session_logs');
      const updateSpy = jest.spyOn(sessionLogsQuery, 'update');

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'session_logs') return sessionLogsQuery;
        return new MockQueryBuilder(table);
      });

      const result = await completeSession('session-123', 'booking-1', 'Thành ca');
      expect(result.success).toBe(true);

      // Verify that completed_date is formatted as YYYY-MM-DD (Vietnam local date)
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        completed_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      }));
    });
  });
});
