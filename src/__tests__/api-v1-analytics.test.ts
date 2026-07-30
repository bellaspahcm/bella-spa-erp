jest.mock('server-only', () => ({}), { virtual: true });

const mockRpc = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

const mockAdminFrom = jest.fn();
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  single: jest.fn().mockImplementation(() => Promise.resolve({ data: { metadata: {} }, error: null })),
  then(resolve: any) {
    resolve({ data: [], count: 0, error: null });
  },
};
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockAdminFrom,
    rpc: mockRpc,
  })),
}));

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://mock.supabase.co',
  getSupabaseAdminKey: () => 'mock-key',
}));

// Mock the Executive Intelligence service
const mockGetMonthlyRevenueSummary = jest.fn();
const mockGetOperationalEfficiency = jest.fn();
const mockGetCustomerMetrics = jest.fn();
const mockGetFinancialHealth = jest.fn();
const mockGetGrowthIndicators = jest.fn();

jest.mock('@/services/intelligence/executive', () => ({
  getExecutiveIntelligence: () => ({
    getMonthlyRevenueSummary: mockGetMonthlyRevenueSummary,
    getOperationalEfficiency: mockGetOperationalEfficiency,
    getCustomerMetrics: mockGetCustomerMetrics,
    getFinancialHealth: mockGetFinancialHealth,
    getGrowthIndicators: mockGetGrowthIndicators,
  }),
}));

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/analytics/route';

const MOCK_API_KEY = 'pk_live_bella_eos_key';
const MOCK_TENANT_ID = 'tenant_eos_uuid';

describe('/api/v1/analytics Route - Public Partner Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ data: null, error: null });

    // Mock validate_api_partner
    mockRpc.mockImplementation((fn, params) => {
      if (params.p_api_key === MOCK_API_KEY) {
        return Promise.resolve({
          data: [{
            partner_id: 'partner_bella_eos',
            tenant_id: MOCK_TENANT_ID,
            partner_name: 'BELLA EOS',
            allowed_scopes: ['analytics:read'],
            is_active: true,
            is_sandbox: false,
            rate_limit_per_minute: 100,
            rate_limit_per_day: 5000,
          }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockFrom.mockImplementation(() => ({
      insert: mockInsert,
    }));

    mockAdminFrom.mockImplementation(() => mockQueryBuilder);

    // Mock intelligence response data
    mockGetMonthlyRevenueSummary.mockResolvedValue({
      data: {
        period: '2026-07-01',
        totalRevenue: 50000000,
        revenueGrowth: 5.2,
        topRevenueSources: [],
        revenueByPaymentMethod: [],
      },
    });

    mockGetOperationalEfficiency.mockResolvedValue({
      data: {
        period: '2026-07-01',
        ktvUtilizationRate: 75,
        averageSessionRating: 4.8,
        serviceCompletionRate: 98,
        revenuePerKtv: 5000000,
      },
    });

    mockGetCustomerMetrics.mockResolvedValue({
      data: {
        period: '2026-07-01',
        newCustomers: 120,
        retentionRate: 85,
        averageBookingValue: 450000,
        customerLifetimeValue: 2500000,
      },
    });

    mockGetFinancialHealth.mockResolvedValue({
      data: {
        period: '2026-07-01',
        profitMargin: 22,
        cashFlow: 15000000,
        outstandingReceivables: 3000000,
        expenseBreakdown: [],
      },
    });

    mockGetGrowthIndicators.mockResolvedValue({
      data: {
        period: '2026-07-01',
        monthOverMonthGrowth: 4.5,
        yearOverYearGrowth: 18.2,
        projectedRevenue: 55000000,
        topGrowingServices: [],
      },
    });
  });

  it('GET /api/v1/analytics returns 200 with aggregated analytics and logs request', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analytics?period=month', {
      method: 'GET',
      headers: {
        'x-api-key': MOCK_API_KEY,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.environment).toBe('production');
    expect(body.data.analytics_data.revenue.totalRevenue).toBe(50000000);
    expect(body.data.analytics_data.efficiency.ktvUtilizationRate).toBe(75);
    expect(body.data.analytics_data.customer.newCustomers).toBe(120);

    expect(mockGetMonthlyRevenueSummary).toHaveBeenCalledWith(MOCK_TENANT_ID, expect.any(Object));
  });

  it('returns 403 if partner lacks analytics:read scope', async () => {
    mockRpc.mockImplementation((fn, params) => {
      if (params.p_api_key === MOCK_API_KEY) {
        return Promise.resolve({
          data: [{
            partner_id: 'partner_bella_eos',
            tenant_id: MOCK_TENANT_ID,
            partner_name: 'BELLA EOS',
            allowed_scopes: ['order:read'], // No analytics:read scope
            is_active: true,
            is_sandbox: false,
            rate_limit_per_minute: 100,
            rate_limit_per_day: 5000,
          }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = new NextRequest('http://localhost:3000/api/v1/analytics', {
      method: 'GET',
      headers: {
        'x-api-key': MOCK_API_KEY,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });
});
