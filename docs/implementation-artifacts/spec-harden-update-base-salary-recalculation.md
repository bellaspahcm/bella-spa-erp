---
title: 'Harden Update Base Salary Recalculation'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'b0429b424cc30116e771956f422460f08e4ad410'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `updateBaseSalary` updates `users.base_salary` directly, then records audit. It does not sync the current-month salary record through the central salary recalculation engine, and audit failure can leave the new salary value unaudited.

**Approach:** Snapshot the user's current salary metadata, update `users.base_salary`, run `recalculateAndSaveSalaryRecordEngine` for KTV users in the current month, and rollback user salary plus current-month salary calculation if recalculation or audit fails.

## Boundaries & Constraints

**Always:** preserve authorization checks; use Supabase generated user update types; use the central salary recalculation engine for KTV current-month salary sync; return explicit failure if update, recalc, audit, or rollback fails; assert salary recalc and rollback side effects in tests.

**Ask First:** changing salary approval statuses; recalculating historical months; overriding non-draft salary records outside engine rules; adding a database RPC/transaction; changing UI behavior.

**Never:** update `salary_records` directly from this action; swallow audit/recalc failures; overwrite finalized salary values outside the engine; change create/delete user behavior in this slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| KTV salary update succeeds | Admin/manager updates KTV base salary | User base salary updates, current-month salary recalculates via engine, audit records old/new salary | Revalidate settings |
| Non-KTV salary update succeeds | Admin/manager updates non-KTV base salary | User base salary updates and audit records old/new salary | No salary engine call |
| Recalc fails | User base salary update succeeds, salary engine throws | User base salary is restored to snapshot | Return recalc failure plus rollback failure if any |
| Audit fails | User base salary update and recalc succeed, audit throws | User base salary is restored and KTV current-month salary recalculates from old base | Return audit failure plus rollback failure if any |

</frozen-after-approval>

## Code Map

- `src/services/user-actions.ts` -- Server Actions for base salary mutation, audit, and rollback.
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts` -- central engine required for salary record recalculation.
- `src/__tests__/user-actions.test.ts` -- focused Jest coverage for user action side effects.
- `docs/DEVELOPMENT_LOG.md` -- implementation log and verification evidence.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/user-actions.ts` -- snapshot user salary metadata, call salary recalculation engine for KTV users, and rollback on recalc/audit failure -- keep user salary and salary_records aligned.
- [x] `src/__tests__/user-actions.test.ts` -- add updateBaseSalary tests for KTV recalc, non-KTV skip, recalc rollback, and audit rollback -- assert side effects directly.
- [x] `docs/DEVELOPMENT_LOG.md` -- record scope, risk reduced, and verification commands -- preserve BMAD traceability.

**Acceptance Criteria:**
- Given an admin updates a KTV base salary, when the action succeeds, then `recalculateAndSaveSalaryRecordEngine` is called for the current month with the user's tenant.
- Given the target user is not a KTV, when the action succeeds, then salary recalculation is not called.
- Given recalculation fails after the user update, when the action returns, then the old `base_salary` is restored.
- Given audit fails after recalculation succeeds, when the action returns, then the old `base_salary` is restored and KTV salary is recalculated again using the old base.

## Design Notes

This keeps current-month behavior only. Historical and finalized salary behavior remains delegated to the salary engine, which already preserves non-draft salary components unless explicit overrides are supplied.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/user-actions.test.ts --runInBand` -- expected: user action rollback tests pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- expected: existing security hardening suite remains green.
- `npx.cmd tsc --noEmit` -- expected: TypeScript passes.
- `npx.cmd eslint src/services/user-actions.ts src/__tests__/user-actions.test.ts` -- expected: no new lint errors.

## Suggested Review Order

**Salary Recalculation Contract**

- Current-month salary sync is centralized through the existing engine.
  [`user-actions.ts:313`](../../src/services/user-actions.ts#L313)

- Rollback restores user salary, then recalculates salary from old base.
  [`user-actions.ts:326`](../../src/services/user-actions.ts#L326)

- Base salary action snapshots salary metadata before mutation.
  [`user-actions.ts:632`](../../src/services/user-actions.ts#L632)

- Recalc failure path restores user salary before returning failure.
  [`user-actions.ts:670`](../../src/services/user-actions.ts#L670)

- Audit failure path restores and recalculates old salary state.
  [`user-actions.ts:692`](../../src/services/user-actions.ts#L692)

**Side-Effect Coverage**

- KTV success path asserts salary engine, audit, and revalidate.
  [`user-actions.test.ts:449`](../../src/__tests__/user-actions.test.ts#L449)

- Non-KTV path asserts salary engine is skipped.
  [`user-actions.test.ts:487`](../../src/__tests__/user-actions.test.ts#L487)

- Failure paths assert rollback update and salary recalculation behavior.
  [`user-actions.test.ts:516`](../../src/__tests__/user-actions.test.ts#L516)

**Traceability**

- Development log captures scope, salary rules, and verification commands.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
