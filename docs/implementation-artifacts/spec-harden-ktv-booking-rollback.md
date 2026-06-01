---
title: 'Harden KTV Booking Rollback'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'b757fe656de49245262b9931994058d777860b04'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `completeKTVSession` can update a booking to `completed` or `in_progress`, then fail in a later cleanup step. Current rollback restores the session and inventory, but the booking row can remain in the new state, leaving booking/session status inconsistent.

**Approach:** Snapshot mutable booking fields before the booking update and restore them if a later rollback path runs after the booking update succeeded. Preserve the existing checkout API, inventory rollback behavior, and cleanup failure handling.

## Boundaries & Constraints

**Always:** snapshot booking state before mutation; rollback booking only if the current action successfully updated it; include booking rollback failure details in the returned error; keep checkout GPS failure as a warning; assert side effects in Jest.

**Ask First:** changing booking status rules; adding a database transaction/RPC; changing scheduled-session cleanup criteria; changing inventory rollback semantics.

**Never:** rollback booking before its update succeeds; hide booking rollback errors; alter salary/session multiplier calculations; rewrite unrelated KTV actions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Booking update then cleanup failure | Booking update succeeds, extra scheduled cleanup fails | Session/inventory rollback runs and booking is restored to its snapshot | Return cleanup failure plus booking rollback failure if restore fails |
| Booking update failure | Booking update fails before it mutates the row | Existing session/inventory rollback runs; booking rollback is not attempted | Return booking update error |
| Successful completion | Booking update and cleanup succeed | Booking remains in the computed new status | N/A |
| Booking rollback failure | Later failure occurs after booking update and restore fails | Return failure that includes both original error and booking rollback failure | No success response |

</frozen-after-approval>

## Code Map

- `src/services/ktv-actions.ts` -- Server Action containing `completeKTVSession`, booking update, cleanup, and rollback helper.
- `src/__tests__/ktv-actions.test.ts` -- Jest coverage for KTV checkout rollback behavior and side-effect assertions.
- `docs/DEVELOPMENT_LOG.md` -- BMAD refactor log and verification evidence.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/ktv-actions.ts` -- snapshot booking fields and rollback them from later failure paths -- keep booking/session state aligned.
- [x] `src/__tests__/ktv-actions.test.ts` -- extend cleanup failure tests to assert booking rollback and rollback-failure reporting -- prove side effects are restored.
- [x] `docs/DEVELOPMENT_LOG.md` -- record scope, risk reduced, and verification commands -- preserve traceability.

**Acceptance Criteria:**
- Given booking update succeeds and cleanup delete fails, when `completeKTVSession` returns, then booking rollback is attempted with the prior `status`, `is_in_care`, and `updated_at`.
- Given booking update itself fails, when `completeKTVSession` returns, then booking rollback is not attempted because no successful booking mutation occurred.
- Given booking rollback fails after a later failure, when `completeKTVSession` returns, then the error includes the original failure and booking rollback failure.
- Given all critical steps succeed, when checkout completes, then booking remains in the computed new status and no rollback runs.

## Design Notes

This is still a local compensating-rollback slice, not a full DB transaction. The rollback helper should collect failures across inventory, booking, and session restoration so the caller gets one explicit failure response with all known cleanup problems.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/ktv-actions.test.ts --runInBand` -- expected: KTV action tests pass with booking rollback coverage.
- `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` -- expected: inventory rollback behavior remains green.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- expected: existing security hardening suite remains green.
- `npx.cmd tsc --noEmit` -- expected: TypeScript passes.
- `npx.cmd eslint src/services/ktv-actions.ts src/__tests__/ktv-actions.test.ts` -- expected: no new lint errors.

## Suggested Review Order

**Booking Rollback Design**

- Defines typed booking rollback payload shape.
  [`ktv-actions.ts:101`](../../src/services/ktv-actions.ts#L101)

- Tracks booking rollback only after successful booking mutation.
  [`ktv-actions.ts:618`](../../src/services/ktv-actions.ts#L618)

- Restores booking snapshot during checkout rollback.
  [`ktv-actions.ts:634`](../../src/services/ktv-actions.ts#L634)

- Fetches booking fields needed for snapshot.
  [`ktv-actions.ts:715`](../../src/services/ktv-actions.ts#L715)

- Captures snapshot immediately after booking update succeeds.
  [`ktv-actions.ts:739`](../../src/services/ktv-actions.ts#L739)

**Side-Effect Tests**

- Asserts cleanup failure restores booking fields.
  [`ktv-actions.test.ts:500`](../../src/__tests__/ktv-actions.test.ts#L500)

- Covers booking rollback failure reporting.
  [`ktv-actions.test.ts:511`](../../src/__tests__/ktv-actions.test.ts#L511)

**Traceability**

- Records scope, risk reduced, and verification trail.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
