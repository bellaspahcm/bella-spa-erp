import {
  FinanceChargeReadModel,
  FinanceCashMovementSnapshot,
  FinanceCashReceiptSnapshot,
  FinanceInvoiceSnapshot,
  FinanceOpenReceivable,
  FinancePostingLine,
  FinanceReceivableAllocationSnapshot,
  FinanceReceivableChargeGateway,
  FinanceReceivableChargeMetadata,
  FinanceSemanticAccountMapping,
  FinanceSemanticReceivableChargeError,
  SemanticReceivableChargeService,
} from '../services/semantic-receivable-charge.service';
import {
  FINANCE_RECEIVABLE_SEMANTICS,
  PaymentReceivableAllocationInput,
  PaymentReceivableAllocationResult,
  ServiceReceivableChargeInput,
  TuitionServiceRecognizedChargeInput,
} from '../contracts/receivable-charge.contract';

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

function makeGenericInput(): ServiceReceivableChargeInput {
  return {
    tenantId,
    customerId: 'customer-haircut-or-service',
    amountMinor: 60000,
    currency: 'VND',
    servicePeriodStart: '2026-09-30',
    servicePeriodEnd: '2026-09-30',
    recognitionDate: '2026-09-30',
    dueDate: '2026-09-30',
    businessSourceType: 'BEAUTY_SESSION_DONE',
    businessSourceId: 'session-log-1',
    description: 'Haircut service receivable recognized after session completion',
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
    allocatePayment: [] as PaymentReceivableAllocationInput[],
    postCashReceipt: [] as Array<{
      tenantId: string;
      idempotencyKey: string;
      paymentSourceType: string;
      paymentSourceId: string;
      amountMinor: number;
      currency: string;
      paymentAccountCode: string;
      receivableAccountCode: string;
      postedAt: Date;
      description: string;
    }>,
    projectCashReceipt: [] as Array<{
      tenantId: string;
      transactionId: string;
    }>,
  };

  private invoice: FinanceInvoiceSnapshot | null = null;
  private readonly mappings = new Map<string, FinanceSemanticAccountMapping>();
  private openReceivables: FinanceOpenReceivable[];
  private cashReceipt: FinanceCashReceiptSnapshot | null = null;
  private cashMovements: FinanceCashMovementSnapshot[] = [];
  private allocations: FinanceReceivableAllocationSnapshot[] = [];
  private hasLines = false;

  constructor(options: {
    readonly missingRevenueMapping?: boolean;
    readonly existingFinalizedInvoice?: boolean;
    readonly openReceivables?: readonly FinanceOpenReceivable[];
    readonly existingCashReceipt?: boolean;
    readonly existingAllocation?: boolean;
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
    this.openReceivables = [...(options.openReceivables ?? [{
      invoiceId: 'invoice-created',
      receivablePositionId: 'position-created',
      outstandingAmountMinor: 60000,
      currency: 'VND',
      issueDate: '2026-09-30',
      createdAt: '2026-09-30T00:00:00.000Z',
    }])];
    if (options.existingCashReceipt) {
      this.cashReceipt = { transactionId: 'transaction-payment' };
      this.cashMovements = [{
        id: 'cash-movement-1',
        amountMinor: 60000,
        direction: 'INFLOW',
      }];
    }
    if (options.existingAllocation) {
      this.openReceivables = [];
      this.allocations = [{
        invoiceId: 'invoice-created',
        receivablePositionId: 'position-created',
        allocationId: 'allocation-existing',
        allocatedAmountMinor: 60000,
      }];
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

  async allocatePayment(input: PaymentReceivableAllocationInput): Promise<PaymentReceivableAllocationResult> {
    this.calls.allocatePayment.push(input);
    const receivable = this.openReceivables.find((item) => item.invoiceId === input.invoiceId);
    this.allocations.push({
      invoiceId: input.invoiceId,
      receivablePositionId: receivable?.receivablePositionId ?? 'position-created',
      allocationId: 'allocation-created',
      allocatedAmountMinor: input.allocatedAmountMinor,
    });
    return { allocationId: 'allocation-created' };
  }

  async findOpenReceivables(): Promise<readonly FinanceOpenReceivable[]> {
    return [...this.openReceivables];
  }

  async findCashReceiptByIdempotencyKey(input: {
    readonly tenantId: string;
    readonly idempotencyKey: string;
  }): Promise<FinanceCashReceiptSnapshot | null> {
    expect(input.tenantId).toBe(tenantId);
    return this.cashReceipt;
  }

  async postCashReceipt(input: {
    readonly tenantId: string;
    readonly idempotencyKey: string;
    readonly paymentSourceType: string;
    readonly paymentSourceId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly paymentAccountCode: string;
    readonly receivableAccountCode: string;
    readonly postedAt: Date;
    readonly description: string;
  }): Promise<FinanceCashReceiptSnapshot> {
    this.calls.postCashReceipt.push(input);
    this.cashReceipt = { transactionId: 'transaction-payment' };
    return this.cashReceipt;
  }

  async projectCashReceipt(input: {
    readonly tenantId: string;
    readonly transactionId: string;
  }): Promise<void> {
    this.calls.projectCashReceipt.push(input);
    this.cashMovements = [{
      id: 'cash-movement-1',
      amountMinor: 60000,
      direction: 'INFLOW',
    }];
  }

  async findCashMovementsByTransaction(): Promise<readonly FinanceCashMovementSnapshot[]> {
    return [...this.cashMovements];
  }

  async findAllocationsByCashMovement(): Promise<readonly FinanceReceivableAllocationSnapshot[]> {
    return [...this.allocations];
  }

  async findExistingAllocation(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly cashMovementId: string;
  }): Promise<FinanceReceivableAllocationSnapshot | null> {
    expect(input.tenantId).toBe(tenantId);
    return this.allocations.find((allocation) => allocation.invoiceId === input.invoiceId) ?? null;
  }
}

describe('SemanticReceivableChargeService', () => {
  test('posts generic SERVICE_RECEIVABLE_RECOGNIZED through Finance AR primitives', async () => {
    const gateway = new FakeReceivableChargeGateway();
    const service = new SemanticReceivableChargeService(gateway);

    const result = await service.recognizeServiceReceivable(makeGenericInput());

    expect(gateway.calls.createDraftInvoice[0]).toMatchObject({
      tenantId,
      customerId: 'customer-haircut-or-service',
      currency: 'VND',
      issueDate: '2026-09-30',
      dueDate: '2026-09-30',
    });
    expect(gateway.calls.addInvoiceLine[0]).toMatchObject({
      serviceId: 'session-log-1',
      unitPriceMinor: 60000,
      revenueAccountCode: '511',
    });
    expect(gateway.calls.saveInvoiceMetadata[0]).toMatchObject({
      business_semantic: 'SERVICE_RECEIVABLE_RECOGNIZED',
      customer_id: 'customer-haircut-or-service',
      business_source_type: 'BEAUTY_SESSION_DONE',
    });
    expect(gateway.calls.saveInvoiceMetadata[0]).not.toHaveProperty('student_party_id');
    expect(result.policyEvidence.businessSemantic).toBe('SERVICE_RECEIVABLE_RECOGNIZED');
  });

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
      customer_id: studentPartyId,
      student_party_id: studentPartyId,
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
        businessSemantic: 'TUITION_SERVICE_RECOGNIZED',
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

  test('allocates payment to receivable through Finance allocation gateway', async () => {
    const gateway = new FakeReceivableChargeGateway();
    const service = new SemanticReceivableChargeService(gateway);

    const result = await service.allocatePaymentToReceivable({
      tenantId,
      invoiceId: 'invoice-created',
      cashMovementId: 'cash-movement-1',
      allocatedAmountMinor: 60000,
      exchangeRate: 1,
      rateSource: 'CENTRAL_BANK',
      rateTimestamp: '2026-09-30T00:00:00.000Z',
    });

    expect(result).toEqual({ allocationId: 'allocation-created' });
    expect(gateway.calls.allocatePayment).toEqual([
      expect.objectContaining({
        tenantId,
        invoiceId: 'invoice-created',
        cashMovementId: 'cash-movement-1',
        allocatedAmountMinor: 60000,
      }),
    ]);
  });

  test('allocates confirmed payment through F1 cash receipt, F2 cash movement, and F3 AR allocation', async () => {
    const gateway = new FakeReceivableChargeGateway();
    const service = new SemanticReceivableChargeService(gateway);

    const result = await service.allocateConfirmedPaymentToReceivables({
      tenantId,
      paymentSourceType: 'REVENUE',
      paymentSourceId: 'revenue-1',
      amountMinor: 60000,
      currency: 'VND',
      paymentMethod: 'bank_transfer',
      receivedAt: '2026-09-30',
      idempotencyKey: 'manual-payment:key-1',
      description: 'Confirmed Haircut remaining payment',
      receivableMatch: {
        bookingId: 'booking-1',
      },
    });

    expect(gateway.calls.postCashReceipt).toHaveLength(1);
    expect(gateway.calls.postCashReceipt[0]).toMatchObject({
      tenantId,
      paymentSourceType: 'REVENUE',
      paymentSourceId: 'revenue-1',
      paymentAccountCode: '112',
      receivableAccountCode: '131',
    });
    expect(gateway.calls.projectCashReceipt).toEqual([{
      tenantId,
      transactionId: 'transaction-payment',
    }]);
    expect(gateway.calls.allocatePayment).toEqual([
      expect.objectContaining({
        tenantId,
        invoiceId: 'invoice-created',
        cashMovementId: 'cash-movement-1',
        allocatedAmountMinor: 60000,
      }),
    ]);
    expect(result).toMatchObject({
      transactionId: 'transaction-payment',
      cashMovementId: 'cash-movement-1',
      allocatedAmountMinor: 60000,
      duplicate: false,
    });
    expect(result.allocations[0]).toMatchObject({
      invoiceId: 'invoice-created',
      receivablePositionId: 'position-created',
      allocationId: 'allocation-created',
      duplicate: false,
    });
  });

  test('confirmed payment allocation retry returns existing F3 allocation without duplicate posting', async () => {
    const gateway = new FakeReceivableChargeGateway({
      existingCashReceipt: true,
      existingAllocation: true,
    });
    const service = new SemanticReceivableChargeService(gateway);

    const result = await service.allocateConfirmedPaymentToReceivables({
      tenantId,
      paymentSourceType: 'REVENUE',
      paymentSourceId: 'revenue-1',
      amountMinor: 60000,
      currency: 'VND',
      paymentMethod: 'cash',
      receivedAt: '2026-09-30',
      idempotencyKey: 'manual-payment:key-1',
      description: 'Confirmed Haircut remaining payment retry',
      receivableMatch: {
        bookingId: 'booking-1',
      },
    });

    expect(gateway.calls.postCashReceipt).toHaveLength(0);
    expect(gateway.calls.allocatePayment).toHaveLength(0);
    expect(result.duplicate).toBe(true);
    expect(result.allocations).toEqual([
      expect.objectContaining({
        allocationId: 'allocation-existing',
        duplicate: true,
      }),
    ]);
  });

  test('blocks confirmed payment before F1 posting when receivable resolution is insufficient', async () => {
    const gateway = new FakeReceivableChargeGateway({
      openReceivables: [{
        invoiceId: 'invoice-created',
        receivablePositionId: 'position-created',
        outstandingAmountMinor: 10000,
        currency: 'VND',
        issueDate: '2026-09-30',
        createdAt: '2026-09-30T00:00:00.000Z',
      }],
    });
    const service = new SemanticReceivableChargeService(gateway);

    await expect(service.allocateConfirmedPaymentToReceivables({
      tenantId,
      paymentSourceType: 'REVENUE',
      paymentSourceId: 'revenue-1',
      amountMinor: 60000,
      currency: 'VND',
      paymentMethod: 'bank_transfer',
      receivedAt: '2026-09-30',
      idempotencyKey: 'manual-payment:key-1',
      description: 'Confirmed Haircut remaining payment',
      receivableMatch: {
        bookingId: 'booking-1',
      },
    })).rejects.toMatchObject<Partial<FinanceSemanticReceivableChargeError>>({
      code: 'BLOCKED_BY_RECEIVABLE_RESOLUTION_GAP',
    });
    expect(gateway.calls.postCashReceipt).toHaveLength(0);
  });

  test('uses cross-vertical Finance semantics instead of Education-specific revenue semantics', () => {
    expect(FINANCE_RECEIVABLE_SEMANTICS.SERVICE_RECEIVABLE_RECOGNIZED).toBe('SERVICE_RECEIVABLE_RECOGNIZED');
    expect(FINANCE_RECEIVABLE_SEMANTICS.TRADE_RECEIVABLE).toBe('TRADE_RECEIVABLE');
    expect(FINANCE_RECEIVABLE_SEMANTICS.SERVICE_REVENUE).toBe('SERVICE_REVENUE');
    expect(Object.values(FINANCE_RECEIVABLE_SEMANTICS)).not.toContain('EDUCATION_SERVICE_REVENUE');
    expect(Object.values(FINANCE_RECEIVABLE_SEMANTICS)).not.toContain('CUSTOMER_RECEIVABLE');
  });
});
