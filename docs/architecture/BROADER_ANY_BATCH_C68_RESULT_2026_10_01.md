# Broader Any Batch C68 Result

Date: 2026-10-01
Scope:

- `src/services/intelligence/customer/__tests__/integration.test.ts`
- `src/platform/finance/__tests__/finance-f2-reconstruction.test.ts`

Status: SEALED

## Baseline

Official baseline before C68:

```text
152 violations / 35 files
```

Raw scanner output before C68:

```text
150 violations / 34 files
```

The raw output includes C60 HOLD worktree delta, so the official campaign baseline remains authoritative.

## Change

- Removed unnecessary Customer invalid-segment cast.
- Replaced Finance F2 unauthorized direct update payload cast with generated `finance_cash_positions.Update` type.
- Excluded Finance F1 candidate after targeted Jest exposed unrelated reversal/outbox baseline failures.
- Did not touch Customer materialized view generated-type gaps or Finance `exec_sql` contract gaps.

## Verification

```text
targeted pattern scan             PASS
npx eslint scope                  PASS
Customer integration Jest          PASS / skipped suite (36 skipped)
Finance F2 reconstruction Jest     PASS (18/18)
git diff --check scope             PASS
npm run arch:guard                 PASS
npm run check:any-types            EXPECTED FAIL
  raw count                        148 / 34
```

## Deferred Candidate

`src/platform/finance/__tests__/finance-f1-ledger-verification.test.ts` remains outside C68:

```text
F1 targeted Jest  FAIL
Failures          reversal/outbox baseline
Action            DEFER / not repaired in any cleanup
```

## Result

```text
Official baseline before C68  152 / 35
Official baseline after C68   150 / 35
Removed                         2 /  0
```

The raw scanner count is lower because C60 remains HOLD in the working tree and is not part of the official sealed baseline.

