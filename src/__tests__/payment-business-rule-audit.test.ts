import { calculatePortalPaymentSummary } from '@/app/portal/[token]/payment-utils';
import {
  calculateBookingPaymentState,
  calculateConfirmedPaidAmount,
  calculatePaymentRequest,
  type PaymentRevenueLike,
} from '@/lib/business-rules/payment';
import { validateRemainingPaymentAmount } from '@/modules/booking/actions/payment-helpers';

describe('payment business rule audit', () => {
  it('keeps a confirmed bank-transfer deposit from reopening the deposit QR', () => {
    const revenues: PaymentRevenueLike[] = [
      { amount: 200000, status: 'confirmed', revenue_type: 'deposit' },
    ];
    const booking = {
      id: 'booking-me-tien',
      deposit_amount: 200000,
      full_price: 6000000,
      discount_percent: 25,
      status: 'deposit_pending',
      tenant_id: 'tenant-1',
      revenue: revenues,
    } satisfies Parameters<typeof validateRemainingPaymentAmount>[0];

    const engineState = calculateBookingPaymentState({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues,
    });
    const portalSummary = calculatePortalPaymentSummary({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues,
      selectedTab: 'deposit',
    });
    const bookingQrRequest = calculatePaymentRequest({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues,
      selectedTab: 'deposit',
    });

    expect(calculateConfirmedPaidAmount(revenues)).toBe(200000);
    expect(engineState.priceAfterDiscount).toBe(4500000);
    expect(engineState.totalPaid).toBe(200000);
    expect(engineState.depositDue).toBe(0);
    expect(engineState.remainingDebt).toBe(4300000);
    expect(engineState.showDepositRequest).toBe(false);

    expect(portalSummary.showDepositTab).toBe(false);
    expect(portalSummary.effectiveTab).toBe('full');
    expect(portalSummary.amountToPay).toBe(4300000);
    expect(bookingQrRequest.effectiveTab).toBe('full');
    expect(bookingQrRequest.amountToPay).toBe(4300000);

    expect(validateRemainingPaymentAmount(booking, 4300000)).toEqual({ success: true });
    expect(validateRemainingPaymentAmount(booking, 4300001).error).toContain('4.300.000');
  });

  it('marks every payment surface as closed when confirmed revenue covers the package price', () => {
    const revenues: PaymentRevenueLike[] = [
      { amount: 4500000, status: 'confirmed', revenue_type: 'package_payment' },
    ];
    const booking = {
      id: 'booking-paid-in-full',
      deposit_amount: 200000,
      full_price: 6000000,
      discount_percent: 25,
      status: 'booked',
      tenant_id: 'tenant-1',
      revenue: revenues,
    } satisfies Parameters<typeof validateRemainingPaymentAmount>[0];

    const portalSummary = calculatePortalPaymentSummary({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues,
      selectedTab: 'deposit',
    });
    const bookingQrRequest = calculatePaymentRequest({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues,
      selectedTab: 'deposit',
    });

    expect(portalSummary.hasOutstandingDebt).toBe(false);
    expect(portalSummary.amountToPay).toBe(0);
    expect(bookingQrRequest.amountToPay).toBe(0);
    expect(validateRemainingPaymentAmount(booking, 1).error).toBeTruthy();
  });
});
