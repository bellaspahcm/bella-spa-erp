# F5 RECONCILIATION & FINANCIAL CONTROL — FREEZE RECORD

> **STATUS: 🔒 F5.0 CONSTITUTION FROZEN**
> This document is the authoritative freeze declaration for the F5 Reconciliation & Financial Control Constitution.
> Once frozen, no modification to the F5 Source-of-Truth Matrix, Invariants, Identity Model, or Architecture is permitted except through the Change Control process defined below.

---

## Freeze Metadata

| Field | Value |
|---|---|
| **Phase** | F5.0 Reconciliation & Financial Control Constitution |
| **Freeze Date** | 2026-08-16T08:25:00+07:00 |
| **Document Version** | v1.2-Final (Pre-Freeze Canonical) |
| **Architect Approval** | APPROVED — F5.0 Constitution Locked |
| **Verification Gates** | F5-G1 through F5-G8: All PASS (Conceptual & Analytical Review) |
| **Prerequisites** | F1 Ledger FROZEN ✅, F2 Cash FROZEN ✅, F3 AR FROZEN ✅, F4 AP FROZEN ✅ |

---

## Architecture Boundary

F5 operates as the **Independent Financial Control Plane** of the entire Finance OS. It occupies a distinct layer above the authoritative transaction core (F1–F4):

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

### Inbound Boundary Rules (P0)
* **Encapsulation:** F5 is strictly prohibited from accessing internal `finance_*` tables directly. It must consume F1–F4 data exclusively via approved versioned read contracts.
* **Temporal Scoping:** All reads from F1–F4 must accept and enforce a `reconciliation_as_of` TIMESTAMPTZ parameter to guarantee determinism.
* **Tenant Isolation:** All reads must scope queries to `tenant_id` at the database layer.

### Outbound Boundary Rules (P0)
* **No Mutation on Core:** F5 is strictly forbidden from writing, updating, or deleting any records in the F1, F2, F3, or F4 tables.
* **Namespace Isolation:** F5 mutates only tables explicitly defined under the `f5_*` namespace (`f5_control_results`, `f5_control_cases`, `f5_projection_health`).

---

## Frozen Components (Constitution v1.2-Final)

### 1. F5 Source of Truth Matrix
Locked as defined in `docs/architecture/FINANCE_OS_AUDIT_ROADMAP.md#41-f5-source-of-truth-matrix`. F5 reconstructs positions exclusively from immutable facts, never from cached projections.

### 2. Invariants (F5-I-1 to F5-I-10)
Locked as defined in `docs/architecture/FINANCE_OS_AUDIT_ROADMAP.md#47-f5-invariants-f5-i-1-to-f5-i-10`.
* **Traceability:** Bidirectional split of F5-I-1 (Source $\to$ Ledger) and F5-I-6 (Ledger $\to$ Source).
* **FX Determinism:** F5-I-10 complete FX chain validation (source $\to$ transaction $\to$ functional $\to$ rounding $\to$ F1 posting).
* **Idempotency:** F5-I-5 (at most one financial effect exists for one canonical identity) and F5-I-9 (deterministic run idempotency).

### 3. Identity Model
* **Canonical Financial Effect Identity:** 6-tuple `(tenant_id, domain, source_type, source_id, financial_effect_type, posting_attempt_id)`.
* **Reconciliation Run Identity:** `(tenant_id, control_type, basis_id, basis_version, reconciliation_as_of, source_snapshot_hash)`.

### 4. Variance & Quarantine Semantics
* **MATCHED:** Trusted data, financially consistent. Results stored in `f5_control_results`; no case is created.
* **VARIANCE:** Trusted data, inconsistent financial results. Case status transitions: `OPEN ➔ INVESTIGATING ➔ RESOLVED`.
* **QUARANTINED:** Untrusted data, structural integrity broken. Case status transitions: `QUARANTINED ➔ INVESTIGATING ➔ RESOLVED`.
* **Resolution Law:** `RESOLVED` indicates that an authorized explanation or corrective workflow reference is recorded. It does **not** indicate financial correctness. Correctness is verified only by a subsequent `MATCHED` run.

### 5. Two-Tier Control Semantics
* **Control A (Financial GL Control):** Fact-reconstructed position vs F1 Control Account balance.
* **Control B (Projection Cache Health):** Fact-reconstructed position vs subledger cache table (e.g. `finance_payable_positions`). Drift results in `CACHE_DRIFT` and is never escalated to `VARIANCE`.

---

## Change Control Policy

### PROHIBITED post-freeze (without Architecture Review Board + ADR)
* Any weakening of F5-I-1 through F5-I-10 invariants.
* Any removal of fields from the Canonical Financial Effect Identity or Reconciliation Run Identity.
* Any alteration of the `RESOLVED ➔ MATCHED` lifecycle boundary.
* Any addition of direct write/mutation permissions from F5 to F1–F4 tables.

### PERMITTED without formal ADR
* Additive metadata fields to `f5_*` schema tables.
* Implementation of specific multi-dimensional severity scoring algorithms within Phase F5.3.
* Performance tuning of indexes on `f5_*` tables.

---

## Next Execution Steps

Upon F5.0 Constitution Freeze, the project enters **Phase F5.1 — Reconciliation Kernel** implementation. All coding must strictly comply with this frozen Constitution.

```
F5.0 CONSTITUTION APPROVED & FROZEN
────────────────────────────────────
Reviewer: Antigravity (Lead Architect)
Sign-Off: LOCKED v1.2-FINAL
```
