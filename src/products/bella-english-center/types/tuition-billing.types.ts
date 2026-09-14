/**
 * E7 - English Center Tuition & Billing Types
 */

import type {
  CashMovement,
  PostTransactionRequest,
} from '@/platform/finance/contracts';

export type TuitionBillingCycle = 'monthly' | 'term' | 'course' | 'installment';
export type TuitionPlanStatus = 'active' | 'inactive';
export type TuitionAssignmentStatus = 'active' | 'completed' | 'cancelled';
export type TuitionInvoiceStatus = 'draft' | 'issued' | 'void';
export type TuitionSettlementStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overpaid';
export type TuitionPaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'qr_code';
export type TuitionPaymentStatus = 'received' | 'allocated' | 'void';

export interface TuitionEnrollmentContext {
  readonly id: string;
  readonly tenantId: string;
  readonly canonicalEnrollmentId: string;
  readonly branchId: string;
  readonly programId: string | null;
  readonly classId: string | null;
}

export interface TuitionClassContext {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly courseId: string;
  readonly status: 'planned' | 'active' | 'completed' | 'cancelled';
}

export interface EnglishCenterTuitionPlan {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string | null;
  readonly programId: string | null;
  readonly classId: string | null;
  readonly code: string;
  readonly name: string;
  readonly billingCycle: TuitionBillingCycle;
  readonly amountMinor: string;
  readonly currency: string;
  readonly status: TuitionPlanStatus;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EnglishCenterTuitionAssignment {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly tuitionPlanId: string;
  readonly englishEnrollmentId: string;
  readonly classId: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: TuitionAssignmentStatus;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EnglishCenterTuitionInvoice {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly assignmentId: string;
  readonly invoiceNumber: string;
  readonly invoiceStatus: TuitionInvoiceStatus;
  readonly settlementStatus: TuitionSettlementStatus;
  readonly currency: string;
  readonly grossAmountMinor: string;
  readonly discountAmountMinor: string;
  readonly netAmountMinor: string;
  readonly paidAmountMinor: string;
  readonly outstandingAmountMinor: string;
  readonly dueDate: string;
  readonly issuedAt: string | null;
  readonly financeTransactionId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EnglishCenterTuitionInvoiceLine {
  readonly id: string;
  readonly tenantId: string;
  readonly invoiceId: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitAmountMinor: string;
  readonly lineAmountMinor: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface EnglishCenterTuitionPayment {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly payerPartyId: string | null;
  readonly amountMinor: string;
  readonly currency: string;
  readonly method: TuitionPaymentMethod;
  readonly status: TuitionPaymentStatus;
  readonly paymentDate: string;
  readonly idempotencyKey: string;
  readonly externalReference: string | null;
  readonly financeTransactionId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EnglishCenterTuitionPaymentAllocation {
  readonly id: string;
  readonly tenantId: string;
  readonly invoiceId: string;
  readonly paymentId: string;
  readonly amountMinor: string;
  readonly allocatedAt: string;
  readonly allocatedBy: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface CreateTuitionPlanInput {
  readonly branchId?: string | null;
  readonly programId?: string | null;
  readonly classId?: string | null;
  readonly code: string;
  readonly name: string;
  readonly billingCycle: TuitionBillingCycle;
  readonly amountMinor: string;
  readonly currency?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AssignTuitionPlanInput {
  readonly tuitionPlanId: string;
  readonly englishEnrollmentId: string;
  readonly classId?: string | null;
  readonly startDate: string;
  readonly endDate?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface TuitionInvoiceLineInput {
  readonly description: string;
  readonly quantity: number;
  readonly unitAmountMinor: string;
  readonly metadata?: Record<string, unknown>;
}

export interface IssueTuitionInvoiceInput {
  readonly assignmentId: string;
  readonly invoiceNumber: string;
  readonly dueDate: string;
  readonly lines: readonly TuitionInvoiceLineInput[];
  readonly discountAmountMinor?: string;
  readonly issuedAt?: string;
  readonly ledgerPosting?: PostTransactionRequest;
  readonly metadata?: Record<string, unknown>;
}

export interface RecordTuitionPaymentInput {
  readonly invoiceId: string;
  readonly payerPartyId?: string | null;
  readonly amountMinor: string;
  readonly currency?: string;
  readonly method: TuitionPaymentMethod;
  readonly paymentDate: string;
  readonly idempotencyKey: string;
  readonly externalReference?: string | null;
  readonly ledgerPosting?: PostTransactionRequest;
  readonly allocatedBy?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface TuitionReceivableView {
  readonly invoice: EnglishCenterTuitionInvoice;
  readonly cashMovements: readonly CashMovement[];
}

export interface TuitionPlanRow {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  program_id: string | null;
  class_id: string | null;
  code: string;
  name: string;
  billing_cycle: TuitionBillingCycle;
  amount_minor: string;
  currency: string;
  status: TuitionPlanStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TuitionAssignmentRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  tuition_plan_id: string;
  english_enrollment_id: string;
  class_id: string | null;
  start_date: string;
  end_date: string | null;
  status: TuitionAssignmentStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TuitionInvoiceRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  assignment_id: string;
  invoice_number: string;
  invoice_status: TuitionInvoiceStatus;
  settlement_status: TuitionSettlementStatus;
  currency: string;
  gross_amount_minor: string;
  discount_amount_minor: string;
  net_amount_minor: string;
  paid_amount_minor: string;
  outstanding_amount_minor: string;
  due_date: string;
  issued_at: string | null;
  finance_transaction_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TuitionInvoiceLineRow {
  id: string;
  tenant_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_amount_minor: string;
  line_amount_minor: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TuitionPaymentRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  payer_party_id: string | null;
  amount_minor: string;
  currency: string;
  method: TuitionPaymentMethod;
  status: TuitionPaymentStatus;
  payment_date: string;
  idempotency_key: string;
  external_reference: string | null;
  finance_transaction_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TuitionPaymentAllocationRow {
  id: string;
  tenant_id: string;
  invoice_id: string;
  payment_id: string;
  amount_minor: string;
  allocated_at: string;
  allocated_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
