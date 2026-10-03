# Architecture Gate Result - Broader Any Batch C66

Date: 2026-10-01
Scope: `src/services/intelligence/finance/balance-sheet.ts`
Status: PASS

## Problem / Non-goals

Remove the remaining `any` usages in the finance intelligence balance sheet query service without changing Finance business semantics, report formulas, RLS, migrations, generated database types, Core, Logistics, Healthcare, Nail Shop, or Preschool.

## Truth And Source Of Truth

- Bella Constitution: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
- Canonical database contract: `supabase/migrations/20260524000000_accounting_core.sql`
- Generated database type evidence: `src/types/database.types.ts`

The canonical journal line table is `journal_lines`, not `journal_entry_lines`.

## Ownership

- Owner: Intelligence finance read service consuming Accounting/F1 ledger data.
- Data owner: Accounting/Finance ledger schema.
- Consumer: Balance sheet read aggregation.

## Contract Dependency Map

```text
Intelligence Finance Balance Sheet
  -> Supabase generated Database contract
  -> accounting_accounts
  -> journal_entries
  -> journal_lines
```

## Change Authority

Authorized: type cleanup and stale read-consumer alignment to the proven generated database table.

Not authorized: Finance posting rules, RLS, migrations, Core, Logistics frozen code, Healthcare, Nail Shop, Preschool, or generated type edits.

## Minimal Plan

1. Replace the stale `journal_entry_lines` read with canonical `journal_lines`.
2. Remove Supabase client and query result `any` casts.
3. Normalize `account_type` locally without `any`.
4. Run targeted scan, ESLint, and diff check.

## Verification Plan

```text
rg any in scope
npx eslint src/services/intelligence/finance/balance-sheet.ts
git diff --check -- scope files
```

