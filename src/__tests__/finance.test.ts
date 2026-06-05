import { getFinancialOverview, getMonthlyPnL, getServicePerformance } from '../services/finance-actions';

// Mock MockQueryBuilder for Supabase chains
class MockQueryBuilder {
  static errorsByTable: Record<string, { message: string } | null> = {};
  static dataByTable: Record<string, any[] | undefined> = {};

  constructor(private table: string, private data: any) {}

  select() { return this; }
  eq() { return this; }
  gte() { return this; }
  lt() { return this; }
  not() { return this; }
  order() { return this; }
  
  then(onfulfilled: any) {
    return Promise.resolve(onfulfilled({
      data: this.data,
      error: MockQueryBuilder.errorsByTable[this.table] ?? null,
    }));
  }
}

// Mock Supabase Server Client
jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'revenue') {
        return new MockQueryBuilder(table, MockQueryBuilder.dataByTable[table] ?? [
          { amount: 1000000, status: 'confirmed', revenue_type: 'package_payment', received_date: '2026-05-10' },
          { amount: 500000, status: 'pending', revenue_type: 'additional', received_date: '2026-05-12' }, // should be ignored since not 'confirmed'
        ]);
      } else if (table === 'expenses') {
        return new MockQueryBuilder(table, MockQueryBuilder.dataByTable[table] ?? [
          { amount: 200000, category: 'rent', expense_date: '2026-05-01', status: 'approved' },
          { amount: 100000, category: 'utilities', expense_date: '2026-05-05', status: 'approved' },
          { amount: 1500000, category: 'salary', expense_date: '2026-05-20', status: 'approved' }, // KTV salary expense
        ]);
      } else if (table === 'bookings') {
        return new MockQueryBuilder(table, MockQueryBuilder.dataByTable[table] ?? [
          { id: 'b1', status: 'completed', full_price: 1000000, completed_sessions: 10, total_sessions: 10, ktv_commission: 150000 }
        ]);
      } else if (table === 'session_logs') {
        return new MockQueryBuilder(table, MockQueryBuilder.dataByTable[table] ?? [
          { id: 's1', completed_by_ktv_id: 'ktv1', status: 'completed', completed_date: '2026-05-15', booking_id: 'b1', bookings: { tenant_id: 'tenant1', ktv_commission: 150000 } }
        ]);
      } else if (table === 'users') {
        return new MockQueryBuilder(table, MockQueryBuilder.dataByTable[table] ?? []);
      } else if (table === 'salary_records') {
        return new MockQueryBuilder(table, MockQueryBuilder.dataByTable[table] ?? []);
      } else if (table === 'attendance') {
        return new MockQueryBuilder(table, MockQueryBuilder.dataByTable[table] ?? []);
      }
      return new MockQueryBuilder(table, []);
    })
  }))
}));

// Mock User Actions to bypass Auth check
jest.mock('../services/user-actions', () => ({
  getCurrentUser: jest.fn(() => Promise.resolve({
    id: 'admin1',
    full_name: 'Test Admin',
    role: 'admin',
    tenant_id: 'tenant1'
  }))
}));

describe('getMonthlyPnL', () => {
  beforeEach(() => {
    MockQueryBuilder.errorsByTable = {};
    MockQueryBuilder.dataByTable = {};
  });

  it('should calculate P&L correctly based on confirmed revenues and expenses', async () => {
    const result = await getMonthlyPnL('2026-05-01');
    
    expect(result).not.toBeNull();
    if (result) {
      // Confirmed revenue = 1,000,000 (pending 500,000 is ignored)
      expect(result.total_revenue).toBe(1000000);
      
      // Operating expenses (excluding salary) = rent (200,000) + utilities (100,000) = 300,000
      expect(result.total_operating_expenses).toBe(300000);
      
      // KTV salaries expense (category 'salary') = 1,500,000
      expect(result.total_ktv_salaries).toBe(1500000);
      
      // Net Profit = Revenue (1,000,000) - Expenses (300,000 + 1,500,000) = -800,000
      expect(result.net_profit).toBe(-800000);
      
      expect(result.is_locked).toBe(false);
    }
  });

  it('propagates database query errors instead of returning null', async () => {
    MockQueryBuilder.errorsByTable.revenue = { message: 'revenue table unavailable' };

    await expect(getMonthlyPnL('2026-05-01')).rejects.toThrow(
      '[getMonthlyPnL] revenue query failed: revenue table unavailable'
    );
  });

  it('only counts confirmed revenue and approved or paid expenses', async () => {
    MockQueryBuilder.dataByTable = {
      revenue: [
        { amount: 1000000, status: 'confirmed', revenue_type: 'package_payment', received_date: '2026-05-10' },
        { amount: 900000, status: 'pending', revenue_type: 'package_payment', received_date: '2026-05-11' },
        { amount: 800000, status: 'cancelled', revenue_type: 'additional', received_date: '2026-05-12' },
      ],
      expenses: [
        { amount: 200000, category: 'rent', expense_date: '2026-05-01', status: 'approved' },
        { amount: 300000, category: 'utilities', expense_date: '2026-05-02', status: 'paid' },
        { amount: 400000, category: 'materials', expense_date: '2026-05-03', status: 'submitted' },
        { amount: 500000, category: 'other', expense_date: '2026-05-04', status: 'rejected' },
        { amount: 600000, category: 'salary', expense_date: '2026-05-05', status: 'draft' },
        { amount: 700000, category: 'salary', expense_date: '2026-05-06', status: 'paid' },
      ],
      bookings: [],
      session_logs: [],
    };

    const result = await getMonthlyPnL('2026-05-01');

    expect(result.total_revenue).toBe(1000000);
    expect(result.total_operating_expenses).toBe(500000);
    expect(result.total_ktv_salaries).toBe(700000);
    expect(result.net_profit).toBe(-200000);
  });

  it('uses saved salary records and pro-rata attendance for unsaved KTV salaries', async () => {
    MockQueryBuilder.dataByTable = {
      revenue: [
        { amount: 10000000, status: 'confirmed', revenue_type: 'package_payment', received_date: '2026-05-10' },
      ],
      expenses: [
        { amount: 250000, category: 'rent', expense_date: '2026-05-01', status: 'approved' },
      ],
      bookings: [],
      session_logs: [
        { id: 's1', completed_by_ktv_id: 'ktv-unsaved', status: 'completed', completed_date: '2026-05-15', booking_id: 'b1', bookings: { tenant_id: 'tenant1', ktv_commission: 150000 } },
        { id: 's2', completed_by_ktv_id: 'ktv-no-attendance', status: 'completed', completed_date: '2026-05-16', booking_id: 'b2', bookings: { tenant_id: 'tenant1', ktv_commission: 120000 } },
      ],
      users: [
        { id: 'ktv-saved', base_salary: 9000000 },
        { id: 'ktv-unsaved', base_salary: 5200000 },
        { id: 'ktv-no-attendance', base_salary: 7800000 },
      ],
      salary_records: [
        { ktv_id: 'ktv-saved', total_salary: 4500000, status: 'pending_approval' },
      ],
      attendance: [
        ...Array.from({ length: 13 }, () => ({ ktv_id: 'ktv-unsaved', status: 'present' })),
        { ktv_id: 'ktv-unsaved', status: 'absent' },
        { ktv_id: 'ktv-saved', status: 'present' },
      ],
    };

    const result = await getMonthlyPnL('2026-05-01');

    // saved record: 4,500,000
    // unsaved with 13 working days: (5,200,000 / 26) * 13 + 150,000 = 2,750,000
    // unsaved with 0 working days: base component 0 + session commission 120,000
    expect(result.total_ktv_salaries).toBe(7370000);
    expect(result.total_operating_expenses).toBe(250000);
    expect(result.net_profit).toBe(2380000);
  });
});

describe('getFinancialOverview', () => {
  beforeEach(() => {
    MockQueryBuilder.errorsByTable = {};
  });

  it('propagates revenue query errors instead of returning partial totals', async () => {
    MockQueryBuilder.errorsByTable.revenue = { message: 'revenue overview failed' };

    await expect(getFinancialOverview()).rejects.toThrow(
      '[getFinancialOverview] revenue query failed: revenue overview failed'
    );
  });

  it('propagates expenses query errors instead of returning partial totals', async () => {
    MockQueryBuilder.errorsByTable.expenses = { message: 'expenses overview failed' };

    await expect(getFinancialOverview()).rejects.toThrow(
      '[getFinancialOverview] expenses query failed: expenses overview failed'
    );
  });
});

describe('getServicePerformance', () => {
  beforeEach(() => {
    MockQueryBuilder.errorsByTable = {};
  });

  it('propagates database query errors instead of returning an empty array', async () => {
    MockQueryBuilder.errorsByTable.bookings = { message: 'bookings query failed' };

    await expect(getServicePerformance()).rejects.toThrow(
      '[getServicePerformance] bookings query failed: bookings query failed'
    );
  });
});
