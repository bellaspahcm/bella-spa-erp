---
remediation_id: E0.1B-R
title: Finance AR Contract Missing
owner: platform-finance-team
severity: blocking
created: 2026-09-12
status: open
blocks_product: bella-english-center
blocks_phase: E1_implementation
---

# E0.1B-R — FINANCE AR CONTRACT MISSING

> **Blocking:** Bella English Center E1 Implementation

---

## 🎯 PROBLEM STATEMENT

### Current State

**Platform Finance Canonical AR Schema EXISTS:**
- Migration: `supabase/migrations/20260817000000_finance_ar_engine_v1.sql`
- Tables: `finance_invoices`, `finance_payments`, `finance_allocations`
- Schema is complete and production-ready

**Public Contract MISSING:**
- File: `src/platform/finance/index.ts`
- Exports: Only `ledger-engine`, `cash-engine`
- **NOT exported:** F3 AR contract (`IFinanceReceivableContract`)

**Impact:** Products CANNOT issue invoices or record payments without contract.

### Gap Discovered By

- **Product:** Bella English Center
- **Phase:** E0.1B Finance Reuse Reconciliation
- **Date:** 2026-09-12
- **Evidence:** `E0_1B_FINANCE_REUSE_RECONCILIATION.md`

### Architecture Decision

**Platform Finance F3 AR is canonical** (NOT Preschool P7 legacy finance)
- Single Writer Principle: Finance = Platform responsibility
- Products MUST NOT create `{product}_invoices` tables (semantic duplication forbidden)
- Products MUST use Platform Finance contract

**Verdict:** Finance AR contract must be delivered before English Center E1.

---

## 🚫 IMPACT ANALYSIS

### Blocks Bella English Center

**Capabilities Blocked: 2**
- `finance_invoice` (cannot issue course fee invoices)
- `enrollment` (cannot verify payment for activation)

**Rules Blocked: 6**
- `INV-FIN-01` (invoice issuance via contract)
- `INV-FIN-02` (payment recording via contract)
- `INV-FIN-03` (enrollment activation payment check)
- `INV-FIN-04` (installment tracking)
- `INV-DISC-01` (discount application)
- `CROSS-ENR-FIN` (enrollment-finance cross-domain consistency)

**Gates Blocked: 2**
- **Gate 2:** Contract Layer (products cannot bypass with raw SQL)
- **Gate 10:** Financial Immutability (SHA-256 fingerprint enforcement)

**Manifest Status:**
```yaml
finance_invoice:
  owner: platform-finance
  source: f3-ar
  mode: reuse
  contract:
    interface: IFinanceReceivableContract
    status: missing  # ❌
  status: blocked
  blocked_by: E0.1B-R

enrollment:
  owner: education-kernel
  mode: reuse
  status: partial_blocked
  blocked_by: E0.1B-R
  blocker_reason: Enrollment activation requires Finance contract for payment verification
```

---

## ✅ REMEDIATION PLAN

### Owner

**Platform Finance Team**

### Scope

**Contract Delivery:**
- Create `IFinanceReceivableContract` interface
- Implement F3 AR engine (schema already exists)
- Export contract from `src/platform/finance/index.ts`
- Document contract operations
- Provide integration tests

### Prerequisites

1. ✅ Finance AR schema exists (`20260817000000_finance_ar_engine_v1.sql`)
2. ✅ Finance Ledger engine available (F1)
3. ✅ Finance Cash engine available (F2)
4. ⏸️ F3 AR engine implementation (pending)

---

## 📋 IMPLEMENTATION TASKS

### Task 1: Contract Interface Definition

**File:** `src/platform/finance/contracts/receivable-engine.contract.ts`

```typescript
/**
 * Finance Accounts Receivable (F3 AR) Contract
 * 
 * Canonical invoice and payment management for Bella Platform.
 * All products MUST use this contract for invoice/payment operations.
 * 
 * Schema: finance_invoices, finance_payments, finance_allocations
 * Migration: 20260817000000_finance_ar_engine_v1.sql
 */

export interface IFinanceReceivableContract {
  /**
   * Issue invoice for customer receivable
   * 
   * @param params Invoice parameters
   * @returns Invoice record with immutable SHA-256 fingerprint
   * @throws InvalidPartyError if party_id not found
   * @throws DuplicateInvoiceError if reference_id already exists
   */
  issueInvoice(params: {
    tenantId: string;
    partyId: string;  // Customer (Student, Parent, Organization)
    invoiceDate: string;  // ISO date
    dueDate: string;
    currency: string;  // 'VND', 'USD'
    lineItems: InvoiceLineItem[];
    referenceType?: string;  // 'enrollment', 'course', 'package'
    referenceId?: string;  // enrollment_id, course_id, etc.
    notes?: string;
  }): Promise<Invoice>;

  /**
   * Record payment against outstanding invoices
   * 
   * @param params Payment parameters
   * @returns Payment record with allocation details
   * @throws InvalidInvoiceError if invoice not found or voided
   * @throws OverpaymentError if payment exceeds outstanding balance (unless allow_overpayment)
   */
  recordPayment(params: {
    tenantId: string;
    partyId: string;
    paymentDate: string;  // ISO date
    amount: number;
    paymentMethod: 'cash' | 'bank_transfer' | 'card' | 'momo' | 'zalopay';
    referenceNumber?: string;  // Bank transaction ID, receipt number
    notes?: string;
    allocations?: PaymentAllocation[];  // Manual allocation (optional)
  }): Promise<Payment>;

  /**
   * Allocate payment to specific invoices
   * 
   * @param params Allocation parameters
   * @returns Allocation records
   * @throws InvalidPaymentError if payment not found
   * @throws InvalidInvoiceError if invoice not found or voided
   * @throws OverallocationError if allocated amount exceeds payment or invoice outstanding
   */
  allocatePayment(params: {
    tenantId: string;
    paymentId: string;
    allocations: Array<{
      invoiceId: string;
      amount: number;
    }>;
  }): Promise<Allocation[]>;

  /**
   * Void invoice (mark as cancelled, prevent further payments)
   * 
   * @param invoiceId Invoice to void
   * @param tenantId Tenant ID
   * @param reason Void reason
   * @returns Voided invoice record
   * @throws InvalidInvoiceError if invoice not found
   * @throws AlreadyPaidError if invoice fully paid (use reversal instead)
   */
  voidInvoice(
    invoiceId: string,
    tenantId: string,
    reason: string
  ): Promise<Invoice>;

  /**
   * Get invoice details with payment/allocation history
   */
  getInvoice(invoiceId: string, tenantId: string): Promise<InvoiceWithAllocations>;

  /**
   * Get customer outstanding balance (all unpaid invoices)
   */
  getOutstandingBalance(partyId: string, tenantId: string): Promise<OutstandingBalance>;

  /**
   * List invoices by criteria
   */
  listInvoices(params: {
    tenantId: string;
    partyId?: string;
    status?: 'unpaid' | 'partially_paid' | 'fully_paid' | 'voided';
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<InvoiceList>;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;  // quantity × unitPrice
  taxRate?: number;
  taxAmount?: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  partyId: string;
  invoiceNumber: string;  // Auto-generated (e.g., INV-2026-001234)
  invoiceDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  outstandingAmount: number;  // Remaining unpaid amount
  status: 'unpaid' | 'partially_paid' | 'fully_paid' | 'voided';
  lineItems: InvoiceLineItem[];
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  fingerprint: string;  // SHA-256 hash (immutability enforcement)
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  partyId: string;
  paymentNumber: string;  // Auto-generated (e.g., PAY-2026-001234)
  paymentDate: string;
  amount: number;
  unallocatedAmount: number;  // Amount not yet allocated to invoices
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAllocation {
  invoiceId: string;
  amount: number;
}

export interface Allocation {
  id: string;
  tenantId: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  allocationDate: string;
  createdAt: string;
}

export interface InvoiceWithAllocations extends Invoice {
  allocations: Array<{
    paymentId: string;
    paymentNumber: string;
    amount: number;
    allocationDate: string;
  }>;
}

export interface OutstandingBalance {
  partyId: string;
  currency: string;
  totalOutstanding: number;
  unpaidInvoices: number;
  partiallyPaidInvoices: number;
  oldestInvoiceDate?: string;
  invoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    outstandingAmount: number;
    daysOverdue: number;
  }>;
}

export interface InvoiceList {
  invoices: Invoice[];
  total: number;
  limit: number;
  offset: number;
}
```

---

### Task 2: Engine Implementation

**File:** `src/platform/finance/receivable-engine/receivable-engine.service.ts`

```typescript
export class FinanceReceivableEngine implements IFinanceReceivableContract {
  constructor(
    private db: Database,
    private ledgerEngine: ILedgerContract,  // F1 integration
    private eventBus: EventBus
  ) {}

  async issueInvoice(params: {
    tenantId: string;
    partyId: string;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    lineItems: InvoiceLineItem[];
    referenceType?: string;
    referenceId?: string;
    notes?: string;
  }): Promise<Invoice> {
    // Validate Party exists
    const party = await this.db.queryOne(`
      SELECT id FROM party_parties
      WHERE id = $1 AND tenant_id = $2
    `, [params.partyId, params.tenantId]);

    if (!party) {
      throw new InvalidPartyError(`Party ${params.partyId} not found`);
    }

    // Calculate totals
    const subtotal = params.lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = params.lineItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
    const totalAmount = subtotal + taxAmount;

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(params.tenantId);

    // Calculate fingerprint (immutability)
    const fingerprint = this.calculateFingerprint({
      tenantId: params.tenantId,
      partyId: params.partyId,
      invoiceNumber,
      invoiceDate: params.invoiceDate,
      lineItems: params.lineItems,
      totalAmount,
    });

    // Insert invoice (DB transaction)
    const invoice = await this.db.transaction(async (trx) => {
      const inv = await trx.insert('finance_invoices', {
        tenant_id: params.tenantId,
        party_id: params.partyId,
        invoice_number: invoiceNumber,
        invoice_date: params.invoiceDate,
        due_date: params.dueDate,
        currency: params.currency,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        outstanding_amount: totalAmount,
        status: 'unpaid',
        line_items: JSON.stringify(params.lineItems),
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        notes: params.notes,
        fingerprint,
      });

      // Post to Ledger (F1 integration)
      await this.ledgerEngine.postJournalEntry({
        tenantId: params.tenantId,
        entryDate: params.invoiceDate,
        description: `Invoice ${invoiceNumber} issued`,
        lines: [
          {
            account: 'Accounts Receivable',
            debit: totalAmount,
            credit: 0,
            partyId: params.partyId,
          },
          {
            account: 'Revenue',
            debit: 0,
            credit: subtotal,
          },
          {
            account: 'Tax Payable',
            debit: 0,
            credit: taxAmount,
          },
        ],
        referenceType: 'invoice',
        referenceId: inv.id,
      });

      return inv;
    });

    // Publish domain event (AFTER DB commit)
    await this.eventBus.publish({
      type: 'finance.invoice.issued',
      tenantId: params.tenantId,
      payload: {
        invoiceId: invoice.id,
        partyId: params.partyId,
        totalAmount,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      },
    });

    return invoice;
  }

  async recordPayment(params: {
    tenantId: string;
    partyId: string;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string;
    notes?: string;
    allocations?: PaymentAllocation[];
  }): Promise<Payment> {
    // Generate payment number
    const paymentNumber = await this.generatePaymentNumber(params.tenantId);

    // Insert payment + allocate (DB transaction)
    const payment = await this.db.transaction(async (trx) => {
      const pmt = await trx.insert('finance_payments', {
        tenant_id: params.tenantId,
        party_id: params.partyId,
        payment_number: paymentNumber,
        payment_date: params.paymentDate,
        amount: params.amount,
        unallocated_amount: params.amount,
        payment_method: params.paymentMethod,
        reference_number: params.referenceNumber,
        notes: params.notes,
      });

      // Auto-allocate if allocations provided
      if (params.allocations && params.allocations.length > 0) {
        await this.allocatePaymentInternal(trx, {
          tenantId: params.tenantId,
          paymentId: pmt.id,
          allocations: params.allocations,
        });
      }

      // Post to Ledger (F1 integration)
      await this.ledgerEngine.postJournalEntry({
        tenantId: params.tenantId,
        entryDate: params.paymentDate,
        description: `Payment ${paymentNumber} received`,
        lines: [
          {
            account: params.paymentMethod === 'cash' ? 'Cash' : 'Bank',
            debit: params.amount,
            credit: 0,
          },
          {
            account: 'Accounts Receivable',
            debit: 0,
            credit: params.amount,
            partyId: params.partyId,
          },
        ],
        referenceType: 'payment',
        referenceId: pmt.id,
      });

      return pmt;
    });

    // Publish domain event (AFTER DB commit)
    await this.eventBus.publish({
      type: 'finance.payment.received',
      tenantId: params.tenantId,
      payload: {
        paymentId: payment.id,
        partyId: params.partyId,
        amount: params.amount,
      },
    });

    return payment;
  }

  // ... (implement remaining contract methods)
}
```

---

### Task 3: Export Contract

**File:** `src/platform/finance/index.ts`

```typescript
// Existing exports
export * from './ledger-engine';
export * from './cash-engine';

// ✅ NEW: Export F3 AR contract
export * from './receivable-engine';
export * from './contracts/receivable-engine.contract';
```

---

### Task 4: Integration Tests

**File:** `src/platform/finance/__tests__/receivable-engine.integration.test.ts`

```typescript
describe('Finance Receivable Engine (F3 AR)', () => {
  let receivableEngine: IFinanceReceivableContract;
  let testTenantId: string;
  let testPartyId: string;

  beforeAll(async () => {
    // Setup test DB + tenant + party
  });

  describe('issueInvoice', () => {
    it('should issue invoice with line items', async () => {
      const invoice = await receivableEngine.issueInvoice({
        tenantId: testTenantId,
        partyId: testPartyId,
        invoiceDate: '2026-09-15',
        dueDate: '2026-10-15',
        currency: 'VND',
        lineItems: [
          {
            description: 'IELTS Course - Level 5',
            quantity: 1,
            unitPrice: 5000000,
            amount: 5000000,
          },
        ],
        referenceType: 'enrollment',
        referenceId: 'enr-001',
      });

      expect(invoice.id).toBeDefined();
      expect(invoice.invoiceNumber).toMatch(/^INV-/);
      expect(invoice.totalAmount).toBe(5000000);
      expect(invoice.outstandingAmount).toBe(5000000);
      expect(invoice.status).toBe('unpaid');
      expect(invoice.fingerprint).toBeDefined();
    });

    it('should reject invoice for non-existent party', async () => {
      await expect(
        receivableEngine.issueInvoice({
          tenantId: testTenantId,
          partyId: 'invalid-party-id',
          // ...
        })
      ).rejects.toThrow('Party invalid-party-id not found');
    });
  });

  describe('recordPayment', () => {
    it('should record payment and auto-allocate', async () => {
      const invoice = await receivableEngine.issueInvoice({ /* ... */ });

      const payment = await receivableEngine.recordPayment({
        tenantId: testTenantId,
        partyId: testPartyId,
        paymentDate: '2026-09-16',
        amount: 2000000,
        paymentMethod: 'bank_transfer',
        allocations: [
          { invoiceId: invoice.id, amount: 2000000 },
        ],
      });

      expect(payment.amount).toBe(2000000);
      expect(payment.unallocatedAmount).toBe(0);

      // Verify invoice updated
      const updatedInvoice = await receivableEngine.getInvoice(invoice.id, testTenantId);
      expect(updatedInvoice.outstandingAmount).toBe(3000000);  // 5M - 2M
      expect(updatedInvoice.status).toBe('partially_paid');
    });
  });

  describe('getOutstandingBalance', () => {
    it('should calculate outstanding balance across invoices', async () => {
      // Create 2 invoices, partially pay 1
      await receivableEngine.issueInvoice({ amount: 5000000, ... });
      await receivableEngine.issueInvoice({ amount: 3000000, ... });
      await receivableEngine.recordPayment({ amount: 2000000, ... });

      const balance = await receivableEngine.getOutstandingBalance(testPartyId, testTenantId);

      expect(balance.totalOutstanding).toBe(6000000);  // 5M - 2M + 3M
      expect(balance.unpaidInvoices).toBe(1);
      expect(balance.partiallyPaidInvoices).toBe(1);
    });
  });
});
```

**Run Tests:**
```bash
npm run test:finance-receivable
```

**Expected:** All tests GREEN

---

### Task 5: Documentation

**File:** `src/platform/finance/README.md`

**Add F3 AR Documentation:**

```markdown
## F3 Accounts Receivable (AR) Engine

### Overview

Finance AR engine manages customer invoices and payments for Bella Platform.

**Canonical Tables:**
- `finance_invoices`
- `finance_payments`
- `finance_allocations`

**Contract:** `IFinanceReceivableContract`

### Usage

```typescript
import { IFinanceReceivableContract } from '@platform/finance';

// Issue invoice
const invoice = await financeAR.issueInvoice({
  tenantId,
  partyId: studentPartyId,
  invoiceDate: '2026-09-15',
  dueDate: '2026-10-15',
  currency: 'VND',
  lineItems: [
    { description: 'Course Fee', quantity: 1, unitPrice: 5000000, amount: 5000000 },
  ],
  referenceType: 'enrollment',
  referenceId: enrollmentId,
});

// Record payment
const payment = await financeAR.recordPayment({
  tenantId,
  partyId: studentPartyId,
  paymentDate: '2026-09-16',
  amount: 2000000,
  paymentMethod: 'bank_transfer',
  allocations: [
    { invoiceId: invoice.id, amount: 2000000 },
  ],
});
```

### Contract Operations

- `issueInvoice()` — Create customer invoice
- `recordPayment()` — Record payment received
- `allocatePayment()` — Allocate payment to invoices
- `voidInvoice()` — Cancel invoice
- `getInvoice()` — Retrieve invoice with allocations
- `getOutstandingBalance()` — Customer outstanding balance
- `listInvoices()` — Query invoices by criteria

### Integration Points

- **F1 Ledger:** Posts journal entries for invoices/payments
- **Event Bus:** Publishes `finance.invoice.issued`, `finance.payment.received`
- **Product Contracts:** English Center enrollment activation

### Immutability

Invoices include SHA-256 fingerprint to prevent tampering after issuance.
```

---

## ✅ ACCEPTANCE CRITERIA

### Contract Delivery Complete When:

1. ✅ `IFinanceReceivableContract` interface defined
2. ✅ `FinanceReceivableEngine` class implemented
3. ✅ Contract exported from `src/platform/finance/index.ts`
4. ✅ Integration tests pass (100% coverage)
5. ✅ Documentation complete
6. ✅ Ledger integration (F1) working
7. ✅ Event publishing working
8. ✅ SHA-256 fingerprint enforcement working
9. ✅ No breaking changes to existing F1/F2 contracts
10. ✅ Preschool can adopt F3 AR (validate with sample integration)

---

## 🔓 UNBLOCK ACTIONS

### After Contract Delivered:

**Update Bella English Center Manifest:**
```yaml
# bella-english-center.manifest.yaml

finance_invoice:
  owner: platform-finance
  source: f3-ar
  mode: reuse
  contract:
    interface: IFinanceReceivableContract
    location: src/platform/finance/contracts/receivable-engine.contract.ts
    status: available  # ✅ Changed from missing
    operations:
      - issueInvoice
      - recordPayment
      - allocatePayment
      - voidInvoice
  status: ready  # ✅ Changed from blocked
  # blocked_by: E0.1B-R  # ✅ Removed

enrollment:
  owner: education-kernel
  mode: reuse
  status: ready  # ✅ Changed from partial_blocked
  # blocked_by: E0.1B-R  # ✅ Removed

blocking_gaps:
  # E0.1B-R: removed  # ✅ Gap closed
  # E0.1A-R still open if not resolved

gates:
  2:
    name: Contract Layer
    enforcement: ci_gate
    status: ready  # ✅ Changed from partial_blocked
    # blocked_by: E0.1B-R  # ✅ Removed

  10:
    name: Financial Immutability
    enforcement: runtime
    status: ready  # ✅ Changed from blocked
    # blocked_by: E0.1B-R  # ✅ Removed

rules:
  business_invariants:
    rules:
      INV-FIN-03:
        status: ready  # ✅ Changed from blocked
        # blocked_by: E0.1B-R  # ✅ Removed

  architecture_invariants:
    rules:
      INV-FIN-01: {status: ready}  # ✅ Unblocked
      INV-FIN-02: {status: ready}  # ✅ Unblocked

  policies:
    rules:
      INV-FIN-04: {status: ready}  # ✅ Unblocked
      INV-DISC-01: {status: ready}  # ✅ Unblocked

readiness:
  capabilities_ready: 20  # ✅ +2 (finance_invoice, enrollment unblocked)
  capabilities_total: 22
  rules_ready: 44  # ✅ +6 (all finance rules unblocked)
  rules_total: 44
  gates_ready: 11  # ✅ +2 (Gate 2, 10 unblocked) — if E0.1A-R also resolved
  gates_total: 11
  ready_percentage: 100  # ✅ If E0.1A-R also resolved
```

**Readiness Impact:**
- Capabilities: 18/22 → 20/22 (90.9%)
- Rules: 38/44 → 44/44 (100%) ⭐ **All rules ready**
- Gates: 9/11 → 11/11 (100%) ⭐ **All gates ready if E0.1A-R also resolved**

---

## 📊 RISK ASSESSMENT

### Medium Risk

- **New Contract:** First delivery of F3 AR contract
- **Integration Complexity:** F1 Ledger + Event Bus coordination
- **Preschool Migration:** Existing P7 finance → F3 AR migration path

### Mitigation

1. **Comprehensive Integration Tests** (100% coverage)
2. **Preschool Pilot:** Test F3 AR with Preschool first (smaller scope)
3. **Phased Rollout:**
   - Week 1: Contract + Engine implementation + tests
   - Week 2: Preschool sample integration
   - Week 3: English Center integration
4. **Rollback Plan:** F3 AR optional initially, products can defer adoption

---

## 📅 TIMELINE

### Estimated Duration: 2-3 weeks

**Week 1:** Contract interface + Engine implementation + Integration tests
**Week 2:** Documentation + Preschool pilot integration
**Week 3:** English Center validation + Registry update

### Parallel to E0.5

This remediation can run **parallel** to English Center E0.5 manifest finalization.

---

## 📝 STATUS TRACKING

```text
E0.1B-R FINANCE AR CONTRACT

Status:                        🔴 OPEN
Owner:                         Platform Finance Team
Estimated Effort:              2-3 weeks
Blocks:                        Bella English Center E1

Tasks:
  Contract Interface           ⏸️ NOT STARTED
  Engine Implementation        ⏸️ NOT STARTED
  Contract Export              ⏸️ NOT STARTED
  Integration Tests            ⏸️ NOT STARTED
  Documentation                ⏸️ NOT STARTED

Acceptance Criteria:           0/10 complete

Next Action:                   Platform Finance to schedule implementation
```

---

**CREATED:** 2026-09-12
**OWNER:** Platform Finance Team
**PRIORITY:** High (blocks product implementation)
**TRACKING:** Update this document as tasks complete

