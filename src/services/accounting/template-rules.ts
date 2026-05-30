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
    const reason = normalize(input.reason);
    if (['consume', 'consumed', 'session_consumed', 'used'].includes(reason)) {
      return 'INVENTORY_CONSUMED';
    }
    if (['purchase', 'import', 'stock_in', 'restock'].includes(reason)) {
      return 'INVENTORY_PURCHASE';
    }
    return null;
  }

  if (sourceTable === 'inter_branch_clearing') return 'INTER_BRANCH_CLEARING';
  if (sourceTable === 'franchise_royalty_invoices') return 'FRANCHISE_ROYALTY';

  return null;
}

export function findMissingRequiredFields(
  eventType: BusinessEventType,
  payload: Record<string, unknown>
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
