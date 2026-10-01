# ARCHITECTURE GATE RESULT - BROADER ANY CLEANUP C40

Date: 2026-10-01
Status: PASS

## Scope

C40 continues the `check:any-types` cleanup after C39 was sealed.

Authorized scope:

- `src/products/bella-land/__tests__/bella-land-conformance.integration.test.ts`
- `src/products/bella-land/__tests__/real-estate-concurrency-and-isolation.integration.test.ts`

Excluded scope:

- Platform Real Estate engine implementation.
- Real Estate generated database types.
- Real Estate production service `SupabaseClient<any>` casts.
- Root Real Estate isolation test mocks.
- Logistics frozen kernel and domain contract files.
- Healthcare, Education, Core, Finance resolver, migrations, and RPC contracts.
- `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`.

## Problem / Non-Goals

Problem:

- Bella Land conformance tests use explicit any for public contract mocks.
- The tests already consume Platform Real Estate public contract boundaries.

Non-goals:

- Do not change Real Estate platform contracts.
- Do not change product service behavior.
- Do not invent simplified DTOs to replace generated row types.
- Do not alter test assertions or business semantics.

## Truth And Source Of Truth

Truth:

- Bella Land product services depend on public Platform Real Estate contracts:
  - `IPropertyInventoryContract`
  - `IReservationContract`
  - `IPropertyContract`
  - `ICommissionContract`
- Row shapes are generated in `src/types/database.types.ts`.

Source of truth:

- `src/platform/real-estate/contracts/*.contract.ts`
- `src/types/database.types.ts`
- Current Bella Land service constructors.

## Ownership

Owner:

- Bella Land product tests.

Protected boundaries:

- Platform Real Estate owns public contracts.
- Generated database types own row shapes.
- Product tests may implement typed mocks for these public contracts.

## Contract Dependency Map

```text
Bella Land product test
  -> typed public Real Estate contract mock
  -> Bella Land product service
  -> public Platform Real Estate contract
```

No lower-layer contract is modified.

## Change Authority

The user authorized continuing cleanup without further approval unless a real boundary appears.

Allowed:

- Type test mocks as `jest.Mocked<PublicContract>`.
- Create local row factories that return generated row types.
- Preserve test assertions and mock behavior.

Not allowed:

- Contract/interface changes.
- Generated type changes.
- Schema/RPC changes.
- Product or Platform runtime behavior changes.

## UI To Contract Reconciliation

Not applicable. C40 does not change UI.

## Additive Migration Plan

Not applicable. No database migration.

## Verification Plan

Run after implementation:

```bash
rg -n ":\s*any\b|\bas\s+any\b|<any>|Promise<any>|Record<[^>]*any|any\[\]|catch\s*\([^)]*:\s*any\)" src/products/bella-land/__tests__/bella-land-conformance.integration.test.ts src/products/bella-land/__tests__/real-estate-concurrency-and-isolation.integration.test.ts
npx jest "src/products/bella-land/__tests__/bella-land-conformance.integration.test.ts" "src/products/bella-land/__tests__/real-estate-concurrency-and-isolation.integration.test.ts" --runInBand
npx eslint "src/products/bella-land/__tests__/bella-land-conformance.integration.test.ts" "src/products/bella-land/__tests__/real-estate-concurrency-and-isolation.integration.test.ts"
git diff --check
npm run check:any-types
```

Expected:

- Targeted scan passes for the two C40 files.
- Targeted Jest passes.
- Targeted ESLint passes.
- `git diff --check` passes.
- `check:any-types` remains expected to fail globally until residual campaign debt is resolved.

## Gate Result

PASS.

C40 may proceed only within the two listed Bella Land test files.
