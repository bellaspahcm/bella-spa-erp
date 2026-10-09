/**
 * Bella Hospitality Phase 4 - Folio + Payment repository.
 *
 * This repository is product-owned. Finance identifiers are stored as opaque
 * references returned by the Finance public contract; this repository never
 * reads or writes Finance tables.
 */

import type { HospitalitySqlClient } from './property-room.repository';
import type {
  CloseFolioInput,
  CreateFolioItemInput,
  HospitalityFolio,
  HospitalityFolioContext,
  HospitalityFolioCurrency,
  HospitalityFolioFinanceLink,
  HospitalityFolioFinanceLinkStatus,
  HospitalityFolioItem,
  HospitalityFolioItemStatus,
  HospitalityFolioItemType,
  HospitalityFolioPaymentApplication,
  HospitalityFolioPaymentApplicationStatus,
  HospitalityFolioStatus,
  OpenFolioInput,
  RecordPaymentApplicationInput,
  RecordReceivableRecognitionInput,
} from '../types/folio-payment.types';

export interface HospitalityFolioPaymentRepositoryPort {
  createFolio(input: OpenFolioInput): Promise<HospitalityFolio>;
  createFolioItem(input: CreateFolioItemInput): Promise<HospitalityFolioItem>;
  getFolioContext(tenantId: string, folioId: string): Promise<HospitalityFolioContext | null>;
  listFinanceLinksByFolio(tenantId: string, folioId: string): Promise<HospitalityFolioFinanceLink[]>;
  recordReceivableRecognition(input: RecordReceivableRecognitionInput): Promise<{
    readonly folio: HospitalityFolio;
    readonly financeLink: HospitalityFolioFinanceLink;
  }>;
  recordPaymentApplication(input: RecordPaymentApplicationInput): Promise<{
    readonly folio: HospitalityFolio;
    readonly application: HospitalityFolioPaymentApplication;
  }>;
  closeFolio(input: CloseFolioInput): Promise<HospitalityFolio>;
}

type FolioRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  stay_id: string;
  guest_id: string;
  status: HospitalityFolioStatus;
  currency: HospitalityFolioCurrency;
  subtotal_amount_minor: unknown;
  paid_amount_minor: unknown;
  outstanding_amount_minor: unknown;
  opened_at: unknown;
  settled_at: unknown;
  closed_at: unknown;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type FolioContextRow = FolioRow & {
  guest_party_id: string;
};

type FolioItemRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  folio_id: string;
  stay_id: string;
  item_type: HospitalityFolioItemType;
  description: string;
  quantity: unknown;
  unit_amount_minor: unknown;
  amount_minor: unknown;
  currency: HospitalityFolioCurrency;
  service_period_start: unknown;
  service_period_end: unknown;
  recognition_date: unknown;
  source_type: string;
  source_id: string;
  status: HospitalityFolioItemStatus;
  metadata: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type FinanceLinkRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  folio_id: string;
  folio_item_id: string;
  finance_invoice_id: string;
  finance_invoice_number: string;
  finance_transaction_id: string;
  finance_receivable_position_id: string;
  status: HospitalityFolioFinanceLinkStatus;
  policy_evidence: unknown;
  metadata: unknown;
  created_at: unknown;
};

type PaymentApplicationRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  folio_id: string;
  finance_invoice_id: string;
  payment_source_type: string;
  payment_source_id: string;
  finance_transaction_id: string;
  finance_cash_movement_id: string;
  finance_allocation_id: string;
  amount_minor: unknown;
  currency: HospitalityFolioCurrency;
  payment_method: string;
  received_at: unknown;
  idempotency_key: string;
  status: HospitalityFolioPaymentApplicationStatus;
  metadata: unknown;
  created_at: unknown;
};

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toInteger(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number.parseInt(value, 10);
  throw new Error(`Expected numeric database value, received ${String(value)}`);
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  throw new Error(`Expected date database value, received ${String(value)}`);
}

function toTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  throw new Error(`Expected timestamp database value, received ${String(value)}`);
}

function toNullableTimestamp(value: unknown): string | null {
  if (value === null) return null;
  return toTimestamp(value);
}

function firstRow<Row>(rows: readonly Row[], label: string): Row {
  const [row] = rows;
  if (!row) {
    throw new Error(`${label}: expected database row`);
  }
  return row;
}

export class HospitalityFolioPaymentRepository implements HospitalityFolioPaymentRepositoryPort {
  constructor(private readonly db: HospitalitySqlClient) {}

  async createFolio(input: OpenFolioInput): Promise<HospitalityFolio> {
    const result = await this.db.query<FolioRow>(
      `
        INSERT INTO public.hospitality_folios (
          tenant_id, property_id, stay_id, guest_id, currency, opened_at, metadata
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), $7)
        RETURNING *
      `,
      [
        input.tenantId,
        input.propertyId,
        input.stayId,
        input.guestId,
        input.currency ?? 'VND',
        input.openedAt ?? null,
        input.metadata ?? {},
      ]
    );

    return this.mapFolio(firstRow(result.rows, 'createFolio'));
  }

  async createFolioItem(input: CreateFolioItemInput): Promise<HospitalityFolioItem> {
    const result = await this.db.query<FolioItemRow>(
      `
        INSERT INTO public.hospitality_folio_items (
          tenant_id, property_id, folio_id, stay_id, item_type, description,
          quantity, unit_amount_minor, amount_minor, currency,
          service_period_start, service_period_end, recognition_date,
          source_type, source_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `,
      [
        input.tenantId,
        input.propertyId,
        input.folioId,
        input.stayId,
        input.itemType ?? 'room_charge',
        input.description,
        input.quantity ?? 1,
        input.unitAmountMinor,
        input.amountMinor,
        input.currency,
        input.servicePeriodStart,
        input.servicePeriodEnd,
        input.recognitionDate,
        input.sourceType,
        input.sourceId,
        input.metadata ?? {},
      ]
    );

    return this.mapFolioItem(firstRow(result.rows, 'createFolioItem'));
  }

  async getFolioContext(tenantId: string, folioId: string): Promise<HospitalityFolioContext | null> {
    const result = await this.db.query<FolioContextRow>(
      `
        SELECT f.*, g.party_id AS guest_party_id
        FROM public.hospitality_folios f
        JOIN public.hospitality_guests g
          ON g.tenant_id = f.tenant_id
         AND g.id = f.guest_id
        WHERE f.tenant_id = $1
          AND f.id = $2
        LIMIT 1
      `,
      [tenantId, folioId]
    );

    const [row] = result.rows;
    return row
      ? {
        folio: this.mapFolio(row),
        guestPartyId: row.guest_party_id,
      }
      : null;
  }

  async listFinanceLinksByFolio(tenantId: string, folioId: string): Promise<HospitalityFolioFinanceLink[]> {
    const result = await this.db.query<FinanceLinkRow>(
      `
        SELECT *
        FROM public.hospitality_folio_finance_links
        WHERE tenant_id = $1
          AND folio_id = $2
        ORDER BY created_at ASC
      `,
      [tenantId, folioId]
    );

    return result.rows.map((row) => this.mapFinanceLink(row));
  }

  async recordReceivableRecognition(input: RecordReceivableRecognitionInput): Promise<{
    readonly folio: HospitalityFolio;
    readonly financeLink: HospitalityFolioFinanceLink;
  }> {
    await this.db.query('BEGIN');
    try {
      const linkResult = await this.db.query<FinanceLinkRow>(
        `
          INSERT INTO public.hospitality_folio_finance_links (
            tenant_id, property_id, folio_id, folio_item_id,
            finance_invoice_id, finance_invoice_number, finance_transaction_id,
            finance_receivable_position_id, policy_evidence, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `,
        [
          input.tenantId,
          input.propertyId,
          input.folioId,
          input.folioItemId,
          input.financeResult.invoiceId,
          input.financeResult.invoiceNumber,
          input.financeResult.transactionId,
          input.financeResult.receivablePositionId,
          input.financeResult.policyEvidence,
          input.metadata ?? {},
        ]
      );

      const folioResult = await this.db.query<FolioRow>(
        `
          UPDATE public.hospitality_folios
          SET subtotal_amount_minor = subtotal_amount_minor + $3,
              outstanding_amount_minor = outstanding_amount_minor + $3
          WHERE tenant_id = $1
            AND id = $2
            AND status = 'open'
          RETURNING *
        `,
        [input.tenantId, input.folioId, input.amountMinor]
      );

      const folio = this.mapFolio(firstRow(folioResult.rows, 'recordReceivableRecognition folio'));
      const financeLink = this.mapFinanceLink(firstRow(linkResult.rows, 'recordReceivableRecognition link'));
      await this.db.query('COMMIT');
      return { folio, financeLink };
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async recordPaymentApplication(input: RecordPaymentApplicationInput): Promise<{
    readonly folio: HospitalityFolio;
    readonly application: HospitalityFolioPaymentApplication;
  }> {
    await this.db.query('BEGIN');
    try {
      const existingApplication = await this.db.query<PaymentApplicationRow>(
        `
          SELECT *
          FROM public.hospitality_folio_payment_applications
          WHERE tenant_id = $1
            AND idempotency_key = $2
            AND folio_id = $3
          LIMIT 1
        `,
        [input.tenantId, input.idempotencyKey, input.folioId]
      );

      const [existing] = existingApplication.rows;
      if (existing) {
        const folioResult = await this.db.query<FolioRow>(
          `
            SELECT *
            FROM public.hospitality_folios
            WHERE tenant_id = $1
              AND id = $2
            LIMIT 1
          `,
          [input.tenantId, input.folioId]
        );
        await this.db.query('COMMIT');
        return {
          folio: this.mapFolio(firstRow(folioResult.rows, 'recordPaymentApplication existing folio')),
          application: this.mapPaymentApplication(existing),
        };
      }

      const lockedFolioResult = await this.db.query<FolioRow>(
        `
          SELECT *
          FROM public.hospitality_folios
          WHERE tenant_id = $1
            AND id = $2
          FOR UPDATE
        `,
        [input.tenantId, input.folioId]
      );
      const lockedFolio = this.mapFolio(firstRow(lockedFolioResult.rows, 'recordPaymentApplication lock'));
      if (input.amountMinor > lockedFolio.outstandingAmountMinor) {
        throw new Error('HOSPITALITY_FOLIO_PAYMENT_EXCEEDS_OUTSTANDING');
      }

      const applicationResult = await this.db.query<PaymentApplicationRow>(
        `
          INSERT INTO public.hospitality_folio_payment_applications (
            tenant_id, property_id, folio_id, finance_invoice_id,
            payment_source_type, payment_source_id, finance_transaction_id,
            finance_cash_movement_id, finance_allocation_id, amount_minor,
            currency, payment_method, received_at, idempotency_key, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14, $15)
          RETURNING *
        `,
        [
          input.tenantId,
          input.propertyId,
          input.folioId,
          input.financeInvoiceId,
          input.paymentSourceType,
          input.paymentSourceId,
          input.financeTransactionId,
          input.financeCashMovementId,
          input.financeAllocationId,
          input.amountMinor,
          input.currency,
          input.paymentMethod,
          input.receivedAt,
          input.idempotencyKey,
          input.metadata ?? {},
        ]
      );

      const folioResult = await this.db.query<FolioRow>(
        `
          UPDATE public.hospitality_folios
          SET paid_amount_minor = paid_amount_minor + $3,
              outstanding_amount_minor = outstanding_amount_minor - $3,
              status = CASE WHEN outstanding_amount_minor - $3 = 0 THEN 'settled' ELSE 'open' END,
              settled_at = CASE
                WHEN outstanding_amount_minor - $3 = 0 THEN COALESCE(settled_at, $4::timestamptz)
                ELSE settled_at
              END
          WHERE tenant_id = $1
            AND id = $2
          RETURNING *
        `,
        [input.tenantId, input.folioId, input.amountMinor, input.receivedAt]
      );

      const folio = this.mapFolio(firstRow(folioResult.rows, 'recordPaymentApplication folio'));
      const application = this.mapPaymentApplication(firstRow(applicationResult.rows, 'recordPaymentApplication application'));
      await this.db.query('COMMIT');
      return { folio, application };
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async closeFolio(input: CloseFolioInput): Promise<HospitalityFolio> {
    const result = await this.db.query<FolioRow>(
      `
        UPDATE public.hospitality_folios
        SET status = 'closed',
            closed_at = COALESCE($3::timestamptz, NOW())
        WHERE tenant_id = $1
          AND id = $2
          AND status = 'settled'
        RETURNING *
      `,
      [input.tenantId, input.folioId, input.closedAt ?? null]
    );

    return this.mapFolio(firstRow(result.rows, 'closeFolio'));
  }

  private mapFolio(row: FolioRow): HospitalityFolio {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      stayId: row.stay_id,
      guestId: row.guest_id,
      status: row.status,
      currency: row.currency,
      subtotalAmountMinor: toInteger(row.subtotal_amount_minor),
      paidAmountMinor: toInteger(row.paid_amount_minor),
      outstandingAmountMinor: toInteger(row.outstanding_amount_minor),
      openedAt: toTimestamp(row.opened_at),
      settledAt: toNullableTimestamp(row.settled_at),
      closedAt: toNullableTimestamp(row.closed_at),
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapFolioItem(row: FolioItemRow): HospitalityFolioItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      folioId: row.folio_id,
      stayId: row.stay_id,
      itemType: row.item_type,
      description: row.description,
      quantity: toInteger(row.quantity),
      unitAmountMinor: toInteger(row.unit_amount_minor),
      amountMinor: toInteger(row.amount_minor),
      currency: row.currency,
      servicePeriodStart: toDateString(row.service_period_start),
      servicePeriodEnd: toDateString(row.service_period_end),
      recognitionDate: toDateString(row.recognition_date),
      sourceType: row.source_type,
      sourceId: row.source_id,
      status: row.status,
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapFinanceLink(row: FinanceLinkRow): HospitalityFolioFinanceLink {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      folioId: row.folio_id,
      folioItemId: row.folio_item_id,
      financeInvoiceId: row.finance_invoice_id,
      financeInvoiceNumber: row.finance_invoice_number,
      financeTransactionId: row.finance_transaction_id,
      financeReceivablePositionId: row.finance_receivable_position_id,
      status: row.status,
      policyEvidence: toRecord(row.policy_evidence),
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
    };
  }

  private mapPaymentApplication(row: PaymentApplicationRow): HospitalityFolioPaymentApplication {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      folioId: row.folio_id,
      financeInvoiceId: row.finance_invoice_id,
      paymentSourceType: row.payment_source_type,
      paymentSourceId: row.payment_source_id,
      financeTransactionId: row.finance_transaction_id,
      financeCashMovementId: row.finance_cash_movement_id,
      financeAllocationId: row.finance_allocation_id,
      amountMinor: toInteger(row.amount_minor),
      currency: row.currency,
      paymentMethod: row.payment_method,
      receivedAt: toTimestamp(row.received_at),
      idempotencyKey: row.idempotency_key,
      status: row.status,
      metadata: toRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
    };
  }
}
