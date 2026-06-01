---
title: 'Harden Approve Salary Audit Rollback'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'aa5d2003'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `approveSalary` recalculates the salary row to `approved`, then fetches the row id, creates a salary expense, and writes audit data. If any later step fails, the system can retain an approved salary row or generated expense without a complete audit trail.

**Approach:** Snapshot the current-month salary row before approval, require the current user's tenant for all approval fetches, and restore/delete completed side effects when record fetch, expense creation, or audit logging fails.

## Boundaries & Constraints

**Always:** Preserve month-lock checks. Keep salary calculation inside `recalculateAndSaveSalaryRecord`. Keep expense creation through `createSalaryExpense`. Use generated Supabase database types through the existing salary snapshot/restore helpers. Return explicit failures and include rollback failures in the response.

**Ask First:** Any schema change, database transaction/RPC rewrite, or broad salary lifecycle/status redesign.

**Never:** Do not hand-roll salary totals, package multipliers, KPI sync, or draft/non-draft preservation. Do not alter `finalizeSalaryRecord` behavior in this slice. Do not return success if approval cannot be audited.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Happy path | Current user has tenant, KTV belongs to tenant, salary approval succeeds | Snapshot salary, approve through engine, fetch approved row id, create salary expense, audit, revalidate approved salary views, return success | N/A |
| KTV fetch fails | User lookup by KTV id and tenant fails | Return failure before mutation | Surface query error, no audit/revalidate |
| Updated record fetch fails | Approval recalculation succeeds but salary row id fetch fails | Restore previous salary snapshot, return failure | Include fetch and rollback errors |
| Expense creation fails | Approval recalculation and id fetch succeed, expense insert/period guard fails | Restore previous salary snapshot, return failure | Include expense and rollback errors |
| Audit fails | Approval and expense succeeded, audit throws | Delete generated salary expense, restore previous salary snapshot, return failure | Include audit and rollback errors |

</frozen-after-approval>

## Code Map

- `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Contains `approveSalary`; add tenant scoping, salary snapshot, expense delete, and rollback branches.
- `src/__tests__/admin-salary-actions.test.ts` -- Add side-effect assertions for approval success and failure compensation.
- `docs/DEVELOPMENT_LOG.md` -- Record this hardening slice and verification.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Require current-user tenant before KTV fetch and scope KTV/approved-row queries by tenant.
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Snapshot current salary row before approval and restore/delete on downstream failure.
- [x] `src/__tests__/admin-salary-actions.test.ts` -- Assert approval side effects and rollback behavior for record fetch, expense, and audit failures.
- [x] `docs/DEVELOPMENT_LOG.md` -- Add dated development log entry.

**Acceptance Criteria:**
- Given approval succeeds end to end, when `approveSalary` runs, then it recalculates through the central engine, creates salary expense, audits, revalidates approved views, and returns success.
- Given approved-row id fetch fails after recalculation, when `approveSalary` runs, then it restores the prior salary row and returns failure without expense/audit/revalidation.
- Given expense creation fails after recalculation, when `approveSalary` runs, then it restores the prior salary row and returns failure without audit/revalidation.
- Given audit fails after expense creation, when `approveSalary` runs, then it deletes the generated salary expense, restores the prior salary row, and returns failure without revalidation.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/__tests__/admin-salary-actions.test.ts` -- pass.

**Suggested Review Order:**
- `src/modules/hr-salary/actions/admin-salary-actions.ts:667` -- hardened `approveSalary` flow.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:719` -- approved-row fetch rollback branch.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:757` -- expense/audit compensation branches.
- `src/__tests__/admin-salary-actions.test.ts:911` -- focused approve salary rollback tests.
