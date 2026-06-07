import { readFileSync } from 'fs';
import { calculatePortalPaymentSummary } from '@/app/portal/[token]/payment-utils';
import {
  calculateBookingPaymentState,
  calculateConfirmedPaidAmount,
  calculatePaymentRequest,
  type PaymentRevenueLike,
} from '@/lib/business-rules/payment';
import { validateRemainingPaymentAmount } from '@/modules/booking/actions/payment-helpers';
import {
  buildRevenueAccountingMetadata,
  inferBusinessEventType,
  resolveAccountingReviewStatus,
} from '@/services/accounting/template-rules';

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

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

    const depositLedgerEvent = inferBusinessEventType({
      sourceTable: 'revenue',
      revenueType: 'deposit',
    });
    const depositLedgerMetadata = buildRevenueAccountingMetadata({
      revenueType: 'deposit',
      amount: 200000,
      paymentMethod: 'bank_transfer',
      bookingId: booking.id,
      reason: 'Coc goi Me Tien',
    });

    expect(depositLedgerEvent).toBe('CUSTOMER_DEPOSIT');
    expect(resolveAccountingReviewStatus(depositLedgerEvent, depositLedgerMetadata)).toBe('UNREVIEWED');
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

  it('keeps production discount pricing routed through the shared payment engine', () => {
    const bookingModalSource = readSource('src/components/features/BookingModal.tsx');
    const activeBookingPanelSource = readSource('src/app/dashboard/customers/[id]/components/ActiveBookingPanel.tsx');
    const servicePerformanceSource = readSource('src/services/finance/service-performance-report.ts');
    const auditedProductionSources = [
      bookingModalSource,
      activeBookingPanelSource,
      servicePerformanceSource,
    ].join('\n');

    expect(bookingModalSource).toContain('calculateBookingPaymentState');
    expect(activeBookingPanelSource).toContain('paymentState.priceAfterDiscount');
    expect(servicePerformanceSource).toContain('calculatePriceAfterDiscount');
    expect(auditedProductionSources).not.toMatch(/discount_percent[^\n]*(?:\/\s*100|\*)/);
    expect(auditedProductionSources).not.toMatch(/discountPercent[^\n]*(?:\/\s*100|\*)/);
  });

  it('keeps high-risk payment inputs routed through shared money input helpers', () => {
    const auditedMoneyInputSources = [
      'src/components/features/BookingModal.tsx',
      'src/components/features/TransactionModal.tsx',
      'src/app/dashboard/customers/[id]/components/CustomerDetailModals.tsx',
      'src/app/dashboard/finance/reconciliation/page.tsx',
      'src/app/dashboard/finance/reconciliation/components/DebtPaymentModal.tsx',
    ].map(readSource).join('\n');

    expect(auditedMoneyInputSources).toContain('parseMoneyInput');
    expect(auditedMoneyInputSources).toContain('formatMoneyInput');
    expect(auditedMoneyInputSources).not.toMatch(/replace\(\s*\/\\D/);
    expect(auditedMoneyInputSources).not.toMatch(/replace\(\s*\/\[\^\\d\]/);
    expect(auditedMoneyInputSources).not.toMatch(/Number\([^\n]*replace/);
  });

  it('keeps high-risk percent and integer inputs routed through shared numeric helpers', () => {
    const auditedNumericInputSources = [
      'src/components/features/BookingModal.tsx',
      'src/app/dashboard/customers/[id]/components/CustomerDetailModals.tsx',
      'src/app/dashboard/customers/[id]/useCustomerDetailController.ts',
      'src/app/dashboard/settings/components/SalaryConfigTab.tsx',
      'src/app/dashboard/crm/components/CrmVoucherModal.tsx',
      'src/app/dashboard/crm/hooks/useCrmVoucherCampaigns.ts',
      'src/app/dashboard/settings/components/promotions/PromotionForm.tsx',
      'src/app/dashboard/settings/components/promotions/usePromotionsSettings.ts',
    ].map(readSource).join('\n');

    expect(auditedNumericInputSources).toContain('parsePercentInput');
    expect(auditedNumericInputSources).toContain('parseIntegerInput');
    expect(auditedNumericInputSources).not.toMatch(/parseInt\(/);
    expect(auditedNumericInputSources).not.toMatch(/Number\([^\n]*\)\s*\|\|\s*0/);
  });
});
