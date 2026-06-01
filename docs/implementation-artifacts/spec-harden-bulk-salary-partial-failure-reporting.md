---
title: 'Harden Bulk Salary Partial Failure Reporting'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'da32b1a5da3908477c4db886c817a13e173fddf9'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `publishAllSalaryRecords` and `finalizeAllSalaryRecords` currently count successes but still return `success: true` even when one or more per-KTV operations fail. They also do not surface query errors from the initial target list fetch, which can hide operational failures in bulk salary workflows.

**Approach:** Make both bulk actions return explicit bulk summaries with total targets, successful count, failed count, and per-KTV failure details. If the initial target-list query fails or any per-record action fails/throws, return `success: false` with a useful error message while preserving completed successful operations.

## Boundaries & Constraints

**Always:** Preserve the existing single-record actions (`publishSalaryRecord`, `finalizeSalaryRecord`) as the source of mutation behavior. Do not rollback successful records in a bulk run. Propagate target-list database errors explicitly. Keep result shape backward-compatible for existing `count` usage.

**Ask First:** Any change from sequential processing to parallel processing, any transaction/RPC rewrite, or any UI redesign beyond showing the returned error detail.

**Never:** Do not swallow per-KTV failures, do not return success when any item failed, and do not change salary calculation, salary expense creation, audit logging, or month-lock semantics in this slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| All targets succeed | KTV list or confirmed salary list has only successful per-record actions | Return `success: true`, `count`, `total`, `failedCount: 0`, empty failures | N/A |
| Some targets fail | One or more per-record actions return failure or throw | Return `success: false`, keep `count` for successes, include `total`, `failedCount`, failure list and summary error | Do not rollback successful records |
| Target-list query fails | Initial `users` or `salary_records` select returns error | Return `success: false`, `count: 0`, `total: 0`, failure summary | Surface query error explicitly |
| No targets | Initial query returns empty array | Return `success: true`, `count: 0`, `total: 0`, `failedCount: 0` | N/A |

</frozen-after-approval>

## Code Map

- `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Contains both bulk salary actions; add bulk summary helpers and query error handling.
- `src/app/dashboard/salary/page.tsx` -- Existing client handlers consume `success` and `count`; show returned error detail and refresh data on partial success.
- `src/__tests__/admin-salary-actions.test.ts` -- Extend focused admin salary action coverage for bulk publish/finalize partial failure summaries.
- `src/__tests__/state-machine.test.ts` -- Existing salary action regression tests should stay green.
- `docs/DEVELOPMENT_LOG.md` -- Add dated maintenance entry for this hardening slice.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Add bulk result/failure helpers and explicit initial-query error checks -- prevents silent DB and per-record failures.
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Update `publishAllSalaryRecords` and `finalizeAllSalaryRecords` to return partial failure summaries -- makes bulk workflow outcomes auditable.
- [x] `src/app/dashboard/salary/page.tsx` -- Display returned bulk error detail and refresh data if a partial run still changed records -- gives operators accurate feedback.
- [x] `src/__tests__/admin-salary-actions.test.ts` -- Add focused tests for bulk success, partial failure, thrown failure, and target-list fetch failure -- locks the side-effect contract.
- [x] `docs/DEVELOPMENT_LOG.md` -- Record objective, changes, and verification -- keeps the refactor trail searchable.

**Acceptance Criteria:**
- Given all publish targets succeed, when `publishAllSalaryRecords` runs, then it returns success with the correct `count`, `total`, `failedCount`, and empty failures.
- Given any publish target fails, when `publishAllSalaryRecords` runs, then it returns failure with successful count preserved and per-KTV failure details.
- Given confirmed salary target fetch fails, when `finalizeAllSalaryRecords` runs, then it returns explicit failure instead of reporting success.
- Given any finalize target throws or returns failure, when `finalizeAllSalaryRecords` runs, then it returns failure with partial summary and does not hide the failed KTV id.

## Spec Change Log

## Design Notes

Bulk actions remain sequential to match the current implementation and avoid introducing concurrency around salary status, expenses, and audit logs. A partial failure is not automatically rolled back because each per-record action already owns its own consistency boundaries and may have created legitimate side effects for successful KTVs.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/app/dashboard/salary/page.tsx src/__tests__/admin-salary-actions.test.ts` -- pass with pre-existing warnings in `page.tsx`.

**Suggested Review Order:**
- `src/modules/hr-salary/actions/admin-salary-actions.ts:180` -- bulk result helper.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:243` -- `publishAllSalaryRecords` failure summary logic.
- `src/modules/hr-salary/actions/admin-salary-actions.ts:372` -- `finalizeAllSalaryRecords` failure summary logic.
- `src/app/dashboard/salary/page.tsx:269` -- publish-all UI error/partial-refresh handling.
- `src/app/dashboard/salary/page.tsx:295` -- finalize-all UI error/partial-refresh handling.
- `src/__tests__/admin-salary-actions.test.ts:416` -- focused bulk partial failure tests.
