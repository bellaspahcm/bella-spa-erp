/**
 * English Center Billing Service
 * 
 * Orchestrates invoice creation for enrollments using Platform Finance F3 AR.
 * 
 * Ownership Boundaries:
 * - English Center: Course fee policy, discount calculation, enrollment context
 * - Platform Finance: Invoice lifecycle, receivable position, accounting posting
 * 
 * @module EnglishCenterBillingService
 * @owner Product: Bella English Center
 */

import {
  createF3AREngine,
  IF3AccountsReceivable,
  CreateInvoiceInput,
  AddInvoiceLineInput,
  InvoiceResult,
  InvoiceView,
  F3InvoiceNotFoundError
} from '@/platform/finance';

/**
 * Enrollment invoice creation parameters
 */
export interface CreateEnrollmentInvoiceParams {
  tenantId: string;
  enrollmentId: string;
  studentPartyId: string;
  courseId: string;
  courseName: string;
  courseFeeMinor: number;
  materialsFeeMinor?: number;
  taxRate: number;
  startDate: string;
  paymentDueDate: string;
}

/**
 * English Center Billing Service
 * 
 * Uses Platform Finance F3 AR contract (NOT direct DB/RPC).
 */
export class EnglishCenterBillingService {
  private arEngine: IF3AccountsReceivable;

  constructor(arEngine?: IF3AccountsReceivable) {
    // Allow dependency injection for testing
    this.arEngine = arEngine || createF3AREngine();
  }

  /**
   * Create invoice for confirmed enrollment
   * 
   * Maps English Center enrollment context to Platform Finance invoice:
   * - Enrollment ID → Invoice Number (ENR-{enrollmentId})
   * - Student Party ID → Invoice partyId
   * - Course fee → Revenue line (5111)
   * - Materials fee → Revenue line (5112)
   * 
   * @throws {F3InvoiceNotFoundError} if invoice not found during finalization
   * @throws {F3InvoiceEmptyError} if no line items added
   * @throws {F3PostingFailedError} if F1 posting fails
   */
  async createEnrollmentInvoice(
    params: CreateEnrollmentInvoiceParams
  ): Promise<InvoiceResult> {
    // 1. Create DRAFT invoice
    const invoice = await this.arEngine.createDraftInvoice({
      tenantId: params.tenantId,
      partyId: params.studentPartyId,
      invoiceNumber: `ENR-${params.enrollmentId}`,
      currency: 'VND',
      issueDate: params.startDate,
      dueDate: params.paymentDueDate
    });

    // 2. Add tuition line
    await this.arEngine.addInvoiceLine({
      tenantId: params.tenantId,
      invoiceId: invoice.invoiceId,
      description: `Tuition - ${params.courseName}`,
      quantity: 1,
      unitPriceMinor: params.courseFeeMinor,
      taxRate: params.taxRate,
      revenueAccountCode: '5111'  // Revenue Packages (F1 CoA)
    });

    // 3. Add materials line (if applicable)
    if (params.materialsFeeMinor && params.materialsFeeMinor > 0) {
      await this.arEngine.addInvoiceLine({
        tenantId: params.tenantId,
        invoiceId: invoice.invoiceId,
        description: 'Course Materials',
        quantity: 1,
        unitPriceMinor: params.materialsFeeMinor,
        taxRate: params.taxRate,
        revenueAccountCode: '5112'  // Revenue Retail (F1 CoA)
      });
    }

    // 4. Finalize invoice (triggers F1 GL posting)
    return await this.arEngine.finalizeInvoice({
      tenantId: params.tenantId,
      invoiceId: invoice.invoiceId
    });
  }

  /**
   * Get invoice view with header + lines + position
   * 
   * @param tenantId Tenant identifier
   * @param invoiceId Invoice identifier
   * @returns Invoice view with receivable position (if finalized)
   * @throws {F3InvoiceNotFoundError} if invoice not found
   */
  async getEnrollmentInvoice(
    tenantId: string,
    invoiceId: string
  ): Promise<InvoiceView> {
    return await this.arEngine.getInvoice({
      tenantId,
      invoiceId
    });
  }

  /**
   * Void enrollment invoice (e.g., enrollment cancelled)
   * 
   * @param tenantId Tenant identifier
   * @param invoiceId Invoice identifier
   * @returns Void result with F1 reversal transaction ID
   * @throws {F3InvoiceNotFinalizedError} if invoice not finalized
   * @throws {F3InvoiceHasAllocationsError} if payments already allocated
   */
  async voidEnrollmentInvoice(
    tenantId: string,
    invoiceId: string
  ): Promise<InvoiceResult> {
    return await this.arEngine.voidInvoice({
      tenantId,
      invoiceId
    });
  }
}

/**
 * Factory: Create English Center Billing Service
 */
export function createEnglishBillingService(): EnglishCenterBillingService {
  return new EnglishCenterBillingService();
}
