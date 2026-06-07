import { calculatePaymentRequest, type PaymentRevenueLike } from './payment';

export type FinancialIntegritySeverity = 'critical' | 'warning';

export type FinancialIntegrityBooking = {
  id: string;
  booking_number?: string | null;
  status?: string | null;
  deposit_amount?: number | string | null;
  full_price?: number | string | null;
  discount_percent?: number | string | null;
  tenant_id?: string | null;
};

export type FinancialIntegrityRevenue = PaymentRevenueLike & {
  id: string;
  booking_id?: string | null;
  tenant_id?: string | null;
};

export type FinancialIntegrityOutboxEvent = {
  id?: string | null;
  event_type?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  status?: string | null;
};

export type FinancialIntegrityJournalEntry = {
  id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  status?: string | null;
};

export type FinancialIntegrityIssue = {
  code:
    | 'booking_payment_amount_drift'
    | 'portal_deposit_qr_should_be_closed'
    | 'booking_revenue_ledger_gap'
    | 'booking_paid_in_full_but_status_open';
  severity: FinancialIntegritySeverity;
  message: string;
  bookingId: string;
  bookingNumber?: string | null;
  revenueId?: string;
  revenueIds?: string[];
  totalPaid: number;
  bookingPaidAmount: number;
  priceAfterDiscount: number;
  depositTarget: number;
  depositDue: number;
  remainingDebt: number;
  portalAmountToPay: number;
  portalMode: 'deposit' | 'full';
  missingLedgerCount?: number;
};

export type BookingFinancialIntegritySnapshot = {
  bookingId: string;
  bookingNumber?: string | null;
  priceAfterDiscount: number;
  totalPaid: number;
  bookingPaidAmount: number;
  remainingDebt: number;
  depositTarget: number;
  depositDue: number;
  portalAmountToPay: number;
  portalMode: 'deposit' | 'full';
  portalShouldShowDepositQr: boolean;
  packageRevenueCount: number;
  missingLedgerRevenueIds: string[];
  issues: FinancialIntegrityIssue[];
};

const MONEY_TOLERANCE = 1;
const PACKAGE_REVENUE_TYPES = new Set(['deposit', 'remaining_payment', 'package_payment', 'package_sale']);
const OPEN_PAYMENT_STATUSES = new Set(['deposit_pending', 'deposit', 'inquiry']);

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function asFiniteNumber(value: unknown, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asMoney(value: unknown) {
  return Math.max(0, Math.round(asFiniteNumber(value)));
}

function isConfirmedPackageRevenue(revenue: FinancialIntegrityRevenue) {
  return normalize(revenue.status) === 'confirmed' &&
    PACKAGE_REVENUE_TYPES.has(normalize(revenue.revenue_type)) &&
    asMoney(revenue.amount) > MONEY_TOLERANCE;
}

function hasPackageSaleOutbox(outboxEvents: FinancialIntegrityOutboxEvent[], revenueId: string) {
  return outboxEvents.some((event) =>
    normalize(event.event_type).toUpperCase() === 'PACKAGE_SALE' &&
    normalize(event.reference_type).toUpperCase() === 'REVENUE' &&
    event.reference_id === revenueId
  );
}

function hasPackageSaleJournal(journalEntries: FinancialIntegrityJournalEntry[], revenueId: string) {
  return journalEntries.some((entry) =>
    normalize(entry.status) !== 'canceled' &&
    normalize(entry.reference_type).toUpperCase() === 'PACKAGE_SALE' &&
    entry.reference_id === revenueId
  );
}

function hasPackageSaleSideEffect(
  revenueId: string,
  outboxEvents: FinancialIntegrityOutboxEvent[],
  journalEntries: FinancialIntegrityJournalEntry[],
) {
  return hasPackageSaleOutbox(outboxEvents, revenueId) || hasPackageSaleJournal(journalEntries, revenueId);
}

export function evaluateBookingFinancialIntegrity(input: {
  booking: FinancialIntegrityBooking;
  revenues?: FinancialIntegrityRevenue[] | null;
  outboxEvents?: FinancialIntegrityOutboxEvent[] | null;
  journalEntries?: FinancialIntegrityJournalEntry[] | null;
}): BookingFinancialIntegritySnapshot {
  const { booking } = input;
  const revenues = input.revenues ?? [];
  const outboxEvents = input.outboxEvents ?? [];
  const journalEntries = input.journalEntries ?? [];

  const paymentRequest = calculatePaymentRequest({
    fullPrice: booking.full_price,
    discountPercent: booking.discount_percent,
    depositAmount: booking.deposit_amount,
    bookingStatus: booking.status,
    revenues,
    selectedTab: 'deposit',
  });
  const bookingPaidAmount = asMoney(booking.deposit_amount);
  const packageRevenues = revenues.filter(isConfirmedPackageRevenue);
  const missingLedgerRevenueIds = packageRevenues
    .filter((revenue) => !hasPackageSaleSideEffect(revenue.id, outboxEvents, journalEntries))
    .map((revenue) => revenue.id);

  const issueBase = {
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
    totalPaid: paymentRequest.totalPaid,
    bookingPaidAmount,
    priceAfterDiscount: paymentRequest.priceAfterDiscount,
    depositTarget: paymentRequest.depositTarget,
    depositDue: paymentRequest.depositDue,
    remainingDebt: paymentRequest.remainingDebt,
    portalAmountToPay: paymentRequest.amountToPay,
    portalMode: paymentRequest.effectiveTab,
  };
  const issues: FinancialIntegrityIssue[] = [];

  if (
    paymentRequest.totalPaid > MONEY_TOLERANCE &&
    Math.abs(bookingPaidAmount - paymentRequest.totalPaid) > MONEY_TOLERANCE
  ) {
    issues.push({
      ...issueBase,
      code: 'booking_payment_amount_drift',
      severity: 'critical',
      message: 'Booking paid amount does not match confirmed revenue total.',
    });
  }

  if (
    normalize(booking.status) === 'deposit_pending' &&
    paymentRequest.depositTarget > MONEY_TOLERANCE &&
    paymentRequest.depositDue <= MONEY_TOLERANCE &&
    paymentRequest.totalPaid + MONEY_TOLERANCE >= paymentRequest.depositTarget
  ) {
    issues.push({
      ...issueBase,
      code: 'portal_deposit_qr_should_be_closed',
      severity: 'critical',
      message: 'Confirmed deposit is already recorded; portal deposit QR must stay closed.',
    });
  }

  if (missingLedgerRevenueIds.length > 0) {
    issues.push({
      ...issueBase,
      code: 'booking_revenue_ledger_gap',
      severity: 'critical',
      message: 'Confirmed package revenue is missing PACKAGE_SALE accounting side effect.',
      revenueIds: missingLedgerRevenueIds,
      revenueId: missingLedgerRevenueIds[0],
      missingLedgerCount: missingLedgerRevenueIds.length,
    });
  }

  if (
    paymentRequest.remainingDebt <= MONEY_TOLERANCE &&
    paymentRequest.priceAfterDiscount > MONEY_TOLERANCE &&
    OPEN_PAYMENT_STATUSES.has(normalize(booking.status))
  ) {
    issues.push({
      ...issueBase,
      code: 'booking_paid_in_full_but_status_open',
      severity: 'warning',
      message: 'Booking is fully paid but still has an open payment status.',
    });
  }

  return {
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
    priceAfterDiscount: paymentRequest.priceAfterDiscount,
    totalPaid: paymentRequest.totalPaid,
    bookingPaidAmount,
    remainingDebt: paymentRequest.remainingDebt,
    depositTarget: paymentRequest.depositTarget,
    depositDue: paymentRequest.depositDue,
    portalAmountToPay: paymentRequest.amountToPay,
    portalMode: paymentRequest.effectiveTab,
    portalShouldShowDepositQr: paymentRequest.showDepositRequest,
    packageRevenueCount: packageRevenues.length,
    missingLedgerRevenueIds,
    issues,
  };
}
