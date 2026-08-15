# F2 CASH & TREASURY ENGINE — VERIFICATION REPORT

> **Status: 🔒 FINAL FREEZE — 79/79 PASS**
> This document records all integration test evidence that justifies the F2 Final Freeze decision.

---

## Verification Metadata

| Field | Value |
|---|---|
| **Freeze Date** | 2026-08-15T22:24:46+07:00 |
| **Commit SHA** | `7d0b2b3aab3a9c7cf97f2b8ec5893b73998015b2` |
| **Migration Range** | `20260816000000` → `20260816040000` |
| **Test Command** | `npx jest src/platform/finance/__tests__/finance-f2- --runInBand --forceExit` |
| **Total Duration** | ~60s |
| **Database** | Remote Supabase: `lvnvkpyxtuilhrabtlwv.supabase.co` |

---

## Overall Result

```
Test Suites: 5 passed, 5 total
Tests:       79 passed, 79 total
Snapshots:   0 total
Time:        60.282 s
```

---

## Suite 1 — F2.1 Database & RLS (22/22 PASS)

**File:** `src/platform/finance/__tests__/finance-f2-db-rls.test.ts`

**Scope:** Schema integrity, unique constraints, RLS tenant isolation, data type enforcement.

| Test | Assertion | Result |
|---|---|---|
| T01 | Bank account schema is correct | PASS |
| T02 | Cash position schema is correct | PASS |
| T03 | Cash movement schema is correct | PASS |
| T04 | RLS: tenant A cannot read tenant B bank accounts | PASS |
| T05 | RLS: tenant A cannot read tenant B cash positions | PASS |
| T06 | Duplicate leg reference constraint blocks second projection | PASS |
| T07 | Idempotency key unique constraint enforced | PASS |
| T08 | Bank account FK enforces tenant consistency | PASS |
| T09 | Composite FK (tenant_id, bank_account_id) blocks cross-tenant movement | PASS |
| T10 | Cash position balance correctly reflects movements | PASS |
| T11 | Null tenant_id rejected at DB level | PASS |
| T12 | Direct INSERT to cash_movements blocked without auth context | PASS |
| T13 | Direct UPDATE to cash_movements blocked unconditionally | PASS |
| T14 | Direct DELETE to cash_movements blocked unconditionally | PASS |
| T15 | Cash staged lines schema is correct | PASS |
| T16 | Quarantine table schema is correct | PASS |
| T17 | Valuation rate defaults and nullability correct | PASS |
| T18 | Currency field length constraint enforced | PASS |
| T19 | Amount fields are numeric with correct precision | PASS |
| T20 | `recorded_at` defaults to NOW() on INSERT | PASS |
| T21 | RLS: anon role cannot access F2 tables | PASS |
| T22 | Version counter increments on each position update | PASS |

---

## Suite 2 — F2.2 Projection Worker (17/17 PASS)

**File:** `src/platform/finance/__tests__/finance-f2-projection-worker.test.ts`

**Scope:** Event consumption, mapping, projection logic, quarantine routing, error classification.

| Test | Assertion | Result |
|---|---|---|
| T01 | Posted event with CASH legs creates cash movements | PASS |
| T02 | Posted event with non-CASH legs is filtered (no movement created) | PASS |
| T03 | Event for inactive bank account → quarantine (terminal) | PASS |
| T04 | Event for non-existent F1 transaction → quarantine (terminal) | PASS |
| T05 | Event replay (same idempotency key) → idempotent (no duplicate) | PASS |
| T06 | Duplicate `cash_leg_reference` with different idempotency key → quarantine | PASS |
| T07 | Multi-leg CASH transaction → all legs projected atomically | PASS |
| T08 | Reversal event projects as OUTFLOW against original INFLOW | PASS |
| T09 | USD→VND conversion: `functional_amount_minor` calculated correctly | PASS |
| T10 | INFLOW increases balance; OUTFLOW decreases balance | PASS |
| T11 | Tenant isolation: worker only projects for its assigned tenant | PASS |
| T12 | Out-of-order event delivery: balance is commutative | PASS |
| T13 | Missing `cash_leg_id` in event → quarantine (terminal) | PASS |
| T14 | Security integrity violation (F1 not found) → SECURITY_AUDIT_SIGNAL emitted | PASS |
| T15 | Quarantine event has correct failure_reason and failure_code | PASS |
| T16 | Transient error → outbox retry (not quarantined) | PASS |
| T17 | All projected movements are traceable to their F1 `transaction_id` | PASS |

---

## Suite 3 — F2.3 Reporting API (12/12 PASS)

**File:** `src/platform/finance/__tests__/finance-f2-reporting-api.test.ts`

**Scope:** `CashEngineService` read-only API, tenant isolation at service layer, pagination, runway calculation.

| Test | Assertion | Result |
|---|---|---|
| T01 | `listBankAccounts` returns only tenant's accounts | PASS |
| T02 | `getBankAccount` returns single account or NOT_FOUND | PASS |
| T03 | `getCashPosition` returns correct balance after projections | PASS |
| T04 | `listCashPositions` aggregates all tenant positions | PASS |
| T05 | `getCashMovements` returns movements with correct pagination | PASS |
| T06 | `getCashMovements` pagination limit ceiling enforced (max 200) | PASS |
| T07 | `getCashMovements` filters by `bank_account_id` | PASS |
| T08 | `getCashMovements` filters by date range | PASS |
| T09 | `getConsolidatedRunway` calculates days from positions and burn rate | PASS |
| T10 | `getConsolidatedRunway` returns NO_BURN_RATE when no mv_cash_flow data | PASS |
| T11 | Unauthorized access (missing permission) → FORBIDDEN error | PASS |
| T12 | Tenant context mismatch → FORBIDDEN error | PASS |

---

## Suite 4 — F2.4 Reconstruction RPC (18/18 PASS)

**File:** `src/platform/finance/__tests__/finance-f2-reconstruction.test.ts`

**Scope:** Derived position reconstruction, privilege scoping, cross-tenant protection, atomic rollback.

| Test | Assertion | Result |
|---|---|---|
| T01 | Single account reconstruction: derived balance matches Σ movements | PASS |
| T02 | Multiple accounts reconstruction: rebuilds all tenant accounts | PASS |
| T03 | Multi-movement balance accuracy: net inflows/outflows sum correctly | PASS |
| T04 | Valuation rate preservation: USD/VND conversion preserved through rebuild | PASS |
| T05 | Tenant isolation: Tenant A rebuild does not touch Tenant B data | PASS |
| T06 | History immutable: `finance_cash_movements` untouched by reconstruction | PASS |
| T07 | Empty fallback: 0 movements → 0 position balance | PASS |
| T08 | Permission check (fail-closed): unauthorized caller throws | PASS |
| T09 | Reconstruction determinism: Snapshot A === Snapshot B | PASS |
| T10 | Idempotent reconstruction: repeated runs produce same result | PASS |
| T11 | Corrupted position recovery: manual position corruption corrected | PASS |
| T12 | No mutation escape: attempts to write movements during reconstruction fail | PASS |
| T13 | Database tenant boundary: mismatched bank account rejected | PASS |
| T14-A | Reconstruction privilege scope: transient GUC reset after commit | PASS |
| T14-B | Reconstruction failure rollback: verified atomic transaction rollback | PASS |
| T15 | Privilege escalation: direct GUC bypass by unauthorized role rejected | PASS |
| T16 | Direct GUC injection: `SET finance.allow_position_reconstruction` by app blocked | PASS |
| T17 | Cross-tenant reconstruction attempt: RPC requires authorised role | PASS |

---

## Suite 5 — F2.5 Concurrency & Security Hardening (10/10 PASS)

**File:** `src/platform/finance/__tests__/finance-f2-concurrency.test.ts`

**Scope:** Bank account lock protocol, position serialization, deadlock prevention, movement immutability, true multi-connection concurrency.

| Test | Assertion | Invariant | Result |
|---|---|---|---|
| T18 | 10 concurrent projections → correct aggregate balance | F2-I-3, F2-I-8 | PASS |
| T19 | 5 concurrent same-key projections → exactly 1 movement written | F2-I-5 | PASS |
| T20 | Out-of-order projection → balance equals regardless of order | F2-I-3 | PASS |
| T21 | Reconstruction races concurrent projection → no data corruption | F2-I-8, F2-I-9 | PASS |
| T22 | Direct `SET LOCAL` bypass attempt → blocked by `current_user` check | F2-I-10 | PASS |
| T23 | TRUE multi-connection concurrency via independent Supabase clients | F2-I-8 | PASS |
| T24 | Multi-account `ORDER BY id ASC` → no deadlock under concurrent reconstruction | F2-I-9 | PASS |
| T25 | Direct `UPDATE`/`DELETE` on movements → blocked by trigger unconditionally | F2-I-2 | PASS |
| T26 | Mutation path lock coverage: all projection writes acquire bank account lock | F2-I-8 | PASS |
| T27 | `cash_positions.balance_minor == Σ cash_movements` after concurrent projections | F2-I-3 | PASS |

---

## Regression Bugs Caught During F2.5 Verification

### Bug 1 — `reconstructed_accounts_count` always `0`

- **File:** `src/platform/finance/engines/cash-engine/cash-engine.service.ts:546`
- **Root Cause:** Service checked `'reconstructed_accounts_count' in data` but RPC returns `reconstructed_count`
- **Impact:** Reconstruction appeared to succeed with 0 accounts rebuilt (silent failure)
- **Fix:** Read `reconstructed_count` from RPC response
- **Tests Fixed:** T01, T02 (F2.4 suite)

### Bug 2 — Duplicate leg reference silently accepted as idempotent duplicate

- **File:** `supabase/migrations/20260816040000_finance_cash_concurrency_locks.sql` — `finance_internal_record_cash_movement` exception handler
- **Root Cause:** `EXCEPTION WHEN unique_violation` returned `is_duplicate: true` for ALL unique constraint violations, including violations on `uq_finance_cash_movements_leg` (the leg reference uniqueness constraint)
- **Impact:** A different idempotency key projecting the same F1 leg reference would be silently accepted as a duplicate, masking an architectural integrity violation. The projection worker would not quarantine the event.
- **Architectural Significance:** This is the most dangerous class of bug — an integrity violation disguised as normal operation. The quarantine path (F2-I-11) would have been bypassed entirely.
- **Fix:** After catching `unique_violation`, re-query by `idempotency_key`. If found: safe idempotent → return `is_duplicate: true`. If not found: leg-reference violation → raise `DUPLICATE_CASH_LEG_REFERENCE` (errcode `F2030`), which `isPgTerminalError()` classifies as terminal → quarantine.
- **Tests Fixed:** T06 (F2.1 RLS suite), T06 (F2.2 projection worker suite)

---

## Architectural Sign-Off

```
F2 FINAL FREEZE APPROVED
─────────────────────────
Evidence: 79/79 integration tests PASS
Reviewer: Human Architect

22 Architecture Gates: ALL PASS
12 Invariants: ALL ENFORCED at DB layer
2 Regression bugs: FOUND and FIXED before freeze

F2 Cash & Treasury Engine is a stable frozen kernel.
F3 AR/Invoicing may begin Pre-Coding Architecture Analysis.
```
