# Architecture Gate Result — Broader Any Cleanup Batch C42

## Status

PASS

## Scope

Remove explicit `any[]` state types from the Education dashboard presentation layer:

- `src/app/dashboard/education/facilities/page.tsx`
- `src/app/dashboard/education/scheduling/page.tsx`

## Non-Goals

- No changes to `src/platform/education/**`.
- No changes to Education Kernel contracts, tables, migrations, or services.
- No changes to Healthcare, Logistics, Core, Finance, Real Estate, or generated database types.
- No changes to `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`; it remains pre-existing dirty state and out of scope.

## Truth / Source Of Truth

| Item | Source of truth | Canonical contract |
| --- | --- | --- |
| Communication work queue exceptions | `src/products/bella-education/parent-engagement/domain/communication.types.ts` | `CommunicationException` |
| Scheduling leave request rows | `src/types/database.types.ts` | `Database['public']['Tables']['edu_sched_leave_requests']['Row']` |
| Scheduling substitution rows | `src/types/database.types.ts` | `Database['public']['Tables']['edu_sched_substitutions']['Row']` |

## Ownership Map

| Data | Owner | Consumer |
| --- | --- | --- |
| Parent communication exception | Bella Education parent engagement product domain | Education dashboard UI |
| Leave request table row | Education scheduling database contract | Education dashboard UI |
| Substitution table row | Education scheduling database contract | Education dashboard UI |

## Contract Dependency Map

```text
Education dashboard UI
  -> Bella Education parent engagement domain type
  -> Generated Database row types
```

## Change Authority

Authorized layer: presentation state typing only.

This batch does not authorize service behavior, repository behavior, DB schema, RLS, kernel, or cross-product contract changes.

## UI To Contract Reconciliation

| UI state | Current issue | Canonical contract | Conclusion |
| --- | --- | --- | --- |
| `exceptions` in facilities dashboard | `any[]` hides work queue shape | `CommunicationException[]` | MATCH |
| `exceptions` in scheduling dashboard | `any[]` hides work queue shape | `CommunicationException[]` | MATCH |
| `leaveRequests` in scheduling dashboard | `any[]` hides generated row fields | `edu_sched_leave_requests.Row[]` | MATCH |
| `substitutions` in scheduling dashboard | `any[]` hides generated row fields | `edu_sched_substitutions.Row[]` | MATCH |

## Additive Migration Plan

None. No database changes.

## Verification Plan

```text
targeted explicit-any scan
npx eslint src/app/dashboard/education/facilities/page.tsx src/app/dashboard/education/scheduling/page.tsx
git diff --check
npm run check:any-types
```

Expected `check:any-types` result: still FAIL globally with remaining historical violations, but these two Education dashboard files should no longer contribute explicit `any` violations.
