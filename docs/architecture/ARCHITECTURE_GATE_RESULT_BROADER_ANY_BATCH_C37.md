# ARCHITECTURE GATE RESULT - BROADER ANY CLEANUP BATCH C37

Date: 2026-10-01
Status: PASS

## Problem / Non-Goals

Current `check:any-types` state:

```text
354 violations / 84 files
```

Batch C37 targets only Finance F3 test-local `catch (e: any)` usage in:

- `src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts`
- `src/platform/finance/__tests__/finance-f3-payment-allocation.test.ts`

Non-goals:

- Do not change SQL, DB schema, DB privileges, or generated database types.
- Do not change expected Finance behavior.
- Do not touch Finance production runtime code.
- Do not touch Logistics frozen artifacts, Healthcare kernel, Education code, or Preschool dirty file.

## Truth / Source Of Truth

Truth:

- The caught value is unknown at runtime.
- Tests only need a string error message for assertions.

Source of truth:

- Existing test expectations.
- TypeScript `catch` semantics.
- Prior sealed pattern from C36 (`unknown` catch narrowing with local helper).

## Ownership

Owner: Finance test harness.

Affected layer: test-only verification code.

## Change Authority

The user authorized continuing the `any` cleanup after the Finance/RLS blocker
was sealed. This batch authorizes only type-local test narrowing.

## Minimal Implementation Plan

1. Add local `getErrorMessage(error: unknown): string` helper in each target file.
2. Replace `catch (e: any)` with `catch (e: unknown)`.
3. Replace `e.message` reads with `getErrorMessage(e)`.

## Verification Plan

```text
targeted any scan for both files
npx jest src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts src/platform/finance/__tests__/finance-f3-payment-allocation.test.ts --runInBand
npm run check:any-types
git diff --check
```
