import type {
  ISemanticReceivableChargeContract,
  SemanticReceivableChargeResult,
} from '@/platform/finance/contracts';
import { PreschoolFinanceRepository } from '../repositories/preschool-finance.repository';
import type {
  BillingPeriod,
  Invoice,
  InvoiceLineItem,
  TuitionRecognitionPolicy,
  TuitionServicePeriodCompletion,
} from '../domain/finance.types';

export interface TuitionRecognitionRepository {
  getInvoiceById(tenantId: string, invoiceId: string): Promise<Invoice | null>;
  getBillingPeriodById(tenantId: string, billingPeriodId: string): Promise<BillingPeriod | null>;
  getTuitionServicePeriodCompletion(
    tenantId: string,
    billingPeriodId: string,
  ): Promise<TuitionServicePeriodCompletion | null>;
  listActiveTuitionRecognitionPoliciesAsOf(
    tenantId: string,
    asOfDate: string,
  ): Promise<TuitionRecognitionPolicy[]>;
}

export interface RecognizeCompletedTuitionPeriodInput {
  readonly tenantId: string;
  readonly invoiceId: string;
}

export class TuitionRecognitionService {
  constructor(
    private readonly receivableChargeService: ISemanticReceivableChargeContract,
    private readonly repo: TuitionRecognitionRepository = new PreschoolFinanceRepository(),
  ) {}

  async recognizeCompletedPeriodTuition(
    input: RecognizeCompletedTuitionPeriodInput,
  ): Promise<SemanticReceivableChargeResult> {
    const invoice = await this.requireInvoice(input.tenantId, input.invoiceId);
    this.assertCanonicalStudent(invoice);

    const billingPeriod = await this.requireBillingPeriod(invoice);
    const completion = await this.requireCompletionEvidence(invoice);
    const recognitionDate = this.toDateOnly(completion.completedAt);
    const policy = await this.resolveRequiredPolicy(invoice.tenantId, recognitionDate);
    this.assertPeriodCompletionPolicy(policy);

    const tuitionAmount = this.resolveTuitionOnlyAmount(invoice);

    return this.receivableChargeService.recognizeTuitionServiceReceivable({
      tenantId: invoice.tenantId,
      studentPartyId: invoice.studentPartyId,
      amountMinor: tuitionAmount,
      currency: 'VND',
      servicePeriodStart: billingPeriod.startDate,
      servicePeriodEnd: billingPeriod.endDate,
      recognitionDate,
      dueDate: invoice.dueDate,
      businessSourceType: 'PRESCHOOL_P7_TUITION_PERIOD_COMPLETION',
      businessSourceId: this.buildBusinessSourceId(invoice, completion),
      description: `Preschool tuition recognized after service period completion ${billingPeriod.periodName}`,
    });
  }

  private async requireInvoice(tenantId: string, invoiceId: string): Promise<Invoice> {
    const invoice = await this.repo.getInvoiceById(tenantId, invoiceId);
    if (!invoice) {
      throw new Error(`PRESCHOOL_TUITION_RECOGNITION_INVOICE_NOT_FOUND: Invoice ${invoiceId} not found.`);
    }
    return invoice;
  }

  private assertCanonicalStudent(invoice: Invoice): void {
    if (!invoice.studentPartyId) {
      throw new Error(`PRESCHOOL_TUITION_RECOGNITION_STUDENT_PARTY_REQUIRED: Invoice ${invoice.id} is missing canonical studentPartyId.`);
    }
  }

  private async requireBillingPeriod(invoice: Invoice): Promise<BillingPeriod> {
    const billingPeriod = await this.repo.getBillingPeriodById(invoice.tenantId, invoice.billingPeriodId);
    if (!billingPeriod) {
      throw new Error(`PRESCHOOL_TUITION_RECOGNITION_BILLING_PERIOD_NOT_FOUND: Billing period ${invoice.billingPeriodId} not found.`);
    }
    return billingPeriod;
  }

  private async requireCompletionEvidence(invoice: Invoice): Promise<TuitionServicePeriodCompletion> {
    const completion = await this.repo.getTuitionServicePeriodCompletion(invoice.tenantId, invoice.billingPeriodId);
    if (!completion) {
      throw new Error(`PRESCHOOL_TUITION_SERVICE_PERIOD_COMPLETION_REQUIRED: Billing period ${invoice.billingPeriodId} has no completion evidence.`);
    }
    return completion;
  }

  private async resolveRequiredPolicy(tenantId: string, recognitionDate: string): Promise<TuitionRecognitionPolicy> {
    const policies = await this.repo.listActiveTuitionRecognitionPoliciesAsOf(tenantId, recognitionDate);
    if (policies.length === 0) {
      throw new Error(`PRESCHOOL_TUITION_RECOGNITION_POLICY_REQUIRED: No active tuition recognition policy for ${recognitionDate}.`);
    }
    if (policies.length > 1) {
      throw new Error(`PRESCHOOL_TUITION_RECOGNITION_POLICY_AMBIGUOUS: Multiple active tuition recognition policies for ${recognitionDate}.`);
    }
    return policies[0];
  }

  private assertPeriodCompletionPolicy(policy: TuitionRecognitionPolicy): void {
    if (policy.policyType !== 'PERIOD_COMPLETION') {
      throw new Error(`PRESCHOOL_TUITION_RECOGNITION_POLICY_UNSUPPORTED: ${policy.policyType} execution is not implemented.`);
    }
  }

  private resolveTuitionOnlyAmount(invoice: Invoice): number {
    const lineItems = invoice.lineItems ?? [];
    const unsupported = lineItems.filter((item) => item.itemType !== 'TUITION');
    if (unsupported.length > 0) {
      throw new Error(`PRESCHOOL_TUITION_RECOGNITION_AMOUNT_NOT_PROVEN: Invoice ${invoice.id} contains non-tuition line items.`);
    }

    const tuitionAmount = lineItems
      .filter((item): item is InvoiceLineItem & { subtotalAmount: number } => item.itemType === 'TUITION')
      .reduce((sum, item) => sum + item.subtotalAmount, 0);

    if (!Number.isFinite(tuitionAmount) || tuitionAmount <= 0) {
      throw new Error(`PRESCHOOL_TUITION_RECOGNITION_AMOUNT_NOT_PROVEN: Invoice ${invoice.id} has no positive tuition amount.`);
    }

    const wholeMinorUnits = Math.round(tuitionAmount);
    if (Math.abs(wholeMinorUnits - tuitionAmount) > Number.EPSILON) {
      throw new Error(`PRESCHOOL_TUITION_RECOGNITION_AMOUNT_NOT_PROVEN: Invoice ${invoice.id} tuition amount must be whole VND minor units.`);
    }

    return wholeMinorUnits;
  }

  private buildBusinessSourceId(invoice: Invoice, completion: TuitionServicePeriodCompletion): string {
    return [
      invoice.tenantId,
      invoice.studentPartyId,
      invoice.billingPeriodId,
      completion.id,
      invoice.id,
    ].join(':');
  }

  private toDateOnly(value: string): string {
    return value.slice(0, 10);
  }
}
