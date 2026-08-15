# ARCHITECTURE GATE RESULT — F2 CASH & TREASURY ENGINE

> **Status:** PENDING HUMAN ARCHITECTURE APPROVAL  
> **Phase:** Pre-Coding Architecture Analysis  
> **Date:** 2026-08-15  
> **Author:** Architecture Review — Bella Platform  
> **Prerequisite:** F1 Ledger Engine — FROZEN ✅ (`finance/f1/frozen`)  
> **Constraint:** NO CODING until this document receives Human Architecture Approval.

---

## 0. EXECUTIVE SUMMARY

F2 Cash & Treasury Engine is the **second kernel** of Finance OS. Its purpose is to maintain an accurate, real-time **Cash Position** for every tenant — answering: *"How much liquid cash does this business have, right now, across all bank accounts and cash vaults?"*

F2 is **NOT a second ledger**. It does not perform double-entry accounting. It consumes **selective events from F1** (specifically: posted transactions with `transaction_type = 'CASH'`) and derives a materialized cash position from them.

This separation respects the **Invariant F-I-7** established in the Finance OS Constitution: accrual-basis Ledger (F1) ≠ cash-basis Treasury (F2).

---

## I. PRODUCT MANIFEST — F2 Capabilities & Scope

### What F2 OWNS (capabilities)

| Capability | Description |
|---|---|
| **Cash Position Management** | Maintains a real-time cash balance per `bank_account` per `tenant`. Answers: *"What is our cash balance right now?"* |
| **Bank Account Registry** | Stores bank accounts (accounts at external banks) — not chart-of-accounts entries |
| **Cash Movement Recording** | Records individual cash inflows/outflows with traceability back to F1 source transaction |
| **Cash Runway Calculation** | Derived metric: `cash_position / avg_daily_burn_rate` = estimated days of runway |
| **Cash Runway Alerts** | Publishes `CashRunwayAlert` when runway falls below configured thresholds |
| **Cash Reconciliation** | Supports matching of cash movements against external bank statement entries |

### What F2 Does NOT Own

| Out of Scope | Reason |
|---|---|
| Double-entry Journal Entries | F1 Ledger owns this exclusively |
| Receivables / Payables | F3 AR/AP Engine |
| Budgets | F4 Budget Engine |
| Payment processing / gateway | Product Vertical / Finance Bridge responsibility |
| Exchange rate management | F3 Treasury scope (per Constitution comment in F1 contract) |
| Approval workflows | F5 Financial Control Engine |

---

## II. OWNERSHIP MAP — WHO OWNS THIS DATA?

```
┌─────────────────────────────────────────────────────────────────┐
│                        F2 Cash Engine                           │
│                                                                 │
│  OWNS:                                                          │
│    finance_bank_accounts     → Registry of external bank accts  │
│    finance_cash_positions    → Materialized balance per acct     │
│    finance_cash_movements    → Individual cash in/out records    │
│                                                                 │
│  DOES NOT OWN:                                                  │
│    finance_transactions      → F1 (read-only via event)          │
│    finance_accounts          → F1 (read-only via contract)       │
│    finance_receivables       → F3                               │
│    finance_budgets           → F4                               │
└─────────────────────────────────────────────────────────────────┘

Tenant Isolation: ALL F2 tables must have tenant_id NOT NULL + RLS.
Cross-tenant: BLOCKED at database boundary.
```

### Entity Ownership Matrix

| Entity | Owner | Table | Access |
|---|---|---|---|
| Bank Account (external) | **F2 Cash Engine** | `finance_bank_accounts` | Via F2 Contract |
| Cash Position (snapshot) | **F2 Cash Engine** | `finance_cash_positions` | Via F2 Contract |
| Cash Movement | **F2 Cash Engine** | `finance_cash_movements` | Via F2 Contract |
| Cash Reconciliation Entry | **F2 Cash Engine** | `finance_cash_reconciliations` | Via F2 Contract |
| F1 Ledger Transaction | **F1 Ledger** | `finance_transactions` | F2 reads via event only — never direct query |
| Chart of Accounts (CoA) | **F1 Ledger** | `finance_accounts` | F2 may reference account_id for cash CoA accounts |

---

## III. CONTRACT DEPENDENCY MAP

```
Event Flow (Primary Integration Path — F2 is EVENT-DRIVEN):

  F1 Ledger
    │ Publishes: FinancialTransactionPosted { transaction_type: 'CASH', ... }
    │             (via finance_outbox_events → OutboxDispatcher → Event Bus)
    ▼
  F2 Cash Engine (Event Consumer)
    │ Handles: onFinancialTransactionPosted()
    │ Filter:  WHERE transaction_type = 'CASH'
    │ Action:  createCashMovement() + updateCashPosition()
    ▼
  finance_cash_movements (INSERT)
  finance_cash_positions (UPDATE — optimistic lock)

Direct Contract Call (Secondary — for explicit cash operations):

  Product Vertical / Finance Bridge
    │ Calls: F2.recordCashMovement(request) [explicit cash receipt/disbursement]
    ▼
  F2 CashEngine Service
    │ Creates: finance_cash_movements record
    │ Updates: finance_cash_positions (FOR UPDATE lock)
    │ Writes:  finance_outbox_events (CashMovementRecorded event)
    ▼
  DB COMMIT → OutboxDispatcher publishes CashMovementRecorded to Event Bus
```

### F2 Consumes From F1

```typescript
// F2 subscribes to this F1 event — filtered by transaction_type
interface FinancialTransactionPosted {
  event_type: 'FinancialTransactionPosted';
  transaction_id: string;
  tenant_id: string;
  transaction_type: TransactionType; // F2 only processes 'CASH'
  source_type: string;
  source_id: string;
  posted_at: Date;
  // F2 determines cash movement direction from the CoA account type (ASSET/CASH)
}
```

### F2 Does NOT:
- Query `finance_transactions` directly
- Call `F1.postTransaction()` — F2 does not post ledger entries
- Have its own double-entry invariant — that is F1's contract
- Know about Patient, KTV, Customer — only `party_id` (opaque reference)

---

## IV. DATABASE OWNERSHIP MAP — F2 NEW TABLES

> **Rule: ADDITIVE ONLY. No modification to any F1 table.**

### Table: `finance_bank_accounts`

```sql
-- NEW TABLE — F2 owns this
CREATE TABLE finance_bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  
  -- Bank Account Identity
  bank_name       TEXT NOT NULL,          -- e.g. 'Vietcombank', 'Techcombank'
  account_number  TEXT NOT NULL,
  account_name    TEXT NOT NULL,          -- account holder name
  currency        TEXT NOT NULL,          -- ISO 4217 (VND, USD, etc.)
  
  -- F1 Linkage: The CoA account that represents this bank account in the Ledger
  -- F2 can reference this to trace which F1 account_code = "1121 - VCB" etc.
  linked_finance_account_id UUID REFERENCES finance_accounts(id),
  
  -- Metadata
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, account_number)
);

-- RLS: tenant_id isolation
ALTER TABLE finance_bank_accounts ENABLE ROW LEVEL SECURITY;
```

### Table: `finance_cash_positions`

```sql
-- NEW TABLE — F2 owns this
-- One row per (tenant_id, bank_account_id) — updated atomically
CREATE TABLE finance_cash_positions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  bank_account_id     UUID NOT NULL REFERENCES finance_bank_accounts(id),
  
  -- Current Balance
  balance_minor       NUMERIC(20,0) NOT NULL DEFAULT 0,  -- stored as minor units
  currency            TEXT NOT NULL,
  
  -- Derived: Cash Runway
  avg_daily_burn_minor NUMERIC(20,0),  -- updated by F2 intelligence job
  runway_days          INTEGER,         -- balance / avg_daily_burn
  
  -- Concurrency Control
  version             BIGINT NOT NULL DEFAULT 0,  -- optimistic locking version
  last_movement_id    UUID REFERENCES finance_cash_movements(id),  -- FK added after cash_movements
  
  -- Audit
  as_of               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, bank_account_id)
);

ALTER TABLE finance_cash_positions ENABLE ROW LEVEL SECURITY;
```

### Table: `finance_cash_movements`

```sql
-- NEW TABLE — F2 owns this
-- Immutable append-only log of cash in/out events
CREATE TABLE finance_cash_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  bank_account_id     UUID NOT NULL REFERENCES finance_bank_accounts(id),
  
  -- Idempotency (F2 must also honor idempotency — prevents double-counting)
  idempotency_key     TEXT NOT NULL,
  
  -- Movement Direction & Amount
  direction           TEXT NOT NULL CHECK (direction IN ('INFLOW', 'OUTFLOW')),
  amount_minor        NUMERIC(20,0) NOT NULL CHECK (amount_minor > 0),
  currency            TEXT NOT NULL,
  
  -- Source Traceability (must always be populated)
  source_type         TEXT NOT NULL,  -- 'f1.transaction', 'manual', 'bank_import'
  source_id           TEXT NOT NULL,  -- e.g. finance_transaction.id if from F1 event
  
  -- F1 Link (optional but preferred — populated when source = F1 event)
  f1_transaction_id   UUID,  -- references finance_transactions(id) — not FK to avoid coupling
  f1_transaction_type TEXT,  -- CASH, ADJUSTMENT, etc.
  
  -- Metadata
  description         TEXT,
  reference_type      TEXT,  -- 'booking_payment', 'expense', etc.
  reference_id        TEXT,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Immutability: Cash movements are NEVER updated or deleted once created.
  UNIQUE(tenant_id, idempotency_key)
);

ALTER TABLE finance_cash_movements ENABLE ROW LEVEL SECURITY;
```

### Table: `finance_cash_reconciliations` (P1 — Phase 2 of F2)

```sql
-- Matches cash movements against bank statement entries
-- Design deferred to F2.2 — included here for boundary clarity
CREATE TABLE finance_cash_reconciliations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  bank_account_id   UUID NOT NULL REFERENCES finance_bank_accounts(id),
  movement_id       UUID REFERENCES finance_cash_movements(id),
  
  -- Bank Statement Data (imported)
  bank_date         DATE NOT NULL,
  bank_description  TEXT,
  bank_amount_minor NUMERIC(20,0) NOT NULL,
  bank_reference    TEXT,
  
  -- Reconciliation Status
  status            TEXT NOT NULL DEFAULT 'UNMATCHED' 
                    CHECK (status IN ('UNMATCHED', 'MATCHED', 'DISPUTED')),
  matched_at        TIMESTAMPTZ,
  matched_by        TEXT,  -- user_id
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE finance_cash_reconciliations ENABLE ROW LEVEL SECURITY;
```

---

## V. F2 PUBLIC CONTRACTS — ICashEngine Interface

```typescript
// This is the PROPOSED interface — frozen after Architecture Gate approval

export interface RecordCashMovementRequest {
  tenant_id: string;
  bank_account_id: string;
  idempotency_key: string;          // required — prevents double-counting
  direction: 'INFLOW' | 'OUTFLOW';
  amount_minor: string;             // stored as string to avoid JS float issues
  currency: string;
  source_type: string;              // 'f1.transaction', 'manual', 'bank_import'
  source_id: string;
  f1_transaction_id?: string;       // populated when source = F1 event
  description?: string;
  reference_type?: string;
  reference_id?: string;
  recorded_at?: Date;               // defaults to NOW()
}

export interface CashPosition {
  id: string;
  tenant_id: string;
  bank_account_id: string;
  balance_minor: string;
  currency: string;
  runway_days?: number;
  as_of: Date;
  version: number;                  // for optimistic locking
}

export interface RegisterBankAccountRequest {
  tenant_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  currency: string;
  linked_finance_account_id?: string;  // F1 CoA account (optional)
}

export interface ICashEngine {
  readonly engineName: string;
  readonly engineVersion: string;

  // Core Operations
  registerBankAccount(req: RegisterBankAccountRequest): Promise<FinanceEngineResponse<BankAccount>>;
  recordCashMovement(req: RecordCashMovementRequest): Promise<FinanceEngineResponse<CashMovement>>;

  // Query Operations
  getCashPosition(tenantId: string, bankAccountId: string): Promise<FinanceEngineResponse<CashPosition>>;
  getTotalCashPosition(tenantId: string, currency: string): Promise<FinanceEngineResponse<Money>>;
  getCashMovements(tenantId: string, bankAccountId: string, from: Date, to: Date): Promise<FinanceEngineResponse<CashMovement[]>>;

  // Event Handler (internal — called by OutboxConsumer from F1 events)
  onFinancialTransactionPosted(event: FinancialTransactionPostedEvent): Promise<void>;
}
```

### F2 Published Events

```typescript
// F2 → Event Bus (via Transactional Outbox)

interface CashMovementRecorded {
  event_type: 'CashMovementRecorded';
  movement_id: string;
  tenant_id: string;
  bank_account_id: string;
  direction: 'INFLOW' | 'OUTFLOW';
  amount_minor: string;
  currency: string;
  source_type: string;
  source_id: string;
  recorded_at: Date;
}

interface CashPositionUpdated {
  event_type: 'CashPositionUpdated';
  tenant_id: string;
  bank_account_id: string;
  new_balance_minor: string;
  currency: string;
  as_of: Date;
}

interface CashRunwayAlert {
  event_type: 'CashRunwayAlert';
  tenant_id: string;
  bank_account_id: string;
  runway_days: number;
  current_balance_minor: string;
  severity: 'WARNING' | 'CRITICAL';  // WARNING < 30d, CRITICAL < 7d
  alerted_at: Date;
}
```

---

## VI. F2 INVARIANTS (Non-Negotiable Rules)

### F2-I-1: Cash Position is Derived, Not Primary

```
finance_cash_positions is a MATERIALIZED VIEW of cash movements.
It can always be REBUILT from scratch by replaying finance_cash_movements.

Primary source of truth: finance_cash_movements (append-only log)
Derived: finance_cash_positions (aggregation)

In any disaster scenario:
  SELECT SUM(CASE WHEN direction='INFLOW' THEN amount_minor ELSE -amount_minor END)
  FROM finance_cash_movements
  WHERE bank_account_id = ? AND tenant_id = ?
  = Correct cash balance.
```

### F2-I-2: Cash Movement Immutability

```
A recorded cash movement is IMMUTABLE.
It MUST NOT be updated or deleted.

To correct an erroneous movement:
  Step 1: Record a REVERSAL movement (opposite direction, same amount)
  Step 2: Record the CORRECTED movement with correct values

This is the F2 equivalent of F1's Reversal + Correction pattern.
```

### F2-I-3: Idempotency

```
F2.recordCashMovement() called twice with same idempotency_key
  → Returns same movement (NOT a duplicate)

DB Enforcement: UNIQUE(tenant_id, idempotency_key) on finance_cash_movements
```

### F2-I-4: Cash Position Optimistic Locking

```
finance_cash_positions.version must be incremented on every update.

Update pattern:
  UPDATE finance_cash_positions
  SET balance_minor = balance_minor + delta,
      version = version + 1,
      updated_at = NOW()
  WHERE id = ? AND version = expected_version AND tenant_id = ?

If 0 rows affected → concurrent modification detected → retry or error.

Alternatively, FOR UPDATE lock on the row for serialized updates.
Decision: Use FOR UPDATE (simpler, consistent with F1 approach) — optimistic lock as fallback.
```

### F2-I-5: F2 Does Not Post to F1 Ledger

```
F2 MUST NOT call F1.postTransaction().
F2 is downstream of F1.
The flow is strictly:

  F1 (posts transaction) → event → F2 (records cash movement)

NOT:

  F2 (wants to move cash) → calls F1 to post → cycle

When a Product Vertical records a payment, it calls:
  1. F1.postTransaction({ transaction_type: 'CASH', ... })
  2. F1 publishes FinancialTransactionPosted
  3. F2 listens → recordCashMovement() automatically

The Vertical NEVER calls both F1 and F2 separately.
```

### F2-I-6: Tenant Isolation

```
ALL F2 tables enforce: tenant_id NOT NULL + RLS
Cross-tenant cash position reads/writes: BLOCKED at DB level.
Same as F1 enforcement model.
```

### F2-I-7: Transactional Outbox (Event-After-Persistence)

```
F2 also implements the Transactional Outbox Pattern:

  1. Start DB Transaction
  2. INSERT into finance_cash_movements
  3. UPDATE finance_cash_positions
  4. INSERT into finance_outbox_events (same transaction)
  5. COMMIT
  6. OutboxDispatcher publishes CashMovementRecorded event

NO event is published before DB COMMIT.
```

---

## VII. CONCURRENCY MODEL

F2 faces a critical concurrency challenge: **multiple cash movements may arrive simultaneously** for the same bank account (e.g., 100 concurrent payment completions). The cash position must remain consistent.

### Chosen Approach: `FOR UPDATE` Row Lock (same as F1)

```sql
-- F2 Cash Position Update (serialized via row lock)
BEGIN;
  SELECT * FROM finance_cash_positions
  WHERE bank_account_id = ? AND tenant_id = ?
  FOR UPDATE;  -- acquires exclusive row lock

  INSERT INTO finance_cash_movements (...);

  UPDATE finance_cash_positions
  SET balance_minor = balance_minor + delta,
      version = version + 1,
      last_movement_id = new_movement_id,
      as_of = NOW()
  WHERE bank_account_id = ? AND tenant_id = ?;

  INSERT INTO finance_outbox_events (...);
COMMIT;
```

**Why `FOR UPDATE` over optimistic locking:**
- Consistent with F1's concurrency model (already verified)
- Simpler retry logic
- Cash position updates are expected to be fast (no long transactions)
- Row-level lock prevents phantom concurrent updates without application-level retry loops

**Trade-off acknowledged:** Serialized cash position updates are a write bottleneck under extreme concurrency. For MVP (Bella Spa, Hospital), this is acceptable. Future F2.2 can introduce account-level sharding if needed.

---

## VIII. FAILURE MODEL

### Failure Scenario 1: F1 Event Lost / Not Delivered

```
Problem: F2 subscribes to F1 events. What if an event is missed?

Solution:
  - OutboxDispatcher retries failed events with exponential backoff (inherited from F1)
  - F2 must be idempotent: re-processing the same F1 event must be safe
    (idempotency_key = f1_transaction_id ensures no double-count)
  - Reconciliation job: periodic check — finance_transactions WHERE type=CASH
    vs finance_cash_movements — detect and alert on gaps
```

### Failure Scenario 2: Cash Position Out of Sync

```
Problem: cash_positions balance drifts from sum of cash_movements.

Solution: F2 Reconstruction Job (mandatory capability):
  SELECT SUM(CASE direction WHEN 'INFLOW' THEN amount_minor ELSE -amount_minor END)
  FROM finance_cash_movements
  WHERE bank_account_id = ? AND tenant_id = ?

  This is the authoritative balance. cash_positions is rebuilt from movements.
  Run on demand or scheduled (e.g., nightly).
```

### Failure Scenario 3: Duplicate Cash Movement (race condition)

```
Problem: Two concurrent calls to recordCashMovement() with same idempotency_key.

Solution: UNIQUE(tenant_id, idempotency_key) on finance_cash_movements.
  One INSERT wins. The other gets a uniqueness violation.
  Application catches uniqueness violation → returns existing movement (200, not 500).
```

### Failure Scenario 4: Bank Account Not Found

```
Problem: F1 event references a transaction for a CoA account that has no F2 bank_account.

Solution:
  - F2 should gracefully skip unrecognized account events (log + alert)
  - Not all F1 CASH transactions map to an F2 bank account
    (e.g., petty cash, intercompany — depends on tenant configuration)
  - Only linked accounts (finance_bank_accounts.linked_finance_account_id) trigger F2 cash movements
```

---

## IX. F2 VERIFICATION GATES

All 9 Finance Verification Gates apply to F2, plus 2 F2-specific gates:

| Gate | Name | F2 Test Plan |
|---|---|---|
| **Gate F-1** | Architecture Compliance | F2 engine exists only in `src/platform/finance/engines/cash-engine/`. No F1 modification. |
| **Gate F-2** | Contract Boundary | No Product Vertical queries `finance_cash_*` directly. All access via `ICashEngine`. |
| **Gate F-3** | Tenant Isolation (P0) | RLS on all F2 tables. Cross-tenant cash position query blocked at DB. |
| **Gate F-4** | Double-Entry Invariant | N/A for F2 (F2 does not post double-entry). But: F1 transactions that trigger F2 must be POSTED (balanced). |
| **Gate F-5** | Movement Immutability | Cash movements cannot be updated/deleted. Verified via trigger or application test. |
| **Gate F-6** | Idempotency | Duplicate recordCashMovement() with same key returns same result (no duplicate). |
| **Gate F-7** | No Invalid State | Cash position never goes negative for asset accounts (warning alert if it does — possible timing issue). |
| **Gate F-8** | Event-After-Persistence | CashMovementRecorded event only published after DB COMMIT. |
| **Gate F-9** | Full Regression | All Finance OS tests (F1 + F2) GREEN before F2 feature release. |
| **Gate F-10** | State Reconstruction | cash_positions can be fully rebuilt from cash_movements replay. Test: rebuild + assert match. |
| **Gate F2-A** | F1 Event Consumption | F2 correctly processes FinancialTransactionPosted{type=CASH} and creates movement. Ignores non-CASH events. |
| **Gate F2-B** | Concurrent Cash Updates | 10 concurrent INFLOW events for same bank account → correct final balance (no lost updates). FOR UPDATE serialization verified. |

---

## X. ADDITIVE MIGRATION PLAN

> All migrations are ADDITIVE ONLY. No modification to F1 tables.

### Migration 1: `20260816000000_finance_cash_engine_v1.sql`

```
Creates:
  ✅ finance_bank_accounts (new)
  ✅ finance_cash_positions (new)
  ✅ finance_cash_movements (new)

RLS on all 3 tables.
Indexes:
  ✅ (tenant_id, bank_account_id) on finance_cash_positions — for position lookup
  ✅ (tenant_id, bank_account_id, created_at) on finance_cash_movements — for history queries
  ✅ (tenant_id, idempotency_key) UNIQUE on finance_cash_movements — idempotency enforcement
  ✅ (tenant_id, f1_transaction_id) on finance_cash_movements — for reconciliation lookups

Does NOT:
  ❌ ALTER any F1 tables
  ❌ DROP any existing tables
  ❌ Modify existing triggers
```

### Migration 2: `20260816010000_finance_cash_engine_rpcs.sql`

```
Creates:
  ✅ finance_record_cash_movement(p_...) RPC — atomic movement + position update
  ✅ finance_get_cash_position(p_tenant_id, p_bank_account_id) RPC
  ✅ finance_rebuild_cash_position(p_tenant_id, p_bank_account_id) RPC — reconstruction

Does NOT modify F1 RPCs.
```

### Migration 3: `20260816020000_finance_cash_engine_grants.sql`

```
  ✅ GRANT EXECUTE on F2 RPCs to service_role
  ✅ GRANT SELECT/INSERT on F2 tables to service_role
  ✅ Deny anon access to all F2 tables
```

### Migration 4: `20260816030000_finance_cash_reconciliation_v1.sql` (P1 — deferred)

```
Creates: finance_cash_reconciliations (new — P1 feature)
```

---

## XI. ARCHITECTURAL RISKS & MITIGATIONS

| Risk | Severity | Mitigation |
|---|---|---|
| **F2 processes F1 events out of order** | HIGH | Idempotency key prevents duplicates. Order dependency is low (each movement is independent). For ordering-sensitive scenarios: use `recorded_at` timestamp ordering. |
| **Cash position write bottleneck** | MEDIUM | FOR UPDATE serializes writes per bank_account. Acceptable for MVP volume. Scale via account sharding in F2.2 if needed. |
| **F1-F2 event latency** | LOW | OutboxDispatcher is near-real-time (polling interval ~1s). Cash position may lag by <2s after ledger post. Documented behavior. |
| **No native FK to finance_transactions** | LOW | Intentional: F2 stores f1_transaction_id as TEXT (not FK) to avoid coupling. Traceability maintained; referential integrity handled via reconciliation job. |
| **finance_cash_positions rebuild may take time** | LOW | For MVP scale (10K movements), rebuild is sub-second. For 10M+ movements, add pagination to rebuild job. |

---

## XII. OPEN QUESTIONS FOR ARCHITECTURE REVIEW

> [!IMPORTANT]
> The following questions require Human Architect decision before F2 coding begins.

### Q1: Multi-Currency Cash Position

```
Constitution says: functional_currency = VND for Vietnamese tenants.
But bank accounts can be USD, EUR (international).

Question: Does finance_cash_positions store:
  (a) balance in the account's native currency (e.g., USD balance for USD account)
  (b) balance converted to VND functional currency
  (c) BOTH — native + functional

Recommendation: Store BOTH (native + functional).
  - cash_positions.balance_minor = native currency (matches bank statement)
  - cash_positions.balance_functional_minor = VND equivalent
  - Conversion rate applied at movement time (from F1 exchange_rate on the triggering transaction)
```

### Q2: Cash Movement source when NOT from F1 event

```
Some cash movements may come from manual entry (expense petty cash, bank import)
rather than from F1 events.

Question: For manual cash entries, should:
  (a) Product Vertical call F2.recordCashMovement() directly (without F1 involvement)
  (b) Product Vertical always call F1.postTransaction(type=CASH) first, then F2 auto-receives event
  (c) Both patterns allowed, but (b) is preferred

Recommendation: Prefer (b) — F1 is always the system of record.
  Manual entry goes through F1 first, then F2 gets the event.
  Only exception: bulk bank import (no F1 equivalent) → direct F2 call.

Impact: If (b) is required, the Finance Bridge must always call F1 before expecting F2 to update.
```

### Q3: Cash Runway Alert Threshold

```
Constitution says CashRunwayAlert is published.

Question: Is the runway threshold:
  (a) Hardcoded (e.g., WARNING < 30d, CRITICAL < 7d)
  (b) Configurable per tenant
  (c) Configurable per bank account

Recommendation: Configurable per tenant (stored in finance_bank_accounts or tenant config table).
  Default: WARNING=30d, CRITICAL=7d
```

---

## XIII. SUMMARY STATUS

| Section | Status |
|---|---|
| Product Manifest | ✅ COMPLETE |
| Ownership Map | ✅ COMPLETE |
| Contract Dependency Map | ✅ COMPLETE |
| DB Ownership Map (New Tables) | ✅ COMPLETE |
| Public Contracts (ICashEngine) | ✅ COMPLETE |
| Domain Events | ✅ COMPLETE |
| Invariants (7 defined) | ✅ COMPLETE |
| Concurrency Model | ✅ COMPLETE |
| Failure Model | ✅ COMPLETE |
| Verification Gates (11 defined) | ✅ COMPLETE |
| Additive Migration Plan | ✅ COMPLETE |
| Architectural Risks | ✅ COMPLETE |
| Open Questions (3) | ⚠️ PENDING ARCHITECT DECISION |

---

## XIV. GATE VERDICT

```
┌─────────────────────────────────────────────────────────────────┐
│                    F2 ARCHITECTURE GATE                         │
│                                                                 │
│  Status:  PENDING HUMAN ARCHITECTURE APPROVAL                   │
│                                                                 │
│  Blocking Items:                                                │
│    Q1: Multi-currency position storage decision                 │
│    Q2: Manual cash entry routing (F1-first vs direct F2)        │
│    Q3: Cash runway alert threshold configuration                │
│                                                                 │
│  Non-Blocking (will not delay coding):                          │
│    finance_cash_reconciliations → deferred to F2.2             │
│    Cash runway calculation algorithm → P1                       │
│                                                                 │
│  NO F2 CODE may be written until this document                  │
│  receives Human Architecture Sign-off.                          │
└─────────────────────────────────────────────────────────────────┘
```

---

*Finance OS — F2 Cash & Treasury Engine Architecture Gate*  
*Date: 2026-08-15*  
*Status: PENDING HUMAN ARCHITECTURE APPROVAL*  
*Author: Architecture Review — Bella Platform*  
*Prerequisite Cleared: F1 FROZEN ✅ (tag: finance/f1/frozen)*
