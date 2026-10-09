/**
 * Bella Hospitality Phase 4 - Folio + Payment types.
 *
 * Scope: product-owned folio semantics and opaque Finance contract links.
 */

import type {
  ConfirmedPaymentReceivableAllocationResult,
  SemanticReceivableChargeResult,
  ServiceReceivableChargeInput,
} from '@/platform/finance/contracts';

export type HospitalityFolioCurrency = ServiceReceivableChargeInput['currency'];
export type HospitalityFolioStatus = 'open' | 'settled' | 'closed';
export type HospitalityFolioItemType = 'room_charge';
export type HospitalityFolioItemStatus = 'posted';
export type HospitalityFolioFinanceLinkStatus = 'recognized';
export type HospitalityFolioPaymentApplicationStatus = 'applied';

export interface HospitalityFolio {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly stayId: string;
  readonly guestId: string;
  readonly status: HospitalityFolioStatus;
  readonly currency: HospitalityFolioCurrency;
  readonly subtotalAmountMinor: number;
  readonly paidAmountMinor: number;
  readonly outstandingAmountMinor: number;
  readonly openedAt: string;
  readonly settledAt: string | null;
  readonly closedAt: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HospitalityFolioItem {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly folioId: string;
  readonly stayId: string;
  readonly itemType: HospitalityFolioItemType;
  readonly description: string;
  readonly quantity: number;
  readonly unitAmountMinor: number;
  readonly amountMinor: number;
  readonly currency: HospitalityFolioCurrency;
  readonly servicePeriodStart: string;
  readonly servicePeriodEnd: string;
  readonly recognitionDate: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly status: HospitalityFolioItemStatus;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HospitalityFolioFinanceLink {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly folioId: string;
  readonly folioItemId: string;
  readonly financeInvoiceId: string;
  readonly financeInvoiceNumber: string;
  readonly financeTransactionId: string;
  readonly financeReceivablePositionId: string;
  readonly status: HospitalityFolioFinanceLinkStatus;
  readonly policyEvidence: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface HospitalityFolioPaymentApplication {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly folioId: string;
  readonly financeInvoiceId: string;
  readonly paymentSourceType: string;
  readonly paymentSourceId: string;
  readonly financeTransactionId: string;
  readonly financeCashMovementId: string;
  readonly financeAllocationId: string;
  readonly amountMinor: number;
  readonly currency: HospitalityFolioCurrency;
  readonly paymentMethod: string;
  readonly receivedAt: string;
  readonly idempotencyKey: string;
  readonly status: HospitalityFolioPaymentApplicationStatus;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface HospitalityFolioContext {
  readonly folio: HospitalityFolio;
  readonly guestPartyId: string;
}

export interface OpenFolioInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly stayId: string;
  readonly guestId: string;
  readonly currency?: HospitalityFolioCurrency;
  readonly openedAt?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateFolioItemInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly folioId: string;
  readonly stayId: string;
  readonly itemType?: HospitalityFolioItemType;
  readonly description: string;
  readonly quantity?: number;
  readonly unitAmountMinor: number;
  readonly amountMinor: number;
  readonly currency: HospitalityFolioCurrency;
  readonly servicePeriodStart: string;
  readonly servicePeriodEnd: string;
  readonly recognitionDate: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly metadata?: Record<string, unknown>;
}

export interface PostRoomChargeInput {
  readonly tenantId: string;
  readonly folioId: string;
  readonly amountMinor: number;
  readonly currency: HospitalityFolioCurrency;
  readonly servicePeriodStart: string;
  readonly servicePeriodEnd: string;
  readonly recognitionDate: string;
  readonly dueDate: string;
  readonly description: string;
  readonly metadata?: Record<string, unknown>;
}

export interface RecordReceivableRecognitionInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly folioId: string;
  readonly folioItemId: string;
  readonly amountMinor: number;
  readonly financeResult: SemanticReceivableChargeResult;
  readonly metadata?: Record<string, unknown>;
}

export interface HospitalityFolioChargePosting {
  readonly folio: HospitalityFolio;
  readonly item: HospitalityFolioItem;
  readonly financeLink: HospitalityFolioFinanceLink;
  readonly financeResult: SemanticReceivableChargeResult;
}

export interface ApplyFolioPaymentInput {
  readonly tenantId: string;
  readonly folioId: string;
  readonly amountMinor: number;
  readonly currency: HospitalityFolioCurrency;
  readonly paymentMethod: string;
  readonly receivedAt: string;
  readonly idempotencyKey: string;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface RecordPaymentApplicationInput {
  readonly tenantId: string;
  readonly propertyId: string;
  readonly folioId: string;
  readonly financeInvoiceId: string;
  readonly paymentSourceType: string;
  readonly paymentSourceId: string;
  readonly financeTransactionId: string;
  readonly financeCashMovementId: string;
  readonly financeAllocationId: string;
  readonly amountMinor: number;
  readonly currency: HospitalityFolioCurrency;
  readonly paymentMethod: string;
  readonly receivedAt: string;
  readonly idempotencyKey: string;
  readonly metadata?: Record<string, unknown>;
}

export interface HospitalityFolioPaymentResult {
  readonly folio: HospitalityFolio;
  readonly application: HospitalityFolioPaymentApplication;
  readonly financeResult: ConfirmedPaymentReceivableAllocationResult;
}

export interface CloseFolioInput {
  readonly tenantId: string;
  readonly folioId: string;
  readonly closedAt?: string;
}
