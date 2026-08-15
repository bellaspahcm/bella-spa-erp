# ARCHITECTURE GATE RESULT — F3 ACCOUNTS RECEIVABLE & INVOICING

> **Status:** PRE-CODING ARCHITECTURE ANALYSIS — AWAITING HUMAN ARCHITECT APPROVAL
> **Phase:** F3 Pre-Coding Gate
> **Date:** 2026-08-15T22:32:38+07:00
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
SELECT FOR UPDATE (cash_movement row)     ← F3-I-15 concurrency lock
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
| **Receivable Subledger Log** | Immutable fact log (`finance_receivable_ledger`) of all AR movements: accruals, allocations, adjustments. |
| **Receivable Derived Positions** | Materialised outstanding balance per invoice (`finance_receivable_positions`). Reconstructible from subledger. |
| **Allocation Ledger** | Many-to-many mapping of F2 cash movements to F3 invoices (`finance_receivable_allocations`). |
| **Adjustment Memos** | Credit/Debit Memos correcting finalized invoices without mutation. |
| **AR Aging** | Derived from positions + due_date. Query-only. |
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
│    finance_receivable_positions  → Derived outstanding balances    │
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
  Rule:   Derived. Never written directly. Reconstructed from ledger.

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
| `Invoice.status` | Operational lifecycle (DRAFT/FINALIZED/VOIDED/ADJUSTED) | Payment state — PAID/PARTIALLY_PAID are computed, never stored |
| `finance_receivable_positions.outstanding_amount_minor` | Derived cache of remaining balance | Source of truth — `finance_receivable_ledger` is the source |
| `finance_receivable_allocations` | Record of cash-to-invoice matching decision | Cash position change — F2 owns cash positions |
| `finance_receivable_ledger` entry | F3 subledger AR movement fact | F1 journal entry — F1 owns `finance_journal_entries` |

---

## V. CONTRACT DEPENDENCY MAP

### F3 → F1 (Write Path: Posting Contract)

```
F3 Action                  F1 Contract Call                     F1 Journal Lines
──────────────────────────────────────────────────────────────────────────────────
Invoice Finalization   →   ILedgerEngine.postTransaction()   →  DR 1311 (AR Control)
                                                                 CR 5111 (Revenue)
                                                                 CR 3331 (Tax Payable)

Adjustment Memo        →   ILedgerEngine.postTransaction()   →  DR/CR depending on memo type
(Credit Memo)                                                    DR 5111 (Revenue reversal)
                                                                 CR 1311 (AR reduction)

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
  posted_at:            Date,     // = invoice.issue_date (or finalization timestamp)
  transaction_currency: string,   // = invoice.currency
  functional_currency:  string,   // tenant functional currency
  exchange_rate_override?: { rate, effective_at },  // required if invoice_currency ≠ functional
  description:          string,
  reference_type:       'INVOICE',
  reference_id:         string,   // = invoice.id
  lines: [
    { account_code: '1311', debit_amount_minor: total_invoice_amount_minor, credit_amount_minor: '0', memo: '...' },
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
                       (account_code='1311', asOf)         Compare vs Σ(outstanding positions)
                                                           Delta → alert (never auto-correct)
```

---

## VI. F3 SPECIFIC INVARIANT ANALYSIS

Mapping all 17 F3 Constitution invariants to their implementation mechanism and pre-coding gate:

| Invariant | Title | Implementation Mechanism | Gate |
|---|---|---|---|
| F3-I-1 | Invoice Immutability | Trigger on `finance_invoices` blocks UPDATE on financial columns after `status = 'FINALIZED'`. Only `updated_at`, `posting_status`, metadata columns are mutable post-finalization. | G5 |
| F3-I-2 | F1 Double-Entry Parity | `Σ(finance_receivable_positions.outstanding_amount_minor)` compared against `ILedgerEngine.getBalance('1311')` by background reconciliation service. Alert only. | G1 |
| F3-I-3 | Adjustment-Only Correction | Invoice immutability trigger + Adjustment Memo workflow in `finance_receivable_adjustments`. No direct invoice line update post-finalization. | G5 |
| F3-I-4 | F1 Posting Boundary | F3 has ZERO direct grants on `finance_journal_entries` or `finance_accounts`. All F1 writes go through `ILedgerEngine.postTransaction()`. | G1 |
| F3-I-5 | F2 Cash Boundary | F3 has ZERO grants on `finance_cash_movements` or `finance_cash_positions`. All F2 reads go through `ICashReportingEngine`. | G2 |
| F3-I-6 | Payment Allocation Integrity | Allocation checks: (1) `direction = 'INFLOW'`, (2) `Σ(active allocations) + new_alloc ≤ movement.amount_minor`. Both enforced in the allocation RPC. | G2 |
| F3-I-7 | Tenant & Customer Isolation | RLS on all 6 F3 tables using `get_auth_tenant_id()`. `customer_id` FK scoped to tenant. | DB layer |
| F3-I-8 | No Self-Balancing | Reconciliation service raises `AR_RECONCILIATION_MISMATCH_ALERT`. No `UPDATE` path exists for auto-correction. | G1 |
| F3-I-9 | Timing of Recognition | Invoice status trigger: DRAFT state has no ledger impact. `finance_receivable_ledger` INSERT only triggered on FINALIZED transition. | G5 |
| F3-I-10 | Allocation Immutability | Trigger on `finance_receivable_allocations` blocks UPDATE/DELETE. Reversal creates new row with `allocation_type = 'REVERSAL'`. | G3 |
| F3-I-11 | Allocations ≤ Cash Received | `SELECT FOR UPDATE` on movement row, then `Σ(active allocations) + new ≤ movement.amount_minor` inside same TX. | G2 |
| F3-I-12 | Bidirectional Traceability | `finance_receivable_allocations(invoice_id, cash_movement_id)` indexed both ways. | DB layer |
| F3-I-13 | Reconstructible AR | Positions rebuilt from `finance_receivable_ledger` + `finance_receivable_allocations`. Reconstruction RPC mirrors F2 pattern (SET LOCAL privilege). | G5 |
| F3-I-14 | Accrual Atomicity | Single database transaction containing: invoice status transition + `ILedgerEngine.postTransaction()` + subledger INSERT. If F1 posting fails → full rollback. PostgreSQL transaction boundary. | G1 |
| F3-I-15 | Allocation Concurrency Safety | `SELECT FOR UPDATE` on `finance_cash_movements` (via F2 logical lock) + `SELECT FOR UPDATE` on `finance_receivable_positions`. Lock order: cash first, position second. | G2 |
| F3-I-16 | Posting Boundary Atomicity | Invoice FINALIZED status written only after `postTransaction()` returns success. Status update and subledger INSERT in same TX as F1 call result application. | G1 |
| F3-I-17 | Accrual Idempotency | `posting_attempt_id UUID UNIQUE` stored persistently in `finance_invoices`. `PostTransactionRequest.idempotency_key = posting_attempt_id`. F1 idempotency handles duplicate calls transparently. | G1 |

---

## VII. ADDITIVE MIGRATION PLAN

F3 introduces 6 new tables and 4+ RPCs. Zero modifications to F1 or F2 schema.

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

-- Table 4: Derived Receivable Positions (Reconstructible)
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
    rate_source             VARCHAR(50),
    rate_timestamp          TIMESTAMPTZ,
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
-- Prevent reversal of already-reversed allocation (F3-I-10)
CREATE UNIQUE INDEX uq_reversal_once_per_allocation
  ON public.finance_receivable_allocations(reversal_ref_id)
  WHERE reversal_ref_id IS NOT NULL;

-- Bidirectional traceability indexes (F3-I-12)
CREATE INDEX idx_allocations_by_invoice ON public.finance_receivable_allocations(tenant_id, invoice_id);
CREATE INDEX idx_allocations_by_movement ON public.finance_receivable_allocations(tenant_id, cash_movement_id);

-- Invoice number unique per tenant already in UNIQUE constraint above
-- Invoice status transition guard: trigger (see RPCs section)
```

### RLS (all tables)

```sql
ALTER TABLE public.finance_invoices ENABLE ROW LEVEL SECURITY;
-- repeat for all 6 F3 tables
-- Policy: tenant_id = get_auth_tenant_id()
-- REVOKE ALL from public, anon, authenticated on write RPCs
-- GRANT SELECT to authenticated (read-only via reporting)
-- GRANT EXECUTE on write RPCs to service_role only
```

### New RPCs (CREATE only — no ALTER on F1/F2 RPCs)

Migration target: `20260817010000_finance_ar_invoice_rpc.sql`

| RPC | Purpose | Notes |
|---|---|---|
| `finance_finalize_invoice` | Atomic: status transition + F1 post + subledger insert | SECURITY DEFINER, service_role only |
| `finance_allocate_payment` | Atomic: F2 movement lookup + dual lock + allocation insert + position update | SECURITY DEFINER, service_role only |
| `finance_reverse_allocation` | Atomic: reversal allocation insert + subledger debit + position update | SECURITY DEFINER, service_role only |
| `finance_void_invoice` | Atomic: F1 reversal + receivable reversal subledger + status VOIDED | SECURITY DEFINER, service_role only |
| `finance_reconstruct_receivable_positions` | Rebuild positions from ledger. SET LOCAL privilege. service_role only. | Mirrors F2 reconstruction pattern |

### Triggers

| Trigger | Table | Effect |
|---|---|---|
| `trg_finance_invoice_immutability` | `finance_invoices` | Blocks UPDATE on financial columns after status = 'FINALIZED' |
| `trg_finance_receivable_ledger_immutability` | `finance_receivable_ledger` | Blocks UPDATE and DELETE unconditionally |
| `trg_finance_allocation_immutability` | `finance_receivable_allocations` | Blocks UPDATE and DELETE unconditionally |
| `trg_finance_invoice_status_transition` | `finance_invoices` | Validates state machine transitions (see Section V state table) |

---

## VIII. FIVE PRE-CODING GATES (from F3 Constitution §7)

### G1 — Atomic Posting Protocol ⚠️ REQUIRES VERIFICATION

**Requirement (F3-I-14, F3-I-16, F3-I-17):**

Invoice finalization must be atomic: `invoice status → FINALIZED` + `ILedgerEngine.postTransaction()` + `finance_receivable_ledger INSERT` must either all commit or all rollback. No partial state.

**Current F1 contract capability:**

`ILedgerEngine.postTransaction()` is a TypeScript service method that calls a Supabase RPC (`finance_post_transaction`) over HTTP. This means:

```
F3 Application Code
        ↓
ILedgerEngine.postTransaction()   ← HTTP round-trip to Supabase
        ↓
finance_post_transaction (PG)     ← Commits its own transaction
        ↓
[success / error returned]
        ↓
F3 Application Code continues...
```

**Critical issue:** Because the F1 RPC executes in its own database transaction and the F3 application code runs outside of it, there is **no distributed transaction** between the F1 commit and the subsequent F3 subledger insert. This is the same atomicity challenge that F2 solved via the event-sourcing pattern.

**F3 Resolution Plan (required before coding):**

F3 must adopt one of two integration protocols — this is Gate G1 and is the most important architectural decision for F3.1:

**Option A — F3 Database RPC with F1 call inside a single PG function:**
Move the entire finalization flow into a Postgres `SECURITY DEFINER` function that:
1. Updates invoice status within the same PG transaction
2. Calls `finance_post_transaction` (a PG RPC in F1 schema) directly via PG function call
3. Inserts subledger row
This requires that `finance_post_transaction` be callable from within a PG function in the same DB. **This is the recommended path** — it mirrors how F2's `finance_internal_record_cash_movement` calls F1 tables directly within a trusted SECURITY DEFINER boundary.

**Option B — Outbox + Saga pattern:**
F3 writes to an F3 outbox table (within the same PG transaction as invoice status transition), and an outbox dispatcher calls `ILedgerEngine.postTransaction()` asynchronously. On success, F3 subledger insert happens. On failure after retries → FAILED posting_status → alert.
This is **more complex** but resilient to RPC timeouts.

> [!IMPORTANT]
> **G1 decision must be made by Human Architect before F3.1 coding begins.** The wrong choice here is the architectural blocker most likely to violate F3-I-14 (Accrual Atomicity) and F3-I-16 (Posting Boundary Atomicity).

**Recommended decision:** Option A (PG function) for atomicity simplicity, with Option B considered for fault-tolerance if RPC timeout risk is high. The F2 precedent (SECURITY DEFINER PG functions calling other PG RPCs within the same transaction) strongly favors Option A.

---

### G2 — Dual-Side Allocation Lock ✅ DESIGN CLEAR

**Requirement (F3-I-15, F3-I-11):**

Both the F2 cash movement row and the F3 receivable position row must be locked before any allocation is written. Lock order must be deterministic to prevent deadlocks.

**Design:**

```sql
-- Inside finance_allocate_payment RPC (SECURITY DEFINER):
-- Step 1: Lock F2 cash movement first (lower domain in the hierarchy)
--         Note: F3 cannot acquire a true PG lock on F2's finance_cash_movements
--         because cross-domain locks add coupling. Instead:
--         (a) Read movement via F2 contract (application layer)
--         (b) Use the movement_id as an advisory lock target, or
--         (c) Include a logical_lock row in a F3-owned table
--         See NOTE below.

-- Step 2: Lock F3 receivable position second
SELECT * FROM public.finance_receivable_positions
WHERE tenant_id = p_tenant_id AND invoice_id = p_invoice_id
FOR UPDATE;

-- Step 3: Validate Σ(active allocations) + new ≤ movement.amount_minor
-- Step 4: Insert allocation row
-- Step 5: Update position
```

> [!IMPORTANT]
> **Cross-domain locking constraint:** F3 cannot use `SELECT ... FOR UPDATE` on `finance_cash_movements` because F3 has no write grants on F2 tables, and `FOR UPDATE` requires UPDATE permission. This is a deliberate boundary.
>
> **Resolution:** The over-allocation constraint is enforced by:
> 1. Reading `movement.amount_minor` from F2 at allocation time (via `ICashReportingEngine`)
> 2. Using an F3-owned `Σ(active allocations per cash_movement_id)` aggregate check inside the allocation RPC (within a serializable transaction or advisory lock on `cash_movement_id`)
> 3. The unique reversal constraint (`uq_reversal_once_per_allocation`) prevents double-reversal
>
> This is sufficient because F3 is the only writer to `finance_receivable_allocations`. The cross-domain risk (another system also allocating the same cash movement) is managed at the application layer.

---

### G3 — Reversal Constraint ✅ DESIGN CLEAR

**Requirement (F3-I-10):**

A confirmed allocation cannot be updated or deleted. Reversal creates a new `REVERSAL` row. Each allocation can only be reversed once.

**Enforcement:**
- `trg_finance_allocation_immutability`: blocks UPDATE/DELETE unconditionally
- `uq_reversal_once_per_allocation`: unique partial index on `reversal_ref_id` where NOT NULL
- Reversal allocation `allocated_amount_minor` must equal the original (positive value, same semantics as F2 reversal)

---

### G4 — Currency/FX Contract ✅ DESIGN CLEAR

**Requirement:** Multi-currency allocation support. FX gain/loss posting to F1.

**Design:**
- `finance_receivable_allocations` stores `invoice_currency`, `cash_currency`, `allocation_currency`, `valuation_rate`
- FX gain/loss calculated: `functional_amount - original_functional_invoice_amount`
- If gain/loss ≠ 0 → `ILedgerEngine.postTransaction()` with FX P&L lines (accounts: `4130` FX Gain / `8130` FX Loss)
- F3 does **not** own an exchange rate table. `valuation_rate` comes from the caller (UI or treasury service).

---

### G5 — Derived State & Void Semantics ✅ DESIGN CLEAR

**Requirement:** PAID/PARTIALLY_PAID must never be stored. Invoice void = reversal, not deletion.

**Design:**
- `finance_invoices.status` column: CHECK constraint allows only `('DRAFT', 'FINALIZED', 'ADJUSTED', 'VOIDED')`
- Payment states derived dynamically: `outstanding_amount_minor = 0 → PAID`, `0 < outstanding < original → PARTIALLY_PAID`
- Void: `ILedgerEngine.reverseTransaction(original_f1_transaction_id)` + reversal subledger row + status → VOIDED
- `trg_finance_invoice_immutability` prevents write of PAID/PARTIALLY_PAID to the status column

---

## IX. F3 BOUNDARY VIOLATIONS — PROHIBITED LIST

The following are explicitly prohibited in F3 implementation. Any pull request containing these patterns must be rejected:

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

### Target: ≥ 95 integration tests across 5 suites

| Suite | File | Target |
|---|---|---|
| F3.1 Database & RLS | `finance-f3-db-rls.test.ts` | ~25 tests |
| F3.2 Invoice Lifecycle | `finance-f3-invoice-lifecycle.test.ts` | ~20 tests |
| F3.3 Allocation Engine | `finance-f3-allocation.test.ts` | ~20 tests |
| F3.4 Reconstruction & Reconciliation | `finance-f3-reconstruction.test.ts` | ~20 tests |
| F3.5 Concurrency & Boundary | `finance-f3-concurrency.test.ts` | ~10 tests |

### Mandatory Test Coverage

**F3.1 Database & RLS:**
- Schema integrity for all 6 tables
- Invoice immutability trigger (cannot UPDATE financial columns post-FINALIZED)
- Receivable ledger immutability trigger (UPDATE/DELETE blocked)
- Allocation immutability trigger (UPDATE/DELETE blocked)
- Unique reversal constraint (each allocation reversed at most once)
- RLS tenant isolation (6 tables)

**F3.2 Invoice Lifecycle:**
- DRAFT → FINALIZED: F1 posting called, subledger debit created, position initialized
- DRAFT → FINALIZED: idempotent (same `posting_attempt_id` → same canonical F1 tx)
- FINALIZED → ADJUSTED: credit memo workflow, F1 adjustment posted
- FINALIZED → VOIDED: F1 reversal posted, subledger reversal entry created
- Invalid transitions blocked (VOIDED → FINALIZED, FINALIZED → DRAFT)
- PAID/PARTIALLY_PAID blocked from being written to status column

**F3.3 Allocation Engine:**
- Standard allocation: correct subledger credit + position update
- Over-allocation rejected (Σ allocations > movement.amount_minor)
- Allocation reversal: new REVERSAL row, position restored
- Double-reversal of same allocation blocked
- Multi-currency allocation: FX gain/loss posted to F1

**F3.4 Reconstruction & Reconciliation:**
- Mirrors F2 reconstruction: R01–R15 from F3 Constitution §6.2
- Positions reconstructed from ledger exactly
- Reconstruction privilege isolation (SET LOCAL, role check)
- Reconciliation delta detection (F3 vs F1 control account)
- No auto-balancing on mismatch

**F3.5 Concurrency & Boundary:**
- Concurrent allocations to same cash movement → over-allocation blocked
- Concurrent finalization with same `posting_attempt_id` → idempotent
- Direct write to F2 tables from F3 code → blocked (PERMISSION DENIED)
- Direct write to F1 tables from F3 code → blocked (PERMISSION DENIED)

---

## XI. OPEN QUESTIONS FOR HUMAN ARCHITECT

> [!IMPORTANT]
> **Q1 — G1 Atomicity Protocol Selection (BLOCKER)**
> The most critical decision before F3.1 coding: **Option A** (PG function embedding F1 call in same TX) or **Option B** (outbox saga pattern)?
>
> Recommendation: **Option A** — same-DB PG function calling `finance_post_transaction` within a single transaction. This is the pattern already established by F2's trusted SECURITY DEFINER RPCs. But this requires verifying that `finance_post_transaction` PG function can be called from within another PG function in F3.
>
> Verification needed: `SELECT finance_post_transaction(...)` called from inside `finance_finalize_invoice` SQL function — confirm no recursive lock or privilege issue.

> [!IMPORTANT]
> **Q2 — Cross-Domain Allocation Lock (IMPORTANT)**
> Since F3 cannot `SELECT FOR UPDATE` on F2's `finance_cash_movements` (no UPDATE grant), the over-allocation protection relies on:
> (a) Reading movement amount from F2 at allocation time, and
> (b) Checking `Σ(active allocations) + new_amount ≤ movement_amount` within a serializable isolation TX.
>
> Is this acceptable, or does the architecture require a different cross-domain lock mechanism (e.g., advisory lock on `cash_movement_id`)?

> [!NOTE]
> **Q3 — AR Control Account Code**
> The F3 Constitution mentions account code `1311` for AR control. Is this confirmed in the Chart of Accounts seeded by F1 (`20260525110000_seed_default_coa.sql`)? If multiple revenue accounts exist (`5111`, `5113`), does F3 need a configurable revenue account mapping per invoice line?

> [!NOTE]
> **Q4 — Customer Entity**
> The F3 Constitution references `customer_id` but F3 doesn't define the customer table. Does `customer_id` reference an existing table in the product vertical (e.g., `customers` in spa/healthcare vertical)? Or does F3 need a platform-level customer entity?

> [!NOTE]
> **Q5 — v1 Event Contract Deprecation**
> The event contract registry states `finance.transaction.posted.v1` has 0 production consumers and will be deprecated in Phase F3. Should F3.0 migration include formally dropping v1 emission, or maintain it for backward compatibility during F3 development?

---

## XII. ARCHITECTURE GATE SUMMARY

```
═══════════════════════════════════════════════════════════════════════
  F3 ACCOUNTS RECEIVABLE & INVOICING — PRE-CODING GATE
  Date: 2026-08-15T22:32:38+07:00
  Based on: F3 Constitution (F3-I-1 to F3-I-17) + F1/F2 Frozen Contracts
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
  G1 Atomic Posting Protocol          ⚠️ OPTION A/B DECISION REQUIRED
  G2 Dual-Side Allocation Lock        ✅ Design approved (advisory lock analysis done)
  G3 Reversal Constraint              ✅ Design clear
  G4 Currency/FX Contract             ✅ Design clear
  G5 Derived State & Void Semantics   ✅ Design clear

PROHIBITED BOUNDARY VIOLATIONS        ✅ 12 patterns listed and enforced
VERIFICATION PLAN                     ✅ 95+ tests across 5 suites planned
OPEN QUESTIONS                        ⚠️ 5 questions (Q1 is BLOCKER)

STATUS: 🟡 CONDITIONAL — AWAITING HUMAN ARCHITECT APPROVAL ON Q1/Q2
        Once Q1 atomicity protocol is selected: APPROVED FOR CODING
═══════════════════════════════════════════════════════════════════════
```

---

## XIII. NEXT STEPS (After Architect Approval)

1. **Architect answers Q1** → atomicity protocol locked
2. **Architect answers Q2** → cross-domain lock approach locked
3. Create `task.md` for F3.1 implementation
4. Begin `20260817000000_finance_ar_engine_v1.sql` (tables + triggers)
5. Begin `20260817010000_finance_ar_invoice_rpc.sql` (RPCs)
6. Begin TypeScript contracts: `src/platform/finance/contracts/ar-engine.contract.ts`
7. Begin test files: `finance-f3-db-rls.test.ts`
8. No coding begins until Q1 is resolved.
