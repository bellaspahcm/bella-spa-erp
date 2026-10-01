# Real Estate Any-Type Batch RE2 Result

Date: 2026-09-30

Status: SEALED FOR RE2 GENERATED-CONTRACT-ALIGNED SCOPE

## Scope

RE2 targeted only the 6 remaining Real Estate production `any` violations with generated contract evidence:

```text
src/platform/real-estate/repositories/property-unit.repository.ts
  2 status mapper casts

src/platform/real-estate/engines/property.service.ts
  4 re_contracts Supabase/data casts
```

Out of scope:

```text
real_estate_products.unit_code generated Database drift
re_reservations cancelled-vs-released semantic mismatch
Logistics frozen
Finance/Core
Integration Hub
Partner Admin
next.config.ts
check:any-types Batch 21
```

## Count Evidence

Before RE2:

```text
Production independent scan: 65 violations / 23 files
Real Estate subset:           9 violations / 3 files
```

After RE2:

```text
Production independent scan: 59 violations / 22 files
Real Estate subset:           3 violations / 2 files
Removed by RE2:               6 violations / 1 file cleared
```

Remaining Real Estate violations:

```text
src/platform/real-estate/repositories/property-unit.repository.ts:95
  unitCode: (data as any).unit_code || data.product_code || ''

src/platform/real-estate/repositories/property-unit.repository.ts:146
  unitCode: (item as any).unit_code || item.product_code || ''

src/platform/real-estate/engines/reservation.service.ts:91
  status: 'cancelled' as any
```

## Implementation

`property-unit.repository.ts`:

- Introduced `RealEstateProductStatus` from generated Database enums.
- `mapDbStatusToDomain` now accepts generated `re_product_status`.
- Added explicit `held` mapping because generated enum includes `held` and the domain entity supports it.
- Removed two `data.status as any` / `item.status as any` casts.

`property.service.ts`:

- Removed Supabase client `as any` casts for `re_contracts`.
- Removed writes to non-generated `status` column.
- Kept canonical generated `state` column for contract FSM state.
- Returned typed `ContractRow` data directly after null guard.

## Verification

```text
targeted Real Estate any scan
PASS for RE2 scope; only 3 deferred Real Estate violations remain

npm run lint -- src/platform/real-estate/repositories/property-unit.repository.ts src/platform/real-estate/engines/property.service.ts src/platform/real-estate/engines/reservation.service.ts src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts
PASS

npx jest src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts --runInBand
PASS
5 passed / 5 total

production independent scan
PASS for expected reduction: 65 -> 59

git diff --check
PASS
```

Scoped TypeScript check:

```text
npx tsc --noEmit --project .cache/tsconfig.real-estate-re2.tmp.json --pretty false
TIMEOUT / NOT VERIFIED
```

This timeout is not counted as PASS. RE2 is sealed by targeted lint, Jest, production scan, and diff-check only.

## Deferred / Blocked

The remaining Real Estate group is not safe to fix by local typing:

```text
2 real_estate_products.unit_code casts
  Migration evidence has unit_code, but current generated Database type does not.
  Required action: refresh/repair generated Database contract from canonical schema.

1 re_reservations status cast
  Current generated re_reservation_status = active | released | expired | converted.
  Existing service/test uses cancelled semantics.
  Required action: decide reservation release/cancel canonical semantics.
```

No fake interface, generated type edit, suppression, or cast workaround was added.

## Decision

RE2 is sealed for its generated-contract-aligned scope.

Real Estate production any cleanup is complete up to the current contract boundary:

```text
18 Real Estate violations
  -9 RE1 sealed
  -6 RE2 sealed
   3 DEFER / BLOCKED by contract evidence
```
