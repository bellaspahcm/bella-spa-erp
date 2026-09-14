import { describe, expect, it, jest } from '@jest/globals';
import type {
  ICashReportingEngine,
  ILedgerEngine,
  PostTransactionRequest,
} from '@/platform/finance/contracts';
import type { FinancialTransaction } from '@/platform/finance/shared-kernel/types';
import {
  TuitionBillingRepositoryContract,
  TuitionBillingService,
} from '../services/tuition-billing.service';
import {
  EnglishCenterTuitionAssignment,
  EnglishCenterTuitionInvoice,
  EnglishCenterTuitionPayment,
  EnglishCenterTuitionPaymentAllocation,
  EnglishCenterTuitionPlan,
  TuitionClassContext,
  TuitionEnrollmentContext,
} from '../types/tuition-billing.types';

const enrollment: TuitionEnrollmentContext = {
  id: 'english-enrollment-a',
  tenantId: 'tenant-a',
  canonicalEnrollmentId: 'canonical-enrollment-a',
  branchId: 'branch-a',
  programId: 'program-a',
  classId: 'class-a',
};

const classContext: TuitionClassContext = {
  id: 'class-a',
  tenantId: 'tenant-a',
  branchId: 'branch-a',
  courseId: 'course-a',
  status: 'active',
};

function makePlan(overrides: Partial<EnglishCenterTuitionPlan> = {}): EnglishCenterTuitionPlan {
  return {
    id: 'plan-a',
    tenantId: 'tenant-a',
    branchId: 'branch-a',
    programId: 'program-a',
    classId: 'class-a',
    code: 'IELTS-A-MONTHLY',
    name: 'IELTS A Monthly',
    billingCycle: 'monthly',
    amountMinor: '3000000',
    currency: 'VND',
    status: 'active',
    metadata: {},
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<EnglishCenterTuitionAssignment> = {}): EnglishCenterTuitionAssignment {
  return {
    id: 'assignment-a',
    tenantId: 'tenant-a',
    branchId: 'branch-a',
    tuitionPlanId: 'plan-a',
    englishEnrollmentId: 'english-enrollment-a',
    classId: 'class-a',
    startDate: '2026-09-15',
    endDate: null,
    status: 'active',
    metadata: {},
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<EnglishCenterTuitionInvoice> = {}): EnglishCenterTuitionInvoice {
  return {
    id: 'invoice-a',
    tenantId: 'tenant-a',
    branchId: 'branch-a',
    assignmentId: 'assignment-a',
    invoiceNumber: 'EC-INV-001',
    invoiceStatus: 'issued',
    settlementStatus: 'unpaid',
    currency: 'VND',
    grossAmountMinor: '3000000',
    discountAmountMinor: '0',
    netAmountMinor: '3000000',
    paidAmountMinor: '0',
    outstandingAmountMinor: '3000000',
    dueDate: '2026-09-30',
    issuedAt: '2026-09-15T00:00:00.000Z',
    financeTransactionId: null,
    metadata: {},
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

function makePayment(overrides: Partial<EnglishCenterTuitionPayment> = {}): EnglishCenterTuitionPayment {
  return {
    id: 'payment-a',
    tenantId: 'tenant-a',
    branchId: 'branch-a',
    payerPartyId: 'payer-a',
    amountMinor: '3000000',
    currency: 'VND',
    method: 'bank_transfer',
    status: 'received',
    paymentDate: '2026-09-20',
    idempotencyKey: 'idem-payment-a',
    externalReference: null,
    financeTransactionId: null,
    metadata: {},
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

function makeAllocation(
  overrides: Partial<EnglishCenterTuitionPaymentAllocation> = {}
): EnglishCenterTuitionPaymentAllocation {
  return {
    id: 'allocation-a',
    tenantId: 'tenant-a',
    invoiceId: 'invoice-a',
    paymentId: 'payment-a',
    amountMinor: '3000000',
    allocatedAt: '2026-09-20T00:00:00.000Z',
    allocatedBy: null,
    metadata: {},
    createdAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

function makeRepository(
  overrides: Partial<TuitionBillingRepositoryContract> = {}
): TuitionBillingRepositoryContract {
  return {
    async getEnrollmentContext() {
      return enrollment;
    },
    async getClassContext() {
      return classContext;
    },
    async createTuitionPlan(input) {
      return makePlan({
        tenantId: input.tenantId,
        branchId: input.branchId || null,
        programId: input.programId || null,
        classId: input.classId || null,
        code: input.code,
        name: input.name,
        billingCycle: input.billingCycle,
        amountMinor: input.amountMinor,
        currency: input.currency,
        metadata: input.metadata || {},
      });
    },
    async getTuitionPlan() {
      return makePlan();
    },
    async createAssignment(input) {
      return makeAssignment({
        tenantId: input.tenantId,
        branchId: input.branchId,
        tuitionPlanId: input.tuitionPlanId,
        englishEnrollmentId: input.englishEnrollmentId,
        classId: input.classId || null,
        startDate: input.startDate,
        endDate: input.endDate || null,
        metadata: input.metadata || {},
      });
    },
    async getAssignment() {
      return makeAssignment();
    },
    async createInvoice(input) {
      return {
        invoice: makeInvoice({
          tenantId: input.tenantId,
          branchId: input.branchId,
          assignmentId: input.assignmentId,
          invoiceNumber: input.invoiceNumber,
          currency: input.currency,
          grossAmountMinor: input.grossAmountMinor,
          discountAmountMinor: input.discountAmountMinor,
          netAmountMinor: input.netAmountMinor,
          outstandingAmountMinor: input.netAmountMinor,
          dueDate: input.dueDate,
          issuedAt: input.issuedAt,
          financeTransactionId: input.financeTransactionId || null,
          metadata: input.metadata || {},
        }),
      };
    },
    async getInvoice() {
      return makeInvoice();
    },
    async getPaymentByIdempotency() {
      return null;
    },
    async createPayment(input) {
      return makePayment({
        tenantId: input.tenantId,
        branchId: input.branchId,
        payerPartyId: input.payerPartyId || null,
        amountMinor: input.amountMinor,
        currency: input.currency,
        method: input.method,
        paymentDate: input.paymentDate,
        idempotencyKey: input.idempotencyKey,
        externalReference: input.externalReference || null,
        financeTransactionId: input.financeTransactionId || null,
        metadata: input.metadata || {},
      });
    },
    async allocatePayment(input) {
      return makeAllocation({
        tenantId: input.tenantId,
        invoiceId: input.invoiceId,
        paymentId: input.paymentId,
        amountMinor: input.amountMinor,
        allocatedAt: input.allocatedAt,
        allocatedBy: input.allocatedBy || null,
        metadata: input.metadata || {},
      });
    },
    async updateInvoiceSettlement(input) {
      return makeInvoice({
        paidAmountMinor: input.paidAmountMinor,
        outstandingAmountMinor: input.outstandingAmountMinor,
        settlementStatus: input.settlementStatus,
      });
    },
    async markPaymentAllocated() {
      return makePayment({ status: 'allocated' });
    },
    ...overrides,
  };
}

function makeLedgerPosting(sourceType: string, sourceId: string): PostTransactionRequest {
  return {
    tenant_id: 'tenant-a',
    idempotency_key: `ledger-${sourceId}`,
    source_type: sourceType,
    source_id: sourceId,
    transaction_type: 'ACCRUAL',
    posted_at: new Date('2026-09-15T00:00:00.000Z'),
    transaction_currency: 'VND',
    functional_currency: 'VND',
    description: 'Finance-owned posting instruction',
    reference_type: sourceType,
    reference_id: sourceId,
    lines: [{
      account_code: 'FINANCE_POLICY_SUPPLIED_AR',
      debit_amount_minor: '3000000',
      credit_amount_minor: '0',
      memo: 'Finance policy supplied debit',
    }, {
      account_code: 'FINANCE_POLICY_SUPPLIED_REVENUE',
      debit_amount_minor: '0',
      credit_amount_minor: '3000000',
      memo: 'Finance policy supplied credit',
    }],
  };
}

function makeLedgerContract(): ILedgerEngine {
  const tx: FinancialTransaction = {
    id: 'finance-tx-a',
    tenant_id: 'tenant-a',
    idempotency_key: 'x',
    source_type: 'ENGLISH_CENTER_TUITION_INVOICE',
    source_id: 'EC-INV-001',
    status: 'POSTED',
    transaction_type: 'ACCRUAL',
    accounting_period_id: 'period-a',
    posted_at: new Date('2026-09-15T00:00:00.000Z'),
    transaction_currency: 'VND',
    functional_currency: 'VND',
    exchange_rate: {
      rate: '1',
      source_currency: 'VND',
      target_currency: 'VND',
      effective_at: new Date('2026-09-15T00:00:00.000Z'),
    },
    description: 'Posted',
    reference_type: 'ENGLISH_CENTER_TUITION_INVOICE',
    reference_id: 'EC-INV-001',
    lines: [],
  };

  return {
    engineName: 'LedgerEngine',
    engineVersion: 'test',
    postTransaction: jest.fn(async () => ({ success: true, data: tx })),
    voidTransaction: jest.fn(async () => ({ success: true })),
    reverseTransaction: jest.fn(async () => ({ success: true, data: tx })),
    getBalance: jest.fn(async () => ({ success: false, error: { code: 'NOT_USED', message: 'not used', timestamp: 'now' } })),
    getTrialBalance: jest.fn(async () => ({ success: false, error: { code: 'NOT_USED', message: 'not used', timestamp: 'now' } })),
    openPeriod: jest.fn(async () => ({ success: false, error: { code: 'NOT_USED', message: 'not used', timestamp: 'now' } })),
    closePeriod: jest.fn(async () => ({ success: true })),
    lockPeriod: jest.fn(async () => ({ success: true })),
  };
}

function makeCashContract(): ICashReportingEngine {
  return {
    engineName: 'CashReportingEngine',
    engineVersion: 'test',
    getBankAccount: jest.fn(async () => ({ success: false, error: { code: 'NOT_USED', message: 'not used', timestamp: 'now' } })),
    listBankAccounts: jest.fn(async () => ({ success: true, data: [] })),
    getCashPosition: jest.fn(async () => ({ success: false, error: { code: 'NOT_USED', message: 'not used', timestamp: 'now' } })),
    listCashPositions: jest.fn(async () => ({ success: true, data: [] })),
    getCashMovements: jest.fn(async () => ({
      success: true,
      data: [{
        id: 'cash-movement-a',
        tenant_id: 'tenant-a',
        bank_account_id: 'bank-a',
        idempotency_key: 'cash-a',
        direction: 'INFLOW',
        amount_minor: '3000000',
        currency: 'VND',
        functional_amount_minor: '3000000',
        functional_currency: 'VND',
        valuation_rate: '1',
        f1_transaction_id: 'finance-tx-a',
        cash_leg_reference: 'cash-leg-a',
        source_type: 'F1_POSTING',
        source_id: 'finance-tx-a',
        recorded_at: new Date('2026-09-20T00:00:00.000Z'),
      }],
    })),
    getConsolidatedRunway: jest.fn(async () => ({ success: false, error: { code: 'NOT_USED', message: 'not used', timestamp: 'now' } })),
    getQuarantineEvents: jest.fn(async () => ({ success: true, data: [] })),
  };
}

describe('E7 - TuitionBillingService', () => {
  it('creates an English Center tuition plan as product-owned context', async () => {
    const service = new TuitionBillingService(makeRepository());

    const plan = await service.createTuitionPlan('tenant-a', {
      branchId: 'branch-a',
      programId: 'program-a',
      classId: 'class-a',
      code: 'IELTS-A-MONTHLY',
      name: 'IELTS A Monthly',
      billingCycle: 'monthly',
      amountMinor: '3000000',
    });

    expect(plan.code).toBe('IELTS-A-MONTHLY');
    expect(plan.branchId).toBe('branch-a');
  });

  it('assigns tuition plans only within enrollment branch scope', async () => {
    const service = new TuitionBillingService(makeRepository({
      async getTuitionPlan() {
        return makePlan({ branchId: 'branch-b' });
      },
    }));

    await expect(service.assignTuitionPlan('tenant-a', {
      tuitionPlanId: 'plan-a',
      englishEnrollmentId: 'english-enrollment-a',
      startDate: '2026-09-15',
    })).rejects.toThrow('BRANCH_SCOPE_VIOLATION');
  });

  it('issues invoices through the Finance Ledger contract when finance posting is supplied', async () => {
    const ledger = makeLedgerContract();
    const service = new TuitionBillingService(makeRepository(), { ledger });
    const posting = makeLedgerPosting('ENGLISH_CENTER_TUITION_INVOICE', 'EC-INV-001');

    const invoice = await service.issueInvoice('tenant-a', {
      assignmentId: 'assignment-a',
      invoiceNumber: 'EC-INV-001',
      dueDate: '2026-09-30',
      lines: [{ description: 'Monthly tuition', quantity: 1, unitAmountMinor: '3000000' }],
      ledgerPosting: posting,
    });

    expect(invoice.financeTransactionId).toBe('finance-tx-a');
    expect(ledger.postTransaction).toHaveBeenCalledWith(posting);
  });

  it('rejects ledger postings whose source does not match the invoice lifecycle', async () => {
    const service = new TuitionBillingService(makeRepository(), { ledger: makeLedgerContract() });

    await expect(service.issueInvoice('tenant-a', {
      assignmentId: 'assignment-a',
      invoiceNumber: 'EC-INV-001',
      dueDate: '2026-09-30',
      lines: [{ description: 'Monthly tuition', quantity: 1, unitAmountMinor: '3000000' }],
      ledgerPosting: makeLedgerPosting('WRONG_SOURCE', 'EC-INV-001'),
    })).rejects.toThrow('FINANCE_POSTING_SOURCE_MISMATCH');
  });

  it('rejects fractional invoice line quantities before amount persistence', async () => {
    const service = new TuitionBillingService(makeRepository());

    await expect(service.issueInvoice('tenant-a', {
      assignmentId: 'assignment-a',
      invoiceNumber: 'EC-INV-001',
      dueDate: '2026-09-30',
      lines: [{ description: 'Monthly tuition', quantity: 1.5, unitAmountMinor: '3000000' }],
    })).rejects.toThrow('INVALID_INVOICE_LINE_QUANTITY');
  });

  it('records payment idempotently without duplicate allocation on replay', async () => {
    const createPayment = jest.fn(async () => makePayment());
    const allocatePayment = jest.fn(async () => makeAllocation());
    const service = new TuitionBillingService(makeRepository({
      async getPaymentByIdempotency() {
        return makePayment({ status: 'allocated' });
      },
      createPayment,
      allocatePayment,
    }));

    const result = await service.recordPayment('tenant-a', {
      invoiceId: 'invoice-a',
      amountMinor: '3000000',
      method: 'bank_transfer',
      paymentDate: '2026-09-20',
      idempotencyKey: 'idem-payment-a',
    });

    expect(result.idempotentReplay).toBe(true);
    expect(createPayment).not.toHaveBeenCalled();
    expect(allocatePayment).not.toHaveBeenCalled();
  });

  it('updates invoice settlement after a new payment allocation', async () => {
    const service = new TuitionBillingService(makeRepository());

    const result = await service.recordPayment('tenant-a', {
      invoiceId: 'invoice-a',
      amountMinor: '3000000',
      method: 'bank_transfer',
      paymentDate: '2026-09-20',
      idempotencyKey: 'idem-payment-a',
    });

    expect(result.idempotentReplay).toBe(false);
    expect(result.invoice.settlementStatus).toBe('paid');
    expect(result.invoice.outstandingAmountMinor).toBe('0');
    expect(result.allocation?.amountMinor).toBe('3000000');
  });

  it('reads receivable cash context through the Finance Cash reporting contract', async () => {
    const cash = makeCashContract();
    const service = new TuitionBillingService(makeRepository(), { cash });

    const view = await service.getReceivableView('tenant-a', 'invoice-a', 'bank-a');

    expect(view.cashMovements).toHaveLength(1);
    expect(cash.getCashMovements).toHaveBeenCalledWith({
      tenant_id: 'tenant-a',
      bank_account_id: 'bank-a',
      direction: 'INFLOW',
      limit: 100,
      offset: 0,
    });
  });
});
