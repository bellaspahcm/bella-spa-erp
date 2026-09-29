import type { CurrencyCode } from '../shared-kernel/types';

export const FINANCE_RECEIVABLE_SEMANTICS = {
  SERVICE_RECEIVABLE_RECOGNIZED: 'SERVICE_RECEIVABLE_RECOGNIZED',
  TUITION_SERVICE_RECOGNIZED: 'TUITION_SERVICE_RECOGNIZED',
  TRADE_RECEIVABLE: 'TRADE_RECEIVABLE',
  SERVICE_REVENUE: 'SERVICE_REVENUE',
} as const;

export type ServiceReceivableRecognizedSemantic =
  typeof FINANCE_RECEIVABLE_SEMANTICS.SERVICE_RECEIVABLE_RECOGNIZED;

export type TuitionServiceRecognizedSemantic =
  typeof FINANCE_RECEIVABLE_SEMANTICS.TUITION_SERVICE_RECOGNIZED;

export interface AccountingPolicyEvidence {
  readonly legalSource: '99/2025/TT-BTC';
  readonly effectiveFrom: '2026-01-01';
  readonly applicableRegime: 'VI_TT99_2025';
  readonly businessSemantic: ServiceReceivableRecognizedSemantic | TuitionServiceRecognizedSemantic;
  readonly verificationStatus: 'PROVEN';
}

export interface ServiceReceivableChargeInput {
  readonly tenantId: string;
  readonly customerId: string;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly servicePeriodStart: string;
  readonly servicePeriodEnd: string;
  readonly recognitionDate: string;
  readonly dueDate: string;
  readonly businessSourceType: string;
  readonly businessSourceId: string;
  readonly description: string;
  readonly businessSemantic?: ServiceReceivableRecognizedSemantic | TuitionServiceRecognizedSemantic;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface TuitionServiceRecognizedChargeInput {
  readonly tenantId: string;
  readonly studentPartyId: string;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly servicePeriodStart: string;
  readonly servicePeriodEnd: string;
  readonly recognitionDate: string;
  readonly dueDate: string;
  readonly businessSourceType: string;
  readonly businessSourceId: string;
  readonly description: string;
}

export interface SemanticReceivableChargeResult {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly transactionId: string;
  readonly receivableLedgerEntryCount: number;
  readonly receivablePositionId: string;
  readonly transactionLineCount: number;
  readonly duplicate: boolean;
  readonly policyEvidence: AccountingPolicyEvidence;
}

export interface PaymentReceivableAllocationInput {
  readonly tenantId: string;
  readonly invoiceId: string;
  readonly cashMovementId: string;
  readonly allocatedAmountMinor: number;
  readonly exchangeRate: number;
  readonly rateSource: string;
  readonly rateTimestamp: string;
}

export interface PaymentReceivableAllocationResult {
  readonly allocationId: string;
}

export interface ISemanticReceivableChargeContract {
  recognizeServiceReceivable(
    input: ServiceReceivableChargeInput,
  ): Promise<SemanticReceivableChargeResult>;

  recognizeTuitionServiceReceivable(
    input: TuitionServiceRecognizedChargeInput,
  ): Promise<SemanticReceivableChargeResult>;

  allocatePaymentToReceivable(
    input: PaymentReceivableAllocationInput,
  ): Promise<PaymentReceivableAllocationResult>;
}
