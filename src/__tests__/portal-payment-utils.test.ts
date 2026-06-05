import { calculatePortalPaymentSummary } from '@/app/portal/[token]/payment-utils';

describe('calculatePortalPaymentSummary', () => {
  it('does not show a deposit QR when the confirmed deposit has already been recorded', () => {
    const summary = calculatePortalPaymentSummary({
      fullPrice: 6000000,
      discountPercent: 25,
      depositAmount: 200000,
      bookingStatus: 'deposit_pending',
      revenues: [
        { amount: 200000, status: 'confirmed' },
      ],
      selectedTab: 'deposit',
    });

    expect(summary.totalPaid).toBe(200000);
    expect(summary.priceAfterDiscount).toBe(4500000);
    expect(summary.remainingDebt).toBe(4300000);
    expect(summary.depositDue).toBe(0);
    expect(summary.showDepositTab).toBe(false);
    expect(summary.effectiveTab).toBe('full');
    expect(summary.amountToPay).toBe(4300000);
  });

  it('shows only the unpaid part of the deposit when the deposit is partially paid', () => {
    const summary = calculatePortalPaymentSummary({
      fullPrice: 6000000,
      discountPercent: 25,
      depositAmount: 200000,
      bookingStatus: 'deposit_pending',
      revenues: [
        { amount: 50000, status: 'confirmed' },
      ],
      selectedTab: 'deposit',
    });

    expect(summary.remainingDebt).toBe(4450000);
    expect(summary.depositDue).toBe(150000);
    expect(summary.showDepositTab).toBe(true);
    expect(summary.amountToPay).toBe(150000);
  });

  it('keeps the full remaining amount when the full tab is selected before deposit is paid', () => {
    const summary = calculatePortalPaymentSummary({
      fullPrice: 6000000,
      discountPercent: 25,
      depositAmount: 200000,
      bookingStatus: 'deposit_pending',
      revenues: [],
      selectedTab: 'full',
    });

    expect(summary.remainingDebt).toBe(4500000);
    expect(summary.depositDue).toBe(200000);
    expect(summary.showDepositTab).toBe(true);
    expect(summary.amountToPay).toBe(4500000);
  });

  it('marks the package as fully paid when confirmed revenue covers the discounted price', () => {
    const summary = calculatePortalPaymentSummary({
      fullPrice: 6000000,
      discountPercent: 25,
      depositAmount: 200000,
      bookingStatus: 'deposit_pending',
      revenues: [
        { amount: 4500000, status: 'confirmed' },
      ],
      selectedTab: 'deposit',
    });

    expect(summary.hasOutstandingDebt).toBe(false);
    expect(summary.remainingDebt).toBe(0);
    expect(summary.depositDue).toBe(0);
    expect(summary.amountToPay).toBe(0);
  });
});
