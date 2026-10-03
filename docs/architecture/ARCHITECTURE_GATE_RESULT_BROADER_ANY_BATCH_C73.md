# Architecture Gate Result - Broader Any Batch C73

Date: 2026-10-01
Scope:

- `src/products/bella-education/scheduling/repositories/preschool-scheduling.repository.ts`
- `src/products/bella-education/scheduling/services/leave-substitution.service.ts`

Status: PASS

## Problem / Non-goals

Remove private-client `any` casts from the Bella Education leave/substitution service by routing leave and substitution persistence through the scheduling repository.

Non-goals: do not modify Education kernel, DB schema, migrations, RLS, Preschool dirty test, facilities, parent communication, Healthcare, Logistics, Nail Shop, or Finance.

## Truth And Source Of Truth

- Bella Constitution: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
- Education Constitution: `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`
- Scheduling domain model: `src/products/bella-education/scheduling/domain/scheduling.types.ts`
- Generated table contract: `src/types/database.types.ts`

`edu_sched_leave_requests`, `edu_sched_shift_assignments`, and `edu_sched_substitutions` exist in generated DB types and the scheduling repository already owns `edu_sched_*` persistence.

## Ownership

- Owner: Bella Education product scheduling module.
- Repository owner: `PreschoolSchedulingRepository`.
- Service owner: `LeaveSubstitutionService`.

## Contract Dependency Map

```text
LeaveSubstitutionService
  -> PreschoolSchedulingRepository
  -> edu_sched_leave_requests / edu_sched_shift_assignments / edu_sched_substitutions
```

## Change Authority

Authorized: product-local repository methods and service wiring to remove private-client casts.

Not authorized: changing leave workflow semantics, ratio-compliance behavior, DB schema/RLS/migrations, or Education kernel contracts.

## Minimal Plan

1. Add typed repository methods for leave request creation/approval, affected assignment listing, and substitution creation.
2. Replace service direct private-client access with repository calls.
3. Run targeted scan, ESLint, import smoke, diff check, Education conformance, architecture guard, and raw any scan.

