# Finance OS Integration Audit & F5 Reconciliation Roadmap

This document is the **F5 Reconciliation & Financial Control — Constitution v1.2-Final**.
It is the pre-freeze canonical document. Upon passing all 8 verification gates (§6), this document transitions to **F5.0 FROZEN** status and becomes immutable.

---

## 1. Post-Freeze Integration Audit (F1 to F4)

Having locked F1, F2, F3, and F4, we audit the boundary clean-room properties of the consolidated Finance OS ecosystem:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FINANCE OS BOUNDARY                           │
├───────────────────┬───────────────────┬───────────────────┬─────────────┤
│ Module            │ Primary Target    │ Inbound Path      │ Outbound    │
├───────────────────┼───────────────────┼───────────────────┼─────────────┤
│ F1 GL             │ Accounting Truth  │ Direct RPC        │ Outbox event│
│ F2 Cash           │ Cash projection   │ F1 posted event   │ Read API    │
│ F3 AR             │ Receivables       │ Direct RPC        │ Read API    │
│ F4 AP             │ Payables          │ Direct RPC        │ Read API    │
└───────────────────┴───────────────────┴───────────────────┴─────────────┘
```

### Audit Checklist Status

1. **Contract Registry Integrity:**
   * ✅ **F1** exposes validation contracts (`finance_validate_account_code`, `finance_validate_account_id`, `finance_validate_period_for_date`).
   * ✅ **F2** exposes safe read contracts (`finance_get_cash_movement`).
   * ✅ **F3** and **F4** encapsulate internal tables behind versioned service RPCs.
2. **Lock Registry Enforcement:**
   * ✅ Centralized key hashing logic is in `finance_financial_lock_key`.
   * ✅ Collision boundaries are tested: `CASH_MOVEMENT` uses the legacy F3-compatible logic to prevent deadlocks, while `VENDOR` and `VENDOR_BILL` namespaces are prefix-isolated.
3. **Boundary Leaks Audit:**
   * ✅ **Zero direct cross-module table writes** exist. AR never writes to F2 cash tables; AP never writes to F1 ledger tables.
   * ✅ **Zero duplicated finance helpers** exist. The lock generator is shared, and COA validation is hosted strictly within F1.
   * ✅ **Application layer encapsulation**: All financial state machines reside inside the DB Kernel (via SECURITY DEFINER RPCs), leaving the application layer with zero financial mutation responsibilities.

---

## 2. End-to-End Business Flow Scenarios

### Scenario A: Standard Procurement-to-Payment Lifecycle (Multi-Currency)
```
[Vendor Bill] ➔ [Period/COA Validation] ➔ [F1 GL Accrual] ➔ [F4 AP Fact]
    ➔ [F2 Cash Movement] ➔ [Currency/FX Validation] ➔ [F1 Disbursement]
    ➔ [F4 Allocation] ➔ [Position Projection] ➔ [Derived Status]
```
1. **Validation & Accrual:** Vendor Bill verifies fiscal period is OPEN and expense account is active. Accrual creates a `PAYABLE_ACCRUAL` fact in F4 and posts F1 GL entries (Debit Expense / Credit AP Control 331).
2. **Payment FX Validation:** During disbursement, F4 validates exchange rates and whitelisted provenance if currencies differ.
3. **Allocation:** F1 posts disbursement journal entries, F4 appends `DISBURSEMENT_ALLOCATION`, position cache decreases.
4. **Status Derivation:** Dynamic status view derives `PAID` when outstanding balance reaches zero.

### Scenario B: Payment Reversal Flow
```
[Paid Bill] ➔ [Reverse Payment (F4)] ➔ [F1 Reversing Entry] ➔ [Allocation Reversal] ➔ [Outstanding Restored]
```

### Scenario C: Vendor Prepayment & Application Flow
```
[Prepayment Cash (F2)] ➔ [Record Prepayment (F4)] ➔ [Apply Prepayment (F4)] ➔ [F1 Application Posting]
```

---

## 3. Operational Hardening & Fault Injection Targets

* **Position Cache Reconstruction Stress Test:** Corrupt `finance_payable_positions` → execute `finance_rebuild_payable_position` → assert rebuilt position = mathematical sum of immutable facts.
* **Idempotency Collision Test:** Concurrent retries with identical `posting_attempt_id` → assert exactly one transaction ID, zero duplicate lines.

---

## 4. F5 Constitution: Reconciliation & Financial Control — v1.2-Final

F5 is the **Independent Financial Control Plane** of the entire Finance OS — not a ledger, not a reporting layer, but an independent supervisory system.

```
                    FINANCE OS
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
       F1               F2             F3/F4
     Ledger            Cash          Subledgers
        │                │                │
        └────────────────┼────────────────┘
                         │
              Approved Read Contracts
            (as_of + tenant_id + version)
                         │
                         ▼
               ┌──────────────────┐
               │  F5 KERNEL       │  DB Kernel, f5_* namespace only
               └────────┬─────────┘
                        │
       ┌────────────────┼────────────────┐
       ↓                ↓                ↓
 Traceability    Reconstruction      Matching
       │                │                │
       └────────────────┼────────────────┘
                        ↓
                Variance Engine
                        │
            ┌───────────┴──────────────┐
            ↓                          ↓
     Financial Result          Projection Health
      MATCHED                    CACHE_SYNCED
      VARIANCE ──────────┐       CACHE_DRIFT
      QUARANTINED ───────┤
                         ↓
               Case & Resolution Engine
                         │
                         ↓
              External Correction Workflow
                         │
                         ↓
              New Reconciliation Run
                         │
                         ↓
                      MATCHED
```

---

### 4.1 Constitutional Laws (P0 — Immutable)

> [!IMPORTANT]
> **Law 1 — Control Constraint:**
> *F5 is strictly a verification and control plane. It is **never** permitted to automatically mutate or modify F1/F2/F3/F4 authoritative financial records.*
> F5 **detects** · **classifies** · **records** · **alerts** · **audits** — F5 does **NOT** correct.

> [!IMPORTANT]
> **Law 2 — DB Kernel Law:**
> F5 logical engines are implemented as DB Kernel components with versioned RPC/service contracts — not independent microservices. F5 reads F1–F4 **exclusively** via approved read contracts. F5 writes exclusively to **`f5_*` namespace tables**.

> [!IMPORTANT]
> **Law 3 — Namespace Boundary Law:**
> F5 **may mutate ONLY** tables under the `f5_*` namespace.
> F5 **must NOT mutate** any F1/F2/F3/F4 authoritative table, regardless of schema naming, ownership metadata, or any other designation.
> All F5-owned tables **must** use the `f5_*` namespace. This boundary is machine-checkable.

---

### 4.2 F5 Source of Truth Matrix

| Domain | Source of Truth | Control Target | Projection / Cache |
|---|---|---|---|
| **GL** | F1 Journal Lines | — | F1 Financial Reporting |
| **Cash** | F2 Cash immutable facts | F1 Bank Control Account | F2 Cash Position Cache |
| **AR** | F3 AR immutable facts | F1 AR Control Account | F3 AR Position Cache |
| **AP** | F4 AP immutable facts | F1 AP Control Account | F4 AP Position Cache |
| **Prepayment** | F4 Prepayment immutable facts | F1 Prepayment Asset Account | F4 Prepayment Balance Cache |
| **Reconciliation** | F5 Control results & cases | — | F5 Operations Dashboard |

> [!IMPORTANT]
> **Reconstruction Authority:** F5 always reconstructs positions from **immutable facts**, never from projection caches.

---

### 4.3 Effective-Date Basis per Domain (F5-T-1)

> [!IMPORTANT]
> **Constitutional Amendment F5-T-1 (P0):**
> Every financial domain **must** expose an explicit effective-date basis through its approved read contract. F5 **must not** infer, substitute, or derive effective dates independently. If a domain's read contract does not expose a declared effective-date field, F5 **must reject** that contract as non-compliant.

| Domain | Effective Date Field | Declared in Contract |
|---|---|---|
| **F1 GL** | `posting_date` | `finance_journal_entries_as_of(as_of, tenant_id)` |
| **F2 Cash** | `cash_effective_date` | `finance_get_cash_movement(as_of, tenant_id)` |
| **F3 AR** | `posting_date` (declared AR effect date) | `finance_ar_facts_as_of(as_of, tenant_id)` |
| **F4 AP** | `posting_date` (declared AP effect date) | `finance_ap_facts_as_of(as_of, tenant_id)` |
| **F4 Prepayment** | `posting_date` (declared effect date) | `finance_ap_facts_as_of(as_of, tenant_id)` |

**Filtering rule:**
```
event.{domain_effective_date_field} > reconciliation_as_of  →  excluded from this run
event.{domain_effective_date_field} ≤ reconciliation_as_of  →  included in this run
```

F5 applies this filter via the domain's approved read contract. F5 never bypasses this by applying a different date field or deriving a substitute.

---

### 4.4 Journal-Set Semantics (1 : 1 : N)

```
Source Operation
      │
      │  1 : 1
      ▼
F1 Transaction / Journal Set  (single transaction_id / journal_set_id)
      │
      │  1 : N
      ▼
Journal Lines  (Dr AP Control / Dr-Cr FX Gain-Loss / Cr Bank / ...)
```

> [!IMPORTANT]
> F5 asserts "exactly one journal **set**" per source operation — never "exactly one journal line". A single AP disbursement legitimately produces multiple journal lines all belonging to the same journal set.

---

### 4.5 Identity Model: Two Distinct Concepts

#### A. Canonical Financial Effect Identity
Identifies **what** is being reconciled. Derived from the originating financial operation. Immutable once the operation is committed.

```
canonical_financial_effect_identity = (
    tenant_id,
    domain,                 -- AR | AP | CASH | PREPAYMENT
    source_type,            -- VENDOR_BILL | INVOICE | CASH_MOVEMENT | ...
    source_id,              -- UUID of the originating record
    financial_effect_type,  -- PAYABLE_ACCRUAL | DISBURSEMENT_ALLOCATION | ...
    posting_attempt_id      -- idempotency key from originating operation
)
```

This identity is the **uniqueness key for F5-I-5 (Financial Effect Idempotency)**. At most one authoritative financial effect may exist per tuple.

#### B. Reconciliation Run Identity
Identifies **which** reconciliation check was executed. Tracks the specific run for audit history.

```
reconciliation_run_identity = (
    tenant_id,
    control_type,             -- AP_GL_BALANCE | TRACEABILITY | FX_INTEGRITY | ...
    basis_id,                 -- UUID of reconciliation basis definition (immutable)
    basis_version,            -- semantic version: "AP_GL_BALANCE:v1", "AP_GL_BALANCE:v2"
    reconciliation_as_of,     -- as-of temporal boundary (TIMESTAMPTZ)
    source_snapshot_hash      -- deterministic SHA-256 of canonical source state
)
```

> [!IMPORTANT]
> **basis_id + basis_version (F5-Final-3):** The reconciliation basis must carry an immutable versioned identifier. The same financial state checked against `AP_GL_BALANCE:v1` vs `AP_GL_BALANCE:v2` may produce different results due to rule changes. Every reconciliation result must be able to answer: *"Which rule version was applied?"* `basis_id` is immutable; `basis_version` is the human-readable semantic version.

> [!IMPORTANT]
> A single financial effect may be checked across **many reconciliation runs** over its lifetime. A single run checks **many** financial effects. This is a many-to-many relationship — never conflate the two identities.

---

### 4.6 Deterministic source_snapshot_hash Definition

The `source_snapshot_hash` in the Reconciliation Run Identity must be computed via deterministic canonical serialization. It must not hash arbitrary JSONB in implementation-dependent field ordering.

**Constitutional definition:**
```
source_snapshot_hash = SHA-256(
    canonical_serialize(
        tenant_id,
        control_type,
        basis_id,
        basis_version,
        reconciliation_as_of,        -- temporal boundary
        source_identities[],         -- ordered ascending by (source_type, source_id)
        relevant_financial_values[], -- ordered by canonical_financial_effect_identity
        relevant_metadata            -- domain-contract-defined fields only
    )
)
```

**Canonical serialization rules:**
* All collections sorted by deterministic key (ascending UUID or enum value).
* All NUMERIC values serialized with fixed precision (scale defined per domain contract).
* All TIMESTAMPTZ values serialized as ISO-8601 UTC.
* All NULL values represented as empty string `""` in serialization (not omitted).
* Field ordering within each record is defined by the domain contract, not by implementation.

> [!IMPORTANT]
> If the canonical serialization algorithm changes, the basis_version must be incremented. Two runs using different hash algorithms must have different `basis_version` values and are not directly comparable.

---

### 4.7 Temporal / As-of Reconciliation Semantics (P0)

F5 defines an explicit temporal boundary for every reconciliation run:

```
reconciliation_as_of = <TIMESTAMPTZ>  -- e.g. 2026-08-16T00:00:00Z
```

All source data reads (F1, F2, F3, F4) must be evaluated at this boundary using the domain's declared effective-date field (per F5-T-1).

**Problem this solves:**
```
10:00:00  F4 = 100 VND,  F1 = 100 VND  → steady state
10:00:05  F4 = 120 VND   (new fact created; F1 not yet posted)
10:00:10  F1 = 120 VND   (journal posted)

Without as-of boundary:
  Read F4 at 10:00:06 → F4 = 120 / Read F1 at 10:00:09 → F1 = 120 → FALSE MATCH
  OR: Read F4 at 10:00:04 → F4 = 100 / Read F1 at 10:00:11 → F1 = 120 → FALSE VARIANCE

With reconciliation_as_of = 10:00:00:
  Both domains filter to events with effective_date ≤ 10:00:00
  F4 = 100, F1 = 100 → MATCHED (correct and stable)
```

> [!IMPORTANT]
> All F1–F4 read contracts consumed by F5 **must** accept and enforce an `as_of TIMESTAMPTZ` parameter and use the domain's declared effective-date field (F5-T-1). F5 **must** reject any read contract that does not expose these parameters. This is a P0 prerequisite for F5.1 Reconciliation Kernel implementation.

---

### 4.8 Domain Model: Control Result Classification

Two **separate, non-overlapping namespaces** — separate schemas, separate tables, separate state machines, separate alert routes:

```
Control Result
├── Financial Result              (Variance Engine output)
│   ├── MATCHED    ← result only, never an operational case
│   ├── VARIANCE   ← operational case created
│   └── QUARANTINED ← operational case created
│
└── Projection Health             (Cache Health Check output)
    ├── CACHE_SYNCED ← health record only
    └── CACHE_DRIFT  ← health record created; never escalated to VARIANCE
```

> [!IMPORTANT]
> **MATCHED is a control result, not an operational case.** MATCHED records are stored in `f5_control_results` for audit completeness, but no `f5_control_case` is created. Case management overhead (assignment, investigation, resolution) applies only to VARIANCE and QUARANTINED.

---

### 4.9 Position Cache Two-Tier Control

```
F4 Immutable Facts (as_of T)
       │
       │  Reconstruct (never from cache)
       ▼
Reconstructed Position
       │
       ├─── Control A: Financial GL Control ──────────────────────────────┐
       │    Reconstructed Position ↔ F1 Control Account (as_of T)         │
       │    → Financial Result: MATCHED | VARIANCE | QUARANTINED          │
       │                                                                   │
       └─── Control B: Projection Health ──────────────────────────────── ┘
            Reconstructed Position ↔ F4 Position Cache
            → Projection Health: CACHE_SYNCED | CACHE_DRIFT
```

| Facts | Cache | GL | Financial Result | Projection Health |
|---|---|---|---|---|
| 100 | 100 | 100 | MATCHED | CACHE_SYNCED |
| 100 | 100 | 95 | VARIANCE | CACHE_SYNCED |
| 100 | 95 | 100 | MATCHED | CACHE_DRIFT |
| 100 | 95 | 95 | VARIANCE | CACHE_DRIFT |

---

### 4.10 F5 Invariants (F5-I-1 to F5-I-10)

#### F5-I-1: Source-to-Ledger Traceability (P0)
Every authoritative AR/AP/Prepayment immutable fact must resolve to exactly one valid F1 journal set. **No orphan subledger fact is permitted.**
* **Direction:** F3/F4 Financial Fact → F1 Journal Set
* **as_of scoped:** Only facts with `domain_effective_date ≤ reconciliation_as_of` are checked.

#### F5-I-2: Cash Projection Drift Control (P1)
F2 reconstructed cash balance (from F2 immutable facts at `reconciliation_as_of`) must reconcile to F1 Bank Control Accounts.

#### F5-I-3: Movement Deletion Prohibition & Integrity Breach Detection (P0)
Financially referenced F2 cash movements are immutable at the source (F2 mutation guard). When an integrity anomaly is detected, **F5 places the reconciliation case into `QUARANTINED` state** in `f5_control_cases`. F5 does not touch the F2 record.
* **F2 responsibility:** Deletion prevention (DB layer enforcement).
* **F5 responsibility:** Quarantine case recording (F5-owned tables only).

#### F5-I-4: Subledger Control Separability (P0)
Each subledger reconciles independently from immutable facts at `reconciliation_as_of`:
* **F5-I-4A:** F3 AR facts → Reconstructed AR position ↔ F1 AR control balance.
* **F5-I-4B:** F4 AP facts → Reconstructed AP position ↔ F1 AP control balance.
* **F5-I-4C:** F4 Prepayment facts → Prepayment asset balance ↔ F1 Prepayment asset account.

#### F5-I-5: Financial Effect Idempotency (P0)
For any given Canonical Financial Effect Identity, **at most one authoritative financial effect** may exist across the subledger-ledger boundary, regardless of how many requests (retries, concurrent calls, network replays) were submitted.

> [!IMPORTANT]
> **Enforcement/Detection Boundary:**
> * **Enforcement** of this invariant belongs to the **originating F1–F4 financial mutation contracts** (idempotency keys, unique constraints, SECURITY DEFINER RPC guards).
> * **Detection** of violations belongs to **F5**. F5 detects when multiple authoritative effects exist for the same identity and classifies the case as `QUARANTINED`.
> * F5 does **not** enforce, prevent, or correct duplicate effects — it detects and records.
> This is consistent with the F5 Constitutional Law: F5 detects; F5 does NOT correct.

#### F5-I-6: Ledger-to-Source Traceability (P0)
Every F1 journal set classified as AR/AP/Prepayment must resolve back to exactly one authorized source financial operation. **No orphan GL posting is permitted.**
* **Direction:** F1 Journal Set → Source Operation
* Every F1 journal set must carry `source_module` + `source_type` + `source_id` within the correct tenant and domain.

> [!NOTE]
> F5-I-1 (Fact→GL) and F5-I-6 (GL→Fact) are **directionally independent**. Both must pass for bidirectional traceability to be complete.

#### F5-I-7: Period & Posting Date Integrity (P0)
No F1/F2/F3/F4 event may be effectively posted into a `CLOSED` or `LOCKED` period outside of controlled adjustment workflows. Each domain defines an explicit posting-date basis consumed by the F1 period contract.

#### F5-I-8: Tenant Integrity (P0)
All reconciliation results and cases must be strictly scoped to `tenant_id`. Cross-tenant aggregation is prohibited in all F5 operational contexts.

#### F5-I-9: Reconciliation Idempotency & Deterministic Basis (P0)
Given the same Reconciliation Run Identity (including `basis_version` and `source_snapshot_hash`) and the same `reconciliation_as_of`, every reconciliation run must produce an identical control result. This must hold independent of execution time, wall-clock timezone, or worker identity.

#### F5-I-10: Currency & FX Determinism (P0)
F5 verifies the complete FX chain:
```
Source Currency × approved_rate(effective_date, rate_type)
    = Functional Currency amounts in F1 Journal Lines
```
F5 verifies: rate provenance, rate effective date, rate type, rounding policy, realized vs. unrealized FX classification, and cross-currency Dr/Cr amounts.

---

### 4.11 Sharpened Variance Classification Semantics

#### MATCHED — Control Result, Not Operational Case
Both subledger fact and F1 journal set are structurally trusted and financially consistent at `reconciliation_as_of`.
→ Written to `f5_control_results` only. No `f5_control_case` created.

#### VARIANCE — Operational Case Created
Both sides are **structurally trusted**; financial values/mappings/currencies are inconsistent.
```
F4 AP reconstructed = 100,000,000 VND
F1 AP Control       =  95,000,000 VND
Both trusted. Variance is quantifiable.
→ VARIANCE → f5_control_case created
```
* **State Machine:** `OPEN → INVESTIGATING → RESOLVED`

#### QUARANTINED — Operational Case Created (Integrity Emergency)
Source integrity **cannot be trusted** — safe financial calculation is impossible.
```
F4 allocation → F2 movement_id XYZ → NOT FOUND
Cannot safely compute variance amount.
→ QUARANTINED → f5_control_case created
```
* **State Machine:** `QUARANTINED → INVESTIGATING → RESOLVED`

> [!IMPORTANT]
> `VARIANCE` = trusted data, inconsistent financial result — safe to analyze.
> `QUARANTINED` = untrusted data, reconciliation cannot safely conclude — integrity emergency.

---

### 4.12 Severity Constitutional Principles

Severity is multi-dimensional. It is **never** determined by financial amount alone.

| Dimension | LOW Example | CRITICAL Example |
|---|---|---|
| Financial impact | 10,000 VND rounding diff | 500,000,000 VND unreconciled |
| Integrity impact | Minor cache drift | Cross-tenant reference detected |
| Scope | Single transaction | Period-wide balance failure |
| Recoverability | Self-correcting (timing) | Requires manual ledger correction |
| Regulatory significance | Internal only | Affects statutory reporting period |

> [!NOTE]
> A 10,000 VND cross-tenant reference may be `CRITICAL`. A 100,000,000 VND temporary timing difference may be `MEDIUM`. The specific scoring algorithm is deferred to **F5.3 implementation**. The principle — severity is multi-dimensional and amount is only one factor — is constitutionally locked here.

---

### 4.13 Resolution Authority Model

F5 tracks the complete lifecycle of a control case through four distinct roles:

```
Case Created (auto)
  detected_at     TIMESTAMPTZ   -- when detected
  detected_by     TEXT          -- system/RPC identity
       │
       ▼ OPEN → INVESTIGATING
  assigned_to          UUID     -- human reviewer
  investigated_by      UUID
  investigation_started_at  TIMESTAMPTZ
       │
       ▼ INVESTIGATING → RESOLVED
  resolved_by          UUID     -- resolver (human)
  authorized_by        UUID     -- authorizer (may differ from resolver)
  resolution_reference TEXT     -- external corrective workflow ID
  resolved_at          TIMESTAMPTZ
```

> [!IMPORTANT]
> **Constitutional Law: RESOLVED ≠ MATCHED**
>
> `RESOLVED` means: *"An authorized explanation or corrective workflow has been documented."*
> It does **NOT** mean the financial state is now correct.
>
> The only confirmation of financial correctness is a **new reconciliation run**:
> ```
> F5 Case → RESOLVED
>      ↓
> External corrective workflow executes on F1–F4 (if warranted)
>      ↓
> New Reconciliation Run (new run_id, new reconciliation_as_of)
>      ↓
> Financial Result → MATCHED  ← only now is financial state confirmed correct
> ```
> F5 never short-circuits this chain.

---

## 5. F5 Architecture & Implementation Roadmap

### 5.1 F5 Five-Engine Logical Architecture (DB Kernel)

The five engines are **logical separations** in the DB Kernel — not independent microservices.

```
Control API  (read-only consumer)
      │
      ▼
F5 Reconciliation Kernel (SECURITY DEFINER RPCs, f5_* namespace)
      │
      ├─ Traceability Engine      F5-I-1 + F5-I-6 (bidirectional, as-of scoped)
      ├─ Reconstruction Engine    F5-I-4 + Cache Health (facts → rebuilt position)
      ├─ Matching Engine          F5-I-2 + F5-I-10 (amount + currency + FX chain)
      ├─ Variance Engine          MATCHED / VARIANCE / QUARANTINED classification
      └─ Case & Resolution Engine case lifecycle + resolution authority + audit trail
```

F5 reads F1–F4 **exclusively** via approved read contracts, each exposing three mandatory fields:

| Mandatory Field | Purpose |
|---|---|
| `as_of TIMESTAMPTZ` | Temporal boundary for fact filtering (F5-T-1) |
| `tenant_id UUID` | Tenant scope isolation (F5-I-8) |
| `contract_version TEXT` | Versioned contract consumption (audit trail) |

F5 **must reject** any read contract missing any of the three mandatory fields.

---

### 5.2 Schema: Two Separate Tables

#### Table 1: f5_control_results
Stores every financial control result, including MATCHED. Audit log of all reconciliation outcomes.

```sql
CREATE TABLE f5_control_results (
    result_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID         NOT NULL,

    -- Reconciliation Run Identity
    run_id                     UUID         NOT NULL,
    control_type               TEXT         NOT NULL,
    -- Registry: AR_GL_BALANCE | AP_GL_BALANCE | PREPAYMENT_GL_BALANCE
    --           CASH_GL_BALANCE | AR_TRACEABILITY | AP_TRACEABILITY
    --           FX_INTEGRITY | PERIOD_INTEGRITY | TENANT_INTEGRITY
    --           DUPLICATE_EFFECT
    basis_id                   UUID         NOT NULL,
    basis_version              TEXT         NOT NULL,   -- e.g. "AP_GL_BALANCE:v1"
    reconciliation_as_of       TIMESTAMPTZ  NOT NULL,
    source_snapshot_hash       TEXT         NOT NULL,   -- SHA-256 canonical hash (§4.6)

    -- Canonical Financial Effect Identity (typed, not JSONB-only)
    source_module              TEXT         NOT NULL,   -- F3 | F4 | F2
    source_type                TEXT         NOT NULL,   -- VENDOR_BILL | INVOICE | ...
    source_id                  UUID         NOT NULL,
    source_fact_id             UUID,
    source_version             BIGINT,
    financial_effect_type      TEXT         NOT NULL,
    posting_attempt_id         TEXT         NOT NULL,

    -- Unique: one result per canonical identity per run
    UNIQUE (tenant_id, run_id, source_module, source_type, source_id,
            financial_effect_type, posting_attempt_id),

    -- Financial amounts
    expected_amount            NUMERIC(20,4),
    actual_amount              NUMERIC(20,4),
    variance_amount            NUMERIC(20,4)
        GENERATED ALWAYS AS (actual_amount - expected_amount) STORED,
    source_currency            CHAR(3),
    functional_currency        CHAR(3),
    fx_rate                    NUMERIC(20,6),

    -- Source context (snapshot only — not canonical identity)
    source_snapshot            JSONB,

    -- Financial Result
    financial_result           TEXT         NOT NULL
        CHECK (financial_result IN ('MATCHED', 'VARIANCE', 'QUARANTINED')),

    -- Severity
    severity                   TEXT         NOT NULL
        CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),

    detected_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    detected_by                TEXT         NOT NULL,   -- system/RPC identity

    -- FK to case (NULL for MATCHED — no case created)
    case_id                    UUID         REFERENCES f5_control_cases(case_id) NULL
);
```

#### Table 2: f5_control_cases
Created only for VARIANCE and QUARANTINED results. Manages operational resolution lifecycle.

```sql
CREATE TABLE f5_control_cases (
    case_id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID         NOT NULL,

    -- Link to originating result
    result_id                  UUID         NOT NULL REFERENCES f5_control_results(result_id),
    case_state                 TEXT         NOT NULL DEFAULT 'OPEN'
        CHECK (case_state IN ('OPEN', 'INVESTIGATING', 'RESOLVED')),
    -- QUARANTINED results enter case with case_state = 'OPEN' but
    -- are tagged via financial_result on the linked result record

    -- Detection (from result)
    detected_at                TIMESTAMPTZ  NOT NULL,
    detected_by                TEXT         NOT NULL,

    -- Investigation
    assigned_to                UUID,
    investigated_by            UUID,
    investigation_started_at   TIMESTAMPTZ,

    -- Resolution
    resolved_by                UUID,
    authorized_by              UUID,                    -- may differ from resolved_by
    resolution_reference       TEXT,                    -- external corrective workflow ID
    resolved_at                TIMESTAMPTZ,

    -- Enforcement: cannot resolve without full authority
    CONSTRAINT resolution_requires_authority CHECK (
        case_state <> 'RESOLVED' OR (
            resolution_reference IS NOT NULL AND
            authorized_by IS NOT NULL AND
            resolved_at IS NOT NULL
        )
    )
);
```

#### Table 3: f5_projection_health
Separate from financial control results. Records cache drift, not financial variance.

```sql
CREATE TABLE f5_projection_health (
    health_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                  UUID         NOT NULL,
    domain                     TEXT         NOT NULL,   -- AR | AP | CASH | PREPAYMENT
    run_id                     UUID         NOT NULL,
    reconciliation_as_of       TIMESTAMPTZ  NOT NULL,
    fact_derived_amount        NUMERIC(20,4) NOT NULL,
    cache_amount               NUMERIC(20,4) NOT NULL,
    drift_amount               NUMERIC(20,4)
        GENERATED ALWAYS AS (cache_amount - fact_derived_amount) STORED,
    projection_result          TEXT         NOT NULL
        CHECK (projection_result IN ('CACHE_SYNCED', 'CACHE_DRIFT')),
    detected_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

### 5.3 Implementation Order Law

> [!IMPORTANT]
> ```
> Constitution Freeze (F5.0)
>       ↓
> Canonical Identities (Financial Effect + Run + basis_version)
>       ↓
> Approved Read Contracts with as_of + tenant_id + contract_version
>       ↓
> Effective-Date Basis per Domain (F5-T-1 compliance)
>       ↓
> Deterministic Reconstruction Engine (facts only, no cache reads)
>       ↓
> Traceability Engine (F5-I-1 + F5-I-6, as-of scoped)
>       ↓
> Matching Engine (incl. full FX chain F5-I-10)
>       ↓
> Variance Classification Engine → f5_control_results
>       ↓
> Case & Resolution Engine → f5_control_cases (VARIANCE + QUARANTINED only)
>       ↓
> Scheduler / Continuous Control
>       ↓
> Dashboard (read-only consumer — zero financial logic)
> ```
>
> Dashboard is built **last**. It is a consumer only.

---

### 5.4 Implementation Phases (F5.0 → F5.4)

#### Phase F5.0 — Constitution Freeze
Lock all semantic foundations. No coding until all 8 gates pass.

#### Phase F5.1 — Reconciliation Kernel
Fact-based, as-of-scoped reconstruction for all domains. Separate financial results from cache health. Verify F5-T-1 compliance of all read contracts before consuming.

#### Phase F5.2 — Traceability & Integrity Engine
Bidirectional traceability (F5-I-1 + F5-I-6). Full FX chain validation (F5-I-10). Orphan detection (fact without GL, GL without fact). as-of scoped for all checks.

#### Phase F5.3 — Variance & Quarantine Engine
Three-state Financial Result classification → `f5_control_results`. Case creation for VARIANCE + QUARANTINED → `f5_control_cases`. Multi-dimensional severity scoring engine. Full resolution lifecycle enforcement.

#### Phase F5.4 — Continuous Control
Scheduled reconciliation triggers. Severity-based alert routing by `control_type`. Resolution workflow notifications. Dashboard (read-only consumer, zero financial logic).

---

## 6. F5 Pre-Freeze Verification Gates (F5-G1 to F5-G8)

Before F5.0 is permitted to freeze, **all eight gates** must pass:

#### F5-G1: Namespace Boundary Gate (P0)
Verify F5 **mutates only `f5_*` namespace tables**. Static analysis of all F5 migration files must confirm:
* Zero `INSERT` / `UPDATE` / `DELETE` against any table not in the `f5_*` namespace.
* Zero `ALTER` / `DROP` against any `finance_*` table.
* All F5-owned tables carry the `f5_` prefix without exception.
* This gate is machine-checkable via SQL catalog inspection.

#### F5-G2: Determinism Gate (P0)
Same source state + same Reconciliation Run Identity + same `reconciliation_as_of`:
```
Run #1 → result_id R-001 (VARIANCE, 5,000,000 VND, control_type=AP_GL_BALANCE, basis=AP_GL_BALANCE:v1)
Run #2 → result_id R-001 (same — idempotent, no duplicate)
Run #N → result_id R-001 (same — idempotent)

NOT ALLOWED: R-001, R-002, R-003 for identical source state and run identity
```

#### F5-G3: Bidirectional Trace Gate (P0)
* **Forward (F5-I-1):** Every F3/F4 fact resolves to a valid F1 journal set — no orphan subledger facts.
* **Backward (F5-I-6):** Every F1 AR/AP/Prepayment journal set resolves to a valid source operation — no orphan GL postings.
Both directions tested independently at a fixed `reconciliation_as_of`.

#### F5-G4: Reconstruction Gate (P0)
Delete or corrupt all projection caches:
```
F4 Immutable Facts (as_of T) → Reconstruct → Rebuilt Position
Assertion: Rebuilt Position = exact mathematical sum of immutable facts (no cache read)
```
Cache corruption must not affect the Financial Result.

#### F5-G5: Integrity Breach Gate (P0)

| Injected Failure | Expected Classification |
|---|---|
| Missing referenced cash movement (F4 allocation → F2 not found) | `QUARANTINED` |
| **Multiple authoritative financial effects** for same Canonical Identity | `QUARANTINED` (F5-I-5 violation detected) |
| Duplicate *requests*, idempotency resolved to single effect | `MATCHED` (correct — not QUARANTINED) |
| Cross-tenant source reference | `QUARANTINED` |
| Wrong currency in FX chain | `VARIANCE` (F5-I-10 violation in result record) |
| Posting into CLOSED period | F5-I-7 violation recorded |
| Orphan GL journal (no source fact) | Detected by F5-I-6 |
| Orphan subledger fact (no GL mirror) | Detected by F5-I-1 |
| Cache drift, no GL drift | `CACHE_DRIFT` only — zero `VARIANCE` created |
| MATCHED result | Written to `f5_control_results` — zero `f5_control_case` created |

#### F5-G6: Idempotency Gate (P0)
Concurrent N identical reconciliation requests for the same Reconciliation Run Identity must produce:
```
1 result record in f5_control_results (no duplicates)
≤ 1 case record in f5_control_cases (only if VARIANCE or QUARANTINED)
0 duplicate result_id / case_id
0 duplicate variance computations
```

#### F5-G7: Read Boundary Gate (P0)
Verify F5 reads F1–F4 **exclusively via approved read contracts**. Static analysis must confirm:
* Zero direct `SELECT FROM` against internal `finance_*` tables in F5 RPC bodies.
* All F1–F4 read contracts expose the **three mandatory fields**: `as_of TIMESTAMPTZ`, `tenant_id UUID`, `contract_version TEXT`.
* F5 rejects (raises error) if called with a contract missing any mandatory field.
* Zero duplication of COA validation, period validation, FX helper, or lock logic (must use F1–F4 contracts).
* All read contracts used are versioned and match the `contract_version` recorded in the reconciliation run.

#### F5-G8: Temporal Determinism Gate (P0)
Directly verifies F5-I-9. Execute the same reconciliation with the same `reconciliation_as_of` and `source_snapshot_hash`, varying only:
* Worker identity
* System wall-clock timezone (UTC, UTC+7, UTC-5)
* Execution start time (before or after new facts arrive outside `as_of` boundary)

All runs must produce:
```
Same financial_result classification
Same result_id (idempotent)
Same variance_amount
Same control_type
Same basis_version applied
```
Zero false variances caused by read ordering, timezone, or aggregation order differences.

---

## 7. F5.0 Freeze Conditions

F5.0 may be declared **FROZEN** when and only when:

1. ☐ All 8 gates (F5-G1 through F5-G8) pass with zero failures.
2. ☐ All domain read contracts expose `as_of`, `tenant_id`, `contract_version` (F5-T-1 compliance).
3. ☐ `f5_control_results`, `f5_control_cases`, `f5_projection_health` schemas are finalized.
4. ☐ `basis_version` registry is initialized with v1 entries for all `control_type` values.
5. ☐ Constitution document is signed off and committed to `docs/architecture/frozen/F5_FREEZE.md`.

Once frozen, this Constitution may not be amended without a full Finance OS Architecture Review and a new constitution version (`v2.0`).
