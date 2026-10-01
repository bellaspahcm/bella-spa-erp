# Broader Any Batch C69 Result

Date: 2026-10-01
Scope: `src/platform/finance/__tests__/finance-f2-reconstruction.test.ts`
Status: SEALED

## Baseline

Official baseline before C69:

```text
150 violations / 35 files
```

Raw scanner output before C69:

```text
148 violations / 34 files
```

The raw output includes C60 HOLD worktree delta, so the official campaign baseline remains authoritative.

## Change

- Replaced all `'exec_sql' as any` RPC-name casts with the generated `'exec_sql'` function name.
- Left the residual `data as any` return-shape gap untouched because generated `exec_sql` returns `undefined` while this test expects a row result from a raw `SELECT`.
- Did not change Finance runtime behavior, raw SQL text, RLS, migrations, or generated database types.

## Verification

```text
targeted exec_sql cast scan       PASS
npx eslint scope                  PASS
Finance F2 reconstruction Jest     PASS (18/18)
git diff --check scope             PASS
npm run arch:guard                 PASS
npm run check:any-types            EXPECTED FAIL
  raw count                        141 / 34
```

## Residual In Scope

```text
data as any
```

This remains a return-contract gap for `exec_sql` result rows and is not fixed in C69.

## Result

```text
Official baseline before C69  150 / 35
Official baseline after C69   143 / 35
Removed                         7 /  0
```

The raw scanner count is lower because C60 remains HOLD in the working tree and is not part of the official sealed baseline.

