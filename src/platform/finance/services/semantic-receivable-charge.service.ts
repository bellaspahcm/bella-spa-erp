import { createHash } from 'crypto';
import {
  FINANCE_RECEIVABLE_SEMANTICS,
  ISemanticReceivableChargeContract,
  SemanticReceivableChargeResult,
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
  readonly business_semantic: typeof FINANCE_RECEIVABLE_SEMANTICS.TUITION_SERVICE_RECOGNIZED;
  readonly business_source_type: string;
  readonly business_source_id: string;
  readonly student_party_id: string;
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
      | 'INVALID_TUITION_SERVICE_RECOGNIZED_INPUT'
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

  async recognizeTuitionServiceReceivable(
    input: TuitionServiceRecognizedChargeInput,
  ): Promise<SemanticReceivableChargeResult> {
    this.assertValidInput(input);

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
      return this.toResult(readModel, true);
    }

    const invoiceId = existing?.id ?? await this.gateway.createDraftInvoice({
      tenantId: input.tenantId,
      customerId: input.studentPartyId,
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
    );
  }

  private assertValidInput(input: TuitionServiceRecognizedChargeInput): void {
    const required = [
      input.tenantId,
      input.studentPartyId,
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
        'INVALID_TUITION_SERVICE_RECOGNIZED_INPUT',
        'TUITION_SERVICE_RECOGNIZED requires tenant, student party, source, service period, dates, currency, description, and a positive amount.',
      );
    }
  }

  private async resolveRequiredAccount(
    input: TuitionServiceRecognizedChargeInput,
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
        'INVALID_TUITION_SERVICE_RECOGNIZED_INPUT',
        'Finance invoice was not readable after draft creation.',
      );
    }
    return invoice;
  }

  private buildInvoiceNumber(input: TuitionServiceRecognizedChargeInput): string {
    const key = [
      input.tenantId,
      FINANCE_RECEIVABLE_SEMANTICS.TUITION_SERVICE_RECOGNIZED,
      input.businessSourceType,
      input.businessSourceId,
      input.servicePeriodStart,
      input.servicePeriodEnd,
      input.recognitionDate,
    ].join('|');
    return `FRC-${createHash('sha256').update(key).digest('hex').slice(0, 28).toUpperCase()}`;
  }

  private buildMetadata(input: TuitionServiceRecognizedChargeInput): FinanceReceivableChargeMetadata {
    return {
      business_semantic: FINANCE_RECEIVABLE_SEMANTICS.TUITION_SERVICE_RECOGNIZED,
      business_source_type: input.businessSourceType,
      business_source_id: input.businessSourceId,
      student_party_id: input.studentPartyId,
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
    input: TuitionServiceRecognizedChargeInput,
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
        memo: 'Recognize tuition service receivable',
      },
      {
        ...base,
        account_code: revenueAccountCode,
        debit_functional_amount: 0,
        credit_functional_amount: input.amountMinor,
        debit_amount_minor: 0,
        credit_amount_minor: input.amountMinor,
        memo: 'Recognize tuition service revenue',
      },
    ];
  }

  private toResult(readModel: FinanceChargeReadModel, duplicate: boolean): SemanticReceivableChargeResult {
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
        businessSemantic: FINANCE_RECEIVABLE_SEMANTICS.TUITION_SERVICE_RECOGNIZED,
        verificationStatus: 'PROVEN',
      },
    };
  }
}
