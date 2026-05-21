import { NextRequest } from 'next/server';

// Helper to create a chainable query builder mock that can be awaited
const createChainableMock = (resolvedValue: any, singleValueFn?: () => any) => {
  const chain: any = {
    eq: jest.fn(() => chain),
    single: jest.fn(() => {
      if (singleValueFn) return singleValueFn();
      return Promise.resolve(resolvedValue);
    }),
    maybeSingle: jest.fn(() => Promise.resolve(resolvedValue)),
    then: (resolve: any) => resolve(resolvedValue),
  };
  const select = jest.fn(() => chain);
  return { select };
};

// 1. Mock supabase-server client
const mockSingleTenant = jest.fn();
const mockRpcSubscription = jest.fn();

const mockSupabaseServer = {
  from: jest.fn((table: string) => {
    if (table === 'tenants') {
      return createChainableMock({}, mockSingleTenant);
    }
    if (table === 'users') {
      return createChainableMock({ count: 0, error: null });
    }
    if (table === 'customers') {
      return createChainableMock({ count: 0, error: null });
    }
    return {};
  }),
  rpc: mockRpcSubscription,
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseServer)),
}));

// 2. Mock @supabase/supabase-js for webhook route
const mockRouteRpc = jest.fn();
const mockRouteSupabase = {
  rpc: mockRouteRpc,
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockRouteSupabase),
}));

// Mock next/server dependencies or other things if necessary
jest.mock('server-only', () => ({}), { virtual: true });

// Dynamically import modules under test to prevent eager execution before mock variables are initialized
let checkSubscriptionLimit: any;
let POST: any;

describe('Subscription Constraints & Webhook Suite', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    checkSubscriptionLimit = require('@/lib/subscription').checkSubscriptionLimit;
    POST = require('@/app/api/webhooks/payment/route').POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://mock.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
      PAYMENT_WEBHOOK_SECRET: 'super-secret-webhook-key',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('checkSubscriptionLimit (Active Limits Boundary Checker)', () => {
    it('should allow KTV creation if within basic tier limits (max: 3)', async () => {
      // Mock tenant on basic tier
      mockSingleTenant.mockResolvedValue({
        data: {
          subscription_tier: 'basic',
          subscription_expires_at: new Date(Date.now() + 1000000).toISOString(),
          sms_allotment_used: 0,
        },
        error: null,
      });

      // Mock users table query to return 2 active KTVs (less than basic limit 3)
      mockSupabaseServer.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'tenants') {
          return createChainableMock({}, mockSingleTenant);
        }
        if (table === 'users') {
          return createChainableMock({ count: 2, error: null });
        }
        return {};
      });

      const res = await checkSubscriptionLimit('tenant-1', 'ktv');
      expect(res.isBlocked).toBe(false);
      expect(res.current).toBe(2);
      expect(res.max).toBe(3);
    });

    it('should block KTV creation if basic tier limits are exceeded (max: 3)', async () => {
      mockSingleTenant.mockResolvedValue({
        data: {
          subscription_tier: 'basic',
          subscription_expires_at: new Date(Date.now() + 1000000).toISOString(),
          sms_allotment_used: 0,
        },
        error: null,
      });

      mockSupabaseServer.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'tenants') {
          return createChainableMock({}, mockSingleTenant);
        }
        if (table === 'users') {
          return createChainableMock({ count: 3, error: null });
        }
        return {};
      });

      const res = await checkSubscriptionLimit('tenant-1', 'ktv');
      expect(res.isBlocked).toBe(true);
      expect(res.current).toBe(3);
    });

    it('should block active resources if subscription has expired', async () => {
      // Mock expired basic tier
      mockSingleTenant.mockResolvedValue({
        data: {
          subscription_tier: 'basic',
          subscription_expires_at: new Date(Date.now() - 100000).toISOString(), // expired in past
          sms_allotment_used: 0,
        },
        error: null,
      });

      const res = await checkSubscriptionLimit('tenant-1', 'customer');
      expect(res.isBlocked).toBe(true);
      expect(res.isExpired).toBe(true);
    });

    it('should enforce customer limits correctly', async () => {
      mockSingleTenant.mockResolvedValue({
        data: {
          subscription_tier: 'basic',
          subscription_expires_at: new Date(Date.now() + 1000000).toISOString(),
          sms_allotment_used: 0,
        },
        error: null,
      });

      mockSupabaseServer.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'tenants') {
          return createChainableMock({}, mockSingleTenant);
        }
        if (table === 'customers') {
          return createChainableMock({ count: 50, error: null });
        }
        return {};
      });

      const res = await checkSubscriptionLimit('tenant-1', 'customer');
      expect(res.isBlocked).toBe(true); // limit is 50, count is 50 -> blocked!
      expect(res.max).toBe(50);
    });

    it('should enforce SMS quotas correctly', async () => {
      mockSingleTenant.mockResolvedValue({
        data: {
          subscription_tier: 'basic', // max SMS is 100
          subscription_expires_at: new Date(Date.now() + 1000000).toISOString(),
          sms_allotment_used: 100,
        },
        error: null,
      });

      const res = await checkSubscriptionLimit('tenant-1', 'sms');
      expect(res.isBlocked).toBe(true);
      expect(res.current).toBe(100);
      expect(res.max).toBe(100);
    });
  });

  describe('Payment Webhook Reconciler (POST /api/webhooks/payment)', () => {
    const createMockRequest = (body: any, headers: Record<string, string> = {}) => {
      const url = 'http://localhost/api/webhooks/payment';
      const reqHeaders = new Headers({
        'content-type': 'application/json',
        ...headers,
      });
      return new NextRequest(url, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(body),
      });
    };

    it('should reject unauthorized webhook calls with 401', async () => {
      const req = createMockRequest({ transferAmount: 200000, content: 'SUB INV-1002' }, {
        authorization: 'Bearer wrong-secret',
      });
      const response = await POST(req);
      expect(response.status).toBe(401);
    });

    it('should process a valid SePay webhook call matching subscription pattern and call renew_tenant_subscription RPC', async () => {
      // 1. Mock successful RPC
      mockRouteRpc.mockResolvedValue({ data: true, error: null });

      // 2. Prepare payload mimicking SePay notification for SUBSCRIPTION renewal
      const body = {
        transferAmount: 500000,
        content: 'SUB INV-9988',
        code: 'TX12345',
        transactionDate: '2026-05-21 12:00:00',
      };

      const req = createMockRequest(body, {
        authorization: 'Bearer super-secret-webhook-key',
      });

      const response = await POST(req);
      const resData = await response.json();

      expect(response.status).toBe(200);
      expect(resData.success).toBe(true);
      expect(resData.processedCount).toBe(1);
      
      // Verify that the custom subscription RPC is correctly triggered
      expect(mockRouteRpc).toHaveBeenCalledWith('renew_tenant_subscription', {
        p_invoice_number: 'INV-9988',
        p_payment_method: 'VietQR',
      });
    });

    it('should handle webhook call with different regex variants like SUB-INV-12345', async () => {
      mockRouteRpc.mockResolvedValue({ data: true, error: null });

      const body = {
        transferAmount: 300000,
        content: 'thanh toan gia han SUB-INV-12345 qua VietQR',
        code: 'TX67890',
      };

      const req = createMockRequest(body, {
        authorization: 'Bearer super-secret-webhook-key',
      });

      const response = await POST(req);
      const resData = await response.json();

      expect(response.status).toBe(200);
      expect(resData.success).toBe(true);
      expect(mockRouteRpc).toHaveBeenCalledWith('renew_tenant_subscription', {
        p_invoice_number: 'INV-12345',
        p_payment_method: 'VietQR',
      });
    });
  });
});
