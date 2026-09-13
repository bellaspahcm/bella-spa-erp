# E0.1B-R F3 PREFLIGHT — PHASE 1: SCHEMA RECONCILIATION

**Phase:** 1/5  
**Status:** ✅ **COMPLETE**  
**Date:** 2026-09-12

---

## F3 AR SCHEMA INVENTORY

### Migration Source

**File:** `supabase/migrations/20260817000000_finance_ar_engine_v1.sql`  
**Component:** F3.1 — Database Schema & RLS Hardening  
**Tables:** 6 core tables

---

## TABLE 1: finance_invoices (Invoice Headers)

**Purpose:** Canonical invoice header with lifecycle state machine

**Columns:**
```sql
id                          UUID PRIMARY KEY
tenant_id                   UUID NOT NULL → tenants(id)
customer_id                 UUID NOT NULL  -- ⚠️ Logical reference (no FK)
invoice_number              VARCHAR(50) UNIQUE per tenant
status                      VARCHAR(20) -- DRAFT | FINALIZED | ADJUSTED | VOIDED
issue_date                  DATE
due_date                    DATE
currency                    VARCHAR(10)
total_pretax_amount_minor   BIGINT
tax_amount_minor            BIGINT
total_invoice_amount_minor  BIGINT
f1_transaction_id           UUID UNIQUE  -- F1 General Ledger posting
posting_status              VARCHAR(20)  -- PENDING | SUCCESS | FAILED
posting_attempt_id          UUID UNIQUE  -- Idempotency key
metadata                    JSONB
created_at                  TIMESTAMPTZ
updated_at                  TIMESTAMPTZ
```

**Constraints:**
- `chk_due_after_issue`: due_date >= issue_date
- `chk_total_sum`: total = pretax + tax
- `uq_invoice_number_per_tenant`: Unique (tenant_id, invoice_number)

**Immutability Trigger:**
- Once status = FINALIZED/VOIDED/ADJUSTED: financial fields immutable
- Status transitions: DRAFT → FINALIZED → (ADJUSTED | VOIDED)

**RLS:** Tenant isolation via `get_auth_tenant_id()`

**Privileges:** authenticated = SELECT only (no write)

---

## TABLE 2: finance_invoice_lines (Invoice Line Items)

**Purpose:** Line items for invoice (services/products)

**Columns:**
```sql
id                      UUID PRIMARY KEY
tenant_id               UUID NOT NULL → tenants(id)
invoice_id              UUID NOT NULL → finance_invoices(id) ON DELETE RESTRICT
service_id              UUID  -- Logical reference to vertical service
description             TEXT NOT NULL
quantity                NUMERIC > 0
unit_price_minor        BIGINT >= 0
tax_rate                NUMERIC (0.0 to 1.0)
amount_minor            BIGINT CHECK (amount_minor = FLOOR(quantity * unit_price_minor))
revenue_account_code    VARCHAR(20) NOT NULL  -- F1 account mapping
created_at              TIMESTAMPTZ
```

**Constraints:**
- Quantity > 0
- Amount = FLOOR(quantity * unit_price)
- Revenue account code required (F1 CoA integration)

**RLS:** Tenant isolation

**Privileges:** authenticated = SELECT only

---

## TABLE 3: finance_receivable_ledger (AR Subledger Log)

**Purpose:** Append-only immutable fact log for AR movements

**Columns:**
```sql
id              UUID PRIMARY KEY
tenant_id       UUID NOT NULL → tenants(id)
invoice_id      UUID NOT NULL → finance_invoices(id) ON DELETE RESTRICT
entry_type      VARCHAR(30)  -- DEBIT_ACCRUAL | CREDIT_ALLOCATION | DEBIT_ADJUSTMENT | CREDIT_ADJUSTMENT
amount_minor    BIGINT > 0  -- ⚠️ Strictly positive (no negative amounts)
source_type     VARCHAR(30)  -- INVOICE | ALLOCATION | RECEIVABLE_ADJUSTMENT
source_id       UUID NOT NULL
created_at      TIMESTAMPTZ
```

**Constraints:**
- Amount must be strictly positive (no negatives)
- Idempotency: UNIQUE (tenant_id, source_type, source_id, entry_type)

**Immutability:**
- **ABSOLUTE:** No UPDATE or DELETE allowed (trigger blocks)
- Only INSERT via authorized RPCs

**RLS:** Tenant isolation

**Privileges:** authenticated = SELECT only

---

## TABLE 4: finance_receivable_positions (Materialized Projection Cache)

**Purpose:** Derived AR position per invoice (cached balance)

**Columns:**
```sql
id                      UUID PRIMARY KEY
tenant_id               UUID NOT NULL → tenants(id)
invoice_id              UUID NOT NULL → finance_invoices(id) ON DELETE CASCADE
customer_id             UUID NOT NULL  -- Denormalized from invoice
currency                VARCHAR(10)
original_amount_minor   BIGINT >= 0
allocated_amount_minor  BIGINT >= 0
adjusted_amount_minor   BIGINT
outstanding_amount_minor BIGINT GENERATED ALWAYS AS
                          (original_amount_minor - allocated_amount_minor - adjusted_amount_minor) STORED
last_reconstructed_at   TIMESTAMPTZ
version                 INT >= 0
metadata                JSONB
```

**Constraints:**
- UNIQUE (tenant_id, invoice_id) — one position per invoice
- outstanding_amount = original - allocated - adjusted (computed column)

**Mutation Guard:**
- UPDATE requires `finance.allow_receivable_mutation = 'true'` session variable
- Prevents direct mutation outside authorized RPCs

**RLS:** Tenant isolation

**Privileges:** authenticated = SELECT only

---

## TABLE 5: finance_receivable_allocations (Allocation Ledger)

**Purpose:** Append-only log of payment → invoice allocations

**Columns:**
```sql
id                      UUID PRIMARY KEY
tenant_id               UUID NOT NULL → tenants(id)
invoice_id              UUID NOT NULL → finance_invoices(id) ON DELETE RESTRICT
cash_movement_id        UUID NOT NULL  -- ⚠️ Logical FK to F2 Cash Engine
allocated_amount_minor  BIGINT > 0
allocation_type         VARCHAR(20)  -- STANDARD | REVERSAL
reversal_ref_id         UUID → finance_receivable_allocations(id)  -- Self-reference for reversals
rate_source             VARCHAR(50)  -- CENTRAL_BANK | TREASURY | MANUAL_AUTHORIZED
rate_timestamp          TIMESTAMPTZ
created_at              TIMESTAMPTZ
```

**Constraints:**
- Reversal limit: Each allocation can be reversed at most once (unique index on reversal_ref_id)

**Immutability:**
- **ABSOLUTE:** No UPDATE or DELETE allowed

**RLS:** Tenant isolation

**Privileges:** authenticated = SELECT only

---

## TABLE 6: finance_receivable_adjustments (Adjustment Memos)

**Purpose:** Credit/debit memos for AR adjustments

**Columns:**
```sql
id                  UUID PRIMARY KEY
tenant_id           UUID NOT NULL → tenants(id)
invoice_id          UUID NOT NULL → finance_invoices(id) ON DELETE RESTRICT
adjustment_type     VARCHAR(20)  -- CREDIT_MEMO | DEBIT_MEMO
amount_minor        BIGINT > 0
reason              TEXT NOT NULL
f1_transaction_id   UUID UNIQUE  -- F1 GL posting
status              VARCHAR(20)  -- DRAFT | FINALIZED | CANCELLED
posting_attempt_id  UUID UNIQUE  -- Idempotency key
created_by          UUID
created_at          TIMESTAMPTZ
metadata            JSONB
```

**Constraints:**
- Reason required (audit trail)

**RLS:** Tenant isolation

**Privileges:** authenticated = SELECT only

---

## IDENTITY PATTERN ANALYSIS

### customer_id Semantic

**Location:**
- `finance_invoices.customer_id UUID NOT NULL`
- `finance_receivable_positions.customer_id UUID NOT NULL`

**Characteristics:**
- **No FK constraint** (logical reference only)
- **Not tenant-scoped** (no UNIQUE constraint with tenant_id)
- **Denormalized** in positions table (copied from invoice)

**Comment in schema:**
> `customer_id UUID NOT NULL, -- Logical reference to vertical customer`

**Interpretation:**
- F3 AR does NOT own customer entity
- F3 expects Products to provide customer_id
- customer_id is **commercial counterparty identifier** (not necessarily identity)

**Unanswered:**
- Does customer_id reference `customers` table?
- Does customer_id reference `party_parties` table?
- Or is it Product-specific customer identifier?

**Phase 5 will reconcile customer semantics.**

---

## IMMUTABILITY GUARANTEES

### Level 1: Database Triggers (Absolute Immutability)

**Tables with NO UPDATE/DELETE:**
- `finance_receivable_ledger` ✅
- `finance_receivable_allocations` ✅

**Trigger:** `finance_receivable_mutation_guard()`
- Blocks UPDATE/DELETE on immutable tables
- Error code: `F3001`

---

### Level 2: Guarded Mutation (Authorized RPCs Only)

**Table:**
- `finance_receivable_positions`

**Guard:**
- Mutation requires session variable: `finance.allow_receivable_mutation = 'true'`
- Only authorized RPCs can set this variable
- Prevents direct UPDATE outside reconstruction/allocation RPCs

---

### Level 3: Lifecycle Immutability

**Table:**
- `finance_invoices`

**Guard:** `finance_invoice_immutability_guard()`
- Once status = FINALIZED/VOIDED/ADJUSTED: financial fields frozen
- Cannot change amounts, dates, accounts, tenant, customer, invoice_number

---

### Level 4: Status Transition Constraints

**Table:**
- `finance_invoices`

**Guard:** `finance_invoice_status_transition_guard()`
- Valid transitions:
  - DRAFT → FINALIZED ✅
  - FINALIZED → ADJUSTED ✅
  - FINALIZED → VOIDED ✅
  - Terminal states (VOIDED/ADJUSTED) cannot transition ❌

---

## TENANT ISOLATION (RLS)

**Mechanism:**
- All 6 tables have RLS enabled
- Policy: `tenant_id = get_auth_tenant_id()` OR `get_auth_tenant_id() IS NULL`
- Prevents cross-tenant data leakage

**Privileges:**
- authenticated role: **SELECT only** (no INSERT/UPDATE/DELETE)
- service_role: Full access (mutations via RPCs)

**Mutation Path:**
- Products → F3 RPCs (service_role context)
- NOT: Products → Direct table writes

---

## F1 GENERAL LEDGER INTEGRATION

**Evidence:**
- `finance_invoices.f1_transaction_id` — F1 GL transaction reference
- `finance_receivable_adjustments.f1_transaction_id` — Adjustment posting
- `finance_invoice_lines.revenue_account_code` — F1 CoA mapping

**Pattern:**
- F3 AR finalizing invoice → creates F1 transaction
- F1 transaction_id stored in invoice (audit trail)
- Idempotency: `posting_attempt_id` ensures duplicate prevention

---

## F2 CASH ENGINE INTEGRATION

**Evidence:**
- `finance_receivable_allocations.cash_movement_id` — F2 cash movement reference

**Pattern:**
- F2 Cash receives payment → creates cash_movement
- F3 AR allocates payment to invoice → creates allocation record linking cash_movement_id to invoice_id

---

## PHASE 1 EXIT CRITERIA

**PASS:**
- [x] 6 F3 tables documented
- [x] customer_id semantic observed (logical reference, not FK)
- [x] Tenant isolation proven (RLS + policies)
- [x] Immutability guarantees documented (4 levels)
- [x] F1/F2 integration points identified

**BLOCK:** None

---

## CUSTOMER SEMANTIC HYPOTHESIS (Pre-Phase 5)

**Hypothesis A:** customer_id is commercial account identifier
- customer entity exists separately from Party
- customer.party_id FK (customer belongs to party)
- F3 invoice references customer (commercial relationship)
- Party is identity, Customer is account

**Hypothesis B:** customer_id directly references party_parties(id)
- No separate customer entity needed
- customer_id = party_id (identity-only pattern)
- F3 invoice directly references Party

**Hypothesis C:** customer_id references legacy customers table
- customers table is identity proxy (pre-Party)
- customers needs party_id migration
- Same pattern as Education Student → Party

**Resolution:** Phase 5 customer semantic reconciliation will determine correct hypothesis.

---

**Phase 1 complete. Proceeding Phase 2: F3 RPC Reconciliation.**
