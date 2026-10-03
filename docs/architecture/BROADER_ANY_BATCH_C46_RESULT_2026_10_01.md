# Broader Any Cleanup Batch C46 Result — 2026-10-01

## Status

SEALED

## Scope

Product repository mapper cleanup:

- `src/products/bella-education/facilities/repositories/preschool-facilities.repository.ts`
- `src/products/bella-english-center/services/branch.repository.ts`

## Result

```text
Before check:any-types  288 violations / 62 files
After check:any-types   280 violations / 60 files
Removed                   8 violations /  2 files
```

## Changes

- Typed Facilities asset update payload with generated `edu_fac_assets.Update`.
- Typed Facilities repository mappers with generated `edu_fac_*` row types.
- Added a small checklist JSON guard to map JSON checklist payloads into `ChecklistItem[]`.
- Typed English Center branch enrollment join rows with a local selected-projection DTO.

## Boundary

```text
Runtime query structure  NONE
Education kernel         NONE
DB / migration           NONE
Generated types          NONE
Private client seams     UNCHANGED
Preschool dirty file     UNTOUCHED / EXCLUDED
```

## Verification

```text
targeted explicit-any scan  PASS
targeted Jest               NOT_APPLICABLE: no direct suite for these mappers
targeted ESLint             PASS
git diff --check             PASS
npm run check:any-types      EXPECTED FAIL: 280 / 60
```

## Notes

This batch intentionally did not touch remaining `repo as any` usage in Facilities bridge, Facilities maintenance, or Scheduling leave substitution services because those require a repository/API boundary decision.
