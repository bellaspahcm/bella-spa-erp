---
title: 'Harden Clearing Action Errors'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden Clearing Action Errors

## Intent

**Problem:** `clearing-actions` still used `catch (e: any)` and could flatten inter-branch clearing query failures into an empty list.

**Approach:** Handle caught errors as `unknown`, centralize safe message extraction, keep unauthenticated empty-list behavior covered by tests, and rethrow real query failures.

## Suggested Review Order

- [../../src/services/clearing-actions.ts](../../src/services/clearing-actions.ts) - verify typed error handling and query failure propagation.
- [../../src/__tests__/inter-branch-clearing.test.ts](../../src/__tests__/inter-branch-clearing.test.ts) - direct regression coverage for listing, clearing, rate update, and sandbox clearing.

## Verification

- `npm.cmd run lint -- src/services/clearing-actions.ts` - passed, 0 warnings.
- `npx.cmd tsc --noEmit --pretty false` - passed.
- `npm.cmd test -- src/__tests__/inter-branch-clearing.test.ts --runInBand` - passed, 13 tests.

## Review Notes

- No database update payload changed.
- `getInterBranchClearingRecords` still returns `[]` for no logged-in user, matching existing tests.
- Database query failures now propagate instead of showing a false empty state.
