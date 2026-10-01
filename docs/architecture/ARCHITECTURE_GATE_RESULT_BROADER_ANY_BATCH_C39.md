# ARCHITECTURE GATE RESULT - BROADER ANY CLEANUP C39

Date: 2026-10-01
Status: PASS

## Scope

C39 continues the `check:any-types` cleanup after C38 was sealed.

Authorized scope:

- `src/modules/real_estate/components/PeopleDirectoryPage.tsx`
- `src/modules/real_estate/components/OrgChartPage.tsx`
- `src/modules/real_estate/components/UnitDetailModal.tsx`

Excluded scope:

- Real Estate production service `SupabaseClient<any>` contract casts.
- Root Real Estate isolation test mocks requiring broad Supabase service contract casting.
- Platform Security cryptographic ledger private state tests.
- Logistics frozen kernel and domain contract files.
- Healthcare, Education, Core, Finance resolver, generated database types, migrations, and RPC contracts.
- `src/products/bella-education/__tests__/preschool-enrollment-operational.integration.test.ts`.

## Problem / Non-Goals

Problem:

- Real Estate UI components contain small explicit any casts for tab literal unions, select value narrowing, and one display-only product metadata lookup.

Non-goals:

- Do not invent a new product field or generated DB type.
- Do not change UI workflow, persistence, schema, RPC, or service behavior.
- Do not refactor the components.
- Do not turn this into a broader Real Estate cleanup.

## Truth And Source Of Truth

Truth:

- Tab IDs are closed literal unions already represented by React state types.
- `PremiumSelect` returns `string`, so the UI must narrow to `PersonCategory` before updating `newPerson.category`.
- Generated `real_estate_products.Row` has `metadata: Json | null` and `owner_name`, but no `customer_display_name` column.

Source of truth:

- `src/modules/real_estate/components/*` state definitions.
- `src/types/database.types.ts` generated `real_estate_products` row.
- `src/components/ui/PremiumSelect.tsx` callback contract.

## Ownership

Owner:

- Real Estate UI components.

Protected boundaries:

- Generated DB contract remains unchanged.
- Product/service contracts remain unchanged.
- UI reads metadata defensively without declaring a new canonical column.

## Contract Dependency Map

```text
Real Estate UI state
  -> local literal union constants
  -> PremiumSelect string callback
  -> local type guard
```

```text
real_estate_products.Row
  -> metadata Json | null
  -> optional display lookup through runtime guard
  -> owner_name fallback
```

## Change Authority

The user authorized continuing cleanup without further approval unless a real decision boundary is reached.

Allowed:

- Type-local union constants.
- Type-local guard functions.
- Metadata runtime narrowing for display-only fallback.

Not allowed:

- DB/schema/generated type changes.
- New product field.
- Service/runtime behavior changes.
- Cross-scope refactor.

## UI To Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
| --- | --- | --- | --- |
| Category tabs | Set `PersonCategory | all` state | Local union state | MATCH |
| Drawer tabs | Set drawer tab union state | Local union state | MATCH |
| Org center tabs | Set center tab union state | Local union state | MATCH |
| Booked customer display | Show customer display label if present | `metadata` JSON + `owner_name` fallback | MATCH via guarded metadata read |

## Additive Migration Plan

Not applicable. No database migration.

## Verification Plan

Run after implementation:

```bash
rg -n "\bany\b|as any|catch \([^)]*: any\)|Promise<any>|Record<[^>]*any|any\[\]" src/modules/real_estate/components/PeopleDirectoryPage.tsx src/modules/real_estate/components/OrgChartPage.tsx src/modules/real_estate/components/UnitDetailModal.tsx
npx eslint "src/modules/real_estate/components/PeopleDirectoryPage.tsx" "src/modules/real_estate/components/OrgChartPage.tsx" "src/modules/real_estate/components/UnitDetailModal.tsx"
git diff --check
npm run check:any-types
```

Expected:

- Targeted scan passes for the three C39 files.
- Targeted ESLint passes.
- `git diff --check` passes.
- `check:any-types` remains expected to fail globally until residual campaign debt is resolved.

## Gate Result

PASS.

C39 may proceed only within the listed Real Estate UI files.
