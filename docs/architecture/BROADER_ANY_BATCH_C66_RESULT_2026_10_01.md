# Broader Any Batch C66 Result

Date: 2026-10-01
Scope: `src/services/intelligence/finance/balance-sheet.ts`
Status: SEALED

## Baseline

Official baseline before C66:

```text
164 violations / 37 files
```

Raw scanner output before C66:

```text
162 violations / 36 files
```

The raw output includes C60 HOLD worktree delta, so the official campaign baseline remains authoritative.

## Change

- Replaced stale `journal_entry_lines` reads with canonical generated table `journal_lines`.
- Removed the local `supabase as any` client casts.
- Removed result iteration casts from `(lines as any[])`.
- Replaced `account_type as any` with local account type normalization.
- Preserved balance sheet formulas and P&L aggregation semantics.

## Verification

```text
rg any/journal_entry_lines in scope  PASS
npx eslint scope                    PASS
scoped TypeScript program           PASS
npx jest finance-intelligence       PASS (20/20)
git diff --check scope              PASS
npm run arch:guard                  PASS
npm run check:any-types             EXPECTED FAIL
  raw count                         155 / 35
```

## Result

```text
Official baseline before C66  164 / 37
Official baseline after C66   157 / 36
Removed                         7 /  1
```

The raw scanner count is lower because C60 remains HOLD in the working tree and is not part of the official sealed baseline.


