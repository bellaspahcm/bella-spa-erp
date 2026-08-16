# F5 Reconciliation & Financial Control — Proof Runner Index

> **Status:** PARTIAL — AP_GL_BALANCE ✅ | AR_GL_BALANCE ✅ | Cash / Prepayment / FX pending ❌
> **Last Updated:** 2026-08-23
> **Constitution Reference:** F5.0 Reconciliation & Financial Control Constitution v1.2-Final (FROZEN)
> **Architecture Gate:** `docs/architecture/ARCHITECTURE_GATE_RESULT_F5.md`
> **Integration Test Files:** 
> - `src/__tests__/f5-reconciliation.integration.test.ts` (AP tests)
> - `src/__tests__/f5-ar-reconciliation.integration.test.ts` (AR tests)

---

## Overview

Each proof below maps to one of the **8 Constitutional Gates (G1–G8)** from the F5.0 Constitution. A proof is considered PASS when both:
1. The SQL/RPC logic satisfies the gate criterion on the live Supabase database.
2. The corresponding integration test assertion in `f5-reconciliation.integration.test.ts` is green.

Gates must be re-verified for **each new control domain** added in F5.5–F5.8.

---

## Proof Evidence Table — AP_GL_BALANCE Domain (F5.1–F5.3) ✅

| Proof | Gate | Description | Expected | Actual | Result |
|:---|:---|:---|:---|:---|:---:|
| [proof-g1-namespace-boundary.md](./proof-g1-namespace-boundary.md) | G1 | F5 run inserts only into `f5_*` tables; zero rows written to F1–F4 tables | delta_f1=0, delta_f2=0, delta_f3=0, delta_f4=0 | delta_f1=0, delta_f2=0, delta_f3=0, delta_f4=0 | ✅ PASS |
| [proof-g2-determinism.md](./proof-g2-determinism.md) | G2 | Same input snapshot run twice → identical classification and variance_amount | run1==run2, idempotent=true | run1==run2, idempotent=true | ✅ PASS |
| [proof-g3-bidirectional-trace.md](./proof-g3-bidirectional-trace.md) | G3 | Every `f5_control_results` row has traceable `run_id`, `basis_id`, `source_snapshot_hash` | trace_fields_present=true | trace_fields_present=true | ✅ PASS |
| [proof-g4-reconstruction.md](./proof-g4-reconstruction.md) | G4 | `f5_reconstruct_ap_position()` rebuilds outstanding balance from immutable facts idempotently | reconstructed==expected, rebuild_idempotent=true | reconstructed==expected, rebuild_idempotent=true | ✅ PASS |
| [proof-g5-integrity-breach.md](./proof-g5-integrity-breach.md) | G5 | Orphan GL record (no matching subledger fact) → classification=QUARANTINED, case_priority=CRITICAL | result=QUARANTINED, case=CRITICAL | result=QUARANTINED, case=CRITICAL | ✅ PASS |
| [proof-g6-idempotency.md](./proof-g6-idempotency.md) | G6 | Re-running same run identity returns existing `run_id`; `f5_control_results` count unchanged | same_run_id=true, delta_rows=0 | same_run_id=true, delta_rows=0 | ✅ PASS |
| [proof-g7-read-boundary.md](./proof-g7-read-boundary.md) | G7 | F5 reads only via `finance_ap_facts_as_of` and `finance_journal_entries_as_of` contracts; no direct table SELECT | direct_select_blocked=true | direct_select_blocked=true | ✅ PASS |
| [proof-g8-temporal-determinism.md](./proof-g8-temporal-determinism.md) | G8 | Reads at `as_of=T` exclude facts created after T; no timezone drift | facts_after_T_excluded=true | facts_after_T_excluded=true | ✅ PASS |

**AP_GL_BALANCE FINAL: 8/8 PASS ✅**

---

## Proof Evidence Table — AR_GL_BALANCE Domain (F5.5) ✅

| Proof | Gate | Description | Expected | Actual | Result |
|:---|:---|:---|:---|:---|:---:|
| [proof-ar-g1-namespace-boundary.md](./proof-ar-g1-namespace-boundary.md) | G1 | AR run writes only to `f5_*` | delta_finance=0 | delta_finance=0 | ✅ PASS |
| [proof-ar-g2-determinism.md](./proof-ar-g2-determinism.md) | G2 | AR MATCHED/VARIANCE deterministic, DEBIT-normal sign convention | run1==run2, GL=debit-credit | run1==run2, GL=debit-credit | ✅ PASS |
| [proof-ar-g3-bidirectional-trace.md](./proof-ar-g3-bidirectional-trace.md) | G3 | AR result traceable to finance_invoices.id | trace_complete=true | trace_complete=true | ✅ PASS |
| [proof-ar-g4-reconstruction.md](./proof-ar-g4-reconstruction.md) | G4 | AR position rebuilt from `finance_receivable_ledger` | reconstructed==expected | reconstructed==expected | ✅ PASS |
| [proof-ar-g5-integrity-breach.md](./proof-ar-g5-integrity-breach.md) | G5 | AR results immutable, UPDATE/DELETE blocked | immutability_guard=active | immutability_guard=active | ✅ PASS |
| [proof-ar-g6-idempotency.md](./proof-ar-g6-idempotency.md) | G6 | AR run identity lock — no duplicate rows | same_run_id=true, delta_rows=0 | same_run_id=true, delta_rows=0 | ✅ PASS |
| [proof-ar-g7-read-boundary.md](./proof-ar-g7-read-boundary.md) | G7 | Only `finance_ar_facts_as_of` + `finance_journal_entries_as_of` consumed | contract_only=true | contract_only=true | ✅ PASS |
| [proof-ar-g8-temporal-determinism.md](./proof-ar-g8-temporal-determinism.md) | G8 | AR reads bounded by `reconciliation_as_of` | facts_after_T_excluded=true | facts_after_T_excluded=true | ✅ PASS |

**AR_GL_BALANCE FINAL: 8/8 PASS ✅**

---

## Proof Evidence Table — CASH_GL_BALANCE Domain (F5.6) ❌ PENDING

| Proof | Gate | Description | Expected | Actual | Result |
|:---|:---|:---|:---|:---|:---:|
| proof-cash-g1 through proof-cash-g8 | G1–G8 | Same gate set applied to CASH control domain | TBD | — | ❌ PENDING |

---

## Proof Evidence Table — PREPAYMENT_GL_BALANCE Domain (F5.6) ❌ PENDING

| Proof | Gate | Description | Expected | Actual | Result |
|:---|:---|:---|:---|:---|:---:|
| proof-pp-g1 through proof-pp-g8 | G1–G8 | Same gate set applied to PREPAYMENT control domain | TBD | — | ❌ PENDING |

---

## Proof Evidence Table — FX_DETERMINISM Domain (F5.7) ❌ PENDING

| Proof | Gate | Description | Expected | Actual | Result |
|:---|:---|:---|:---|:---|:---:|
| proof-fx-g2-determinism.md | G2 | FX check reproducible from same journal lines | TBD | — | ❌ PENDING |
| proof-fx-g7-read-boundary.md | G7 | FX check reads only via F1 temporal contract | TBD | — | ❌ PENDING |
| proof-fx-g8-temporal.md | G8 | FX reads bounded by `reconciliation_as_of` | TBD | — | ❌ PENDING |
| proof-fx-breach-quarantine.md | G5 | FX_BREACH → QUARANTINED + CRITICAL case | TBD | — | ❌ PENDING |

---

## Verdict Summary

```
═══════════════════════════════════════════════════════════════════════
   F5 PROOF RUNNER — VERIFICATION COVERAGE
═══════════════════════════════════════════════════════════════════════

AP_GL_BALANCE    (F5.1–F5.4)  ✅ 8/8  PASS — FROZEN
AR_GL_BALANCE    (F5.5)       ✅ 8/8  PASS — FROZEN
CASH_GL_BALANCE  (F5.6)       ❌ 0/8  PENDING
PREPAYMENT       (F5.6)       ❌ 0/8  PENDING
FX_DETERMINISM   (F5.7)       ❌ 0/4  PENDING

F5 Verification Coverage: 16/36 constitutional gates verified (44.4%)
F5 KERNEL STATUS: 🔨 IN PROGRESS — pending F5.6–F5.8 implementation
═══════════════════════════════════════════════════════════════════════
```

> **F5.5 AR_GL_BALANCE:** 🔒 FROZEN — All 8 gates verified. AP + AR control plane operational.
> **Next Phase:** F5.6 Cash + Prepayment control domains (pending semantic specification).
> **F5 Kernel will be declared FROZEN only when F5.6–F5.8 phases complete with all gates PASS.**
