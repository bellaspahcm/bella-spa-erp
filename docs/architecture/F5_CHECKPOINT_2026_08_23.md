# F5 Reconciliation & Financial Control — Checkpoint 2026-08-23

> **Date:** 2026-08-23  
> **Checkpoint ID:** F5-CP-001  
> **Status:** F5.5 FROZEN ✅ | F5.6 BLOCKED (correct) 🔴  
> **Authority:** Architecture Gate

---

## Checkpoint Summary

F5 Reconciliation & Financial Control has reached a stable, frozen baseline through F5.5 AR_GL_BALANCE.

**What has been achieved:**
- ✅ F5.0–F5.5 FROZEN — Immutable baseline for AP + AR control domains
- ✅ 16/36 constitutional gates verified (44.4% verification coverage)
- ✅ Zero regressions, zero `any` types, full test coverage
- ✅ Architecture discipline enforced: F5.6 correctly blocked pending semantic specification

**What happens next:**
- 🔴 F5.6 remains BLOCKED until Human Architect provides semantic specification
- ⏳ F5.7–F5.8 remain LOCKED (dependency chain preserved)
- 🚫 No AI coding on F5.6 until checklist GREEN

---

## Frozen Baseline (F5.0–F5.5)

### Immutable Artifacts

| Phase | Deliverable | Status | Protection |
|-------|-------------|--------|------------|
| F5.0 | Constitution v1.2-Final | 🔒 FROZEN | Do not modify gates or boundaries |
| F5.1 | AP Schema + Reconstruction | 🔒 FROZEN | Do not alter f5_reconstruct_ap_position |
| F5.2 | AP_GL_BALANCE Engine | 🔒 FROZEN | Do not change AP reconciliation logic |
| F5.3 | Variance Engine | 🔒 FROZEN | Do not modify classification rules |
| F5.4 | AP Hardening | 🔒 FROZEN | Do not remove adversarial tests |
| F5.5 | AR_GL_BALANCE Engine | 🔒 FROZEN | Do not alter AR sign convention |

### Test Coverage (Immutable)

**AP Domain:** `src/__tests__/f5-reconciliation.integration.test.ts` — 8/8 PASS ✅  
**AR Domain:** `src/__tests__/f5-ar-reconciliation.integration.test.ts` — 8/8 PASS ✅  
**Total:** 16/16 tests PASS (100%)

**These tests MUST remain green in all future phases.**

### Proof Documentation (Immutable)

**AP Proofs:** `proof-g1` through `proof-g8` — 8/8 PASS ✅  
**AR Proofs:** `proof-ar-g1` through `proof-ar-g8` — 8/8 PASS ✅  
**Total:** 16/36 constitutional gates verified

### Migrations (Immutable)

```
20260817000000_f5_foundation.sql               — F5 schema
20260818000000_f5_ap_reconstruction.sql        — AP reconstruction
20260819000000_f5_ap_reconciliation.sql        — AP engine
20260819010000_f3_ar_facts_contract.sql        — AR facts (F3)
20260819020000_f5_ar_reconstruction.sql        — AR reconstruction
20260822000000_f5_test_cleanup_rpc.sql         — Test cleanup
20260823010000_f5_ar_reconciliation_fix.sql    — AR engine
```

**Do not rollback, modify, or replace these migrations.**

---

## Architecture Principles Established

### 1. Namespace Boundary (G1)

```
F5 writes ONLY to f5_* tables.
ZERO writes to finance_* tables.
```

**Evidence:** AP + AR tests confirm no mutations to F1–F4 tables.  
**Protection:** Do not introduce any `INSERT/UPDATE/DELETE` against finance_* in future phases.

### 2. Sign Convention Proven (G2)

```
AP (account 331) — CREDIT normal:
  GL Outstanding = SUM(credit) - SUM(debit)

AR (account 131) — DEBIT normal:
  GL Outstanding = SUM(debit) - SUM(credit)
```

**Evidence:** Test 5.2 proves AR actual = 10000000 (not -10000000).  
**Protection:** Do not invert sign conventions in future domains without explicit proof.

### 3. Contract Compliance (G7)

```
F5 reads ONLY via approved public contracts.
NO direct table SELECT from finance_* tables.
```

**Evidence:** AP uses finance_ap_facts_as_of(), AR uses finance_ar_facts_as_of().  
**Protection:** Do not bypass contracts in F5.6+ (Cash must use F2 contract, not direct table reads).

### 4. Immutability (G5)

```
Control results and cases CANNOT be updated or deleted.
Only f5_admin_cleanup_test_data may bypass (test cleanup only).
```

**Evidence:** Triggers block UPDATE/DELETE on f5_control_results and f5_control_cases.  
**Protection:** Do not weaken immutability guards in future phases.

### 5. Temporal Determinism (G8)

```
Historical reconciliation (as_of past timestamp) sees ONLY data created before that timestamp.
NO time leakage.
```

**Evidence:** AP/AR tests verify as_of boundary respected by source contracts.  
**Protection:** All F5.6+ domains must verify temporal boundary in contracts.

---

## Governance Principle: Financial Semantics

### Core Principle Established

```
┌──────────────────────────────────────────────────────────────┐
│  "Code can be AI-generated.                                  │
│   Financial semantics cannot be AI-invented."               │
└──────────────────────────────────────────────────────────────┘
```

**Why This Matters:**

A reconciliation function can:
- ✅ Compile without errors
- ✅ Pass all synthetic tests
- ✅ Run without runtime exceptions
- ❌ **Be semantically wrong** (wrong account, wrong formula, wrong sign)

**Protection Mechanism:**

F5 Pre-Coding Gate Protocol enforces:
1. Human Architect specifies financial semantics FIRST
2. AI implements against explicit specification SECOND
3. Tests verify implementation matches specification THIRD

**Document:** `docs/architecture/F5_PRE_CODING_GATE_PROTOCOL.md`

### Application to F5.6

F5.6 Cash + Prepayment is **correctly BLOCKED** because:

| Semantic Gap | Why AI Cannot Infer | Risk If Wrong |
|--------------|---------------------|---------------|
| F2 cash contract | Contract name/schema is arbitrary | Wrong source → wrong facts |
| GL account mapping | Chart of accounts is business decision | Wrong account → false MATCHED |
| Reconstruction formula | Multiple valid formulas exist | Wrong balance → misclassification |
| Sign convention | DEBIT vs CREDIT normal arbitrary | Inverted variance signs |
| Temporal column | Multiple timestamp columns exist | Time leakage (G8 failure) |

**Checklist:** `docs/architecture/F5_6_CASH_PREPAYMENT_CHECKLIST.md`

---

## What Is Protected (Do Not Modify)

### 1. F5.0 Constitution

- Do not change gate definitions (G1–G8)
- Do not redefine control types (AP_GL_BALANCE, AR_GL_BALANCE)
- Do not alter identity model (run_id, basis_id, source_id)
- Do not weaken immutability semantics

### 2. F5.1–F5.5 Production Code

- Do not modify `f5_reconstruct_ap_position()`
- Do not modify `f5_reconstruct_ar_position()`
- Do not change AP reconciliation logic in `f5_run_reconciliation()`
- Do not change AR reconciliation logic in `f5_run_reconciliation()`
- Do not alter variance classification thresholds

### 3. F5.1–F5.5 Integration Tests

- Do not remove or weaken existing test assertions
- Do not change test expectations to make new code pass
- Do not skip existing tests
- All 16 existing tests MUST remain green

### 4. Proof Documentation

- Do not alter AP proof docs (proof-g1 through proof-g8)
- Do not alter AR proof docs (proof-ar-g1 through proof-ar-g8)
- Do not claim PASS for unverified gates

---

## What May Change (Additive Only)

### 1. New Control Domains (F5.6+)

- ✅ Add new branches to `f5_run_reconciliation()` via CREATE OR REPLACE
- ✅ Add new reconstruction functions (e.g., `f5_reconstruct_cash_position()`)
- ✅ Add new integration test files
- ✅ Add new proof documentation

**Rules:**
- MUST preserve existing AP/AR logic verbatim
- MUST NOT modify F5.1–F5.5 test expectations
- MUST follow Pre-Coding Gate Protocol

### 2. Test Cleanup Functions

- ✅ Enhance `f5_admin_cleanup_test_data()` for new domains
- ✅ Add new cleanup helpers

**Rules:**
- MUST preserve existing cleanup behavior for AP/AR
- MUST NOT be used in production (test/dev only)

### 3. Documentation

- ✅ Add new proof docs for F5.6+ domains
- ✅ Update F5_IMPLEMENTATION_PLAN status
- ✅ Update F5_PROOF_RUNNER/README verification coverage

**Rules:**
- MUST NOT alter frozen baseline documentation (F5.0–F5.5 sections)

---

## Next Steps (Ordered)

### Step 1: F5.6 Semantic Specification (Human Architect)

**Required Deliverables:**

1. **F2 Cash Contract Specification**
   - Contract name: `finance_cash_facts_as_of()`
   - Return schema documentation
   - Temporal boundary column confirmation
   - Version tag assignment (e.g., `F2_CASH:v1`)

2. **F4 Prepayment Contract Specification**
   - Contract name: `finance_prepayment_facts_as_of()`
   - Return schema documentation
   - Balance formula: gross - applied - refunded
   - Version tag assignment (e.g., `F4_PREPAYMENT:v1`)

3. **GL Account Mapping**
   - Cash GL account code (e.g., 111)
   - Cash account normal balance type (DEBIT/CREDIT)
   - Prepayment GL clearing account code (e.g., 331PP or 234 or 132)
   - Prepayment account normal balance type (DEBIT/CREDIT)

4. **Reconstruction Formulas**
   - Cash: inflow/outflow semantics + entry types
   - Prepayment: gross/applied/refunded semantics + entry types

5. **Temporal Semantics**
   - Cash movements temporal column (created_at? posted_at? transaction_date?)
   - Prepayment movements temporal column
   - Verification that F2 contracts respect temporal boundaries

**Checklist Status:** All items must be ✅ GREEN before Step 2.

### Step 2: F5.6 Architecture Gate Review (Human Architect)

- Review completed checklist
- Approve semantic specifications
- Change F5.6 status from 🔴 BLOCKED to ✅ APPROVED
- Authorize AI coding to begin

### Step 3: F5.6 Implementation (AI Coding)

**Only after Step 2 approval:**

- Implement CASH_GL_BALANCE branch in `f5_run_reconciliation()`
- Implement PREPAYMENT_GL_BALANCE branch in `f5_run_reconciliation()`
- Write integration tests (G1–G8 for each domain)
- Create proof documentation (8 proof docs per domain)
- Verify AP/AR regression: 16/16 tests remain green

### Step 4: F5.7–F5.8 (Future)

- F5.7 FX Determinism — after F5.6 complete
- F5.8 Scheduler — after F5.7 complete
- F5 Kernel FREEZE — when all 36 gates verified

---

## Checkpoint Metrics

### Code Quality

- ✅ Zero `any` types introduced (F5.0–F5.5)
- ✅ Strict typing maintained throughout
- ✅ Type safety enhancements applied (source_id::TEXT cast)

### Test Quality

- ✅ 16/16 tests PASS (100% success rate)
- ✅ Test independence verified (no cross-test data pollution)
- ✅ Concurrent idempotency properly tested

### Architecture Quality

- ✅ 16/36 constitutional gates verified (44.4% coverage)
- ✅ Zero regressions introduced
- ✅ Namespace boundary preserved (G1)
- ✅ Immutability preserved (G5)
- ✅ Contract compliance preserved (G7)
- ✅ Temporal determinism preserved (G8)

### Documentation Quality

- ✅ 16 proof documents shipped (AP 8 + AR 8)
- ✅ Pre-Coding Gate Protocol formalized
- ✅ F5.6 checklist created
- ✅ Status summary published

---

## Verdict

```
┌──────────────────────────────────────────────────────────────┐
│  F5 CHECKPOINT 2026-08-23: HEALTHY                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ F5.0–F5.5 FROZEN                                        │
│     - Immutable baseline established                        │
│     - AP + AR control domains operational                   │
│     - 16/16 tests PASS, 16/36 gates verified               │
│     - Zero regressions, zero technical debt                │
│                                                              │
│  🔴 F5.6 CORRECTLY BLOCKED                                  │
│     - Semantic specification incomplete                     │
│     - Pre-Coding Gate Protocol enforced                    │
│     - Architecture discipline maintained                    │
│                                                              │
│  ⏳ F5.7–F5.8 LOCKED (dependency chain preserved)           │
│                                                              │
│  🔒 Governance Principle Established:                       │
│     "Code can be AI-generated.                             │
│      Financial semantics cannot be AI-invented."           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**This checkpoint represents healthy architecture discipline, not delayed progress.**

---

## Sign-Off

**Frozen Baseline:** F5.0–F5.5  
**Protected Artifacts:** Constitution, migrations, tests, proof docs  
**Blocking Status:** F5.6 correctly blocked pending Human Architect specification  
**Next Action:** Human Architect provides F5.6 semantic specification  

**F5.5 AR_GL_BALANCE: CLOSED**  
**F5.6 Cash + Prepayment: CORRECTLY BLOCKED**  
**F5 Baseline: PROTECTED**

