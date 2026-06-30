/**
 * Unit Tests: Executive Intelligence Queries
 * 
 * Simplified test suite focusing on critical paths and error handling.
 * Uses mocked Supabase client to avoid database dependencies.
 */

import {
  getMonthlyRevenueSummary,
  getOperationalEfficiency,
  getCustomerMetrics,
  getFinancialHealth,
  getGrowthIndicators,
} from '../queries';
import type { DateRange } from '../../shared/types';
import { QueryError } from '../../shared/types';
import { createClient } from '@/lib/supabase-client';

// Mock Supabase client
jest.mock('@/lib/supabase-client');

// Helper to create chainable Supabase mock
function createSupabaseMock(mockData: any[]) {
  const result = Promise.resolve({ data: mockData, error: null });
  
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
  };
  
  // Override all methods to return the builder itself (for chaining)
  // and make builder thenable (awaitable)
  Object.keys(builder).forEach(key => {
    builder[key] = jest.fn(() => builder);
  });
  
  // Make builder thenable so it can be awaited
  builder.then = result.then.bind(result);
  builder.catch = result.catch.bind(result);
  builder.finally = result.finally.bind(result);
  
  return builder;
}

describe('Executive Intelligence Queries', () => {
  const mockTenantId = '12345678-1234-4123-a123-123456789012';
  const mockDateRange: DateRange = {
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMonthlyRevenueSummary', () => {
    it('should return revenue summary', async () => {
      const currentRevenue = createSupabaseMock([
        { amount: 5000000, status: 'confirmed', revenue_type: 'service', payment_method: 'cash' },
        { amount: 3000000, status: 'confirmed', revenue_type: 'service', payment_method: 'transfer' },
      ]);

      const prevRevenue = createSupabaseMock([
        { amount: 4000000, status: 'confirmed' },
      ]);

      const mockClient = {
        from: jest.fn()
          .mockReturnValueOnce(currentRevenue)
          .mockReturnValueOnce(prevRevenue),
      };

      (createClient as jest.Mock).mockReturnValue(mockClient);

      const result = await getMonthlyRevenueSummary(mockTenantId, mockDateRange);

      expect(result.totalRevenue).toBe(8000000);
      expect(result.topRevenueSources.length).toBeGreaterThan(0);
    });
  });

  describe('getOperationalEfficiency', () => {
    it('should return operational metrics', async () => {
      const sessions = createSupabaseMock([
        { id: '1', rating: 5, bookings: { tenant_id: mockTenantId } },
      ]);
      const ktvs = createSupabaseMock([{ id: 'ktv1' }]);
      const bookings = createSupabaseMock([{ total_sessions: 10, completed_sessions: 8 }]);

      const mockClient = {
        from: jest.fn()
          .mockReturnValueOnce(sessions)
          .mockReturnValueOnce(ktvs)
          .mockReturnValueOnce(bookings),
      };

      (createClient as jest.Mock).mockReturnValue(mockClient);

      const result = await getOperationalEfficiency(mockTenantId, mockDateRange);

      expect(result.period).toBe('2026-06-01');
      expect(result.averageSessionRating).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCustomerMetrics', () => {
    it('should return customer metrics', async () => {
      const bookings = createSupabaseMock([
        { customer_id: 'c1', full_price: 2000000, created_at: '2026-06-10' },
      ]);
      const history = createSupabaseMock([
        { customer_id: 'c1', created_at: '2026-06-10' },
      ]);

      const mockClient = {
        from: jest.fn()
          .mockReturnValueOnce(bookings)
          .mockReturnValueOnce(history),
      };

      (createClient as jest.Mock).mockReturnValue(mockClient);

      const result = await getCustomerMetrics(mockTenantId, mockDateRange);

      expect(result.period).toBe('2026-06-01');
      expect(result.averageBookingValue).toBeGreaterThan(0);
    });
  });

  describe('getFinancialHealth', () => {
    it('should return financial health metrics', async () => {
      const revenue = createSupabaseMock([{ amount: 10000000, status: 'confirmed' }]);
      const expenses = createSupabaseMock([{ amount: 3000000, category: 'salary', status: 'approved' }]);
      const pending = createSupabaseMock([]);

      const mockClient = {
        from: jest.fn()
          .mockReturnValueOnce(revenue)
          .mockReturnValueOnce(expenses)
          .mockReturnValueOnce(pending),
      };

      (createClient as jest.Mock).mockReturnValue(mockClient);

      const result = await getFinancialHealth(mockTenantId, mockDateRange);

      expect(result.period).toBe('2026-06-01');
      expect(result.profitMargin).toBeGreaterThan(0);
    });
  });

  describe('getGrowthIndicators', () => {
    it('should return growth indicators', async () => {
      const current = createSupabaseMock([{ amount: 5000000, status: 'confirmed', revenue_type: 'service' }]);
      const prevMonth = createSupabaseMock([{ amount: 4000000, status: 'confirmed', revenue_type: 'service' }]);
      const prevYear = createSupabaseMock([{ amount: 3000000, status: 'confirmed', revenue_type: 'service' }]);

      const mockClient = {
        from: jest.fn()
          .mockReturnValueOnce(current)
          .mockReturnValueOnce(prevMonth)
          .mockReturnValueOnce(prevYear),
      };

      (createClient as jest.Mock).mockReturnValue(mockClient);

      const result = await getGrowthIndicators(mockTenantId, mockDateRange);

      expect(result.period).toBe('2026-06-01');
      expect(result.monthOverMonthGrowth).toBeDefined();
    });
  });
});
