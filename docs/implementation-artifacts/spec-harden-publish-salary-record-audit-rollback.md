---
title: 'Harden Publish Salary Record Audit Rollback'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '00cc3c7889180eeaf3aa6b801750d69c1b73b67a'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `publishSalaryRecord` recalculates and saves a salary row with `status: 'published'` before writing the audit log. If audit logging fails after the salary row changes, the system can show a published salary record without a matching audit trail.

**Approach:** Snapshot the current-month salary row before publish, keep publishing through the central salary recalculation engine, and restore the snapshot if status audit logging fails. If no prior row existed and publish created one, delete the generated row on audit failure.

## Boundaries & Constraints

**Always:** Keep salary calculation inside `recalculateAndSaveSalaryRecord`. Preserve tenant and month-lock checks. Use generated Supabase database types through existing salary snapshot/restore helpers. Return explicit failure for snapshot, recalculation, audit, and rollback errors.

**Ask First:** Any transaction/RPC rewrite, schema change, or broader salary workflow status redesign.

**Never:** Do not hand-roll salary totals, session multipliers, KPI sync, or draft/non-draft preservation. Do not touch `finalizeSalaryRecord` in this slice. Do not return success if publish cannot be audited.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Existing row, audit succeeds | Current-month salary row exists | Snapshot row, publish through engine, write status audit, revalidate salary page, return success | N/A |
| Existing row, audit fails | Publish succeeds, audit throws | Restore previous salary row by id, return failure, do not revalidate | Include audit error and rollback error if restore fails |
| No prior row, audit fails | Publish creates a row, audit throws | Delete generated current-month row for KTV/month/tenant, return failure, do not revalidate | Include audit error and delete rollback error if delete fails |
| Recalculation fails | Snapshot succeeds, engine throws | Return explicit failure, do not audit or revalidate | Surface engine error |

</frozen-after-approval>

## Code Map

- `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Contains `publishSalaryRecord`; add audit failure compensation using existing salary snapshot/restore helpers.
- `src/__tests__/admin-salary-actions.test.ts` -- Extend focused tests for publish success, audit rollback, generated-row delete rollback, rollback failure, and recalc failure.
- `src/__tests__/state-machine.test.ts` -- Existing locked-month regression should remain green.
- `docs/DEVELOPMENT_LOG.md` -- Add dated maintenance entry for this hardening slice.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Snapshot current salary row before publishing -- enables rollback if audit fails.
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Wrap status audit with restore/delete compensation -- prevents unaudited published salary state.
- [x] `src/__tests__/admin-salary-actions.test.ts` -- Add side-effect tests for publish audit rollback cases -- locks the action contract.
- [x] `docs/DEVELOPMENT_LOG.md` -- Record objective, changes, and verification -- keeps the refactor trail searchable.

**Acceptance Criteria:**
- Given an existing row and successful audit, when `publishSalaryRecord` runs, then it snapshots, publishes through the engine, audits, revalidates, and returns success.
- Given an existing row and audit failure, when `publishSalaryRecord` runs, then it restores the previous row and returns failure without revalidation.
- Given no previous row and audit failure, when `publishSalaryRecord` runs, then it deletes the generated row and returns failure without revalidation.
- Given rollback fails, when audit fails, then the response includes both audit failure and rollback failure.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/__tests__/admin-salary-actions.test.ts` -- pass.

**Suggested Review Order:**
- `src/modules/hr-salary/actions/admin-salary-actions.ts:245` -- hardened `publishSalaryRecord` flow.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:286` -- audit failure rollback branch.
- `src/__tests__/admin-salary-actions.test.ts:171` -- focused publish audit rollback tests.
