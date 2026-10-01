# ARCHITECTURE GATE RESULT - BROADER ANY CLEANUP C38

Date: 2026-10-01
Status: PASS

## Scope

C38 continues the `check:any-types` cleanup after C37 was sealed.

Authorized scope:

- `src/modules/real_estate/contexts/sales/__tests__/SalesOutboxService.test.ts`
- `src/modules/real_estate/contexts/reservation/__tests__/ReservationService.test.ts`
- `src/modules/real_estate/contexts/finance/__tests__/AccountingOutboxListener.test.ts`

Excluded scope:

- Real Estate production service contract casts.
- Platform Security cryptographic ledger private state tests.
- Logistics frozen kernel and domain contract files.
- Healthcare and Education verticals.
- Core and Finance resolver boundaries.
- Generated database types, migrations, RPC contracts, and runtime behavior.
- `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`.

## Problem / Non-Goals

Problem:

- Three Real Estate test files still use explicit `any` in Supabase test doubles and spy setup.
- The usage is local to Jest mocks and does not represent a production contract change.

Non-goals:

- Do not fix Real Estate production `SupabaseClient<any>` casts in this batch.
- Do not invent generated DB/RPC contracts.
- Do not add a new abstraction or shared mock framework.
- Do not change runtime service behavior.

## Truth And Source Of Truth

Truth:

- These tests replace the Supabase boundary with local mocks.
- The production services under test call `supabase.rpc(...)` and `supabase.from(...)` with existing RPC/table names.
- C38 only needs typed mock surfaces matching those calls.

Source of truth:

- Current test files.
- Current Real Estate service implementations.
- `src/lib/supabase.ts` exports an unknown server-side client shape at compile time.
- Bella Engineering Constitution rule: tests must model the boundary they replace.

## Ownership

Owner:

- Real Estate module tests.

Consumers:

- Real Estate context service tests.

Protected boundaries:

- Supabase generated contract remains unchanged.
- Real Estate production services remain unchanged.
- Database/RPC contracts remain unchanged.

## Contract Dependency Map

```text
Real Estate test
  -> local Supabase mock target
  -> service under test
  -> existing Supabase call shape
```

No lower-layer contract is modified.

## Change Authority

The user authorized continuing the any cleanup campaign without stopping unless a real decision boundary is reached.

Allowed:

- Type local Jest mock builders.
- Narrow `unknown` Supabase test target with runtime shape assertion.
- Preserve current test assertions and call expectations.

Not allowed:

- Production API changes.
- Generated type changes.
- RPC/schema changes.
- Cross-scope refactors.

## UI To Contract Reconciliation

Not applicable. C38 does not change UI.

## Additive Migration Plan

Not applicable. No database migration.

## Verification Plan

Run after implementation:

```bash
rg -n "\bany\b|as any|catch \([^)]*: any\)|Promise<any>|Record<[^>]*any|any\[\]" src/modules/real_estate/contexts/sales/__tests__/SalesOutboxService.test.ts src/modules/real_estate/contexts/reservation/__tests__/ReservationService.test.ts src/modules/real_estate/contexts/finance/__tests__/AccountingOutboxListener.test.ts
npx jest "src/modules/real_estate/contexts/sales/__tests__/SalesOutboxService.test.ts" "src/modules/real_estate/contexts/reservation/__tests__/ReservationService.test.ts" "src/modules/real_estate/contexts/finance/__tests__/AccountingOutboxListener.test.ts" --runInBand
npx eslint "src/modules/real_estate/contexts/sales/__tests__/SalesOutboxService.test.ts" "src/modules/real_estate/contexts/reservation/__tests__/ReservationService.test.ts" "src/modules/real_estate/contexts/finance/__tests__/AccountingOutboxListener.test.ts"
git diff --check
npm run check:any-types
```

Expected:

- Targeted scan passes for the three C38 files.
- Targeted Jest passes.
- Targeted ESLint passes.
- `git diff --check` passes.
- `check:any-types` remains expected to fail globally until residual campaign debt is resolved.

## Gate Result

PASS.

C38 may proceed only within the listed test mock files.
