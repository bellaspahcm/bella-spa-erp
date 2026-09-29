import { createHash } from 'crypto';
import {
  FINANCE_RECEIVABLE_SEMANTICS,
  ISemanticReceivableChargeContract,
  PaymentReceivableAllocationInput,
  PaymentReceivableAllocationResult,
  SemanticReceivableChargeResult,
  ServiceReceivableChargeInput,
  TuitionServiceRecognizedChargeInput,
} from '../contracts/receivable-charge.contract';

export interface FinanceSemanticAccountMapping {
  readonly semanticKey: string;
  readonly accountCode: string;
  readonly authorityVersion: string;
}

export interface FinanceInvoiceSnapshot {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly status: string;
  readonly postingAttemptId: string;
  readonly f1TransactionId: string | null;
}

export interface FinanceChargeReadModel {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly transactionId: string;
  readonly receivableLedgerEntryCount: number;
  readonly receivablePositionId: string;
  readonly transactionLineCount: number;
}

export interface FinanceReceivableChargeGateway {
  resolveSemanticAccount(input: {
    readonly tenantId: string;
    readonly semanticKey: string;
    readonly asOf: string;
  }): Promise<FinanceSemanticAccountMapping | null>;
  findInvoiceByNumber(input: {
    readonly tenantId: string;
    readonly invoiceNumber: string;
  }): Promise<FinanceInvoiceSnapshot | null>;
  createDraftInvoice(input: {
    readonly tenantId: string;
    readonly customerId: string;
    readonly invoiceNumber: string;
    readonly currency: string;
    readonly issueDate: string;
    readonly dueDate: string;
  }): Promise<string>;
  saveInvoiceMetadata(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly metadata: FinanceReceivableChargeMetadata;
  }): Promise<void>;
  invoiceHasLines(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
  }): Promise<boolean>;
  addInvoiceLine(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly serviceId: string;
    readonly description: string;
    readonly quantity: number;
    readonly unitPriceMinor: number;
    readonly taxRate: number;
    readonly revenueAccountCode: string;
  }): Promise<string>;
  finalizeInvoice(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly lines: readonly FinancePostingLine[];
  }): Promise<{ readonly transactionId: string; readonly duplicate: boolean }>;
  readCharge(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
  }): Promise<FinanceChargeReadModel>;
  allocatePayment(input: PaymentReceivableAllocationInput): Promise<PaymentReceivableAllocationResult>;
}

export interface FinancePostingLine {
  readonly account_code: string;
  readonly debit_functional_amount: number;
  readonly credit_functional_amount: number;
  readonly debit_amount_minor: number;
  readonly credit_amount_minor: number;
  readonly debit_currency: string;
  readonly credit_currency: string;
  readonly debit_functional_currency: string;
  readonly credit_functional_currency: string;
  readonly memo: string;
}

export interface FinanceReceivableChargeMetadata {
  readonly [key: string]: string | number | boolean | null | undefined;
  readonly business_semantic:
    | typeof FINANCE_RECEIVABLE_SEMANTICS.SERVICE_RECEIVABLE_RECOGNIZED
    | typeof FINANCE_RECEIVABLE_SEMANTICS.TUITION_SERVICE_RECOGNIZED;
  readonly business_source_type: string;
  readonly business_source_id: string;
  readonly customer_id: string;
  readonly student_party_id?: string;
  readonly service_period_start: string;
  readonly service_period_end: string;
  readonly recognition_date: string;
  readonly legal_source: '99/2025/TT-BTC';
  readonly effective_from: '2026-01-01';
  readonly applicable_regime: 'VI_TT99_2025';
  readonly verification_status: 'PROVEN';
}

export class FinanceSemanticReceivableChargeError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_SERVICE_RECEIVABLE_INPUT'
      | 'INVALID_TUITION_SERVICE_RECOGNIZED_INPUT'
      | 'INVALID_PAYMENT_RECEIVABLE_ALLOCATION_INPUT'
      | 'BLOCKED_BY_TT99_ACCOUNT_RESOLUTION_GAP'
      | 'BLOCKED_BY_COUNTERPARTY_CONTRACT',
    message: string,
  ) {
    super(message);
    this.name = 'FinanceSemanticReceivableChargeError';
  }
}

export class SemanticReceivableChargeService implements ISemanticReceivableChargeContract {
  constructor(private readonly gateway: FinanceReceivableChargeGateway) {}

  async recognizeServiceReceivable(
    input: ServiceReceivableChargeInput,
  ): Promise<SemanticReceivableChargeResult> {
    this.assertValidServiceInput(input);

    const invoiceNumber = this.buildInvoiceNumber(input);
    const existing = await this.gateway.findInvoiceByNumber({
      tenantId: input.tenantId,
      invoiceNumber,
    });

    const receivable = await this.resolveRequiredAccount(
      input,
      FINANCE_RECEIVABLE_SEMANTICS.TRADE_RECEIVABLE,
    );
    const revenue = await this.resolveRequiredAccount(
      input,
      FINANCE_RECEIVABLE_SEMANTICS.SERVICE_REVENUE,
    );

    if (existing?.status === 'FINALIZED') {
      const readModel = await this.gateway.readCharge({
        tenantId: input.tenantId,
        invoiceId: existing.id,
      });
      return this.toResult(readModel, true, this.resolveBusinessSemantic(input));
    }

    const invoiceId = existing?.id ?? await this.gateway.createDraftInvoice({
      tenantId: input.tenantId,
      customerId: input.customerId,
      invoiceNumber,
      currency: input.currency,
      issueDate: input.recognitionDate,
      dueDate: input.dueDate,
    });

    const invoice = existing ?? await this.requireInvoice(input.tenantId, invoiceNumber);

    await this.gateway.saveInvoiceMetadata({
      tenantId: input.tenantId,
      invoiceId,
      metadata: this.buildMetadata(input),
    });

    const hasLines = await this.gateway.invoiceHasLines({
      tenantId: input.tenantId,
      invoiceId,
    });

    if (!hasLines) {
      await this.gateway.addInvoiceLine({
        tenantId: input.tenantId,
        invoiceId,
        serviceId: input.businessSourceId,
        description: input.description,
        quantity: 1,
        unitPriceMinor: input.amountMinor,
        taxRate: 0,
        revenueAccountCode: revenue.accountCode,
      });
    }

    const postingLines = this.buildPostingLines(input, receivable.accountCode, revenue.accountCode);
    const requestHash = createHash('sha256')
      .update(JSON.stringify(postingLines) + invoice.postingAttemptId)
      .digest('hex');

    const finalize = await this.gateway.finalizeInvoice({
      tenantId: input.tenantId,
      invoiceId,
      idempotencyKey: invoice.postingAttemptId,
      requestHash,
      lines: postingLines,
    });

    const readModel = await this.gateway.readCharge({
      tenantId: input.tenantId,
      invoiceId,
    });

    return this.toResult(
      {
        ...readModel,
        transactionId: finalize.transactionId,
      },
      finalize.duplicate,
      this.resolveBusinessSemantic(input),
    );
  }

  async recognizeTuitionServiceReceivable(
    input: TuitionServiceRecognizedChargeInput,
  ): Promise<SemanticReceivableChargeResult> {
    return this.recognizeServiceReceivable({
      tenantId: input.tenantId,
      customerId: input.studentPartyId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      servicePeriodStart: input.servicePeriodStart,
      servicePeriodEnd: input.servicePeriodEnd,
      recognitionDate: input.recognitionDate,
      dueDate: input.dueDate,
      businessSourceType: input.businessSourceType,
      businessSourceId: input.businessSourceId,
      description: input.description,
      businessSemantic: FINANCE_RECEIVABLE_SEMANTICS.TUITION_SERVICE_RECOGNIZED,
      metadata: {
        student_party_id: input.studentPartyId,
      },
    });
  }

  async allocatePaymentToReceivable(
    input: PaymentReceivableAllocationInput,
  ): Promise<PaymentReceivableAllocationResult> {
    this.assertValidAllocationInput(input);
    return this.gateway.allocatePayment(input);
  }

  private assertValidServiceInput(input: ServiceReceivableChargeInput): void {
    const required = [
      input.tenantId,
      input.customerId,
      input.currency,
      input.servicePeriodStart,
      input.servicePeriodEnd,
      input.recognitionDate,
      input.dueDate,
      input.businessSourceType,
      input.businessSourceId,
      input.description,
    ];

    if (required.some((value) => value.trim() === '') || input.amountMinor <= 0) {
      throw new FinanceSemanticReceivableChargeError(
        'INVALID_SERVICE_RECEIVABLE_INPUT',
        'SERVICE_RECEIVABLE_RECOGNIZED requires tenant, customer, source, service period, dates, currency, description, and a positive amount.',
      );
    }
  }

  private assertValidAllocationInput(input: PaymentReceivableAllocationInput): void {
    const required = [
      input.tenantId,
      input.invoiceId,
      input.cashMovementId,
      input.rateSource,
      input.rateTimestamp,
    ];

    if (
      required.some((value) => value.trim() === '')
      || input.allocatedAmountMinor <= 0
      || input.exchangeRate <= 0
    ) {
      throw new FinanceSemanticReceivableChargeError(
        'INVALID_PAYMENT_RECEIVABLE_ALLOCATION_INPUT',
        'Payment allocation requires tenant, invoice, cash movement, positive amount, positive exchange rate, rate source, and timestamp.',
      );
    }
  }

  private async resolveRequiredAccount(
    input: ServiceReceivableChargeInput,
    semanticKey: string,
  ): Promise<FinanceSemanticAccountMapping> {
    const mapping = await this.gateway.resolveSemanticAccount({
      tenantId: input.tenantId,
      semanticKey,
      asOf: input.recognitionDate,
    });

    if (!mapping || !this.isProvenTt99Authority(mapping.authorityVersion)) {
      throw new FinanceSemanticReceivableChargeError(
        'BLOCKED_BY_TT99_ACCOUNT_RESOLUTION_GAP',
        `Missing proven TT99 account mapping for ${semanticKey}.`,
      );
    }

    return mapping;
  }

  private isProvenTt99Authority(authorityVersion: string): boolean {
    return authorityVersion.includes('99/2025/TT-BTC')
      && authorityVersion.includes('VI_TT99_2025')
      && authorityVersion.includes('PROVEN');
  }

  private async requireInvoice(tenantId: string, invoiceNumber: string): Promise<FinanceInvoiceSnapshot> {
    const invoice = await this.gateway.findInvoiceByNumber({ tenantId, invoiceNumber });
    if (!invoice) {
      throw new FinanceSemanticReceivableChargeError(
        'INVALID_SERVICE_RECEIVABLE_INPUT',
        'Finance invoice was not readable after draft creation.',
      );
    }
    return invoice;
  }

  private buildInvoiceNumber(input: ServiceReceivableChargeInput): string {
    const key = [
      input.tenantId,
      this.resolveBusinessSemantic(input),
      input.businessSourceType,
      input.businessSourceId,
      input.servicePeriodStart,
      input.servicePeriodEnd,
      input.recognitionDate,
    ].join('|');
    return `FRC-${createHash('sha256').update(key).digest('hex').slice(0, 28).toUpperCase()}`;
  }

  private buildMetadata(input: ServiceReceivableChargeInput): FinanceReceivableChargeMetadata {
    return {
      ...input.metadata,
      business_semantic: this.resolveBusinessSemantic(input),
      business_source_type: input.businessSourceType,
      business_source_id: input.businessSourceId,
      customer_id: input.customerId,
      service_period_start: input.servicePeriodStart,
      service_period_end: input.servicePeriodEnd,
      recognition_date: input.recognitionDate,
      legal_source: '99/2025/TT-BTC',
      effective_from: '2026-01-01',
      applicable_regime: 'VI_TT99_2025',
      verification_status: 'PROVEN',
    };
  }

  private buildPostingLines(
    input: ServiceReceivableChargeInput,
    receivableAccountCode: string,
    revenueAccountCode: string,
  ): readonly FinancePostingLine[] {
    const base = {
      debit_currency: input.currency,
      credit_currency: input.currency,
      debit_functional_currency: input.currency,
      credit_functional_currency: input.currency,
    };

    return [
      {
        ...base,
        account_code: receivableAccountCode,
        debit_functional_amount: input.amountMinor,
        credit_functional_amount: 0,
        debit_amount_minor: input.amountMinor,
        credit_amount_minor: 0,
        memo: 'Recognize service receivable',
      },
      {
        ...base,
        account_code: revenueAccountCode,
        debit_functional_amount: 0,
        credit_functional_amount: input.amountMinor,
        debit_amount_minor: 0,
        credit_amount_minor: input.amountMinor,
        memo: 'Recognize service revenue',
      },
    ];
  }

  private resolveBusinessSemantic(input: ServiceReceivableChargeInput) {
    return input.businessSemantic ?? FINANCE_RECEIVABLE_SEMANTICS.SERVICE_RECEIVABLE_RECOGNIZED;
  }

  private toResult(
    readModel: FinanceChargeReadModel,
    duplicate: boolean,
    businessSemantic:
      | typeof FINANCE_RECEIVABLE_SEMANTICS.SERVICE_RECEIVABLE_RECOGNIZED
      | typeof FINANCE_RECEIVABLE_SEMANTICS.TUITION_SERVICE_RECOGNIZED,
  ): SemanticReceivableChargeResult {
    return {
      invoiceId: readModel.invoiceId,
      invoiceNumber: readModel.invoiceNumber,
      transactionId: readModel.transactionId,
      receivableLedgerEntryCount: readModel.receivableLedgerEntryCount,
      receivablePositionId: readModel.receivablePositionId,
      transactionLineCount: readModel.transactionLineCount,
      duplicate,
      policyEvidence: {
        legalSource: '99/2025/TT-BTC',
        effectiveFrom: '2026-01-01',
        applicableRegime: 'VI_TT99_2025',
        businessSemantic,
        verificationStatus: 'PROVEN',
      },
    };
  }
}
