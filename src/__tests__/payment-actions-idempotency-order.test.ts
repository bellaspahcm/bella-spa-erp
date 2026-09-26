const mockSupabase = { from: jest.fn(), rpc: jest.fn() };
const mockCurrentUser = {
  id: 'user-1',
  tenant_id: 'tenant-1',
};

const mockSafeRevalidatePath = jest.fn().mockResolvedValue(undefined);
const mockGetBookingPaymentSnapshot = jest.fn();
const mockFindExistingManualPaymentByIdempotencyKey = jest.fn();
const mockValidateRemainingPaymentAmount = jest.fn();
const mockAssertPaymentAccountingPeriod = jest.fn();
const mockRecordBookingPaymentRpc = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn().mockResolvedValue(mockSupabase),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn().mockResolvedValue(mockCurrentUser),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: (...args: unknown[]) => mockSafeRevalidatePath(...args),
}));

jest.mock('@/core/services/order/payment-helpers', () => ({
  getBookingPaymentSnapshot: (...args: unknown[]) => mockGetBookingPaymentSnapshot(...args),
  findExistingManualPaymentByIdempotencyKey: (...args: unknown[]) =>
    mockFindExistingManualPaymentByIdempotencyKey(...args),
  validateRemainingPaymentAmount: (...args: unknown[]) => mockValidateRemainingPaymentAmount(...args),
  assertPaymentAccountingPeriod: (...args: unknown[]) => mockAssertPaymentAccountingPeriod(...args),
  recordBookingPaymentRpc: (...args: unknown[]) => mockRecordBookingPaymentRpc(...args),
}));

import { recordRemainingPayment } from '@/core/services/order/payment-actions';

function paymentInput(overrides: Record<string, unknown> = {}) {
  return {
    booking_id: 'booking-1',
    customer_id: 'customer-1',
    amount: 200_000,
    payment_method: 'cash',
    status: 'confirmed',
    notes: 'retry',
    idempotency_key: 'manual-payment:retry-1',
    ...overrides,
  };
}

describe('recordRemainingPayment idempotency ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBookingPaymentSnapshot.mockResolvedValue({
      booking: {
        id: 'booking-1',
        tenant_id: 'tenant-1',
        full_price: 300_000,
        deposit_amount: 300_000,
        discount_percent: 0,
        status: 'booked',
        revenue: [{ amount: 300_000, status: 'confirmed', revenue_type: 'remaining_payment' }],
      },
    });
    mockFindExistingManualPaymentByIdempotencyKey.mockResolvedValue({ data: null });
    mockValidateRemainingPaymentAmount.mockReturnValue({ success: true });
    mockAssertPaymentAccountingPeriod.mockResolvedValue({ success: true });
    mockRecordBookingPaymentRpc.mockResolvedValue({
      data: {
        booking_id: 'booking-1',
        revenue_id: 'revenue-new',
        idempotent: false,
      },
    });
  });

  it('returns an existing tenant-scoped manual payment before validating remaining debt', async () => {
    mockFindExistingManualPaymentByIdempotencyKey.mockResolvedValueOnce({
      data: {
        booking_id: 'booking-1',
        revenue_id: 'revenue-existing',
        idempotent: true,
      },
    });

    const result = await recordRemainingPayment(paymentInput({ amount: 999_999 }));

    expect(result).toEqual({
      success: true,
      data: {
        booking_id: 'booking-1',
        revenue_id: 'revenue-existing',
        idempotent: true,
      },
    });
    expect(mockFindExistingManualPaymentByIdempotencyKey).toHaveBeenCalledWith({
      supabase: mockSupabase,
      payment: paymentInput({ amount: 999_999 }),
      tenantId: 'tenant-1',
    });
    expect(mockValidateRemainingPaymentAmount).not.toHaveBeenCalled();
    expect(mockAssertPaymentAccountingPeriod).not.toHaveBeenCalled();
    expect(mockRecordBookingPaymentRpc).not.toHaveBeenCalled();
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/customers/customer-1');
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/finance');
  });

  it('still rejects an invalid new overpayment when no existing idempotent payment is found', async () => {
    mockValidateRemainingPaymentAmount.mockReturnValueOnce({
      error: 'Booking này đã hoàn tất thanh toán',
    });

    const result = await recordRemainingPayment(paymentInput({ idempotency_key: 'manual-payment:new-overpay' }));

    expect(result).toEqual({ error: 'Booking này đã hoàn tất thanh toán' });
    expect(mockFindExistingManualPaymentByIdempotencyKey).toHaveBeenCalled();
    expect(mockValidateRemainingPaymentAmount).toHaveBeenCalled();
    expect(mockAssertPaymentAccountingPeriod).not.toHaveBeenCalled();
    expect(mockRecordBookingPaymentRpc).not.toHaveBeenCalled();
  });

  it('records a new valid payment only after idempotency lookup and amount validation pass', async () => {
    const result = await recordRemainingPayment(paymentInput({ idempotency_key: 'manual-payment:new-valid' }));

    expect(result).toEqual({
      success: true,
      data: {
        booking_id: 'booking-1',
        revenue_id: 'revenue-new',
        idempotent: false,
      },
    });
    expect(mockFindExistingManualPaymentByIdempotencyKey).toHaveBeenCalled();
    expect(mockValidateRemainingPaymentAmount).toHaveBeenCalled();
    expect(mockAssertPaymentAccountingPeriod).toHaveBeenCalled();
    expect(mockRecordBookingPaymentRpc).toHaveBeenCalledWith({
      supabase: mockSupabase,
      payment: paymentInput({ idempotency_key: 'manual-payment:new-valid' }),
      tenantId: 'tenant-1',
      actorId: 'user-1',
    });
  });
});
