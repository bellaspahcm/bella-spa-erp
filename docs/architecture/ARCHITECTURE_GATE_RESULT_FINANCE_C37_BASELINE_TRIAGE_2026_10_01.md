# ARCHITECTURE GATE RESULT - FINANCE C37 BASELINE TRIAGE

Date: 2026-10-01
Status: PASS

## Problem / Non-Goals

C37 changed only Finance test-local catch narrowing:

```text
catch (e: any) -> catch (e: unknown)
```

Targeted Jest then exposed three Finance baseline failures:

```text
finance_void_invoice -> PERIOD_NOT_FOUND
cash movement direct update -> CASH_MOVEMENT_IMMUTABLE
```

Non-goals:

- Do not change Finance runtime SQL/RPC behavior.
- Do not weaken F2/F3 contracts.
- Do not change generated DB types.
- Do not continue broader `any` cleanup.
- Do not touch Preschool dirty state.

## Truth And Source Of Truth

### Void invoice period

Truth:

- `finance_reverse_transaction` posts the reversal into the open accounting
  period covering the reversal target date.
- If no reversal date is supplied, the target date defaults to `NOW()`.

Source of truth:

- `supabase/migrations/20260815011000_finance_reversal_period_fix.sql`
- `supabase/migrations/20260816020000_finance_ledger_emit_v2_events.sql`
- `docs/architecture/F1.3_LEDGER_DOMAIN_SERVICE_DESIGN.md`

Failure classification:

```text
FIXTURE GAP
```

The test seeded only `2026-08`, while `finance_void_invoice` reverses at current
execution time. The fixture must seed an open period covering `NOW()` when no
such period exists.

### Cash movement update error

Truth:

- `finance_cash_movements` is an immutable F2 historical record.
- Direct update/delete is blocked unconditionally.
- Current canonical errors can be either boundary-prohibition or immutability
  errors depending on trigger ordering / applied migration version.

Source of truth:

- `docs/architecture/frozen/F2_INVARIANTS.md`
- `docs/architecture/frozen/F2_FREEZE.md`
- `supabase/migrations/20260816000000_finance_cash_engine_v1.sql`
- `supabase/migrations/20260816040000_finance_cash_concurrency_locks.sql`

Failure classification:

```text
STALE TEST EXPECTATION
```

`CASH_MOVEMENT_IMMUTABLE` is a valid F2 canonical boundary outcome for direct
updates to recorded cash movements.

## Ownership

Owner: Finance OS test harness.

Affected layer: test fixture and assertion only.

## Change Authority

The user authorized Finance contract/baseline triage after C37 stopped. This
authorizes only minimal test fixture/expectation alignment with proven
canonical Finance contracts.

## Minimal Implementation Plan

1. Seed an open accounting period covering `NOW()` in the F3 lifecycle test only
   when the tenant has no such period.
2. Extend the F3 allocation test boundary assertion to accept
   `CASH_MOVEMENT_IMMUTABLE`.
3. Re-run targeted Finance F3 tests.
4. Re-run `check:any-types` for current count.

## Verification Plan

```text
npx jest src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts src/platform/finance/__tests__/finance-f3-payment-allocation.test.ts --runInBand
npx eslint src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts src/platform/finance/__tests__/finance-f3-payment-allocation.test.ts
npm run check:any-types
git diff --check
```
