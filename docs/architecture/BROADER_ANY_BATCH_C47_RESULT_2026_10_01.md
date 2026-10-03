# Broader Any Cleanup Batch C47 Result — 2026-10-01

## Status

SEALED

## Scope

Shared intelligence query batching utility:

- `src/services/intelligence/shared/query-optimizer.ts`

## Result

```text
Before check:any-types  280 violations / 60 files
After check:any-types   279 violations / 59 files
Removed                   1 violation  /  1 file
```

## Changes

- Replaced the internal `BatchedQuery<any>[]` storage with a type-erased `BatchedQuery[]` queue.
- Preserved caller-facing `batchQuery<T>` typing by resolving each promise through its own query closure.

## Boundary

```text
Runtime behavior      NONE
Product/domain logic  NONE
DB / migration        NONE
Core/Frozen layers    NONE
```

## Verification

```text
targeted explicit-any scan  PASS
targeted Jest               NOT_APPLICABLE: no direct suite for this utility
targeted ESLint             PASS
git diff --check             PASS
npm run check:any-types      EXPECTED FAIL: 279 / 59
```

## Notes

The internal queue can hold different result types under the same batch key, so `unknown` is used only for erased internal storage. The public generic `Promise<T>` contract remains intact.
