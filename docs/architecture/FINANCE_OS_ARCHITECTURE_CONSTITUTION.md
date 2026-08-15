# BELLA FINANCE OS — ARCHITECTURE CONSTITUTION v1.0

> **Status:** PENDING ARCHITECTURE GATE APPROVAL  
> **Effective Milestone:** Finance Kernel F1–F5 Freeze  
> **Scope:** Mandatory for all agents, engineers, and Product Verticals that interact with Finance OS  
> **Analogous to:** `HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`

---

## I. FINANCE OS — SUPREME ARCHITECTURAL PRINCIPLE

Finance OS là **OS tài chính độc lập** trong Bella Platform, ngang hàng với Healthcare OS, Real Estate OS, và Education OS. Finance OS là **nguồn chân lý tài chính duy nhất (Single Source of Financial Truth)** của toàn bộ platform.

```
                       BELLA CORE PLATFORM
                              │
        ┌─────────────────────┼──────────────────────┐
        │                     │                      │
  Healthcare OS          Finance OS           Real Estate OS
        │                     │                      │
        └─────────────────────┼──────────────────────┘
                              │
                    Product / Vertical Layer
              Spa / Hospital / Land / Education
```

### Finance OS sở hữu Financial Truth. Vertical sở hữu Business Truth.

```
Hospital
  │
  │ ServiceRendered (Business Event — owned by Hospital)
  ▼
Finance Bridge (in Product Vertical)
  │
  │ postTransaction(), createReceivable() (via Finance Contracts)
  ▼
Finance OS (F1–F5)
  │
  ├── Ledger / Financial Account
  ├── Receivable
  ├── Revenue
  └── Financial State
```

**Finance OS không biết gì về:** Patient, Doctor, Encounter, Property, Student, KTV.  
**Finance OS chỉ biết:** Financial Account, Financial Transaction, Money, Receivable, Payable, Cash, Budget, Control.

---

## II. 🔴 HARD KERNEL FREEZE LOCK — F1–F5

```
BELLA FINANCE OS — KERNEL FREEZE RULE

Finance OS Kernel F1–F5 is FROZEN after Architecture Gate approval.

The AI / Engineer MUST NOT:
1. Create "F6" or any new Core Finance Kernel engine in F1–F5 boundary.
2. Modify existing F1–F5 bounded-context responsibilities.
3. Bypass Finance contracts to query finance_* tables directly from Product layer.
4. Duplicate Finance entities (FinancialTransaction, FinancialAccount, Money).
5. Introduce vertical-specific logic (Patient, Property, Student) into F1–F5.
6. Post transactions to a Closed or Locked Accounting Period.
7. Mutate a POSTED transaction directly — use Reversal + Correction pattern.
8. Create imbalanced journal entries (Σ debit ≠ Σ credit).
9. Bypass idempotency key check.
10. Publish domain events directly before database commit (use transactional outbox).

The AI / Engineer MUST:
1. Build product-level finance logic in Finance Bridge (Product Vertical layer).
2. Consume F1–F5 capabilities through public Finance Contracts only.
3. Pass all 10 Finance Verification Gates before any Finance Kernel feature is "complete".
4. Preserve multi-tenant isolation (tenant_id on every finance table, RLS enabled).
```

---

## III. FINANCE DOMAIN BOUNDARY

### Law F-1: WHO OWNS WHAT

| Entity / Data | Owner | Table Prefix | Access Rule |
|---|---|---|---|
| **Financial Account (Chart of Accounts)** | **Finance OS — F1 Ledger** | `finance_accounts` | Via F1 Contract |
| **Financial Transaction** | **Finance OS — F1 Ledger** | `finance_transactions`, `finance_transaction_lines` | Via F1 Contract |
| **Financial Event** | **Finance OS — F1 Ledger** | `finance_events` | Via Event Bus |
| **Accounting Period** | **Finance OS — F1 Ledger** | `finance_accounting_periods` | Via F1 Contract |
| **Cash Position** | **Finance OS — F2 Cash** | `finance_cash_positions`, `finance_bank_accounts` | Via F2 Contract |
| **Cash Movement** | **Finance OS — F2 Cash** | `finance_cash_movements` | Via F2 Contract |
| **Receivable** | **Finance OS — F3 AR/AP** | `finance_receivables` | Via F3 Contract |
| **Payable** | **Finance OS — F3 AR/AP** | `finance_payables` | Via F3 Contract |
| **Commitment / Obligation** | **Finance OS — F3 AR/AP** | `finance_commitments` | Via F3 Contract |
| **Budget** | **Finance OS — F4 Budget** | `finance_budgets` | Via F4 Contract |
| **Forecast** | **Finance OS — F4 Budget** | `finance_forecast_models`, `finance_forecast_lines` | Via F4 Contract |
| **Financial Control / Limit** | **Finance OS — F5 Control** | `finance_controls` | Via F5 Contract |
| **Financial Approval** | **Finance OS — F5 Control** | `finance_approvals` | Via F5 Contract |
| **Financial State (Materialized)** | **Finance OS — All Engines** | `finance_financial_state` | Via Intelligence Contracts |
| **Audit Trail (Immutable)** | **Finance OS — All Engines** | `finance_audit_trail` | Append-only, via F1 |
| **Customer (Party)** | **Product Vertical / Core Party Engine** | (not finance tables) | Finance uses party_id reference only |
| **Service / Product Item** | **Product Vertical** | (not finance tables) | Finance uses reference_type/reference_id |

### Law F-2: WHAT FINANCE OS NEVER OWNS

Finance OS **never** creates or duplicates:
- Patient, Doctor, Encounter → owned by Healthcare OS
- Property, Tenant (Real Estate), Contract → owned by Real Estate OS
- Customer, KTV, Booking → owned by Bella Spa / Vertical
- Student, Course → owned by Education OS

Finance OS references external entities by `party_id` (opaque UUID) and `source_type + source_id` only.

---

## IV. FINANCIAL PRIMITIVES (Immutable Kernel Types)

These types are **frozen**. They may not be changed without Architecture Review.

### 4.1 Money — First-Class Primitive

```typescript
/**
 * Money is the atomic financial unit in Finance OS.
 * NEVER store amount without currency.
 * NEVER compare amounts across currencies without exchange_rate.
 */
type CurrencyCode = 'VND' | 'USD' | 'EUR' | 'SGD' | string; // ISO 4217

interface Money {
  amount_minor: string;  // Stored as decimal string to represent minor unit (cents/đồng) without JS floating point limitations
  currency: CurrencyCode;
}

// CORRECT: Money { amount_minor: "1000000", currency: 'VND' } = 1,000,000 VND
// CORRECT: Money { amount_minor: "100",     currency: 'USD' } = $1.00
// WRONG:   amount: 1000000  (no currency — forbidden)
// WRONG:   amount_minor: 100.5 (floating point / number type — forbidden, use string of minor units)
```

### 4.2 FinancialAccount

```typescript
interface FinancialAccount {
  id: string;
  tenant_id: string;
  code: string;            // e.g., '1111', '5110', '1310'
  name: string;
  type: AccountType;       // ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
  normal_balance: 'DEBIT' | 'CREDIT';  // T-account normal side
  currency: CurrencyCode;
  is_active: boolean;
}
```

### 4.3 FinancialTransaction (Immutable after POSTED)

```typescript
interface FinancialTransaction {
  id: string;
  tenant_id: string;
  
  // Idempotency (invariant: must be unique per tenant)
  idempotency_key: string;  // caller-supplied, prevents duplicate posts
  
  // Source traceability (invariant: must always be populated)
  source_type: string;    // 'spa.booking', 'hospital.service', 'land.contract', etc.
  source_id: string;      // ID of the originating business event

  // Status
  status: TransactionStatus; // DRAFT | POSTED | REVERSED | VOIDED
  
  // Period
  accounting_period_id: string;  // must reference an OPEN period
  posted_at: Date | null;        // null until status = POSTED
  
  // Currency
  transaction_currency: CurrencyCode;  // currency of the originating event
  functional_currency: CurrencyCode;   // tenant's base currency (usually VND)
  exchange_rate: ExchangeRate;         // decoupled decimal rate representation
  
  description: string;
  reference_type: string;
  reference_id: string;
  
  lines: FinancialTransactionLine[];
}

interface ExchangeRate {
  rate: string;            // Decimal string representing conversion multiplier (e.g. "24500.000000")
  source_currency: CurrencyCode;
  target_currency: CurrencyCode;
  effective_at: Date;
}

interface FinancialDimensions {
  cost_center_id?: string;
  business_unit_id?: string;
  location_id?: string;     // e.g. branch ID
  project_id?: string;
  department_id?: string;
  custom_dimension_type?: string;
  custom_dimension_id?: string;
}

interface FinancialTransactionLine {
  id: string;
  tenant_id: string;
  transaction_id: string;
  account_id: string;
  
  debit: Money;              // amount in transaction_currency
  credit: Money;             // amount in transaction_currency
  
  debit_functional: Money;   // amount in functional_currency
  credit_functional: Money;  // amount in functional_currency
  
  dimensions?: FinancialDimensions; // P1: Abstraction for cost center, BU, location dimensions
  memo: string;
}
```

### 4.4 AccountingPeriod

```typescript
type PeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

interface AccountingPeriod {
  id: string;
  tenant_id: string;
  name: string;          // e.g., '2026-08', '2026-Q3'
  period_start: Date;
  period_end: Date;
  status: PeriodStatus;
  closed_by?: string;    // user_id
  closed_at?: Date;
  locked_by?: string;
  locked_at?: Date;
}

// Invariant: transaction cannot be posted to CLOSED or LOCKED period.
// Invariant: LOCKED > CLOSED > OPEN in terms of restriction.
// Invariant: Period cannot be reopened once LOCKED.
```

---

## V. FINANCIAL INVARIANTS (Non-Negotiable Rules)

### Invariant F-I-1: Double-Entry Balance

```
For every FinancialTransaction with status = POSTED:
  Σ line.debit.amount  === Σ line.credit.amount
  
Any transaction that violates this MUST be rejected with:
  Error: DOUBLE_ENTRY_IMBALANCE
```

Database enforcement:
```sql
-- CHECK constraint on finance_transactions (via trigger or application layer)
-- Σ debit = Σ credit must hold across all lines of one transaction
```

### Invariant F-I-2: Transaction Immutability & Reversal

```
A POSTED transaction is IMMUTABLE.
It MUST NOT be updated in-place.

To correct a POSTED transaction:
  Step 1: Post a REVERSAL transaction (mirror debit/credit of original)
  Step 2: Post a CORRECTED transaction with correct values
  
Original Transaction
       ↓
Reversal Transaction   (reversal_of = original.id)
       ↓
Corrected Transaction  (corrects = original.id)
```

Database enforcement:
```sql
-- finance_transactions has reversal_of UUID column (nullable FK to self)
-- Application: status='POSTED' rows must never be UPDATEd on financial fields
```

### Invariant F-I-3: Idempotency

```
F1.postTransaction(request) called twice with same idempotency_key
  MUST return the same transaction result (not create a duplicate).

Implementation: 
  - finance_transactions.idempotency_key has UNIQUE(tenant_id, idempotency_key)
  - On conflict: return existing transaction, HTTP 200 (not 409)
```

### Invariant F-I-4: Period Control

```
Transactions MUST NOT be posted to CLOSED or LOCKED accounting periods.

F1.postTransaction() MUST:
  1. Resolve the accounting period from posted_date
  2. Check period.status === 'OPEN'
  3. If CLOSED or LOCKED: reject with Error: PERIOD_NOT_OPEN
```

### Invariant F-I-5: Multi-Currency Model

```
Every financial transaction MUST carry:
  - transaction_currency (currency of originating event)
  - functional_currency  (tenant base currency, default VND)
  - exchange_rate        (decimal string wrapper ExchangeRate object)

Amount storage:
  - All amounts stored as decimal strings representing the minor unit (cents/đồng)
  - VND: stored in minor unit (đồng) as string, e.g. "1000000"
  - USD: stored in cents as string, e.g. "100" ($1.00)
  
MVP constraint: 
  - functional_currency = VND for all Vietnamese tenants
  - ExchangeRate support is a first-class primitive required from day 1.
```

### Invariant F-I-6: Line-Level Constraints

```sql
-- On finance_transaction_lines:
CHECK (debit_amount >= 0)
CHECK (credit_amount >= 0)
CHECK (NOT (debit_amount > 0 AND credit_amount > 0))  -- a line is debit OR credit, never both
-- debit_amount = 0 means it's a credit line, and vice versa
```

### Invariant F-I-7: F1 ≠ F2 (Accrual vs Cash Distinction)

```
NOT every F1 Ledger transaction is a cash movement.

Example:
  Revenue Recognized → F1 Transaction (REVENUE + RECEIVABLE)
                        This is NOT a cash movement.

  Cash Received       → F1 Transaction (CASH + RECEIVABLE settlement)
                        ONLY THIS triggers F2 CashPosition update.

F2 Cash Engine subscribes to F1 events SELECTIVELY:
  F1 publishes: FinancialTransactionPosted { transaction_type }
  F2 consumes:  only transactions with transaction_type = CASH_MOVEMENT

Design requirement:
  finance_transactions must carry a transaction_type field:
    ACCRUAL | CASH | ADJUSTMENT | REVERSAL | OPENING_BALANCE
```

### Invariant F-I-8: Approval-Before-Post (Decoupled Orchestration)

```
To prevent circular dependency between F1 (Ledger) and F5 (Control), they are decoupled.
Orchestration is managed by a Finance Application Service or Command Handler.

Orchestration sequence:
  1. Financial Command (e.g. PostTransactionCommand) received
  2. Call F5.checkControl() to evaluate limit policies
  3. If control check returns REQUIRES_APPROVAL:
     - Request approval through F5 (which consumes Core Platform State Machine)
     - Return status PENDING_APPROVAL
     - Terminate flow (Ledger Posting is NOT executed yet)
  4. Once F5 approval resolves to APPROVED:
     - Resume orchestration flow
     - Call F1.postTransaction() to record the transaction to Ledger

F1 remains the authoritative source of Ledger entries. F5 manages governance limits and approvals.
F5 consumes the generic Core State Machine for approval state transitions (REQUESTED → PENDING_APPROVAL → APPROVED | REJECTED).
```

### Invariant F-I-9: Event-After-Persistence via Transactional Outbox

```
To guarantee that event publication matches database state, Finance OS implements the Transactional Outbox Pattern:

  1. Start DB Transaction
  2. Perform financial operations (write to F1 Ledger, F2 Cash, F3 AR/AP, etc.)
  3. Update materialized view (finance_financial_state)
  4. Write the domain event details to the `finance_outbox_events` table within the same DB Transaction
  5. Commit DB Transaction
  
After DB COMMIT is successful:
  6. An asynchronous Event Dispatcher picks up records from `finance_outbox_events`
  7. Publishes them to the Core Event Bus
  8. Marks outbox records as dispatched

This eliminates the risk of DB committing while Event Bus publication fails.
NO domain event is sent to the bus before DB commit. NO DB transaction is rolled back after outbox dispatch.
```

### Invariant F-I-10: Financial State Reconstruction

```
finance_financial_state is a derived, materialized state (projection).
It is NOT the primary financial source of truth.

The primary, authoritative sources of truth are:
  - F1 Ledger records (finance_transactions, finance_transaction_lines)
  - F2 Cash records (finance_cash_movements)
  - F3 AR/AP records (finance_receivables, finance_payables, finance_commitments)
  - F4 Budget/Forecast records (finance_budgets, finance_forecast_lines)

In the event of database corruption, data loss, or schema migration:
  - Finance OS MUST be capable of reconstructing the entire historical timeline of `finance_financial_state`
  - Rebuilding is done by replaying F1 Ledger, F2 Cash, F3 AR/AP, and F4 Budget/Forecast entries.
```

---

## VI. F1–F5 ENGINE OWNERSHIP MAP (Frozen)

| Engine | ID | Owns | Publishes | Consumes |
|--------|----|----|------|----|
| **Ledger Engine** | F1 | `finance_accounts`, `finance_transactions`, `finance_transaction_lines`, `finance_accounting_periods`, `finance_audit_trail` | `FinancialTransactionPosted`, `FinancialTransactionVoided`, `FinancialTransactionReversed`, `AccountBalanceUpdated` | (source of truth) |
| **Cash & Treasury Engine** | F2 | `finance_cash_positions`, `finance_bank_accounts`, `finance_cash_movements` | `CashPositionUpdated`, `CashMovementRecorded`, `CashRunwayAlert` | `FinancialTransactionPosted{type=CASH}` |
| **AR/AP & Commitments Engine** | F3 | `finance_receivables`, `finance_payables`, `finance_commitments` | `ReceivableCreated`, `ReceivableSettled`, `PayableCreated`, `PayableSettled`, `CommitmentCreated`, `PayableOverdue` | Calls to F3 public contracts via Finance Bridge |
| **Budget & Forecast Engine** | F4 | `finance_budgets`, `finance_forecast_models`, `finance_forecast_lines` | `BudgetSet`, `BudgetThresholdBreached`, `ForecastUpdated` | `FinancialTransactionPosted` (for Actual) |
| **Financial Control Engine** | F5 | `finance_controls`, `finance_approvals` | `ControlViolationDetected`, `ApprovalRequested`, `ApprovalGranted`, `ApprovalRejected` | Invoked during control orchestration check |

### F4: Budget / Forecast / Actual — Clear Separation

```
Budget:   WHAT WE PLANNED   (set in advance, immutable per period version)
Forecast: WHAT WE NOW EXPECT (updated dynamically as conditions change)
Actual:   WHAT HAPPENED     (derived from F1 Ledger transactions)

Variance = Actual − Budget
Reforecast = New Forecast based on Actual trend

Finance Intelligence (F6+) reads this triangle for diagnostics.
```

---

## VII. FINANCIAL STATE — MATERIALIZED VIEW (Critical for AI)

`finance_financial_state` is the **pre-computed aggregated financial state** per tenant, updated by Finance OS engines as transactions are posted.

```typescript
interface FinancialState {
  id: string;
  tenant_id: string;
  as_of: Date;                   // snapshot timestamp
  
  // Cash (from F2)
  total_cash: Money;
  cash_runway_days: number;      // estimated runway at current burn rate
  
  // AR/AP (from F3)
  total_receivables: Money;
  total_payables: Money;
  net_working_capital: Money;    // receivables - payables
  
  // P&L (from F1, current period)
  total_revenue: Money;
  total_expenses: Money;
  net_income: Money;
  
  // Balance Sheet Aggregates (from F1)
  total_assets: Money;
  total_liabilities: Money;
  net_equity: Money;
  
  // Commitments (from F3)
  total_committed: Money;        // future obligations already locked
  total_forecast_inflow: Money;  // from F4
  total_forecast_outflow: Money; // from F4
}
```

**This is the single structure Finance Intelligence (F6–F11) and Finance AI (F12–F14) read from. They do NOT query finance_transactions or finance_accounts directly.**

```
F1 Ledger Transaction Posted
          ↓
F1 updates finance_financial_state (COMMIT → then publish event)
          ↓
F6 Cash Intelligence reads finance_financial_state
          ↓
F14 AI CFO reads finance_financial_state + Intelligence outputs
```

---

## VIII. VERTICAL → FINANCE CONTRACT BOUNDARY

### The Only Permitted Integration Pattern

```
Vertical Business Event (e.g., ServiceRendered, BookingPaid, PropertySold)
              │
              ▼
Finance Bridge (lives in Product Vertical — src/products/<vertical>/finance/)
              │
              ▼ (calls via Finance OS Public Contracts only)
Finance OS API:
  - F1: postTransaction(request)
  - F2: recordCashMovement(request)
  - F3: createReceivable(request)
  - F3: createPayable(request)
  - F4: updateActual(period, account, amount)
  - F5: checkControl(transaction)
```

### The Finance Bridge (Anti-Corruption Layer)

Mỗi Product Vertical bắt buộc phải triển khai một `Finance Bridge` làm Anti-Corruption Layer (ACL).
- Vertical **không bao giờ** gọi trực tiếp các engine của Finance OS từ core business services.
- Khi một Business Event xảy ra (ví dụ: `ServiceRendered` ở Hospital OS), vertical đẩy event đó sang `Finance Bridge`.
- `Finance Bridge` phân tích event, chuyển đổi domain entities (Patient, Encounter, Doctor) thành các primitives tài chính (Money, PartyId, SourceType, SourceId, Dimensions) và gọi Public Contracts của Finance OS (ví dụ: `F3.createReceivable()`, `F1.postTransaction()`).
- Tách biệt hoàn toàn: Finance OS hoàn toàn không biết semantic của các ngành dọc; và các ngành dọc không biết chi tiết cấu trúc hạch toán ghi sổ của Ledger.

### Forbidden Patterns

```
❌ Product queries finance_transactions directly
❌ Product writes to finance_accounts without F1 contract
❌ Product creates its own "accounting" or "ledger" tables
❌ Finance OS imports anything from src/products/
❌ Finance OS knows about Patient, Property, KTV, Student
```

### Source Traceability Requirement

Every call from a Product Vertical to Finance OS MUST carry:
```typescript
{
  source_type: 'spa.booking_payment',    // vertical.event_type
  source_id: 'booking-uuid-xxx',         // originating record ID
  idempotency_key: 'booking-uuid-xxx:payment:v1' // caller-generated
}
```

This allows Finance OS to answer: *"Which business event created this financial transaction?"*

---

## IX. DATABASE MIGRATION RULES

### Additive Only

```
Finance OS migration MUST:
  ✅ CREATE new finance_* tables
  ✅ CREATE indexes on finance_* tables
  ✅ CREATE RLS policies on finance_* tables
  ✅ ADD columns to finance_* tables (non-breaking)
  
Finance OS migration MUST NOT:
  ❌ ALTER columns in existing accounting_* tables
  ❌ DROP any table
  ❌ Modify column types
  ❌ Remove RLS policies
```

### Required for All Finance Tables

```sql
-- Every finance_* table must have:
tenant_id UUID NOT NULL REFERENCES tenants(id),
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

-- And RLS:
ALTER TABLE finance_* ENABLE ROW LEVEL SECURITY;
-- Policy: WHERE tenant_id = auth.jwt()->>'tenant_id'
```

### DB Invariants (Application + DB Layer)

```sql
-- finance_transaction_lines
CHECK (debit_amount >= 0),
CHECK (credit_amount >= 0),
CHECK (NOT (debit_amount > 0 AND credit_amount > 0)),

-- finance_transactions  
UNIQUE (tenant_id, idempotency_key),  -- prevents duplicate posts

-- Outbox Events
-- finance_outbox_events table stores events transactionally before async dispatch

-- finance_accounting_periods
-- Period status transitions enforced at application layer (F5 State Machine)
```

---

## X. MIGRATION FROM accounting MODULE

```
Phase 1 (NOW): Keep accounting/ as-is, build finance/ alongside.
Phase 2:       Finance OS F1 Ledger implements same postJournalEntry capability.
Phase 3:       Verticals migrate from accounting.service → finance/contracts/ledger-engine.
Phase 4:       After all consumers migrated and verification passed → DEPRECATE accounting/
Phase 5:       Remove accounting/ module after 1 full financial reporting cycle clean.

NEVER: rewrite then switch all-at-once.
```

---

## XI. 9 FINANCE VERIFICATION GATES

Every Finance OS feature must pass all 9 gates:

| Gate | Name | Verifies |
|---|---|---|
| **Gate F-1** | Architecture Compliance | No F6+ created in F1–F5 boundary; no vertical logic in kernel |
| **Gate F-2** | Contract Boundary | Products only call via Finance contracts; no direct finance_* queries |
| **Gate F-3** | Tenant Isolation (P0) | All finance_* tables enforce tenant_id; cross-tenant query blocked |
| **Gate F-4** | Double-Entry Invariant | Σ debit = Σ credit enforced; imbalanced transactions rejected |
| **Gate F-5** | Transaction Immutability | POSTED transactions not updated; reversal pattern tested |
| **Gate F-6** | Idempotency | Duplicate postTransaction() with same key returns same result |
| **Gate F-7** | Period Control | Transactions rejected for CLOSED/LOCKED periods |
| **Gate F-8** | Event-After-Persistence | Domain events only published after DB COMMIT via outbox table |
| **Gate F-9** | Full Finance Kernel Regression | All Finance OS tests GREEN before feature release |
| **Gate F-10** | Financial State Reconstruction | Rebuilds the `finance_financial_state` table from ledger/cash/arap/budget/forecast database records and asserts that it matches the pre-rebuild state. |

---

## XII. TIMELINE REALITY CHECK

```
Phase F0 — Architecture & Constitution    (1–2 weeks)   ← YOU ARE HERE
Phase F1–F5 — Finance Kernel              (6–10 weeks)
Verification + accounting migration        (2–4 weeks)
Phase F6–F11 — Finance Intelligence       (6–10 weeks)
Phase F12–F14 — Finance AI               (4–6 weeks)
Vertical Integration (Spa, Hospital, Land) (4–8 weeks)
                                          ───────────
TOTAL                                     23–40 weeks (~5–8 months)
```

**"Finance OS v0.1 / Architectural MVP"** is achievable in 15 weeks (F1–F5 + 1 vertical).  
**"Production-grade Finance OS"** requires 5–8 months minimum.

---

## XIII. ARCHITECTURAL CONTROL GATE PROMPT

When assigning any Finance OS implementation task, attach this prompt:

```text
You are implementing a Finance OS capability in Bella Platform.

ARCHITECTURAL STATUS:
Finance OS Kernel F1–F5 = [PENDING FREEZE / FROZEN — see status above].

NON-NEGOTIABLE RULES:
1. DO NOT create F6+ engine in F1–F5 boundary.
2. DO NOT modify F1–F5 bounded-context responsibilities once frozen.
3. DO NOT directly query finance_* tables from Product Vertical layer.
4. USE CONTRACTS ONLY (Product → Finance Contract → Finance OS Engine).
5. Finance OS knows NO vertical entities (Patient, KTV, Property, Student).
6. All transactions must carry: idempotency_key, source_type, source_id.
7. All transactions must carry: transaction_currency, functional_currency, exchange_rate.
8. Transactions MUST NOT be posted to CLOSED or LOCKED periods.
9. POSTED transactions are IMMUTABLE — use Reversal + Correction pattern.
10. Σ debit = Σ credit on every posted transaction (no exceptions).
11. NOT (debit > 0 AND credit > 0) on any single transaction line.
12. Cash movement ≠ Ledger transaction (F2 consumes selectively from F1 events).
13. F5 Approval uses Core State Machine (no custom workflow engine in Finance OS).
14. Event-After-Persistence: DB COMMIT → DOMAIN EVENT (never before).
15. All finance_* tables: tenant_id NOT NULL, RLS enabled.
16. Database migrations: ADDITIVE ONLY (CREATE, ADD INDEX — no ALTER/DROP on existing).
17. Never duplicate: FinancialAccount, FinancialTransaction, Money in Product layer.
18. finance_financial_state is the source for Intelligence and AI layers.
19. Intelligence (F6–F11) and AI (F12–F14) layers are NOT frozen — they can evolve.
20. Report ARCHITECTURAL GAP DETECTED instead of silently modifying Kernel.

BEFORE CODING, PROVIDE:
A. Product Manifest (Capabilities & Scope)
B. Ownership Map (WHO OWNS THIS DATA?)
C. Contract Dependency Map (Product → Finance Contract → Engine)
D. Additive Migration Plan (CREATE new tables / indexes only)
E. 9 Finance Verification Gates test plan

DO NOT CODE UNTIL THIS ANALYSIS IS COMPLETE.
```

---

*Finance OS Constitution v1.0*  
*Prepared: 2026-08-15*  
*Status: PENDING ARCHITECTURE GATE APPROVAL*  
*Author: Architecture Review — Bella Platform*  
*Next step: Human Architect approves → F1–F5 Kernel Freeze → Phase F1 implementation begins*
