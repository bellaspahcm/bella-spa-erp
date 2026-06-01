---
title: 'Harden Update Salary Config Audit Rollback'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'edf0cdb1327eb89769984c13f553549e48d92975'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `updateSalaryConfig` currently calls the central salary recalculation engine before writing the audit log. If `recordAuditLog` fails after `salary_records` has been updated or inserted, the admin sees a failure but the salary state may already have changed without an audit trail.

**Approach:** Snapshot the current-month `salary_records` row before recalculation, keep using `recalculateAndSaveSalaryRecord` for the actual salary mutation, and restore the snapshot if audit logging fails. Return explicit failure details and skip revalidation when the mutation cannot be audited.

## Boundaries & Constraints

**Always:** Keep all salary calculations inside the existing salary recalculation engine. Use generated Supabase database types for salary record snapshot and restore payloads. Return explicit failure status for snapshot, recalculation, audit, and rollback errors. Preserve month-lock and tenant checks before mutation.

**Ask First:** Any move to true database transactions, RPCs, schema changes, or a wider salary workflow refactor.

**Never:** Do not hand-roll salary totals, session multiplier logic, KPI sync, or draft/non-draft preservation outside the central engine. Do not touch `confirmKtvSessions` in this slice. Do not swallow audit or rollback errors.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Existing salary row, audit succeeds | Current-month `salary_records` exists | Snapshot row, recalculate through engine, record audit with old/new data, revalidate salary page, return success | N/A |
| Existing salary row, audit fails | Recalculate succeeds, `recordAuditLog` throws | Restore previous row by `id`, return `success: false`, do not revalidate | Include audit error; include rollback error if restore also fails |
| No previous salary row, audit fails | Recalculate creates a row, `recordAuditLog` throws | Delete current-month generated row for same KTV/month/tenant, return `success: false`, do not revalidate | Include audit error; include delete rollback error if delete fails |
| Recalculation fails | Snapshot succeeds, engine throws before audited success | Return `success: false`, do not audit or revalidate | Surface engine error; no compensating restore unless audit failure path is reached |

</frozen-after-approval>

## Code Map

- `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Server action containing `updateSalaryConfig`; add snapshot/restore helpers and audit failure compensation.
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts` -- Central salary calculation/write path that must remain the only salary calculation source.
- `src/modules/hr-salary/actions/admin-salary-workflow-helpers.ts` -- Existing month-lock and revalidation helpers used by the action.
- `src/__tests__/admin-salary-actions.test.ts` -- New focused test coverage for audit success, audit rollback, rollback failure reporting, and recalc failure behavior.
- `src/__tests__/state-machine.test.ts` -- Existing regression coverage for locked-month blocking of `updateSalaryConfig`.
- `docs/DEVELOPMENT_LOG.md` -- Add dated maintenance entry for this hardening slice.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Add typed salary row snapshot and restore helpers -- prevents unaudited salary mutations while preserving central engine behavior.
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Wrap only the audit step with compensating restore logic -- makes audit failure explicit and skips stale page revalidation.
- [x] `src/__tests__/admin-salary-actions.test.ts` -- Add focused side-effect tests for snapshot, restore update/delete, rollback failure reporting, and recalc failure -- locks the side-effect contract.
- [x] `docs/DEVELOPMENT_LOG.md` -- Record objective, changes, and verification -- keeps the refactor trail searchable.

**Acceptance Criteria:**
- Given an existing salary record and successful audit, when `updateSalaryConfig` runs, then it snapshots the old row, recalculates through the engine, records audit old/new data, revalidates `/dashboard/salary`, and returns success.
- Given an existing salary record and audit failure, when `updateSalaryConfig` runs, then it restores the old `salary_records` row and returns failure without revalidation.
- Given no previous salary record and audit failure, when `updateSalaryConfig` runs, then it deletes the generated current-month salary record for that KTV/month/tenant and returns failure without revalidation.
- Given rollback itself fails, when audit fails, then the returned error includes both the audit failure and the rollback failure.
- Given the salary engine fails, when `updateSalaryConfig` runs, then it returns explicit failure and does not attempt audit or rollback.

## Spec Change Log

## Design Notes

This slice uses compensating writes because the current action stack does not expose a transaction wrapper across salary recalculation and audit logging. The restore path stores the previous DB row as a typed salary record payload and writes it back by primary key; if the row did not exist before the recalculation, rollback deletes the generated row scoped by KTV, month, and tenant.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/__tests__/admin-salary-actions.test.ts` -- pass.

**Suggested Review Order:**
- `src/modules/hr-salary/actions/admin-salary-actions.ts:75` -- snapshot helper for current-month salary row.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:94` -- restore helper for previous row or generated-row delete.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:393` -- `updateSalaryConfig` snapshot before recalculation.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:406` -- audit failure rollback branch.
- `src/__tests__/admin-salary-actions.test.ts:150` -- focused side-effect test suite.
