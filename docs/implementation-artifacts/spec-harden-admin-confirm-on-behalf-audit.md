---
title: 'Harden Admin Confirm On Behalf Audit'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'c4a2006eec0bdc9c1b8490452d65037ff86076f1'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `adminConfirmOnBehalf` directly updates salary confirmation fields without writing an audit log and without detecting when no eligible salary record was actually changed. This can hide no-op operator actions and leave confirmation-by-admin changes without traceability.

**Approach:** Require tenant context, snapshot the eligible current-month salary record before updating, fail explicitly if no `published`/`disputed` record exists, write an audit log after update, and rollback the changed fields if audit logging fails.

## Boundaries & Constraints

**Always:** Preserve month-lock behavior. Only confirm records currently in `published` or `disputed` status. Use generated Supabase database types for salary update payloads. Return explicit failure for missing tenant, target fetch error, no eligible record, update failure, audit failure, and rollback failure.

**Ask First:** Any schema/RPC transaction change, any change to salary status lifecycle, or any UI redesign.

**Never:** Do not recalculate salary in this action. Do not confirm draft/pending/finalized records. Do not silently log audit or rollback errors and return success.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Eligible record, audit succeeds | Current-month salary row is `published` or `disputed` | Snapshot row, update status to `confirmed`, set `confirmed_by_admin`, audit old/new data, revalidate, return success | N/A |
| No eligible record | No current-month row in `published`/`disputed` for KTV/tenant | Return `success: false`, no update, no audit, no revalidation | Explain no eligible salary record was found |
| Update fails | Snapshot succeeds, update returns DB error | Return `success: false`, no audit, no revalidation | Surface update error |
| Audit fails after update | Update succeeds, audit throws | Restore snapshotted fields by row id, return `success: false`, no revalidation | Include audit error and rollback error if restore fails |

</frozen-after-approval>

## Code Map

- `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Contains `adminConfirmOnBehalf`; add typed snapshot/restore and audit rollback.
- `src/__tests__/admin-salary-actions.test.ts` -- Extend focused admin salary tests for confirm-on-behalf success, no-op, update failure, audit rollback, and rollback failure.
- `src/__tests__/state-machine.test.ts` -- Existing locked-month regression should remain green.
- `docs/DEVELOPMENT_LOG.md` -- Add dated maintenance entry for this hardening slice.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Add confirm-on-behalf snapshot/restore helpers -- enables rollback if audit fails.
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Update `adminConfirmOnBehalf` to detect no eligible record and write audit -- prevents silent no-op and unaudited status mutation.
- [x] `src/__tests__/admin-salary-actions.test.ts` -- Add side-effect tests for success, no-op, update failure, audit rollback, and rollback failure -- locks the action contract.
- [x] `docs/DEVELOPMENT_LOG.md` -- Record objective, changes, and verification -- keeps the refactor trail searchable.

**Acceptance Criteria:**
- Given an eligible salary row and successful audit, when `adminConfirmOnBehalf` runs, then it updates the row, records audit old/new data, revalidates salary page, and returns success.
- Given no eligible salary row, when `adminConfirmOnBehalf` runs, then it returns failure without update, audit, or revalidation.
- Given audit fails after update, when `adminConfirmOnBehalf` runs, then it restores the snapshotted status fields and returns failure without revalidation.
- Given rollback fails, when audit fails, then the returned error includes both audit failure and rollback failure.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/__tests__/admin-salary-actions.test.ts` -- pass.

**Suggested Review Order:**
- `src/modules/hr-salary/actions/admin-salary-actions.ts:172` -- eligible salary snapshot helper.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:192` -- audit-failure rollback helper.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:325` -- hardened `adminConfirmOnBehalf` flow.
- `src/__tests__/admin-salary-actions.test.ts:298` -- focused confirm-on-behalf audit/no-op tests.
