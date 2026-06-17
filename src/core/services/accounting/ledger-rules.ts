import { classifyInventoryMovementReason } from '@/lib/business-rules/inventory';
import type { BusinessEventType } from './types';

const EXPENSE_CATEGORY_EVENT_MAP: Record<string, BusinessEventType> = {
  rent: 'EXPENSE_RENT',
  utilities: 'EXPENSE_UTILITIES',
  marketing: 'EXPENSE_MARKETING',
  materials: 'EXPENSE_MATERIALS',
  salary: 'EXPENSE_SALARY',
  other: 'EXPENSE_OTHER',
};

const REVENUE_TYPE_EVENT_MAP: Record<string, BusinessEventType> = {
  deposit: 'CUSTOMER_DEPOSIT',
  remaining_payment: 'CUSTOMER_REMAINING_PAYMENT',
  package_payment: 'CUSTOMER_FULL_PAYMENT',
  package_sale: 'CUSTOMER_FULL_PAYMENT',
  session_completed: 'SESSION_REVENUE_RECOGNIZED',
  refund: 'REFUND_TO_CUSTOMER',
};

export const REQUIRED_FIELDS_BY_EVENT: Record<BusinessEventType, string[]> = {
  CUSTOMER_DEPOSIT: ['amount', 'payment_method', 'booking_id'],
  CUSTOMER_REMAINING_PAYMENT: ['amount', 'payment_method', 'booking_id'],
  CUSTOMER_FULL_PAYMENT: ['amount', 'payment_method', 'booking_id'],
  SESSION_REVENUE_RECOGNIZED: ['session_log_id', 'booking_id', 'earned_revenue'],
  REFUND_TO_CUSTOMER: ['amount', 'payment_method', 'reason'],
  EXPENSE_RENT: ['amount', 'payment_method', 'expense_date'],
  EXPENSE_UTILITIES: ['amount', 'payment_method', 'expense_date'],
  EXPENSE_MARKETING: ['amount', 'payment_method', 'expense_date'],
  EXPENSE_MATERIALS: ['amount', 'payment_method', 'expense_date'],
  EXPENSE_SALARY: ['amount', 'payment_method', 'expense_date'],
  EXPENSE_OTHER: ['amount', 'payment_method', 'expense_date', 'description'],
  INVENTORY_PURCHASE: ['amount', 'payment_method', 'item_id'],
  INVENTORY_CONSUMED: ['amount', 'item_id', 'session_log_id'],
  SALARY_ACCRUAL: ['amount', 'ktv_id', 'month_year'],
  SALARY_PAYMENT: ['amount', 'payment_method', 'ktv_id', 'month_year'],
  KTV_COMMISSION_ACCRUAL: ['commission_amount', 'ktv_id', 'session_log_id'],
  INTER_BRANCH_CLEARING: ['amount', 'debtor_tenant_id', 'creditor_tenant_id'],
  FRANCHISE_ROYALTY: ['amount', 'invoice_number', 'tenant_id'],
};

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Resolve the payment account code based on payment method.
 * 
 * @param paymentMethod - Payment method string (e.g., 'cash', 'bank_transfer')
 * @returns Account code '111' for cash, '112' for bank transfers
 * 
 * @remarks
 * Maps payment methods to TT133 standard cash/bank accounts:
 * - 111: Tiền mặt (Cash)
 * - 112: Tiền gửi ngân hàng (Bank deposits)
 * 
 * Case-insensitive matching. Defaults to bank account if method is not 'cash'.
 * 
 * @example
 * ```typescript
 * resolvePaymentAccountCode('cash'); // Returns '111'
 * resolvePaymentAccountCode('CASH'); // Returns '111'
 * resolvePaymentAccountCode('bank_transfer'); // Returns '112'
 * resolvePaymentAccountCode('momo'); // Returns '112'
 * resolvePaymentAccountCode(null); // Returns '112'
 * ```
 */
export function resolvePaymentAccountCode(paymentMethod?: string | null) {
  return normalize(paymentMethod) === 'cash' ? '111' : '112';
}

function asFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Resolve accounting review status based on business event classification.
 * 
 * @param businessEventType - Classified business event type (e.g., 'CUSTOMER_DEPOSIT')
 * @param payload - Transaction payload containing required fields
 * @returns Review status: 'UNREVIEWED' if valid, 'NEEDS_REVIEW' if missing fields or unclassified
 * 
 * @remarks
 * Determines if a business transaction is ready for automated posting or needs
 * manual accountant review. Checks if all required fields for the event type are present.
 * 
 * Status meanings:
 * - `UNREVIEWED`: Has business_event_type and all required fields, ready for automated posting
 * - `NEEDS_REVIEW`: Missing business_event_type or required fields, needs accountant attention
 * 
 * Used during metadata backfill and readiness scoring. See {@link findMissingRequiredFields}
 * for validation logic.
 * 
 * @example
 * ```typescript
 * // Complete deposit transaction - ready for automation
 * resolveAccountingReviewStatus('CUSTOMER_DEPOSIT', {
 *   amount: 1000000,
 *   payment_method: 'cash',
 *   booking_id: 'uuid-123',
 * }); // Returns 'UNREVIEWED'
 * 
 * // Missing required field - needs review
 * resolveAccountingReviewStatus('CUSTOMER_DEPOSIT', {
 *   amount: 1000000,
 *   // Missing payment_method and booking_id
 * }); // Returns 'NEEDS_REVIEW'
 * 
 * // Unclassified transaction - needs review
 * resolveAccountingReviewStatus(null, {}); // Returns 'NEEDS_REVIEW'
 * ```
 */
export function resolveAccountingReviewStatus(
  businessEventType: BusinessEventType | null,
  payload: Record<string, unknown>,
) {
  if (!businessEventType) return 'NEEDS_REVIEW';
  return findMissingRequiredFields(businessEventType, payload).length > 0
    ? 'NEEDS_REVIEW'
    : 'UNREVIEWED';
}

type AccountingMetadataValue = string | number | boolean | null | undefined;

export type RevenueAccountingMetadata = {
  amount: number;
  payment_method: string;
  booking_id: string | null;
  reason: string | null;
  webhook_transaction_id?: string;
  deferredRefundAmount?: number;
  revenueReductionAmount?: number;
  [key: string]: AccountingMetadataValue;
};

/**
 * Build accounting metadata for revenue transactions with refund support.
 * 
 * @param input - Revenue transaction details including type, amount, payment method, and booking
 * @returns Structured accounting metadata with normalized amounts and refund tracking
 * 
 * @remarks
 * Constructs standardized accounting metadata for revenue transactions (deposits, payments, refunds).
 * Handles special refund accounting by tracking both deferred amount and revenue reduction.
 * 
 * For refunds specifically:
 * - `deferredRefundAmount`: Amount returned from unearned revenue (liability reduction)
 * - `revenueReductionAmount`: Amount returned from earned revenue (revenue reversal)
 * 
 * This distinction is critical for TT133 compliance where unearned revenue sits in
 * liability account 3387 (Doanh thu chưa thực hiện) until sessions are completed.
 * 
 * @example
 * ```typescript
 * // Regular deposit
 * buildRevenueAccountingMetadata({
 *   revenueType: 'deposit',
 *   amount: 5000000,
 *   paymentMethod: 'bank_transfer',
 *   bookingId: 'booking-uuid',
 * });
 * // Returns: { amount: 5000000, payment_method: 'bank_transfer', booking_id: 'booking-uuid', reason: null }
 * 
 * // Refund with liability reduction
 * buildRevenueAccountingMetadata({
 *   revenueType: 'refund',
 *   amount: -3000000,
 *   paymentMethod: 'bank_transfer',
 *   bookingId: 'booking-uuid',
 *   reason: 'Khach huy goi',
 *   deferredRefundAmount: 2000000, // Unearned portion
 *   revenueReductionAmount: 1000000, // Earned portion
 * });
 * // Returns: {
 * //   amount: 3000000,
 * //   payment_method: 'bank_transfer',
 * //   booking_id: 'booking-uuid',
 * //   reason: 'Khach huy goi',
 * //   deferredRefundAmount: 2000000,
 * //   revenueReductionAmount: 1000000,
 * // }
 * ```
 */
export function buildRevenueAccountingMetadata(input: {
  revenueType?: string | null;
  amount: number | string | null | undefined;
  paymentMethod?: string | null;
  bookingId?: string | null;
  reason?: string | null;
  webhookTransactionId?: string | null;
  deferredRefundAmount?: number | string | null;
  revenueReductionAmount?: number | string | null;
}): RevenueAccountingMetadata {
  const amount = Math.abs(asFiniteNumber(input.amount));
  const revenueType = normalize(input.revenueType);
  const reason = input.reason || (revenueType === 'refund' ? 'Hoan tien khach hang' : null);
  const metadata: RevenueAccountingMetadata = {
    amount,
    payment_method: input.paymentMethod || 'bank_transfer',
    booking_id: input.bookingId || null,
    reason,
  };

  if (input.webhookTransactionId) {
    metadata.webhook_transaction_id = input.webhookTransactionId;
  }

  if (revenueType === 'refund') {
    metadata.deferredRefundAmount = Math.max(0, asFiniteNumber(input.deferredRefundAmount));
    metadata.revenueReductionAmount = Math.max(
      0,
      input.revenueReductionAmount === undefined || input.revenueReductionAmount === null
        ? amount
        : asFiniteNumber(input.revenueReductionAmount),
    );
  }

  return metadata;
}

/**
 * Infer business event type from source table and transaction attributes.
 * 
 * @param input - Source table name and transaction attributes (category, type, reason, status)
 * @returns Inferred business event type or null if cannot be classified
 * 
 * @remarks
 * Automatically classifies business transactions into standardized event types
 * for accounting template selection and journal entry generation.
 * 
 * Classification logic by source:
 * - **revenue**: Maps revenueType to deposit/payment/refund events
 * - **expenses**: Maps category to expense type events
 * - **salary_records**: Maps status (paid vs draft) to salary events
 * - **session_logs**: Maps completed status to revenue recognition
 * - **inventory_logs**: Maps reason to consumption/purchase events
 * 
 * Returns null for unclassifiable transactions which will be flagged for
 * manual accountant review.
 * 
 * @example
 * ```typescript
 * // Revenue classification
 * inferBusinessEventType({
 *   sourceTable: 'revenue',
 *   revenueType: 'deposit',
 * }); // Returns 'CUSTOMER_DEPOSIT'
 * 
 * // Expense classification
 * inferBusinessEventType({
 *   sourceTable: 'expenses',
 *   category: 'rent',
 * }); // Returns 'EXPENSE_RENT'
 * 
 * // Salary classification
 * inferBusinessEventType({
 *   sourceTable: 'salary_records',
 *   status: 'paid',
 * }); // Returns 'SALARY_PAYMENT'
 * 
 * // Inventory classification
 * inferBusinessEventType({
 *   sourceTable: 'inventory_logs',
 *   reason: 'session_consumed',
 * }); // Returns 'INVENTORY_CONSUMED'
 * 
 * // Unclassifiable transaction
 * inferBusinessEventType({
 *   sourceTable: 'unknown_table',
 * }); // Returns null
 * ```
 */
export function inferBusinessEventType(input: {
  sourceTable: string;
  category?: string | null;
  revenueType?: string | null;
  reason?: string | null;
  status?: string | null;
}): BusinessEventType | null {
  const sourceTable = normalize(input.sourceTable);

  if (sourceTable === 'revenue') {
    return REVENUE_TYPE_EVENT_MAP[normalize(input.revenueType)] ?? null;
  }

  if (sourceTable === 'expenses') {
    return EXPENSE_CATEGORY_EVENT_MAP[normalize(input.category)] ?? 'EXPENSE_OTHER';
  }

  if (sourceTable === 'salary_records') {
    return normalize(input.status) === 'paid' ? 'SALARY_PAYMENT' : 'SALARY_ACCRUAL';
  }

  if (sourceTable === 'session_logs') {
    return normalize(input.status) === 'completed' ? 'SESSION_REVENUE_RECOGNIZED' : null;
  }

  if (sourceTable === 'inventory_logs') {
    const movementKind = classifyInventoryMovementReason(input.reason);
    if (movementKind === 'consumption') return 'INVENTORY_CONSUMED';
    if (movementKind === 'purchase') return 'INVENTORY_PURCHASE';
    return null;
  }

  if (sourceTable === 'inter_branch_clearing') return 'INTER_BRANCH_CLEARING';
  if (sourceTable === 'franchise_royalty_invoices') return 'FRANCHISE_ROYALTY';

  return null;
}

export function findMissingRequiredFields(
  eventType: BusinessEventType,
  payload: Record<string, unknown>,
) {
  const required = REQUIRED_FIELDS_BY_EVENT[eventType] ?? [];
  return required.filter((field) => {
    const value = payload[field];
    return value === null || value === undefined || value === '';
  });
}

export function calculateReadinessScore(input: {
  totalRecords: number;
  missingBusinessEvent: number;
  needsReview: number;
  postingFailed: number;
}) {
  const total = input.totalRecords;
  if (total <= 0) return 100;

  const weightedIssues =
    input.missingBusinessEvent +
    input.needsReview * 1.5 +
    input.postingFailed * 2;

  return Math.max(0, Math.min(100, Math.round(((total - weightedIssues) / total) * 100)));
}
