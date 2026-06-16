/**
 * End-to-End Spa Business Pipeline Integration Tests.
 *
 * This test suite simulates the entire business lifecycle for Bella Spa ERP:
 * 1. Guest creates booking with confirmed deposit (booked, record initial deposit in revenue).
 * 2. Admin records remaining payment while booking remains ready for service.
 * 3. KTV checks in / checks out & completes sessions (increments sessions completed, auto-creates session reviews).
 * 4. System aggregates monthly P&L dynamically calculating commissions, rating bonuses, and operating expenses.
 * 5. Admin locks the month, protecting all financial records and salary records from further updates.
 */

import { createBooking, recordRemainingPayment } from '../core/services/order/lifecycle-actions';
import { completeSession } from '../core/services/order/session-actions';
import { getMonthlyPnL, lockMonth } from '../services/finance-actions';
import { autoConsumeForSession } from '../services/inventory-actions';
import { recordAuditLog } from '../services/audit-actions';
import { enqueueWithAutoClient } from '../lib/accounting-outbox';

// --- Global Mock Store ---
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
      {
        id: 'ktv-1',
        email: 'ktv1@bellaspa.vn',
        role: 'ktv',
        tenant_id: 'tenant-a',
        full_name: 'KTV Hoa Lan',
        base_salary: 6000000,
      },
      {
        id: 'admin-1',
        email: 'admin@bellaspa.vn',
        role: 'admin',
        tenant_id: 'tenant-a',
        full_name: 'Admin Bella',
      },
    ],
    salary_records: [],
    session_reviews: [],
    franchise_royalty_invoices: [],
    inter_branch_clearing_records: [],
    tenants: [
      { id: 'tenant-a', name: 'Bella Spa Branch A', royalty_type: 'percentage', royalty_rate: 10, internal_clearing_rate: 150000 },
    ],
    packages: [
      { id: 'pkg-123', tenant_id: 'tenant-a', module_key: 'babycare', name: 'Gói Chăm Sóc Bầu VIP' },
    ],
  };
}

// --- Mock Query Builder ---
class MockQueryBuilder {
  private table: string;
  private filters: ((item: any) => boolean)[] = [];
  private orderField: string | null = null;
  private limitCount: number | null = null;
  private countOptions: any = null;
  private updatePayload: any = null;
  private isDelete: boolean = false;

  constructor(table: string, countOptions: any = null) {
    this.table = table;
    this.countOptions = countOptions;
  }

  eq(field: string, value: any) {
    this.filters.push((item) => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return item[parent]?.[child] === value;
      }
      return item[field] === value;
    });
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push((item) => values.includes(item[field]));
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push((item) => item[field] >= value);
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push((item) => item[field] <= value);
    return this;
  }

  lt(field: string, value: any) {
    this.filters.push((item) => item[field] < value);
    return this;
  }

  not(field: string, operator: string, value: any) {
    if (operator === 'eq') {
      this.filters.push((item) => item[field] !== value);
    }
    return this;
  }

  or(filterStr: string) {
    this.filters.push((item) => {
      const conditions = filterStr.split(',');
      return conditions.some((cond) => {
        const [f, op, val] = cond.split('.');
        if (op === 'eq') return item[f] === val;
        return false;
      });
    });
    return this;
  }

  order(field: string, options?: any) {
    this.orderField = field;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  select(fields?: string, options?: any) {
    if (options) {
      this.countOptions = options;
    }
    return this;
  }

  private execute() {
    let list = (mockStore as any)[this.table] || [];

    // Enrichments first so filters can operate on joined fields (e.g. bookings.tenant_id)
    if (this.table === 'bookings') {
      list = list.map((item: any) => ({
        ...item,
        customers: mockStore.users.find((u) => u.id === item.customer_id) || {
          name_mother: 'Mẹ Nguyễn Vy',
          name_baby: 'Bé Cherry',
          phone: '0901234567',
        },
        packages: { name: item.package_name || 'Gói Bầu VIP' },
      }));
    }

    if (this.table === 'session_logs') {
      list = list.map((item: any) => ({
        ...item,
        bookings: mockStore.bookings.find((b) => b.id === item.booking_id) || null,
        session_reviews: mockStore.session_reviews.filter((sr) => sr.session_log_id === item.id),
      }));
    }

    if (this.table === 'revenue') {
      list = list.map((item: any) => {
        const bk = mockStore.bookings.find((b) => b.id === item.booking_id);
        return {
          ...item,
          bookings: bk
            ? {
                package_name: bk.package_name || 'Gói Dịch Vụ',
                customers: mockStore.users.find((u) => u.id === bk.customer_id) || null,
              }
            : null,
        };
      });
    }

    for (const filter of this.filters) {
      list = list.filter(filter);
    }

    if (this.orderField) {
      list = [...list].sort((a, b) => {
        const valA = a[this.orderField!];
        const valB = b[this.orderField!];
        if (typeof valA === 'string') return valA.localeCompare(valB);
        return (valA || 0) - (valB || 0);
      });
    }
    if (this.limitCount !== null) {
      list = list.slice(0, this.limitCount);
    }

    return list;
  }

  insert(data: any | any[]) {
    const list = Array.isArray(data) ? data : [data];
    const inserted: any[] = [];
    for (const item of list) {
      const newItem = {
        id: item.id || `mock-id-${Math.random().toString(36).substr(2, 9)}`,
        ...item,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      ((mockStore as any)[this.table]).push(newItem);
      inserted.push(newItem);
    }

    const result = {
      data: Array.isArray(data) ? inserted : inserted[0],
      error: null,
      count: inserted.length,
    };

    const chain = {
      select: () => ({
        single: () => Promise.resolve({ data: inserted[0], error: null }),
        maybeSingle: () => Promise.resolve({ data: inserted[0], error: null }),
        then: (cb: any) => Promise.resolve(result).then(cb),
      }),
      single: () => Promise.resolve({ data: inserted[0], error: null }),
      maybeSingle: () => Promise.resolve({ data: inserted[0], error: null }),
      then: (cb: any) => Promise.resolve(result).then(cb),
    };
    return chain;
  }

  update(payload: any) {
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  private applyPendingMutation() {
    if (this.updatePayload) {
      const list = this.execute();
      const originalList = (mockStore as any)[this.table] || [];
      for (const item of list) {
        const originalItem = originalList.find((x: any) => x.id === item.id);
        if (originalItem) {
          Object.assign(originalItem, this.updatePayload, { updated_at: new Date().toISOString() });
        }
        Object.assign(item, this.updatePayload, { updated_at: new Date().toISOString() });
      }
      this.updatePayload = null;
    } else if (this.isDelete) {
      const list = this.execute();
      const matchedIds = list.map((m: any) => m.id);
      (mockStore as any)[this.table] = ((mockStore as any)[this.table]).filter(
        (item: any) => !matchedIds.includes(item.id)
      );
      this.isDelete = false;
    }
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    this.applyPendingMutation();
    const list = this.execute();
    const res: any = { data: list, error: null };
    if (this.countOptions) {
      res.count = list.length;
    }
    return Promise.resolve(res).then(onfulfilled, onrejected);
  }

  async single() {
    this.applyPendingMutation();
    const list = this.execute();
    if (list.length === 0) {
      return { data: null, error: { message: 'No rows found' } };
    }
    return { data: list[0], error: null };
  }

  async maybeSingle() {
    this.applyPendingMutation();
    const list = this.execute();
    return { data: list[0] || null, error: null };
  }
}

// --- Mocks Infrastructure ---
const mockGetCurrentUser = jest.fn();
jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

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

const mockSupabaseClient = {
  from: jest.fn((table: string) => new MockQueryBuilder(table)),
  rpc: jest.fn().mockImplementation((name, params) => {
    if (name === 'record_remaining_payment_atomic') {
      return recordRemainingPaymentAtomicMock(params);
    }

    if (name === 'lock_monthly_records') {
      const monthStart = params.p_month; // e.g. "2026-05-01"
      const monthEnd = `${monthStart.substring(0, 7)}-31`;
      
      // Update is_locked on matching records
      mockStore.revenue
        .filter(r => r.tenant_id === params.p_tenant_id && r.received_date >= monthStart && r.received_date <= monthEnd)
        .forEach(r => r.is_locked = true);

      mockStore.expenses
        .filter(e => e.tenant_id === params.p_tenant_id && e.expense_date >= monthStart && e.expense_date <= monthEnd)
        .forEach(e => e.is_locked = true);

      mockStore.salary_records
        .filter(s => s.tenant_id === params.p_tenant_id && s.month_year === monthStart)
        .forEach(s => s.is_locked = true);

      return Promise.resolve({ error: null });
    }
    return Promise.resolve({ error: null });
  }),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@bellaspa.vn' } } }),
  },
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockReturnValue(true),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue('127.0.0.1'),
  }),
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

    const commission = 150000;
    const ratingBonusPerSession = 50000;
    const baseSalary = 6000000;

    if (salaryRec) {
      const nextSessions = (salaryRec.total_sessions || 0) + 1;
      await supabase.from('salary_records').update({
        total_sessions: nextSessions,
        session_bonus: nextSessions * commission,
        rating_bonus: nextSessions * ratingBonusPerSession,
        base_salary: baseSalary,
        total_salary: baseSalary + (nextSessions * commission) + (nextSessions * ratingBonusPerSession),
      }).eq('id', salaryRec.id);
    } else {
      await supabase.from('salary_records').insert({
        ktv_id: ktvId,
        month_year: monthYear,
        total_sessions: 1,
        session_bonus: commission,
        rating_bonus: ratingBonusPerSession,
        base_salary: baseSalary,
        total_salary: baseSalary + commission + ratingBonusPerSession,
        tenant_id: tenantId,
        status: 'draft',
      });
    }
    return { success: true, totalSalary: 6400000 };
  })
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
  checkMonthLock: jest.fn().mockResolvedValue({ isLocked: false }),
}));

jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: jest.fn().mockResolvedValue(true),
}));

// --- Test Suite Execution ---
describe('End-to-End Business Pipeline Integration Suite', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-15T03:00:00.000Z'));
    jest.clearAllMocks();
    resetMockStore();
    
    // Default logged in user is the Tenant Admin
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@bellaspa.vn',
      role: 'admin',
      tenant_id: 'tenant-a',
      full_name: 'Admin Bella',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('verifies the absolute full booking-to-salary business pipeline flow', async () => {
    // ----------------------------------------------------
    // STEP 1: Online Booking & Deposit (Partially paid)
    // ----------------------------------------------------
    const bookingFormData = {
      customer_id: 'cust-123',
      package_id: 'pkg-123',
      package_name: 'Gói Chăm Sóc Bầu VIP',
      full_price: 5000000,
      deposit_amount: 1000000, // Pays 1M VND deposit first
      total_sessions: 15,
      start_date: '2026-05-10',
      assigned_ktv_id: 'ktv-1',
      preferred_time: '14:00',
    };

    const createResult = await createBooking(bookingFormData);
    expect(createResult.error).toBeUndefined();
    expect(createResult.data).toBeDefined();

    const createdBooking = createResult.data!;
    expect(createdBooking.status).toBe('booked'); // Deposit is confirmed, remaining balance is tracked separately
    expect(createdBooking.deposit_amount).toBe(1000000);
    expect(createdBooking.ktv_commission).toBe(150000); // Standard commission auto-resolved

    // Assert that the initial deposit has been recorded in the revenue table
    expect(mockStore.revenue).toHaveLength(1);
    expect(mockStore.revenue[0].amount).toBe(1000000);
    expect(mockStore.revenue[0].revenue_type).toBe('deposit');
    expect(mockStore.revenue[0].tenant_id).toBe('tenant-a');

    expect(enqueueWithAutoClient).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        eventType: 'PACKAGE_SALE',
        referenceType: 'REVENUE',
      }),
      expect.any(String)
    );

    // Assert that 15 scheduled sessions were automatically generated
    const scheduledSessions = mockStore.session_logs.filter(s => s.booking_id === createdBooking.id);
    expect(scheduledSessions).toHaveLength(15);
    expect(scheduledSessions[0].status).toBe('scheduled');
    expect(scheduledSessions[0].assigned_date).toBe('2026-05-10');

    // ----------------------------------------------------
    // STEP 2: Record Remaining Payment (Admin verification & Approval)
    // ----------------------------------------------------
    // Client pays remaining 4,000,000 VND to complete full price
    const paymentResult = await recordRemainingPayment({
      booking_id: createdBooking.id,
      customer_id: 'cust-123',
      amount: 4000000,
      payment_method: 'bank_transfer',
      notes: 'Thanh toán nốt 4 triệu còn lại',
      status: 'confirmed',
    });

    expect(paymentResult.error).toBeUndefined();
    expect(paymentResult.success).toBe(true);

    // Verify booking remains ready for service and full price has been collected
    const activeBooking = mockStore.bookings.find(b => b.id === createdBooking.id);
    expect(activeBooking.status).toBe('booked');
    expect(activeBooking.deposit_amount).toBe(5000000); // Fully paid

    // Confirm another revenue item is logged
    expect(mockStore.revenue).toHaveLength(2);
    expect(mockStore.revenue[1].amount).toBe(4000000);
    expect(mockStore.revenue[1].revenue_type).toBe('remaining_payment');

    // ----------------------------------------------------
    // STEP 3: KTV Complete Sessions (Mark sessions completed)
    // ----------------------------------------------------
    // KTV logs in
    mockGetCurrentUser.mockResolvedValue({
      id: 'ktv-1',
      email: 'ktv1@bellaspa.vn',
      role: 'ktv',
      tenant_id: 'tenant-a',
      full_name: 'KTV Hoa Lan',
    });

    // Complete Session 1
    const session1 = mockStore.session_logs.find(s => s.booking_id === createdBooking.id && s.session_number === 1);
    const complete1Result = await completeSession(session1.id, createdBooking.id, 'Hoàn thành tốt ca 1');
    expect(complete1Result.error).toBeUndefined();
    expect(complete1Result.success).toBe(true);

    // Verify session log status is 'completed' and belongs to KTV
    expect(session1.status).toBe('completed');
    expect(session1.completed_by_ktv_id).toBe('ktv-1');

    expect(autoConsumeForSession).toHaveBeenCalledWith(createdBooking.package_id, session1.id);
    expect(recordAuditLog).toHaveBeenCalled();

    // Verify that a session review with rating 0 / 'pending_review' was auto-created
    expect(mockStore.session_reviews).toHaveLength(1);
    expect(mockStore.session_reviews[0].session_log_id).toBe(session1.id);
    expect(mockStore.session_reviews[0].status).toBe('pending_review');

    // Verify booking status transitioned to 'in_progress' after first session completion
    expect(activeBooking.status).toBe('in_progress');

    // Verify that a draft salary record has been created for KTV in May 2026
    expect(mockStore.salary_records).toHaveLength(1);
    const ktvSalaryRecord = mockStore.salary_records[0];
    expect(ktvSalaryRecord.ktv_id).toBe('ktv-1');
    expect(ktvSalaryRecord.month_year).toBe('2026-05-01');
    expect(ktvSalaryRecord.total_sessions).toBe(1);
    expect(ktvSalaryRecord.session_bonus).toBe(150000); // Earned KTV commission

    // Complete Session 2
    const session2 = mockStore.session_logs.find(s => s.booking_id === createdBooking.id && s.session_number === 2);
    const complete2Result = await completeSession(session2.id, createdBooking.id, 'Ca 2 hoàn thành tốt');
    expect(complete2Result.success).toBe(true);

    // Verify salary record session counts and commissions updated
    expect(ktvSalaryRecord.total_sessions).toBe(2);
    expect(ktvSalaryRecord.session_bonus).toBe(300000); // 150K * 2

    // ----------------------------------------------------
    // STEP 4: Dynamic KPI, Commissions & P&L Calculation
    // ----------------------------------------------------
    // Admin logs back in to view financial reporting
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-a',
    });

    // Mock customer submitting session reviews (Session 1 receives 5 stars, Session 2 receives 5 stars)
    mockStore.session_reviews[0].rating = 5;
    mockStore.session_reviews[0].status = 'approved';
    mockStore.session_reviews[1].rating = 5;
    mockStore.session_reviews[1].status = 'approved';

    // Retrieve Monthly P&L
    const pnlReport = await getMonthlyPnL('2026-05-01');
    expect(pnlReport).not.toBeNull();
    expect(pnlReport?.total_revenue).toBe(5000000); // Deposit (1M) + Remaining (4M)

    // Dynamic Salaries check:
    // Base salary (6M) + commissions (150K * 2 = 300K) + rating bonus (50K * 2 sessions = 100K) - advances (300K) = 6.1M VND.
    expect(pnlReport?.total_ktv_salaries).toBe(6400000);
    expect(pnlReport?.net_profit).toBe(5000000 - 6400000); // 5M revenue - 6.4M salaries = -1.4M profit

    // ----------------------------------------------------
    // STEP 5: Month Locking
    // ----------------------------------------------------
    // Admin locks May 2026 records
    const lockResult = await lockMonth('2026-05-01');
    expect(lockResult.success).toBe(true);

    // Verify is_locked has been set on revenue and salary records
    expect(mockStore.revenue[0].is_locked).toBe(true);
    expect(mockStore.revenue[1].is_locked).toBe(true);
    expect(mockStore.salary_records[0].is_locked).toBe(true);
  });
});
