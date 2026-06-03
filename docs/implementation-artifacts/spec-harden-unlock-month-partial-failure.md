---
title: 'Harden Unlock Month Partial Failure'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '65442503d964c7068ea353da6cc52067db32f345'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `unlockMonth` updates `revenue`, `expenses`, and `salary_records` independently. If one update succeeds and a later table fails, the finance month can be left partially unlocked across financial records, which is dangerous for accounting consistency.

**Approach:** Keep the public action contract stable, but make the multi-table unlock compensating-safe. On any unlock update failure after earlier tables may have been unlocked, attempt to restore `is_locked: true` for all month-scoped tables and return an explicit failure that includes both the original failure and rollback failure if any.

## Boundaries & Constraints

**Always:** Preserve current auth checks, return shape, and `/dashboard/finance` revalidation on success. Treat every table update error as a hard failure. Use generated Supabase table update payload types for `revenue`, `expenses`, and `salary_records`. Make rollback scoped to the same tenant and month/date filters as unlock.

**Ask First:** New RPC creation, database transaction migration, changing role requirements, changing route/UI copy outside this action, or adding audit log/outbox behavior.

**Never:** Do not ignore partial failures. Do not report success if any unlock or rollback operation fails. Do not broaden filters beyond the requested month and current tenant.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Success | Admin with tenant unlocks a valid month and all three updates succeed | Returns `{ success: true, month }` and revalidates finance dashboard | No rollback |
| Non-admin | User role is not admin | Returns `{ success: false }` with admin error | No DB updates |
| Unlock update fails | One of `revenue`, `expenses`, `salary_records` update returns error | Returns `{ success: false }` and attempts rollback lock on all three tables | Error includes original failure |
| Rollback also fails | Unlock update fails and any rollback lock update fails | Returns `{ success: false }` | Error includes original failure and rollback failure |

</frozen-after-approval>

## Code Map

- `src/services/finance/unlock-month-action.ts` -- Server action that unlocks finance records for a month.
- `src/services/finance/lock-month.ts` -- Public finance action export wrapper for `unlockMonth`.
- `src/__tests__/finance.lockMonth.test.ts` -- Existing Jest coverage for `lockMonth` and `unlockMonth` auth/failure behavior.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/finance/unlock-month-action.ts` -- introduce typed update payloads and helper functions for month-scoped unlock/rollback updates.
- [x] `src/services/finance/unlock-month-action.ts` -- on any unlock failure, attempt compensating rollback to `is_locked: true` for all three scoped tables before returning failure.
- [x] `src/__tests__/finance.lockMonth.test.ts` -- add assertions for rollback on partial unlock failure and rollback-failure detail.
- [x] `docs/DEVELOPMENT_LOG.md` -- record the completed checkpoint and verification commands.

**Acceptance Criteria:**
- Given a valid admin unlock where `expenses` update fails after `revenue` may have updated, when `unlockMonth` returns, then it has attempted to restore lock state for `revenue`, `expenses`, and `salary_records`.
- Given rollback also fails for one table, when `unlockMonth` returns, then `success` is false and the error message includes both the unlock failure and rollback failure.
- Given all updates succeed, when `unlockMonth` returns, then the success response and revalidation behavior remain unchanged.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/finance.lockMonth.test.ts --runInBand` -- pass, 11/11 tests.
- `npx.cmd tsc --noEmit --incremental false` -- pass.
- `npx.cmd eslint src/services/finance/unlock-month-action.ts src/__tests__/finance.lockMonth.test.ts` -- pass.
- `npm.cmd test -- --runInBand` -- pass, 66 suites / 731 tests.
- `npm.cmd run build` -- pass.

## Review Notes

- `unlockMonth` now uses generated Supabase `Update` payload types for the three affected financial tables.
- Month-scoped lock/unlock filters are centralized and use local month math, avoiding UTC `toISOString` end-of-month drift.
- The action snapshots records that were locked before the unlock attempt, so rollback only restores records affected by this operation.
- `Promise.allSettled` handling covers both Supabase `{ error }` responses and rejected update promises; rollback rejection details are included in the returned error.
- BMad review findings resolved: rejected unlock bypass, rejected rollback masking original failure, and missing rollback scope assertions.

## Suggested Review Order

**Month Scope & Snapshot**

- Month parsing avoids UTC drift and keeps filters stable.
  [`unlock-month-action.ts:36`](../../src/services/finance/unlock-month-action.ts#L36)

- Snapshot preserves only records originally locked before unlock.
  [`unlock-month-action.ts:57`](../../src/services/finance/unlock-month-action.ts#L57)

**Failure Handling**

- Settled update collection catches both DB errors and rejected promises.
  [`unlock-month-action.ts:78`](../../src/services/finance/unlock-month-action.ts#L78)

- Shared update helper applies identical tenant and month filters.
  [`unlock-month-action.ts:96`](../../src/services/finance/unlock-month-action.ts#L96)

- Unlock failure triggers snapshot-based rollback and combined error reporting.
  [`unlock-month-action.ts:178`](../../src/services/finance/unlock-month-action.ts#L178)

**Regression Tests**

- Mock helper records payloads and scope filters for side-effect assertions.
  [`finance.lockMonth.test.ts:31`](../../src/__tests__/finance.lockMonth.test.ts#L31)

- Partial failure test verifies rollback payloads and exact scope filters.
  [`finance.lockMonth.test.ts:232`](../../src/__tests__/finance.lockMonth.test.ts#L232)

- Rejected update and rejected rollback paths are covered.
  [`finance.lockMonth.test.ts:262`](../../src/__tests__/finance.lockMonth.test.ts#L262)
