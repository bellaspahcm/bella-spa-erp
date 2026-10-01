# Architecture Gate Result — Broader Any Cleanup Batch C56

## Status

PASS

## Scope

Remove explicit `any` usage from the Real Estate kernel integration test mock harness:

- `src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts`

## Non-Goals

- No Real Estate runtime service changes.
- No Accounting runtime service changes.
- No DB, migration, RLS, generated type, or Supabase contract changes.
- No production behavior changes.

## Truth / Source Of Truth

| Code point | Source of truth | Canonical contract |
| --- | --- | --- |
| Mock Real Estate product rows | Test fixture row shape | Domain/service fields used by test |
| Mock reservation/contract/commission rows | Test fixture row shape | Existing stateful mock behavior |
| Mock accounting rows | Accounting test fixture rows | Account and journal side effects |
| Supabase chain double | Service constructor parameter | Existing stateful query behavior |

## Ownership Map

| Data / behavior | Owner | Consumer |
| --- | --- | --- |
| Real Estate kernel mock data | Real Estate integration test | Reservation/property/commission services |
| Accounting mock data | Real Estate integration test | Accounting service integration assertion |

## Contract Dependency Map

```text
Real Estate kernel test
  -> typed in-memory Supabase query double
  -> ReservationService / PropertyService / CommissionService
  -> AccountingService
```

## Change Authority

Authorized layer: integration test mock typing only.

## Verification Plan

```text
targeted explicit-any scan
npx jest src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts --runInBand
npx eslint src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts
git diff --check
npm run check:any-types
```
