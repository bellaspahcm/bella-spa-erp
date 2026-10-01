# Broader Any Cleanup Batch C60 Result - 2026-10-01

## Status

SEALED

## Scope

Finance F3 proof-runner test error narrowing:

- `src/platform/finance/__tests__/f3-proof-runner.test.ts`

## Result

```text
Previous official baseline   130 violations / 31 files
Current raw scanner          128 violations / 30 files
Removed by sealing C60         2 violations /  1 file
```

## Verification

```text
Finance targeted Jest                       PASS: 7/7
targeted explicit-any scan                  PASS
targeted ESLint                             PASS
git diff --check                             PASS
npm run check:any-types                      EXPECTED FAIL: 128 violations / 30 files
```

## Boundary

```text
Runtime behavior        NONE intended
Finance F2 / RLS        NONE
Finance runtime         NONE
Contract changes        NONE
DB / migration / RLS    NONE
RPC semantics           NONE
Test assertion intent   PRESERVED
Nail                    UNTOUCHED
Preschool               UNTOUCHED / EXCLUDED
```

## Resolved Hold Reason

```text
Test
src/platform/finance/__tests__/f3-proof-runner.test.ts

Former failure
G1-01 Nested call compile and execution
G1-04 Nested crash/retry idempotency
G1-05 Outbox event atomicity

Former error
PERIOD_NOT_FOUND
```

C60 originally changed local error typing/narrowing:

- `connBError: any` -> `connBError: unknown`
- `catch (e: any)` -> `catch (e: unknown)`
- added local helpers for error `message` and `code` narrowing

The hold was caused by stale fixture setup. The test inserted only a fixed August 2026 accounting period while invoking the proof RPC with database `NOW()`. On 2026-10-01, F1 correctly rejected those calls because no OPEN period covered the runtime timestamp.

The fixture now seeds the accounting period from database `date_trunc('month', NOW())`, keeping the proof-runner aligned with F1 period validation. The scanner-noise comment was also renamed without changing behavior.

There is no Finance runtime, DB/RLS, migration, RPC semantic, or contract change in this seal.
