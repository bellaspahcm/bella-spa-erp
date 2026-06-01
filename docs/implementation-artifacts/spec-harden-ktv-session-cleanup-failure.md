---
title: 'Harden KTV Session Cleanup Failure'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'd25af8e6bbd47042d68c19130296c2ec8f7e96c3'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `completeKTVSession` deletes extra scheduled `session_logs` after marking a booking complete, but does not inspect the delete result. If that cleanup query fails, checkout still returns success, leaving stale scheduled sessions after a supposedly completed booking.

**Approach:** Treat cleanup delete as a critical side effect when the booking is finished. If cleanup fails, return explicit failure and rollback prior completion side effects consistently with the existing session/inventory rollback path.

## Boundaries & Constraints

**Always:** check the cleanup delete error; preserve the existing KTV checkout API and authorization behavior; keep checkout GPS failures as non-critical warnings; include side-effect assertions in tests; do not swallow rollback failures.

**Ask First:** changing what qualifies as an extra scheduled session; introducing an RPC/database transaction; changing booking completion rules; changing inventory consumption behavior.

**Never:** return success when cleanup delete fails; delete non-scheduled sessions; modify salary calculation/session multiplier logic; refactor unrelated KTV read actions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Finished booking cleanup succeeds | Completed count reaches total sessions and extra scheduled rows delete successfully | Checkout returns success, booking remains completed | N/A |
| Finished booking cleanup fails | Completed count reaches total sessions and scheduled cleanup delete returns DB error | Checkout returns failure and rollback runs | Error includes cleanup failure and rollback failure details if any |
| Booking not finished | Completed count is below total sessions | No cleanup delete is attempted | Existing session/booking update behavior is unchanged |
| Checkout GPS warning plus cleanup success | GPS save fails but critical completion and cleanup succeed | Checkout returns success with warning | GPS warning remains non-critical |

</frozen-after-approval>

## Code Map

- `src/services/ktv-actions.ts` -- Server Action containing `completeKTVSession`, booking status update, scheduled-session cleanup, and rollback helper.
- `src/__tests__/ktv-actions.test.ts` -- Jest coverage for KTV checkout rollback/warning behavior; should assert cleanup failure is not silent.
- `docs/DEVELOPMENT_LOG.md` -- BMAD refactor log and verification evidence.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/ktv-actions.ts` -- check cleanup delete result and rollback completed checkout when it fails -- close the silent DB failure.
- [x] `src/__tests__/ktv-actions.test.ts` -- add tests for cleanup delete failure and no-cleanup path when booking is not finished -- assert side-effect behavior directly.
- [x] `docs/DEVELOPMENT_LOG.md` -- record scope, risk reduced, and verification commands -- preserve the development trace.

**Acceptance Criteria:**
- Given a booking reaches finished state, when scheduled cleanup delete fails, then `completeKTVSession` returns failure instead of success.
- Given cleanup delete fails after inventory was consumed, when rollback runs, then inventory rollback and session rollback are both attempted.
- Given the booking is not finished, when checkout succeeds, then scheduled cleanup delete is not attempted.
- Given checkout GPS save fails but cleanup succeeds, when checkout completes, then the action still returns success with warning.

## Design Notes

The cleanup occurs after booking status update. This slice keeps rollback focused on the side effects already covered by the local rollback helper: completed session and inventory consumption. Booking rollback can be planned separately if the project decides completed-booking cleanup must become fully transactional across all affected rows.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/ktv-actions.test.ts --runInBand` -- expected: KTV action tests pass with cleanup failure coverage.
- `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` -- expected: inventory rollback behavior remains green.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- expected: existing security hardening suite remains green.
- `npx.cmd tsc --noEmit` -- expected: TypeScript passes.
- `npx.cmd eslint src/services/ktv-actions.ts src/__tests__/ktv-actions.test.ts` -- expected: no new lint errors.

## Suggested Review Order

**Cleanup Failure Handling**

- Converts scheduled-session cleanup from fire-and-forget to checked mutation.
  [`ktv-actions.ts:721`](../../src/services/ktv-actions.ts#L721)

- Routes cleanup failure through existing checkout rollback.
  [`ktv-actions.ts:728`](../../src/services/ktv-actions.ts#L728)

**Side-Effect Tests**

- Covers cleanup failure after inventory side effects exist.
  [`ktv-actions.test.ts:448`](../../src/__tests__/ktv-actions.test.ts#L448)

- Covers unfinished booking path without cleanup delete.
  [`ktv-actions.test.ts:499`](../../src/__tests__/ktv-actions.test.ts#L499)

**Traceability**

- Records scope, risk reduced, and verification trail.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
