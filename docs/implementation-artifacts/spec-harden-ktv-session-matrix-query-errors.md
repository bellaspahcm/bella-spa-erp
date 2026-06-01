---
title: 'Harden KTV Session Matrix Query Errors'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '18835521'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `getKtvSessionMatrix` logs `session_logs` query errors and continues with empty data, then catches unexpected failures and returns an empty matrix. A database failure can look like a valid "no sessions" state.

**Approach:** Check every Supabase query error used to build the matrix and throw explicit errors. Preserve the current matrix shape for successful reads, but do not fabricate empty matrix data when a database query fails.

## Boundaries & Constraints

**Always:** Preserve package column generation, KTV row structure, and current confirmation-status logic. Surface query failures from `users`, `salary_records`, `session_logs`, and `packages`. Keep the existing no-store behavior.

**Ask First:** Any UI behavior change, salary confirmation status redesign, package multiplier changes, or changes to `getSalaryData`.

**Never:** Do not swallow database errors, do not return empty matrix on query failure, and do not alter salary calculation or report logic in this slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Happy path | KTVs, salary records, sessions, and packages load | Return matrix with package columns and KTV rows | N/A |
| KTV query fails | `users` select returns error | Throw explicit users query error | No package/session matrix fabrication |
| Session query fails | `session_logs` select returns error | Throw explicit sessions query error | Do not continue with empty sessions |
| Package query fails | `packages` select returns error | Throw explicit packages query error | Do not return partial package names |

</frozen-after-approval>

## Code Map

- `src/modules/hr-salary/actions/query-salary-actions.ts` -- Contains `getKtvSessionMatrix`; add explicit query error checks and rethrow catch behavior.
- `src/__tests__/query-salary-actions.test.ts` -- Add focused tests for matrix success and query failure propagation.
- `docs/DEVELOPMENT_LOG.md` -- Record the hardening slice and verification.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/hr-salary/actions/query-salary-actions.ts` -- Check and throw query errors in `getKtvSessionMatrix`.
- [x] `src/__tests__/query-salary-actions.test.ts` -- Assert successful matrix output and failure propagation for key queries.
- [x] `docs/DEVELOPMENT_LOG.md` -- Add dated development log entry.

**Acceptance Criteria:**
- Given all matrix queries succeed, when `getKtvSessionMatrix` runs, then it returns the same matrix shape with package columns and KTV rows.
- Given the session query fails, when the function runs, then it throws an explicit error and does not continue with empty sessions.
- Given the packages query fails, when the function runs, then it throws an explicit error and does not return partial data.
- Given any handled query fails, then callers/tests see failure instead of `{ ktvs: [], packageNames: [] }`.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/query-salary-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/modules/hr-salary/actions/query-salary-actions.ts src/__tests__/query-salary-actions.test.ts` -- pass.

**Suggested Review Order:**
- `src/modules/hr-salary/actions/query-salary-actions.ts:318` -- query error checks for matrix inputs.
- `src/modules/hr-salary/actions/query-salary-actions.ts:438` -- catch now rethrows instead of fabricating empty matrix.
- `src/__tests__/query-salary-actions.test.ts:97` -- focused matrix success/failure tests.
