import { describe, expect, it } from '@jest/globals';

import { HospitalityFolioPaymentService } from '../services/folio-payment.service';
import type { HospitalityFolioPaymentRepositoryPort } from '../repositories/folio-payment.repository';
import type {
  ConfirmedPaymentInvoiceReceivableAllocationInput,
  ConfirmedPaymentReceivableAllocationInput,
  ConfirmedPaymentReceivableAllocationResult,
  ISemanticReceivableChargeContract,
  PaymentReceivableAllocationInput,
  PaymentReceivableAllocationResult,
  SemanticReceivableChargeResult,
  ServiceReceivableChargeInput,
  TuitionServiceRecognizedChargeInput,
} from '@/platform/finance/contracts';
import type {
  CloseFolioInput,
  CreateFolioItemInput,
  HospitalityFolio,
  HospitalityFolioContext,
  HospitalityFolioFinanceLink,
  HospitalityFolioItem,
  HospitalityFolioPaymentApplication,
  OpenFolioInput,
  RecordPaymentApplicationInput,
  RecordReceivableRecognitionInput,
} from '../types/folio-payment.types';

const NOW = '2027-06-01T08:00:00.000Z';
const tenantId = 'tenant-hospitality';
const propertyId = 'property-1';
const stayId = 'stay-1';
const guestId = 'guest-1';
const guestPartyId = 'party-guest-1';

function makeFolio(overrides: Partial<HospitalityFolio> = {}): HospitalityFolio {
  return {
    id: 'folio-1',
    tenantId,
    propertyId,
    stayId,
    guestId,
    status: 'open',
    currency: 'VND',
    subtotalAmountMinor: 0,
    paidAmountMinor: 0,
    outstandingAmountMinor: 0,
    openedAt: NOW,
    settledAt: null,
    closedAt: null,
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

class FakeFolioRepository implements HospitalityFolioPaymentRepositoryPort {
  folio: HospitalityFolio | null = null;
  item: HospitalityFolioItem | null = null;
  links: HospitalityFolioFinanceLink[] = [];
  applications: HospitalityFolioPaymentApplication[] = [];

  async createFolio(input: OpenFolioInput): Promise<HospitalityFolio> {
    this.folio = makeFolio({
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      stayId: input.stayId,
      guestId: input.guestId,
      currency: input.currency ?? 'VND',
      openedAt: input.openedAt ?? NOW,
      metadata: input.metadata ?? {},
    });
    return this.folio;
  }

  async createFolioItem(input: CreateFolioItemInput): Promise<HospitalityFolioItem> {
    this.item = {
      id: 'folio-item-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      folioId: input.folioId,
      stayId: input.stayId,
      itemType: input.itemType ?? 'room_charge',
      description: input.description,
      quantity: input.quantity ?? 1,
      unitAmountMinor: input.unitAmountMinor,
      amountMinor: input.amountMinor,
      currency: input.currency,
      servicePeriodStart: input.servicePeriodStart,
      servicePeriodEnd: input.servicePeriodEnd,
      recognitionDate: input.recognitionDate,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: 'posted',
      metadata: input.metadata ?? {},
      createdAt: NOW,
      updatedAt: NOW,
    };
    return this.item;
  }

  async getFolioContext(inputTenantId: string, folioId: string): Promise<HospitalityFolioContext | null> {
    if (!this.folio || this.folio.tenantId !== inputTenantId || this.folio.id !== folioId) {
      return null;
    }
    return {
      folio: this.folio,
      guestPartyId,
    };
  }

  async listFinanceLinksByFolio(inputTenantId: string, folioId: string): Promise<HospitalityFolioFinanceLink[]> {
    return this.links.filter((link) => link.tenantId === inputTenantId && link.folioId === folioId);
  }

  async recordReceivableRecognition(input: RecordReceivableRecognitionInput): Promise<{
    readonly folio: HospitalityFolio;
    readonly financeLink: HospitalityFolioFinanceLink;
  }> {
    if (!this.folio) throw new Error('folio missing');
    const financeLink: HospitalityFolioFinanceLink = {
      id: 'finance-link-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      folioId: input.folioId,
      folioItemId: input.folioItemId,
      financeInvoiceId: input.financeResult.invoiceId,
      financeInvoiceNumber: input.financeResult.invoiceNumber,
      financeTransactionId: input.financeResult.transactionId,
      financeReceivablePositionId: input.financeResult.receivablePositionId,
      status: 'recognized',
      policyEvidence: input.financeResult.policyEvidence,
      metadata: input.metadata ?? {},
      createdAt: NOW,
    };
    this.links.push(financeLink);
    this.folio = {
      ...this.folio,
      subtotalAmountMinor: this.folio.subtotalAmountMinor + input.amountMinor,
      outstandingAmountMinor: this.folio.outstandingAmountMinor + input.amountMinor,
      updatedAt: NOW,
    };
    return {
      folio: this.folio,
      financeLink,
    };
  }

  async recordPaymentApplication(input: RecordPaymentApplicationInput): Promise<{
    readonly folio: HospitalityFolio;
    readonly application: HospitalityFolioPaymentApplication;
  }> {
    if (!this.folio) throw new Error('folio missing');
    if (input.amountMinor > this.folio.outstandingAmountMinor) {
      throw new Error('HOSPITALITY_FOLIO_PAYMENT_EXCEEDS_OUTSTANDING');
    }
    const application: HospitalityFolioPaymentApplication = {
      id: 'payment-application-1',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      folioId: input.folioId,
      financeInvoiceId: input.financeInvoiceId,
      paymentSourceType: input.paymentSourceType,
      paymentSourceId: input.paymentSourceId,
      financeTransactionId: input.financeTransactionId,
      financeCashMovementId: input.financeCashMovementId,
      financeAllocationId: input.financeAllocationId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      paymentMethod: input.paymentMethod,
      receivedAt: input.receivedAt,
      idempotencyKey: input.idempotencyKey,
      status: 'applied',
      metadata: input.metadata ?? {},
      createdAt: NOW,
    };
    this.applications.push(application);
    const outstandingAmountMinor = this.folio.outstandingAmountMinor - input.amountMinor;
    this.folio = {
      ...this.folio,
      paidAmountMinor: this.folio.paidAmountMinor + input.amountMinor,
      outstandingAmountMinor,
      status: outstandingAmountMinor === 0 ? 'settled' : 'open',
      settledAt: outstandingAmountMinor === 0 ? input.receivedAt : null,
      updatedAt: NOW,
    };
    return {
      folio: this.folio,
      application,
    };
  }

  async closeFolio(input: CloseFolioInput): Promise<HospitalityFolio> {
    if (!this.folio || this.folio.status !== 'settled') {
      throw new Error('folio not settled');
    }
    this.folio = {
      ...this.folio,
      status: 'closed',
      closedAt: input.closedAt ?? NOW,
      updatedAt: input.closedAt ?? NOW,
    };
    return this.folio;
  }
}

class FakeFinanceContract implements ISemanticReceivableChargeContract {
  readonly serviceReceivableCalls: ServiceReceivableChargeInput[] = [];
  readonly invoicePaymentCalls: ConfirmedPaymentInvoiceReceivableAllocationInput[] = [];

  async recognizeServiceReceivable(
    input: ServiceReceivableChargeInput
  ): Promise<SemanticReceivableChargeResult> {
    this.serviceReceivableCalls.push(input);
    return {
      invoiceId: '11111111-1111-1111-1111-111111111111',
      invoiceNumber: 'FRC-HOSP-001',
      transactionId: '22222222-2222-2222-2222-222222222222',
      receivableLedgerEntryCount: 1,
      receivablePositionId: '33333333-3333-3333-3333-333333333333',
      transactionLineCount: 2,
      duplicate: false,
      policyEvidence: {
        legalSource: '99/2025/TT-BTC',
        effectiveFrom: '2026-01-01',
        applicableRegime: 'VI_TT99_2025',
        businessSemantic: 'SERVICE_RECEIVABLE_RECOGNIZED',
        verificationStatus: 'PROVEN',
      },
    };
  }

  async recognizeTuitionServiceReceivable(
    _input: TuitionServiceRecognizedChargeInput
  ): Promise<SemanticReceivableChargeResult> {
    throw new Error('not used by Hospitality folio');
  }

  async allocatePaymentToReceivable(
    _input: PaymentReceivableAllocationInput
  ): Promise<PaymentReceivableAllocationResult> {
    throw new Error('not used by Hospitality folio');
  }

  async allocateConfirmedPaymentToReceivables(
    _input: ConfirmedPaymentReceivableAllocationInput
  ): Promise<ConfirmedPaymentReceivableAllocationResult> {
    throw new Error('not used by Hospitality folio');
  }

  async allocateConfirmedPaymentToInvoiceReceivable(
    input: ConfirmedPaymentInvoiceReceivableAllocationInput
  ): Promise<ConfirmedPaymentReceivableAllocationResult> {
    this.invoicePaymentCalls.push(input);
    return {
      transactionId: '44444444-4444-4444-4444-444444444444',
      cashMovementId: '55555555-5555-5555-5555-555555555555',
      allocatedAmountMinor: input.amountMinor,
      duplicate: false,
      allocations: [{
        invoiceId: input.invoiceId,
        receivablePositionId: '33333333-3333-3333-3333-333333333333',
        cashMovementId: '55555555-5555-5555-5555-555555555555',
        allocationId: '66666666-6666-6666-6666-666666666666',
        allocatedAmountMinor: input.amountMinor,
        duplicate: false,
      }],
    };
  }
}

describe('HospitalityFolioPaymentService', () => {
  it('opens folio, posts room charge through Finance receivable contract, then settles and closes it', async () => {
    const repository = new FakeFolioRepository();
    const finance = new FakeFinanceContract();
    const service = new HospitalityFolioPaymentService(repository, finance);

    const folio = await service.openFolio({
      tenantId,
      propertyId,
      stayId,
      guestId,
      currency: 'VND',
      openedAt: NOW,
    });

    const charge = await service.postRoomCharge({
      tenantId,
      folioId: folio.id,
      amountMinor: 2_400_000,
      currency: 'VND',
      servicePeriodStart: '2027-06-01',
      servicePeriodEnd: '2027-06-03',
      recognitionDate: '2027-06-03',
      dueDate: '2027-06-03',
      description: 'Room charge for stay',
    });

    expect(charge.folio.outstandingAmountMinor).toBe(2_400_000);
    expect(charge.financeLink.financeInvoiceNumber).toBe('FRC-HOSP-001');
    expect(finance.serviceReceivableCalls).toEqual([expect.objectContaining({
      tenantId,
      customerId: guestPartyId,
      amountMinor: 2_400_000,
      businessSourceType: 'HOSPITALITY_FOLIO_ITEM',
      businessSourceId: 'folio-item-1',
      businessSemantic: 'SERVICE_RECEIVABLE_RECOGNIZED',
    })]);

    const payment = await service.applyPaymentToFolio({
      tenantId,
      folioId: folio.id,
      amountMinor: 2_400_000,
      currency: 'VND',
      paymentMethod: 'bank_transfer',
      receivedAt: '2027-06-03T11:00:00.000Z',
      idempotencyKey: 'folio-1-payment-1',
    });

    expect(payment.folio.status).toBe('settled');
    expect(payment.folio.outstandingAmountMinor).toBe(0);
    expect(finance.invoicePaymentCalls).toEqual([expect.objectContaining({
      tenantId,
      invoiceId: charge.financeLink.financeInvoiceId,
      paymentSourceType: 'HOSPITALITY_FOLIO_PAYMENT_APPLICATION',
      amountMinor: 2_400_000,
      paymentMethod: 'bank_transfer',
    })]);

    const closed = await service.closeSettledFolio({
      tenantId,
      folioId: folio.id,
      closedAt: '2027-06-03T12:00:00.000Z',
    });
    expect(closed.status).toBe('closed');
    expect(closed.closedAt).toBe('2027-06-03T12:00:00.000Z');
  });

  it('rejects overpayment before calling Finance payment allocation', async () => {
    const repository = new FakeFolioRepository();
    const finance = new FakeFinanceContract();
    const service = new HospitalityFolioPaymentService(repository, finance);

    const folio = await service.openFolio({ tenantId, propertyId, stayId, guestId });
    await service.postRoomCharge({
      tenantId,
      folioId: folio.id,
      amountMinor: 1_000_000,
      currency: 'VND',
      servicePeriodStart: '2027-06-01',
      servicePeriodEnd: '2027-06-01',
      recognitionDate: '2027-06-01',
      dueDate: '2027-06-01',
      description: 'Room charge',
    });

    await expect(service.applyPaymentToFolio({
      tenantId,
      folioId: folio.id,
      amountMinor: 1_000_001,
      currency: 'VND',
      paymentMethod: 'cash',
      receivedAt: '2027-06-01T10:00:00.000Z',
      idempotencyKey: 'folio-overpay',
    })).rejects.toThrow('HOSPITALITY_FOLIO_PAYMENT_EXCEEDS_OUTSTANDING');

    expect(finance.invoicePaymentCalls).toHaveLength(0);
    expect(repository.applications).toHaveLength(0);
  });

  it('does not allocate payment when a folio has no recognized Finance receivable link', async () => {
    const repository = new FakeFolioRepository();
    const finance = new FakeFinanceContract();
    const service = new HospitalityFolioPaymentService(repository, finance);

    const folio = await service.openFolio({
      tenantId,
      propertyId,
      stayId,
      guestId,
    });
    repository.folio = makeFolio({
      ...folio,
      subtotalAmountMinor: 500_000,
      outstandingAmountMinor: 500_000,
    });

    await expect(service.applyPaymentToFolio({
      tenantId,
      folioId: folio.id,
      amountMinor: 500_000,
      currency: 'VND',
      paymentMethod: 'cash',
      receivedAt: '2027-06-01T10:00:00.000Z',
      idempotencyKey: 'folio-no-link',
    })).rejects.toThrow('HOSPITALITY_FOLIO_PAYMENT_REQUIRES_SINGLE_FINANCE_RECEIVABLE');

    expect(finance.invoicePaymentCalls).toHaveLength(0);
  });
});
