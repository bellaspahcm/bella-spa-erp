import type { EnqueueAccountingEventParams } from '@/lib/accounting-outbox';

export const PACKAGE_SALE_REVENUE_TYPES = [
  'deposit',
  'remaining_payment',
  'package_payment',
  'package_sale',
];

export function isPackageSaleRevenueType(revenueType: string | null | undefined) {
  return PACKAGE_SALE_REVENUE_TYPES.includes(String(revenueType ?? '').trim().toLowerCase());
}

export function buildPackageSaleOutboxEvent(input: {
  tenantId: string;
  revenueId: string;
  totalAmount: number;
  description?: string | null;
}): EnqueueAccountingEventParams {
  return {
    tenantId: input.tenantId,
    eventType: 'PACKAGE_SALE',
    referenceType: 'REVENUE',
    referenceId: input.revenueId,
    payload: {
      totalAmount: input.totalAmount,
      vatRate: 0,
      description: input.description || 'Xác nhận thanh toán gói dịch vụ',
      branchId: input.tenantId,
    },
  };
}

export function buildRefundIssuedOutboxEvent(input: {
  tenantId: string;
  revenueId: string;
  amount: number;
  paymentMethod?: string | null;
  description?: string | null;
}): EnqueueAccountingEventParams {
  const amount = Math.abs(input.amount);

  return {
    tenantId: input.tenantId,
    eventType: 'REFUND_ISSUED',
    referenceType: 'REVENUE',
    referenceId: input.revenueId,
    payload: {
      amount,
      deferredRefundAmount: 0,
      revenueReductionAmount: amount,
      paymentMethod: input.paymentMethod || 'bank_transfer',
      description: input.description || 'Hoan tien khach hang',
      branchId: input.tenantId,
    },
  };
}

export function buildExpenseRecordedOutboxEvent(input: {
  tenantId: string;
  expenseId: string;
  amount: number;
  category?: string | null;
  paymentMethod?: string | null;
  description?: string | null;
}): EnqueueAccountingEventParams {
  return {
    tenantId: input.tenantId,
    eventType: 'EXPENSE_RECORDED',
    referenceType: 'EXPENSE',
    referenceId: input.expenseId,
    payload: {
      amount: Math.abs(input.amount),
      category: input.category,
      paymentMethod: input.paymentMethod || 'bank_transfer',
      description: input.description || 'Chi phí vận hành',
      branchId: input.tenantId,
    },
  };
}

export function buildSalaryPaidOutboxEvent(input: {
  tenantId: string;
  salaryRecordId: string;
  amount: number;
  paymentMethod?: string | null;
  description?: string | null;
  ktvId?: string | null;
}): EnqueueAccountingEventParams {
  return {
    tenantId: input.tenantId,
    eventType: 'SALARY_PAID',
    referenceType: 'SALARY_RECORD',
    referenceId: input.salaryRecordId,
    payload: {
      amount: input.amount,
      paymentMethod: input.paymentMethod || 'bank_transfer',
      description: input.description || 'Thanh toán lương',
      ktvId: input.ktvId,
      branchId: input.tenantId,
    },
  };
}

export function buildInventoryConsumedOutboxEvent(input: {
  tenantId: string;
  sessionLogId: string;
  amount: number;
  description?: string | null;
}): EnqueueAccountingEventParams {
  return {
    tenantId: input.tenantId,
    eventType: 'INVENTORY_CONSUMED',
    referenceType: 'SESSION_LOG',
    referenceId: input.sessionLogId,
    payload: {
      amount: input.amount,
      description: input.description || `Vật tư tiêu hao ca trị liệu, buổi ID: ${input.sessionLogId}`,
      branchId: input.tenantId,
    },
  };
}

export function buildSessionDoneOutboxEvent(input: {
  tenantId: string;
  sessionLogId: string;
  bookingId: string;
  ktvId?: string | null;
  earnedRevenueAmount: number;
  deferredRevenueAmount: number;
  receivableAmount: number;
  commissionAmount: number;
  description?: string | null;
}): EnqueueAccountingEventParams {
  return {
    tenantId: input.tenantId,
    eventType: 'SESSION_DONE',
    referenceType: 'SESSION_LOG',
    referenceId: input.sessionLogId,
    payload: {
      earnedRevenueAmount: input.earnedRevenueAmount,
      deferredRevenueAmount: input.deferredRevenueAmount,
      receivableAmount: input.receivableAmount,
      bookingId: input.bookingId,
      commissionAmount: input.commissionAmount,
      ktvId: input.ktvId,
      branchId: input.tenantId,
      ...(input.description ? { description: input.description } : {}),
    },
  };
}

export function assertOutboxEnqueued(result: unknown, eventType: string) {
  if (result === false) {
    throw new Error(`Failed to enqueue ${eventType} accounting event`);
  }
}
