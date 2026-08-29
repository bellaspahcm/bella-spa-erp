---
title: 'F5.6 Cash + Prepayment Reconciliation'
type: 'feature'
created: '2026-08-29'
status: 'done'
baseline_commit: '64720f98f714513b3850777352dfef06debb79dc'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/architecture/KERNELS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Finance M1 is now verified/frozen, but F5.6 Cash + Prepayment reconciliation remains closed. Finance OS needs a narrow F5.6 vertical slice that reconstructs positions through approved contracts, compares them to GL, and records F5 evidence without changing upstream semantics.

**Approach:** Implement F5.6 as additive database work plus integration tests. Cash uses F2_CASH:v1 and F2_OPENING:v1 with effective_date temporal semantics; Prepayment uses the existing F4_PREPAYMENT:v1 read/reconstruction contract without redefining accounting meaning.

## Boundaries & Constraints

**Always:** F5 must reconstruct, compare, reconcile, and emit evidence only. Cash must read through `finance_get_cash_movements_as_of` and `finance_cash_opening_balance_as_of`; GL comparison must use approved F5/F1 read-contract patterns. All comparisons are tenant scoped, as_of scoped, deterministic, append-only, and must create cases for VARIANCE. Migration work must be additive and must not edit historical migrations.

**Ask First:** Any need to reinterpret Prepayment accounting semantics, change account mapping, replace F4_PREPAYMENT:v1, seed or backfill opening balances, or modify F1/F2/F4 authoritative tables requires human approval before continuing.

**Never:** Do not open new balance domains. Do not change F2 effective_date. Do not change producer/outbox semantics. Do not mutate F1/F2/F3/F4 facts from F5. Do not bypass approved read contracts. Do not treat a missing opening baseline as a verified zero balance. Do not implement TT99 beyond the approved reconciliation scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Cash deterministic reconstruction | Verified baseline plus cash movements before/at/after as_of | Position = baseline + movements after baseline and <= as_of, ordered deterministically | Unknown contract version or missing as_of raises existing F5/F2 contract errors |
| Cash GL matched | F2 cash position equals GL debit-normal position for cash accounts | `CASH_GL_BALANCE` result is MATCHED, no case opened | None |
| Cash GL mismatch | F2 cash position differs from GL | `CASH_GL_BALANCE` result is VARIANCE and opens case | Records variance amount and evidence hash |
| Missing cash baseline | No F2 opening baseline exists for account/as_of | QUARANTINED or equivalent non-MATCHED state; never false zero | Evidence states missing baseline |
| Prepayment existing contract | Existing F4_PREPAYMENT:v1 facts and reconstruction are available | `PREPAYMENT_GL_BALANCE` uses current contract behavior only | If semantic mismatch is found, halt rather than redefining |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260824050000_f2_fix_cash_contract.sql` -- F2 cash movements read contract with `cash_effective_date`, account context, and F1 lineage.
- `supabase/migrations/20260824060000_f2_opening_balance_contract.sql` -- F2 opening balance contract and baseline_found signal.
- `supabase/migrations/20260823010000_f5_ar_reconciliation_fix.sql` -- Current active `f5_run_reconciliation` shape for AP/AR and evidence insertion style.
- `supabase/migrations/20260820010000_f5_prepayment_reconciliation.sql` -- Existing F4_PREPAYMENT:v1 read/reconstruction contract and legacy PREPAYMENT branch history.
- `src/__tests__/f5-reconciliation.integration.test.ts` -- AP reconciliation regression pattern.
- `src/__tests__/f5-ar-reconciliation.integration.test.ts` -- AR reconciliation regression pattern.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260824070000_f2_bank_account_gl_map_contract.sql` -- add approved read-only `F2_BANK_ACCOUNT_GL_MAP:v1` contract without modifying `F2_CASH:v1` or `F2_OPENING:v1`.
- [x] `supabase/migrations/20260824071000_f5_6_cash_reconciliation.sql` -- add F5.6 `CASH_GL_BALANCE`; keep `PREPAYMENT_GL_BALANCE` gated pending separate semantic/account-mapping authority.
- [x] `supabase/migrations/20260824072000_f5_6_cash_reconciliation_review_patch.sql` -- additive review patch for domain/control pairing, ambiguous bank-to-GL mapping quarantine, and baseline currency mismatch quarantine.
- [x] `src/__tests__/f5-6-cash-prepayment-reconciliation.integration.test.ts` -- cover cash reconstruction, cash matched/mismatch, missing baseline, prepayment gate, domain/control mismatch, ambiguous mapping quarantine, and idempotent/evidence behavior.
**Acceptance Criteria:**
- Given a verified F2 opening baseline and cash movements, when F5.6 reconstructs as_of, then the cash position uses baseline + movements with the exclusive/inclusive temporal boundary defined by F2 contracts.
- Given cash position equals GL, when `f5_run_reconciliation` runs `CASH_GL_BALANCE`, then the result is MATCHED and no case is opened.
- Given cash position differs from GL, when `CASH_GL_BALANCE` runs, then the result is VARIANCE with case/evidence.
- Given no opening baseline exists, when cash reconciliation runs, then it does not report MATCHED from implicit zero.
- Given existing Prepayment contract facts, when `PREPAYMENT_GL_BALANCE` runs, then F5.6 consumes the approved contract only and does not redefine semantic meaning.

## Spec Change Log

## Design Notes

This is a vertical slice, not a Finance OS redesign. Cash is the primary newly unblocked scope after M1. Prepayment implementation may only proceed if existing F4_PREPAYMENT:v1 behavior is sufficient; otherwise implementation must stop at the human approval boundary.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/f5-6-cash-prepayment-reconciliation.integration.test.ts --runInBand` -- PASS: 7/7.
- `npm.cmd test -- src/platform/finance/__tests__/finance-f2-bank-account-gl-map-contract.test.ts --runInBand` -- PASS: 4/4.
- `npm.cmd test -- src/platform/finance/__tests__/finance-f1-ledger-verification.test.ts src/platform/finance/__tests__/finance-f1-concurrency.test.ts --runInBand` -- PASS: 27/27.
- `npm.cmd test -- src/platform/finance/__tests__/finance-f2-reporting-api.test.ts src/platform/finance/__tests__/finance-f2-reconstruction.test.ts src/platform/finance/__tests__/finance-f2-concurrency.test.ts --runInBand` -- PASS: 40/40.
- `npm.cmd test -- src/__tests__/f5-reconciliation.integration.test.ts --runInBand -t "approved read contracts|reconstructs outstanding AP|runs reconciliation|case lifecycle|RLS and tenant isolation|immutability guard|false confidence|concurrent reconciliation"` -- PASS: 8 passed / 5 skipped.
- `npm.cmd test -- src/__tests__/f5-ar-reconciliation.integration.test.ts --runInBand` -- PASS: 8/8.
## Suggested Review Order

**Entry Point**

- Start at the additive review patch that defines final runtime behavior.
  [`20260824072000_f5_6_cash_reconciliation_review_patch.sql:7`](../../supabase/migrations/20260824072000_f5_6_cash_reconciliation_review_patch.sql#L7)

**Contract Boundary**

- Approved F2 read contract exposes only bank-account to GL mapping.
  [`20260824070000_f2_bank_account_gl_map_contract.sql:7`](../../supabase/migrations/20260824070000_f2_bank_account_gl_map_contract.sql#L7)

- Contract tests prove deterministic mapping, tenant scope, and version guard.
  [`finance-f2-bank-account-gl-map-contract.test.ts:25`](../../src/platform/finance/__tests__/finance-f2-bank-account-gl-map-contract.test.ts#L25)

**Cash Reconciliation**

- Cash reconstruction consumes F2 contracts and quarantines unsafe baseline currency.
  [`20260824072000_f5_6_cash_reconciliation_review_patch.sql:80`](../../supabase/migrations/20260824072000_f5_6_cash_reconciliation_review_patch.sql#L80)

- Domain/control pairing rejects cross-domain reconciliation calls.
  [`20260824072000_f5_6_cash_reconciliation_review_patch.sql:184`](../../supabase/migrations/20260824072000_f5_6_cash_reconciliation_review_patch.sql#L184)

- Ambiguous bank-to-GL mappings quarantine instead of producing false evidence.
  [`20260824072000_f5_6_cash_reconciliation_review_patch.sql:356`](../../supabase/migrations/20260824072000_f5_6_cash_reconciliation_review_patch.sql#L356)

**Evidence Tests**

- Cash suite covers match, variance, missing baseline, duplicate replay, and gates.
  [`f5-6-cash-prepayment-reconciliation.integration.test.ts:20`](../../src/__tests__/f5-6-cash-prepayment-reconciliation.integration.test.ts#L20)

- Ambiguous mapping test proves conservative quarantine behavior.
  [`f5-6-cash-prepayment-reconciliation.integration.test.ts:223`](../../src/__tests__/f5-6-cash-prepayment-reconciliation.integration.test.ts#L223)

- Duplicate replay test proves idempotent evidence behavior.
  [`f5-6-cash-prepayment-reconciliation.integration.test.ts:248`](../../src/__tests__/f5-6-cash-prepayment-reconciliation.integration.test.ts#L248)