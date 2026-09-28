import type {
  ISemanticReceivableChargeContract,
  SemanticReceivableChargeResult,
  TuitionServiceRecognizedChargeInput,
} from '@/platform/finance/contracts';
import { InvoiceIssuanceService } from '../finance/services/invoice-issuance.service';
import {
  TuitionRecognitionRepository,
  TuitionRecognitionService,
} from '../finance/services/tuition-recognition.service';
import {
  BillingPeriod,
  Invoice,
  TuitionRecognitionPolicy,
  TuitionServicePeriodCompletion,
} from '../finance/domain/finance.types';

const tenantId = 'tenant-preschool';
const otherTenantId = 'tenant-other';
const studentPartyId = 'student-party-a';
const invoiceId = 'edu-fin-invoice-a';
const billingPeriodId = 'period-october';
const completionId = 'completion-october';

function makeBillingPeriod(): BillingPeriod {
  return {
    id: billingPeriodId,
    tenantId,
    periodName: 'Configured Tuition Period',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    dueDate: '2026-11-05',
    status: 'ACTIVE',
    createdBy: 'staff-a',
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: invoiceId,
    tenantId,
    studentPartyId,
    studentId: null,
    billingPeriodId,
    invoiceNumber: 'P7-INV-001',
    invoiceStatus: 'DRAFT',
    settlementStatus: 'UNPAID',
    grossAmount: 5000000,
    discountAmount: 0,
    netAmount: 5000000,
    paidAmount: 0,
    outstandingAmount: 5000000,
    dueDate: '2026-11-05',
    isArchived: false,
    createdBy: 'staff-a',
    lineItems: [{
      tenantId,
      itemType: 'TUITION',
      description: 'Monthly tuition',
      unitPrice: 5000000,
      quantity: 1,
      subtotalAmount: 5000000,
      sourceDomain: 'FINANCE_CATALOG',
      sourceEntityType: 'FEE_STRUCTURE',
      sourceEntityId: 'fee-tuition',
    }],
    ...overrides,
  };
}

function makePolicy(overrides: Partial<TuitionRecognitionPolicy> = {}): TuitionRecognitionPolicy {
  return {
    id: 'policy-period-completion',
    tenantId,
    policyType: 'PERIOD_COMPLETION',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    version: 'preschool-p7-period-completion-v1',
    status: 'ACTIVE',
    createdBy: 'owner-a',
    ...overrides,
  };
}

function makeCompletion(overrides: Partial<TuitionServicePeriodCompletion> = {}): TuitionServicePeriodCompletion {
  return {
    id: completionId,
    tenantId,
    billingPeriodId,
    completedAt: '2026-11-02T08:30:00.000Z',
    completedBy: 'operator-a',
    ...overrides,
  };
}

function makeIssuanceRepoStub(invoice: Invoice = makeInvoice()) {
  const calls = {
    statusUpdates: [] as Array<{
      tenantId: string;
      invoiceId: string;
      invoiceStatus?: string;
      issuedAt?: string;
      sha256Checksum?: string;
    }>,
  };

  const repo = {
    async getInvoiceById(inputTenantId: string, inputInvoiceId: string): Promise<Invoice | null> {
      expect(inputTenantId).toBe(tenantId);
      expect(inputInvoiceId).toBe(invoice.id);
      return invoice;
    },
    async updateInvoiceStatus(
      inputTenantId: string,
      inputInvoiceId: string,
      update: { invoiceStatus?: Invoice['invoiceStatus']; issuedAt?: string; sha256Checksum?: string },
    ): Promise<Invoice> {
      calls.statusUpdates.push({
        tenantId: inputTenantId,
        invoiceId: inputInvoiceId,
        invoiceStatus: update.invoiceStatus,
        issuedAt: update.issuedAt,
        sha256Checksum: update.sha256Checksum,
      });
      return {
        ...invoice,
        invoiceStatus: update.invoiceStatus ?? invoice.invoiceStatus,
        issuedAt: update.issuedAt ?? invoice.issuedAt,
        sha256Checksum: update.sha256Checksum ?? invoice.sha256Checksum,
      };
    },
  };

  return { repo, calls };
}

function makeRecognitionRepoStub(options: {
  invoice?: Invoice | null;
  billingPeriod?: BillingPeriod | null;
  completion?: TuitionServicePeriodCompletion | null;
  policies?: TuitionRecognitionPolicy[];
} = {}): TuitionRecognitionRepository {
  const invoice = options.invoice === undefined ? makeInvoice({ invoiceStatus: 'ISSUED' }) : options.invoice;
  const billingPeriod = options.billingPeriod === undefined ? makeBillingPeriod() : options.billingPeriod;
  const completion = options.completion === undefined ? makeCompletion() : options.completion;
  const policies = options.policies === undefined ? [makePolicy()] : options.policies;

  return {
    async getInvoiceById(inputTenantId: string, inputInvoiceId: string): Promise<Invoice | null> {
      if (inputTenantId !== tenantId) return null;
      if (inputInvoiceId !== invoiceId) return null;
      return invoice;
    },
    async getBillingPeriodById(inputTenantId: string, inputBillingPeriodId: string): Promise<BillingPeriod | null> {
      if (inputTenantId !== tenantId) return null;
      if (inputBillingPeriodId !== billingPeriodId) return null;
      return billingPeriod;
    },
    async getTuitionServicePeriodCompletion(
      inputTenantId: string,
      inputBillingPeriodId: string,
    ): Promise<TuitionServicePeriodCompletion | null> {
      if (inputTenantId !== tenantId) return null;
      if (inputBillingPeriodId !== billingPeriodId) return null;
      return completion;
    },
    async listActiveTuitionRecognitionPoliciesAsOf(
      inputTenantId: string,
      asOfDate: string,
    ): Promise<TuitionRecognitionPolicy[]> {
      if (inputTenantId !== tenantId) return [];
      expect(asOfDate).toBe('2026-11-02');
      return policies;
    },
  };
}

class FakeReceivableChargeService implements ISemanticReceivableChargeContract {
  readonly calls: TuitionServiceRecognizedChargeInput[] = [];

  async recognizeTuitionServiceReceivable(
    input: TuitionServiceRecognizedChargeInput,
  ): Promise<SemanticReceivableChargeResult> {
    this.calls.push(input);
    return {
      invoiceId: 'finance-invoice-a',
      invoiceNumber: 'FRC-P7',
      transactionId: 'finance-transaction-a',
      receivableLedgerEntryCount: 1,
      receivablePositionId: 'finance-position-a',
      transactionLineCount: 2,
      duplicate: this.calls.length > 1,
      policyEvidence: {
        legalSource: '99/2025/TT-BTC',
        effectiveFrom: '2026-01-01',
        applicableRegime: 'VI_TT99_2025',
        businessSemantic: 'TUITION_SERVICE_RECOGNIZED',
        verificationStatus: 'PROVEN',
      },
    };
  }
}

describe('Preschool P7 tuition recognition policy foundation', () => {
  test('invoice issuance does not emit tuition service recognition', async () => {
    const { repo, calls } = makeIssuanceRepoStub();
    const service = new InvoiceIssuanceService(repo);

    const issued = await service.issueInvoice(tenantId, invoiceId);

    expect(calls.statusUpdates).toHaveLength(1);
    expect(issued.invoiceStatus).toBe('ISSUED');
  });

  test('already issued invoice remains idempotent without recovery recognition side effects', async () => {
    const { repo, calls } = makeIssuanceRepoStub(makeInvoice({ invoiceStatus: 'ISSUED' }));
    const service = new InvoiceIssuanceService(repo);

    const issued = await service.issueInvoice(tenantId, invoiceId);

    expect(calls.statusUpdates).toHaveLength(0);
    expect(issued.invoiceStatus).toBe('ISSUED');
  });

  test('PERIOD_COMPLETION without completion evidence fails closed', async () => {
    const finance = new FakeReceivableChargeService();
    const service = new TuitionRecognitionService(
      finance,
      makeRecognitionRepoStub({ completion: null }),
    );

    await expect(service.recognizeCompletedPeriodTuition({ tenantId, invoiceId }))
      .rejects
      .toThrow('PRESCHOOL_TUITION_SERVICE_PERIOD_COMPLETION_REQUIRED');

    expect(finance.calls).toHaveLength(0);
  });

  test('completion evidence with valid effective policy emits exactly one TUITION_SERVICE_RECOGNIZED request', async () => {
    const finance = new FakeReceivableChargeService();
    const service = new TuitionRecognitionService(finance, makeRecognitionRepoStub());

    const result = await service.recognizeCompletedPeriodTuition({ tenantId, invoiceId });

    expect(result.duplicate).toBe(false);
    expect(finance.calls).toEqual([{
      tenantId,
      studentPartyId,
      amountMinor: 5000000,
      currency: 'VND',
      servicePeriodStart: '2026-10-01',
      servicePeriodEnd: '2026-10-31',
      recognitionDate: '2026-11-02',
      dueDate: '2026-11-05',
      businessSourceType: 'PRESCHOOL_P7_TUITION_PERIOD_COMPLETION',
      businessSourceId: `${tenantId}:${studentPartyId}:${billingPeriodId}:${completionId}:${invoiceId}`,
      description: 'Preschool tuition recognized after service period completion Configured Tuition Period',
    }]);
  });

  test('tenant isolation denies recognition when invoice is not readable in tenant scope', async () => {
    const finance = new FakeReceivableChargeService();
    const service = new TuitionRecognitionService(finance, makeRecognitionRepoStub());

    await expect(service.recognizeCompletedPeriodTuition({ tenantId: otherTenantId, invoiceId }))
      .rejects
      .toThrow('PRESCHOOL_TUITION_RECOGNITION_INVOICE_NOT_FOUND');

    expect(finance.calls).toHaveLength(0);
  });

  test('no policy and overlapping policies fail closed before Finance OS call', async () => {
    const noPolicyFinance = new FakeReceivableChargeService();
    await expect(new TuitionRecognitionService(
      noPolicyFinance,
      makeRecognitionRepoStub({ policies: [] }),
    ).recognizeCompletedPeriodTuition({ tenantId, invoiceId }))
      .rejects
      .toThrow('PRESCHOOL_TUITION_RECOGNITION_POLICY_REQUIRED');
    expect(noPolicyFinance.calls).toHaveLength(0);

    const overlapFinance = new FakeReceivableChargeService();
    await expect(new TuitionRecognitionService(
      overlapFinance,
      makeRecognitionRepoStub({ policies: [makePolicy(), makePolicy({ id: 'policy-overlap' })] }),
    ).recognizeCompletedPeriodTuition({ tenantId, invoiceId }))
      .rejects
      .toThrow('PRESCHOOL_TUITION_RECOGNITION_POLICY_AMBIGUOUS');
    expect(overlapFinance.calls).toHaveLength(0);
  });

  test('TIME_BASED and MILESTONE_EVENT are explicit unsupported policies without fallback', async () => {
    for (const policyType of ['TIME_BASED', 'MILESTONE_EVENT'] as const) {
      const finance = new FakeReceivableChargeService();
      const service = new TuitionRecognitionService(
        finance,
        makeRecognitionRepoStub({ policies: [makePolicy({ policyType })] }),
      );

      await expect(service.recognizeCompletedPeriodTuition({ tenantId, invoiceId }))
        .rejects
        .toThrow(`PRESCHOOL_TUITION_RECOGNITION_POLICY_UNSUPPORTED: ${policyType}`);

      expect(finance.calls).toHaveLength(0);
    }
  });

  test('non-tuition invoice content fails closed because eligible amount policy is not proven', async () => {
    const finance = new FakeReceivableChargeService();
    const service = new TuitionRecognitionService(
      finance,
      makeRecognitionRepoStub({
        invoice: makeInvoice({
          lineItems: [{
            tenantId,
            itemType: 'MEAL_FEE',
            description: 'Lunch',
            unitPrice: 35000,
            quantity: 1,
            subtotalAmount: 35000,
          }],
        }),
      }),
    );

    await expect(service.recognizeCompletedPeriodTuition({ tenantId, invoiceId }))
      .rejects
      .toThrow('PRESCHOOL_TUITION_RECOGNITION_AMOUNT_NOT_PROVEN');

    expect(finance.calls).toHaveLength(0);
  });

  test('retry uses stable business identity and vertical supplies no account codes', async () => {
    const finance = new FakeReceivableChargeService();
    const service = new TuitionRecognitionService(finance, makeRecognitionRepoStub());

    await service.recognizeCompletedPeriodTuition({ tenantId, invoiceId });
    const retry = await service.recognizeCompletedPeriodTuition({ tenantId, invoiceId });

    expect(retry.duplicate).toBe(true);
    expect(finance.calls).toHaveLength(2);
    expect(finance.calls[1].businessSourceId).toBe(finance.calls[0].businessSourceId);
    expect(JSON.stringify(finance.calls)).not.toContain('accountCode');
    expect(JSON.stringify(finance.calls)).not.toContain('131');
    expect(JSON.stringify(finance.calls)).not.toContain('511');
  });
});
