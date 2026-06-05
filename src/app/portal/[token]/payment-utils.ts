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
  const fullPrice = Number(input.fullPrice || 0);
  const discountPercent = Number(input.discountPercent || 0);
  const depositAmount = Math.max(0, Number(input.depositAmount || 0));
  const priceAfterDiscount = Math.max(0, fullPrice * (1 - discountPercent / 100));
  const confirmedRevenues = input.revenues?.filter((revenue) => revenue.status === 'confirmed') || [];
  const totalPaid = confirmedRevenues.reduce((sum, revenue) => sum + (Number(revenue.amount) || 0), 0);
  const remainingDebt = Math.max(0, priceAfterDiscount - totalPaid);
  const depositDue = Math.max(0, Math.min(depositAmount, priceAfterDiscount) - totalPaid);
  const showDepositTab = input.bookingStatus === 'deposit_pending' && depositDue > 0 && remainingDebt > 0;
  const effectiveTab = showDepositTab ? input.selectedTab : 'full';
  const amountToPay = effectiveTab === 'deposit' ? depositDue : remainingDebt;

  return {
    priceAfterDiscount,
    totalPaid,
    remainingDebt,
    depositDue,
    hasOutstandingDebt: remainingDebt > 0,
    showDepositTab,
    effectiveTab,
    amountToPay,
  };
}
