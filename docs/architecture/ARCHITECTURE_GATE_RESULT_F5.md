# ARCHITECTURE GATE RESULT — F5 RECONCILIATION & FINANCIAL CONTROL

> **Status:** 🔒 APPROVED FOR IMPLEMENTATION
> **Phase:** F5 Pre-Coding Gate — Approved by Architecture Proof
> **Date:** 2026-08-16
> **Author:** Architecture Review — Bella Finance OS
> **Prerequisite F0:** Finance OS Inheritance Constitution — FROZEN ✅
> **Prerequisite F1:** F1 Ledger Engine — FROZEN ✅
> **Prerequisite F2:** F2 Cash & Treasury Engine — FROZEN ✅
> **Prerequisite F3:** F3 Accounts Receivable — FROZEN ✅
> **Prerequisite F4:** F4 Accounts Payable — FROZEN ✅
> **Constitution:** F5 Reconciliation & Financial Control Constitution v1.2-Final — FROZEN ✅
> **Constraint:** Observer-only. F5 reads F1–F4 via frozen public contracts. F5 writes to `f5_*` namespace ONLY. F5 does NOT mutate source records.

---

## 0. EXECUTIVE SUMMARY

F5 Reconciliation & Financial Control is the **fifth and final kernel** of Finance OS. Its purpose is to act as the **Independent Financial Control Plane**: it reconstructs the expected financial position from immutable subledger facts, compares against the F1 General Ledger, classifies discrepancies, raises alerts, and records audit evidence — without ever modifying the source of truth it is checking.

**F5 is not a ledger. F5 is not a reporting layer. F5 is not a corrective engine.**

```
F5 Position in Finance OS:

  F1 Ledger (System of Record — records the truth)
       ▲
       │ reads via frozen contract
  F5 Control Plane (proves the truth)
       │
       ├─ f5_control_results   → immutable run evidence
       ├─ f5_control_cases     → variance investigations
       └─ f5_projection_health → cache health tracking
```

**The single most important invariant for F5:**

> **Observation ≠ Mutation. Classification ≠ Correction. Evidence ≠ Ledger.**

F5 may only reach `MATCHED` state by triggering a new reconciliation run after the underlying source data in F1–F4 has been corrected through their own authorized workflows — never by patching F5 results directly.

---

## I. PRODUCT MANIFEST — F5 Capabilities & Scope

### What F5 OWNS

| Capability | Description |
|---|---|
| **AP_GL_BALANCE Control** | Reconstruct AP outstanding from `f4_ap_facts` → compare vs F1 GL account 331 balance. ✅ IMPLEMENTED (F5.1–F5.3) |
| **AR_GL_BALANCE Control** | Reconstruct AR outstanding from `finance_receivable_ledger` → compare vs F1 GL account 131 balance. ✅ IMPLEMENTED / VERIFIED (F5.5) |
| **CASH_GL_BALANCE Control** | Reconstruct cash position through `F2_CASH:v1`, `F2_OPENING:v1`, and `F2_BANK_ACCOUNT_GL_MAP:v1` → compare vs F1 GL cash account balances. ✅ IMPLEMENTED / VERIFIED (F5.6 Cash) |
| **PREPAYMENT_GL_BALANCE Control** | GL mapping now tenant-configured via `F4_PREPAYMENT_GL_MAP:v1`; position contract and runner remain gated. 🟡 PARTIAL / NOT IMPLEMENTED |
| **FX Determinism Control** | Verify functional-currency translation chain without mutating ledger evidence. ❌ F5.7 |
| **Control Cases & Investigation** | Lifecycle management for VARIANCE/QUARANTINED cases (OPEN → UNDER_REVIEW → RESOLVED). ✅ IMPLEMENTED |
| **Projection Cache Health** | Control B: subledger cache vs reconstructed position. CACHE_DRIFT never escalated to VARIANCE. ✅ IMPLEMENTED |
| **Continuous Control Scheduler** | pg_cron / worker trigger loops for automated reconciliation runs in production. ❌ F5.8 |
| **Immutability Guard** | `f5_control_results` is write-once via trigger. No DELETE/UPDATE by any role. ✅ IMPLEMENTED |

### What F5 Does NOT Own

| Out of Scope | Owner | F5 Constraint |
|---|---|---|
| Journal entries | F1 Ledger | F5 reads via `finance_journal_entries_as_of` — ZERO write access |
| Cash movements / positions | F2 Cash Engine | F5 reads via `finance_get_cash_movements_as_of` — ZERO write access |
| Invoices / AR positions | F3 AR Engine | F5 reads via `finance_ar_facts_as_of` — ZERO write access |
| Vendor bills / AP positions | F4 AP Engine | F5 reads via `finance_ap_facts_as_of` — ZERO write access |
| Ledger corrections / reversals | F1 (via authorized workflow) | F5 raises a case; correction must go through F1 |
| Exchange rate table | Finance OS Treasury (future) | F5 reads rates as input — does not own rate storage |

---

## II. OWNERSHIP MAP — WHO OWNS THIS DATA?

```
┌────────────────────────────────────────────────────────────────────┐
│              F5 RECONCILIATION & FINANCIAL CONTROL ENGINE          │
│                                                                    │
│  OWNS (exclusive write authority):                                 │
│    f5_control_results     → Immutable reconciliation run evidence  │
│    f5_control_cases       → Variance investigation & resolution    │
│    f5_projection_health   → Subledger cache drift tracking         │
│                                                                    │
│  READS (via frozen public contracts — temporal as-of scoped):      │
│    finance_journal_entries_as_of  → F1 (GL control account lines)  │
│    finance_get_cash_movements_as_of → F2 (cash movement facts)     │
│    finance_ar_facts_as_of         → F3 (AR subledger facts)        │
│    finance_ap_facts_as_of         → F4 (AP subledger facts)        │
│                                                                    │
│  CALLS (DB-layer read RPCs only — zero write grants on F1–F4):     │
│    f5_reconstruct_ap_position()   → Subledger position rebuild     │
│    f5_run_reconciliation()        → Run engine, classify, persist  │
│    f5_admin_cleanup_test_data()   → Test-only teardown RPC         │
│                                                                    │
│  DOES NOT TOUCH (prohibited — write access BLOCKED):               │
│    finance_journal_entries        → F1 owned                       │
│    finance_transactions           → F1 owned                       │
│    finance_cash_movements         → F2 owned                       │
│    finance_cash_positions         → F2 owned                       │
│    finance_receivable_ledger      → F3 owned                       │
│    finance_receivable_positions   → F3 owned                       │
│    finance_ap_ledger_facts        → F4 owned                       │
│    finance_ap_positions           → F4 owned                       │
└────────────────────────────────────────────────────────────────────┘

Tenant Isolation: ALL f5_* tables must have tenant_id NOT NULL + RLS.
Cross-domain write: BLOCKED — F5 has zero INSERT/UPDATE/DELETE grants on F1–F4 tables.
```

---

## III. CONTRACT DEPENDENCY MAP

```
F5 Control: AP_GL_BALANCE (IMPLEMENTED ✅)
──────────────────────────────────────────────────────────────────
f5_run_reconciliation(AP_GL_BALANCE, vendor_bill_id, as_of)
    ├─ finance_ap_facts_as_of(tenant_id, vendor_bill_id, as_of)   → F4 read contract
    ├─ finance_journal_entries_as_of(tenant_id, source_id, as_of) → F1 read contract
    ├─ classify → MATCHED | VARIANCE | QUARANTINED
    └─ INSERT f5_control_results (immutable)
         └─ if VARIANCE/QUARANTINED → INSERT f5_control_cases (OPEN/CRITICAL)

F5 Control: AR_GL_BALANCE (IMPLEMENTED / VERIFIED — F5.5)
──────────────────────────────────────────────────────────────────
f5_run_reconciliation(AR_GL_BALANCE, invoice_id, as_of)
    ├─ finance_ar_facts_as_of(tenant_id, invoice_id, as_of)       → F3 read contract
    ├─ finance_journal_entries_as_of(tenant_id, source_id, as_of) → F1 read contract
    ├─ classify → MATCHED | VARIANCE | QUARANTINED
    └─ INSERT f5_control_results

F5 Control: CASH_GL_BALANCE (IMPLEMENTED / VERIFIED — F5.6 Cash)
──────────────────────────────────────────────────────────────────
f5_run_reconciliation(CASH_GL_BALANCE, account_id, as_of)
    ├─ finance_get_cash_movements_as_of(tenant_id, as_of)             → F2_CASH:v1 read contract
    ├─ finance_cash_opening_balance_as_of(tenant_id, bank_account_id, as_of) → F2_OPENING:v1 read contract
    ├─ finance_bank_account_gl_map(tenant_id, bank_account_id)         → F2_BANK_ACCOUNT_GL_MAP:v1 read contract
    ├─ finance_journal_entries_as_of(tenant_id, source_id, as_of)     → F1 read contract
    ├─ classify → MATCHED | VARIANCE | QUARANTINED
    └─ INSERT f5_control_results

F5 Control: FX_DETERMINISM (PLANNED — F5.7)
──────────────────────────────────────────────────────────────────
Reads: finance_journal_entries_as_of (functional + transaction currency lines)
Checks: functional_amount = transaction_amount * exchange_rate (tolerance ≤ 1 minor unit)
Writes: f5_control_results (FX_VALID | FX_BREACH)
```

---

## IV. ADDITIVE MIGRATION PLAN

F5 is **additive-only**. All migrations are `CREATE` statements against `f5_*` tables.
No existing F1–F4 table is modified. No existing index or constraint is changed.

### Already Deployed (F5.1–F5.3)

| Object | Type | Status |
|---|---|---|
| `f5_control_results` | TABLE | ✅ DEPLOYED |
| `f5_control_cases` | TABLE | ✅ DEPLOYED |
| `f5_projection_health` | TABLE | ✅ DEPLOYED |
| `f5_control_results` immutability trigger | TRIGGER | ✅ DEPLOYED |
| RLS policies on all f5_* tables | POLICY | ✅ DEPLOYED |
| `f5_reconstruct_ap_position()` | FUNCTION | ✅ DEPLOYED |
| `f5_run_reconciliation()` (AP_GL_BALANCE) | FUNCTION | ✅ DEPLOYED |
| `f5_admin_cleanup_test_data()` | FUNCTION (test-only) | ✅ DEPLOYED |
| `finance_journal_entries_as_of()` | FUNCTION (F1 ext.) | ✅ DEPLOYED |
| `finance_ap_facts_as_of()` | FUNCTION (F4 ext.) | ✅ DEPLOYED |

### Planned Migrations (F5.4–F5.8)

| Object | Type | Phase |
|---|---|---|
| `finance_ar_facts_as_of()` | FUNCTION (F3 ext.) | F5.5 |
| `f5_reconstruct_ar_position()` | FUNCTION | F5.5 |
| `f5_run_reconciliation()` (AR_GL_BALANCE overload) | FUNCTION | F5.5 |
| `finance_get_cash_movements_as_of()` | FUNCTION (F2 ext.) | F5.6 Cash — ✅ VERIFIED |
| `finance_cash_opening_balance_as_of()` | FUNCTION (F2 ext.) | F5.6 Cash — ✅ VERIFIED |
| `finance_bank_account_gl_map()` | FUNCTION (F2 ext.) | F5.6 Cash — ✅ VERIFIED |
| `f5_run_reconciliation()` (CASH_GL_BALANCE overload) | FUNCTION | F5.6 Cash — ✅ VERIFIED |
| `finance_get_prepayment_gl_map_as_of()` | FUNCTION (F4 ext.) | F5.6 Prepayment map — ✅ VERIFIED |
| `f5_run_reconciliation()` (PREPAYMENT_GL_BALANCE overload) | FUNCTION | F5.6 Prepayment runner — 🟡 GATED |
| `f5_run_fx_determinism_check()` | FUNCTION | F5.7 |
| `f5_schedule_continuous_runs()` (pg_cron config) | CRON JOB | F5.8 |

---

## V. 8 VERIFICATION GATES — F5 IMPLEMENTATION

Drawn directly from F5.0 Constitution v1.2-Final. All gates must pass before F5 is declared FROZEN.

| Gate | Name | Description | Status |
|---|---|---|---|
| **F5-G1** | Namespace Boundary | All F5 writes go only to `f5_*` tables. Zero writes to F1–F4 tables. | ✅ PASS (F5.1–F5.3) |
| **F5-G2** | Determinism | Same input snapshot → same classification. No non-deterministic side effects. | ✅ PASS (F5.1–F5.3) |
| **F5-G3** | Bidirectional Trace | Every result row traceable to: run identity + source facts + GL lines. | ✅ PASS (F5.1–F5.3) |
| **F5-G4** | Reconstruction | Position reconstructed from immutable facts. Cache rebuild is idempotent. | ✅ PASS (F5.1–F5.3) |
| **F5-G5** | Integrity Breach | Orphan records (in GL but not in subledger, or vice versa) → QUARANTINED. | ✅ PASS (F5.1–F5.3) |
| **F5-G6** | Idempotency | Re-running same run identity → returns existing result, zero duplicate inserts. | ✅ PASS (F5.1–F5.3) |
| **F5-G7** | Read Boundary | All F1–F4 reads use only the frozen temporal contract. Zero direct table SELECT. | ✅ PASS (F5.1–F5.3) |
| **F5-G8** | Temporal Determinism | All reads bounded by `reconciliation_as_of`. No timezone drift, no out-of-order reads. | ✅ PASS (F5.1–F5.3) |

> All 8 gates verified for AP_GL_BALANCE domain.
> Gates must be re-verified for each new control domain (AR, Cash, Prepayment, FX) added in F5.5–F5.7.

---

## VI. IMPLEMENTATION PHASE SUMMARY

| Phase | Scope | Gate | Status |
|---|---|---|---|
| **F5.0** | Constitution design & freeze | Constitution frozen | ✅ COMPLETE |
| **F5.1** | DB schema, RLS, AP position reconstruction | G1, G4, G7, G8 | ✅ COMPLETE |
| **F5.2** | AP_GL_BALANCE run engine, bidirectional trace | G2, G3 | ✅ COMPLETE |
| **F5.3** | Variance engine, immutability, idempotency hardening | G5, G6 | ✅ COMPLETE |
| **F5.4** | Run identity hardening, fault injection, full AP coverage | All G1–G8 re-verify | ❌ NEXT |
| **F5.5** | AR_GL_BALANCE control domain | All G1–G8 for AR | ✅ VERIFIED |
| **F5.6-A** | CASH_GL_BALANCE control domain | Cash gates + regression boundary | ✅ COMPLETE / VERIFIED / PUSHED |
| **F5.6-B1** | F4_PREPAYMENT_GL_MAP:v1 | Tenant-configured effective-dated control mapping + overlap guard | ✅ VERIFIED |
| **F5.6-B2** | PREPAYMENT_GL_BALANCE control domain | Position contract + runner implementation | 🟡 BLOCKED / NOT IMPLEMENTED |
| **F5.7** | FX Determinism control | FX-specific checks | ❌ PLANNED |
| **F5.8** | Continuous Control scheduler (pg_cron / worker) | Ops readiness | ❌ PLANNED |

