---
title: Harden Reschedule Session Rollback
type: one-shot
created: 2026-06-03
status: done
route: one-shot
---

# Harden Reschedule Session Rollback

## Intent

Problem: `rescheduleSession` updated all future scheduled sessions with `Promise.all`. If one update failed after earlier updates succeeded, the action returned an error while leaving some sessions shifted and others unchanged.

Approach: Apply reschedule updates sequentially, track every successfully updated session, and rollback applied updates if a later update or audit logging fails. Move cache revalidation after audit success so failed reschedules do not refresh clients with rolled-back state.

## Evidence

- Added regression coverage for partial update failure rollback.
- Added regression coverage for audit failure rollback.
- `npm.cmd test -- src/__tests__/transaction-safety.test.ts --runInBand` passed.
- `npx.cmd tsc --noEmit --incremental false` passed.
- `npx.cmd eslint src/modules/booking/actions/reschedule-session-action.ts src/__tests__/transaction-safety.test.ts` passed.
- `npm.cmd test -- --runInBand` passed: 65 suites / 710 tests.
- `npm.cmd run build` passed.

## Suggested Review Order

1. `src/modules/booking/actions/reschedule-session-action.ts` - verify sequential update and rollback behavior.
2. `src/__tests__/transaction-safety.test.ts` - verify partial update and audit failure scenarios assert rollback side effects.
