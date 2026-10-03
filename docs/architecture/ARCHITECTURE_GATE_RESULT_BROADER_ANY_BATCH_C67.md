# Architecture Gate Result - Broader Any Batch C67

Date: 2026-10-01
Scope: `src/services/intelligence/hr/__tests__/integration.test.ts`
Status: PASS

## Problem / Non-goals

Remove test-local `any` casts from HR Intelligence integration tests where canonical generated database view contracts already exist.

Non-goals: do not modify HR Intelligence production queries, Customer Intelligence generated-type gaps, Finance, Core, Logistics frozen code, Healthcare, Nail Shop, Preschool, migrations, RLS, or generated database types.

## Truth And Source Of Truth

- Bella Constitution: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
- Generated DB contract: `src/types/database.types.ts`
- HR materialized views exist in generated `Database['public']['Views']`:
  - `mv_workforce_analytics`
  - `mv_attendance_summary`
  - `mv_payroll_summary`
  - `mv_employee_performance`

## Ownership

- Owner: Intelligence HR test suite.
- Contract owner: generated database contract for HR materialized views.

## Contract Dependency Map

```text
HR Intelligence Integration Test
  -> Supabase generated Database views
  -> HR Intelligence service read paths
```

## Change Authority

Authorized: test-local type cleanup using existing generated view contracts.

Not authorized: production query redesign, generated type edits, DB/migration/RLS changes, or Customer Intelligence materialized view work.

## Minimal Plan

1. Remove `as any` from generated HR materialized view table names.
2. Remove the unnecessary invalid-month `as any` because the service parameter is already a string.
3. Run targeted scan, ESLint, scoped TypeScript check, Jest, and diff check.

