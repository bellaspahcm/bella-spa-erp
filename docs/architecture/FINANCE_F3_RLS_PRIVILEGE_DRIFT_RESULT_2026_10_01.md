# FINANCE F3 RLS PRIVILEGE DRIFT RESULT

Date: 2026-10-01
Status: SEALED

## Root Cause

F3 AR canonical migration granted authenticated users `SELECT` only on the 6 F3
AR tables. Later broad schema grants gave `anon` and `authenticated` direct
write privileges on all public tables, including F3 AR tables.

Before fix, authenticated direct INSERT into `finance_invoices` failed by RLS:

```text
new row violates row-level security policy for table finance_invoices
```

Canonical F3 contract requires direct writes to fail at table privilege level:

```text
permission denied for table finance_invoices
```

## Fix

Added migration:

```text
supabase/migrations/20261001000000_restore_finance_f3_ar_privilege_boundary.sql
```

The migration:

- revokes all direct table privileges on the 6 F3 AR tables from `anon` and
  `authenticated`;
- grants `SELECT` on those tables back to `authenticated`;
- preserves service-role / SECURITY DEFINER write boundaries.

## Verification

Privilege introspection after applying the migration to the test DB:

```text
finance_invoices                 authenticated SELECT=true INSERT=false UPDATE=false DELETE=false anon SELECT=false INSERT=false
finance_invoice_lines            authenticated SELECT=true INSERT=false UPDATE=false DELETE=false anon SELECT=false INSERT=false
finance_receivable_ledger        authenticated SELECT=true INSERT=false UPDATE=false DELETE=false anon SELECT=false INSERT=false
finance_receivable_positions     authenticated SELECT=true INSERT=false UPDATE=false DELETE=false anon SELECT=false INSERT=false
finance_receivable_allocations   authenticated SELECT=true INSERT=false UPDATE=false DELETE=false anon SELECT=false INSERT=false
finance_receivable_adjustments   authenticated SELECT=true INSERT=false UPDATE=false DELETE=false anon SELECT=false INSERT=false
```

Targeted Jest:

```text
npx jest src/platform/finance/__tests__/finance-f3-db-rls.test.ts --runInBand

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

Diff check:

```text
git diff --check = PASS
```

Any-type gate:

```text
npm run check:any-types = FAIL
354 violations / 84 files
```

This is expected residual gate scope, not a Finance/RLS blocker.

## Seal

Finance/RLS blocker is sealed.

C36 can be considered sealed against its targeted verification contract.
