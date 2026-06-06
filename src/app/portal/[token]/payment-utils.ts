import { calculatePaymentRequest } from '@/lib/business-rules/payment';

export type PortalPaymentTab = 'deposit' | 'full';

export type PortalPaymentRevenue = {
  amount?: number | string | null;
  status?: string | null;
};

export type PortalPaymentSummaryInput = {
  fullPrice: number;
  discountPercent: number;
  depositAmount: number;
  bookingStatus?: string | null;
  revenues?: PortalPaymentRevenue[] | null;
  selectedTab: PortalPaymentTab;
};

export function calculatePortalPaymentSummary(input: PortalPaymentSummaryInput) {
  const summary = calculatePaymentRequest({
    fullPrice: input.fullPrice,
    discountPercent: input.discountPercent,
    depositAmount: input.depositAmount,
    bookingStatus: input.bookingStatus,
    revenues: input.revenues,
    selectedTab: input.selectedTab,
  });

  return {
    priceAfterDiscount: summary.priceAfterDiscount,
    totalPaid: summary.totalPaid,
    remainingDebt: summary.remainingDebt,
    depositDue: summary.depositDue,
    hasOutstandingDebt: summary.hasOutstandingDebt,
    showDepositTab: summary.showDepositRequest,
    effectiveTab: summary.effectiveTab,
    amountToPay: summary.amountToPay,
  };
}
