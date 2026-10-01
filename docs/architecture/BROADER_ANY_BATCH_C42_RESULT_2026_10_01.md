# Broader Any Cleanup Batch C42 Result — 2026-10-01

## Status

SEALED

## Scope

Education dashboard presentation state typing only:

- `src/app/dashboard/education/facilities/page.tsx`
- `src/app/dashboard/education/scheduling/page.tsx`

## Result

```text
Before check:any-types  318 violations / 73 files
After check:any-types   314 violations / 71 files
Removed                   4 violations /  2 files
```

## Changes

- Replaced facilities dashboard `exceptions: any[]` with `CommunicationException[]`.
- Replaced scheduling dashboard `exceptions: any[]` with `CommunicationException[]`.
- Replaced scheduling dashboard `leaveRequests: any[]` with generated `edu_sched_leave_requests.Row[]`.
- Replaced scheduling dashboard `substitutions: any[]` with generated `edu_sched_substitutions.Row[]`.

## Boundary

```text
Runtime behavior      NONE
DB / migration        NONE
Education kernel      NONE
Generated types       NONE
Preschool dirty file  UNTOUCHED / EXCLUDED
```

## Verification

```text
targeted explicit-any scan  PASS
targeted ESLint             PASS (exit 0; existing hook dependency warnings only)
git diff --check             PASS
npm run check:any-types      EXPECTED FAIL: 314 / 71
```

## Notes

The remaining `314 / 71` violations are outside this C42 scope and remain part of the broader campaign inventory.
