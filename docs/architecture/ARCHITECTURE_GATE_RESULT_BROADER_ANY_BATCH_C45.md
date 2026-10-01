# Architecture Gate Result — Broader Any Cleanup Batch C45

## Status

PASS

## Scope

Remove explicit `any` from Bella Education analytics and allergy safety read paths:

- `src/products/bella-education/analytics/repositories/preschool-analytics.repository.ts`
- `src/products/bella-education/analytics/services/preschool-analytics.service.ts`
- `src/products/bella-education/care-wellbeing/health-profile/allergy-safety.service.ts`

## Non-Goals

- No changes to `src/platform/education/**`.
- No DB schema, migration, RLS, generated type, service behavior, or product workflow changes.
- No changes to private repository/client seam issues in other Education product files.
- No changes to `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`.

## Truth / Source Of Truth

| Code point | Source of truth | Canonical contract |
| --- | --- | --- |
| Analytics read model payloads | Existing query select lists in `PreschoolAnalyticsRepository` | Local read-only raw DTOs matching selected fields |
| Parent engagement notice policy requirement | `edu_comm_deliveries` query with joined `edu_comm_notices` projection | `ParentEngagementDeliveryRaw.notice.policy_requirement` |
| Meal allergen relation payload | Existing Supabase nested select | Local relation DTO with `allergen_id` and optional `edu_allergens.name` |

## Ownership Map

| Data / behavior | Owner | Consumer |
| --- | --- | --- |
| Executive analytics raw reads | Bella Education analytics product domain | Preschool analytics service |
| Allergy relation read shape | Bella Education care/wellbeing product domain | Allergy safety service |

## Contract Dependency Map

```text
Bella Education analytics/service read path
  -> selected DB projection fields
  -> local raw read DTOs
  -> executive dashboard DTO
```

## Change Authority

Authorized layer: local read model typing and relation narrowing only.

This batch does not authorize lower-layer contract or schema changes.

## UI To Contract Reconciliation

Not applicable. This batch does not change UI.

## Additive Migration Plan

None. No database changes.

## Verification Plan

```text
targeted explicit-any scan
npx eslint targeted C45 files
git diff --check
npm run check:any-types
```

No direct targeted Jest suite exists for these files; record as `NOT_APPLICABLE`.
