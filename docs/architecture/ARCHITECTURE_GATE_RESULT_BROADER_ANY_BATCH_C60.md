# Architecture Gate Result - Broader Any Cleanup Batch C60

## Status

PASS

## Scope

Remove explicit `any` usage from Finance F3 proof-runner test error handling:

- `src/platform/finance/__tests__/f3-proof-runner.test.ts`

## Non-Goals

- No Finance F2 changes.
- No Finance runtime, DB, migration, RLS, RPC, or business logic changes.
- No test expectation changes.
- No Nail Shop changes.
- No Preschool changes.
- No commit.

## Truth / Source Of Truth

| Code point | Source of truth | Canonical behavior |
| --- | --- | --- |
| G2 over-allocation error | Existing test assertion | Error message contains `OVER_ALLOCATION` |
| F3 proof trigger guard | Existing test assertion | Error code equals `F3001` |

## Ownership Map

| Data / behavior | Owner | Consumer |
| --- | --- | --- |
| F3 proof-runner error assertion | Finance test harness | F3 proof-runner Jest suite |

## Contract Dependency Map

```text
F3 proof-runner test
  -> PG query error object
  -> message/code narrowing
  -> existing assertions preserved
```

## Change Authority

Authorized layer:

```text
Finance test-local TypeScript narrowing only
```

## Minimal Implementation Plan

1. Add small `unknown` error narrowing helpers in the test file.
2. Replace `let connBError: any` with `unknown`.
3. Replace `catch (e: any)` with `catch (e: unknown)`.
4. Preserve all assertions and runtime behavior.

## Verification Plan

```text
targeted explicit-any scan
npx jest src/platform/finance/__tests__/f3-proof-runner.test.ts --runInBand
npx eslint src/platform/finance/__tests__/f3-proof-runner.test.ts
git diff --check
npm run check:any-types
```

## Gate Conclusion

PASS. C60 is limited to Finance test-local error narrowing.
