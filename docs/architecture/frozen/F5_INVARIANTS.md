# F5 RECONCILIATION & FINANCIAL CONTROL — ARCHITECTURAL INVARIANTS

> **Freeze Status: 🔒 F5.0 CONSTITUTION FROZEN**
> This document is the authoritative invariants ledger for the F5 Reconciliation & Control Plane.
> Every invariant listed here must be enforced by the Reconciliation Kernel and verified by automated gates.
> Any modification to these invariants requires a full Architecture Review Board review and a new major version of the Constitution.

---

## Invariant Classification

* **P0** — Critical structural or financial integrity rule. Must never be violated. Violations cause immediate `QUARANTINED` status or transaction abort.
* **P1** — Operational control rule. Violations cause `VARIANCE` status and alert propagation.
* **P2** — Health/Performance rule. Violations raise system health alerts.

---

## F5 Invariants Ledger

### F5-I-1: Source-to-Ledger Traceability (P0)
Every subledger event fact (F3 AR, F4 AP, F4 Prepayment) within the `reconciliation_as_of` boundary must resolve to exactly one F1 journal set.
* **Mechanism:** Verified by the F5 Traceability Engine. Generates `VARIANCE` (if amounts differ) or `QUARANTINED` (if GL entry is missing or multiple journal sets map to the same fact).
* **Scope:** Scoped strictly by `posting_attempt_id` and `tenant_id` at the database layer.

### F5-I-2: Cash Projection Drift Control (P1)
Reconstructed cash balances derived from F2 cash facts (not projection caches) must reconcile to F1 Bank Control Accounts.
* **Mechanism:** Verified by the F5 Matching Engine via reconstructed bank cash balances compared to the F1 Bank Control ledger balances.
* **Scope:** Checks for timing differences vs. permanent drifts.

### F5-I-3: Movement Deletion Prohibition & Integrity Breach Detection (P0)
Financially referenced F2 cash movements are immutable. Deletion is physically blocked by the F2 engine. F5 detects anomalies and quarantines the case.
* **Mechanism:** F2 table trigger blocks `DELETE` on cash movements if referenced. If an anomaly bypass occurs (e.g. database admin bypass), F5 Reconstruction Engine detects the missing record and immediately flags the case as `QUARANTINED`.

### F5-I-4: Subledger Control Separability (P0)
Reconciliation bounds must isolate subledger positions into distinct, non-overlapping control paths.
* **F5-I-4A (AR):** Reconstructed AR Position $\leftrightarrow$ F1 AR Control balance.
* **F5-I-4B (AP):** Reconstructed AP Position $\leftrightarrow$ F1 AP Control balance.
* **F5-I-4C (Prepayment):** Reconstructed Prepayment Balance $\leftrightarrow$ F1 Prepayment Asset account.
* **Mechanism:** Reconstruction Engine aggregates immutable subledger facts. Matching Engine validates balances separately.

### F5-I-5: Financial Effect Idempotency (P0)
At most one authoritative financial effect exists for one Canonical Financial Effect Identity, regardless of how many requests were processed.
* **Enforcement:** Handled at F1–F4 write boundaries via unique attempt constraints.
* **Detection:** F5 Variance Engine scans for duplicate records sharing the same Canonical Identity. Multiple effects flag the reconciliation case as `QUARANTINED`.

### F5-I-6: Ledger-to-Source Traceability (P0)
Every F1 journal set classified as AR, AP, or Prepayment must resolve back to exactly one authorized source subledger operation.
* **Mechanism:** F5 Traceability Engine performs backward checks. If a journal set lacks a valid, corresponding source subledger fact, F5 generates a `VARIANCE` case (type `TRACEABILITY` or `ORPHAN_GL_POSTING`).

### F5-I-7: Period & Posting Date Integrity (P0)
No subledger or ledger event may post into a `CLOSED` or `LOCKED` period.
* **Mechanism:** Enforced at F1–F4 write boundaries. Verified by F5 Matching Engine which cross-references posting dates against the F1 period table. Any out-of-bounds posting flags the case.

### F5-I-8: Tenant Integrity (P0)
Reconciliation results, matches, and cases must be strictly isolated to `tenant_id`. Cross-tenant matches are blocked.
* **Mechanism:** DB composite unique indexes, composite foreign keys, and RLS policies on F5-owned tables. F5 jobs execute queries with explicit `tenant_id` parameters in all SQL commands.

### F5-I-9: Reconciliation Idempotency & Deterministic Basis (P0)
Given the same source state, same basis version, same run identity, and same `reconciliation_as_of`, reconciliation runs must produce identical control case outcomes.
* **Mechanism:** Reconciliation Run Identity uses `basis_version` + `source_snapshot_hash` (derived from canonical serialization). Matching Engine ensures no time-of-day or timezone variance affects calculations.

### F5-I-10: Currency & FX Determinism (P0)
Multi-currency operations must verify the complete FX chain: source $\to$ transaction $\to$ functional $\to$ F1 journal lines.
* **Mechanism:** F5 Traceability/Matching Engine validates whitelisted rate sources, rate timestamps, rounding rules, and realized/unrealized FX classifications. Mismatches flag the case as `VARIANCE` (type `FX_INTEGRITY`).

---

## Invariants Summary Table

| Invariant | Priority | Control Engine | Case Trigger |
|---|---|---|---|
| **F5-I-1** Source Traceability | P0 | Traceability Engine | `VARIANCE` or `QUARANTINED` |
| **F5-I-2** Cash Drift Control | P1 | Matching Engine | `VARIANCE` |
| **F5-I-3** Deletion Protection | P0 | Reconstruction Engine | `QUARANTINED` |
| **F5-I-4** Subledger Separability| P0 | Reconstruction Engine | `VARIANCE` |
| **F5-I-5** Effect Idempotency | P0 | Variance Engine | `QUARANTINED` |
| **F5-I-6** Ledger Traceability | P0 | Traceability Engine | `VARIANCE` |
| **F5-I-7** Period Integrity | P0 | Matching Engine | `QUARANTINED` |
| **F5-I-8** Tenant Isolation | P0 | System Boundary / RLS | Database Violation / Block |
| **F5-I-9** Run Determinism | P0 | Matching Engine | Test Fail (G2/G8) |
| **F5-I-10** FX Determinism | P0 | Matching Engine | `VARIANCE` |
