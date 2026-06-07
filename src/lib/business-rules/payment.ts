import { parsePercentInput } from '@/lib/utils';

export type PaymentTab = 'deposit' | 'full';

export type PaymentRevenueLike = {
  amount?: number | string | null;
  status?: string | null;
  revenue_type?: string | null;
};

export type BookingPaymentStateInput = {
  fullPrice: number | string | null | undefined;
  discountPercent?: number | string | null;
  depositAmount?: number | string | null;
  bookingStatus?: string | null;
  revenues?: PaymentRevenueLike[] | null;
};

export type BookingPaymentState = {
  priceAfterDiscount: number;
  totalPaid: number;
  remainingDebt: number;
  depositTarget: number;
  depositDue: number;
  overpaidAmount: number;
  hasOutstandingDebt: boolean;
  showDepositRequest: boolean;
};

export type SessionRevenueRecognitionInput = {
  fullPrice: number | string | null | undefined;
  discountPercent?: number | string | null;
  totalSessions?: number | string | null;
  currentSessionNumber?: number | string | null;
  totalPaid?: number | string | null;
};

export type SessionRevenueRecognition = {
  targetPrice: number;
  earnedRevenueAmount: number;
  revenueRecognizedBefore: number;
  deferredRevenueAmount: number;
  receivableAmount: number;
};

function asFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asMoney(value: number | string | null | undefined) {
  return Math.max(0, Math.round(asFiniteNumber(value)));
}

export function normalizeDiscountPercent(value: number | string | null | undefined) {
  return parsePercentInput(value);
}

function normalizeStatus(status: string | null | undefined) {
  return String(status ?? '').trim().toLowerCase();
}

function normalizeRevenueType(revenueType: string | null | undefined) {
  return String(revenueType ?? '').trim().toLowerCase();
}

export function calculatePriceAfterDiscount(input: {
  fullPrice: number | string | null | undefined;
  discountPercent?: number | string | null;
}) {
  const fullPrice = asMoney(input.fullPrice);
  const discountPercent = normalizeDiscountPercent(input.discountPercent);
  return asMoney(fullPrice * (1 - discountPercent / 100));
}

export function calculateConfirmedPaidAmount(revenues: PaymentRevenueLike[] | null | undefined) {
  return (revenues ?? []).reduce((total, revenue) => {
    if (normalizeStatus(revenue.status) !== 'confirmed') {
      return total;
    }

    const amount = asMoney(revenue.amount);
    if (normalizeRevenueType(revenue.revenue_type) === 'refund') {
      return total - amount;
    }

    return total + amount;
  }, 0);
}

export function calculateBookingPaymentState(input: BookingPaymentStateInput): BookingPaymentState {
  const priceAfterDiscount = calculatePriceAfterDiscount(input);
  const depositTarget = Math.min(asMoney(input.depositAmount), priceAfterDiscount);
  const totalPaid = Math.max(0, calculateConfirmedPaidAmount(input.revenues));
  const remainingDebt = Math.max(0, priceAfterDiscount - totalPaid);
  const depositDue = Math.max(0, depositTarget - totalPaid);
  const overpaidAmount = Math.max(0, totalPaid - priceAfterDiscount);
  const showDepositRequest =
    normalizeStatus(input.bookingStatus) === 'deposit_pending' &&
    depositDue > 0 &&
    remainingDebt > 0;

  return {
    priceAfterDiscount,
    totalPaid,
    remainingDebt,
    depositTarget,
    depositDue,
    overpaidAmount,
    hasOutstandingDebt: remainingDebt > 0,
    showDepositRequest,
  };
}

export function calculatePaymentRequest(input: BookingPaymentStateInput & { selectedTab: PaymentTab }) {
  const state = calculateBookingPaymentState(input);
  const effectiveTab: PaymentTab = state.showDepositRequest ? input.selectedTab : 'full';
  const amountToPay = effectiveTab === 'deposit' ? state.depositDue : state.remainingDebt;

  return {
    ...state,
    effectiveTab,
    amountToPay,
  };
}

export function validatePaymentAmountAgainstState(
  state: Pick<BookingPaymentState, 'remainingDebt'>,
  amount: number | string | null | undefined,
) {
  const numericAmount = asMoney(amount);
  if (numericAmount <= 0) {
    return { error: 'Số tiền thanh toán phải lớn hơn 0' };
  }

  if (state.remainingDebt <= 0) {
    return { error: 'Booking này đã hoàn tất thanh toán' };
  }

  if (numericAmount > state.remainingDebt) {
    return {
      error: `Số tiền thanh toán vượt quá số tiền còn nợ của gói (${state.remainingDebt.toLocaleString('vi-VN')} đ)`,
    };
  }

  return { success: true };
}

export function calculateSessionRevenueRecognition(
  input: SessionRevenueRecognitionInput,
): SessionRevenueRecognition {
  const targetPrice = calculatePriceAfterDiscount(input);
  const totalSessions = Math.max(1, asFiniteNumber(input.totalSessions, 1));
  const currentSessionNumber = Math.max(1, asFiniteNumber(input.currentSessionNumber, 1));
  const totalPaid = asMoney(input.totalPaid);
  const earnedRevenueAmount = targetPrice / totalSessions;
  const revenueRecognizedBefore = earnedRevenueAmount * Math.max(0, currentSessionNumber - 1);
  const deferredRevenueAvailable = Math.max(0, totalPaid - revenueRecognizedBefore);
  const deferredRevenueAmount = Math.min(earnedRevenueAmount, deferredRevenueAvailable);
  const receivableAmount = Math.max(0, earnedRevenueAmount - deferredRevenueAmount);

  return {
    targetPrice,
    earnedRevenueAmount,
    revenueRecognizedBefore,
    deferredRevenueAmount,
    receivableAmount,
  };
}
