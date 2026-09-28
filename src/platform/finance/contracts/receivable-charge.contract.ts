import type { CurrencyCode } from '../shared-kernel/types';

export const FINANCE_RECEIVABLE_SEMANTICS = {
  TUITION_SERVICE_RECOGNIZED: 'TUITION_SERVICE_RECOGNIZED',
  TRADE_RECEIVABLE: 'TRADE_RECEIVABLE',
  SERVICE_REVENUE: 'SERVICE_REVENUE',
} as const;

export type TuitionServiceRecognizedSemantic =
  typeof FINANCE_RECEIVABLE_SEMANTICS.TUITION_SERVICE_RECOGNIZED;

export interface AccountingPolicyEvidence {
  readonly legalSource: '99/2025/TT-BTC';
  readonly effectiveFrom: '2026-01-01';
  readonly applicableRegime: 'VI_TT99_2025';
  readonly businessSemantic: TuitionServiceRecognizedSemantic;
  readonly verificationStatus: 'PROVEN';
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

export interface ISemanticReceivableChargeContract {
  recognizeTuitionServiceReceivable(
    input: TuitionServiceRecognizedChargeInput,
  ): Promise<SemanticReceivableChargeResult>;
}
