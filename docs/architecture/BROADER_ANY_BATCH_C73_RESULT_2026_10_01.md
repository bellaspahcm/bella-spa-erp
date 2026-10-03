# Broader Any Batch C73 Result

Date: 2026-10-01
Scope:

- `src/products/bella-education/scheduling/repositories/preschool-scheduling.repository.ts`
- `src/products/bella-education/scheduling/services/leave-substitution.service.ts`

Status: SEALED

## Baseline

Official baseline before C73:

```text
133 violations / 32 files
```

Raw scanner output before C73:

```text
131 violations / 31 files
```

The raw output includes C60 HOLD worktree delta, so the official campaign baseline remains authoritative.

## Change

- Added typed repository methods for leave request creation/approval, affected scheduled assignment listing, and substitution creation.
- Replaced service private-client casts with repository calls.
- Preserved leave approval, assignment cancellation, ratio recalculation, shortage projection, and substitute-assignment behavior.
- Did not change Education kernel, DB schema, RLS, migrations, or Preschool dirty test.

## Verification

```text
targeted any scan                         PASS
npx eslint scope                          PASS
npx tsx import smoke                       PASS
git diff --check scope                     PASS
Education conformance Jest                 PASS (7/7)
npm run arch:guard                         PASS
npm run check:any-types                    EXPECTED FAIL
  raw count                                128 / 30
```

## Result

```text
Official baseline before C73  133 / 32
Official baseline after C73   130 / 31
Removed                         3 /  1
```

The raw scanner count is lower because C60 remains HOLD in the working tree and is not part of the official sealed baseline.

