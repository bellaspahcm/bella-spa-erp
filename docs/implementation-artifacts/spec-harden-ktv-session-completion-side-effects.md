---
title: 'Harden KTV Session Completion Side Effects'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '275b4391fa33a50c8f8d0b4d59f4f781b3d9891a'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `completeKTVSession` marks a session as completed, then may auto-consume inventory before it counts completed sessions and updates the booking. If a later booking/count step fails after inventory was consumed, the current rollback restores only `session_logs`, leaving inventory/log side effects behind for a session that is no longer completed.

**Approach:** Track whether inventory consumption successfully created a side effect during checkout and include `rollbackInventoryConsumption(sessionId)` in later rollback paths. Preserve the existing distinction that checkout GPS save failure is non-critical and may remain a warning.

## Boundaries & Constraints

**Always:** return explicit failure for critical DB/side-effect errors; rollback inventory consumption before returning failure when completion cannot be finalized; keep existing `completeKTVSession` API and KTV authorization behavior; assert side-effect rollback calls in tests.

**Ask First:** changing inventory consumption semantics; changing booking status rules; adding a PostgreSQL RPC/transaction wrapper; changing salary/session multiplier calculations.

**Never:** treat inventory consumption failure as a success warning; rollback inventory when auto-consume was bypassed or processed no materials; remove the existing checkout GPS warning behavior; rewrite unrelated KTV read actions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Completion with inventory and booking success | Package has materials, auto-consume succeeds, count and booking update succeed | Session remains completed, inventory remains consumed, booking is updated | N/A |
| Inventory success then count fails | Auto-consume succeeds, completed-session count query fails | Session completion is rolled back and inventory consumption is rolled back | Return failure including count error; include inventory rollback failure if it occurs |
| Inventory success then booking update fails | Auto-consume succeeds, booking status update fails | Session completion is rolled back and inventory consumption is rolled back | Return failure including booking error; include inventory rollback failure if it occurs |
| Auto-consume bypassed | Tenant config disables auto-consume or no materials are processed | Later rollback does not call inventory rollback unnecessarily | Critical later failures still rollback session completion |

</frozen-after-approval>

## Code Map

- `src/services/ktv-actions.ts` -- Server Action module containing `completeKTVSession`, session completion update, auto-consume call, booking update, and checkout rollback.
- `src/services/inventory-actions.ts` -- provides `autoConsumeForSession` and `rollbackInventoryConsumption`, with existing rollback semantics for inventory logs.
- `src/__tests__/ktv-actions.test.ts` -- Jest coverage for KTV action rollback/warning behavior; should gain side-effect assertions for inventory rollback after checkout failures.
- `docs/DEVELOPMENT_LOG.md` -- running BMAD refactor log and verification evidence.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/ktv-actions.ts` -- track successful inventory consumption and call `rollbackInventoryConsumption` from later completion rollback paths -- prevent orphan inventory side effects.
- [x] `src/__tests__/ktv-actions.test.ts` -- mock inventory actions and add completion rollback tests for count/booking failures after inventory consumption -- assert inventory rollback is called only when needed.
- [x] `docs/DEVELOPMENT_LOG.md` -- add a concise BMAD log entry with scope, risk reduced, and verification commands -- preserve development traceability.

**Acceptance Criteria:**
- Given auto-consume succeeds with processed materials, when completed-session count fails, then `rollbackInventoryConsumption(sessionId)` is called and the session completion is rolled back.
- Given auto-consume succeeds with processed materials, when booking update fails, then `rollbackInventoryConsumption(sessionId)` is called and the session completion is rolled back.
- Given auto-consume is bypassed or processes zero materials, when a later critical failure occurs, then session rollback still runs but inventory rollback is not called.
- Given checkout GPS save fails, when all critical completion steps succeed, then the action still returns success with warning.

## Design Notes

`autoConsumeForSession` already rolls back its own partial failures. This slice only handles the gap after it reports success. Use a boolean flag based on `processed > 0` or `totalCost > 0`, so disabled/no-material paths do not perform empty rollback work.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/ktv-actions.test.ts --runInBand` -- expected: KTV action tests pass with new side-effect rollback cases.
- `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` -- expected: inventory rollback behavior remains green.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- expected: existing security hardening suite remains green.
- `npx.cmd tsc --noEmit` -- expected: TypeScript passes.
- `npx.cmd eslint src/services/ktv-actions.ts src/__tests__/ktv-actions.test.ts` -- expected: no new lint errors.

## Suggested Review Order

**Rollback Design**

- Defines the success-result signal used to detect inventory side effects.
  [`ktv-actions.ts:85`](../../src/services/ktv-actions.ts#L85)

- Tracks whether checkout created inventory side effects.
  [`ktv-actions.ts:606`](../../src/services/ktv-actions.ts#L606)

- Rolls back consumed inventory before returning critical failure.
  [`ktv-actions.ts:614`](../../src/services/ktv-actions.ts#L614)

- Sets the rollback flag only after successful auto-consume.
  [`ktv-actions.ts:667`](../../src/services/ktv-actions.ts#L667)

**Side-Effect Tests**

- Mocks inventory actions for checkout rollback assertions.
  [`ktv-actions.test.ts:30`](../../src/__tests__/ktv-actions.test.ts#L30)

- Covers count failure after inventory was consumed.
  [`ktv-actions.test.ts:310`](../../src/__tests__/ktv-actions.test.ts#L310)

- Covers inventory rollback failure reporting.
  [`ktv-actions.test.ts:356`](../../src/__tests__/ktv-actions.test.ts#L356)

- Covers bypassed auto-consume avoiding unnecessary rollback.
  [`ktv-actions.test.ts:405`](../../src/__tests__/ktv-actions.test.ts#L405)

**Traceability**

- Records scope, risk reduced, and verification trail.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
