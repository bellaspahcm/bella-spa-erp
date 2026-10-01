# BROADER ANY BATCH C37 RESULT

Date: 2026-10-01
Status: SEALED

## Scope

Batch C37 targeted test-local catch narrowing in:

- `src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts`
- `src/platform/finance/__tests__/finance-f3-payment-allocation.test.ts`

Change type:

```text
catch (e: any)
  -> catch (e: unknown)
  -> getErrorMessage(e)
```

No SQL, expectation, runtime Finance contract, generated DB type, or production
code was changed.

## Any Gate

Before C37:

```text
354 violations / 84 files
```

After C37 working tree:

```text
340 violations / 82 files
```

Removed:

```text
14 violations / 2 files
```

## Initial Verification Stop

Targeted scan:

```text
PASS
```

Diff check:

```text
git diff --check = PASS
```

Targeted Jest:

```text
npx jest src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts src/platform/finance/__tests__/finance-f3-payment-allocation.test.ts --runInBand

FAIL
25 passed / 28 total
3 failed
```

Failures:

```text
finance-f3-invoice-lifecycle.test.ts
- F3.2-T16 to T18: PERIOD_NOT_FOUND during finance_void_invoice
- F3.2-T20: PERIOD_NOT_FOUND during finance_void_invoice

finance-f3-payment-allocation.test.ts
- F3.3-T15 expected /permission denied|DIRECT_CASH_MUTATION_PROHIBITED/
- actual CASH_MOVEMENT_IMMUTABLE
```

## Root Cause Status

There is no evidence C37 caused the failures. The diff only changes error
typing/extraction and preserves the same error message when the caught value is
an `Error`.

The failures exposed Finance baseline/contract gaps outside the original C37
type-local scope:

- F3 void flow cannot find an accounting period for reversal posting.
- F2 cash movement direct-update error semantics differ from the test
  expectation.

## Finance Baseline Triage Resolution

Architecture gate:

```text
docs/architecture/ARCHITECTURE_GATE_RESULT_FINANCE_C37_BASELINE_TRIAGE_2026_10_01.md
```

Resolution:

- `finance_reverse_transaction` defaults reversal date to `NOW()` when
  `p_reversal_date` is not supplied.
- The lifecycle test seeded only the August 2026 accounting period, so voiding
  at current execution time could legitimately raise `PERIOD_NOT_FOUND`.
- The test fixture now seeds an open period covering `NOW()` only when the
  tenant does not already have one.
- `CASH_MOVEMENT_IMMUTABLE` is a valid F2 canonical direct-update outcome for
  `finance_cash_movements`; the stale assertion now accepts it alongside the
  other canonical boundary errors.

No Finance runtime SQL/RPC behavior was changed by this triage.

## Final Verification

Targeted Jest:

```text
npx jest src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts src/platform/finance/__tests__/finance-f3-payment-allocation.test.ts --runInBand

PASS
Test Suites: 2 passed, 2 total
Tests:       28 passed, 28 total
```

Targeted ESLint:

```text
npx eslint src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts src/platform/finance/__tests__/finance-f3-payment-allocation.test.ts

PASS
```

Diff check:

```text
git diff --check = PASS
```

Any gate:

```text
npm run check:any-types = FAIL
340 violations / 82 files
```

This is expected residual campaign scope, not a C37 blocker.

## Decision

C37 is sealed.

Do not treat `340 / 82` as final campaign completion. It is the next residual
state after C37.
