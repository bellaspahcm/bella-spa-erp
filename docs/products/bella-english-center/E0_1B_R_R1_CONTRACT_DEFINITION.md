# E0.1B-R R1 — F3 AR CONTRACT DEFINITION

**Phase:** R1 Contract Definition  
**Status:** 🟡 **IN PROGRESS**  
**Date:** 2026-09-12

---

## MISSION

Define **one public contract** sufficient for English Center to use F3 AR without knowing RPC/table internals.

**NOT implementation.** R1 = interface definition only.

---

## CONTRACT SCOPE (MINIMAL)

### Operations Covered

**Invoice Lifecycle (4 RPCs → 4 Contract Methods):**
1. Create draft invoice
2. Add invoice line
3. Finalize invoice (trigger F1 posting)
4. Void invoice (governed transition)

**Query (1 Contract Method):**
5. Get invoice (view current state)

**Total Contract Methods:** 5

---

### Operations NOT Covered (Deferred)

- ❌ Payment allocation (F2 integration incomplete)
- ❌ Adjustment memos (RPC missing)
- ❌ Position reconstruction (RPC missing)
- ❌ Batch operations
- ❌ Invoice search/listing

**Rationale:** English Center needs invoice creation + finalization only. Payment/adjustment deferred post-E1.

---

## CONTRACT INTERFACE

### TypeScript Definition

**File:** `src/platform/finance/contracts/f3-ar.contract.ts`

```typescript
/**
 * Platform Finance F3 Accounts Receivable Contract
 * 
 * Provides canonical invoice lifecycle operations for Products.
 * Abstracts DB RPCs and enforces Party-native identity.
 * 
 * @contract IF3AccountsReceivable
 * @owner Platform Finance
 * @consumers Products (English Center, Preschool, etc.)
 */

export interface IF3AccountsReceivable {
  /**
   * Create a DRAFT invoice for a Party
   * 
   * @param input - Invoice creation parameters
   * @returns Invoice result with invoiceId and status
   * @throws F3InvoiceNumberDuplicateError if invoice_number exists for tenant
   * @throws F3InvalidInputError if required fields missing/invalid
   */
  createDraftInvoice(input: CreateInvoiceInput): Promise<InvoiceResult>;

  /**
   * Add a line item to a DRAFT invoice
   * 
   * @param input - Line item parameters
   * @returns Updated invoice result
   * @throws F3InvoiceNotFoundError if invoice does not exist
   * @throws F3InvoiceNotDraftError if invoice status != DRAFT
   * @throws F3InvalidRevenueAccountError if revenue account invalid/inactive
   */
  addInvoiceLine(input: AddInvoiceLineInput): Promise<InvoiceResult>;

  /**
   * Finalize a DRAFT invoice (trigger F1 accrual posting)
   * 
   * Atomic operation:
   * 1. Validate invoice has lines (not empty)
   * 2. Post F1 GL transaction (accrual)
   * 3. Create AR subledger DEBIT_ACCRUAL entry
   * 4. Initialize receivable position cache
   * 5. Transition invoice status DRAFT → FINALIZED
   * 
   * Idempotent: Retries with same invoice return success (no duplicate posting)
   * 
   * @param input - Finalization parameters
   * @returns Finalization result with F1 transaction_id
   * @throws F3InvoiceNotDraftError if invoice already finalized
   * @throws F3InvoiceEmptyError if invoice has no lines
   * @throws F3ZeroValueInvoiceError if total amount = 0
   * @throws F3InvalidRevenueAccountError if any line has invalid account
   * @throws F3PostingFailedError if F1 GL posting fails
   */
  finalizeInvoice(input: FinalizeInvoiceInput): Promise<InvoiceResult>;

  /**
   * Void a FINALIZED invoice (trigger F1 reversal posting)
   * 
   * Governed transition: Only FINALIZED invoices without allocated payments can be voided
   * 
   * Atomic operation:
   * 1. Verify invoice is FINALIZED
   * 2. Verify no payments allocated (outstanding = original)
   * 3. Post F1 reversal transaction (DR/CR flip)
   * 4. Create AR subledger CREDIT_ADJUSTMENT entry
   * 5. Update receivable position (outstanding → 0)
   * 6. Transition invoice status FINALIZED → VOIDED
   * 
   * Idempotent: Retries return same reversal transaction_id
   * 
   * @param input - Void parameters
   * @returns Void result with reversal transaction_id
   * @throws F3InvoiceNotFinalizedError if invoice not FINALIZED
   * @throws F3InvoiceHasAllocationsError if payments already allocated
   * @throws F3PostingFailedError if F1 reversal fails
   */
  voidInvoice(input: VoidInvoiceInput): Promise<InvoiceResult>;

  /**
   * Get current invoice state (header + lines + AR position)
   * 
   * @param input - Query parameters
   * @returns Invoice view with header, lines, position
   * @throws F3InvoiceNotFoundError if invoice does not exist
   */
  getInvoice(input: GetInvoiceInput): Promise<InvoiceView>;
}
```

---

## INPUT TYPES

### CreateInvoiceInput

```typescript
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
```

---

### AddInvoiceLineInput

```typescript
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
```

---

### FinalizeInvoiceInput

```typescript
export interface FinalizeInvoiceInput {
  /** Tenant identifier (required for RLS) */
  tenantId: string;

  /** Invoice identifier (from createDraftInvoice result) */
  invoiceId: string;
}
```

**Note:** Idempotency handled automatically via persistent `posting_attempt_id` in invoice record.

---

### VoidInvoiceInput

```typescript
export interface VoidInvoiceInput {
  /** Tenant identifier (required for RLS) */
  tenantId: string;

  /** Invoice identifier (from createDraftInvoice result) */
  invoiceId: string;
}
```

**Note:** Idempotency handled automatically via persistent `void_posting_attempt_id` in invoice record.

---

### GetInvoiceInput

```typescript
export interface GetInvoiceInput {
  /** Tenant identifier (required for RLS) */
  tenantId: string;

  /** Invoice identifier */
  invoiceId: string;
}
```

---

## OUTPUT TYPES

### InvoiceResult

```typescript
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

export type InvoiceStatus = 'DRAFT' | 'FINALIZED' | 'ADJUSTED' | 'VOIDED';
```

---

### InvoiceView

```typescript
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

export interface InvoiceHeader {
  id: string;
  tenantId: string;
  partyId: string;  // Mapped from customer_id
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

export interface ReceivablePosition {
  invoiceId: string;
  partyId: string;  // Mapped from customer_id
  currency: string;
  originalAmountMinor: number;
  allocatedAmountMinor: number;
  adjustedAmountMinor: number;
  outstandingAmountMinor: number;
  lastReconstructedAt?: string;
  version: number;
}
```

---

## ERROR TYPES

### Domain Errors (8)

```typescript
export class F3InvoiceNotFoundError extends Error {
  code = 'F3002';
  constructor(invoiceId: string) {
    super(`Invoice not found: ${invoiceId}`);
  }
}

export class F3InvoiceNotDraftError extends Error {
  code = 'F3003';
  constructor(invoiceId: string, currentStatus: string) {
    super(`Invoice ${invoiceId} is not DRAFT (current: ${currentStatus})`);
  }
}

export class F3InvoiceNumberDuplicateError extends Error {
  code = 'F3016';
  constructor(invoiceNumber: string) {
    super(`Invoice number already exists: ${invoiceNumber}`);
  }
}

export class F3InvoiceEmptyError extends Error {
  code = 'F3012';
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} has no lines (cannot finalize empty invoice)`);
  }
}

export class F3ZeroValueInvoiceError extends Error {
  code = 'F3018';
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} has total amount = 0 (zero-value invoices not allowed)`);
  }
}

export class F3InvalidRevenueAccountError extends Error {
  code = 'F3015';
  constructor(accountCode: string) {
    super(`Invalid or inactive revenue account: ${accountCode}`);
  }
}

export class F3InvoiceNotFinalizedError extends Error {
  code = 'F3013';
  constructor(invoiceId: string, currentStatus: string) {
    super(`Invoice ${invoiceId} is not FINALIZED (current: ${currentStatus})`);
  }
}

export class F3InvoiceHasAllocationsError extends Error {
  code = 'F3014';
  constructor(invoiceId: string, allocatedAmount: number) {
    super(`Invoice ${invoiceId} has allocated payments (${allocatedAmount} minor units, cannot void)`);
  }
}

export class F3PostingFailedError extends Error {
  code = 'F3999';
  constructor(cause: string) {
    super(`F1 GL posting failed: ${cause}`);
  }
}

export class F3InvalidInputError extends Error {
  code = 'F3020';
  constructor(field: string, reason: string) {
    super(`Invalid input: ${field} - ${reason}`);
  }
}
```

---

## SEMANTICS (FROZEN)

### Identity Semantics

**partyId → finance_invoices.customer_id**

- Contract accepts `partyId` (Party canonical identity)
- Engine maps `partyId` to RPC parameter `customer_id`
- F3 stores as `customer_id` (logical FK to party_parties.id)

**No separate customer entity required.**

---

### Tenant Semantics

**tenantId required in all operations**

- Enforced by RLS at database level
- Contract validates tenantId provided
- Engine passes tenantId to RPCs

**Multi-tenancy mandatory.**

---

### Currency Semantics

**currency = canonical finance currency code**

- ISO 4217 standard (VND, USD, EUR, etc.)
- F3 stores as VARCHAR(10)
- No validation at Contract layer (assume Product provides valid code)
- F1 posting uses same currency

**Single currency per invoice** (multi-currency deferred).

---

### Invoice Number Semantics

**invoiceNumber unique within tenant scope**

- Enforced by database constraint: `UNIQUE (tenant_id, invoice_number)`
- Duplicate throws `F3InvoiceNumberDuplicateError`
- Products responsible for generating unique numbers

**No cross-tenant uniqueness.**

---

### Lifecycle Transition Semantics

**Valid transitions:**
```text
DRAFT → FINALIZED  (via finalizeInvoice)
FINALIZED → VOIDED (via voidInvoice, if no allocations)
FINALIZED → ADJUSTED (future, not implemented)
```

**Invalid transitions blocked:**
```text
DRAFT → VOIDED (must finalize first)
VOIDED → * (terminal state)
ADJUSTED → * (terminal state)
```

**Status transition enforcement:** Database trigger + Contract validation

---

### Idempotency Semantics

**Finalize idempotency:**
- Persistent `posting_attempt_id` per invoice (generated at creation)
- Retry with same invoice returns `{success: true, isDuplicate: true, f1TransactionId: <original>}`
- No duplicate F1 transactions or AR ledger entries

**Void idempotency:**
- Persistent `void_posting_attempt_id` per invoice (generated at creation)
- Retry returns same `f1ReversalTransactionId`
- No duplicate F1 reversals or AR adjustments

**Client does NOT provide idempotency keys** — handled automatically by F3.

---

### Amount Semantics

**Minor units (cents, not dollars):**
- All monetary amounts use `number` type in TypeScript (bigint in DB)
- `unitPriceMinor`, `amountMinor`, `totalInvoiceAmountMinor`, etc.
- Contract does NOT enforce currency formatting
- Products responsible for minor unit conversion (e.g., $10.00 → 1000)

**DB-authoritative rounding:**
- Line amount = FLOOR(quantity * unitPriceMinor)
- Tax = ROUND(amountMinor * taxRate)
- Rounding performed by F3 RPC, NOT Contract

---

### Error Semantics

**Contract throws typed domain errors:**
- Products catch specific error types (e.g., `F3InvoiceNotDraftError`)
- Error codes match DB RPC error codes (F3002, F3003, etc.)
- Error messages include context (invoiceId, status, etc.)

**No generic Error throwing** — all F3 errors are typed.

---

## BLOCKED PATTERNS (MUST NOT)

### ❌ Direct SQL/RPC calls from Products

**Wrong:**
```typescript
// Product code
await supabase.rpc('finance_create_draft_invoice', { ... });
```

**Correct:**
```typescript
// Product code
await f3AR.createDraftInvoice({ ... });
```

---

### ❌ Table/RPC leakage to Product API

**Contract MUST NOT expose:**
- Database table names (`finance_invoices`, etc.)
- RPC function names (`finance_create_draft_invoice`, etc.)
- DB column names (`customer_id`, `posting_attempt_id`, etc.)

**Contract exposes:** Domain concepts only (Invoice, Party, Status, etc.)

---

### ❌ Payment allocation

**NOT in R1 scope:**
```typescript
// ❌ NOT DEFINED
allocatePayment(input: AllocatePaymentInput): Promise<AllocationResult>;
```

**Deferred:** F2 Cash integration incomplete

---

### ❌ Adjustment memos

**NOT in R1 scope:**
```typescript
// ❌ NOT DEFINED
createAdjustment(input: CreateAdjustmentInput): Promise<AdjustmentResult>;
```

**Deferred:** RPC missing

---

### ❌ Schema changes

**R1 does NOT modify:**
- F3 database schema
- F3 RPCs
- F3 immutability triggers
- F3 RLS policies

**R1 is interface definition only.**

---

### ❌ Legacy customers table

**R1 does NOT touch:**
- `customers` table
- `customers.party_id` FK
- Bella Spa CRM

**Out of E0.1B-R scope.**

---

## R1 EXIT CRITERIA

**PASS:**
- [ ] Contract interface defined (`IF3AccountsReceivable`)
- [ ] Contract methods exact: 5/5 (create, add_line, finalize, void, get)
- [ ] Input types defined: 5/5
- [ ] Output types defined: 2/2 (InvoiceResult, InvoiceView)
- [ ] Error types defined: 8/8 (domain errors)
- [ ] Tenant semantics defined ✅
- [ ] Party semantics defined ✅ (partyId maps to customer_id)
- [ ] Lifecycle transitions defined ✅
- [ ] Idempotency semantics defined ✅
- [ ] Amount semantics defined ✅ (minor units)
- [ ] Error semantics defined ✅ (typed errors)
- [ ] No table/RPC leakage to Product API ✅
- [ ] No payment allocation ✅ (deferred)
- [ ] No adjustment memos ✅ (deferred)
- [ ] No schema changes ✅
- [ ] No legacy customers changes ✅
- [ ] Unknowns: 0

**BLOCK:**
- [ ] Contract exposes DB table/RPC names
- [ ] Contract includes payment allocation
- [ ] Contract modifies F3 schema
- [ ] Contract touches legacy customers

---

## R1 DELIVERABLE

**File:** `src/platform/finance/contracts/f3-ar.contract.ts`

**Contents:**
1. Contract interface (`IF3AccountsReceivable`)
2. Input types (5)
3. Output types (2)
4. Error types (8)
5. JSDoc documentation (semantics, idempotency, transitions)

**Lines:** ~400-500 (interface + types + errors + docs)

**Next Phase:** R2 Engine Implementation (wrap 4 RPCs to implement Contract)

---

**R1 Contract Definition in progress. Creating contract file.**
