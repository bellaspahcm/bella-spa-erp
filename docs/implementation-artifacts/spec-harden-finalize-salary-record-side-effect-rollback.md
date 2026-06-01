---
title: 'Harden Finalize Salary Record Side Effect Rollback'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '92dc1e4e'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `finalizeSalaryRecord` changes the salary row, confirms completed sessions, creates a salary expense, and writes audit data in sequence. If a later side effect fails, the action can leave a finalized salary or confirmed sessions without the matching expense/audit trail.

**Approach:** Snapshot the mutable finalization state before changes, apply the existing finalization steps, and compensate completed side effects when session update, expense creation, or audit logging fails. Return explicit failures and do not revalidate on failed finalization.

## Boundaries & Constraints

**Always:** Preserve tenant and month-lock checks. Use generated Supabase payload types for salary/session restores. Keep expense creation through `createSalaryExpense`. Include rollback failures in the returned error message.

**Ask First:** Any schema change, database RPC/transaction rewrite, or broad salary status lifecycle redesign.

**Never:** Do not recalculate salary totals, change package/session multiplier logic, alter `approveSalary`, or return success when finalization cannot be audited.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Happy path | Confirmed salary row and completed sessions exist | Finalize salary, confirm sessions, create salary expense, write audit, revalidate salary/finance, return success | N/A |
| Fetch/snapshot fails | Salary row or session snapshot query fails | Return failure before mutation | Surface query error, no audit/revalidate |
| Session update fails | Salary row finalized, session update returns error | Restore salary finalization fields and session confirmation snapshot, return failure | Include rollback failures if any |
| Expense creation fails | Salary and session updates succeeded, expense insert/period guard fails | Restore sessions and salary finalization fields, return failure | Include rollback failures if any |
| Audit fails | Salary, sessions, and expense succeeded, audit throws | Delete generated salary expense, restore sessions and salary finalization fields, return failure | Include rollback failures if any |

</frozen-after-approval>

## Code Map

- `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Contains `finalizeSalaryRecord`; add finalization snapshots and compensation helpers.
- `src/__tests__/admin-salary-actions.test.ts` -- Add side-effect assertions for finalization success and rollback branches.
- `docs/DEVELOPMENT_LOG.md` -- Record the hardening slice and verification commands.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Snapshot salary finalization fields and completed-session confirmation states before mutation.
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Roll back salary/session/expense side effects when downstream finalization steps fail.
- [x] `src/__tests__/admin-salary-actions.test.ts` -- Assert finalization side effects and rollback behavior for session, expense, and audit failures.
- [x] `docs/DEVELOPMENT_LOG.md` -- Add dated development log entry.

**Acceptance Criteria:**
- Given a confirmed salary row, when finalization succeeds, then salary status, sessions, expense insertion, audit, and revalidation all occur.
- Given session update fails after salary update, when finalization runs, then salary finalization fields are restored and no expense/audit/revalidation occurs.
- Given expense creation fails after salary/session updates, when finalization runs, then sessions and salary finalization fields are restored and no audit/revalidation occurs.
- Given audit fails after expense creation, when finalization runs, then the generated salary expense is deleted, sessions and salary finalization fields are restored, and no revalidation occurs.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/__tests__/admin-salary-actions.test.ts` -- pass.

**Suggested Review Order:**
- `src/modules/hr-salary/actions/admin-salary-actions.ts:208` -- finalization rollback helpers for salary/session/expense side effects.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:505` -- hardened `finalizeSalaryRecord` sequence.
- `src/__tests__/admin-salary-actions.test.ts:687` -- focused finalization side-effect rollback tests.
