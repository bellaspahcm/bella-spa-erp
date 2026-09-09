/**
 * Bella Preschool OS — P7.1 Invoice Issuance & Immutability Service
 * 
 * Responsible for:
 * 1. Transitioning Invoice Status DRAFT ➔ ISSUED
 * 2. Generating deterministic key-sorted JSON canonical payload
 * 3. Computing cryptographic SHA-256 fingerprint on publication
 * 4. Freezing invoice header & line items against retroactive mutation
 */

import { createHash } from 'crypto';
import { PreschoolFinanceRepository } from '../repositories/preschool-finance.repository';
import { Invoice } from '../domain/finance.types';

/**
 * Deterministic Key-Sorting Canonical JSON helper
 */
export function canonicalJsonString(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalJsonString(item)).join(',') + ']';
  }

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const sortedPairs = keys.map(
    (key) => JSON.stringify(key) + ':' + canonicalJsonString((obj as Record<string, unknown>)[key])
  );
  return '{' + sortedPairs.join(',') + '}';
}

export class InvoiceIssuanceService {
  constructor(private repo: PreschoolFinanceRepository = new PreschoolFinanceRepository()) {}

  /**
   * Issues an invoice, locks header/line items, and generates SHA-256 publication checksum
   */
  async issueInvoice(tenantId: string, invoiceId: string): Promise<Invoice> {
    const invoice = await this.repo.getInvoiceById(tenantId, invoiceId);

    if (!invoice) {
      throw new Error(`INVOICE_NOT_FOUND_ERROR: Invoice ${invoiceId} not found in tenant.`);
    }

    if (invoice.invoiceStatus === 'ISSUED') {
      return invoice; // Already issued, idempotent return
    }

    if (invoice.invoiceStatus === 'VOID') {
      throw new Error(`INVOICE_VOID_ERROR: Cannot issue a voided invoice.`);
    }

    const issuedAt = new Date().toISOString();

    // Generate Canonical Publication DTO for Fingerprint
    const publicationDto = {
      tenantId: invoice.tenantId,
      studentId: invoice.studentId,
      billingPeriodId: invoice.billingPeriodId,
      invoiceNumber: invoice.invoiceNumber,
      grossAmount: invoice.grossAmount,
      discountAmount: invoice.discountAmount,
      netAmount: invoice.netAmount,
      dueDate: invoice.dueDate,
      issuedAt,
      lineItems: (invoice.lineItems || []).map((item) => ({
        description: item.description,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotalAmount: item.subtotalAmount,
        itemType: item.itemType,
      })),
    };

    const canonicalJson = canonicalJsonString(publicationDto);
    const sha256Checksum = createHash('sha256').update(canonicalJson).digest('hex');

    // Update status to ISSUED with Checksum
    return await this.repo.updateInvoiceStatus(tenantId, invoiceId, {
      invoiceStatus: 'ISSUED',
      issuedAt,
      sha256Checksum,
    });
  }
}
