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
const mockCreateDevelopmentBypassClient = jest.fn().mockResolvedValue(mockSupabase);
const mockAllocateConfirmedBookingPaymentToFinanceAr = jest.fn().mockResolvedValue({
  transactionId: 'finance-payment-txn-1',
  cashMovementId: 'cash-movement-1',
  allocatedAmountMinor: 200_000,
  duplicate: false,
  allocations: [{
    invoiceId: 'invoice-1',
    receivablePositionId: 'position-1',
    cashMovementId: 'cash-movement-1',
    allocationId: 'allocation-1',
    allocatedAmountMinor: 200_000,
    duplicate: false,
  }],
});

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn().mockResolvedValue(mockSupabase),
}));

jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: (...args: unknown[]) => mockCreateDevelopmentBypassClient(...args),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn().mockResolvedValue(mockCurrentUser),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: (...args: unknown[]) => mockSafeRevalidatePath(...args),
}));

jest.mock('@/services/finance-payment-allocation', () => ({
  allocateConfirmedBookingPaymentToFinanceAr: (...args: unknown[]) =>
    mockAllocateConfirmedBookingPaymentToFinanceAr(...args),
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
        branch_id: null,
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
        revenue: {
          id: 'revenue-existing',
          amount: 200_000,
          status: 'confirmed',
          payment_method: 'cash',
          received_date: '2026-09-29',
          notes: 'persisted payment fact',
        },
      },
    });

    const result = await recordRemainingPayment(paymentInput({ amount: 999_999 }));

    expect(result).toEqual({
      success: true,
      data: {
        booking_id: 'booking-1',
        revenue_id: 'revenue-existing',
        idempotent: true,
        finance_ar_allocation: {
          status: 'ALLOCATED',
          transactionId: 'finance-payment-txn-1',
          cashMovementId: 'cash-movement-1',
          allocatedAmountMinor: 200_000,
          allocationCount: 1,
          duplicate: false,
        },
        revenue: {
          id: 'revenue-existing',
          amount: 200_000,
          status: 'confirmed',
          payment_method: 'cash',
          received_date: '2026-09-29',
          notes: 'persisted payment fact',
        },
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
    expect(mockAllocateConfirmedBookingPaymentToFinanceAr).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        bookingId: 'booking-1',
        revenueId: 'revenue-existing',
        amountMinor: 200_000,
        paymentMethod: 'cash',
        receivedAt: '2026-09-29',
        idempotencyKey: 'manual-payment:retry-1',
        description: 'persisted payment fact',
      }),
    );
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/customers/customer-1');
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/finance');
  });

  it('skips Finance AR allocation for an existing idempotent payment that is not confirmed', async () => {
    mockFindExistingManualPaymentByIdempotencyKey.mockResolvedValueOnce({
      data: {
        booking_id: 'booking-1',
        revenue_id: 'revenue-pending',
        idempotent: true,
        revenue: {
          id: 'revenue-pending',
          amount: 200_000,
          status: 'pending',
          payment_method: 'cash',
        },
      },
    });

    const result = await recordRemainingPayment(paymentInput({ amount: 999_999 }));

    expect(result).toEqual({
      success: true,
      data: {
        booking_id: 'booking-1',
        revenue_id: 'revenue-pending',
        idempotent: true,
        revenue: {
          id: 'revenue-pending',
          amount: 200_000,
          status: 'pending',
          payment_method: 'cash',
        },
      },
    });
    expect(mockValidateRemainingPaymentAmount).not.toHaveBeenCalled();
    expect(mockAllocateConfirmedBookingPaymentToFinanceAr).not.toHaveBeenCalled();
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
    expect(mockAllocateConfirmedBookingPaymentToFinanceAr).not.toHaveBeenCalled();
  });

  it('records a new valid payment only after idempotency lookup and amount validation pass', async () => {
    const result = await recordRemainingPayment(paymentInput({ idempotency_key: 'manual-payment:new-valid' }));

    expect(result).toEqual({
      success: true,
      data: {
        booking_id: 'booking-1',
        revenue_id: 'revenue-new',
        idempotent: false,
        finance_ar_allocation: {
          status: 'ALLOCATED',
          transactionId: 'finance-payment-txn-1',
          cashMovementId: 'cash-movement-1',
          allocatedAmountMinor: 200_000,
          allocationCount: 1,
          duplicate: false,
        },
      },
    });
    expect(mockFindExistingManualPaymentByIdempotencyKey).toHaveBeenCalled();
    expect(mockValidateRemainingPaymentAmount).toHaveBeenCalled();
    expect(mockAssertPaymentAccountingPeriod).toHaveBeenCalled();
    expect(mockRecordBookingPaymentRpc).toHaveBeenCalledWith({
      supabase: mockSupabase,
      payment: paymentInput({ idempotency_key: 'manual-payment:new-valid' }),
      tenantId: 'tenant-1',
      branchId: null,
      actorId: 'user-1',
    });
    expect(mockAllocateConfirmedBookingPaymentToFinanceAr).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        bookingId: 'booking-1',
        revenueId: 'revenue-new',
        amountMinor: 200_000,
        paymentMethod: 'cash',
        idempotencyKey: 'manual-payment:new-valid',
      }),
    );
  });

  it('does not fail persisted payment when Finance AR allocation is blocked', async () => {
    mockAllocateConfirmedBookingPaymentToFinanceAr.mockRejectedValueOnce(
      new Error('BLOCKED_BY_CASH_RECEIPT_PROJECTION_GAP'),
    );

    const result = await recordRemainingPayment(paymentInput({ idempotency_key: 'manual-payment:new-valid' }));

    expect(result).toEqual({
      success: true,
      data: {
        booking_id: 'booking-1',
        revenue_id: 'revenue-new',
        idempotent: false,
        finance_ar_allocation: {
          status: 'FAILED',
          error: 'BLOCKED_BY_CASH_RECEIPT_PROJECTION_GAP',
        },
      },
    });
  });

  it('uses the authenticated development server client for tenant-scoped payment reads and RPC', async () => {
    await recordRemainingPayment(paymentInput());

    expect(mockCreateDevelopmentBypassClient).toHaveBeenCalledTimes(1);
    expect(mockGetBookingPaymentSnapshot).toHaveBeenCalledWith(mockSupabase, 'booking-1', 'tenant-1');
    expect(mockFindExistingManualPaymentByIdempotencyKey).toHaveBeenCalledWith({
      supabase: mockSupabase,
      payment: paymentInput(),
      tenantId: 'tenant-1',
    });
    expect(mockRecordBookingPaymentRpc).toHaveBeenCalledWith({
      supabase: mockSupabase,
      payment: paymentInput(),
      tenantId: 'tenant-1',
      branchId: null,
      actorId: 'user-1',
    });
  });
});
