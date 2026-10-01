# Broader Any Batch C72 Result

Date: 2026-10-01
Scope:

- `src/products/bella-education/facilities/repositories/preschool-facilities.repository.ts`
- `src/products/bella-education/facilities/services/maintenance-job.service.ts`

Status: SEALED

## Baseline

Official baseline before C72:

```text
139 violations / 33 files
```

Raw scanner output before C72:

```text
137 violations / 32 files
```

The raw output includes C60 HOLD worktree delta, so the official campaign baseline remains authoritative.

## Change

- Added typed maintenance-job repository methods for create/assign/complete/verify/get.
- Replaced service private-client casts with repository calls.
- Moved row mapping to the repository using generated `edu_fac_maintenance_jobs` row type.
- Did not change Education kernel, DB schema, RLS, migrations, lifecycle semantics, or Preschool dirty test.

## Verification

```text
targeted any scan                         PASS
npx eslint scope                          PASS
npx tsx import smoke                       PASS
git diff --check scope                     PASS
Education conformance Jest                 PASS (7/7)
npm run arch:guard                         PASS
npm run check:any-types                    EXPECTED FAIL
  raw count                                131 / 31
```

## Result

```text
Official baseline before C72  139 / 33
Official baseline after C72   133 / 32
Removed                         6 /  1
```

The raw scanner count is lower because C60 remains HOLD in the working tree and is not part of the official sealed baseline.

