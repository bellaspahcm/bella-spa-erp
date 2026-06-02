---
title: 'Harden Franchise Actions Typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden Franchise Actions Typing

## Intent

**Problem:** `franchise-actions` still used loose `any` typing for caught errors and tenant update payloads, and invoice query failures could be flattened into an empty list.

**Approach:** Type tenant updates with the generated `tenants.Update` schema, handle caught errors as `unknown`, centralize safe error message extraction, and rethrow invoice query failures while preserving the existing unauthenticated empty-state behavior.

## Suggested Review Order

- [../../src/services/franchise-actions.ts](../../src/services/franchise-actions.ts) - verify typed tenant payloads, error propagation, and preserved unauthenticated behavior.
- [../../src/__tests__/franchise-royalty.test.ts](../../src/__tests__/franchise-royalty.test.ts) - direct regression coverage for royalty invoice listing and payment actions.

## Verification

- `npm.cmd run lint -- src/services/franchise-actions.ts` - passed, 0 warnings.
- `npx.cmd tsc --noEmit --pretty false` - passed.
- `npm.cmd test -- src/__tests__/franchise-royalty.test.ts --runInBand` - passed, 13 tests.

## Review Notes

- Database query errors in `getFranchiseRoyaltyInvoices` now propagate instead of returning `[]`.
- `getFranchiseRoyaltyInvoices` still returns `[]` when there is no logged-in user, matching existing tests.
- Revalidation best-effort behavior is unchanged.
