/**
 * Platform Finance F3 Accounts Receivable Contract
 *
 * Provides canonical invoice lifecycle operations for Products.
 * Abstracts DB RPCs and enforces Party-native identity.
 *
 * @module F3AccountsReceivable
 * @owner Platform Finance
 * @consumers Products (English Center, Preschool, etc.)
 * @since E0.1B-R
 */

// ============================================================================
// CONTRACT INTERFACE
// ============================================================================

/**
 * F3 Accounts Receivable Contract
 *
 * Single Writer for Platform Finance invoice lifecycle.
 * All Products MUST use this contract (not direct DB/RPC access).
 */
export interface IF3AccountsReceivable {
  /**
   * Create a DRAFT invoice for a Party
   *
   * Initial invoice state with zero lines and zero amount.
   * Invoice number must be unique within tenant scope.
   *
   * @param input - Invoice creation parameters
   * @returns Invoice result with invoiceId and status=DRAFT
   * @throws {F3InvoiceNumberDuplicateError} if invoice_number exists for tenant
   * @throws {F3InvalidInputError} if required fields missing/invalid
   *
   * @example
   * ```typescript
   * const result = await f3AR.createDraftInvoice({
   *   tenantId: '...',
   *   partyId: '...',  // Student's party_id
   *   invoiceNumber: 'INV-2026-001',
   *   currency: 'VND',
   *   issueDate: '2026-09-01',
   *   dueDate: '2026-09-30'
   * });
   * // result.invoiceId, result.status='DRAFT'
   * ```
   */
  createDraftInvoice(input: CreateInvoiceInput): Promise<InvoiceResult>;

  /**
   * Add a line item to a DRAFT invoice
   *
   * Line amount calculated as FLOOR(quantity * unitPriceMinor).
   * Header totals automatically recalculated after line addition.
   *
   * @param input - Line item parameters
   * @returns Updated invoice result with new total
   * @throws {F3InvoiceNotFoundError} if invoice does not exist
   * @throws {F3InvoiceNotDraftError} if invoice status != DRAFT
   * @throws {F3InvalidRevenueAccountError} if revenue account invalid/inactive
   *
   * @example
   * ```typescript
   * await f3AR.addInvoiceLine({
   *   tenantId: '...',
   *   invoiceId: '...',
   *   description: 'Monthly Tuition Fee',
   *   quantity: 1,
   *   unitPriceMinor: 500000000,  // 5,000,000 VND in minor units
   *   taxRate: 0.1,  // 10% VAT
   *   revenueAccountCode: '5111'
   * });
   * ```
   */
  addInvoiceLine(input: AddInvoiceLineInput): Promise<InvoiceResult>;

  /**
   * Finalize a DRAFT invoice (trigger F1 accrual posting)
   *
   * Atomic operation:
   * 1. Validate invoice has lines (not empty)
   * 2. Validate all revenue accounts valid
   * 3. Post F1 GL transaction (accrual)
   * 4. Create AR subledger DEBIT_ACCRUAL entry
   * 5. Initialize receivable position cache
   * 6. Transition invoice status DRAFT → FINALIZED
   *
   * **Idempotent:** Retries with same invoice return success (no duplicate posting).
   * Idempotency handled automatically via persistent posting_attempt_id.
   *
   * @param input - Finalization parameters
   * @returns Finalization result with F1 transaction_id
   * @throws {F3InvoiceNotDraftError} if invoice already finalized
   * @throws {F3InvoiceEmptyError} if invoice has no lines
   * @throws {F3ZeroValueInvoiceError} if total amount = 0
   * @throws {F3InvalidRevenueAccountError} if any line has invalid account
   * @throws {F3PostingFailedError} if F1 GL posting fails
   *
   * @example
   * ```typescript
   * const result = await f3AR.finalizeInvoice({
   *   tenantId: '...',
   *   invoiceId: '...'
   * });
   * // result.status='FINALIZED', result.f1TransactionId populated
   * ```
   */
  finalizeInvoice(input: FinalizeInvoiceInput): Promise<InvoiceResult>;

  /**
   * Void a FINALIZED invoice (trigger F1 reversal posting)
   *
   * Governed transition: Only FINALIZED invoices without allocated payments can be voided.
   *
   * Atomic operation:
   * 1. Verify invoice is FINALIZED
   * 2. Verify no payments allocated (outstanding = original)
   * 3. Post F1 reversal transaction (DR/CR flip)
   * 4. Create AR subledger CREDIT_ADJUSTMENT entry
   * 5. Update receivable position (outstanding → 0)
   * 6. Transition invoice status FINALIZED → VOIDED
   *
   * **Idempotent:** Retries return same reversal transaction_id.
   * Idempotency handled automatically via persistent void_posting_attempt_id.
   *
   * @param input - Void parameters
   * @returns Void result with reversal transaction_id
   * @throws {F3InvoiceNotFinalizedError} if invoice not FINALIZED
   * @throws {F3InvoiceHasAllocationsError} if payments already allocated
   * @throws {F3PostingFailedError} if F1 reversal fails
   *
   * @example
   * ```typescript
   * const result = await f3AR.voidInvoice({
   *   tenantId: '...',
   *   invoiceId: '...'
   * });
   * // result.status='VOIDED', result.f1ReversalTransactionId populated
   * ```
   */
  voidInvoice(input: VoidInvoiceInput): Promise<InvoiceResult>;

  /**
   * Get current invoice state (header + lines + AR position)
   *
   * Returns complete invoice view for display/reconciliation.
   *
   * @param input - Query parameters
   * @returns Invoice view with header, lines, position (if finalized)
   * @throws {F3InvoiceNotFoundError} if invoice does not exist
   *
   * @example
   * ```typescript
   * const view = await f3AR.getInvoice({
   *   tenantId: '...',
   *   invoiceId: '...'
   * });
   * // view.header, view.lines, view.position
   * ```
   */
  getInvoice(input: GetInvoiceInput): Promise<InvoiceView>;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input for creating a DRAFT invoice
 */
export interface CreateInvoiceInput {
  /** Tenant identifier (required for RLS) */
  tenantId: string;

  /** Party canonical identifier (maps to finance_invoices.customer_id) */
  partyId: string;

  /** Unique invoice number within tenant scope */
  invoiceNumber: string;

  /** Currency code (ISO 4217: VND, USD, etc.) */
  currency: string;

  /** Invoice issue date (YYYY-MM-DD) */
  issueDate: string;

  /** Payment due date (YYYY-MM-DD, must be >= issueDate) */
  dueDate: string;
}

/**
 * Input for adding a line item to a DRAFT invoice
 */
export interface AddInvoiceLineInput {
  /** Tenant identifier (required for RLS) */
  tenantId: string;

  /** Invoice identifier (from createDraftInvoice result) */
  invoiceId: string;

  /** Optional service/product identifier (Product-defined) */
  serviceId?: string;

  /** Line item description (required, non-empty) */
  description: string;

  /** Quantity (must be > 0) */
  quantity: number;

  /** Unit price in minor units (cents, not dollars) */
  unitPriceMinor: number;

  /** Tax rate (0.0 to 1.0, e.g., 0.1 = 10% VAT) */
  taxRate: number;

  /** F1 revenue account code (must exist, be active, type=REVENUE) */
  revenueAccountCode: string;
}

/**
 * Input for finalizing a DRAFT invoice
 */
export interface FinalizeInvoiceInput {
  /** Tenant identifier (required for RLS) */
  tenantId: string;

  /** Invoice identifier (from createDraftInvoice result) */
  invoiceId: string;
}

/**
 * Input for voiding a FINALIZED invoice
 */
export interface VoidInvoiceInput {
  /** Tenant identifier (required for RLS) */
  tenantId: string;

  /** Invoice identifier (from createDraftInvoice result) */
  invoiceId: string;
}

/**
 * Input for querying invoice state
 */
export interface GetInvoiceInput {
  /** Tenant identifier (required for RLS) */
  tenantId: string;

  /** Invoice identifier */
  invoiceId: string;
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/**
 * Standard result returned by mutating operations
 * (create, add_line, finalize, void)
 */
export interface InvoiceResult {
  /** Invoice identifier */
  invoiceId: string;

  /** Current invoice status */
  status: InvoiceStatus;

  /** Current total invoice amount (minor units) */
  totalInvoiceAmountMinor: number;

  /** F1 transaction ID (populated after finalization) */
  f1TransactionId?: string;

  /** F1 reversal transaction ID (populated after void) */
  f1ReversalTransactionId?: string;

  /** Idempotent operation flag (true if retry) */
  isDuplicate?: boolean;
}

/**
 * Invoice lifecycle status
 */
export type InvoiceStatus = 'DRAFT' | 'FINALIZED' | 'ADJUSTED' | 'VOIDED';

/**
 * Complete invoice view (header + lines + AR position)
 * Returned by getInvoice query
 */
export interface InvoiceView {
  /** Invoice header */
  header: InvoiceHeader;

  /** Invoice line items */
  lines: InvoiceLine[];

  /** AR receivable position (if finalized) */
  position?: ReceivablePosition;
}

/**
 * Invoice header details
 */
export interface InvoiceHeader {
  id: string;
  tenantId: string;
  /** Party identifier (mapped from DB customer_id) */
  partyId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  totalPretaxAmountMinor: number;
  taxAmountMinor: number;
  totalInvoiceAmountMinor: number;
  f1TransactionId?: string;
  postingStatus: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

/**
 * Invoice line item details
 */
export interface InvoiceLine {
  id: string;
  invoiceId: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxRate: number;
  amountMinor: number;
  revenueAccountCode: string;
  createdAt: string;
}

/**
 * AR receivable position (outstanding balance)
 */
export interface ReceivablePosition {
  invoiceId: string;
  /** Party identifier (mapped from DB customer_id) */
  partyId: string;
  currency: string;
  originalAmountMinor: number;
  allocatedAmountMinor: number;
  adjustedAmountMinor: number;
  outstandingAmountMinor: number;
  lastReconstructedAt?: string;
  version: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Invoice not found
 */
export class F3InvoiceNotFoundError extends Error {
  code = 'F3002';
  constructor(invoiceId: string) {
    super(`Invoice not found: ${invoiceId}`);
    this.name = 'F3InvoiceNotFoundError';
  }
}

/**
 * Invoice is not in DRAFT status (cannot add lines or finalize)
 */
export class F3InvoiceNotDraftError extends Error {
  code = 'F3003';
  constructor(invoiceId: string, currentStatus: string) {
    super(`Invoice ${invoiceId} is not DRAFT (current: ${currentStatus})`);
    this.name = 'F3InvoiceNotDraftError';
  }
}

/**
 * Invoice number already exists for tenant (duplicate)
 */
export class F3InvoiceNumberDuplicateError extends Error {
  code = 'F3016';
  constructor(invoiceNumber: string) {
    super(`Invoice number already exists: ${invoiceNumber}`);
    this.name = 'F3InvoiceNumberDuplicateError';
  }
}

/**
 * Invoice has no lines (cannot finalize empty invoice)
 */
export class F3InvoiceEmptyError extends Error {
  code = 'F3012';
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} has no lines (cannot finalize empty invoice)`);
    this.name = 'F3InvoiceEmptyError';
  }
}

/**
 * Invoice total amount is zero (zero-value invoices not allowed)
 */
export class F3ZeroValueInvoiceError extends Error {
  code = 'F3018';
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} has total amount = 0 (zero-value invoices not allowed)`);
    this.name = 'F3ZeroValueInvoiceError';
  }
}

/**
 * Revenue account code is invalid, inactive, or not type=REVENUE
 */
export class F3InvalidRevenueAccountError extends Error {
  code = 'F3015';
  constructor(accountCode: string) {
    super(`Invalid or inactive revenue account: ${accountCode}`);
    this.name = 'F3InvalidRevenueAccountError';
  }
}

/**
 * Invoice is not in FINALIZED status (cannot void)
 */
export class F3InvoiceNotFinalizedError extends Error {
  code = 'F3013';
  constructor(invoiceId: string, currentStatus: string) {
    super(`Invoice ${invoiceId} is not FINALIZED (current: ${currentStatus})`);
    this.name = 'F3InvoiceNotFinalizedError';
  }
}

/**
 * Invoice has allocated payments (cannot void)
 */
export class F3InvoiceHasAllocationsError extends Error {
  code = 'F3014';
  constructor(invoiceId: string, allocatedAmountMinor: number) {
    super(`Invoice ${invoiceId} has allocated payments (${allocatedAmountMinor} minor units, cannot void)`);
    this.name = 'F3InvoiceHasAllocationsError';
  }
}

/**
 * F1 GL posting failed (transaction/reversal)
 */
export class F3PostingFailedError extends Error {
  code = 'F3999';
  constructor(cause: string) {
    super(`F1 GL posting failed: ${cause}`);
    this.name = 'F3PostingFailedError';
  }
}

/**
 * Invalid input (required field missing, invalid format, constraint violation)
 */
export class F3InvalidInputError extends Error {
  code = 'F3020';
  constructor(field: string, reason: string) {
    super(`Invalid input: ${field} - ${reason}`);
    this.name = 'F3InvalidInputError';
  }
}
