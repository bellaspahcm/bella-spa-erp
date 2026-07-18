import { describe, it, expect, jest, beforeEach } from '@jest/globals';

let queryResults: any[] = [];

// Clean mock builder that implements proper thenable interface for awaits
const mockBuilder: any = {
  select: jest.fn(() => mockBuilder),
  eq: jest.fn(() => mockBuilder),
  in: jest.fn(() => mockBuilder),
  single: jest.fn(() => {
    return Promise.resolve(queryResults.shift() || { data: null, error: null });
  }),
  then(onfulfilled: any, onrejected: any) {
    const result = queryResults.shift() || { data: null, error: null };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  },
};

const mockSupabase = {
  from: jest.fn(() => mockBuilder),
};

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

import type { CoreBookingOrder, TenantContext } from '@/core/types';

describe('SpaModuleAdapter validation', () => {
  let spaModuleAdapter: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    queryResults = [];
    // Dynamically import the adapter to guarantee the mock is registered first
    const mod = await import('../modules/spa/adapters/SpaModuleAdapter');
    spaModuleAdapter = mod.spaModuleAdapter;
  });

  it('should pass capacity check when there are no conflicting sessions', async () => {
    // 1st query: tenants select (single)
    queryResults.push({
      data: {
        capacity_config: {
          minBreakMinutes: 15,
          enforceBreakTimes: true,
          dailyCapacityLimit: 8,
        },
      },
      error: null,
    });

    // 2nd query: session_logs select (awaiting builder)
    queryResults.push({
      data: [],
      error: null,
    });

    const order: CoreBookingOrder = {
      id: 'booking-new',
      tenantId: 'tenant-1',
      moduleId: 'spa',
      customerId: 'cust-1',
      serviceItemId: 'pkg-1',
      status: 'confirmed',
      scheduledStartTime: '2026-07-17',
      scheduledEndTime: '2026-07-17',
      totalAmount: 1000000,
      paidAmount: 0,
      metadata: {
        assigned_ktv_id: 'ktv-1',
        sessions_total: 10,
        preferred_time: '08:00',
      },
    };

    const context: TenantContext = {
      tenantId: 'tenant-1',
      tenantName: 'Test Tenant',
      enabledModules: ['spa'],
      subscriptionPlan: 'basic',
      featureFlags: {},
      settings: {},
    };

    const isValid = await spaModuleAdapter.validateBookingRules(order, context);
    expect(isValid).toBe(true);
  });

  it('should fail capacity check when KTV has overlapping sessions on that date', async () => {
    // 1st query: tenants select (single)
    queryResults.push({
      data: {
        capacity_config: {
          minBreakMinutes: 15,
          enforceBreakTimes: true,
          dailyCapacityLimit: 8,
          concurrentSessionLimit: 1,
        },
      },
      error: null,
    });

    // 2nd query: session_logs select (awaiting builder)
    queryResults.push({
      data: [
        {
          id: 'session-other',
          status: 'scheduled',
          assigned_time: '08:00',
          completed_by_ktv_id: null,
          bookings: {
            id: 'booking-other',
            assigned_ktv_id: 'ktv-1',
            status: 'confirmed',
            packages: {
              duration_minutes: 60,
            },
          },
        },
      ],
      error: null,
    });

    const order: CoreBookingOrder = {
      id: 'booking-new',
      tenantId: 'tenant-1',
      moduleId: 'spa',
      customerId: 'cust-1',
      serviceItemId: 'pkg-1',
      status: 'confirmed',
      scheduledStartTime: '2026-07-17',
      scheduledEndTime: '2026-07-17',
      totalAmount: 1000000,
      paidAmount: 0,
      metadata: {
        assigned_ktv_id: 'ktv-1',
        sessions_total: 10,
        preferred_time: '08:00',
      },
    };

    const context: TenantContext = {
      tenantId: 'tenant-1',
      tenantName: 'Test Tenant',
      enabledModules: ['spa'],
      subscriptionPlan: 'basic',
      featureFlags: {},
      settings: {},
    };

    const isValid = await spaModuleAdapter.validateBookingRules(order, context);
    expect(isValid).toBe(false);
  });

  it('should parse enabled_modules correctly in constructTenantContextForBooking', async () => {
    const { constructTenantContextForBooking } = await import('../core/services/order/create-booking-helpers');

    queryResults.push({
      data: {
        id: 'tenant-123',
        name: 'Test Beauty Spa Tenant',
        enabled_modules: { beauty_spa: true, babycare: false },
        subscription_tier: 'premium',
      },
      error: null,
    });

    const result = await constructTenantContextForBooking(mockSupabase as any, 'tenant-123');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.context.enabledModules).toContain('beauty_spa');
      expect(result.context.enabledModules).not.toContain('babycare');
    }
  });
});
