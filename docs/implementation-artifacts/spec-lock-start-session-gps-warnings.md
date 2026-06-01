---
title: 'Lock Start Session GPS Warnings'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '4b8d9153341c4a31e12fa2cc1013e35b1b30892f'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `startSession` has two post-start GPS writes that intentionally return success with warning instead of rolling back the started session. This behavior is plausible because GPS enrichment is secondary, but it should be explicitly tested so future refactors do not accidentally turn real session/booking errors into warnings or GPS warnings into destructive rollbacks.

**Approach:** Lock the current business boundary in tests: session start and booking update failures remain critical rollback failures, while session check-in GPS and customer coordinate capture failures remain non-critical warnings after the primary start side effects succeed.

## Boundaries & Constraints

**Always:** keep session start update and booking update as critical operations; preserve rollback when booking update fails; return explicit warning text for GPS persistence failures; assert side-effect calls and no rollback calls in tests.

**Ask First:** making GPS mandatory for check-in; adding distance validation; changing customer coordinate assignment rules; changing UI warning display behavior.

**Never:** treat booking update failure as a warning; roll back a started session only because session/customer GPS enrichment failed; alter checkout completion logic in this slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Session GPS save fails | Session start and booking update succeed; session GPS update fails | Action returns success with warning; no rollback update is issued | Warning includes session GPS error |
| Customer GPS save fails | Session start, booking update, and session GPS save succeed; customer GPS update fails | Action returns success with warning; no rollback update is issued | Warning includes customer GPS error |
| Booking update fails | Session start succeeds; booking update fails | Started session is rolled back | Return failure, not warning |
| Both GPS writes fail | Primary start side effects succeed; both GPS writes fail | Action returns success with combined warning | No rollback update is issued |

</frozen-after-approval>

## Code Map

- `src/services/ktv-actions.ts` -- `startSession` implementation and current critical/non-critical side-effect boundary.
- `src/__tests__/ktv-actions.test.ts` -- Jest coverage for KTV start/checkout rollback and warning behavior.
- `docs/DEVELOPMENT_LOG.md` -- BMAD refactor log and verification evidence.

## Tasks & Acceptance

**Execution:**
- [x] `src/__tests__/ktv-actions.test.ts` -- add focused tests for session GPS warning and combined GPS warning behavior -- lock non-critical warning boundaries.
- [x] `docs/DEVELOPMENT_LOG.md` -- record the decision and verification commands -- preserve traceability.

**Acceptance Criteria:**
- Given session start and booking update succeed, when session GPS save fails, then the action returns success with warning and does not rollback the started session.
- Given both session GPS and customer GPS writes fail after primary start side effects, when `startSession` returns, then both warnings are present and no rollback update is issued.
- Given booking update fails, when `startSession` returns, then it remains a failure with rollback, not a warning.

## Design Notes

This slice intentionally changes tests/documentation only. The code already treats GPS enrichment as non-critical and booking mutation as critical; the missing part is regression coverage for the session GPS branch and combined warning branch.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/ktv-actions.test.ts --runInBand` -- expected: KTV action tests pass with GPS warning coverage.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- expected: existing security hardening suite remains green.
- `npx.cmd tsc --noEmit` -- expected: TypeScript passes.
- `npx.cmd eslint src/services/ktv-actions.ts src/__tests__/ktv-actions.test.ts` -- expected: no new lint errors.

## Suggested Review Order

**Warning Boundary Tests**

- Locks session GPS failure as non-critical warning.
  [`ktv-actions.test.ts:198`](../../src/__tests__/ktv-actions.test.ts#L198)

- Locks combined GPS warnings without rollback.
  [`ktv-actions.test.ts:236`](../../src/__tests__/ktv-actions.test.ts#L236)

**Traceability**

- Records the test-only hardening decision.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
