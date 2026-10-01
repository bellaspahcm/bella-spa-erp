# Architecture Gate Result — Broader Any Cleanup Batch C46

## Status

PASS

## Scope

Remove explicit `any` from two product repository mapping files:

- `src/products/bella-education/facilities/repositories/preschool-facilities.repository.ts`
- `src/products/bella-english-center/services/branch.repository.ts`

## Non-Goals

- No changes to `src/platform/education/**`.
- No changes to database schema, migrations, generated types, RLS, or runtime query structure.
- No changes to Facilities bridge, Maintenance job service, or Leave substitution service private-client seams.
- No changes to `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`.

## Truth / Source Of Truth

| Code point | Source of truth | Canonical contract |
| --- | --- | --- |
| Facilities row mapping | `src/types/database.types.ts` | Generated `edu_fac_*` table rows |
| Asset update payload | `src/types/database.types.ts` | Generated `edu_fac_assets.Update` |
| Facilities checklist JSON | Facilities domain type | `ChecklistItem[]` after runtime narrowing |
| English branch enrollment join row | Existing selected projection | Local read-only join DTO |

## Ownership Map

| Data / behavior | Owner | Consumer |
| --- | --- | --- |
| Facilities persistence rows | Bella Education facilities product domain | Facilities repository mappers |
| English enrollment branch query | Bella English Center product | Branch repository mapper |

## Contract Dependency Map

```text
Product repositories
  -> generated DB rows / selected join projection
  -> product domain DTOs
```

## Change Authority

Authorized layer: repository mapper/update typing only.

This batch does not authorize lower-layer schema or service behavior changes.

## UI To Contract Reconciliation

Not applicable. This batch does not change UI.

## Additive Migration Plan

None. No database changes.

## Verification Plan

```text
targeted explicit-any scan
npx eslint targeted C46 files
git diff --check
npm run check:any-types
```

No direct targeted Jest suite exists for these repository mappers; record as `NOT_APPLICABLE`.
