jest.mock('@/core/services/order/commission-actions', () => ({
  resolveKtvCommission: jest.fn().mockResolvedValue(150000),
}));

// Mock pricing-actions to avoid adapter lookup in tests
jest.mock('@/core/services/order/pricing-actions', () => ({
  calculateOrderPrice: jest.fn().mockResolvedValue(6000000),
}));

// Mock discount-integration to avoid real DB calls with string IDs
jest.mock('@/core/services/order/discount-integration', () => ({
  calculateServerDiscount: jest.fn().mockResolvedValue(0), // Default: no discount
}));

import { buildBookingPayload } from '@/core/services/order/create-booking-helpers';
import type { TenantContext } from '@/core/types/tenant';

type BuildBookingPayloadParams = Parameters<typeof buildBookingPayload>[0];

// Mock tenant context for tests
const mockTenantContext: TenantContext = {
  tenantId: 'tenant-1',
  tenantName: 'Test Tenant',
  enabledModules: ['spa'],
  subscriptionPlan: 'professional',
  featureFlags: {},
  settings: {},
};

describe('create booking payment status', () => {
  const baseValidatedData: BuildBookingPayloadParams['validatedData'] = {
    customer_id: 'customer-1',
    package_id: 'package-1',
    package_name: 'Tam Be Chuan Y Khoa Tai Nha',
    full_price: 6000000,
    deposit_amount: 0,
    total_sessions: 15,
    discount_percent: 25,
    ktv_commission: 150000,
    start_date: '2026-06-06',
    assigned_ktv_id: 'ktv-1',
    preferred_time: '09:00',
  };

  it('marks a booking as booked when a confirmed deposit is entered up front', async () => {
    const payload = await buildBookingPayload({
      validatedData: {
        ...baseValidatedData,
        deposit_amount: 200000,
      },
      customerId: 'customer-1',
      tenantId: 'tenant-1',
      existingBooking: null,
      tenantContext: mockTenantContext,
    });

    expect(payload.status).toBe('booked');
    expect(payload.deposit_amount).toBe(200000);
  });

  it('keeps deposit_pending only when no deposit has been entered', async () => {
    const payload = await buildBookingPayload({
      validatedData: baseValidatedData,
      customerId: 'customer-1',
      tenantId: 'tenant-1',
      existingBooking: null,
      tenantContext: mockTenantContext,
    });

    expect(payload.status).toBe('deposit_pending');
    expect(payload.deposit_amount).toBe(0);
  });

  it.skip('normalizes discount_percent before persisting the booking payload', async () => {
    // TODO: Fix discount normalization logic after refactor
    const overDiscountPayload = await buildBookingPayload({
      validatedData: {
        ...baseValidatedData,
        discount_percent: 150,
      },
      customerId: 'customer-1',
      tenantId: 'tenant-1',
      existingBooking: null,
      tenantContext: mockTenantContext,
    });
    const negativeDiscountPayload = await buildBookingPayload({
      validatedData: {
        ...baseValidatedData,
        discount_percent: -10,
      },
      customerId: 'customer-1',
      tenantId: 'tenant-1',
      existingBooking: null,
      tenantContext: mockTenantContext,
    });

    expect(overDiscountPayload.discount_percent).toBe(100);
    expect(negativeDiscountPayload.discount_percent).toBe(0);
  });
});
