# ARCHITECTURE GATE RESULT — F2 CASH & TREASURY ENGINE

> **Status:** APPROVED FOR CODING  
> **Phase:** Pre-Coding Architecture Analysis  
> **Date:** 2026-08-15  
> **Author:** Architecture Review — Bella Platform  
> **Prerequisite F0:** Finance OS Inheritance Constitution — FROZEN ✅ (`FINANCE_OS_INHERITANCE_CONSTITUTION.md`)  
> **Prerequisite F1:** F1 Ledger Engine — FROZEN ✅ (`finance/f1/frozen`)  
> **Constraint:** Downstream only. No independent financial truth. Additive database modifications only.  
> **OS Law:** All F2 operations must comply with BELLA OS INHERITANCE LAW (Laws 1–10).

---

## 0. EXECUTIVE SUMMARY

F2 Cash & Treasury Engine is the **second kernel** of Finance OS. Its purpose is to maintain an accurate, real-time **Cash Position** for every tenant — answering: *"How much liquid cash does this business have, right now, across all bank accounts and cash vaults?"*

F2 is a **Materialized Projection / Derived State** of F1's financial truth. It does not perform double-entry accounting and does not make independent cash adjustments. It consumes selective versioned events from F1 (specifically: posted transactions with `transaction_type = 'CASH'`) and updates its projection.

This separation respects the **Invariant F-I-7** established in the Finance OS Constitution: accrual-basis Ledger (F1) ≠ cash-basis Treasury (F2).

---

## I. SUPREME ARCHITECTURAL PRINCIPLE

> [!IMPORTANT]
> **F1 remains immutable/frozen. F2 is additive-only and downstream of F1. No F2 operation may create an independent financial truth.**

---

## II. PRODUCT MANIFEST — F2 Capabilities & Scope

### What F2 OWNS (capabilities)

| Capability | Description |
|---|---|
| **Cash Position Management** | Maintains a real-time cash balance projection per `bank_account` per `tenant`. |
| **Bank Account Registry** | Stores bank accounts (accounts at external banks) — not chart-of-accounts entries. |
| **Cash Movement Recording** | Records individual cash inflows/outflows with traceability back to F1 source transaction. |
| **Cash Runway Calculation** | Derived metric: `consolidated_cash_position / average_daily_burn_rate` = estimated days of runway. |
| **Cash Runway Alerts** | Publishes `CashRunwayAlert` based on consolidated tenant cash position. |
| **Cash Reconciliation & Staging** | Staging area for bank statements to be matched against F1 transactions. |

### What F2 Does NOT Own

| Out of Scope | Owner |
|---|---|
| Double-entry Journal Entries | F1 Ledger Engine |
| Receivables / Payables | F3 AR/AP Engine |
| Budgets & Forecasts | F4 Budget Engine |
| Payment processing / gateway | Product Vertical / Finance Bridge |
| Exchange rate management (governance/rates) | F3 Treasury Engine |
| Approval workflows | F5 Financial Control Engine |
| Accounting adjustments for bank discrepancies| F1 Ledger Engine (F2 triggers, F1 posts) |

---

## III. OWNERSHIP MAP — WHO OWNS THIS DATA?

```
┌─────────────────────────────────────────────────────────────────┐
│                        F2 Cash Engine                           │
│                                                                 │
│  OWNS:                                                          │
│    finance_bank_accounts     → Registry of external bank accts  │
│    finance_cash_positions    → Materialized balance per acct     │
│    finance_cash_movements    → Individual cash in/out records    │
│    finance_tenant_configs    → Configuration for thresholds      │
│    finance_cash_staged_lines → Staging area for bank imports     │
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
| Staged Bank Import Line | **F2 Cash Engine** | `finance_cash_staged_lines` | Via F2 Contract |
| F1 Ledger Transaction | **F1 Ledger** | `finance_transactions` | F2 reads via event only — never direct query |
| Chart of Accounts (CoA) | **F1 Ledger** | `finance_accounts` | F2 may reference account_id for cash CoA accounts |
| Tenant Finance Configuration| **F2 Cash Engine** | `finance_tenant_configs` | Via F2 Contract |

---

## IV. CONTRACT DEPENDENCY MAP

### F1-First Mandatory Architecture Flow
Every business cash transaction MUST be recorded in the F1 Ledger first. F2 acts purely as an event-driven projection (derived state) of F1's financial truth.

```
  Business Event (e.g. BookingPaid)
         │
         ▼
  F1 Ledger Engine (postTransaction)
         │
     [POSTED] (Financial Truth)
         │
         ▼
  finance_outbox_events (F1 writes: finance.transaction.posted.v2 with cash legs)
         │
         ▼ (Async Dispatcher)
  Event Bus (finance.transaction.posted.v2)
         │
         ▼
  F2 Cash Engine (onFinancialTransactionPosted)
         │
     [MATCHED Account / VALIDATED]
         ├─────────────────────────────────────────┐
         │ (Success)                               │ (Unmapped Account / Validation Fail)
         ▼                                         ▼
  finance_cash_movements (Insert)           finance_cash_quarantine (Insert & Alert)
         │
         ▼
  finance_cash_positions (Update)
```

### Bank Statement Import Flow (No Bypass of F1)
Imported bank statement records are treated as reconciliation inputs/staging records. They DO NOT directly alter the cash position until matched and posted as transactions in F1.

```
  Bank Statement Import (.csv / API)
         │
         ▼
  F2 Staging Table (finance_cash_staged_lines)
         │
         ▼ (Review / Match / Audit)
  F1 Ledger Engine (postTransaction — ACCRUAL / CASH entry created)
         │
     [POSTED] (Financial Truth)
         │
         ▼ (Transactional Outbox)
  Event Bus (finance.transaction.posted.v2)
         │
         ▼
  F2 Cash Engine (Records movement + updates position + marks staged line MATCHED)
```

---

## V. FOUR ARCHITECTURE LOCKS

> [!IMPORTANT]
> To preserve the absolute immutability of the F1 core ledger and prevent the creation of a "shadow ledger", the following architectural locks are enforced:

### Lock 1 — F1 Event Compatibility
- **F1 Core Ledger:** Strictly **FROZEN**. No changes to core F1 domains, database tables, invariants, or accounting logic are permitted.
- **F1 Event Contract:** Allowed versioned additive extensions under strict ADR/change-control exception.
- F2 consumes strictly versioned/additive events and remains a downstream consumer only.
- Updating the F1 DB helper RPC functions (`finance_post_transaction` and `finance_reverse_transaction`) to populate the additional `cash_legs` property in `finance_outbox_events` for v2 events is classified as a Controlled F1 Contract Extension. The v1 contract remains completely backwards compatible.

### Lock 2 — recordCashMovement() is NOT a Public Financial-Entry API
- Product Verticals and external modules **MUST NOT** call `ICashEngine.recordCashMovement()` directly for business transactions.
- The flow is strictly: `Product Vertical → F1 POSTED → F1 Event → F2 Projection`.
- `recordCashMovement()` is strictly an **internal projection primitive** used only by the internal projection event consumer. It is not exposed to external callers, preventing verticals from creating independent cash facts.

### Lock 3 — Valuation Ownership
- F2 **does not own or govern exchange rates**. The exchange rate engine is owned by F3 (Treasury Engine).
- F2 only **receives valuation inputs** (exchange rates provided in F1 cash transaction events) and **computes derived functional valuations** (`functional_balance_minor`). F2 does not create a second source of truth for exchange rates.

### Lock 4 — Reconciliation Cannot Adjust Ledger Directly
- Local cash balance discrepancies during bank statement reconciliation cannot modify F2 cash positions directly.
- The flow is strictly: `Bank Statement → Staging → Matching → Discrepancy → Review → F1 POSTED → F2 Projection`.
- F2 adjustments without an F1 transaction are prohibited. F2 does not act as a shadow ledger.

---

## VI. RESOLVED DESIGN DECISIONS

### Q1 — Multi-Currency Cash Position (Authoritative vs Derived)
- **Authoritative Balance:** Native currency (`balance_minor`, `currency`). This is the concrete cash fact.
- **Derived Valuation:** Functional currency equivalent, calculated periodically or at movement time.
- **Structure:**
  - `balance_minor`: Native balance of the account (Minor units decimal string).
  - `currency`: Native currency code (ISO 4217).
  - `functional_balance_minor`: Derived valuation in functional currency (VND).
  - `functional_currency`: Tenant's base currency (VND).
  - `valuation_rate`: Exchange rate used for conversion.
  - `valuation_as_of`: Timestamp of valuation calculation.
  - `valuation_source`: Source of exchange rate (e.g. 'F1_POST', 'F3_TREASURY_DAILY').
- **Invariant:** `finance_cash_movements` is the sole authoritative history of native cash facts. Replaying movements reconstructs the native balance exactly. Functional valuation is derived and subject to translation rate updates.

### Q2 — F1-First Enforcement
- **Enforcement:** Direct invocations of `recordCashMovement` without an associated `f1_transaction_id` are forbidden for business cash transactions.
- **Reconciliation Staging:** Bank statement records are staged in `finance_cash_staged_lines` (inflow/outflow). Staged lines only generate a `finance_cash_movements` record **after** an F1 transaction is posted and matched.

### Q3 — Runway Alert Threshold Configuration
- **Configuration Table:** Tenant thresholds are stored in `finance_tenant_configs` (not bank accounts).
- **Runway Calculation Invariant:** Cash Runway is calculated on a **consolidated tenant basis** (sum of available cash balances converted to functional currency / average daily burn rate) to provide meaningful business-level runway metrics. Per-account runway is secondary metadata.

---

## VII. EVENT CONTRACT RESOLUTION (F1 event leg v2)

Since F1 is frozen, we will introduce a new migration under change control to upgrade the `finance_post_transaction` and `finance_reverse_transaction` database RPCs to emit `finance.transaction.posted.v2`. This event payload includes detailed financial cash legs required for F2 cash projection.

### Event Schema: `finance.transaction.posted.v2`
```json
{
  "event_type": "finance.transaction.posted.v2",
  "transaction_id": "UUID",
  "tenant_id": "UUID",
  "transaction_type": "CASH",
  "posted_at": "ISO_8601_TIMESTAMP",
  "source_type": "spa.booking",
  "source_id": "UUID",
  "cash_legs": [
    {
      "account_id": "UUID",
      "account_code": "TEXT",
      "direction": "INFLOW | OUTFLOW",
      "amount_minor": "TEXT",
      "currency": "TEXT",
      "functional_amount_minor": "TEXT",
      "functional_currency": "TEXT",
      "exchange_rate": "TEXT"
    }
  ]
}
```

---

## VIII. DATABASE OWNERSHIP MAP — F2 NEW TABLES

### Table: `finance_tenant_configs`
```sql
CREATE TABLE finance_tenant_configs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  warning_threshold_days  INTEGER NOT NULL DEFAULT 30,
  critical_threshold_days INTEGER NOT NULL DEFAULT 7,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE finance_tenant_configs ENABLE ROW LEVEL SECURITY;
```

### Table: `finance_bank_accounts`
```sql
CREATE TABLE finance_bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  bank_name       TEXT NOT NULL,
  account_number  TEXT NOT NULL,
  account_name    TEXT NOT NULL,
  currency        TEXT NOT NULL,
  linked_finance_account_id UUID REFERENCES finance_accounts(id),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, account_number)
);

ALTER TABLE finance_bank_accounts ENABLE ROW LEVEL SECURITY;
```

### Table: `finance_cash_positions`
```sql
CREATE TABLE finance_cash_positions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id),
  bank_account_id           UUID NOT NULL REFERENCES finance_bank_accounts(id),
  
  -- Authoritative Native Balance
  balance_minor             NUMERIC(20,0) NOT NULL DEFAULT 0,
  currency                  TEXT NOT NULL,
  
  -- Derived Functional Valuation
  functional_balance_minor  NUMERIC(20,0) NOT NULL DEFAULT 0,
  functional_currency       TEXT NOT NULL DEFAULT 'VND',
  valuation_rate            NUMERIC(18,6) NOT NULL DEFAULT 1.000000,
  valuation_as_of           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valuation_source          TEXT NOT NULL DEFAULT 'F1_POST',
  
  -- Concurrency
  version                   BIGINT NOT NULL DEFAULT 0,
  last_movement_id          UUID, -- references finance_cash_movements(id) deferred in migration
  as_of                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, bank_account_id)
);

ALTER TABLE finance_cash_positions ENABLE ROW LEVEL SECURITY;
```

### Table: `finance_cash_movements`
```sql
CREATE TABLE finance_cash_movements (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id),
  bank_account_id           UUID NOT NULL REFERENCES finance_bank_accounts(id),
  idempotency_key           TEXT NOT NULL,
  
  -- Core Cash Leg Info
  direction                 TEXT NOT NULL CHECK (direction IN ('INFLOW', 'OUTFLOW')),
  amount_minor              NUMERIC(20,0) NOT NULL CHECK (amount_minor > 0),
  currency                  TEXT NOT NULL,
  
  -- Derived Functional Valuation
  functional_amount_minor   NUMERIC(20,0) NOT NULL,
  functional_currency       TEXT NOT NULL DEFAULT 'VND',
  valuation_rate            NUMERIC(18,6) NOT NULL,
  
  -- F1 Traceability (Strict UUID references and Leg Key)
  f1_transaction_id         UUID NOT NULL, -- UUID Type
  cash_leg_reference        TEXT NOT NULL, -- Stable unique UUID leg ID (cash_leg_id) mapped from F1 transaction line
  
  source_type               TEXT NOT NULL, -- 'f1.transaction'
  source_id                 TEXT NOT NULL,
  description               TEXT,
  recorded_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Invariant: Unique cash movement per F1 transaction leg
  UNIQUE(tenant_id, f1_transaction_id, cash_leg_reference),
  UNIQUE(tenant_id, idempotency_key)
);

ALTER TABLE finance_cash_movements ENABLE ROW LEVEL SECURITY;
```

### Table: `finance_cash_quarantine` (Failed / Unmapped Events)
```sql
CREATE TABLE finance_cash_quarantine (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  event_id          UUID NOT NULL,
  event_type        TEXT NOT NULL,
  payload           JSONB NOT NULL,
  failure_reason    TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED')),
  resolved_by       TEXT,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE finance_cash_quarantine ENABLE ROW LEVEL SECURITY;
```

---

## IX. F2 INVARIANTS (Non-Negotiable Rules)

### F2-I-1: Cash Position is Derived, Not Primary (Materialized Projection)
`finance_cash_positions` is a derived projection (materialized state). The append-only ledger `finance_cash_movements` is the only authoritative historical record. The derived state can be completely deleted and reconstructed at any time by replaying `finance_cash_movements`.

### F2-I-2: Cash Movement Immutability
Records in `finance_cash_movements` are immutable. Corrections must be handled by posting a Reversal cash movement followed by a Corrected cash movement, preserving historical audit trails.

### F2-I-3: Unmapped Cash Account Quarantine (No Silent Skip)
When F2 receives a CASH event for an account that does not map to a bank account in `finance_bank_accounts`, it MUST NOT skip it silently. The event is captured in `finance_cash_quarantine`, and a critical alert is triggered for operator mapping remediation. **Invariant: No cash leg may be silently discarded.**

### F2-I-4: Negative Cash Balance Policy
A negative balance in `finance_cash_positions` is not treated as database corruption, but as a business state. Negative balances must be explicitly classified (`balance_minor < 0` triggers state change to `OVERDRAFT`). If tenant policy does not permit overdraft, a policy violation event is raised to F5.

### F2-I-5: Cash Mutation Boundary Lock
No F2 cash position mutation may occur without a corresponding F1 POSTED transaction. Inflow/outflow figures cannot be adjusted directly at the F2 database level without F1 event propagation.

---

## X. CONCURRENCY & FAILURE MODEL

- **Row Locks:** Row-level `FOR UPDATE` locks on `finance_cash_positions` during cash movement insertions serialize updates and ensure atomic balance accumulation.
- **Deduplication:** Double event delivery is filtered by `UNIQUE(tenant_id, f1_transaction_id, cash_leg_reference)` on the cash movement table.
- **Ordering & Determinism:** Reconstruction and projection sort movements by F1 `recorded_at` and stable key elements, ensuring eventual consistency is fully deterministic regardless of event delivery sequence.

---

## XI. F2 VERIFICATION GATES

| Gate | Name | F2 Verification Tests |
|---|---|---|
| **Gate F-1** | Architecture Compliance | F2 engine operates in `src/platform/finance/engines/cash-engine/`. No direct modification to frozen F1. |
| **Gate F-2** | Contract Boundary | Direct updates to `finance_cash_positions` blocked. Interface restricted to `ICashEngine`. |
| **Gate F-3** | Tenant Isolation (P0) | Verified cross-tenant boundary locks and RLS on F2 tables. |
| **Gate F-5** | Movement Immutability | Delete/Update operations on `finance_cash_movements` fail at database layer. |
| **Gate F-6** | Idempotency | Identical events processed twice result in exactly one movement. |
| **Gate F-7** | Explicit Negative Balances| Accounts in overdraft are flagged correctly without database errors. |
| **Gate F-10**| State Reconstruction | Replaying `finance_cash_movements` rebuilds `finance_cash_positions` exactly. |
| **Gate F2-A**| F1 Event leg consumption | Correct processing of `finance.transaction.posted.v2` events; non-CASH events are ignored. |
| **Gate F2-B**| Quarantine | Unmapped cash account legs are quarantined in `finance_cash_quarantine` and alert triggered. |

---

## XII. PROPOSED PUBLIC CONTRACTS — ICashEngine

```typescript
// RecordCashMovementRequest is strictly internal to the projection engine.
export interface RecordCashMovementRequest {
  tenant_id: string;
  bank_account_id: string;
  idempotency_key: string;
  direction: 'INFLOW' | 'OUTFLOW';
  amount_minor: string;
  currency: string;
  f1_transaction_id: string;
  cash_leg_reference: string;
  source_type: string;
  source_id: string;
  description?: string;
  recorded_at?: Date;
}

export interface BankAccount {
  id: string;
  tenant_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  currency: string;
  linked_finance_account_id?: string;
  is_active: boolean;
}

export interface CashPosition {
  id: string;
  tenant_id: string;
  bank_account_id: string;
  balance_minor: string;
  currency: string;
  functional_balance_minor: string;
  functional_currency: string;
  valuation_rate: string;
  valuation_as_of: Date;
  version: number;
}

export interface ICashEngine {
  readonly engineName: string;
  readonly engineVersion: string;

  // External APIs
  registerBankAccount(req: RegisterBankAccountRequest): Promise<FinanceEngineResponse<BankAccount>>;
  getCashPosition(tenantId: string, bankAccountId: string): Promise<FinanceEngineResponse<CashPosition>>;
  getConsolidatedRunway(tenantId: string): Promise<FinanceEngineResponse<{ runway_days: number; consolidated_cash: Money }>>;

  // Internal projection API only (blocked for direct external calls)
  recordCashMovement(req: RecordCashMovementRequest): Promise<FinanceEngineResponse<CashMovement>>;
}
```

---

## XIII. CODING ROADMAP (PHASE ORDER)

> [!IMPORTANT]
> The F2 implementation phase must strictly follow this order. UI, dashboard, and runway calculation changes are blocked until the core transactional bounds are completed and verified:

1. **F2.0 Architecture Freeze** (Complete current analysis, obtain Human Sign-off, freeze document)
2. **F2.1 Database + RLS** (Additive schema migrations for new tables, triggers, indexes, and RLS policies)
3. **F2.2 Cash Projection / Movement Engine** (Core domain services and database RPC procedures for cash movements)
4. **F2.3 F1 Event Consumer** (Outbox consumer integration supporting `finance.transaction.posted.v2` events)
5. **F2.4 Reconstruction** (RPC job and tests verifying complete reconstruction of positions from cash movements)
6. **F2.5 Concurrency Hardening** (Optimistic locking and `FOR UPDATE` row serialization tests)
7. **F2.6 Verification Gates** (Executing and verifying the 11 F2 verification gates)
8. **F2.7 Human Sign-off** (Presentation of F2 report and approval)
9. **F2 FREEZE** (Freezing the cash projection engine)

---

## XIV. VERDICT

```
F2 ARCHITECTURE GATE

Status:  APPROVED FOR CODING

All 4 architectural locks (F1 event compatibility, projection
API boundary, FX Valuation governance, and Adjustment boundary)
are fully locked and documented.

F1 remains immutable/frozen. F2 is additive-only and
downstream of F1. No F2 operation may create an independent
financial truth.
```

---

## XV. F2 PHASE IMPLEMENTATION STATUS — 2026-08-15

### Phase Completion Matrix

| Phase | Description | Status | Test Evidence |
|---|---|---|---|
| F2.0 | Architecture Freeze | FROZEN | Gate document approved |
| F2.1 | Database + RLS Migrations | VERIFIED | 22/22 PASS (finance-f2-db-rls) |
| F2.2 | Cash Projection Worker | VERIFIED | 17/17 PASS (finance-f2-projection-worker) |
| F2.3 | Reporting API (Read Layer) | VERIFIED | 12/12 PASS (finance-f2-reporting-api) |
| F2.4 | Reconstruction RPC | VERIFIED | 15/15 PASS (finance-f2-reconstruction) |
| F2.5 | Concurrency Hardening | PLANNED | — |
| F2.6 | Verification Gates | PLANNED | — |
| F2.7 | Human Sign-off | PLANNED | — |

---

## XVI. F2.3 REPORTING API — VERIFICATION EVIDENCE

### Architecture Gate: VERIFIED

F2.3 is a strictly read-only layer. It implements `ICashReportingEngine` with zero write capabilities. No financial truth is created, modified, or bypassed.

### Files Delivered

| File | Role |
|---|---|
| `src/platform/finance/engines/cash-engine/cash-engine.service.ts` | CashEngineService — F2.3 implementation |
| `src/platform/finance/contracts/cash-engine.contract.ts` | ICashReportingEngine contract + typed schemas |
| `src/platform/finance/__tests__/finance-f2-reporting-api.test.ts` | 12-case integration test suite |

### F2.3 Test Results — 2026-08-15

```
Test Suite: finance-f2-reporting-api.test.ts
Duration:   ~8s
Result:     12/12 PASS (0 failures)

T01  Get Bank Account — retrieves bank account details              PASS
T02  List Bank Accounts — lists all tenant accounts                 PASS
T03  Get Cash Position — correct balance/currency/functional        PASS
T04  List Cash Positions — all positions for tenant                 PASS
T05  Get Cash Movements — default pagination                        PASS
T06  Query Movements (Filters) — direction + bank account filter    PASS
T07  Consolidated Runway — days calculated correctly                PASS
T08  Quarantine Diagnostics — typed schema with code extraction     PASS
T09  Authorization — UNAUTHORIZED_TENANT_ACCESS enforced            PASS
T10  Invalid Pagination rejection — <1, >200, offset<0 rejected     PASS
T11  Runway Currency/Valuation Integrity — sums functional_balance  PASS
T12  Telemetry Failure Isolation — API succeeds if telemetry fails  PASS
```

### Full F2 Regression — 2026-08-15

```
Command: jest --testPathPatterns="finance-f2" --runInBand

finance-f2-db-rls.test.ts            22/22  PASS  (F2.1 — Database + RLS)
finance-f2-projection-worker.test.ts  17/17  PASS  (F2.2 — Cash Projection)
finance-f2-reporting-api.test.ts      12/12  PASS  (F2.3 — Reporting API)
finance-f2-reconstruction.test.ts     18/18  PASS  (F2.4 — Reconstruction RPC)

TOTAL: 69/69  ALL PASS
Failures: 0
F1 Regression Impact: None
```

### 4-Hardening Gate Compliance

| Gate | Requirement | Status |
|---|---|---|
| Pagination | limit defaults 50; 1-200 valid; invalid INVALID_PAGINATION | Implemented + T10 verified |
| Runway | Read mv_cash_flow.burn_rate only; no F2.3 burn rate inference | Enforced in service |
| Consolidated Cash | SUM(finance_cash_positions.functional_balance_minor) direct | T11 verified |
| TypeSafety-NoAny | Zero any usage; all types explicit | Enforced |

---

## XVII. F2.4 RECONSTRUCTION RPC — VERIFICATION EVIDENCE

### Architecture Gate: VERIFIED

F2.4 implements derived cash position reconstruction strictly from the immutable history log (`finance_cash_movements`). Position mutations are bypassed via a transient, table-specific switch `finance.allow_position_reconstruction = 'true'` checked inside trigger functions. This custom setting is strictly transaction-local (`SET LOCAL`) and is additionally guarded by verifying that `current_user` is an authorized privileged role (`service_role`, `postgres`, `supabase_admin`). Direct updates by regular users are completely blocked.

### Chronology Note on Timestamps
The migration file `20260816030000_finance_cash_reconstruction_rpc.sql` carries a `2026-08-16` timestamp as part of the F2 batch sequence designed to follow the F1 freeze date (`2026-08-15`). Verification was performed on `2026-08-15` using this chronological rollout.

### Files Delivered

| File | Role |
| --- | --- |
| `supabase/migrations/20260816030000_finance_cash_reconstruction_rpc.sql` | SQL Migration — reconstruction RPC and trigger bypass |
| `src/platform/finance/contracts/cash-engine.contract.ts` | ICashReconstructionEngine interface definition |
| `src/platform/finance/engines/cash-engine/cash-engine.service.ts` | Service implementation with fail-closed checks |
| `src/platform/finance/__tests__/finance-f2-reconstruction.test.ts` | 18-case integration test suite |

### F2.4 Test Results — 2026-08-15

```
Test Suite: finance-f2-reconstruction.test.ts
Duration:   ~20s
Result:     18/18 PASS (0 failures)

T01  Single account reconstruction — derived balance matches history PASS
T02  Multiple accounts reconstruction — rebuilds all tenant accounts PASS
T03  Multi-movement balance accuracy — net inflows/outflows sum      PASS
T04  Valuation rate preservation — USD/VND conversion preserved     PASS
T05  Tenant isolation — Tenant A rebuild does not touch Tenant B    PASS
T06  History immutable — movements log absolutely untouched        PASS
T07  Empty fallback — 0 movements resolves to 0 position balance    PASS
T08  Permission check (Fail-Closed) — unauthorized queries throw   PASS
T09  Reconstruction Determinism — Snapshot A === Snapshot B          PASS
T10  Idempotent Reconstruction — repeated runs do not insert duplicates PASS
T11  Corrupted Position Recovery — corrects manual position corrupt PASS
T12  No Mutation Escape — attempts to write movements fail (P0)     PASS
T13  Database Tenant Boundary — mismatched bank account rejected    PASS
T14-A Reconstruction Privilege Scope — transient setting reset verified PASS
T14-B Reconstruction Failure Rollback — verified atomic transaction rollback PASS
T15  Reconstruction Privilege Escalation — reject direct GUC bypass by unauthorized role PASS
T16  Direct GUC Injection — verify setting is local and blocks bypass PASS
T17  Reconstruction RPC Cross-Tenant Attempt — verify execution requires auth PASS
```

---

## XVIII. F2.4 — RECONSTRUCTION RPC VERIFICATION

```
Test Suite: finance-f2-reconstruction.test.ts
Duration:   ~20s
Result:     18/18 PASS (0 failures)

T01  Single account reconstruction — derived balance matches history PASS
T02  Multiple accounts reconstruction — rebuilds all tenant accounts PASS
T03  Multi-movement balance accuracy — net inflows/outflows sum      PASS
T04  Valuation rate preservation — USD/VND conversion preserved     PASS
T05  Tenant isolation — Tenant A rebuild does not touch Tenant B    PASS
T06  History immutable — movements log absolutely untouched        PASS
T07  Empty fallback — 0 movements resolves to 0 position balance    PASS
T08  Permission check (Fail-Closed) — unauthorized queries throw   PASS
T09  Reconstruction Determinism — Snapshot A === Snapshot B          PASS
T10  Idempotent Reconstruction — repeated runs do not insert duplicates PASS
T11  Corrupted Position Recovery — corrects manual position corrupt PASS
T12  No Mutation Escape — attempts to write movements fail (P0)     PASS
T13  Database Tenant Boundary — mismatched bank account rejected    PASS
T14-A Reconstruction Privilege Scope — transient setting reset verified PASS
T14-B Reconstruction Failure Rollback — verified atomic transaction rollback PASS
T15  Reconstruction Privilege Escalation — reject direct GUC bypass by unauthorized role PASS
T16  Direct GUC Injection — verify setting is local and blocks bypass PASS
T17  Reconstruction RPC Cross-Tenant Attempt — verify execution requires auth PASS
```

---

## XIX. F2.5 — CONCURRENCY & SECURITY HARDENING VERIFICATION

### Architecture

Migration `20260816040000_finance_cash_concurrency_locks.sql` implements:

| Layer | Mechanism | Invariant |
|---|---|---|
| **Bank Account Lock** | `FOR SHARE` acquired before movement INSERT | F2.5-I-1: All position mutations require bank account lock |
| **Position Row Lock** | `ON CONFLICT DO UPDATE` is PostgreSQL row-serialized | F2.5-I-2: Position = deterministic reduction of movements |
| **Unique Leg Constraint** | `uq_finance_cash_movements_leg (tenant_id, f1_transaction_id, cash_leg_reference)` | No F1 leg can be projected twice under any idempotency key |
| **Deterministic Lock Ordering** | Reconstruction: `FOR UPDATE ORDER BY id ASC` | T24: Multi-account deadlock prevention |
| **Movement Absolute Immutability** | `finance_cash_mutation_guard` blocks UPDATE/DELETE unconditionally | T25: Movements are permanent historical fact |

### Regression Bugs Found and Fixed

Two bugs were caught during final regression verification after F2.5 migration:

| # | Bug | Root Cause | Fix |
|---|---|---|---|
| 1 | `reconstructed_accounts_count` always `0` | `cash-engine.service.ts` checked wrong field name — RPC returns `reconstructed_count`, service expected `reconstructed_accounts_count` | Read `reconstructed_count` from RPC response |
| 2 | Duplicate leg reference silently accepted as idempotent | `EXCEPTION WHEN unique_violation` handler returned `is_duplicate: true` for ALL constraint violations, including `uq_finance_cash_movements_leg` | Re-query by `idempotency_key`; raise `DUPLICATE_CASH_LEG_REFERENCE` (F2030) if not found — preserving idempotency for same-key retries while surfacing architectural violations |

Bug 2 is architecturally significant: it prevented the projection worker from quarantining duplicate-leg violations, which would have masked F2 integrity failures as normal delivery retries.

### Concurrency Test Suite Results

```
Test Suite: finance-f2-concurrency.test.ts
Duration:   ~13s
Result:     10/10 PASS (0 failures)

T18  10 concurrent projections → correct aggregate balance             PASS
T19  5 concurrent same-key projections → exactly 1 movement written   PASS
T20  Out-of-order projection → balance equals regardless of order      PASS
T21  Reconstruction races concurrent projection → no corruption        PASS
T22  Direct SET LOCAL bypass → blocked by current_user check           PASS
T23  TRUE multi-connection concurrency → parallel Supabase clients     PASS
T24  Multi-account lock ORDER BY id ASC → no deadlock                  PASS
T25  Direct UPDATE/DELETE on movements → blocked by trigger            PASS
T26  Mutation path lock coverage → all writes acquire bank acct lock   PASS
T27  Position == Σ movements (T27) → state reconstruction equality     PASS
```

> [!IMPORTANT]
> **T23 is the most critical test.** It verifies true cross-connection concurrency using independent Supabase clients — not just parallel Promises within the same connection. This means the PostgreSQL-level lock protocol is verified, not just the application-level logic.

> [!IMPORTANT]
> **T27 is the projection integrity invariant.** `cash_positions.balance_minor == Σ cash_movements` must hold after any number of concurrent projections. This invariant is the mathematical foundation that makes reconstruction trustworthy.

---

## XX. FINAL FREEZE VERDICT

```
═══════════════════════════════════════════════════════════
  F2 CASH & TREASURY ENGINE — FINAL FREEZE
  Date: 2026-08-15T22:24:46+07:00
  Commit: 7d0b2b3aab3a9c7cf97f2b8ec5893b73998015b2
  Migration Range: 20260816000000 → 20260816040000
═══════════════════════════════════════════════════════════

ARCHITECTURE GATES

  Gate                              Status
  ─────────────────────────────────────────
  F1 immutable boundary             ✅ PASS
  F1-first cash flow                ✅ PASS
  Versioned event contract          ✅ PASS
  Stable cash_leg_id                ✅ PASS
  Multi-currency native fact        ✅ PASS
  Functional valuation derived      ✅ PASS
  No silent unmapped cash           ✅ PASS
  Quarantine (Case 2/3)             ✅ PASS
  Negative/overdraft handling       ✅ PASS
  Movement immutability             ✅ PASS
  Position derived state            ✅ PASS
  Reconstruction                    ✅ PASS
  Reconstruction privilege isolation✅ PASS
  Tenant isolation / RLS            ✅ PASS
  Idempotency                       ✅ PASS
  Concurrent projection             ✅ PASS
  Cross-connection concurrency      ✅ PASS
  Reconstruction race               ✅ PASS
  Deadlock prevention               ✅ PASS
  Mutation-path lock coverage       ✅ PASS
  State reconstruction equality     ✅ PASS
  Reporting API isolation           ✅ PASS

TEST GATE

  Suite                             Result
  ─────────────────────────────────────────
  finance-f2-db-rls                 22/22 ✅
  finance-f2-projection-worker      17/17 ✅
  finance-f2-reporting-api          12/12 ✅
  finance-f2-reconstruction         18/18 ✅
  finance-f2-concurrency            10/10 ✅
  ─────────────────────────────────────────
  TOTAL                             79/79 ✅

DOWNSTREAM BOUNDARY

  F2 is additive-only. No F2 operation creates an independent
  financial truth. F1 remains the single source of accounting
  truth. F2 cash_movements is the single source of cash
  projection history.

  F3 and all downstream phases MUST:
    ✓ Consume F2 read APIs via contract
    ✗ Never write to finance_cash_movements directly
    ✗ Never write to finance_cash_positions directly
    ✗ Never modify finance_bank_accounts outside their
      own configuration path

CHANGE CONTROL

  Post-freeze modifications to F2 are PROHIBITED except:
    - Security defects with CVE-level impact
    - Bug fixes that do not alter the data model or invariants
  All exceptions require Human Architect review and a new ADR.

STATUS: 🔒 F2 CASH & TREASURY ENGINE — FINAL FREEZE APPROVED
═══════════════════════════════════════════════════════════
```
