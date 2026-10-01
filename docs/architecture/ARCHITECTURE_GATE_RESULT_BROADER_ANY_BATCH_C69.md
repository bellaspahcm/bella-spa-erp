# Architecture Gate Result - Broader Any Batch C69

Date: 2026-10-01
Scope: `src/platform/finance/__tests__/finance-f2-reconstruction.test.ts`
Status: PASS

## Problem / Non-goals

Remove unnecessary `any` casts from generated `exec_sql` RPC names in the Finance F2 reconstruction test.

Non-goals: do not change Finance F2 runtime behavior, DB/RLS/migrations, the `exec_sql` generated return contract, C60 HOLD, Finance F1 baseline, Core, Logistics, Healthcare, Nail Shop, or Preschool.

## Truth And Source Of Truth

- Bella Constitution: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
- Generated RPC contract: `src/types/database.types.ts`

`exec_sql` exists in generated `Database['public']['Functions']`, so the RPC name itself does not require an `any` cast.

## Ownership

- Owner: Finance F2 test suite.
- Contract owner: generated Supabase function contract.

## Contract Dependency Map

```text
Finance F2 reconstruction test
  -> Supabase generated Database Functions exec_sql
```

## Change Authority

Authorized: test-local removal of unnecessary RPC-name casts where generated contract exists.

Not authorized: changing `exec_sql` return shape, raw SQL semantics, RLS, Finance business behavior, or generated database types.

## Minimal Plan

1. Replace `'exec_sql' as any` with `'exec_sql'`.
2. Leave the residual `data as any` return-shape gap untouched.
3. Run targeted scan, ESLint, Finance F2 Jest, diff check, and architecture guard.

