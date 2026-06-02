---
title: 'Type test upcoming route errors'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Type test upcoming route errors

## Intent

Problem: The development-only `/api/test-upcoming` route used `catch (error: any)` and returned a failure body without an HTTP failure status.

Approach: Replace the loose catch binding with `unknown`, derive a safe error message, and return HTTP 500 for handler exceptions while preserving the production 404 guard.

## Suggested Review Order

1. [`../../src/app/api/test-upcoming/route.ts`](../../src/app/api/test-upcoming/route.ts) - Verify production remains hidden and non-production failures return `{ success: false }` with status 500.
2. [`spec-type-test-upcoming-route.md`](spec-type-test-upcoming-route.md) - Confirm artifact scope and verification.

## Verification

- `npm.cmd run lint -- src/app/api/test-upcoming/route.ts` passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
