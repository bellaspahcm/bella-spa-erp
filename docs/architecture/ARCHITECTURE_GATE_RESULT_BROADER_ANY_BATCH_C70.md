# Architecture Gate Result - Broader Any Batch C70

Date: 2026-10-01
Scope: `src/platform/finance/__tests__/finance-f2-reconstruction.test.ts`
Status: PASS

## Problem / Non-goals

Remove the remaining `data as any` usage in the Finance F2 reconstruction test without changing Finance runtime behavior, SQL, RLS, migrations, generated database types, or test expectations.

Non-goals: do not change the `exec_sql` generated return contract, Finance F1, C60 HOLD, Logistics, Healthcare, Nail Shop, Preschool, or Education kernel.

## Truth And Source Of Truth

- Bella Constitution: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
- Generated RPC contract: `src/types/database.types.ts`
- Test runtime boundary: `exec_sql` is generated as `Returns: undefined`, while the test uses it to execute a raw `SELECT` and inspect the returned row shape.

This is a dynamic test/runtime boundary. The safe local fix is to treat the RPC result as `unknown` and read the expected row shape through a runtime guard.

## Ownership

- Owner: Finance F2 reconstruction test suite.
- Contract owner: generated Supabase function contract and live test RPC behavior.

## Contract Dependency Map

```text
Finance F2 reconstruction test
  -> exec_sql RPC
  -> runtime row result from SELECT current_setting(...)
```

## Change Authority

Authorized: test-local runtime shape narrowing for a dynamic RPC result.

Not authorized: changing Finance F2 runtime behavior, RLS, SQL behavior, migrations, generated database types, or the canonical `exec_sql` contract.

## Minimal Plan

1. Add a small helper that reads the first row's `val` property from `unknown`.
2. Replace `(data as any)?.[0]?.val` with the helper.
3. Run targeted scan, ESLint, Finance F2 Jest, diff check, and architecture guard.

