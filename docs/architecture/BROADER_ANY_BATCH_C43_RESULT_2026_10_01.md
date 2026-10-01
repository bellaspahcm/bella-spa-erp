# Broader Any Cleanup Batch C43 Result — 2026-10-01

## Status

SEALED

## Scope

Bella Education product conformance test doubles:

- `src/products/bella-education/__tests__/bella-education-conformance.integration.test.ts`
- `src/products/bella-education/__tests__/bella-education-customization-conformance.integration.test.ts`

## Result

```text
Before check:any-types  314 violations / 71 files
After check:any-types   306 violations / 69 files
Removed                   8 violations /  2 files
```

## Changes

- Typed Education product test doubles with the existing public Education contracts:
  - `IEducationCourseContract`
  - `IEducationEnrollmentContract`
  - `IEducationAttendanceContract`
  - `IEducationAssessmentContract`
- Typed accounting test doubles with `IAccountingContract`.
- Replaced the customization test repository `any` mock with `jest.Mocked<IEducationRepository>`.
- Updated the customization repository fixture to return real `Course` and `Enrollment` aggregates through existing domain factory/reconstitution methods.

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
targeted Jest               PASS: 2 suites / 17 tests
targeted ESLint             PASS
git diff --check             PASS
npm run check:any-types      EXPECTED FAIL: 306 / 69
```

## Notes

The remaining `306 / 69` violations are outside this C43 scope and remain part of the broader campaign inventory.
