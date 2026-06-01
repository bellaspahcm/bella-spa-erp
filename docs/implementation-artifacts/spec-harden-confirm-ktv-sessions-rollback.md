---
title: 'Harden Confirm KTV Sessions Rollback'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '4c6c2ae753b9768fef6badf92149780c676ab849'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `confirmKtvSessions` marks completed `session_logs` as confirmed before saving the related salary recalculation. If salary recalculation fails, session confirmation can remain committed while the salary record is not updated, creating inconsistent payroll state.

**Approach:** Snapshot the current `is_confirmed` values for the sessions targeted by the action, perform the existing confirmation update, then call the central salary recalculation engine. If recalculation fails after session confirmation, restore the snapshotted session states and return an explicit failure.

## Boundaries & Constraints

**Always:** Keep salary calculation inside `recalculateAndSaveSalaryRecord`. Preserve the existing month-lock and tenant checks. Use generated Supabase database types for `session_logs` update payloads. Return explicit failure for snapshot, session update, salary recalculation, and rollback errors.

**Ask First:** Any schema/RPC transaction change, any change to the meaning of `totalSessions`, or any attempt to narrow/widen the existing session selection semantics beyond the current KTV completed-session filter.

**Never:** Do not recalculate salary totals manually. Do not silently log and continue after session confirmation or salary recalculation errors. Do not touch unrelated salary publish/approve/finalize flows in this slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Session confirm and salary recalc succeed | Completed sessions exist for KTV | Snapshot `is_confirmed`, set targeted sessions confirmed, recalculate salary through engine, revalidate salary page, return success | N/A |
| Salary recalc fails after session update | Session update succeeds, engine throws | Restore every snapshotted session row to its previous `is_confirmed` value, return failure, do not revalidate | Include salary error; include rollback errors if any restore write fails |
| Session update fails | Snapshot succeeds, `session_logs.update` returns error | Return failure, do not recalculate salary, do not revalidate | Surface session update error |
| Snapshot fails | `session_logs.select` returns error | Return failure before mutation | Surface snapshot error |

</frozen-after-approval>

## Code Map

- `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Server action containing `confirmKtvSessions`; add typed session confirmation snapshot/restore helpers and recalc rollback path.
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts` -- Central salary calculation/write path that must remain the only salary calculation source.
- `src/__tests__/admin-salary-actions.test.ts` -- Extend focused admin salary action coverage for session confirmation rollback behavior.
- `src/__tests__/state-machine.test.ts` -- Existing locked-month regression coverage for `confirmKtvSessions`.
- `docs/DEVELOPMENT_LOG.md` -- Add dated maintenance entry for this hardening slice.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Add typed snapshot/restore helpers for completed KTV session confirmations -- prevents partial session confirmation when salary save fails.
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Wrap salary recalculation after session update with compensating restore -- returns explicit failure and skips revalidation on inconsistent outcomes.
- [x] `src/__tests__/admin-salary-actions.test.ts` -- Add side-effect tests for success, recalc rollback, rollback failure reporting, and session update failure -- locks the action contract.
- [x] `docs/DEVELOPMENT_LOG.md` -- Record objective, changes, and verification -- keeps the refactor trail searchable.

**Acceptance Criteria:**
- Given session confirmation and salary recalculation succeed, when `confirmKtvSessions` runs, then it confirms completed sessions, calls the central salary engine with `total_sessions`, revalidates `/dashboard/salary`, and returns success.
- Given salary recalculation fails after sessions were confirmed, when `confirmKtvSessions` runs, then it restores each previously snapshotted `is_confirmed` value and returns failure without revalidation.
- Given a session restore write fails, when salary recalculation fails, then the response includes both the salary error and the rollback failure.
- Given session confirmation update fails, when `confirmKtvSessions` runs, then it returns failure without calling the salary engine.

## Spec Change Log

## Design Notes

The action currently has no transaction boundary spanning `session_logs` and `salary_records`. This slice therefore uses a compensating restore scoped to the exact rows snapshotted before the confirmation update. The helper only restores `is_confirmed`, because that is the only field changed by this action.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/__tests__/admin-salary-actions.test.ts` -- pass.

**Suggested Review Order:**
- `src/modules/hr-salary/actions/admin-salary-actions.ts:124` -- snapshot helper for affected completed KTV sessions.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:139` -- restore helper for previous `is_confirmed` values.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:494` -- `confirmKtvSessions` snapshot before confirmation update.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:516` -- salary recalc failure rollback branch.
- `src/__tests__/admin-salary-actions.test.ts:278` -- focused session confirmation rollback suite.
