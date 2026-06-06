---
title: 'Standardize Salary Attendance Components'
type: 'refactor'
created: '2026-06-06'
status: 'done'
baseline_commit: 'a65f446815b8bb2dce3008913d2aa3a52a74c6ce'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
  - '{project-root}/docs/implementation-artifacts/spec-refactor-shared-business-rule-engines.md'
---

## Intent

**Problem:** Draft salary display and saved salary recalculation both needed the same live attendance formula: actual work days, pro-rata base salary, and automatic late/absent deductions. The formulas were aligned, but still duplicated across the query layer and recalculation engine, making future attendance or penalty changes risky.

**Approach:** Add one live attendance salary component helper and route both `getSalaryData` and `recalculateAndSaveSalaryRecordEngine` through it. Keep the existing source of truth for late/absent counts from the leaderboard RPC and keep existing non-draft salary preservation rules unchanged.

## Boundaries & Constraints

**Always:** preserve non-draft salary records; keep KPI, session multiplier, rating bonus, advances, and total salary rules unchanged; use shared attendance business rules for workdays, pro-rata salary, and penalties.

**Ask First:** changing late/absent source of truth; adding new penalty categories; changing attendance statuses; changing salary close/publish/approval lifecycle.

**Never:** let UI display salary use a different attendance formula from the save/recalculation engine; overwrite manual/non-draft salary values without explicit overrides.

## I/O & Edge-Case Matrix

| Scenario | Expected Behavior |
|----------|-------------------|
| Draft salary with present, late, half-day, absent logs | Work days, base salary, and deductions come from the shared helper. |
| Saved non-draft salary record exists | Existing saved financial values remain the source of truth. |
| Late/absent counts exist from leaderboard RPC | Automatic deduction uses tenant penalty config and the shared helper. |
| No attendance logs | Actual days are 0 and draft base salary is 0. |

## Code Map

- `src/modules/hr-salary/actions/salary-attendance-calculation.ts` -- shared salary attendance component helper.
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts` -- saved salary recalculation uses the helper for draft/live values.
- `src/modules/hr-salary/actions/query-salary-actions.ts` -- salary table display uses the same helper.
- `src/__tests__/business-rule-engines.test.ts` -- regression coverage for the helper.

## Tasks & Acceptance

**Execution:**
- [x] Add `calculateLiveAttendanceSalaryComponents`.
- [x] Refactor saved salary recalculation to use the helper.
- [x] Refactor salary display query to use the helper.
- [x] Add focused regression coverage for attendance salary components.

**Acceptance Criteria:**
- Given 2.5 actual work days on a 5.2M base salary, draft base salary remains 500,000 VND.
- Given 1 late day and 1 absent day, automatic deduction remains 250,000 VND with default tenant penalty config.
- Given a non-draft salary record exists, saved values are still preserved by the existing status logic.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/business-rule-engines.test.ts --runInBand` -- expected: shared rule tests pass.
- `npm.cmd test -- src/__tests__/query-salary-actions.test.ts src/__tests__/salary.test.ts src/__tests__/salary-reconciliation.test.ts src/__tests__/salary-reconciliation-summary.test.ts --runInBand` -- expected: focused salary tests pass.
- `npm.cmd run lint` -- expected: no new lint errors.
- `npm.cmd run build` -- expected: production build passes.

## Notes

`admin-salary-actions.test.ts` currently has unrelated scripted mock ordering failures in finalize/approve salary paths. This refactor does not touch that file or those action flows.
