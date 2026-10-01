# Architecture Gate Result - Broader Any Cleanup Batch C62

## Status

PASS

## Scope

Remove explicit `SupabaseClient<any>` usage from Real Estate context services:

- `src/modules/real_estate/contexts/finance/application/AccountingOutboxListener.ts`
- `src/modules/real_estate/contexts/reservation/application/ReservationService.ts`
- `src/modules/real_estate/contexts/sales/infrastructure/SalesOutboxService.ts`

## Non-Goals

- No Finance F2/F3 changes.
- No DB, migration, RLS, RPC, or business behavior changes.
- No Real Estate status/enum contract changes.
- No Nail Shop changes.
- No Preschool changes.
- No commit.

## Truth / Source Of Truth

| Code point | Source of truth | Canonical behavior |
| --- | --- | --- |
| Supabase client type | `src/lib/supabase-service-client.ts` + generated `Database` type | Shared service client is `SupabaseClient<Database>` |
| Real Estate RPC/table contracts | `src/types/database.types.ts` | Referenced tables/RPCs exist in generated contract |

## Ownership Map

| Data / behavior | Owner | Consumer |
| --- | --- | --- |
| Real Estate context service DB access | Real Estate module service layer | Service tests and runtime services |
| Generated Supabase type contract | Database generated types | Real Estate Supabase consumers |

## Contract Dependency Map

```text
Real Estate context service
  -> typedSupabase from src/lib/supabase
  -> SupabaseClient<Database>
  -> generated table/RPC contracts
```

## Change Authority

Authorized layer:

```text
Real Estate service-local type correction only
```

## Minimal Implementation Plan

1. Import `Database` type in the three scoped services.
2. Replace `SupabaseClient<any>` with `SupabaseClient<Database>`.
3. Preserve all service runtime behavior and assertions.

## Verification Plan

```text
targeted explicit-any scan
npx jest src/modules/real_estate/contexts/finance/__tests__/AccountingOutboxListener.test.ts src/modules/real_estate/contexts/reservation/__tests__/ReservationService.test.ts src/modules/real_estate/contexts/sales/__tests__/SalesOutboxService.test.ts --runInBand
npx eslint scoped files
git diff --check
```

## Gate Conclusion

PASS. C62 is limited to Real Estate service-local Supabase typing.
