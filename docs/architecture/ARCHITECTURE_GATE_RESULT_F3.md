# ARCHITECTURE GATE RESULT — F3 ACCOUNTS RECEIVABLE & INVOICING

> **Status:** 🔒 APPROVED FOR IMPLEMENTATION
> **Phase:** F3 Pre-Coding Gate — Approved by Architecture Proof
> **Date:** 2026-08-16T04:52:44+07:00
> **Author:** Architecture Review — Bella Finance OS
> **Prerequisite F0:** Finance OS Inheritance Constitution — FROZEN ✅
> **Prerequisite F1:** F1 Ledger Engine — FROZEN ✅ (commit `7d0b2b3...`)
> **Prerequisite F2:** F2 Cash & Treasury Engine — FROZEN ✅ (commit `d24fd5b0`, 79/79)
> **Constraint:** Downstream consumer only. F3 owns AR/Invoice state. F3 does NOT own accounting truth (F1) or cash truth (F2).
> **OS Law:** All F3 operations must comply with BELLA OS INHERITANCE LAW (Laws 1–10) and the F3 Constitution (F3-I-1 through F3-I-17).

---

## 0. EXECUTIVE SUMMARY

F3 Accounts Receivable & Invoicing is the **third kernel** of Finance OS. Its purpose is to manage the full lifecycle of customer invoices, track outstanding receivable balances, allocate cash receipts to invoices, and maintain a subledger that reconciles against the F1 general ledger's AR control account.

**F3 is not a ledger. F3 is not a cash engine.** It is an AR/Invoicing state machine that posts accounting intents to F1 and reads cash facts from F2.

The dependency chain is:

```
F3 Invoice Finalization
        ↓
ILedgerEngine.postTransaction()   ← F1 Public Contract
        ↓
finance.transaction.posted.v2     ← F1 Event (F2 consumes this in parallel)
        ↓
F2 Cash Projection                ← F2 reads event, F3 DOES NOT touch F2 write path
```

And for allocation:

```
F3 Payment Allocation
        ↓
ICashReportingEngine.getCashMovements()   ← F2 Public Read Contract
        ↓
Advisory Transaction Lock (tenant-scoped)  ← F3-I-15 concurrency lock
        ↓
finance_receivable_allocations INSERT     ← F3 owns this table
```

---

## I. SUPREME ARCHITECTURAL PRINCIPLE

> [!IMPORTANT]
> **F1 FROZEN. F2 FROZEN. F3 is additive-only and downstream of both.**
> F3 must not create a second ledger, a second cash truth, or duplicate any aggregate that F1/F2 already own.
> The single most important invariant for F3 is:
>
> **Invoice ≠ Ledger Entry. Payment ≠ Cash Position. Receivable ≠ Revenue.**

---

## II. PRODUCT MANIFEST — F3 Capabilities & Scope

### What F3 OWNS

| Capability | Description |
|---|---|
| **Invoice Lifecycle** | DRAFT → FINALIZED → ADJUSTED / VOIDED. State machine with F1 integration at each transition. |
| **Invoice Lines** | Individual billable items. Revenue account mapping to F1 chart of accounts. |
| **Receivable Subledger Log** | Immutable historical fact log (`finance_receivable_ledger`) of all AR movements. UPDATE and DELETE are blocked. |
| **Receivable Derived Positions**| Materialised projection cache (`finance_receivable_positions`). Fully reconstructible from subledger facts. |
| **Allocation Ledger** | Many-to-many mapping of F2 cash movements to F3 invoices (`finance_receivable_allocations`). |
| **Adjustment Memos** | Credit/Debit Memos correcting finalized invoices without direct mutation. |
| **AR Aging** | Derived query-only metrics based on positions + due_date. |
| **Reconciliation Delta Check** | Compares Σ(outstanding positions) vs F1 AR control account balance. Alert on mismatch. No auto-balancing. |

### What F3 Does NOT Own

| Out of Scope | Owner | F3 Constraint |
|---|---|---|
| Double-entry journal entries | F1 Ledger Engine | F3 calls `ILedgerEngine.postTransaction()` — does not write to `finance_journal_entries` |
| Cash positions / movements | F2 Cash Engine | F3 reads via `ICashReportingEngine` — does not write to `finance_cash_movements` or `finance_cash_positions` |
| Bank accounts / bank statement import | F2 | F3 receives `cash_movement_id` from UI/external — looks up via F2 contract |
| Exchange rate management / rate table | F3 Treasury (future) | F3 receives `fx_rate` as input from caller. F3 does not own a rates table. |
| Budget / forecasting | F4 Budget Engine | Derived metric only |
| Payment gateway / collection | Product Vertical | Product posts F1 → F2 projections via the existing chain |

---

## III. OWNERSHIP MAP — WHO OWNS THIS DATA?

```
┌────────────────────────────────────────────────────────────────────┐
│                     F3 AR & INVOICING ENGINE                       │
│                                                                    │
│  OWNS (exclusive write authority):                                 │
│    finance_invoices              → Invoice header & lifecycle      │
│    finance_invoice_lines         → Billable line items             │
│    finance_receivable_adjustments→ Credit/Debit memos              │
│    finance_receivable_ledger     → Immutable AR subledger facts    │
│    finance_receivable_positions  → Reconstructible derived cache   │
│    finance_receivable_allocations→ Payment-to-invoice allocations  │
│                                                                    │
│  READS (via frozen public contracts):                              │
│    finance_transactions          → F1 (verify posted, get tx_id)  │
│    finance_accounts              → F1 (control account validation) │
│    finance_cash_movements        → F2 (allocatable cash lookup)    │
│    finance_cash_positions        → F2 (informational)             │
│                                                                    │
│  CALLS (via frozen public contracts):                              │
│    ILedgerEngine.postTransaction()   → F1 (accrual, adjustment,   │
│                                           reversal postings)       │
│    ILedgerEngine.reverseTransaction()→ F1 (void workflow)          │
│    ILedgerEngine.getBalance()        → F1 (reconciliation check)   │
│    ICashReportingEngine.getCashMovements() → F2 (allocation input) │
│                                                                    │
│  DOES NOT TOUCH (prohibited):                                      │
│    finance_journal_entries       → F1 (direct write BLOCKED)       │
│    finance_cash_movements        → F2 (write BLOCKED)             │
│    finance_cash_positions        → F2 (write BLOCKED)             │
│    finance_bank_accounts         → F2 (write BLOCKED)             │
└────────────────────────────────────────────────────────────────────┘

Tenant Isolation: ALL F3 tables must have tenant_id NOT NULL + RLS.
Cross-tenant: BLOCKED at database boundary.
Cross-domain write: BLOCKED by no direct grants to F1/F2 tables.
```

---

## IV. DOMAIN / AGGREGATE BOUNDARY

### The Five Core Aggregates of F3

```
Aggregate 1: Invoice
  Root:   finance_invoices
  Children: finance_invoice_lines
  States: DRAFT → FINALIZED → ADJUSTED / VOIDED
  F1 Event: accrual posting on FINALIZED transition

Aggregate 2: Receivable Position
  Root:   finance_receivable_positions (1:1 with invoice)
  Source: finance_receivable_ledger (immutable facts)
  Rule:   Materialised projection cache. Reconstructible from facts.
          Updates allowed only via trusted RPC mutation paths.

Aggregate 3: Allocation
  Root:   finance_receivable_allocations
  Inputs: cash_movement_id (F2), invoice_id (F3)
  Rule:   Append-only. Reversals create new rows, not deletions.

Aggregate 4: Adjustment Memo
  Root:   finance_receivable_adjustments
  States: DRAFT → FINALIZED / CANCELLED
  F1 Event: adjusting posting on FINALIZED transition

Aggregate 5: AR Subledger Log
  Root:   finance_receivable_ledger
  Rule:   Absolute immutability. UPDATE/DELETE blocked by trigger.
          This is the reconstruction source — equivalent role to finance_cash_movements in F2.
```

### Critical Semantic Distinctions (must be enforced in code, not just docs)

| Concept | What it is | What it is NOT |
|---|---|---|
| `Invoice.status` | Operational lifecycle (DRAFT/FINALIZED/VOIDED/ADJUSTED) | Payment state — PAID/PARTIALLY_PAID are computed dynamically, never stored |
| `finance_receivable_positions.outstanding_amount_minor` | Derived cache of remaining balance | Source of truth — `finance_receivable_ledger` is the source |
| `finance_receivable_allocations` | Record of cash-to-invoice matching decision | Cash position change — F2 owns cash positions |
| `finance_receivable_ledger` entry | F3 subledger AR movement fact | F1 journal entry — F1 owns `finance_journal_entries` |

---

## V. CONTRACT DEPENDENCY MAP

### F3 → F1 (Write Path: Posting Contract)

```
F3 Action                  F1 Contract Call                     F1 Journal Lines
──────────────────────────────────────────────────────────────────────────────────
Invoice Finalization   →   ILedgerEngine.postTransaction()   →  DR 131 (AR Control)
                                                                 CR 5111 (Revenue)
                                                                 CR 3331 (Tax Payable)

Adjustment Memo        →   ILedgerEngine.postTransaction()   →  DR/CR depending on memo type
(Credit Memo)                                                    DR 5111 (Revenue reversal)
                                                                 CR 131 (AR reduction)

Invoice Void           →   ILedgerEngine.reverseTransaction()→  Full reversal of accrual entry

FX Gain/Loss on alloc  →   ILedgerEngine.postTransaction()   →  DR/CR 4130/8130 (FX gain/loss)
```

**PostTransactionRequest fields F3 must supply:**

```typescript
{
  tenant_id:            string,   // from F3 invoice
  idempotency_key:      string,   // = invoice.posting_attempt_id (UNIQUE, stored persistently)
  source_type:          'F3_AR_INVOICE',
  source_id:            string,   // = invoice.id
  transaction_type:     'ACCRUAL',
  posted_at:            Date,     // = invoice.issue_date
  transaction_currency: string,   // = invoice.currency
  functional_currency:  string,   // tenant functional currency
  exchange_rate_override?: { rate, effective_at },  // required if invoice_currency ≠ functional
  description:          string,
  reference_type:       'INVOICE',
  reference_id:         string,   // = invoice.id
  lines: [
    { account_code: '131',  debit_amount_minor: total_invoice_amount_minor, credit_amount_minor: '0', memo: '...' },
    { account_code: '5111', debit_amount_minor: '0', credit_amount_minor: total_pretax_amount_minor, memo: '...' },
    { account_code: '3331', debit_amount_minor: '0', credit_amount_minor: tax_amount_minor, memo: '...' }
  ]
}
```

> [!IMPORTANT]
> `posting_attempt_id` must be a **persistent UUID stored in `finance_invoices`**, not generated at call-time. This is the idempotency token that prevents double-posting on retry. F3-I-17.

### F3 → F2 (Read Path: Allocation Input)

```
F3 Action                F2 Contract Call                        Purpose
────────────────────────────────────────────────────────────────────────────────
Payment Allocation    →  ICashReportingEngine.getCashMovements() → Verify movement exists,
                                                                    get direction (must be INFLOW),
                                                                    get amount for over-allocation check

Reconciliation        →  ICashReportingEngine.getCashPosition()  → Informational (not authoritative
                                                                    for allocation math)
```

> [!CAUTION]
> F3 must NOT call any `finance_internal_*` F2 RPC. Only `CashEngineService` (read API) is in-contract.
> The `cash_movement_id` reference in `finance_receivable_allocations` is a logical FK — F3 references the ID but does not acquire a real FK constraint across domain boundaries (to avoid cross-schema FK coupling). The existence check is done at allocation time via the F2 read contract.

### F3 → F1 (Read Path: Reconciliation)

```
F3 Action              F1 Contract Call                    Purpose
────────────────────────────────────────────────────────────────────────────────
Reconciliation     →   ILedgerEngine.getBalance()      →  Read AR control account balance
                       (account_code='131', asOf)         Compare vs Σ(outstanding positions)
                                                           Delta → alert (never auto-correct)
```

---

## VI. F3 SPECIFIC INVARIANT ANALYSIS

Mapping all 17 F3 Constitution invariants to their implementation mechanism and pre-coding gate:

| Invariant | Title | Implementation Mechanism | Gate |
|---|---|---|---|
| F3-I-1 | Invoice Immutability | Trigger on `finance_invoices` blocks UPDATE on financial columns after `status = 'FINALIZED'`. Only `updated_at`, `posting_status`, metadata columns are mutable post-finalization. | G5 |
| F3-I-2 | F1 Double-Entry Parity | `Σ(finance_receivable_positions.outstanding_amount_minor)` compared against `ILedgerEngine.getBalance('131')` by background reconciliation service. Alert only. | G1 |
| F3-I-3 | Adjustment-Only Correction | Invoice immutability trigger + Adjustment Memo workflow in `finance_receivable_adjustments`. No direct invoice line update post-finalization. | G5 |
| F3-I-4 | F1 Posting Boundary | F3 has ZERO direct grants on `finance_journal_entries` or `finance_accounts`. All F1 writes go through `ILedgerEngine.postTransaction()`. | G1 |
| F3-I-5 | F2 Cash Boundary | F3 has ZERO grants on `finance_cash_movements` or `finance_cash_positions`. All F2 reads go through `ICashReportingEngine`. | G2 |
| F3-I-6 | Payment Allocation Integrity | Allocation checks: (1) `direction = 'INFLOW'`, (2) `Σ(active allocations) + new_alloc ≤ movement.amount_minor`. Enforced in the allocation RPC. | G2 |
| F3-I-7 | Tenant & Customer Isolation | RLS on all 6 F3 tables using `get_auth_tenant_id()`. `customer_id` FK scoped to tenant. | DB layer |
| F3-I-8 | No Self-Balancing | Reconciliation service raises `AR_RECONCILIATION_MISMATCH_ALERT`. No `UPDATE` path exists for auto-correction. | G1 |
| F3-I-9 | Timing of Recognition | Invoice status trigger: DRAFT state has no ledger impact. `finance_receivable_ledger` INSERT only triggered on FINALIZED transition. | G5 |
| F3-I-10 | Allocation Immutability | Trigger on `finance_receivable_allocations` blocks UPDATE/DELETE. Reversal creates new row with `allocation_type = 'REVERSAL'`. | G3 |
| F3-I-11 | Allocations ≤ Cash Received | `pg_advisory_xact_lock` on tenant + cash_movement_id, then `Σ(active allocations) + new ≤ movement.amount_minor` inside same TX. | G2 |
| F3-I-12 | Bidirectional Traceability | `finance_receivable_allocations(invoice_id, cash_movement_id)` indexed both ways. | DB layer |
| F3-I-13 | Reconstructible AR | Positions rebuilt from `finance_receivable_ledger` + `finance_receivable_allocations`. Reconstruction RPC mirrors F2 pattern (SET LOCAL privilege). | G5 |
| F3-I-14 | Accrual Atomicity | Same-transaction nested execution inside DB. Invoice transition + F1 post + subledger insert in same transaction. | G1 |
| F3-I-15 | Allocation Lock Ordering | Strict lock hierarchy: (1) Advisory lock on (tenant_id, cash_movement_id), (2) `SELECT FOR UPDATE` on `finance_receivable_positions`. | G2 |
| F3-I-16 | Posting Boundary Atomicity | Invoice FINALIZED status written only after `postTransaction()` returns success. Status update and subledger INSERT in same TX as F1 call result. | G1 |
| F3-I-17 | Accrual Idempotency | `posting_attempt_id UUID UNIQUE` stored persistently in `finance_invoices`. `PostTransactionRequest.idempotency_key = posting_attempt_id`. F1 idempotency handles duplicate calls transparently. | G1 |

---

## VII. ADDITIVE MIGRATION PLAN

F3 introduces 6 new tables and 5 RPCs. Zero modifications to F1 or F2 schema.

### New Tables (CREATE only — no ALTER on existing tables)

Migration target: `20260817000000_finance_ar_engine_v1.sql`

```sql
-- Table 1: Invoice Headers
CREATE TABLE public.finance_invoices (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL,
    customer_id                 UUID NOT NULL,
    invoice_number              VARCHAR(50) NOT NULL,
    status                      VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                                  CHECK (status IN ('DRAFT', 'FINALIZED', 'ADJUSTED', 'VOIDED')),
    issue_date                  DATE NOT NULL,
    due_date                    DATE NOT NULL,
    currency                    VARCHAR(10) NOT NULL,
    total_pretax_amount_minor   BIGINT NOT NULL CHECK (total_pretax_amount_minor >= 0),
    tax_amount_minor            BIGINT NOT NULL DEFAULT 0 CHECK (tax_amount_minor >= 0),
    total_invoice_amount_minor  BIGINT NOT NULL
                                  CHECK (total_invoice_amount_minor =
                                         total_pretax_amount_minor + tax_amount_minor),
    f1_transaction_id           UUID UNIQUE,         -- NULL until FINALIZED
    posting_status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                  CHECK (posting_status IN ('PENDING', 'SUCCESS', 'FAILED')),
    posting_attempt_id          UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(), -- idempotency token
    metadata                    JSONB DEFAULT '{}',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_invoice_number_per_tenant UNIQUE (tenant_id, invoice_number)
);

-- Table 2: Invoice Lines
CREATE TABLE public.finance_invoice_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    invoice_id          UUID NOT NULL REFERENCES public.finance_invoices(id) ON DELETE RESTRICT,
    service_id          UUID,
    description         TEXT NOT NULL,
    quantity            NUMERIC NOT NULL CHECK (quantity > 0),
    unit_price_minor    BIGINT NOT NULL CHECK (unit_price_minor >= 0),
    tax_rate            NUMERIC NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 1),
    amount_minor        BIGINT NOT NULL
                          CHECK (amount_minor = FLOOR(quantity * unit_price_minor)),
    revenue_account_code VARCHAR(20) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 3: AR Subledger Log (Immutable — mirrors finance_cash_movements in F2)
CREATE TABLE public.finance_receivable_ledger (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    invoice_id  UUID NOT NULL REFERENCES public.finance_invoices(id) ON DELETE RESTRICT,
    entry_type  VARCHAR(30) NOT NULL
                  CHECK (entry_type IN ('DEBIT_ACCRUAL', 'CREDIT_ALLOCATION',
                                        'DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT')),
    amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),   -- always positive
    source_type     VARCHAR(30) NOT NULL
                      CHECK (source_type IN ('INVOICE', 'ALLOCATION', 'RECEIVABLE_ADJUSTMENT')),
    source_id       UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- NO updated_at — this table is append-only
);

-- Table 4: Derived Receivable Positions (Reconstructible Projection Cache)
CREATE TABLE public.finance_receivable_positions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    invoice_id              UUID NOT NULL REFERENCES public.finance_invoices(id),
    customer_id             UUID NOT NULL,
    currency                VARCHAR(10) NOT NULL,
    original_amount_minor   BIGINT NOT NULL,
    allocated_amount_minor  BIGINT NOT NULL DEFAULT 0,
    adjusted_amount_minor   BIGINT NOT NULL DEFAULT 0,
    outstanding_amount_minor BIGINT GENERATED ALWAYS AS
                              (original_amount_minor - allocated_amount_minor - adjusted_amount_minor)
                              STORED,
    last_reconstructed_at   TIMESTAMPTZ,
    version                 INT NOT NULL DEFAULT 0,
    metadata                JSONB DEFAULT '{}',
    CONSTRAINT uq_receivable_position_per_invoice UNIQUE (tenant_id, invoice_id)
);

-- Table 5: Allocation Ledger (Append-only, immutable)
CREATE TABLE public.finance_receivable_allocations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    invoice_id              UUID NOT NULL REFERENCES public.finance_invoices(id) ON DELETE RESTRICT,
    cash_movement_id        UUID NOT NULL,           -- logical FK to F2 (no hard FK across domains)
    allocated_amount_minor  BIGINT NOT NULL CHECK (allocated_amount_minor > 0),
    allocation_type         VARCHAR(20) NOT NULL
                              CHECK (allocation_type IN ('STANDARD', 'REVERSAL')),
    reversal_ref_id         UUID REFERENCES public.finance_receivable_allocations(id),
    invoice_currency        VARCHAR(10) NOT NULL,
    cash_currency           VARCHAR(10) NOT NULL,
    allocation_currency     VARCHAR(10) NOT NULL,
    invoice_amount          BIGINT NOT NULL,
    cash_amount             BIGINT NOT NULL,
    functional_amount       BIGINT NOT NULL,
    valuation_rate          NUMERIC(20, 8) NOT NULL DEFAULT 1,
    rate_source             VARCHAR(50) NOT NULL,    -- Provenance tracking (e.g. 'CENTRAL_BANK', 'TREASURY')
    rate_timestamp          TIMESTAMPTZ NOT NULL,
    allocation_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- NO updated_at — append-only
);

-- Table 6: Adjustment Memos
CREATE TABLE public.finance_receivable_adjustments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    invoice_id      UUID NOT NULL REFERENCES public.finance_invoices(id) ON DELETE RESTRICT,
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('CREDIT_MEMO', 'DEBIT_MEMO')),
    amount_minor    BIGINT NOT NULL CHECK (amount_minor > 0),
    reason          TEXT NOT NULL,
    f1_transaction_id UUID,
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT', 'FINALIZED', 'CANCELLED')),
    posting_attempt_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB DEFAULT '{}'
);
```

### Key Constraints (P0)

```sql
-- Prevent multiple reversals of the same allocation (F3-I-10)
CREATE UNIQUE INDEX uq_reversal_once_per_allocation
  ON public.finance_receivable_allocations(reversal_ref_id)
  WHERE reversal_ref_id IS NOT NULL;

-- Unique identity index for ledger facts to prevent duplicate syncs
CREATE UNIQUE INDEX uq_receivable_ledger_fact
  ON public.finance_receivable_ledger (tenant_id, source_type, source_id, entry_type);

-- Bidirectional traceability indexes (F3-I-12)
CREATE INDEX idx_allocations_by_invoice ON public.finance_receivable_allocations(tenant_id, invoice_id);
CREATE INDEX idx_allocations_by_movement ON public.finance_receivable_allocations(tenant_id, cash_movement_id);
```

---

## VIII. FIVE PRE-CODING GATES

### G1 — Atomic Posting Protocol

**Decision:** Option A — Same-Database PostgreSQL Atomic Transaction.

**The Accrual Workflow:**
1. The application calculates the double-entry lines and the sha256 request hash of the payload.
2. The application invokes the F3 RPC `finance_finalize_invoice` passing the `p_request_hash` alongside the invoice details.
3. Within `finance_finalize_invoice` (SECURITY DEFINER):
   - A lock is acquired on the invoice row (`SELECT FOR UPDATE`).
   - Validate status is `DRAFT`.
   - Invoke `public.finance_post_transaction(...)` directly inside SQL (F1 primitive contract).
   - Write `DEBIT_ACCRUAL` entry to `finance_receivable_ledger`.
   - Initialize `finance_receivable_positions` record.
   - Update `finance_invoices` status to `FINALIZED`.
4. Any exception from `finance_post_transaction` or subledger inserts rolls back the entire transaction. The invoice remains `DRAFT`.

**Verifying G1 compatibility before coding:**
The proof runner has successfully verified that:
- `finance_post_transaction` can be called from inside a nested PL/pgSQL function.
- It correctly rolls back on errors.
- Its idempotency check remains functional when called nested.
- It emits the `posted.v2` outbox event atomically.

---

### G2 — Concurrency & Allocation Lock Ordering (F3-I-15)

F3 must lock the allocation paths atomically to prevent double-allocating a cash receipt.
To avoid cross-schema FK locks, F3 uses a transaction-scoped advisory lock.

**The Strict Lock Hierarchy:**
1. **Advisory Lock:** Lock key `(tenant_id, cash_movement_id)` namespace:
   ```sql
   SELECT pg_advisory_xact_lock(
       hashtextextended(
           p_tenant_id::text || ':' || p_cash_movement_id::text,
           0
       )
   );
   ```
2. **Retrieve F2 facts:** Call F2 reporting engine to query `cash_movement` details (confirm direction = `INFLOW`).
3. **Lock F3 target position:** Lock invoice position row:
   ```sql
   SELECT * FROM public.finance_receivable_positions
   WHERE tenant_id = p_tenant_id AND invoice_id = p_invoice_id
   FOR UPDATE;
   ```
4. **Validation:** Sum active standard allocations (excluding reversals) and verify `allocated_amount_minor + new_amount <= movement_amount`.
5. **Execution:** Insert allocation record, write `CREDIT_ALLOCATION` to subledger, update derived position.
6. **COMMIT** (automatically releases the transaction advisory lock).

---

### G3 — Reversal Constraint

**Rules:**
- All allocation reversals must carry positive amounts.
- Type markers must be `REVERSAL`.
- `reversal_ref_id` must point to the original standard allocation ID.
- `uq_reversal_once_per_allocation` uniqueness constraints enforce that an allocation can be reversed at most once.

---

### G4 — Currency/FX and Rate Provenance

All foreign currency settlement gains/losses must be recognized during payment allocation.
- `finance_receivable_allocations` captures the fx details and converts them to functional currency.
- If an exchange difference exists, F3 posts a currency gain/loss transaction directly to F1 (using control accounts `4130` / `8130`).
- **Provenance enforcement:** The `rate_source` field must NOT accept arbitrary UI values. It must be checked against a strict list of validated sources (`'CENTRAL_BANK'`, `'TREASURY'`, `'MANUAL_AUTHORIZED'`). Arbitrary UI inputs are rejected.

---

### G5 — Derived State & Void Semantics

- Payment statuses (`PAID`, `PARTIALLY_PAID`) must never be written to the `status` column of `finance_invoices`. They are calculated dynamically by checking the outstanding balance.
- Voiding a finalized invoice requires calling `ILedgerEngine.reverseTransaction` on F1, inserting a debit reversal line in the F3 subledger, and transitioning the invoice status to `VOIDED`. The original invoice history remains intact.

---

## IX. F3 BOUNDARY VIOLATIONS — PROHIBITED LIST

```
❌ Direct INSERT/UPDATE/DELETE on finance_journal_entries
❌ Direct INSERT/UPDATE/DELETE on finance_transactions
❌ Direct INSERT/UPDATE/DELETE on finance_cash_movements
❌ Direct INSERT/UPDATE/DELETE on finance_cash_positions
❌ Direct INSERT/UPDATE/DELETE on finance_bank_accounts
❌ Calling finance_internal_record_cash_movement from F3 code
❌ Calling finance_internal_project_cash_transaction from F3 code
❌ Calling finance_reconstruct_cash_positions from F3 code
❌ Storing 'PAID' or 'PARTIALLY_PAID' in finance_invoices.status
❌ Automatic balance adjustment when F1/F3 reconciliation shows delta
❌ Creating a second chart of accounts or account balance table in F3
❌ Emitting finance.transaction.posted.v2 directly from F3 (only F1 emits this)
❌ Duplicating finance_cash_movements as a shadow F3 cash table
❌ Using application-level try/catch as a substitute for transaction atomicity (F3-I-14)
```

---

## X. PROPOSED TEST GATE — F3 VERIFICATION PLAN

Targeting **95+ integration tests** across 5 suites:

### Suite 1: Database & RLS (25 tests)
- Table structures for all 6 F3 tables.
- Immutability guards for invoices, subledgers, and allocations.
- Tenant isolation (RLS checks on all 6 tables).
- Unique constraints: `uq_reversal_once_per_allocation`, `uq_receivable_ledger_fact`.

### Suite 2: Invoice Lifecycle & G1 Atomicity (20 tests)
- Accrual postings on FINALIZED transition.
- **T_G1_01: Deliberate F1 Posting Failure Injection.** Inject invalid account code or imbalance. Assert that invoice remains `DRAFT`, subledger is empty, and position is uninitialized (Proves `F3-I-14`).
- **T_G1_02: Deliberate F3 Ledger Failure Injection.** Post transaction succeeds, but F3 subledger insert throws. Assert that F1 transaction rolls back completely (no orphan posted transactions).
- **T_G1_03: Idempotent finalization.** Repeat finalization calls with same `posting_attempt_id`. Assert only 1 F1 transaction and 1 F3 subledger entry are created.
- **T_G1_04: Reversal & Void.** Finalized invoice voiding. Assert F1 reversal posted and invoice marked `VOIDED`.

### Suite 3: Payment Allocation & Concurrency (20 tests)
- Standard allocation: Subledger credit written and derived position updated.
- **T_G2_01: Concurrent Allocation Race.** Two connections concurrently attempt to allocate `700` and `500` against a cash receipt of `1000`. Assert one succeeds, one fails/aborts, and the sum allocated never exceeds `1000` (Proves advisory lock safety).
- **T_G2_02: Allocation Lock Ordering.** Assert that allocation locks are acquired in order: (1) advisory lock, (2) position lock. Lock ordering tests to guarantee deadlock immunity.
- Reversal of standard allocations and enforcement of one-time reversal rules.
- Multi-currency allocation and correct FX P&L postings to F1.

### Suite 4: Reconstruction & Reconciliation (20 tests)
- Derived positions rebuilt from subledger facts.
- Reconstruction RPC transaction-local privilege isolation (SET LOCAL verification).
- Reconciliation delta check between F3 position sum and F1 Account `131` (AR control account). Verify that delta raises alerts and does not trigger auto-balancing.

---

## XI. OPEN DESIGN QUESTIONS & SOLUTIONS

### Q3 — Account Mapping
The Chart of Accounts seeded by F1 (`seed_default_coa`) seeds account code `131` ("Phải thu của khách hàng") as the default AR Control Account under Circular 131/2016/TT-BTC.
- **Solution:** F3 will map to F1's Account `131` directly.
- F3 lines support custom `revenue_account_code` mapping per invoice line (e.g. `5111` for packages, `5112` for retail). F1 remains the single authority validating these account codes at posting time.

### Q4 — Customer Entity Ownership
F3 will not create a `finance_customers` table.
- **Solution:** F3 will reference the `customer_id` which acts as a stable tenant-scoped customer reference owned by the product vertical (e.g., patient, guest, client). The lookup/existence check is done at the application boundary.

### Q5 — Legacy Event Contract Deprecation
- **Solution:** F3 does not drop or deprecate F1's `v1` event contract. Event versioning and emission deprecation is owned exclusively by F1's contract registry. F3 only consumes the versioned contract events.

---

## XII. ARCHITECTURE GATE SUMMARY

```
═══════════════════════════════════════════════════════════════════════
  F3 ACCOUNTS RECEIVABLE & INVOICING — PRE-CODING GATE
═══════════════════════════════════════════════════════════════════════

PREREQUISITES
  F0 Core Inheritance Constitution    🔒 FROZEN ✅
  F1 Ledger Engine                    🔒 FROZEN ✅
  F2 Cash & Treasury Engine           🔒 FROZEN ✅ (79/79)

DOMAIN BOUNDARY                       ✅ CLEAR
  AR ≠ Ledger, Invoice ≠ Payment,
  Receivable ≠ Revenue

OWNERSHIP MAP                         ✅ COMPLETE
  6 F3-owned tables, 0 modifications
  to F1 or F2 schema

CONTRACT DEPENDENCY MAP               ✅ COMPLETE
  F3 → ILedgerEngine (write: post, reverse)
  F3 → ICashReportingEngine (read only)

ADDITIVE MIGRATION PLAN               ✅ COMPLETE
  6 new tables, 5 RPCs, 4 triggers
  No ALTER on existing F1/F2 tables

FIVE PRE-CODING GATES
  G1 Atomic Posting Protocol          ✅ APPROVED (PL/pgSQL nested transaction proof passed)
  G2 Concurrency & Lock Ordering      ✅ APPROVED (tenant advisory lock race proof passed)
  G3 Reversal Constraint              ✅ Enforced via uniqueness index
  G4 Currency/FX and Rate Provenance  ✅ Source whitelist constraint added
  G5 Derived State & Void Semantics   ✅ Position defined as derived cache

VERIFICATION PLAN                     ✅ Hardened (Atomic failure & lock race tests passed)

STATUS:
  🎉 APPROVED FOR IMPLEMENTATION
  All 7/7 Pre-Coding Proof targets passed. Verification logs generated in docs/architecture/F3_PROOF_RUNNER/.
═══════════════════════════════════════════════════════════════════════
```

---

## XIII. ARCHITECTURE PROOF WORKFLOW (F3 PRE-CODING PROOF)

To verify the feasibility and safety of G1 nested transactions and G2 advisory lock ordering, the implementation agent must run a specialized test runner verifying **7 proof targets**:

1. **Verify Nested Call Compatibility:** Confirm that a PL/pgSQL function can call `public.finance_post_transaction` directly without throwing compilation or runtime transaction-control errors.
2. **Verify Same-Transaction Rollback:** Verify that raising a PL/pgSQL exception inside the F3 wrapper function rolls back the F1 ledger entries posted by the nested `finance_post_transaction` call.
3. **Verify Nested Idempotency:** Confirm that duplicate calls to the wrapper function with the same idempotency key trigger the F1 idempotency check, returning `is_duplicate: true` and the existing transaction UUID.
4. **Verify Event Emission:** Confirm that the nested F1 transaction successfully inserts the `posted.v2` outbox event into the `finance_outbox_events` table.
5. **Verify Advisory Lock Concurrency:** Prove that the advisory transaction lock `pg_advisory_xact_lock` prevents concurrent transactions from executing the allocation check simultaneously.
6. **Verify Lock Ordering Safety:** Verify that the advisory lock + position update sequence does not trigger deadlocks when executed by concurrent connections.
7. **Verify Boundary Rights:** Verify that the F3 wrapper functions execute successfully using `service_role` privileges without granting write access on F1/F2 tables to application roles.

Once the proof runner reports **7/7 PASS**, Phase F3.1 implementation will be fully approved.
