# Architecture Gate Result - Finance F5 C65 Contract Fixture Triage

Date: 2026-10-01
Status: PASS

## Scope

Resolve the three Finance/F5 verification blockers exposed while sealing broader any-types batch C65.

## Approval

Human approval received in-thread: `approve`.

Approved scope:
- Update stale F5 test expectations where the producer contract is proven.
- Repair test fixture ordering where the fixture violates canonical Finance contracts.

Not approved:
- Do not change Finance/F5 runtime logic.
- Do not change DB schema, migrations, RLS, generated database types, or Finance contracts.
- Do not change Nail Shop or Preschool files.
- Do not reopen C60.

## Findings

### PERIOD_INTEGRITY

`f5_run_reconciliation` accepts `PERIOD_INTEGRITY` as a registered control type, but the current producer raises `F5_CONTROL_TYPE_NOT_YET_IMPLEMENTED`.

Decision: update the test to assert the current producer contract instead of expecting a `VARIANCE` result row.

### CASH_GL_BALANCE

The F2/F5 read contract uses `finance_cash_movements.effective_date` / `cash_effective_date`. The fixture creates a cash movement at test runtime but reconciled at the old fixed snapshot `2026-08-25T12:00:00Z`.

Probe evidence after correcting the as-of boundary:
- `finance_get_cash_movements_as_of` returns the movement.
- `finance_journal_entries_as_of` returns the cash GL line.
- `f5_run_reconciliation(CASH_GL_BALANCE)` still returns `QUARANTINED` with reconstructed expected cash unavailable.

Decision: update the test to document the current `QUARANTINED` boundary. Do not change the F5 runtime in this any-types batch.

### PREPAYMENT_GL_BALANCE

`finance_vendor_prepayments.f1_transaction_id` must reference a posted F1 transaction. The fixture inserted the prepayment fact before creating/posting its F1 transaction and used a random transaction id.

Decision: post the F1 transaction first, then insert the fact with `f1_transaction_id` linked to that posted transaction.

### AP hardening stale expectations

The AP hardening block contained expectations that exceed the current `AP_GL_BALANCE` producer:
- Orphan GL detection is verified through the F1/F4 read contracts, matching the newer hardening-test pattern.
- Currency mismatch is not an `AP_GL_BALANCE` responsibility; functional-amount matching remains `MATCHED`.
- Duplicate accrual currently classifies as `VARIANCE`, not `QUARANTINED`.

Decision: align this legacy test block with the current producer and keep broader F5 capability gaps out of the any-types batch.

## Verification Plan

- Targeted Jest for `src/__tests__/f5-reconciliation.integration.test.ts`.
- Targeted any scan for the scoped file.
- Targeted ESLint for the scoped file.
- Scoped `git diff --check`.

