---
title: 'Batch Harden Salary Query and Clean Dirty Typing'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'd8dffe70'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The remaining dirty worktree contains small typing cleanups, while `getSalaryData` still has database query paths that can fail and then return `[]`, making data failures look like a valid empty salary page.

**Approach:** Batch the related cleanup instead of one function at a time: harden `getSalaryData` query error handling, finish the existing no-`any` cleanup in promotions and accounting reports, and verify all affected files together.

## Boundaries & Constraints

**Always:** Preserve salary calculation behavior, package session multipliers, KPI source of truth, and draft/non-draft display semantics. Surface database query failures explicitly. Keep existing UI behavior for promotions except safer typing.

**Ask First:** Any schema change, UI redesign, salary formula change, or broad repo-wide `any` cleanup.

**Never:** Do not commit Supabase temp files, local Claude settings, generated report HTML, or unrelated dirty files. Do not silently return empty salary data on DB failure.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Salary query happy path | Tenant, KTV, records, sessions, leaderboard, attendance, packages load | Return salary rows with existing computed fields | N/A |
| Salary query DB failure | Any required salary query returns Supabase error | Throw explicit query error | Do not return `[]` |
| Missing tenant | Current user lacks `tenant_id` | Throw explicit missing tenant error | Do not query DB |
| Dirty typing cleanup | Promotions/accounting dirty files contain `any` casts | Replace with local typed interfaces/casts | No behavior change |

</frozen-after-approval>

## Code Map

- `src/modules/hr-salary/actions/query-salary-actions.ts` -- Harden `getSalaryData` query failures and tenant filters.
- `src/__tests__/query-salary-actions.test.ts` -- Extend focused salary query tests for success and failure propagation.
- `src/app/dashboard/settings/components/PromotionsTab.tsx` -- Existing dirty UI typing cleanup; keep behavior stable.
- `src/services/accounting/reports.ts` -- Existing dirty salary reconciliation RPC typing cleanup.
- `docs/DEVELOPMENT_LOG.md` -- Record the batch and verification.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/hr-salary/actions/query-salary-actions.ts` -- Check required query errors in `getSalaryData` and rethrow failures.
- [x] `src/__tests__/query-salary-actions.test.ts` -- Cover salary query success and failure cases.
- [x] `src/app/dashboard/settings/components/PromotionsTab.tsx` -- Keep no-`any` promotion state/catch cleanup.
- [x] `src/services/accounting/reports.ts` -- Replace repeated RPC `as any` casts with typed local helper types.
- [x] `docs/DEVELOPMENT_LOG.md` -- Add dated batch entry.

**Acceptance Criteria:**
- Given a salary DB query fails, when `getSalaryData` runs, then the caller receives an explicit error instead of `[]`.
- Given all salary inputs load, when `getSalaryData` runs, then salary rows still compute package-adjusted sessions and totals.
- Given promotions UI catches non-Error values, then toast text remains safe and readable.
- Given salary reconciliation RPC is called, then no `as any` cast is needed for the RPC invocation.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/query-salary-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/modules/hr-salary/actions/query-salary-actions.ts src/__tests__/query-salary-actions.test.ts src/app/dashboard/settings/components/PromotionsTab.tsx src/services/accounting/reports.ts` -- pass.

**Suggested Review Order:**
- `src/modules/hr-salary/actions/query-salary-actions.ts:91` -- `getSalaryData` now surfaces missing tenant and query failures.
- `src/modules/hr-salary/actions/query-salary-actions.ts:113` -- salary query tenant filters and error checks.
- `src/__tests__/query-salary-actions.test.ts:92` -- salary query success/failure tests.
- `src/app/dashboard/settings/components/PromotionsTab.tsx:8` -- promotion UI typing cleanup.
- `src/services/accounting/reports.ts:6` -- typed salary reconciliation RPC helper.
