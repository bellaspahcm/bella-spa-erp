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

function resetMockSupabaseFrom() {
  mockSupabaseServer.from = jest.fn((table: string) => {
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
  });
}

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseServer)),
}));

// 2. Mock @supabase/supabase-js for webhook route
const mockRouteRpc = jest.fn();
const mockRouteFrom = jest.fn();
const mockRouteSupabase = {
  rpc: mockRouteRpc,
  from: mockRouteFrom,
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockRouteSupabase),
}));

const mockEnqueueWithAutoClient = jest.fn();
jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: (...args: any[]) => mockEnqueueWithAutoClient(...args),
}));

// Mock next/server dependencies or other things if necessary
jest.mock('server-only', () => ({}), { virtual: true });

// Dynamically import modules under test to prevent eager execution before mock variables are initialized
let checkSubscriptionLimit: any;
let incrementSmsCount: any;
let POST: any;

const defaultEntitlements = [
  {
    tenant_id: 'tenant-1',
    plan_code: 'basic',
    feature_key: 'ktv',
    limit_value: 3,
    is_unlimited: false,
    unit: 'count',
    enforcement_mode: 'hard',
    reset_period: 'none',
    source: 'plan',
  },
  {
    tenant_id: 'tenant-1',
    plan_code: 'basic',
    feature_key: 'customer',
    limit_value: 50,
    is_unlimited: false,
    unit: 'count',
    enforcement_mode: 'hard',
    reset_period: 'none',
    source: 'plan',
  },
  {
    tenant_id: 'tenant-1',
    plan_code: 'basic',
    feature_key: 'sms',
    limit_value: 100,
    is_unlimited: false,
    unit: 'message',
    enforcement_mode: 'hard',
    reset_period: 'monthly',
    source: 'plan',
  },
];

describe('Subscription Constraints & Webhook Suite', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    checkSubscriptionLimit = require('@/lib/subscription').checkSubscriptionLimit;
    incrementSmsCount = require('@/lib/subscription').incrementSmsCount;
    POST = require('@/app/api/webhooks/payment/route').POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabaseFrom();
    mockRpcSubscription.mockImplementation((fn: string) => {
      if (fn === 'get_effective_subscription_entitlements') {
        return Promise.resolve({ data: defaultEntitlements, error: null });
      }
      if (fn === 'increment_tenant_sms') {
        return Promise.resolve({ data: 1, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockRouteRpc.mockResolvedValue({ data: null, error: null });
    mockEnqueueWithAutoClient.mockResolvedValue(true);
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
          franchise_agreement_date: '2024-01-01T00:00:00Z',
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
          franchise_agreement_date: '2024-01-01T00:00:00Z',
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
          franchise_agreement_date: '2024-01-01T00:00:00Z',
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
          franchise_agreement_date: '2024-01-01T00:00:00Z',
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
          franchise_agreement_date: '2024-01-01T00:00:00Z',
        },
        error: null,
      });

      const res = await checkSubscriptionLimit('tenant-1', 'sms');
      expect(res.isBlocked).toBe(true);
      expect(res.current).toBe(100);
      expect(res.max).toBe(100);
    });

    it('uses tenant quota overrides from effective entitlement RPC instead of hard-coded plan limits', async () => {
      mockSingleTenant.mockResolvedValue({
        data: {
          subscription_tier: 'basic',
          subscription_expires_at: new Date(Date.now() + 1000000).toISOString(),
          sms_allotment_used: 0,
          franchise_agreement_date: '2024-01-01T00:00:00Z',
        },
        error: null,
      });

      mockRpcSubscription.mockImplementation((fn: string) => {
        if (fn === 'get_effective_subscription_entitlements') {
          return Promise.resolve({
            data: defaultEntitlements.map((row) =>
              row.feature_key === 'ktv'
                ? { ...row, limit_value: 4, source: 'override' }
                : row
            ),
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
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

      expect(res.isBlocked).toBe(false);
      expect(res.current).toBe(3);
      expect(res.max).toBe(4);
      expect(res.limits.maxKtv).toBe(4);
      expect(mockRpcSubscription).toHaveBeenCalledWith('get_effective_subscription_entitlements', {
        p_tenant_id: 'tenant-1',
      });
    });

    it('throws instead of fail-opening when tenant subscription query fails', async () => {
      mockSingleTenant.mockResolvedValue({
        data: null,
        error: { message: 'tenant lookup failed' },
      });

      await expect(checkSubscriptionLimit('tenant-1', 'ktv')).rejects.toThrow(
        '[checkSubscriptionLimit] tenants query failed: tenant lookup failed'
      );
    });

    it('throws instead of fail-opening when KTV count query fails', async () => {
      mockSingleTenant.mockResolvedValue({
        data: {
          subscription_tier: 'basic',
          subscription_expires_at: new Date(Date.now() + 1000000).toISOString(),
          sms_allotment_used: 0,
          franchise_agreement_date: '2024-01-01T00:00:00Z',
        },
        error: null,
      });

      mockSupabaseServer.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'tenants') {
          return createChainableMock({}, mockSingleTenant);
        }
        if (table === 'users') {
          return createChainableMock({ count: null, error: { message: 'users count failed' } });
        }
        return {};
      });

      await expect(checkSubscriptionLimit('tenant-1', 'ktv')).rejects.toThrow(
        '[checkSubscriptionLimit] users count failed: users count failed'
      );
    });

    it('throws instead of fail-opening when effective entitlement RPC fails', async () => {
      mockSingleTenant.mockResolvedValue({
        data: {
          subscription_tier: 'basic',
          subscription_expires_at: new Date(Date.now() + 1000000).toISOString(),
          sms_allotment_used: 0,
          franchise_agreement_date: '2024-01-01T00:00:00Z',
        },
        error: null,
      });
      mockRpcSubscription.mockResolvedValue({
        data: null,
        error: { message: 'entitlement rpc denied' },
      });

      await expect(checkSubscriptionLimit('tenant-1', 'customer')).rejects.toThrow(
        '[checkSubscriptionLimit] get_effective_subscription_entitlements failed: entitlement rpc denied'
      );
    });

    it('throws instead of fail-opening when a requested entitlement is missing', async () => {
      mockSingleTenant.mockResolvedValue({
        data: {
          subscription_tier: 'basic',
          subscription_expires_at: new Date(Date.now() + 1000000).toISOString(),
          sms_allotment_used: 0,
          franchise_agreement_date: '2024-01-01T00:00:00Z',
        },
        error: null,
      });
      mockRpcSubscription.mockResolvedValue({
        data: defaultEntitlements.filter((row) => row.feature_key !== 'sms'),
        error: null,
      });

      await expect(checkSubscriptionLimit('tenant-1', 'sms')).rejects.toThrow(
        '[checkSubscriptionLimit] Missing entitlement for feature sms'
      );
    });

    it('bypasses limits for HQ-owned spas (franchise_agreement_date IS NULL)', async () => {
      // HQ-owned spa: subscription tier may be set but franchise_agreement_date
      // is null → treated as unlimited regardless of tier or KTV count.
      mockSingleTenant.mockResolvedValue({
        data: {
          subscription_tier: 'basic',
          subscription_expires_at: null,
          sms_allotment_used: 999,
          franchise_agreement_date: null,
        },
        error: null,
      });

      mockSupabaseServer.from = jest.fn().mockImplementation((table: string) => {
        if (table === 'tenants') {
          return createChainableMock({}, mockSingleTenant);
        }
        // Simulate already exceeding 'basic' limits — still must not block.
        if (table === 'users') {
          return createChainableMock({ count: 50, error: null });
        }
        if (table === 'customers') {
          return createChainableMock({ count: 10000, error: null });
        }
        return {};
      });

      const ktv = await checkSubscriptionLimit('tenant-hq', 'ktv');
      expect(ktv.isBlocked).toBe(false);
      expect(ktv.tier).toBe('hq_owned');

      const customer = await checkSubscriptionLimit('tenant-hq', 'customer');
      expect(customer.isBlocked).toBe(false);

      const sms = await checkSubscriptionLimit('tenant-hq', 'sms');
      expect(sms.isBlocked).toBe(false);
    });

    it('throws when SMS counter RPC fails instead of returning zero', async () => {
      mockRpcSubscription.mockResolvedValue({ data: null, error: { message: 'rpc denied' } });

      await expect(incrementSmsCount('tenant-1')).rejects.toThrow(
        '[incrementSmsCount] increment_tenant_sms failed: rpc denied'
      );
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

    it('should record BELLA booking payments with accounting metadata, audit log, and outbox', async () => {
      const booking = {
        id: 'booking-1',
        booking_number: 'BK-1001',
        tenant_id: 'tenant-1',
        status: 'deposit_pending',
      };
      const revenueInsertPayloads: any[] = [];
      const auditInsertPayloads: any[] = [];
      const bookingStatusUpdates: any[] = [];

      mockRouteFrom.mockImplementation((table: string) => {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          not: jest.fn(() => chain),
          like: jest.fn(() => chain),
          maybeSingle: jest.fn(() => {
            if (table === 'bookings') return Promise.resolve({ data: booking, error: null });
            if (table === 'revenue') return Promise.resolve({ data: null, error: null });
            return Promise.resolve({ data: null, error: null });
          }),
          update: jest.fn((payload: any) => {
            bookingStatusUpdates.push(payload);
            return { eq: jest.fn(() => Promise.resolve({ error: null })) };
          }),
          delete: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })),
          insert: jest.fn((payload: any) => {
            if (table === 'revenue') {
              revenueInsertPayloads.push(payload);
              return {
                select: jest.fn(() => ({
                  single: jest.fn(() => Promise.resolve({
                    data: { id: 'rev-1', ...payload[0] },
                    error: null,
                  })),
                })),
              };
            }
            if (table === 'audit_logs') {
              auditInsertPayloads.push(payload);
              return Promise.resolve({ error: null });
            }
            return Promise.resolve({ error: null });
          }),
        };
        return chain;
      });

      const req = createMockRequest({
        transferAmount: 1000000,
        content: 'BELLA BK-1001',
        code: 'TX-BELLA-1',
        transactionDate: '2026-05-21T12:00:00.000Z',
      }, {
        authorization: 'Bearer super-secret-webhook-key',
      });

      const response = await POST(req);
      const resData = await response.json();

      expect(response.status).toBe(200);
      expect(resData.success).toBe(true);
      expect(resData.processedCount).toBe(1);
      expect(bookingStatusUpdates).toContainEqual({ status: 'booked' });

      expect(revenueInsertPayloads).toHaveLength(1);
      const revenuePayload = revenueInsertPayloads[0][0];
      expect(revenuePayload).toMatchObject({
        booking_id: 'booking-1',
        amount: 1000000,
        revenue_type: 'deposit',
        payment_method: 'VietQR',
        status: 'confirmed',
        tenant_id: 'tenant-1',
        business_event_type: 'CUSTOMER_DEPOSIT',
        accounting_review_status: 'UNREVIEWED',
      });
      expect(revenuePayload.accounting_metadata).toMatchObject({
        amount: 1000000,
        payment_method: 'VietQR',
        booking_id: 'booking-1',
      });

      expect(auditInsertPayloads).toHaveLength(1);
      expect(auditInsertPayloads[0]).toMatchObject({
        action: 'INSERT',
        table_name: 'revenue',
        record_id: 'rev-1',
        tenant_id: 'tenant-1',
      });
      expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
        mockRouteSupabase,
        expect.objectContaining({
          tenantId: 'tenant-1',
          eventType: 'PACKAGE_SALE',
          referenceType: 'REVENUE',
          referenceId: 'rev-1',
        }),
        '[Payment Webhook]'
      );
    });

    it('should reject BELLA booking payments when the accounting period is closed', async () => {
      const booking = {
        id: 'booking-1',
        booking_number: 'BK-1001',
        tenant_id: 'tenant-1',
        status: 'deposit_pending',
      };
      const bookingStatusUpdates: any[] = [];
      const revenueInsertPayloads: any[] = [];

      mockRouteRpc.mockImplementation((fnName: string) => {
        if (fnName === 'ensure_open_period') {
          return Promise.resolve({
            data: null,
            error: { message: 'Accounting period is closed' },
          });
        }
        return Promise.resolve({ data: null, error: null });
      });
      mockRouteFrom.mockImplementation((table: string) => {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn(() => chain),
          not: jest.fn(() => chain),
          like: jest.fn(() => chain),
          maybeSingle: jest.fn(() => {
            if (table === 'bookings') return Promise.resolve({ data: booking, error: null });
            if (table === 'revenue') return Promise.resolve({ data: null, error: null });
            return Promise.resolve({ data: null, error: null });
          }),
          update: jest.fn((payload: any) => {
            bookingStatusUpdates.push(payload);
            return { eq: jest.fn(() => Promise.resolve({ error: null })) };
          }),
          insert: jest.fn((payload: any) => {
            revenueInsertPayloads.push(payload);
            return Promise.resolve({ error: null });
          }),
        };
        return chain;
      });

      const req = createMockRequest({
        transferAmount: 1000000,
        content: 'BELLA BK-1001',
        code: 'TX-CLOSED-PERIOD',
        transactionDate: '2026-05-21T12:00:00.000Z',
      }, {
        authorization: 'Bearer super-secret-webhook-key',
      });

      const response = await POST(req);
      const resData = await response.json();

      expect(response.status).toBe(200);
      expect(resData.processedCount).toBe(0);
      expect(resData.details[0]).toMatchObject({
        status: 'failed',
      });
      expect(resData.details[0].reason).toMatch(/accounting period is closed/i);
      expect(bookingStatusUpdates).toEqual([]);
      expect(revenueInsertPayloads).toEqual([]);
    });

    it('should rollback booking payment side effects if audit logging fails', async () => {
      const booking = {
        id: 'booking-1',
        booking_number: 'BK-1001',
        tenant_id: 'tenant-1',
        status: 'deposit_pending',
      };
      const bookingStatusUpdates: any[] = [];
      const deletedRevenueIds: string[] = [];

      mockRouteFrom.mockImplementation((table: string) => {
        const chain: any = {
          select: jest.fn(() => chain),
          eq: jest.fn((field: string, value: string) => {
            if (table === 'revenue' && field === 'id') deletedRevenueIds.push(value);
            return chain;
          }),
          not: jest.fn(() => chain),
          like: jest.fn(() => chain),
          maybeSingle: jest.fn(() => {
            if (table === 'bookings') return Promise.resolve({ data: booking, error: null });
            if (table === 'revenue') return Promise.resolve({ data: null, error: null });
            return Promise.resolve({ data: null, error: null });
          }),
          update: jest.fn((payload: any) => {
            bookingStatusUpdates.push(payload);
            return { eq: jest.fn(() => Promise.resolve({ error: null })) };
          }),
          delete: jest.fn(() => chain),
          insert: jest.fn((payload: any) => {
            if (table === 'revenue') {
              return {
                select: jest.fn(() => ({
                  single: jest.fn(() => Promise.resolve({
                    data: { id: 'rev-rollback', ...payload[0] },
                    error: null,
                  })),
                })),
              };
            }
            if (table === 'audit_logs') {
              return Promise.resolve({ error: { message: 'audit unavailable' } });
            }
            return Promise.resolve({ error: null });
          }),
        };
        return chain;
      });

      const req = createMockRequest({
        transferAmount: 1000000,
        content: 'BELLA BK-1001',
        code: 'TX-BELLA-ROLLBACK',
      }, {
        authorization: 'Bearer super-secret-webhook-key',
      });

      const response = await POST(req);
      const resData = await response.json();

      expect(response.status).toBe(200);
      expect(resData.processedCount).toBe(0);
      expect(resData.details[0]).toMatchObject({
        status: 'failed',
        reason: 'Failed to insert audit log',
      });
      expect(bookingStatusUpdates).toEqual([{ status: 'booked' }, { status: 'deposit_pending' }]);
      expect(deletedRevenueIds).toContain('rev-rollback');
      expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
    });
  });
});
