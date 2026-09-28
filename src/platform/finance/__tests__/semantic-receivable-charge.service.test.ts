import {
  FinanceChargeReadModel,
  FinanceInvoiceSnapshot,
  FinancePostingLine,
  FinanceReceivableChargeGateway,
  FinanceReceivableChargeMetadata,
  FinanceSemanticAccountMapping,
  FinanceSemanticReceivableChargeError,
  SemanticReceivableChargeService,
} from '../services/semantic-receivable-charge.service';
import { FINANCE_RECEIVABLE_SEMANTICS, TuitionServiceRecognizedChargeInput } from '../contracts/receivable-charge.contract';

const tenantId = 'tenant-finance-os';
const studentPartyId = '6c847cf7-bf13-4635-bc65-6286310ff65f';
const businessSourceId = 'f7e2e9cf-d9ef-41e1-8f98-f2464077c54c';

function makeInput(): TuitionServiceRecognizedChargeInput {
  return {
    tenantId,
    studentPartyId,
    amountMinor: 5000000,
    currency: 'VND',
    servicePeriodStart: '2026-09-01',
    servicePeriodEnd: '2026-09-30',
    recognitionDate: '2026-09-30',
    dueDate: '2026-10-05',
    businessSourceType: 'PRESCHOOL_TUITION_SERVICE',
    businessSourceId,
    description: 'Preschool tuition service recognized for September 2026',
  };
}

class FakeReceivableChargeGateway implements FinanceReceivableChargeGateway {
  readonly calls = {
    createDraftInvoice: [] as Array<{
      tenantId: string;
      customerId: string;
      invoiceNumber: string;
      currency: string;
      issueDate: string;
      dueDate: string;
    }>,
    addInvoiceLine: [] as Array<{
      tenantId: string;
      invoiceId: string;
      serviceId: string;
      description: string;
      quantity: number;
      unitPriceMinor: number;
      taxRate: number;
      revenueAccountCode: string;
    }>,
    finalizeInvoice: [] as Array<{
      tenantId: string;
      invoiceId: string;
      idempotencyKey: string;
      requestHash: string;
      lines: readonly FinancePostingLine[];
    }>,
    saveInvoiceMetadata: [] as FinanceReceivableChargeMetadata[],
  };

  private invoice: FinanceInvoiceSnapshot | null = null;
  private readonly mappings = new Map<string, FinanceSemanticAccountMapping>();
  private hasLines = false;

  constructor(options: {
    readonly missingRevenueMapping?: boolean;
    readonly existingFinalizedInvoice?: boolean;
  } = {}) {
    this.mappings.set(FINANCE_RECEIVABLE_SEMANTICS.TRADE_RECEIVABLE, {
      semanticKey: FINANCE_RECEIVABLE_SEMANTICS.TRADE_RECEIVABLE,
      accountCode: '131',
      authorityVersion: 'VI_TT99_2025|99/2025/TT-BTC|PROVEN',
    });
    if (!options.missingRevenueMapping) {
      this.mappings.set(FINANCE_RECEIVABLE_SEMANTICS.SERVICE_REVENUE, {
        semanticKey: FINANCE_RECEIVABLE_SEMANTICS.SERVICE_REVENUE,
        accountCode: '511',
        authorityVersion: 'VI_TT99_2025|99/2025/TT-BTC|PROVEN',
      });
    }
    if (options.existingFinalizedInvoice) {
      this.invoice = {
        id: 'invoice-existing',
        invoiceNumber: 'FRC-EXISTING',
        status: 'FINALIZED',
        postingAttemptId: 'posting-existing',
        f1TransactionId: 'transaction-existing',
      };
    }
  }

  async resolveSemanticAccount(input: {
    readonly tenantId: string;
    readonly semanticKey: string;
    readonly asOf: string;
  }): Promise<FinanceSemanticAccountMapping | null> {
    expect(input.tenantId).toBe(tenantId);
    expect(input.asOf).toBe('2026-09-30');
    return this.mappings.get(input.semanticKey) ?? null;
  }

  async findInvoiceByNumber(input: {
    readonly tenantId: string;
    readonly invoiceNumber: string;
  }): Promise<FinanceInvoiceSnapshot | null> {
    expect(input.tenantId).toBe(tenantId);
    if (this.invoice?.status === 'FINALIZED') {
      return { ...this.invoice, invoiceNumber: input.invoiceNumber };
    }
    return this.invoice;
  }

  async createDraftInvoice(input: {
    readonly tenantId: string;
    readonly customerId: string;
    readonly invoiceNumber: string;
    readonly currency: string;
    readonly issueDate: string;
    readonly dueDate: string;
  }): Promise<string> {
    this.calls.createDraftInvoice.push(input);
    this.invoice = {
      id: 'invoice-created',
      invoiceNumber: input.invoiceNumber,
      status: 'DRAFT',
      postingAttemptId: 'posting-attempt-created',
      f1TransactionId: null,
    };
    return this.invoice.id;
  }

  async saveInvoiceMetadata(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly metadata: FinanceReceivableChargeMetadata;
  }): Promise<void> {
    expect(input.tenantId).toBe(tenantId);
    expect(input.invoiceId).toBe('invoice-created');
    this.calls.saveInvoiceMetadata.push(input.metadata);
  }

  async invoiceHasLines(): Promise<boolean> {
    return this.hasLines;
  }

  async addInvoiceLine(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly serviceId: string;
    readonly description: string;
    readonly quantity: number;
    readonly unitPriceMinor: number;
    readonly taxRate: number;
    readonly revenueAccountCode: string;
  }): Promise<string> {
    this.calls.addInvoiceLine.push(input);
    this.hasLines = true;
    return 'invoice-line-created';
  }

  async finalizeInvoice(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly lines: readonly FinancePostingLine[];
  }): Promise<{ readonly transactionId: string; readonly duplicate: boolean }> {
    this.calls.finalizeInvoice.push(input);
    this.invoice = {
      id: input.invoiceId,
      invoiceNumber: this.invoice?.invoiceNumber ?? 'FRC-CREATED',
      status: 'FINALIZED',
      postingAttemptId: input.idempotencyKey,
      f1TransactionId: 'transaction-created',
    };
    return {
      transactionId: 'transaction-created',
      duplicate: false,
    };
  }

  async readCharge(): Promise<FinanceChargeReadModel> {
    const invoice = this.invoice;
    if (!invoice) throw new Error('missing fake invoice');
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      transactionId: invoice.f1TransactionId ?? 'transaction-created',
      receivableLedgerEntryCount: 1,
      receivablePositionId: 'position-created',
      transactionLineCount: 2,
    };
  }
}

describe('SemanticReceivableChargeService', () => {
  test('posts TUITION_SERVICE_RECOGNIZED through Finance AR without vertical account codes', async () => {
    const gateway = new FakeReceivableChargeGateway();
    const service = new SemanticReceivableChargeService(gateway);

    const result = await service.recognizeTuitionServiceReceivable(makeInput());

    expect(gateway.calls.createDraftInvoice).toHaveLength(1);
    expect(gateway.calls.createDraftInvoice[0]).toMatchObject({
      tenantId,
      customerId: studentPartyId,
      currency: 'VND',
      issueDate: '2026-09-30',
      dueDate: '2026-10-05',
    });

    expect(gateway.calls.addInvoiceLine).toHaveLength(1);
    expect(gateway.calls.addInvoiceLine[0]).toMatchObject({
      tenantId,
      invoiceId: 'invoice-created',
      serviceId: businessSourceId,
      unitPriceMinor: 5000000,
      taxRate: 0,
      revenueAccountCode: '511',
    });

    expect(gateway.calls.saveInvoiceMetadata[0]).toMatchObject({
      legal_source: '99/2025/TT-BTC',
      applicable_regime: 'VI_TT99_2025',
      business_semantic: 'TUITION_SERVICE_RECOGNIZED',
      verification_status: 'PROVEN',
    });

    expect(gateway.calls.finalizeInvoice).toHaveLength(1);
    expect(gateway.calls.finalizeInvoice[0].lines).toEqual([
      expect.objectContaining({
        account_code: '131',
        debit_amount_minor: 5000000,
        credit_amount_minor: 0,
      }),
      expect.objectContaining({
        account_code: '511',
        debit_amount_minor: 0,
        credit_amount_minor: 5000000,
      }),
    ]);

    expect(result).toMatchObject({
      transactionId: 'transaction-created',
      receivableLedgerEntryCount: 1,
      receivablePositionId: 'position-created',
      transactionLineCount: 2,
      duplicate: false,
      policyEvidence: {
        legalSource: '99/2025/TT-BTC',
        applicableRegime: 'VI_TT99_2025',
        verificationStatus: 'PROVEN',
      },
    });
  });

  test('blocks instead of guessing when TT99 semantic revenue mapping is missing', async () => {
    const service = new SemanticReceivableChargeService(
      new FakeReceivableChargeGateway({ missingRevenueMapping: true }),
    );

    await expect(service.recognizeTuitionServiceReceivable(makeInput()))
      .rejects
      .toMatchObject<Partial<FinanceSemanticReceivableChargeError>>({
        code: 'BLOCKED_BY_TT99_ACCOUNT_RESOLUTION_GAP',
      });
  });

  test('idempotent duplicate does not create another invoice line or posting', async () => {
    const gateway = new FakeReceivableChargeGateway({ existingFinalizedInvoice: true });
    const service = new SemanticReceivableChargeService(gateway);

    const result = await service.recognizeTuitionServiceReceivable(makeInput());

    expect(gateway.calls.createDraftInvoice).toHaveLength(0);
    expect(gateway.calls.addInvoiceLine).toHaveLength(0);
    expect(gateway.calls.finalizeInvoice).toHaveLength(0);
    expect(result.duplicate).toBe(true);
    expect(result.receivableLedgerEntryCount).toBe(1);
    expect(result.transactionLineCount).toBe(2);
  });

  test('uses cross-vertical Finance semantics instead of Education-specific revenue semantics', () => {
    expect(FINANCE_RECEIVABLE_SEMANTICS.TRADE_RECEIVABLE).toBe('TRADE_RECEIVABLE');
    expect(FINANCE_RECEIVABLE_SEMANTICS.SERVICE_REVENUE).toBe('SERVICE_REVENUE');
    expect(Object.values(FINANCE_RECEIVABLE_SEMANTICS)).not.toContain('EDUCATION_SERVICE_REVENUE');
    expect(Object.values(FINANCE_RECEIVABLE_SEMANTICS)).not.toContain('CUSTOMER_RECEIVABLE');
  });
});
