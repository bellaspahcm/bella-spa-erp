# Broader Any Cleanup Batch C45 Result — 2026-10-01

## Status

SEALED

## Scope

Bella Education analytics and allergy safety read paths:

- `src/products/bella-education/analytics/repositories/preschool-analytics.repository.ts`
- `src/products/bella-education/analytics/services/preschool-analytics.service.ts`
- `src/products/bella-education/care-wellbeing/health-profile/allergy-safety.service.ts`

## Result

```text
Before check:any-types  297 violations / 65 files
After check:any-types   288 violations / 62 files
Removed                   9 violations /  3 files
```

## Changes

- Added local raw read DTOs for Education analytics selected-field projections.
- Removed fallback `as any[]` casts in enrollment/classroom/attendance raw reads.
- Removed `any` filter parameters in parent engagement metrics.
- Added a small nested-relation guard for allergy name extraction.

## Boundary

```text
Runtime behavior      NONE
Education kernel      NONE
Public contracts      NONE
DB / migration        NONE
Generated types       NONE
Preschool dirty file  UNTOUCHED / EXCLUDED
```

## Verification

```text
targeted explicit-any scan  PASS
targeted Jest               NOT_APPLICABLE: no direct suite for these files
targeted ESLint             PASS
git diff --check             PASS
npm run check:any-types      EXPECTED FAIL: 288 / 62
```

## Notes

This batch preserved the existing read-only analytics fallback behavior and did not add or modify any database contract.
