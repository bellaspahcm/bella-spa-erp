# Architecture Gate Result - Real Estate Any-Type Batch RE2

Date: 2026-09-30

Status: PASS FOR GENERATED-CONTRACT-ALIGNED SCOPE

## Bella OS/Product Development Process Gate

Batch RE2 covers the remaining Real Estate production `any` violations that have canonical generated contract evidence after RE1:

```text
src/platform/real-estate/repositories/property-unit.repository.ts
  status: mapDbStatusToDomain(data.status as any)
  status: mapDbStatusToDomain(item.status as any)

src/platform/real-estate/engines/property.service.ts
  (this.supabase as any).from('re_contracts')
  data as any
  (this.supabase as any).from('re_contracts')
  (this.supabase as any).from('re_contracts')
```

This gate does not authorize the three remaining deferred violations:

```text
real_estate_products.unit_code generated Database drift
re_reservations status cancelled-vs-released semantic mismatch
```

## Product Manifest

Area:

```text
Real Estate platform kernel
Property unit repository
Property contract service
```

Capabilities:

```text
Property unit load/save
Contract creation/signing
Accounting ledger posting through IAccountingContract
```

## Ownership Map

```text
real_estate_products.status       -> Real Estate generated Database contract
re_contracts                      -> Real Estate generated Database contract
PropertyUnitStatus                -> Real Estate domain entity
PropertyService contract behavior -> Real Estate platform service
```

## Contract Dependency Map

```text
PropertyUnitRepository
  -> Database public.Enums.re_product_status
  -> PropertyUnitStatus mapper

PropertyService
  -> Database public.Tables.re_contracts
  -> IAccountingContract
```

Canonical evidence:

```text
src/types/database.types.ts
supabase/migrations/20260802150000_real_estate_core_schema.sql
src/platform/real-estate/contracts/property.contract.ts
src/platform/real-estate/domain/property-unit.entity.ts
```

## Change Authority

Authorized:

- Use generated `Database['public']['Enums']['re_product_status']` for DB-to-domain status mapping.
- Remove stale Supabase `as any` casts where generated `re_contracts` contract exists.
- Align `PropertyService` writes with generated `re_contracts` columns: use `state`, not non-generated `status`.
- Keep runtime behavior equivalent for contract state and ledger posting.

Not authorized:

- Add fake `unit_code` generated type.
- Change reservation release/cancel semantics.
- Change migrations or generated Database types.
- Change Accounting Kernel policy.
- Touch Logistics, Finance/Core, Integration Hub, Partner Admin, or `next.config.ts`.

## UI -> Contract Reconciliation

Not applicable. This is platform service/repository type cleanup.

## Additive Migration Plan

No migration.

## 11 Automated Verification Gates Plan

Run after implementation:

```text
targeted Real Estate any scan
npm run lint -- src/platform/real-estate/repositories/property-unit.repository.ts src/platform/real-estate/engines/property.service.ts
npx jest src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts --runInBand
production any independent scan
git diff --check
```

## Decision

PASS.

Proceed only for the 6 generated-contract-aligned violations listed above.
