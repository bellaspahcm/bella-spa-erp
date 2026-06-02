---
title: 'Harden Audit Action Typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden Audit Action Typing

## Intent

**Problem:** Audit read actions still mapped database rows with `any`, and the shared audit/domain types kept JSON payloads and session matrix dynamic values loosely typed.

**Approach:** Type audit row projections with generated database row types, type audit JSON payloads as `Json | null`, and update the salary session matrix view to read dynamic package counts through a number guard.

## Suggested Review Order

- [../../src/services/audit-actions.ts](../../src/services/audit-actions.ts) - verify HQ and branch audit projections no longer use `any`.
- [../../src/types/domain.ts](../../src/types/domain.ts) - verify audit JSON and session matrix dynamic value types.
- [../../src/app/dashboard/salary/components/SessionMatrixTable.tsx](../../src/app/dashboard/salary/components/SessionMatrixTable.tsx) - verify package count rendering remains numeric after index type tightening.
- [../../src/__tests__/hq-audit-explorer.test.ts](../../src/__tests__/hq-audit-explorer.test.ts) - direct regression coverage for HQ audit explorer.

## Verification

- `npm.cmd run lint -- src/services/audit-actions.ts src/types/domain.ts src/app/dashboard/salary/components/SessionMatrixTable.tsx` - passed, 0 warnings.
- `npx.cmd tsc --noEmit --pretty false` - passed.
- `npm.cmd test -- src/__tests__/hq-audit-explorer.test.ts --runInBand` - passed, 6 tests.

## Review Notes

- No audit write behavior changed.
- Audit query errors already propagated and remain unchanged.
- `checkMonthLock` keeps the same public signature.
