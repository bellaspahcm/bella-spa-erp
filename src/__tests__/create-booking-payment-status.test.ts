jest.mock('../modules/booking/actions/commission-actions', () => ({
  resolveKtvCommission: jest.fn().mockResolvedValue(150000),
}));

import { buildBookingPayload } from '@/core/services/order/create-booking-helpers';

type BuildBookingPayloadParams = Parameters<typeof buildBookingPayload>[0];

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
    });

    expect(payload.status).toBe('deposit_pending');
    expect(payload.deposit_amount).toBe(0);
  });

  it('normalizes discount_percent before persisting the booking payload', async () => {
    const overDiscountPayload = await buildBookingPayload({
      validatedData: {
        ...baseValidatedData,
        discount_percent: 150,
      },
      customerId: 'customer-1',
      tenantId: 'tenant-1',
      existingBooking: null,
    });
    const negativeDiscountPayload = await buildBookingPayload({
      validatedData: {
        ...baseValidatedData,
        discount_percent: -10,
      },
      customerId: 'customer-1',
      tenantId: 'tenant-1',
      existingBooking: null,
    });

    expect(overDiscountPayload.discount_percent).toBe(100);
    expect(negativeDiscountPayload.discount_percent).toBe(0);
  });
});
