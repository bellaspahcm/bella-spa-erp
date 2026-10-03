# ARCHITECTURE GATE RESULT - FINANCE F3 RLS PRIVILEGE DRIFT

Date: 2026-10-01
Status: PASS

## Problem / Non-Goals

`finance-f3-db-rls.test.ts` expects authenticated direct INSERT into `finance_invoices`
to fail at table privilege level:

```text
permission denied for table finance_invoices
```

Current database state instead grants authenticated direct write privileges and
falls through to RLS:

```text
new row violates row-level security policy for table finance_invoices
```

Non-goals:

- Do not change the test expectation to accept the RLS error.
- Do not weaken F3 direct-write boundaries.
- Do not change F1/F2/F3 runtime semantics.
- Do not touch generated database types.
- Do not modify Logistics, Healthcare, Education, or Core artifacts.

## Truth And Source Of Truth

Truth:

- F3 AR tables are readable by authenticated users through tenant-scoped RLS.
- Authenticated and anon roles must not have direct write privileges on F3 AR tables.
- F3 mutation flows must go through controlled service-role or SECURITY DEFINER boundaries.

Source of truth:

- `docs/architecture/F3_ACCOUNTS_RECEIVABLE_CONSTITUTION.md`
- `docs/architecture/ARCHITECTURE_GATE_RESULT_F3.md`
- `supabase/migrations/20260817000000_finance_ar_engine_v1.sql`
- Current DB privilege introspection for `finance_invoices`

## Ownership

Owner: Finance OS / F3 Accounts Receivable.

Affected data boundary:

- `public.finance_invoices`
- `public.finance_invoice_lines`
- `public.finance_receivable_ledger`
- `public.finance_receivable_positions`
- `public.finance_receivable_allocations`
- `public.finance_receivable_adjustments`

## Contract Dependency Map

```text
Product / app user
  -> authenticated role
  -> SELECT-only RLS read access
  -> F3 AR tables

F3 writes
  -> Finance service/RPC boundary
  -> service_role / SECURITY DEFINER
  -> F3 AR tables
```

## Root Cause

Original F3 migration explicitly revoked all direct access from `anon` and
`authenticated`, then granted `SELECT` to `authenticated`.

Later broad grant migrations applied:

```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
```

That broad grant drifted the F3 AR privilege contract by giving
`authenticated` INSERT/UPDATE/DELETE on F3 AR tables.

## Change Authority

The user authorized continuing after the `any` campaign stopped at this
Finance/RLS decision boundary. This gate authorizes only a targeted migration
to restore canonical F3 AR table privileges.

Allowed:

- Add one migration restoring F3 AR table grants.
- Run focused privilege and F3 RLS verification.

Not allowed:

- Change Finance business logic.
- Change test expectation to match current drift.
- Add fake contracts or suppressions.
- Broaden changes to F1, F2, Logistics, Healthcare, Education, or Core.

## Minimal Implementation Plan

1. Add a new migration after the broad grant migrations.
2. Revoke all direct table privileges on the 6 F3 AR tables from `anon` and
   `authenticated`.
3. Grant `SELECT` on those tables to `authenticated`.
4. Preserve service-role access.
5. Verify table privilege introspection.
6. Re-run `finance-f3-db-rls.test.ts`.

## Verification Plan

```text
git diff --check
DB privilege introspection
npx jest src/platform/finance/__tests__/finance-f3-db-rls.test.ts --runInBand
npm run check:any-types
```

`check:any-types` may remain red due unrelated residual scope, but C36 can be
sealed only if the targeted F3 RLS test passes after the canonical privilege
contract is restored.
