# Broader Any Batch C71 Result

Date: 2026-10-01
Scope: `src/platform/finance/resolvers/kernel-client.service.ts`
Status: SEALED

## Baseline

Official baseline before C71:

```text
142 violations / 34 files
```

Raw scanner output before C71:

```text
140 violations / 33 files
```

The raw output includes C60 HOLD worktree delta, so the official campaign baseline remains authoritative.

## Change

- Added local `KernelJournalLine` and `KernelJournalRequest` types for the existing internal request shape.
- Replaced `Promise<any>` and `(line: any)` with those local types.
- Did not change Finance posting behavior, account lookup semantics, journal schema, RLS, migrations, generated database types, or accounting policy.

## Verification

```text
targeted any scan                 PASS
npx eslint scope                  PASS
git diff --check scope             PASS
npx tsx import smoke               PASS
npm run arch:guard                 PASS
npm run check:any-types            EXPECTED FAIL
  raw count                        137 / 32
```

## Result

```text
Official baseline before C71  142 / 34
Official baseline after C71   139 / 33
Removed                         3 /  1
```

The raw scanner count is lower because C60 remains HOLD in the working tree and is not part of the official sealed baseline.

