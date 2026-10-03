# Broader Any Batch C70 Result

Date: 2026-10-01
Scope: `src/platform/finance/__tests__/finance-f2-reconstruction.test.ts`
Status: SEALED

## Baseline

Official baseline before C70:

```text
143 violations / 35 files
```

Raw scanner output before C70:

```text
141 violations / 34 files
```

The raw output includes C60 HOLD worktree delta, so the official campaign baseline remains authoritative.

## Change

- Replaced the residual `(data as any)?.[0]?.val` read with a small runtime guard over `unknown`.
- Did not change Finance runtime behavior, SQL, RLS, migrations, generated database types, or test expectations.
- Did not reopen C60 HOLD.

## Verification

```text
targeted any scan                 PASS
npx eslint scope                  PASS
Finance F2 reconstruction Jest     PASS (18/18)
git diff --check scope             PASS
npm run arch:guard                 PASS
npm run check:any-types            EXPECTED FAIL
  raw count                        140 / 33
```

## Result

```text
Official baseline before C70  143 / 35
Official baseline after C70   142 / 34
Removed                         1 /  1
```

The raw scanner count is lower because C60 remains HOLD in the working tree and is not part of the official sealed baseline.

