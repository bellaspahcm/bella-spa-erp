/**
 * E7 - English Center Tuition & Billing Service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  ICashReportingEngine,
  ILedgerEngine,
  PostTransactionRequest,
} from '@/platform/finance/contracts';
import { TuitionBillingRepository } from '../repositories/tuition-billing.repository';
import {
  AssignTuitionPlanInput,
  CreateTuitionPlanInput,
  EnglishCenterTuitionAssignment,
  EnglishCenterTuitionInvoice,
  EnglishCenterTuitionPayment,
  EnglishCenterTuitionPaymentAllocation,
  EnglishCenterTuitionPlan,
  IssueTuitionInvoiceInput,
  RecordTuitionPaymentInput,
  TuitionClassContext,
  TuitionEnrollmentContext,
  TuitionReceivableView,
} from '../types/tuition-billing.types';

export interface TuitionBillingRepositoryContract {
  getEnrollmentContext(tenantId: string, englishEnrollmentId: string): Promise<TuitionEnrollmentContext | null>;
  getClassContext(tenantId: string, classId: string): Promise<TuitionClassContext | null>;
  createTuitionPlan(input: {
    tenantId: string;
    branchId?: string | null;
    programId?: string | null;
    classId?: string | null;
    code: string;
    name: string;
    billingCycle: 'monthly' | 'term' | 'course' | 'installment';
    amountMinor: string;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterTuitionPlan>;
  getTuitionPlan(tenantId: string, tuitionPlanId: string): Promise<EnglishCenterTuitionPlan | null>;
  createAssignment(input: {
    tenantId: string;
    branchId: string;
    tuitionPlanId: string;
    englishEnrollmentId: string;
    classId?: string | null;
    startDate: string;
    endDate?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterTuitionAssignment>;
  getAssignment(tenantId: string, assignmentId: string): Promise<EnglishCenterTuitionAssignment | null>;
  createInvoice(input: {
    tenantId: string;
    branchId: string;
    assignmentId: string;
    invoiceNumber: string;
    currency: string;
    grossAmountMinor: string;
    discountAmountMinor: string;
    netAmountMinor: string;
    dueDate: string;
    issuedAt: string;
    financeTransactionId?: string | null;
    metadata?: Record<string, unknown>;
    lines: IssueTuitionInvoiceInput['lines'];
  }): Promise<{ invoice: EnglishCenterTuitionInvoice }>;
  getInvoice(tenantId: string, invoiceId: string): Promise<EnglishCenterTuitionInvoice | null>;
  getPaymentByIdempotency(tenantId: string, idempotencyKey: string): Promise<EnglishCenterTuitionPayment | null>;
  createPayment(input: {
    tenantId: string;
    branchId: string;
    payerPartyId?: string | null;
    amountMinor: string;
    currency: string;
    method: 'cash' | 'bank_transfer' | 'card' | 'qr_code';
    paymentDate: string;
    idempotencyKey: string;
    externalReference?: string | null;
    financeTransactionId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterTuitionPayment>;
  allocatePayment(input: {
    tenantId: string;
    invoiceId: string;
    paymentId: string;
    amountMinor: string;
    allocatedAt: string;
    allocatedBy?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterTuitionPaymentAllocation>;
  updateInvoiceSettlement(input: {
    tenantId: string;
    invoiceId: string;
    paidAmountMinor: string;
    outstandingAmountMinor: string;
    settlementStatus: 'unpaid' | 'partially_paid' | 'paid' | 'overpaid';
  }): Promise<EnglishCenterTuitionInvoice>;
  markPaymentAllocated(tenantId: string, paymentId: string): Promise<EnglishCenterTuitionPayment>;
}

export interface TuitionBillingContracts {
  readonly ledger?: ILedgerEngine;
  readonly cash?: ICashReportingEngine;
}

export class TuitionBillingService {
  private readonly repository: TuitionBillingRepositoryContract;
  private readonly contracts: TuitionBillingContracts;

  constructor(
    supabaseOrRepository: SupabaseClient | TuitionBillingRepositoryContract,
    contracts: TuitionBillingContracts = {}
  ) {
    this.repository = this.isRepository(supabaseOrRepository)
      ? supabaseOrRepository
      : new TuitionBillingRepository(supabaseOrRepository);
    this.contracts = contracts;
  }

  async createTuitionPlan(
    tenantId: string,
    input: CreateTuitionPlanInput
  ): Promise<EnglishCenterTuitionPlan> {
    if (!tenantId || !input.code || !input.name || !input.amountMinor) {
      throw new Error('INVALID_TUITION_PLAN_INPUT');
    }

    if (input.classId) {
      const classContext = await this.requireClass(tenantId, input.classId);
      if (input.branchId && classContext.branchId !== input.branchId) {
        throw new Error('BRANCH_SCOPE_VIOLATION');
      }
    }

    return this.repository.createTuitionPlan({
      tenantId,
      branchId: input.branchId || null,
      programId: input.programId || null,
      classId: input.classId || null,
      code: input.code,
      name: input.name,
      billingCycle: input.billingCycle,
      amountMinor: input.amountMinor,
      currency: input.currency || 'VND',
      metadata: input.metadata,
    });
  }

  async assignTuitionPlan(
    tenantId: string,
    input: AssignTuitionPlanInput
  ): Promise<EnglishCenterTuitionAssignment> {
    if (!tenantId || !input.tuitionPlanId || !input.englishEnrollmentId || !input.startDate) {
      throw new Error('INVALID_TUITION_ASSIGNMENT_INPUT');
    }

    const plan = await this.requirePlan(tenantId, input.tuitionPlanId);
    if (plan.status !== 'active') {
      throw new Error('TUITION_PLAN_INACTIVE');
    }

    const enrollment = await this.requireEnrollment(tenantId, input.englishEnrollmentId);
    const classId = input.classId || enrollment.classId || plan.classId;
    if (classId) {
      const classContext = await this.requireClass(tenantId, classId);
      if (classContext.branchId !== enrollment.branchId) {
        throw new Error('BRANCH_SCOPE_VIOLATION');
      }
    }

    if (plan.branchId && plan.branchId !== enrollment.branchId) {
      throw new Error('BRANCH_SCOPE_VIOLATION');
    }

    return this.repository.createAssignment({
      tenantId,
      branchId: enrollment.branchId,
      tuitionPlanId: plan.id,
      englishEnrollmentId: enrollment.id,
      classId,
      startDate: input.startDate,
      endDate: input.endDate || null,
      metadata: input.metadata,
    });
  }

  async issueInvoice(
    tenantId: string,
    input: IssueTuitionInvoiceInput
  ): Promise<EnglishCenterTuitionInvoice> {
    if (!tenantId || !input.assignmentId || !input.invoiceNumber || input.lines.length === 0) {
      throw new Error('INVALID_TUITION_INVOICE_INPUT');
    }

    const assignment = await this.requireAssignment(tenantId, input.assignmentId);
    const issuedAt = input.issuedAt || new Date().toISOString();
    const grossAmountMinor = this.sumInvoiceLines(input.lines);
    const discountAmountMinor = input.discountAmountMinor || '0';
    const netAmountMinor = this.subtractMoney(grossAmountMinor, discountAmountMinor);

    const financeTransactionId = input.ledgerPosting
      ? await this.postLedgerTransaction(tenantId, input.ledgerPosting, {
          sourceType: 'ENGLISH_CENTER_TUITION_INVOICE',
          sourceId: input.invoiceNumber,
        })
      : null;

    const { invoice } = await this.repository.createInvoice({
      tenantId,
      branchId: assignment.branchId,
      assignmentId: assignment.id,
      invoiceNumber: input.invoiceNumber,
      currency: input.ledgerPosting?.transaction_currency || 'VND',
      grossAmountMinor,
      discountAmountMinor,
      netAmountMinor,
      dueDate: input.dueDate,
      issuedAt,
      financeTransactionId,
      metadata: input.metadata,
      lines: input.lines,
    });

    return invoice;
  }

  async recordPayment(
    tenantId: string,
    input: RecordTuitionPaymentInput
  ): Promise<{
    payment: EnglishCenterTuitionPayment;
    allocation?: EnglishCenterTuitionPaymentAllocation;
    invoice: EnglishCenterTuitionInvoice;
    idempotentReplay: boolean;
  }> {
    if (!tenantId || !input.invoiceId || !input.amountMinor || !input.idempotencyKey) {
      throw new Error('INVALID_TUITION_PAYMENT_INPUT');
    }

    const existing = await this.repository.getPaymentByIdempotency(tenantId, input.idempotencyKey);
    const invoice = await this.requireInvoice(tenantId, input.invoiceId);
    if (existing) {
      return { payment: existing, invoice, idempotentReplay: true };
    }

    const financeTransactionId = input.ledgerPosting
      ? await this.postLedgerTransaction(tenantId, input.ledgerPosting, {
          sourceType: 'ENGLISH_CENTER_TUITION_PAYMENT',
          sourceId: input.idempotencyKey,
        })
      : null;

    const payment = await this.repository.createPayment({
      tenantId,
      branchId: invoice.branchId,
      payerPartyId: input.payerPartyId || null,
      amountMinor: input.amountMinor,
      currency: input.currency || invoice.currency,
      method: input.method,
      paymentDate: input.paymentDate,
      idempotencyKey: input.idempotencyKey,
      externalReference: input.externalReference || null,
      financeTransactionId,
      metadata: input.metadata,
    });

    const allocation = await this.repository.allocatePayment({
      tenantId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      amountMinor: input.amountMinor,
      allocatedAt: new Date().toISOString(),
      allocatedBy: input.allocatedBy || null,
      metadata: input.metadata,
    });

    const paidAmountMinor = this.addMoney(invoice.paidAmountMinor, input.amountMinor);
    const outstandingAmountMinor = this.maxZero(this.subtractMoney(invoice.netAmountMinor, paidAmountMinor));
    const settlementStatus = this.deriveSettlementStatus(invoice.netAmountMinor, paidAmountMinor);
    const updatedInvoice = await this.repository.updateInvoiceSettlement({
      tenantId,
      invoiceId: invoice.id,
      paidAmountMinor,
      outstandingAmountMinor,
      settlementStatus,
    });
    await this.repository.markPaymentAllocated(tenantId, payment.id);

    return {
      payment: { ...payment, status: 'allocated' },
      allocation,
      invoice: updatedInvoice,
      idempotentReplay: false,
    };
  }

  async getReceivableView(
    tenantId: string,
    invoiceId: string,
    bankAccountId?: string
  ): Promise<TuitionReceivableView> {
    const invoice = await this.requireInvoice(tenantId, invoiceId);
    const cashMovements = this.contracts.cash
      ? await this.contracts.cash.getCashMovements({
          tenant_id: tenantId,
          bank_account_id: bankAccountId,
          direction: 'INFLOW',
          limit: 100,
          offset: 0,
        })
      : { success: true, data: [] };

    if (!cashMovements.success) {
      throw new Error(cashMovements.error?.code || 'CASH_CONTRACT_ERROR');
    }

    return { invoice, cashMovements: cashMovements.data || [] };
  }

  private async requireEnrollment(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<TuitionEnrollmentContext> {
    const enrollment = await this.repository.getEnrollmentContext(tenantId, englishEnrollmentId);
    if (!enrollment) {
      throw new Error('ENROLLMENT_NOT_FOUND');
    }
    if (enrollment.tenantId !== tenantId) {
      throw new Error('TENANT_SCOPE_VIOLATION');
    }

    return enrollment;
  }

  private async requireClass(tenantId: string, classId: string): Promise<TuitionClassContext> {
    const classContext = await this.repository.getClassContext(tenantId, classId);
    if (!classContext) {
      throw new Error('CLASS_NOT_FOUND');
    }
    if (classContext.tenantId !== tenantId) {
      throw new Error('TENANT_SCOPE_VIOLATION');
    }

    return classContext;
  }

  private async requirePlan(tenantId: string, tuitionPlanId: string): Promise<EnglishCenterTuitionPlan> {
    const plan = await this.repository.getTuitionPlan(tenantId, tuitionPlanId);
    if (!plan) {
      throw new Error('TUITION_PLAN_NOT_FOUND');
    }
    if (plan.tenantId !== tenantId) {
      throw new Error('TENANT_SCOPE_VIOLATION');
    }

    return plan;
  }

  private async requireAssignment(tenantId: string, assignmentId: string): Promise<EnglishCenterTuitionAssignment> {
    const assignment = await this.repository.getAssignment(tenantId, assignmentId);
    if (!assignment) {
      throw new Error('TUITION_ASSIGNMENT_NOT_FOUND');
    }
    if (assignment.tenantId !== tenantId) {
      throw new Error('TENANT_SCOPE_VIOLATION');
    }

    return assignment;
  }

  private async requireInvoice(tenantId: string, invoiceId: string): Promise<EnglishCenterTuitionInvoice> {
    const invoice = await this.repository.getInvoice(tenantId, invoiceId);
    if (!invoice) {
      throw new Error('TUITION_INVOICE_NOT_FOUND');
    }
    if (invoice.tenantId !== tenantId) {
      throw new Error('TENANT_SCOPE_VIOLATION');
    }

    return invoice;
  }

  private async postLedgerTransaction(
    tenantId: string,
    request: PostTransactionRequest,
    expected: { sourceType: string; sourceId: string }
  ): Promise<string> {
    if (!this.contracts.ledger) {
      throw new Error('LEDGER_CONTRACT_REQUIRED');
    }
    if (request.tenant_id !== tenantId) {
      throw new Error('TENANT_SCOPE_VIOLATION');
    }
    if (request.source_type !== expected.sourceType || request.source_id !== expected.sourceId) {
      throw new Error('FINANCE_POSTING_SOURCE_MISMATCH');
    }

    const response = await this.contracts.ledger.postTransaction(request);
    if (!response.success || !response.data) {
      throw new Error(response.error?.code || 'LEDGER_POSTING_FAILED');
    }

    return response.data.id;
  }

  private sumInvoiceLines(lines: IssueTuitionInvoiceInput['lines']): string {
    return lines
      .reduce((sum, line) => {
        if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
          throw new Error('INVALID_INVOICE_LINE_QUANTITY');
        }
        return sum + BigInt(line.unitAmountMinor) * BigInt(Math.trunc(line.quantity));
      }, BigInt(0))
      .toString();
  }

  private addMoney(left: string, right: string): string {
    return (BigInt(left) + BigInt(right)).toString();
  }

  private subtractMoney(left: string, right: string): string {
    const result = BigInt(left) - BigInt(right);
    if (result < BigInt(0)) {
      throw new Error('NEGATIVE_MONEY_NOT_ALLOWED');
    }

    return result.toString();
  }

  private maxZero(value: string): string {
    return BigInt(value) < BigInt(0) ? '0' : value;
  }

  private deriveSettlementStatus(
    netAmountMinor: string,
    paidAmountMinor: string
  ): 'unpaid' | 'partially_paid' | 'paid' | 'overpaid' {
    const net = BigInt(netAmountMinor);
    const paid = BigInt(paidAmountMinor);
    if (paid === BigInt(0)) return 'unpaid';
    if (paid < net) return 'partially_paid';
    if (paid === net) return 'paid';
    return 'overpaid';
  }

  private isRepository(
    candidate: SupabaseClient | TuitionBillingRepositoryContract
  ): candidate is TuitionBillingRepositoryContract {
    return 'getEnrollmentContext' in candidate && 'createTuitionPlan' in candidate;
  }
}
