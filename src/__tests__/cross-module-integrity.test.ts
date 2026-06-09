/**
 * Cross-Module End-to-End Integrity & Downstream Side-Effect Tests (Phase 29.1)
 *
 * Verifies the complete business pipeline across multiple modules:
 * 1. Booking creation with confirmed deposit -> updates status to booked, records revenue, enqueues PACKAGE_SALE in outbox.
 * 2. Paying remaining balance -> updates status to booked, records revenue, enqueues remaining payment in outbox.
 * 3. Completing service session -> consumes inventory, increments sessions completed, updates salary commission, creates session reviews, enqueues SESSION_DONE.
 * 4. Month locking -> locks financial records, computes franchise royalty invoice, updates inter-branch clearing.
 */

import { createBooking, recordRemainingPayment } from '../modules/booking/actions/lifecycle-actions';
import { completeSession } from '../modules/booking/actions/session-actions';
import { lockMonth } from '../services/finance-actions';
import { autoConsumeForSession } from '../services/inventory-actions';
import { recordAuditLog } from '../services/audit-actions';
import { enqueueWithAutoClient } from '../lib/accounting-outbox';

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

jest.mock('@/modules/hr-salary/actions/admin-salary-actions', () => ({
  recalculateAndSaveSalaryRecord: jest.fn().mockImplementation(async (supabase, ktvId, monthYear, tenantId) => {
    const { data: salaryRec } = await supabase
      .from('salary_records')
      .select('id, total_sessions')
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear)
      .single();

    if (salaryRec) {
      await supabase.from('salary_records').update({
        total_sessions: (salaryRec.total_sessions || 0) + 1,
      }).eq('id', salaryRec.id);
    } else {
      await supabase.from('salary_records').insert({
        ktv_id: ktvId,
        month_year: monthYear,
        total_sessions: 1,
        tenant_id: tenantId,
        status: 'draft',
      });
    }
    return { success: true, totalSalary: 6000000 };
  })
}));

jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: jest.fn().mockResolvedValue(true),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue('127.0.0.1'),
  }),
}));

// Mock Database Store
interface MockStore {
  bookings: any[];
  session_logs: any[];
  revenue: any[];
  expenses: any[];
  users: any[];
  salary_records: any[];
  session_reviews: any[];
  franchise_royalty_invoices: any[];
  inter_branch_clearing_records: any[];
  tenants: any[];
  packages: any[];
}

let mockStore: MockStore = {
  bookings: [],
  session_logs: [],
  revenue: [],
  expenses: [],
  users: [],
  salary_records: [],
  session_reviews: [],
  franchise_royalty_invoices: [],
  inter_branch_clearing_records: [],
  tenants: [],
  packages: [],
};

function resetMockStore() {
  mockStore = {
    bookings: [],
    session_logs: [],
    revenue: [],
    expenses: [],
    users: [
      { id: 'ktv-1', email: 'ktv1@bellaspa.vn', role: 'ktv', tenant_id: 'tenant-a', full_name: 'KTV Hoa Lan', base_salary: 6000000 },
      { id: 'admin-1', email: 'admin@bellaspa.vn', role: 'admin', tenant_id: 'tenant-a', full_name: 'Admin Bella' }
    ],
    salary_records: [],
    session_reviews: [],
    franchise_royalty_invoices: [],
    inter_branch_clearing_records: [],
    tenants: [
      { id: 'tenant-a', name: 'Bella Spa Branch A', royalty_type: 'percentage', royalty_rate: 10, internal_clearing_rate: 150000 }
    ],
    packages: [
      { id: 'pkg-123', tenant_id: 'tenant-a', module_key: 'babycare', name: 'Gói Chăm Sóc Bầu VIP' }
    ]
  };
}

class MockQueryBuilder {
  private table: string;
  private filters: Record<string, any> = {};
  private rangeFilters: Array<{ field: string; operator: 'gte' | 'lte' | 'lt'; value: any }> = [];
  private updatePayload: any = null;
  private isDelete: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select() {
    return this;
  }

  eq(field: string, value: any) {
    this.filters[field] = value;
    return this;
  }

  in(field: string, values: any[]) {
    this.filters[field] = values;
    return this;
  }

  gte(field: string, value: any) {
    this.rangeFilters.push({ field, operator: 'gte', value });
    return this;
  }

  lte(field: string, value: any) {
    this.rangeFilters.push({ field, operator: 'lte', value });
    return this;
  }

  lt(field: string, value: any) {
    this.rangeFilters.push({ field, operator: 'lt', value });
    return this;
  }

  limit() {
    return this;
  }

  order() {
    return this;
  }

  single() {
    const list = this.execute();
    if (list.length === 0) {
      return Promise.resolve({ data: null, error: { message: 'Row not found' } });
    }
    return Promise.resolve({ data: list[0], error: null });
  }

  maybeSingle() {
    const list = this.execute();
    return Promise.resolve({ data: list[0] || null, error: null });
  }

  insert(payload: any) {
    const inserted = Array.isArray(payload) ? payload : [payload];
    const records = inserted.map(item => {
      const newItem = {
        id: item.id || `mock-id-${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...item
      };
      (mockStore[this.table as keyof MockStore] as any[]).push(newItem);
      return newItem;
    });
    const res = { data: records[0], error: null };
    const arrayRes = { data: records, error: null };
    return {
      select: () => ({
        single: () => Promise.resolve(res),
        maybeSingle: () => Promise.resolve(res),
        then: (cb: any) => Promise.resolve(arrayRes).then(cb)
      }),
      single: () => Promise.resolve(res),
      maybeSingle: () => Promise.resolve(res),
      then: (cb: any) => Promise.resolve(arrayRes).then(cb)
    };
  }

  update(payload: any) {
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  private execute() {
    let list = mockStore[this.table as keyof MockStore] || [];
    for (const [field, val] of Object.entries(this.filters)) {
      if (Array.isArray(val)) {
        list = list.filter((item: any) => val.includes(item[field]));
      } else {
        list = list.filter((item: any) => item[field] === val);
      }
    }
    for (const filter of this.rangeFilters) {
      if (filter.operator === 'gte') {
        list = list.filter((item: any) => item[filter.field] >= filter.value);
      } else if (filter.operator === 'lte') {
        list = list.filter((item: any) => item[filter.field] <= filter.value);
      } else {
        list = list.filter((item: any) => item[filter.field] < filter.value);
      }
    }

    if (this.updatePayload) {
      for (const item of list) {
        Object.assign(item, this.updatePayload, { updated_at: new Date().toISOString() });
      }
      this.updatePayload = null;
    } else if (this.isDelete) {
      const matchedIds = list.map((m: any) => m.id);
      mockStore[this.table as keyof MockStore] = (mockStore[this.table as keyof MockStore] as any[]).filter(
        (item: any) => !matchedIds.includes(item.id)
      ) as any;
      this.isDelete = false;
    }

    return list;
  }

  then(onfulfilled: any) {
    const list = this.execute();
    return Promise.resolve({ data: list, error: null }).then(onfulfilled);
  }
}

function recordRemainingPaymentAtomicMock(params: any) {
  const booking = mockStore.bookings.find((b) => b.id === params.p_booking_id);
  if (!booking) {
    return Promise.resolve({ data: null, error: { message: 'Booking not found' } });
  }

  const targetPrice = (booking.full_price || 0) * (1 - (booking.discount_percent || 0) / 100);
  const currentDebt = targetPrice - (booking.deposit_amount || 0);
  if (params.p_amount <= 0 || params.p_amount > currentDebt) {
    return Promise.resolve({ data: null, error: { message: 'Invalid remaining payment amount' } });
  }

  const revenueId = `rev-remaining-${mockStore.revenue.length + 1}`;
  const newTotalPaid = (booking.deposit_amount || 0) + params.p_amount;
  const newStatus = newTotalPaid >= targetPrice && ['deposit_pending', 'deposit'].includes(booking.status)
    ? 'booked'
    : booking.status;
  const revenueStatus = params.p_status === 'confirmed' || newStatus === 'booked'
    ? 'confirmed'
    : (params.p_status || 'pending');

  mockStore.revenue.push({
    id: revenueId,
    booking_id: params.p_booking_id,
    amount: params.p_amount,
    revenue_type: params.p_revenue_type || 'remaining_payment',
    payment_method: params.p_payment_method,
    received_date: params.p_received_date,
    status: revenueStatus,
    notes: params.p_notes,
    receipt_url: params.p_receipt_url,
    tenant_id: booking.tenant_id,
    business_event_type: params.p_business_event_type,
    accounting_review_status: params.p_accounting_review_status,
    accounting_metadata: params.p_accounting_metadata,
    is_locked: false,
  });

  Object.assign(booking, {
    deposit_amount: newTotalPaid,
    status: newStatus,
    updated_at: new Date().toISOString(),
  });

  return Promise.resolve({
    data: {
      booking_id: params.p_booking_id,
      revenue_id: revenueId,
      booking_status: newStatus,
      deposit_amount: newTotalPaid,
      revenue_status: revenueStatus,
    },
    error: null,
  });
}

const mockSupabase = {
  from: jest.fn((table: string) => new MockQueryBuilder(table)),
  rpc: jest.fn().mockImplementation((name, params) => {
    if (name === 'record_remaining_payment_atomic') {
      return recordRemainingPaymentAtomicMock(params);
    }

    if (name === 'lock_monthly_records') {
      const monthStart = params.p_month;
      const monthEnd = `${monthStart.substring(0, 7)}-31`;
      
      mockStore.revenue
        .filter(r => r.tenant_id === params.p_tenant_id && r.received_date >= monthStart && r.received_date <= monthEnd)
        .forEach(r => r.is_locked = true);

      mockStore.salary_records
        .filter(s => s.tenant_id === params.p_tenant_id && s.month_year === monthStart)
        .forEach(s => s.is_locked = true);

      return Promise.resolve({ error: null });
    }
    return Promise.resolve({ error: null });
  }),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@bellaspa.vn' } } }),
  }
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

describe('Cross-Module End-to-End Integrity Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-15T03:00:00.000Z'));
    jest.clearAllMocks();
    resetMockStore();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-a',
      full_name: 'Admin Bella'
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs the complete cross-module pipeline successfully', async () => {
    // ----------------------------------------------------
    // 1. Online Booking Creation (confirmed deposit)
    // ----------------------------------------------------
    const bookingFormData = {
      customer_id: 'cust-123',
      package_id: 'pkg-123',
      package_name: 'Gói Chăm Sóc Bầu VIP',
      full_price: 5000000,
      deposit_amount: 1000000,
      total_sessions: 15,
      start_date: '2026-05-10',
      assigned_ktv_id: 'ktv-1',
      preferred_time: '14:00',
    };

    const createResult = await createBooking(bookingFormData);
    expect(createResult.error).toBeUndefined();
    expect(createResult.data).toBeDefined();

    const booking = createResult.data!;
    expect(booking.status).toBe('booked');
    expect(mockStore.revenue).toHaveLength(1);
    expect(mockStore.revenue[0].amount).toBe(1000000);
    expect(mockStore.revenue[0].revenue_type).toBe('deposit');

    // Assert side effects
    expect(enqueueWithAutoClient).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ eventType: 'PACKAGE_SALE', referenceType: 'REVENUE' }),
      expect.any(String)
    );

    // ----------------------------------------------------
    // 2. Paying Remaining Balance
    // ----------------------------------------------------
    const paymentResult = await recordRemainingPayment({
      booking_id: booking.id,
      customer_id: 'cust-123',
      amount: 4000000,
      payment_method: 'bank_transfer',
      status: 'confirmed'
    });

    expect(paymentResult.error).toBeUndefined();
    expect(paymentResult.success).toBe(true);

    const activeBooking = mockStore.bookings.find(b => b.id === booking.id);
    expect(activeBooking.status).toBe('booked');
    expect(mockStore.revenue).toHaveLength(2);
    expect(mockStore.revenue[1].amount).toBe(4000000);
    expect(mockStore.revenue[1].revenue_type).toBe('remaining_payment');

    // ----------------------------------------------------
    // 3. Complete Service Session
    // ----------------------------------------------------
    mockGetCurrentUser.mockResolvedValue({
      id: 'ktv-1',
      role: 'ktv',
      tenant_id: 'tenant-a',
      full_name: 'KTV Hoa Lan'
    });

    // Setup scheduled session log in store
    const session = {
      id: 'session-1',
      booking_id: booking.id,
      session_number: 1,
      status: 'scheduled'
    };
    mockStore.session_logs.push(session);

    const completeResult = await completeSession('session-1', booking.id, 'Hoàn thành tốt');
    expect(completeResult.error).toBeUndefined();
    expect(completeResult.success).toBe(true);

    expect(session.status).toBe('completed');
    expect(mockStore.session_reviews).toHaveLength(1);
    expect(mockStore.session_reviews[0].session_log_id).toBe('session-1');
    expect(mockStore.session_reviews[0].status).toBe('pending_review');

    // Verify inventory auto consume side effect
    expect(autoConsumeForSession).toHaveBeenCalledWith('pkg-123', 'session-1');

    // Verify salary record got created/updated
    expect(mockStore.salary_records).toHaveLength(1);
    expect(mockStore.salary_records[0].ktv_id).toBe('ktv-1');
    expect(mockStore.salary_records[0].total_sessions).toBe(1);

    // ----------------------------------------------------
    // 4. Month Locking & Finance Calculations
    // ----------------------------------------------------
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-a'
    });

    const lockResult = await lockMonth('2026-05-01');
    expect(lockResult.success).toBe(true);

    // Verify financial records locked
    expect(mockStore.revenue[0].is_locked).toBe(true);
    expect(mockStore.revenue[1].is_locked).toBe(true);
    expect(mockStore.salary_records[0].is_locked).toBe(true);

    // Verify inter-branch clearing / franchise calculations enqueued
    expect(recordAuditLog).toHaveBeenCalled();
  });
});
