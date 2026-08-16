# F5 Reconciliation & Financial Control — Implementation Plan

> **Status:** F5.1–F5.5 FROZEN ✅ | F5.6–F5.8 BLOCKED ❌
> **Constitution:** F5.0 v1.2-Final — FROZEN (do not modify)
> **Architecture Gate:** `docs/architecture/ARCHITECTURE_GATE_RESULT_F5.md`
> **Proof Runner:** `docs/architecture/F5_PROOF_RUNNER/README.md`
> **Integration Tests:** 
> - `src/__tests__/f5-reconciliation.integration.test.ts` (AP tests)
> - `src/__tests__/f5-ar-reconciliation.integration.test.ts` (AR tests)

---

## Ground Rules (Non-Negotiable)

1. **F5 is observer-only.** F5 writes to `f5_*` namespace only. Zero writes to F1–F4 tables.
2. **Constitution is frozen.** Do not re-design boundaries, identity models, or gate definitions.
3. **Gate-first.** Each phase is only "done" when all 8 gates pass for that domain in the proof runner.
4. **Additive migrations only.** No ALTER TABLE on existing F1–F4 tables. Only CREATE new F5 functions/tables.
5. **No `any` types.** Strictly typed throughout.
6. **Hardening ≠ Refactoring.** F5.4 MUST NOT change production behavior merely to satisfy tests. Existing F5.1–F5.3 behavior and contracts are presumed correct unless an adversarial test demonstrates a concrete defect. Any production-code change must include a regression test and must preserve all F5-G1–G8 invariants.
7. **Existing tests must remain green.** No new passing test may cause a previously-green test to fail.

---

## Phase Status Overview

```
F5.0  Constitution Design & Freeze           ✅ FROZEN
F5.1  DB Schema + AP Position Reconstruction ✅ FROZEN
F5.2  AP_GL_BALANCE Run Engine              ✅ FROZEN
F5.3  Variance Engine + Immutability        ✅ FROZEN
F5.4  Hardening & Fault Injection           ✅ FROZEN
F5.5  AR_GL_BALANCE Domain                  ✅ FROZEN
──────────────────────────────────────────────────────
F5.6  Cash + Prepayment Domains             🔴 BLOCKED (semantic spec incomplete)
F5.7  FX Determinism Control                ⏳ PENDING
F5.8  Continuous Control Scheduler          ⏳ PENDING

F5 Verification Coverage: 16/36 constitutional gates verified (44.4%)
F5 KERNEL STATUS: 🔨 IN PROGRESS
```

---

## F5.4 — Hardening & Fault Injection ✅ FROZEN

**Goal:** Stress-test the AP_GL_BALANCE engine. Confirm G1–G8 hold under adversarial conditions.
**Unlocks:** F5 AP domain declared production-ready.

### Deliverables

| # | Deliverable | Type |
|---|---|---|
| 4.1 | Run identity collision test: two **genuinely concurrent** invocations (via `Promise.all` or two parallel DB connections) with identical `tenant_id + control_type + basis_id + basis_version + reconciliation_as_of + source_snapshot_hash` → exactly 1 result row persisted, both callers receive idempotent outcome. **Sequential calls do NOT satisfy this test.** | Integration test |
| 4.2 | Immutability guard: attempt UPDATE on `f5_control_results` → trigger blocks it | Integration test |
| 4.3 | Immutability guard: attempt DELETE on `f5_control_results` → trigger blocks it | Integration test |
| 4.4 | Stale snapshot: run at `as_of = T-1d` after new facts posted → result reflects only facts ≤ T-1d | Integration test |
| 4.5 | QUARANTINED escalation: insert orphan GL line (no AP fact) → QUARANTINED + CRITICAL case auto-generated | Integration test |
| 4.6 | Case resolution does NOT flip result to MATCHED: resolve case → re-run still shows VARIANCE if data unchanged | Integration test |
| 4.7 | Proof runner files: `proof-g1` through `proof-g8` stub files with actual query output pasted | Proof docs |

### Gate Verification

All 8 gates re-verified against adversarial scenarios. Proof runner `proof-g1-namespace-boundary.md` … `proof-g8-temporal-determinism.md` populated with evidence.

### Done Criteria

```
✅ 4.1–4.6 integration tests green
✅ F5_PROOF_RUNNER G1–G8 AP domain: ALL PASS with adversarial evidence
✅ No new f5_* migration needed (hardening is test/logic only)
```

---

## F5.5 — AR_GL_BALANCE Domain

**Goal:** Extend reconciliation to F3 Accounts Receivable. Reconstruct AR outstanding from `finance_receivable_ledger` → compare vs F1 account 131 balance.
**Depends on:** F5.4 complete, F3 frozen ✅

---

## F5.5 — AR_GL_BALANCE Domain ✅ FROZEN

**Goal:** Extend reconciliation to F3 Accounts Receivable. Same engine pattern as AP but with DEBIT-normal sign convention.
**Status:** ✅ **COMPLETE** — All deliverables shipped, 8/8 gates verified
**Completed:** 2026-08-23

### Deliverables

| # | Deliverable | Type | Status | Notes |
|---|---|---|---|---|
| 5.1 | `finance_ar_facts_as_of()` contract | F3 public contract | ✅ EXISTING | Already deployed in migration 20260819010000 |
| 5.2 | `f5_reconstruct_ar_position()` | SQL function | ✅ EXISTING | Already deployed in migration 20260819020000 |
| 5.3 | AR_GL_BALANCE branch in `f5_run_reconciliation()` | SQL function | ✅ SHIPPED | Migration 20260823010000 |
| 5.4 | AR integration test suite | Test file | ✅ SHIPPED | `src/__tests__/f5-ar-reconciliation.integration.test.ts` (8 tests) |
| 5.5 | Proof files: `proof-ar-g1` … `proof-ar-g8` | Proof docs | ✅ SHIPPED | All 8 AR proof docs in F5_PROOF_RUNNER |

### Key Semantic Difference from AP

```
AP (account 331) — CREDIT normal balance:
  GL Outstanding = SUM(credit) - SUM(debit)

AR (account 131) — DEBIT normal balance:
  GL Outstanding = SUM(debit) - SUM(credit)
```

**Critical Implementation Note:** Sign convention verified by test 5.2 (AR sign convention proof).
AR actual = 10000000 (not -10000000) confirms DEBIT-normal formula correct.

### Implementation Notes

1. **source_id::TEXT Cast:** Applied to both AR and AP branches to prevent VARCHAR/UUID type mismatch across PostgREST drivers
2. **Reconstruction:** Uses existing `f5_reconstruct_ar_position()` from F3 (DEBIT_ACCRUAL + DEBIT_ADJUSTMENT - CREDIT_ALLOCATION - CREDIT_ADJUSTMENT)
3. **Contract Compliance:** Reads only via `finance_ar_facts_as_of()` (F3) and `finance_journal_entries_as_of()` (F1)
4. **Test Independence:** Concurrent idempotency test fixed to seed independent data (no cross-test dependencies)

### Test Results

**AR Tests:** 8/8 PASS ✅
- 5.1: MATCHED basic scenario
- 5.2: AR sign convention proof (DEBIT-normal)
- 5.3: Full payment MATCHED
- 5.4: Temporal boundary G8
- 5.5: Concurrent idempotency G6
- 5.6: Namespace boundary G1
- 5.7: Contract boundary G7
- 5.8: Immutability G5

**AP Regression:** 8/8 PASS ✅ (F5.1–F5.4 tests remain green)

### Done Criteria

```
✅ finance_ar_facts_as_of() deployed and tested (pre-existing)
✅ f5_reconstruct_ar_position() deployed and tested (pre-existing)
✅ AR_GL_BALANCE run engine passes 8-test suite
✅ F5_PROOF_RUNNER AR domain: G1–G8 ALL PASS
✅ Zero writes to finance_receivable_ledger or finance_invoices
✅ AP regression: 8/8 PASS
✅ New any types: 0
✅ F1–F4 writes: 0
```

**F5.5 AR_GL_BALANCE: 🔒 FROZEN — Immutable baseline established**

---

## F5.6 — Cash & Prepayment GL Balance Domains 🔴 BLOCKED

**Goal:** Extend reconciliation to F2 Cash and AP Prepayments. Two new control types in one phase (same engine pattern, different read contracts and account codes).
**Status:** 🔴 **BLOCKED** — Semantic specification incomplete
**Depends on:** F5.5 complete ✅, F2 contract specification ❌, GL account mapping ❌

### Pre-Implementation Checklist

**⚠️ F5.6 MUST NOT begin until semantic boundaries are specified.**

See detailed checklist: `docs/architecture/F5_6_CASH_PREPAYMENT_CHECKLIST.md`

**Blocking Issues:**
- ❌ F2 cash public contract (`finance_cash_facts_as_of`) not identified
- ❌ F2 prepayment public contract (`finance_prepayment_facts_as_of`) not identified
- ❌ Cash account → GL account mapping undefined
- ❌ Prepayment GL clearing account code not confirmed (331PP? 234? 132?)
- ❌ Cash movement entry_type semantics undefined (DEPOSIT/WITHDRAWAL? INFLOW/OUTFLOW?)
- ❌ Prepayment balance formula not confirmed (gross - applied - refunded?)
- ❌ Temporal boundary columns not verified (created_at? posted_at? transaction_date?)

### 6A — CASH_GL_BALANCE

| # | Deliverable | Type | Status | Notes |
|---|---|---|---|---|
| 6A.1 | `finance_cash_facts_as_of()` | F2 public contract | ❌ PENDING | F2 contract not identified |
| 6A.2 | `f5_run_reconciliation()` overload for `CASH_GL_BALANCE` | SQL function | ❌ PENDING | GL account code TBD (111?) |
| 6A.3 | Cash integration tests + proofs | Test + docs | ❌ PENDING | G1–G8 for CASH domain |

### 6B — PREPAYMENT_GL_BALANCE

| # | Deliverable | Type | Status | Notes |
|---|---|---|---|---|
| 6B.1 | `finance_prepayment_facts_as_of()` | F2 public contract | ❌ PENDING | F2 contract not identified |
| 6B.2 | `f5_run_reconciliation()` overload for `PREPAYMENT_GL_BALANCE` | SQL function | ❌ PENDING | GL account code TBD (331PP? 234? 132?) |
| 6B.3 | Prepayment reconstruction: gross - applied - refunded | SQL logic | ❌ PENDING | Balance formula not confirmed |
| 6B.4 | Prepayment integration tests + proofs | Test + docs | ❌ PENDING | G1–G8 for PREPAYMENT domain |

### Done Criteria

```
✅ CASH_GL_BALANCE: 8-test suite green, G1–G8 proofs ALL PASS
✅ PREPAYMENT_GL_BALANCE: 8-test suite green, G1–G8 proofs ALL PASS
✅ Zero writes to finance_cash_movements or finance_ap_ledger_facts
✅ F5_PROOF_RUNNER: Cash + PP domains ALL PASS
```

---

## F5.7 — FX Determinism Control

**Goal:** Verify the functional-currency translation chain. Detect FX_BREACH without mutating any ledger evidence.
**Depends on:** F5.6 complete. Finance OS FX rate policy confirmed (even informally).

### Deliverables

| # | Deliverable | Type | Notes |
|---|---|---|---|
| 7.1 | `f5_run_fx_determinism_check(p_tenant_id, p_transaction_id, p_as_of)` | SQL function | Reads F1 journal lines via `finance_journal_entries_as_of`. For each line: `expected_functional = transaction_amount * exchange_rate`. Checks `abs(stored_functional - expected_functional) ≤ 1` (1 minor unit tolerance). |
| 7.2 | FX result states: `FX_VALID` / `FX_BREACH` | SQL enum / classification | `FX_BREACH` → auto-generate CRITICAL case in `f5_control_cases`. |
| 7.3 | FX integration tests | Test file | At minimum: valid translation passes, 2-unit drift fails, tolerance edge case. |
| 7.4 | Proof files: `proof-fx-g2`, `proof-fx-g7`, `proof-fx-g8`, `proof-fx-breach-quarantine` | Proof docs | FX domain has 4 gates (G2, G5, G7, G8 — most relevant). |

### Note on FX Rate Source

F5.7 reads `exchange_rate` directly from the F1 journal line record (already stored at posting time by F1). F5 does **not** own or query a rate table. This is consistent with the Constitution: F5 verifies what F1 recorded, not what F1 should have recorded.

### Done Criteria

```
✅ f5_run_fx_determinism_check() deployed
✅ FX_BREACH auto-generates CRITICAL case
✅ FX integration tests green
✅ F5_PROOF_RUNNER FX domain: G2, G5, G7, G8 ALL PASS
✅ Zero mutation to any F1 journal line
```

---

## F5.8 — Continuous Control Scheduler

**Goal:** Automate reconciliation runs in production. Move from on-demand to continuous control.
**Depends on:** F5.7 complete. Production Supabase pg_cron extension available.

### Deliverables

| # | Deliverable | Type | Notes |
|---|---|---|---|
| 8.1 | `f5_schedule_continuous_runs` pg_cron job config | SQL / migration | Runs `f5_run_reconciliation` for each domain at configurable interval (default: every 15 min). |
| 8.2 | `f5_control_schedule` table | TABLE | Tracks scheduled run parameters per tenant per control type. Allows per-tenant enable/disable. |
| 8.3 | Alert webhook contract | Design doc | When a new CRITICAL case is created → emit `f5.control.breach.v1` domain event via outbox. Product verticals subscribe for dashboards / notifications. |
| 8.4 | Dead-letter / stuck-run detection | SQL function | If a run_id is in `IN_PROGRESS` state for > configurable timeout → auto-expire and retry. |
| 8.5 | Ops runbook | Markdown doc | How to pause, resume, backfill, and re-run a specific period for a tenant. |

### Done Criteria

```
✅ pg_cron job runs without error in staging
✅ f5_control_schedule table deployed with per-tenant enable/disable
✅ f5.control.breach.v1 event emitted on CRITICAL case creation
✅ Stuck-run detection tested
✅ Ops runbook written
```

---

## F5 Kernel Freeze Criteria

F5 is declared **FROZEN** (equivalent to F1–F4 freeze status) only when ALL of the following are true:

```
✅ F5.4  AP domain: G1–G8 adversarial proofs ALL PASS
✅ F5.5  AR_GL_BALANCE: G1–G8 ALL PASS
✅ F5.6  CASH_GL_BALANCE: G1–G8 ALL PASS
✅ F5.6  PREPAYMENT_GL_BALANCE: G1–G8 ALL PASS
✅ F5.7  FX_DETERMINISM: G2, G5, G7, G8 ALL PASS
✅ F5.8  Continuous scheduler operational in staging
✅ F5_PROOF_RUNNER/README.md: 36/36 gates PASS (all domains)
✅ Zero `any` types in any f5_* file
✅ Zero direct writes to F1–F4 tables (confirmed by architecture-guard.ts)
✅ FINANCE_OS_ARCHITECTURE_CONSTITUTION.md updated: F5 status → FROZEN
```

---

## File Map

```
docs/architecture/
  ├── F5_0_WALKTHROUGH.md              ✅ Constitution design record
  ├── F5_1_WALKTHROUGH.md              ✅ F5.1–F5.3 implementation record
  ├── ARCHITECTURE_GATE_RESULT_F5.md   ✅ Pre-coding gate (this project's authority doc)
  ├── F5_IMPLEMENTATION_PLAN.md        ✅ This file — phase-by-phase plan
  └── F5_PROOF_RUNNER/
      └── README.md                    ✅ Gate evidence index

src/__tests__/
  └── f5-reconciliation.integration.test.ts   ✅ AP domain (8/8 green)
  — f5-ar-reconciliation.integration.test.ts  ❌ F5.5
  — f5-cash-reconciliation.integration.test.ts ❌ F5.6
  — f5-fx-determinism.integration.test.ts      ❌ F5.7
```
