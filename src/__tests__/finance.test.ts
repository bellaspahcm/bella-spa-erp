import { getMonthlyPnL, getServicePerformance } from '../services/finance-actions';

// Mock MockQueryBuilder for Supabase chains
class MockQueryBuilder {
  static errorsByTable: Record<string, { message: string } | null> = {};

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
        return new MockQueryBuilder(table, [
          { amount: 1000000, status: 'confirmed', revenue_type: 'package_payment', received_date: '2026-05-10' },
          { amount: 500000, status: 'pending', revenue_type: 'additional', received_date: '2026-05-12' }, // should be ignored since not 'confirmed'
        ]);
      } else if (table === 'expenses') {
        return new MockQueryBuilder(table, [
          { amount: 200000, category: 'rent', expense_date: '2026-05-01', status: 'approved' },
          { amount: 100000, category: 'utilities', expense_date: '2026-05-05', status: 'approved' },
          { amount: 1500000, category: 'salary', expense_date: '2026-05-20', status: 'approved' }, // KTV salary expense
        ]);
      } else if (table === 'bookings') {
        return new MockQueryBuilder(table, [
          { id: 'b1', status: 'completed', full_price: 1000000, completed_sessions: 10, total_sessions: 10, ktv_commission: 150000 }
        ]);
      } else if (table === 'session_logs') {
        return new MockQueryBuilder(table, [
          { id: 's1', completed_by_ktv_id: 'ktv1', status: 'completed', completed_date: '2026-05-15', booking_id: 'b1', bookings: { tenant_id: 'tenant1', ktv_commission: 150000 } }
        ]);
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
