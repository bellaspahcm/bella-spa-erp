# Architecture Gate Result - Broader Any Batch C72

Date: 2026-10-01
Scope:

- `src/products/bella-education/facilities/repositories/preschool-facilities.repository.ts`
- `src/products/bella-education/facilities/services/maintenance-job.service.ts`

Status: PASS

## Problem / Non-goals

Remove `any` usages from the Bella Education facilities maintenance job service by restoring the existing Repository -> Service boundary.

Non-goals: do not modify Education kernel (`src/platform/education/**`), DB schema, migrations, RLS, Preschool dirty test, scheduling, parent communication, Healthcare, Logistics, Nail Shop, or Finance.

## Truth And Source Of Truth

- Bella Constitution: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
- Education Constitution: `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`
- Facilities domain model: `src/products/bella-education/facilities/domain/facilities.types.ts`
- Generated table contract: `src/types/database.types.ts`

`edu_fac_maintenance_jobs` exists in generated DB types and the facilities repository already owns persistence for `edu_fac_*` tables.

## Ownership

- Owner: Bella Education product facilities module.
- Repository owner: `PreschoolFacilitiesRepository`.
- Service owner: `MaintenanceJobService`.

## Contract Dependency Map

```text
MaintenanceJobService
  -> PreschoolFacilitiesRepository
  -> edu_fac_maintenance_jobs generated table contract
```

## Change Authority

Authorized: product-local repository methods and service wiring to remove private-client casts.

Not authorized: modifying Education kernel, changing maintenance lifecycle semantics, changing DB schema/RLS/migrations, or touching Preschool dirty test.

## Minimal Plan

1. Add typed repository methods for create/assign/complete/verify/get maintenance jobs.
2. Reuse generated row contracts in the repository mapper.
3. Replace service direct private-client access with repository calls.
4. Run targeted scan, ESLint, import smoke, diff check, architecture guard, and raw any scan.

