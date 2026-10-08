/**
 * Bella Hospitality Phase 4 - Folio + Payment service.
 *
 * Hospitality owns folio semantics. Finance owns receivable recognition and
 * payment allocation primitives through `ISemanticReceivableChargeContract`.
 */

import {
  FINANCE_RECEIVABLE_SEMANTICS,
  type ConfirmedPaymentReceivableAllocationLine,
  type ISemanticReceivableChargeContract,
} from '@/platform/finance/contracts';
import type { HospitalityFolioPaymentRepositoryPort } from '../repositories/folio-payment.repository';
import type {
  ApplyFolioPaymentInput,
  CloseFolioInput,
  HospitalityFolio,
  HospitalityFolioChargePosting,
  HospitalityFolioFinanceLink,
  HospitalityFolioPaymentResult,
  OpenFolioInput,
  PostRoomChargeInput,
} from '../types/folio-payment.types';

const ROOM_CHARGE_SOURCE_TYPE = 'HOSPITALITY_STAY_ROOM_CHARGE';
const FOLIO_ITEM_FINANCE_SOURCE_TYPE = 'HOSPITALITY_FOLIO_ITEM';
const FOLIO_PAYMENT_SOURCE_TYPE = 'HOSPITALITY_FOLIO_PAYMENT_APPLICATION';

function assertNonEmpty(label: string, value: string): void {
  if (!value.trim()) {
    throw new Error(`${label} is required`);
  }
}

function assertPositiveInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertDate(label: string, value: string): void {
  assertNonEmpty(label, value);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid ISO date`);
  }
}

function assertTimestamp(label: string, value: string | undefined): void {
  if (!value) return;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid timestamp`);
  }
}

function toFinanceMetadata(metadata: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (
      typeof value === 'string'
      || typeof value === 'number'
      || typeof value === 'boolean'
      || value === null
    ) {
      result[key] = value;
    }
  }
  return result;
}

export class HospitalityFolioPaymentService {
  constructor(
    private readonly repository: HospitalityFolioPaymentRepositoryPort,
    private readonly finance: ISemanticReceivableChargeContract,
  ) {}

  async openFolio(input: OpenFolioInput): Promise<HospitalityFolio> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('propertyId', input.propertyId);
    assertNonEmpty('stayId', input.stayId);
    assertNonEmpty('guestId', input.guestId);
    assertTimestamp('openedAt', input.openedAt);

    return this.repository.createFolio(input);
  }

  async postRoomCharge(input: PostRoomChargeInput): Promise<HospitalityFolioChargePosting> {
    this.assertRoomChargeInput(input);

    const context = await this.requireOpenFolio(input.tenantId, input.folioId);
    const item = await this.repository.createFolioItem({
      tenantId: input.tenantId,
      propertyId: context.folio.propertyId,
      folioId: input.folioId,
      stayId: context.folio.stayId,
      itemType: 'room_charge',
      description: input.description,
      quantity: 1,
      unitAmountMinor: input.amountMinor,
      amountMinor: input.amountMinor,
      currency: input.currency,
      servicePeriodStart: input.servicePeriodStart,
      servicePeriodEnd: input.servicePeriodEnd,
      recognitionDate: input.recognitionDate,
      sourceType: ROOM_CHARGE_SOURCE_TYPE,
      sourceId: context.folio.stayId,
      metadata: input.metadata,
    });

    const financeResult = await this.finance.recognizeServiceReceivable({
      tenantId: input.tenantId,
      customerId: context.guestPartyId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      servicePeriodStart: input.servicePeriodStart,
      servicePeriodEnd: input.servicePeriodEnd,
      recognitionDate: input.recognitionDate,
      dueDate: input.dueDate,
      businessSourceType: FOLIO_ITEM_FINANCE_SOURCE_TYPE,
      businessSourceId: item.id,
      description: input.description,
      businessSemantic: FINANCE_RECEIVABLE_SEMANTICS.SERVICE_RECEIVABLE_RECOGNIZED,
      metadata: toFinanceMetadata({
        property_id: context.folio.propertyId,
        stay_id: context.folio.stayId,
        folio_id: context.folio.id,
        folio_item_id: item.id,
        ...input.metadata,
      }),
    });

    const recognition = await this.repository.recordReceivableRecognition({
      tenantId: input.tenantId,
      propertyId: context.folio.propertyId,
      folioId: input.folioId,
      folioItemId: item.id,
      amountMinor: input.amountMinor,
      financeResult,
      metadata: {
        businessSourceType: FOLIO_ITEM_FINANCE_SOURCE_TYPE,
        businessSourceId: item.id,
      },
    });

    return {
      folio: recognition.folio,
      item,
      financeLink: recognition.financeLink,
      financeResult,
    };
  }

  async applyPaymentToFolio(input: ApplyFolioPaymentInput): Promise<HospitalityFolioPaymentResult> {
    this.assertPaymentInput(input);

    const context = await this.requireReadableFolio(input.tenantId, input.folioId);
    if (context.folio.status === 'closed') {
      throw new Error('HOSPITALITY_FOLIO_PAYMENT_REJECTS_CLOSED_FOLIO');
    }
    if (input.amountMinor > context.folio.outstandingAmountMinor) {
      throw new Error('HOSPITALITY_FOLIO_PAYMENT_EXCEEDS_OUTSTANDING');
    }

    const financeLink = await this.requireSingleFinanceLink(input.tenantId, input.folioId);
    const paymentSourceId = `${input.folioId}:${input.idempotencyKey}`;
    const financeResult = await this.finance.allocateConfirmedPaymentToInvoiceReceivable({
      tenantId: input.tenantId,
      invoiceId: financeLink.financeInvoiceId,
      paymentSourceType: FOLIO_PAYMENT_SOURCE_TYPE,
      paymentSourceId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      paymentMethod: input.paymentMethod,
      receivedAt: input.receivedAt,
      idempotencyKey: input.idempotencyKey,
      description: input.description ?? `Hospitality folio payment ${input.folioId}`,
    });
    const allocation = this.requireInvoiceAllocation(financeLink, financeResult.allocations);
    if (
      financeResult.allocatedAmountMinor !== input.amountMinor
      || allocation.allocatedAmountMinor !== input.amountMinor
    ) {
      throw new Error('HOSPITALITY_FOLIO_PAYMENT_ALLOCATION_AMOUNT_MISMATCH');
    }

    const recorded = await this.repository.recordPaymentApplication({
      tenantId: input.tenantId,
      propertyId: context.folio.propertyId,
      folioId: input.folioId,
      financeInvoiceId: financeLink.financeInvoiceId,
      paymentSourceType: FOLIO_PAYMENT_SOURCE_TYPE,
      paymentSourceId,
      financeTransactionId: financeResult.transactionId,
      financeCashMovementId: financeResult.cashMovementId,
      financeAllocationId: allocation.allocationId,
      amountMinor: financeResult.allocatedAmountMinor,
      currency: input.currency,
      paymentMethod: input.paymentMethod,
      receivedAt: input.receivedAt,
      idempotencyKey: input.idempotencyKey,
      metadata: {
        duplicate: financeResult.duplicate,
        ...input.metadata,
      },
    });

    return {
      ...recorded,
      financeResult,
    };
  }

  async closeSettledFolio(input: CloseFolioInput): Promise<HospitalityFolio> {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('folioId', input.folioId);
    assertTimestamp('closedAt', input.closedAt);

    return this.repository.closeFolio(input);
  }

  private assertRoomChargeInput(input: PostRoomChargeInput): void {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('folioId', input.folioId);
    assertPositiveInteger('amountMinor', input.amountMinor);
    assertNonEmpty('currency', input.currency);
    assertDate('servicePeriodStart', input.servicePeriodStart);
    assertDate('servicePeriodEnd', input.servicePeriodEnd);
    assertDate('recognitionDate', input.recognitionDate);
    assertDate('dueDate', input.dueDate);
    assertNonEmpty('description', input.description);

    if (input.servicePeriodEnd < input.servicePeriodStart) {
      throw new Error('servicePeriodEnd must be on or after servicePeriodStart');
    }
  }

  private assertPaymentInput(input: ApplyFolioPaymentInput): void {
    assertNonEmpty('tenantId', input.tenantId);
    assertNonEmpty('folioId', input.folioId);
    assertPositiveInteger('amountMinor', input.amountMinor);
    assertNonEmpty('currency', input.currency);
    assertNonEmpty('paymentMethod', input.paymentMethod);
    assertTimestamp('receivedAt', input.receivedAt);
    assertNonEmpty('receivedAt', input.receivedAt);
    assertNonEmpty('idempotencyKey', input.idempotencyKey);
  }

  private async requireOpenFolio(tenantId: string, folioId: string) {
    const context = await this.requireReadableFolio(tenantId, folioId);
    if (context.folio.status !== 'open') {
      throw new Error('HOSPITALITY_FOLIO_REQUIRES_OPEN_STATUS');
    }
    return context;
  }

  private async requireReadableFolio(tenantId: string, folioId: string) {
    const context = await this.repository.getFolioContext(tenantId, folioId);
    if (!context) {
      throw new Error('HOSPITALITY_FOLIO_NOT_FOUND');
    }
    return context;
  }

  private async requireSingleFinanceLink(
    tenantId: string,
    folioId: string
  ): Promise<HospitalityFolioFinanceLink> {
    const links = await this.repository.listFinanceLinksByFolio(tenantId, folioId);
    if (links.length !== 1) {
      throw new Error('HOSPITALITY_FOLIO_PAYMENT_REQUIRES_SINGLE_FINANCE_RECEIVABLE');
    }
    return links[0];
  }

  private requireInvoiceAllocation(
    financeLink: HospitalityFolioFinanceLink,
    allocations: readonly ConfirmedPaymentReceivableAllocationLine[]
  ): ConfirmedPaymentReceivableAllocationLine {
    const allocation = allocations.find((line) => line.invoiceId === financeLink.financeInvoiceId);
    if (!allocation) {
      throw new Error('HOSPITALITY_FOLIO_PAYMENT_ALLOCATION_MISSING_FINANCE_INVOICE');
    }
    return allocation;
  }
}
