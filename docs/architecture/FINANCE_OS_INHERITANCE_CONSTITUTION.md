# FINANCE OS — CORE INHERITANCE & ARCHITECTURE INTEGRATION CONSTITUTION

**Document ID:** FINANCE-CONSTITUTION-001  
**Status:** 🔒 LOCKED — APPROVED FOR ENFORCEMENT  
**Approved:** 2026-08-15  
**Scope:** All Finance OS phases (F1 through F∞)  
**Authority:** This document supersedes any ad-hoc Finance architecture decision.

---

## PREAMBLE

Finance OS is a **domain authority**, not a platform authority.

Bella Core is the **platform authority**. Finance OS exists within Bella's meta-platform and must inherit its foundations — it does not build a parallel platform.

> **Finance OS only owns what is uniquely Finance domain. Everything else belongs to Bella Core.**

Violation of this constitution is a **P0 architectural defect** and blocks all Finance phases.

---

## 1. CANONICAL ARCHITECTURE HIERARCHY

```
                    BELLA PLATFORM
                         │
              ┌──────────▼──────────┐
              │    BELLA CORE       │
              │                     │
              │ Identity            │
              │ Tenant              │
              │ Authorization       │
              │ RLS Framework       │
              │ Event Bus           │
              │ Outbox              │
              │ Contracts           │
              │ Audit               │
              │ Observability       │
              │ API / Infrastructure│
              │ Shared Primitives   │
              └──────────┬──────────┘
                         │
                 INHERIT / EXTEND
                         │
              ┌──────────▼──────────┐
              │     FINANCE OS      │
              │                     │
              │ Finance Constitution│
              │ Finance Contracts   │
              │ Finance Events      │
              │ Finance Policies    │
              │ Finance Engines     │
              └──────────┬──────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
         F1             F2            F3+
       Ledger      Cash/Treasury     AR/AP...
                         │
                         ▼
               FINANCE PRODUCTS
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    Healthcare       Education         Beauty
       OS               OS               OS
```

**Bella Core = Platform authority.**  
**Finance OS = Domain authority over Finance.**  
**F1/F2/F3... = Finance Kernels/Engines, owned by Finance OS.**  
**Product OS = Consumers of Finance via public contracts.**

---

## 2. THE SUPREME INVARIANT

```
Finance OS MUST inherit Bella Core architecture.
Finance OS MUST NOT create parallel platform primitives.
```

This is non-negotiable. Any Finance component that duplicates a Bella Core capability is an architectural violation.

---

## 3. OWNERSHIP BOUNDARY

### 3.1 Bella Core Owns

| Capability | Owner | Finance Action |
|---|---|---|
| Tenant | Bella Core | INHERIT — no re-creation |
| User / Identity | Bella Core | INHERIT — no re-creation |
| Authentication | Bella Core | INHERIT — no re-creation |
| Authorization | Bella Core | INHERIT — define Finance permissions only |
| RLS Framework | Bella Core | INHERIT — define Finance policies only |
| Event Infrastructure | Bella Core | INHERIT — define Finance event semantics only |
| Outbox Infrastructure | Bella Core | INHERIT — register Finance event contracts only |
| API Infrastructure | Bella Core | INHERIT — no custom gateway |
| Audit Infrastructure | Bella Core | INHERIT — no custom audit engine |
| Observability | Bella Core | INHERIT — no custom metrics platform |
| Logging | Bella Core | INHERIT — use Core logger |
| Error Framework | Bella Core | INHERIT — define Finance error codes only |
| Job Execution | Bella Core | INHERIT — register Finance workers only |
| Security Primitives | Bella Core | INHERIT — no custom security primitives |
| Feature Flags | Bella Core | INHERIT — register Finance flags only |
| Configuration | Bella Core | INHERIT — use Core config service |
| File/Storage | Bella Core | INHERIT — no custom storage layer |
| Notification | Bella Core | INHERIT — trigger via Core |

### 3.2 Finance OS Owns

| Capability | Owner | Notes |
|---|---|---|
| Finance Constitution | Finance OS | This document |
| Chart of Accounts semantics | F1 | Double-entry rules, account hierarchy |
| Double-entry Ledger | F1 | Core financial truth |
| Journal/Transaction semantics | F1 | Posting, reversals, void |
| Cash Position | F2 | Derived from F1 events |
| Cash Movements | F2 | Immutable fact log |
| Bank Account Registry | F2 | Finance domain asset |
| Treasury Logic | F2/F3 | Per established boundary |
| AR/AP | F3 | Future phase |
| Budget | F4 | Future phase |
| Financial Controls | F5 | Future phase |
| Finance Analytics | Finance OS | Finance-scoped only |
| Finance Event Schemas | Finance OS | Versioned, public contracts |
| Finance Permission Definitions | Finance OS | Consumed by Core Authorization |

---

## 4. TENANT ARCHITECTURE

Finance OS **does not own Tenant**.

### Canonical Flow

```
Bella Core Tenant Context
          ↓
Finance OS (inherits tenant boundary)
          ↓
F1 / F2 / F3
          ↓
Finance tables (tenant_id on every row)
```

### Invariants

- Every Finance table MUST carry `tenant_id`.
- Tenant context MUST be derived from Bella Core's security context (JWT claim → `get_auth_tenant_id()`).
- Finance MUST NOT implement a separate tenant resolution mechanism.
- No Finance operation may escape the Core tenant boundary.

### What Finance defines

Finance defines resource ownership and Finance-specific access rules within the existing tenant boundary — not the boundary mechanism itself.

```
Core owns:     Tenant A ≠ Tenant B  (isolation mechanism)
Finance owns:  Tenant A Finance ≠ Tenant B Finance  (resource policy)
```

---

## 5. RLS INHERITANCE

Finance OS inherits Bella Core's canonical RLS pattern.

### Standard Finance RLS Policy Template

```sql
-- Finance tables MUST use this pattern (inherited from Bella Core)
CREATE POLICY "Tenant isolation for <table>" ON public.<table>
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
```

Finance may add **additional** Finance-specific policies (e.g., read-only for auditors, projection-worker-only for cash tables), but the base tenant isolation policy uses the Core primitive `get_auth_tenant_id()`.

**Prohibited:** Finance-owned tenant resolution functions.  
**Required:** `public.get_auth_tenant_id()` as the canonical isolation primitive.

---

## 6. AUTHORIZATION ARCHITECTURE

Finance does not build its own authorization framework.

### Canonical Chain

```
Bella Identity
      ↓
Bella Authorization (Core owns mechanism)
      ↓
Finance Permission Check (Finance defines what permissions exist)
      ↓
Finance Capability Execution
```

### Finance Permission Namespace

Finance defines permissions in the format: `finance.<domain>.<action>`

| Permission | Scope |
|---|---|
| `finance.ledger.read` | Read F1 transactions/accounts |
| `finance.ledger.post` | Post F1 transactions |
| `finance.ledger.reverse` | Reverse F1 transactions |
| `finance.cash.read` | Read cash positions/movements |
| `finance.cash.reconcile` | Trigger cash reconciliation |
| `finance.budget.manage` | Create/edit budgets |
| `finance.period.close` | Close accounting periods |
| `finance.report.view` | View Finance reports |

Finance **defines** these permissions. Core **enforces** them.

---

## 7. EVENT ARCHITECTURE

Finance OS uses Bella's Event Bus. Finance does not create a Finance Event Bus.

### Canonical Flow

```
Bella Core Event Infrastructure (Core owns delivery)
             ↓
      Finance Event Registry (Finance owns schema/semantics)
             ↓
     Finance Domain Events (versioned, public)
             ↓
       F1 / F2 / F3 consumers
```

### Finance Event Naming Convention

```
finance.<domain>.<verb>.<version>

Examples:
  finance.transaction.posted.v2
  finance.transaction.reversed.v1
  finance.cash.position.changed.v1
  finance.payment.received.v1
  finance.period.closed.v1
```

### Key Distinction

| Concern | Owner |
|---|---|
| Event delivery infrastructure | Bella Core |
| Event retry/reliability | Bella Core (Outbox) |
| Event schema/semantics | Finance OS |
| Event versioning | Finance OS |
| Event consumer registration | Finance OS |

---

## 8. OUTBOX ARCHITECTURE

Finance OS uses Bella Core's transactional outbox infrastructure.

> **Finance defines what happened; Bella Core defines how the event is reliably delivered.**

Finance registers event contracts into the Bella Event Contract Registry. Finance does not operate a separate `finance_outbox` as an independent delivery mechanism.

**Current state of `finance_outbox_events`:**  
This table was created before this constitution was established. It is a transitional artefact. As Core Outbox matures, Finance events must be migrated to the canonical Core Outbox mechanism.

**ADR Required:** Before F2.2 (Projection Worker), an ADR must document the migration path from `finance_outbox_events` to Core Outbox, or ratify the current implementation as a compliant extension.

---

## 9. DATABASE ARCHITECTURE

### Finance tables are Finance-owned internal implementation details

Finance OS may own Finance-scoped tables:

```
finance_transactions          (F1)
finance_accounts              (F1)
finance_accounting_periods    (F1)
finance_transaction_lines     (F1)
finance_outbox_events         (F1 transitional)
finance_bank_accounts         (F2)
finance_cash_movements        (F2)
finance_cash_positions        (F2)
finance_cash_quarantine       (F2)
finance_tenant_configs        (F2)
...
```

### All Finance tables MUST inherit Bella Core database standards

| Standard | Bella Core Pattern | Finance Must Follow |
|---|---|---|
| Tenant isolation | `tenant_id` + RLS | ✅ Mandatory |
| Migration governance | Additive-only, timestamped | ✅ Mandatory |
| RLS framework | `get_auth_tenant_id()` | ✅ Mandatory |
| Audit columns | `created_at`, `updated_at` | ✅ Mandatory |
| Naming conventions | `snake_case`, prefixed by domain | ✅ Mandatory |
| ID convention | `UUID DEFAULT gen_random_uuid()` | ✅ Mandatory |
| Timestamp convention | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | ✅ Mandatory |
| Indexing standards | Tenant-scoped composite indexes | ✅ Mandatory |
| Security model | RLS + service_role grants | ✅ Mandatory |

---

## 10. CROSS-OS DATABASE ACCESS — ABSOLUTELY PROHIBITED

No Product OS may query Finance internal tables directly.

### Prohibited

```sql
-- Healthcare OS doing this is a P0 violation:
SELECT * FROM finance_cash_movements WHERE tenant_id = ...

-- Education OS doing this is a P0 violation:
SELECT * FROM finance_transactions WHERE ...

-- Beauty OS doing this is a P0 violation:
INSERT INTO finance_cash_positions ...
```

### Required: OS-to-OS via Contracts/Events

```
Healthcare OS
      ↓
Finance Public Contract API  (versioned, stable)
      ↓
Finance OS Internal Logic
      ↓
Finance Database
```

Or via events:

```
Healthcare Domain Event
      ↓
Finance Event Consumer
      ↓
F1/F2 Internal Projection
```

### The Law

> **OS-to-OS interaction MUST occur through public versioned contracts or domain events.**
> **Never through internal database tables.**

---

## 11. FINANCE OS PUBLIC CONTRACT BOUNDARY

All Finance capabilities exposed to Product OS must go through a public Finance Contract.

### Canonical API Boundary

```
Product / Product OS
      ↓
Finance Public Contract (versioned, typed, stable)
      ↓
Finance Engine (F1 / F2 / F3)
      ↓
Finance Database (internal)
```

### Finance Contract Categories

| Contract | Consumers | Stability |
|---|---|---|
| `ILedgerContract` | All OS, all products | FROZEN when published |
| `ICashContract` | Treasury, Product payments | Versioned |
| `IPaymentReceivedContract` | Beauty, Healthcare, Education | Versioned |
| `IBudgetContract` | HQ, Operations | Versioned |
| `IFinancialReportContract` | Analytics, Dashboards | Versioned |

---

## 12. DOMAIN PURITY — WHAT FINANCE MUST NOT CONTAIN

Finance OS does not understand Product business logic.

### Prohibited in Finance OS

```
PatientBillingCalculationLogic
StudentTuitionDiscountLogic
SpaBookingRevenueDistributionLogic
HospitalInsuranceClaimLogic
AutoDealerTradeInFinancingLogic
```

### Finance only understands

```
Transaction
Account
Amount
Currency
Cash Position
Cash Movement
Receivable
Payable
Budget
Period
Control
```

Finance receives a **Finance Contract** (amount, currency, account codes, reference). Finance does not know why that transaction happened in business terms.

---

## 13. SHARED KERNEL BOUNDARY

Finance OS may use Bella's Shared Kernel primitives:

| Shared Kernel Primitive | Finance May Use |
|---|---|
| `Tenant` | ✅ Yes |
| `Identity/User` | ✅ Yes (read-only reference) |
| `Money` | ✅ Yes |
| `Currency` | ✅ Yes |
| `Result<T, E>` | ✅ Yes |
| `DomainEvent<T>` | ✅ Yes |
| `AggregateRoot` | ✅ Yes |
| `AuditContext` | ✅ Yes |

Finance-specific concepts must remain in Finance:

| Finance-specific Concept | Must Stay In |
|---|---|
| `Ledger` | F1 |
| `Journal` | F1 |
| `CashMovement` | F2 |
| `BankAccount` | F2 |
| `CashRunway` | F2/F3 |
| `AccountsReceivable` | F3 |
| `Budget` | F4 |

---

## 14. PRODUCT VERTICAL INTEGRATION PATTERNS

### Pattern A — Event-Driven (Preferred)

```
Product OS emits domain event
      ↓
Finance event consumer processes it
      ↓
Finance creates Contract → F1 → F2
```

### Pattern B — Direct Contract Call

```
Product OS calls Finance Contract API
      ↓
Finance validates and executes
      ↓
F1 POSTED → F2 Projected
```

### Product-Specific Examples

**Healthcare OS:**
```
Patient encounter completed
      ↓ (domain event)
Finance: encounter.billing.due.v1
      ↓
Finance Contract: IPaymentDue
      ↓ F1 creates receivable entry
      ↓ F2 tracks expected cash position
```

**Education OS:**
```
Student enrollment confirmed
      ↓ (domain event)
Finance: enrollment.tuition.due.v1
      ↓
Finance Contract: IInvoiceCreated
      ↓ F1 creates receivable + revenue
```

**Beauty OS:**
```
Booking payment received
      ↓ (domain event)
Finance: payment.received.v1
      ↓
Finance Contract: IPaymentReceived
      ↓ F1 posts cash + revenue
      ↓ F2 updates cash position
```

---

## 15. ARCHITECTURE COMPLIANCE GATE — MANDATORY BEFORE EACH FINANCE PHASE

Before any Finance phase (F2.1, F2.2, F3.x...) begins, the following 10 gates must be verified:

| Gate | Check | Required Result |
|---|---|---|
| **Gate A** — Core Inheritance | Does this phase use Core primitives where they exist? | ✅ YES |
| **Gate B** — No Duplication | Does this phase create any capability that duplicates Core? | ❌ NO |
| **Gate C** — Tenant Isolation | Does every new table carry `tenant_id` + Core RLS? | ✅ YES |
| **Gate D** — Authorization | Does access control go through Core Authorization? | ✅ YES |
| **Gate E** — Eventing | Does Finance use Core Event Bus/Outbox for delivery? | ✅ YES |
| **Gate F** — Contract Boundary | Do all external callers use Finance Public Contracts? | ✅ YES |
| **Gate G** — Database Boundary | Is there zero direct cross-OS DB access? | ✅ ZERO |
| **Gate H** — Security | Does Finance inherit (not bypass) Core security model? | ✅ YES |
| **Gate I** — Observability | Does Finance use Core observability primitives? | ✅ YES |
| **Gate J** — Migration | Are all DB changes strictly additive under Core standards? | ✅ YES |

A `BLOCKED` on any gate stops the phase. The blocking item must be resolved via ADR or architectural remediation.

---

## 16. BELLA OS INHERITANCE LAW

This law applies to all Bella OS domains — not just Finance.

Every OS built on Bella Platform MUST:

| Law | Requirement |
|---|---|
| **Law 1: Inherit Core** | Do not build a parallel platform. Use Core. |
| **Law 2: Own only your domain** | Do not capture capabilities belonging to Core or another OS. |
| **Law 3: Consume via Contracts** | Access other OS capabilities through public versioned contracts only. |
| **Law 4: Use Core Infrastructure** | Do not duplicate infrastructure (event bus, outbox, auth, audit...). |
| **Law 5: Preserve Tenant Isolation** | All data must respect Core tenant boundary. No escape. |
| **Law 6: Preserve Event Contracts** | Published event schemas are versioned and backward-compatible. |
| **Law 7: Preserve Database Boundaries** | No cross-OS direct database coupling. |
| **Law 8: Be Additive** | Do not break frozen kernels or other OS components. |
| **Law 9: Be Independently Evolvable** | Evolve without breaking Core or sibling OS. |
| **Law 10: Be Replaceable at Product Layer** | Product logic may change without touching Kernels/Core. |

---

## 17. IMPLEMENTATION PHASES REVISED (POST-CONSTITUTION)

### Corrected Phase Sequence

```
F0   — Finance OS Core Inheritance Audit          ← NEW (this constitution satisfies F0.1–F0.5)
  F0.1  Audit Bella Core architecture
  F0.2  Map Core → Finance inheritance boundaries
  F0.3  Define ownership table
  F0.4  Define shared infrastructure contracts
  F0.5  Define OS-to-OS contract boundary
  F0.6  Define Finance-specific extensions
  F0.7  Compliance gate verification
  F0.8  Finance OS Inheritance Freeze                ← THIS DOCUMENT = F0 Freeze

F1   — Ledger Engine                               ← 🔒 FROZEN (22/22 PASS)
  F1 Verification Complete
  F1 Freeze executed

F2   — Cash & Treasury Engine
  F2 Architecture Gate                             ← 🔒 APPROVED
  F2.1  Database / RLS                             ← IN PROGRESS
  F2.2  Projection Worker (F1 Event → F2)
  F2.3  Cash Reporting API
  F2 Verification
  F2 Freeze

F3   — AR/AP / Payment Engine                      ← Future
F4   — Budget Engine                               ← Future
F5   — Financial Controls                          ← Future
```

---

## 18. F2.1 COMPLIANCE REVIEW UNDER THIS CONSTITUTION

F2.1 (current) is reviewed against the 10 Compliance Gates:

| Gate | F2.1 Status | Notes |
|---|---|---|
| A — Core Inheritance | ✅ PASS | Uses `get_auth_tenant_id()`, Core RLS pattern |
| B — No Duplication | ✅ PASS | No parallel infrastructure created |
| C — Tenant Isolation | ✅ PASS | `tenant_id` on all tables, composite FKs |
| D — Authorization | ✅ PASS | `service_role` / `authenticated` via Core grant model |
| E — Eventing | ⚠️ REVIEW | `finance_outbox_events` is transitional — ADR required for F2.2 |
| F — Contract Boundary | ✅ PASS | External callers blocked at DB + RPC level |
| G — Database Boundary | ✅ PASS | Cross-OS access prohibited by design |
| H — Security | ✅ PASS | `SECURITY DEFINER` + `SET LOCAL` mutation gate |
| I — Observability | ⚠️ REVIEW | Not yet explicitly instrumented — required before F2.3 |
| J — Migration | ✅ PASS | Additive-only, ADR-021 documented |

**F2.1 Verdict under Constitution: ✅ CLEAR TO PROCEED**  
Gate E and I must be resolved as ADRs before F2.2 and F2.3 respectively.

---

## 19. OPEN ITEMS (ADRs Required)

| ID | Item | Required Before | Owner |
|---|---|---|---|
| ADR-022 | Outbox: Ratify or migrate `finance_outbox_events` to Core Outbox | F2.2 | Finance + Core |
| ADR-023 | Observability: Define Finance OS instrumentation standard using Core observability | F2.3 | Finance + Core |
| ADR-024 | Authorization: Formal mapping of Finance permissions into Core Authorization service | F3 | Finance + Core |
| ADR-025 | OS-to-OS Contract: Define `IPaymentReceived` v1 contract for Beauty → Finance | F2.3 | Finance + Beauty |

---

## 20. SIGNOFF

| Role | Status |
|---|---|
| Human Architect | ✅ APPROVED 2026-08-15 |
| Finance OS Constitution | 🔒 LOCKED |
| Enforcement Scope | All Finance phases: F0 through F∞ |

---

*This document is the source of truth for Finance OS architectural inheritance.*  
*Modifications require Human Architect approval and a superseding ADR.*  
*All Finance phases must reference this document in their Architecture Gate analysis.*
